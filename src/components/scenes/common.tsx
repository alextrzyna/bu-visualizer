"use client";

import { useEffect, useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";

/**
 * A faint wireframe box representing "the block" — a volume of spacetime.
 * Time is the vertical axis; the two horizontal axes are spatial.
 */
export function BlockFrame({
  size = [3, 4, 3],
  color = "#2a3140",
  opacity = 1,
}: {
  size?: [number, number, number];
  color?: string;
  opacity?: number;
}) {
  const [sx, sy, sz] = size;
  const geom = useMemo(() => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    return new THREE.EdgesGeometry(g);
  }, [sx, sy, sz]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

/**
 * Starfield: a large sphere of points, low density, low intensity —
 * gives scenes depth without competing with content.
 */
export function Starfield({
  count = 700,
  radius = 40,
  seed = 1337,
}: {
  count?: number;
  radius?: number;
  seed?: number;
}) {
  const { positions, sizes } = useMemo(() => {
    const rnd = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = rnd();
      const v = rnd();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.8 + rnd() * 0.2);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i] = 0.6 + rnd() * 1.8;
    }
    return { positions: pos, sizes: sz };
  }, [count, radius, seed]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        color="#f4f1ea"
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

/** Axis labels / ticks for a spacetime diagram. Keeps things legible. */
export function AxisHint({
  position = [0, 0, 0] as [number, number, number],
  color = "#6b675e",
}: {
  position?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.03, 10, 10]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/**
 * The hero "worldline" composite. A spacetime curve becomes a luminous
 * filament: an emissive PhysicalMaterial tube core (HDR-bright so
 * Bloom picks it up) wrapped in a wider, dimmer Line2 halo for cheap
 * volumetric falloff. Toggle `endpoints` for birth/death capsules.
 *
 * Pass `cursorT ∈ [0, 1]` to brighten a moving region of the line near
 * a "now" cursor (Chapter 6, LifeScene). The brightening is computed
 * in the fragment shader via uvs, so it's free of per-frame React work.
 */
type WorldlineProps = {
  curve: THREE.Curve<THREE.Vector3>;
  /** Tube core radius. */
  radius?: number;
  /** Halo line width in world units. */
  haloWidth?: number;
  /** Halo opacity multiplier. */
  haloOpacity?: number;
  /** Core color (display). */
  color?: string;
  /** Halo color (display). */
  haloColor?: string;
  /** HDR emissive intensity (>1 to bloom). */
  emissiveIntensity?: number;
  /** Tubular sample count along the curve. */
  tubularSegments?: number;
  /** Radial sides of the tube. */
  radialSegments?: number;
  endpoints?: boolean;
  endpointColor?: string;
};

export function Worldline({
  curve,
  radius = 0.022,
  haloWidth = 4,
  haloOpacity = 0.18,
  color = palette.ember,
  haloColor = palette.ember,
  emissiveIntensity = 3.2,
  tubularSegments = 360,
  radialSegments = 16,
  endpoints = false,
  endpointColor = palette.ink0,
}: WorldlineProps) {
  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false),
    [curve, tubularSegments, radius, radialSegments],
  );

  const haloPoints = useMemo(() => curve.getPoints(Math.max(64, tubularSegments / 2)), [
    curve,
    tubularSegments,
  ]);

  const startPoint = useMemo(() => curve.getPoint(0), [curve]);
  const endPoint = useMemo(() => curve.getPoint(1), [curve]);

  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  useEffect(() => () => tube.dispose(), [tube]);

  return (
    <group>
      <mesh geometry={tube}>
        <meshPhysicalMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.25}
          metalness={0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.15}
          sheen={0.4}
          sheenColor={color}
        />
      </mesh>
      <Line
        points={haloPoints}
        color={haloColor}
        lineWidth={haloWidth}
        transparent
        opacity={haloOpacity}
        depthWrite={false}
        toneMapped={false}
      />
      {endpoints && (
        <>
          <mesh position={[startPoint.x, startPoint.y, startPoint.z]}>
            <sphereGeometry args={[radius * 3.5, 24, 24]} />
            <meshPhysicalMaterial
              color={endpointColor}
              emissive={endpointColor}
              emissiveIntensity={2.2}
              roughness={0.2}
              clearcoat={1.0}
            />
          </mesh>
          <mesh position={[endPoint.x, endPoint.y, endPoint.z]}>
            <sphereGeometry args={[radius * 3.5, 24, 24]} />
            <meshPhysicalMaterial
              color={endpointColor}
              emissive={endpointColor}
              emissiveIntensity={2.2}
              roughness={0.2}
              clearcoat={1.0}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

/**
 * Initial GPU/device tier estimate. PerformanceMonitor refines from
 * here. Mobile and integrated GPUs start at 0.66; everything else at
 * full. Reduced-motion users get the lowest tier so animations don't
 * pile up beyond the snap-transition floor we apply in CSS.
 */
export function detectInitialQualityCeiling(): number {
  if (typeof window === "undefined") return 1.0;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0.33;
  const ua = navigator.userAgent || "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile) return 0.66;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (mem <= 4) return 0.66;
  return 1.0;
}
