"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { buildWorldline } from "@/lib/worldline";

type Meta = ReturnType<typeof buildWorldline>;

/**
 * Procedural shader for each blob — fbm noise modulated by a radial
 * falloff so the cluster has organic, breathing turbulence rather than
 * the static radial gradient of the original canvas-texture version.
 * Additive blend across blobs still accumulates density; with the
 * bloom + AgX of the foundation chain, dense regions glow proportional
 * to their per-pixel intensity sum.
 */
const BLOB_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BLOB_FS = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPhase;
  uniform vec3 uHotColor;
  uniform vec3 uCoolColor;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1, 0)), u.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float radial = pow(1.0 - r, 1.6);

    vec2 np = vUv * 3.2 + uPhase;
    float n = fbm(np + uTime * 0.06);
    n = smoothstep(0.25, 0.95, n);

    float density = radial * (0.4 + 0.9 * n);
    float a = density * uIntensity;
    vec3 col = mix(uCoolColor, uHotColor, smoothstep(0.0, 0.7, density)) * (0.6 + 1.4 * density);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
  }
`;

function activeIntensity(
  atTime: number,
  tStart: number,
  tEnd: number,
  baseIntensity: number,
  edgeDays = 365,
): number {
  const edge = edgeDays * 24 * 3600 * 1000;
  if (atTime < tStart - edge || atTime > tEnd + edge) return 0;
  let fade = 1;
  if (atTime < tStart) fade = (atTime - (tStart - edge)) / edge;
  else if (atTime > tEnd) fade = 1 - (atTime - tEnd) / edge;
  fade = Math.max(0, Math.min(1, fade));
  fade = 0.5 - 0.5 * Math.cos(fade * Math.PI);
  return baseIntensity * fade;
}

function Blob({
  position,
  radius,
  intensity,
  phase,
}: {
  position: [number, number, number];
  radius: number;
  intensity: number;
  phase: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uPhase: { value: phase },
      uHotColor: { value: new THREE.Color("#ffd9a3") },
      uCoolColor: { value: new THREE.Color("#8a5c34") },
    }),
    [intensity, phase],
  );
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      matRef.current.uniforms.uIntensity.value = intensity;
    }
  });
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BLOB_VS}
        fragmentShader={BLOB_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

export function HeatBlobs({
  microLocations,
  atTime,
  y,
  zoomScale,
}: {
  microLocations: Meta["microLocations"];
  atTime: number;
  y: number;
  zoomScale: number;
}) {
  const active = microLocations
    .map((m, i) => ({
      m,
      weight: activeIntensity(atTime, m.tStart, m.tEnd, m.intensity),
      phase: i * 0.913,
    }))
    .filter((x) => x.weight > 0.01);

  return (
    <group position={[0, y, 0]}>
      {active.map(({ m, weight, phase }) => {
        const baseRadius = 0.35 + weight * 0.45;
        const radius = baseRadius / zoomScale;
        return (
          <Blob
            key={m.name}
            position={[m.position.x, 0, m.position.z]}
            radius={radius}
            intensity={Math.min(0.95, 0.35 + weight * 0.9)}
            phase={phase}
          />
        );
      })}
    </group>
  );
}
