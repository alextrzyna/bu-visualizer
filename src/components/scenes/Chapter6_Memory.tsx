"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { palette } from "@/lib/palette";

/**
 * Chapter 6: memory, consciousness, and the moving spotlight.
 *
 * The whole worldline is present as a static shape — the block view of
 * a life. A subjective "now" cursor slides along it, illuminating a
 * narrow band of the curve via a custom shader (distance-driven
 * emissive gradient: dim grey far from cursor → full warm gold at
 * cursor). A drei <Trail> behind the cursor leaves a fading wake
 * (memory). A volumetric god-ray descends onto the cursor — the
 * literal "spotlight of attention."
 */

const WORLDLINE_VS = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WORLDLINE_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uCursor;
  uniform vec3 uColorDim;
  uniform vec3 uColorBright;
  uniform float uBandWidth;
  uniform float uPastFalloff;
  varying vec3 vWorldPos;

  void main() {
    float d = distance(vWorldPos, uCursor);
    // Sharp gaussian "now" band.
    float now = exp(-pow(d / uBandWidth, 2.0));
    // Slow exponential glow for "memory" — visible behind/ahead of the
    // cursor, weakening with distance to convey "this part of the life
    // is dim but still present in the block."
    float ambient = exp(-d * uPastFalloff);
    float intensity = 0.18 + 0.6 * ambient + 4.0 * now;
    vec3 col = mix(uColorDim, uColorBright, clamp(now * 1.4 + ambient * 0.4, 0.0, 1.0)) * intensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const RAY_VS = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RAY_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    // uv.y on the cone runs from base (0, the narrow cursor end) to
    // top (1, the wide source end).
    float v = vUv.y;

    // Brightest at the cursor and fading upward — sells the "landing"
    // point as the focal spot.
    float anchor = exp(-v * 2.2);
    float shaft = pow(1.0 - v, 0.6) * 0.25;
    float vertBright = anchor + shaft;

    // Fresnel rim brightens the cone's silhouette edges, where normals
    // run perpendicular to the view direction — gives the cone a
    // volumetric feel rather than a flat surface.
    float fres = pow(1.0 - abs(dot(normalize(vWorldNormal), normalize(vViewDir))), 2.4);
    float core = (1.0 - fres) * 0.35;

    float a = (fres * 0.7 + core) * vertBright;
    vec3 col = uColor * uIntensity * (0.5 + 1.6 * fres + 0.6 * vertBright);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.9));
  }
`;

function MemoryWorldline() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = Math.sin(t * Math.PI * 2.2) * 0.8;
      const y = (t - 0.5) * 6;
      const z = Math.cos(t * Math.PI * 1.6) * 0.6;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const tubeGeom = useMemo(
    () => new THREE.TubeGeometry(curve, 400, 0.022, 16, false),
    [curve],
  );
  useEffect(() => () => tubeGeom.dispose(), [tubeGeom]);

  const headRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const rayRef = useRef<THREE.Mesh>(null);

  const tubeUniforms = useMemo(
    () => ({
      uCursor: { value: new THREE.Vector3(0, -3, 0) },
      uColorDim: { value: new THREE.Color(palette.emberFaint).multiplyScalar(0.45) },
      uColorBright: { value: new THREE.Color("#ffd9a3") },
      uBandWidth: { value: 0.6 },
      uPastFalloff: { value: 0.45 },
    }),
    [],
  );

  const rayUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#ffd9a3") },
      uIntensity: { value: 1.2 },
    }),
    [],
  );

  const cursorPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const raw = (Math.sin(clock.elapsedTime * 0.14) + 1) / 2;
    const eased =
      raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    const p = curve.getPointAt(eased);
    cursorPos.copy(p);
    tubeUniforms.uCursor.value.copy(p);
    if (headRef.current) headRef.current.position.copy(p);
    if (lightRef.current) lightRef.current.position.copy(p);
    if (rayRef.current) {
      // Position the god-ray so its bottom (uv.y = 0) sits exactly at
      // the cursor and it extends 12 units upward — guaranteed to
      // reach above the camera frustum no matter where the cursor is.
      rayRef.current.position.set(p.x, p.y + 6, p.z);
    }
  });

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <shaderMaterial
          vertexShader={WORLDLINE_VS}
          fragmentShader={WORLDLINE_FS}
          uniforms={tubeUniforms}
          toneMapped={false}
        />
      </mesh>

      {/* God-ray plane — billboarded toward the camera via a Y-axis-only
          billboard; reads as a vertical column of light descending onto
          the cursor. Additive blend so it brightens the void without
          dimming the worldline beneath. */}
      {/* Inverted cone: wide at the source (top) tapering to a point
          at the cursor. CylinderGeometry with radiusTop > radiusBottom
          gives this for free; openEnded so we don't render the cap
          disc that would occlude the worldline. */}
      <mesh ref={rayRef}>
        <cylinderGeometry args={[0.85, 0.0, 12, 32, 1, true]} />
        <shaderMaterial
          vertexShader={RAY_VS}
          fragmentShader={RAY_FS}
          uniforms={rayUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The "head" — a small bright sphere at the cursor; drei <Trail>
          fades a wake behind it as it slides along the curve. */}
      <Trail
        width={0.08}
        length={2.5}
        color={"#ffd9a3"}
        attenuation={(t) => t * t}
        target={headRef as React.RefObject<THREE.Object3D>}
      />
      <mesh ref={headRef}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={3.5}
          roughness={0.15}
          clearcoat={1.0}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ffd9a3"
        intensity={2.8}
        distance={2.6}
        decay={2}
      />
    </group>
  );
}

export function Chapter6Scene() {
  return (
    <SceneFrame
      camera={{ position: [0, 0.2, 6.2], fov: 40 }}
      bloom={{ intensity: 1.0, threshold: 0.85, smoothing: 0.25 }}
    >
      <Starfield count={350} radius={50} />
      <MemoryWorldline />
    </SceneFrame>
  );
}
