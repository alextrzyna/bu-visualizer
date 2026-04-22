"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

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
