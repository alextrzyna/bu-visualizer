"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield, BlockFrame } from "./common";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";
import { useUncoveredZone } from "@/lib/uncovered";

function CameraSetup({
  position,
  target = [0, 0, 0],
}: {
  position: [number, number, number];
  target?: [number, number, number];
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, position, target]);
  return null;
}

/**
 * Chapter 7: the block revealed.
 * A lattice of luminous worldlines threaded through a wireframe block,
 * wrapped in a near-invisible glass shell. As the camera orbits, the
 * worldlines refract subtly through the shell — the literal sensation
 * of looking *into* spacetime.
 *
 * Worldlines are rendered via a single instanced tube mesh: one
 * draw call for all 36 lines instead of 36 separate meshes. Each
 * instance carries its own emissive color (cool past → warm present
 * → cool future along the curve, with the bright "now" band sliding
 * over time) via instanced attributes feeding a custom shader.
 */

const BLOCK_RX = 0.9;
const BLOCK_Y = 3.0;
const N_LINES = 36;
const TUBE_SAMPLES = 96;
const TUBE_RADIAL = 8;

const WORLDLINE_VS = /* glsl */ `
  // ShaderMaterial needs explicit instanceMatrix declaration; three.js
  // auto-provides the attribute from the InstancedMesh but does not
  // inject its declaration into raw ShaderMaterial.
  attribute float aPhase;
  attribute float aBrightness;
  varying float vAxialT;
  varying float vBrightness;
  varying float vPhase;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    // The base tube spans Y in [-BLOCK_Y/2, +BLOCK_Y/2]; we re-encode
    // y into [0,1] in JS so the shader's gradient is uniform-free.
    // 'position.x' carries the per-instance random sway baked into the
    // geometry build (different sin curve per instance).
    vAxialT = position.y;
    vBrightness = aBrightness;
    vPhase = aPhase;

    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WORLDLINE_FS = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uColorPast;
  uniform vec3 uColorPresent;
  uniform vec3 uColorFuture;
  uniform float uPulseSpeed;
  varying float vAxialT;
  varying float vBrightness;
  varying float vPhase;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;

  void main() {
    // Two-stop gradient along the worldline: cool past → warm present
    // when "now" passes through. "now" is a moving band sliding from
    // bottom to top, then resetting.
    float now = fract(uTime * uPulseSpeed + vPhase);
    float dToNow = abs(vAxialT - now);
    float nowBand = exp(-dToNow * dToNow * 32.0);

    // Past/future tint by sign of (axial - now).
    float beforeNow = step(vAxialT, now);
    vec3 base = mix(uColorFuture, uColorPast, beforeNow);
    vec3 col = mix(base, uColorPresent, nowBand);

    float fres = pow(1.0 - abs(dot(vWorldNormal, vViewDir)), 2.0);
    float emissive = vBrightness * (0.55 + 1.6 * nowBand + 0.5 * fres);

    gl_FragColor = vec4(col * emissive, 1.0);
  }
`;

function buildSingleSwayingTube(): THREE.BufferGeometry {
  const rnd = mulberry32(2024);
  const pts: THREE.Vector3[] = [];
  const K = TUBE_SAMPLES;
  // A single canonical worldline that has its own gentle serpentine in
  // x and z. Per-instance variation comes from random rotations and
  // translations on the instance matrix; that gives the bundle real
  // diversity while still rendering as one mesh.
  const ampX = 0.18;
  const ampZ = 0.14;
  const freq = 1.6;
  const phase = rnd() * Math.PI;
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    const y = (t - 0.5) * BLOCK_Y;
    const x = Math.sin(t * Math.PI * freq + phase) * ampX;
    const z = Math.cos(t * Math.PI * (freq * 0.8) + phase) * ampZ;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, TUBE_SAMPLES, 0.012, TUBE_RADIAL, false);
  // Normalize position.y into [0,1] for the shader's axial gradient.
  const posAttr = tube.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    posAttr.setY(i, (y + BLOCK_Y / 2) / BLOCK_Y);
  }
  posAttr.needsUpdate = true;
  return tube;
}

function buildInstanceData() {
  const rnd = mulberry32(2025);
  const phases = new Float32Array(N_LINES);
  const brightnesses = new Float32Array(N_LINES);
  const matrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < N_LINES; i++) {
    const ox = (rnd() - 0.5) * 2 * BLOCK_RX * 0.82;
    const oz = (rnd() - 0.5) * 2 * BLOCK_RX * 0.82;
    // Each life has a different lifespan (0.45..1.0 of block height)
    // and a different birth time (centered anywhere within the
    // remaining headroom). Encodes "all moments equally real" without
    // implying every life spans the same epoch.
    const yScale = 0.45 + rnd() * 0.55;
    const yHeadroom = (1.0 - yScale) / 2;
    const yCenter = (rnd() - 0.5) * 2 * yHeadroom * BLOCK_Y;
    dummy.position.set(ox, yCenter, oz);
    dummy.rotation.set(
      (rnd() - 0.5) * 0.08,
      (rnd() - 0.5) * 0.6,
      (rnd() - 0.5) * 0.08,
    );
    dummy.scale.set(0.92 + rnd() * 0.16, yScale, 0.92 + rnd() * 0.16);
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());

    phases[i] = rnd();
    brightnesses[i] = i % 7 === 0 ? 1.7 : 0.5;
  }

  return { phases, brightnesses, matrices };
}

function WorldlineBundle() {
  const tube = useMemo(buildSingleSwayingTube, []);
  const instanceData = useMemo(buildInstanceData, []);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorPast: { value: new THREE.Color(palette.cool).multiplyScalar(0.85) },
      uColorPresent: { value: new THREE.Color("#ffd9a3") },
      uColorFuture: { value: new THREE.Color(palette.ember).multiplyScalar(0.75) },
      uPulseSpeed: { value: 0.045 },
    }),
    [],
  );

  // Attach per-instance custom attributes once the geometry is mounted.
  // These ride on the same BufferGeometry as the position/normal/uv,
  // but their `meshPerAttribute` divisor of 1 makes them per-instance.
  useEffect(() => {
    tube.setAttribute(
      "aPhase",
      new THREE.InstancedBufferAttribute(instanceData.phases, 1),
    );
    tube.setAttribute(
      "aBrightness",
      new THREE.InstancedBufferAttribute(instanceData.brightnesses, 1),
    );
  }, [tube, instanceData]);

  // Push instance matrices into the InstancedMesh's built-in
  // instanceMatrix attribute, which the shader reads as `attribute mat4`.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    instanceData.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [instanceData]);

  useFrame((state, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.05;
  });

  useEffect(() => () => tube.dispose(), [tube]);

  return (
    <group ref={groupRef}>
      <BlockFrame size={[2 * BLOCK_RX, BLOCK_Y, 2 * BLOCK_RX]} color="#3a4150" />
      <instancedMesh
        ref={meshRef}
        args={[tube, undefined, N_LINES]}
        frustumCulled={false}
      >
        <shaderMaterial
          ref={matRef}
          vertexShader={WORLDLINE_VS}
          fragmentShader={WORLDLINE_FS}
          uniforms={uniforms}
          transparent={false}
          toneMapped={false}
        />
      </instancedMesh>
      {/* A subtle volumetric tint inside the wireframe — gives the
          block a sense of contained volume without the refraction
          feedback issues that come with MeshTransmissionMaterial. */}
      <mesh renderOrder={-1}>
        <boxGeometry args={[2 * BLOCK_RX * 1.0, BLOCK_Y * 1.0, 2 * BLOCK_RX * 1.0]} />
        <meshBasicMaterial
          color="#0d1119"
          transparent
          opacity={0.35}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

const CAM_Z = 7;
const CAM_Y = 1.2;
const FOV = 32;

function Chapter7SceneInner() {
  const { offsetX } = useUncoveredZone(7, FOV, CAM_Z);
  return (
    <>
      <CameraSetup position={[0, CAM_Y, CAM_Z]} target={[0, 0, 0]} />
      <Starfield count={600} radius={55} />
      <group position={[offsetX, 0, 0]}>
        <WorldlineBundle />
      </group>
    </>
  );
}

export function Chapter7Scene() {
  return (
    <SceneFrame
      camera={{ position: [0, CAM_Y, CAM_Z], fov: FOV }}
      bloom={{ intensity: 0.95, threshold: 0.85, smoothing: 0.25 }}
    >
      <Chapter7SceneInner />
    </SceneFrame>
  );
}
