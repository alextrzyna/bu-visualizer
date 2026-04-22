"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";
import { SceneFrame } from "./SceneFrame";

/**
 * The closing scene. One worldline — the same shape that the capstone
 * just spent time on, stripped to its essence — hanging in space, lit
 * fully end-to-end, never dimmer in the past or future portions. No
 * spotlight (it was always us, never the world). No event dots (those
 * were narrative; the line is the thing). Camera moves through three
 * sustained beats driven by page-scroll progress:
 *
 *   beat 1 (0 → ~0.33)  past portion, slow pan upward
 *   beat 2 (~0.33 → ~0.66)  future portion, lit identically
 *   beat 3 (~0.66 → 1)  pull back, reveal a field of dim parallel
 *                       worldlines (other lives)
 */

function buildLifeCurve(seed: number, height: number): THREE.CatmullRomCurve3 {
  const rnd = mulberry32(seed);
  const pts: THREE.Vector3[] = [];
  const N = 220;
  const ax = 0.6 + rnd() * 0.5;
  const az = 0.55 + rnd() * 0.5;
  const phx = rnd() * Math.PI * 2;
  const phz = rnd() * Math.PI * 2;
  const fx = 1.4 + rnd() * 1.2;
  const fz = 1.1 + rnd() * 1.3;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = (t - 0.5) * height;
    const x = ax * Math.sin(t * Math.PI * fx + phx);
    const z = az * Math.cos(t * Math.PI * fz + phz);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

function MainWorldline({ height }: { height: number }) {
  const curve = useMemo(() => buildLifeCurve(7, height), [height]);
  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.026, 16, false),
    [curve],
  );
  const halo = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.075, 16, false),
    [curve],
  );
  // Birth and death are the actual curve endpoints, which have
  // non-zero x/z thanks to the serpentine — the caps have to follow
  // the curve, not sit on the y-axis.
  const birth = useMemo(() => curve.getPoint(0), [curve]);
  const death = useMemo(() => curve.getPoint(1), [curve]);
  useEffect(
    () => () => {
      tube.dispose();
      halo.dispose();
    },
    [tube, halo],
  );
  return (
    <group>
      {/* Soft outer halo — additive ember tube that Bloom amplifies. */}
      <mesh geometry={halo}>
        <meshBasicMaterial
          color={palette.ember}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* Bright bone-white core — emissive PhysicalMaterial, fully lit
          end-to-end. The whole point of the scene: no past/future
          dimming. */}
      <mesh geometry={tube}>
        <meshPhysicalMaterial
          color={palette.ink0}
          emissive={palette.ink0}
          emissiveIntensity={2.0}
          roughness={0.18}
          clearcoat={1.0}
          clearcoatRoughness={0.12}
        />
      </mesh>
      <mesh position={[birth.x, birth.y, birth.z]}>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={palette.ink0}
          emissive={palette.ink0}
          emissiveIntensity={2.4}
          roughness={0.15}
          clearcoat={1.0}
        />
      </mesh>
      <mesh position={[death.x, death.y, death.z]}>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={palette.ink0}
          emissive={palette.ink0}
          emissiveIntensity={2.4}
          roughness={0.15}
          clearcoat={1.0}
        />
      </mesh>
      {/* Slow ambient spark drift at birth/death — anchored to the
          actual curve endpoints, not a guessed axis position. */}
      <Sparkles
        position={[birth.x, birth.y, birth.z]}
        count={20}
        scale={[0.5, 0.5, 0.5]}
        size={2.2}
        speed={0.18}
        opacity={0.55}
        noise={0.5}
        color="#ffd9a3"
      />
      <Sparkles
        position={[death.x, death.y, death.z]}
        count={20}
        scale={[0.5, 0.5, 0.5]}
        size={2.2}
        speed={0.18}
        opacity={0.55}
        noise={0.5}
        color="#ffd9a3"
      />
    </group>
  );
}

const FIELD_VS = /* glsl */ `
  attribute float aBrightness;
  attribute float aHue;
  varying float vAxialT;
  varying float vBrightness;
  varying float vHue;
  void main() {
    vAxialT = (position.y + 1.0) * 0.5;
    vBrightness = aBrightness;
    vHue = aHue;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FIELD_FS = /* glsl */ `
  precision highp float;
  uniform float uIntensity;
  uniform vec3 uColorWarm;
  uniform vec3 uColorCool;
  varying float vAxialT;
  varying float vBrightness;
  varying float vHue;
  void main() {
    vec3 col = mix(uColorCool, uColorWarm, vHue);
    float endFade = smoothstep(0.0, 0.06, vAxialT) * (1.0 - smoothstep(0.94, 1.0, vAxialT));
    float a = vBrightness * uIntensity * endFade;
    gl_FragColor = vec4(col * (0.55 + 0.7 * a), clamp(a, 0.0, 0.95));
  }
`;

type FieldHandle = { setIntensity: (i: number) => void };

const FIELD_COUNT = 70;

function buildFieldData(height: number) {
  // Canonical tube spans Y in [-1, +1]; per-instance yScale stretches
  // it to the right height in world.
  const baseCurve = buildLifeCurve(7000, 2.0);
  const baseTube = new THREE.TubeGeometry(baseCurve, 96, 0.008, 6, false);
  const rnd = mulberry32(2026);
  const matrices: THREE.Matrix4[] = [];
  const brightnesses: number[] = [];
  const hues: number[] = [];
  const dummy = new THREE.Object3D();
  let attempts = 0;
  while (matrices.length < FIELD_COUNT && attempts < FIELD_COUNT * 8) {
    attempts++;
    const ox = (rnd() - 0.5) * 14;
    const oz = (rnd() - 0.5) * 14;
    if (Math.hypot(ox, oz) < 1.4) continue;
    dummy.position.set(ox, 0, oz);
    dummy.rotation.set(
      (rnd() - 0.5) * 0.1,
      rnd() * Math.PI * 2,
      (rnd() - 0.5) * 0.1,
    );
    const yScale = (height / 2) * (0.85 + rnd() * 0.3);
    dummy.scale.set(0.85 + rnd() * 0.5, yScale, 0.85 + rnd() * 0.5);
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());
    brightnesses.push(0.18 + rnd() * 0.28);
    // Warmth scales inversely with distance — closer to focal line
    // reads slightly warmer, "a life like yours, also glowing."
    const dist = Math.hypot(ox, oz);
    const warmth = Math.max(0, 1 - dist / 5) * (0.3 + rnd() * 0.4);
    hues.push(warmth);
  }
  return {
    baseTube,
    matrices,
    brightnesses: new Float32Array(brightnesses),
    hues: new Float32Array(hues),
  };
}

function WorldlineField({
  height,
  handleRef,
}: {
  height: number;
  handleRef: React.MutableRefObject<FieldHandle | null>;
}) {
  const { baseTube, matrices, brightnesses, hues } = useMemo(
    () => buildFieldData(height),
    [height],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uIntensity: { value: 0 },
      uColorWarm: { value: new THREE.Color(palette.ember).multiplyScalar(0.85) },
      uColorCool: { value: new THREE.Color(palette.ink1) },
    }),
    [],
  );

  useEffect(() => {
    baseTube.setAttribute(
      "aBrightness",
      new THREE.InstancedBufferAttribute(brightnesses, 1),
    );
    baseTube.setAttribute(
      "aHue",
      new THREE.InstancedBufferAttribute(hues, 1),
    );
  }, [baseTube, brightnesses, hues]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  useEffect(() => () => baseTube.dispose(), [baseTube]);

  useEffect(() => {
    handleRef.current = {
      setIntensity: (i: number) => {
        if (matRef.current) matRef.current.uniforms.uIntensity.value = i;
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[baseTube, undefined, FIELD_COUNT]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={FIELD_VS}
        fragmentShader={FIELD_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function Starfield() {
  const points = useMemo(() => {
    const rnd = mulberry32(3001);
    const n = 700;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 40 + rnd() * 18;
      const phi = Math.acos(2 * rnd() - 1);
      const theta = rnd() * Math.PI * 2;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        color="#f4f1ea"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

type Station = {
  pos: [number, number, number];
  look: [number, number, number];
};

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function lerpStation(a: Station, b: Station, t: number): Station {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    pos: [
      lerp(a.pos[0], b.pos[0]),
      lerp(a.pos[1], b.pos[1]),
      lerp(a.pos[2], b.pos[2]),
    ],
    look: [
      lerp(a.look[0], b.look[0]),
      lerp(a.look[1], b.look[1]),
      lerp(a.look[2], b.look[2]),
    ],
  };
}

function ScrollCameraRig({
  scrollRef,
  height,
}: {
  scrollRef: React.RefObject<number>;
  height: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3(0, 0, 0));

  const stations: Station[] = useMemo(
    () => [
      { pos: [3.4, -height * 0.18, 4.6], look: [0, -height * 0.32, 0] },
      { pos: [3.4, height * 0.18, 4.6], look: [0, height * 0.32, 0] },
      { pos: [0, 0, 18], look: [0, 0, 0] },
    ],
    [height],
  );

  useFrame((_, dt) => {
    const p = scrollRef.current ?? 0;
    let s: Station;
    if (p < 0.5) {
      const t = smoothstep(0.18, 0.5, p);
      s = lerpStation(stations[0], stations[1], t);
    } else {
      const t = smoothstep(0.5, 0.85, p);
      s = lerpStation(stations[1], stations[2], t);
    }
    desired.current.set(s.pos[0], s.pos[1], s.pos[2]);
    target.current.lerp(
      new THREE.Vector3(s.look[0], s.look[1], s.look[2]),
      Math.min(1, dt * 2),
    );
    const k = 1 - Math.exp(-1.8 * dt);
    camera.position.lerp(desired.current, k);
    camera.lookAt(target.current);
  });
  return null;
}

function GentleRotation({
  speed = 0.04,
  children,
}: {
  speed?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function WorldlineFieldWatcher({
  scrollRef,
  height,
}: {
  scrollRef: React.RefObject<number>;
  height: number;
}) {
  const intensityRef = useRef(0);
  const handleRef = useRef<FieldHandle | null>(null);
  useFrame((_, dt) => {
    const p = scrollRef.current ?? 0;
    const target = smoothstep(0.62, 0.95, p);
    const k = 1 - Math.exp(-3 * dt);
    intensityRef.current += (target - intensityRef.current) * k;
    handleRef.current?.setIntensity(intensityRef.current);
  });
  return <WorldlineField height={height} handleRef={handleRef} />;
}

export function AfterwordScene({
  scrollRef,
}: {
  scrollRef: React.RefObject<number>;
}) {
  const HEIGHT = 4.6;
  return (
    <SceneFrame
      camera={{ position: [3.4, -0.8, 4.6], fov: 38 }}
      bg="radial-gradient(ellipse at 50% 55%, rgba(14,18,26,0.55), rgba(5,6,8,1) 80%)"
      bloom={{ intensity: 0.95, threshold: 0.85, smoothing: 0.25 }}
      dof={{ focusDistance: 0.025, focalLength: 0.04, bokehScale: 1.0 }}
      dprCap={2}
    >
      <Starfield />
      <GentleRotation speed={0.025}>
        <MainWorldline height={HEIGHT} />
        <WorldlineFieldWatcher scrollRef={scrollRef} height={HEIGHT} />
      </GentleRotation>
      <ScrollCameraRig scrollRef={scrollRef} height={HEIGHT} />
    </SceneFrame>
  );
}
