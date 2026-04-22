"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { mulberry32 } from "@/lib/prng";

/**
 * Chapter 3: Minkowski light cones.
 *
 * Two spatial dimensions form a horizontal disc; time runs vertically.
 * The future cone opens upward (ember), the past cone opens downward
 * (cool). Everything inside the cones is causally connected to the
 * origin; everything outside is "elsewhere" — spacelike separated.
 *
 * The scene labels each region so it reads without the prose, tints a
 * faint outer envelope to embody the "elsewhere" region, uses a bone-
 * white color for the observer's worldline (distinct from the ember
 * future cone), and emphasizes the origin event with a pulsing halo
 * since every cone is defined relative to it.
 */

function Cone({
  direction = 1,
  color = "#e8a96b",
  opacity = 0.14,
}: {
  direction?: 1 | -1;
  color?: string;
  opacity?: number;
}) {
  const h = 3;
  const r = 3; // 45° → base radius == height (c = 1)
  return (
    <group
      position={[0, (direction * h) / 2, 0]}
      rotation={[direction === 1 ? 0 : Math.PI, 0, 0]}
    >
      <mesh>
        <coneGeometry args={[r, h, 64, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r - 0.004, r + 0.004, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/**
 * A faint outer envelope sphere to make the "elsewhere" region visible
 * as a presence rather than absence. Large enough to reach past the
 * cone surfaces, with very low opacity.
 */
function ElsewhereEnvelope() {
  return (
    <mesh>
      <sphereGeometry args={[3.8, 48, 32]} />
      <meshBasicMaterial
        color="#1a2231"
        transparent
        opacity={0.14}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function NowDisc() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0, 3.02, 96]} />
      <meshBasicMaterial
        color="#11141b"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TimeAxis() {
  return (
    <mesh>
      <cylinderGeometry args={[0.004, 0.004, 6.6, 8]} />
      <meshBasicMaterial color="#2f3541" />
    </mesh>
  );
}

/**
 * Origin event: a crisp white core with a slow outward-pulsing halo so
 * the eye lands on it first — it is the event every cone is defined
 * against.
 */
function OriginEvent() {
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // A single slow pulse: scale 1 → 1.6, opacity 0.55 → 0, over ~3s.
    const phase = (t % 3) / 3;
    const scale = 1 + phase * 0.6;
    const opacity = 0.55 * (1 - phase);
    if (haloRef.current) haloRef.current.scale.setScalar(scale);
    if (haloMatRef.current) haloMatRef.current.opacity = opacity;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color="#ffd9a3"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ffd9a3" intensity={1.6} distance={3.2} />
      <Billboard position={[0.3, 0.05, 0]}>
        <Text
          fontSize={0.12}
          color="#f4f1ea"
          anchorX="left"
          anchorY="middle"
        >
          an event
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * The observer's worldline passing through the origin. Bone-white so
 * it reads as a distinct object from the ember future cone.
 */
function ObserverWorldline() {
  return (
    <mesh rotation={[0, 0, 0.18]}>
      <cylinderGeometry args={[0.022, 0.022, 5.5, 12]} />
      <meshBasicMaterial color="#c9c4b8" transparent opacity={0.95} />
    </mesh>
  );
}

function DustParticles() {
  const group = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const rnd = mulberry32(42);
    const N = 220;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (rnd() - 0.5) * 8;
      p[i * 3 + 1] = (rnd() - 0.5) * 6;
      p[i * 3 + 2] = (rnd() - 0.5) * 8;
    }
    return { positions: p };
  }, []);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.02;
  });
  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        sizeAttenuation
        color="#c9c4b8"
        transparent
        opacity={0.28}
      />
    </points>
  );
}

/** Floating region labels. Positioned off-axis so they don't overlap
 * with the origin event or the worldline. The "elsewhere" label sits
 * on the front-right (+x, +z) so it stays clear of the prose card on
 * the left side of the screen. */
function RegionLabels() {
  return (
    <group>
      <Billboard position={[0, 3.4, 0]}>
        <Text
          fontSize={0.17}
          color="#e8a96b"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.01}
          outlineColor="#05060a"
        >
          future light cone
        </Text>
      </Billboard>
      <Billboard position={[0, -3.4, 0]}>
        <Text
          fontSize={0.17}
          color="#7aa7c7"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.01}
          outlineColor="#05060a"
        >
          past light cone
        </Text>
      </Billboard>
      <Billboard position={[3.2, 0, 2.2]}>
        <Text
          fontSize={0.15}
          color="#6b7486"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#05060a"
        >
          elsewhere
        </Text>
      </Billboard>
    </group>
  );
}

export function Chapter3Scene() {
  return (
    <SceneFrame camera={{ position: [5.6, 2.6, 6.0], fov: 40 }}>
      <Starfield count={300} radius={55} />
      <DustParticles />
      <ElsewhereEnvelope />
      <TimeAxis />
      <NowDisc />
      <Cone direction={1} color="#e8a96b" opacity={0.13} />
      <Cone direction={-1} color="#7aa7c7" opacity={0.1} />
      <ObserverWorldline />
      <OriginEvent />
      <RegionLabels />
    </SceneFrame>
  );
}
