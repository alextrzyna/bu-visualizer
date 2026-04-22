"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";

/**
 * Chapter 4: the Andromeda paradox (Rietdijk 1966, Putnam 1967).
 *
 * Horizontal spacetime diagram: x is the Earth↔Andromeda axis, y is
 * time. Earth's present event anchors two planes of simultaneity with
 * opposing tilts; each crosses Andromeda's worldline at a visibly
 * different height ("a different now on Andromeda").
 *
 * All line primitives use drei's `<Line>` (Line2 / MeshLine under the
 * hood) with a world-space lineWidth for smooth, anti-aliased, soft-
 * capped strokes. The old thin PlaneGeometry strokes looked like
 * pixelated ribbons at any close camera distance — this replaces them.
 */

// Camera is centered on x=0; card covers roughly the right 37% of the
// canvas at this viewport width, so scene content must live in the left
// ~63%, which at z=5, fov=46 is roughly x ∈ [-3.4, +0.6].
const EARTH_X = -2.6;
const ANDROMEDA_X = -0.5;
const DIST = ANDROMEDA_X - EARTH_X;
const WORLDLINE_H = 3.6;

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

/** A galaxy sprite — a soft core plus an inclined disc ring. Kept small
 *  so it doesn't dominate the composition. */
function Galaxy({
  position,
  color,
  scale = 1,
  label,
  labelOffset = [0, -0.5, 0] as [number, number, number],
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  label: string;
  labelOffset?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.1;
  });
  return (
    <group position={position}>
      <group ref={group} scale={scale}>
        <mesh>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.12} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <ringGeometry args={[0.2, 0.62, 96]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <ringGeometry args={[0.66, 0.82, 96]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <Billboard position={labelOffset}>
        <Text
          fontSize={0.13}
          color="#c9c4b8"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.006}
          outlineColor="#05060a"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/**
 * Vertical worldline, rendered as a soft dashed segment so the eye
 * reads "a trajectory through time" rather than "a rigid rod." Two
 * superimposed lines — a faint wide halo and a crisper dashed core —
 * give the line a gentle glow.
 */
function Worldline({ x, color = "#3a4050" }: { x: number; color?: string }) {
  const pts = useMemo<[number, number, number][]>(
    () => [
      [x, -WORLDLINE_H / 2, 0],
      [x, WORLDLINE_H / 2, 0],
    ],
    [x],
  );
  return (
    <group>
      <Line
        points={pts}
        color={color}
        lineWidth={6}
        transparent
        opacity={0.12}
        depthWrite={false}
      />
      <Line
        points={pts}
        color={color}
        lineWidth={1.5}
        dashed
        dashSize={0.12}
        gapSize={0.08}
      />
    </group>
  );
}

/**
 * Plane of simultaneity rendered as two concentric `<Line>` strokes: a
 * bright thin core and a wide soft outer halo. Using real anti-aliased
 * lines eliminates the jagged ribbon look of the old plane-geometry
 * approach.
 */
function SimulPlane({ tilt, color }: { tilt: number; color: string }) {
  const pts = useMemo<[number, number, number][]>(() => {
    // Line through (EARTH_X, 0) with slope tilt, extending from the
    // Earth side a touch and past Andromeda so the stroke visibly
    // pierces both worldlines.
    const xLeft = EARTH_X - 0.15;
    const xRight = ANDROMEDA_X + 0.35;
    const yLeft = (xLeft - EARTH_X) * tilt;
    const yRight = (xRight - EARTH_X) * tilt;
    return [
      [xLeft, yLeft, 0],
      [xRight, yRight, 0],
    ];
  }, [tilt]);
  return (
    <group>
      {/* wide soft halo for bloom to bite into */}
      <Line
        points={pts}
        color={color}
        lineWidth={14}
        transparent
        opacity={0.12}
        depthWrite={false}
      />
      <Line
        points={pts}
        color={color}
        lineWidth={6}
        transparent
        opacity={0.28}
        depthWrite={false}
      />
      <Line points={pts} color={color} lineWidth={2.4} />
    </group>
  );
}

/** Where a plane of simultaneity crosses Andromeda's worldline. A
 * bright core sphere, a soft halo, and a subtle pulsing outer ring
 * that matches the accent color — makes the two "nows" feel like live
 * marks on Andromeda's trajectory. */
function IntersectionDot({
  tilt,
  color,
  label,
  labelAbove = true,
}: {
  tilt: number;
  color: string;
  label: string;
  labelAbove?: boolean;
}) {
  const y = tilt * DIST;
  const pulseRef = useRef<THREE.Mesh>(null);
  const pulseMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!pulseRef.current || !pulseMatRef.current) return;
    const t = (clock.elapsedTime % 3) / 3;
    pulseRef.current.scale.setScalar(1 + t * 1.4);
    pulseMatRef.current.opacity = 0.35 * (1 - t);
  });
  return (
    <group position={[ANDROMEDA_X, y, 0]}>
      <mesh>
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.26} />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial
          ref={pulseMatRef}
          color={color}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      <Billboard position={[0, labelAbove ? 0.32 : -0.32, 0]}>
        <Text
          fontSize={0.11}
          color={color}
          anchorX="center"
          anchorY={labelAbove ? "bottom" : "top"}
          maxWidth={2.4}
          outlineWidth={0.008}
          outlineColor="#05060a"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

/** Earth's "present event" — the origin of the two planes of
 * simultaneity. A bright core with a slow outward pulse marks it as
 * the privileged reference point of the whole diagram. */
function EarthOrigin() {
  const pulseRef = useRef<THREE.Mesh>(null);
  const pulseMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!pulseRef.current || !pulseMatRef.current) return;
    const t = (clock.elapsedTime % 3.5) / 3.5;
    pulseRef.current.scale.setScalar(1 + t * 1.8);
    pulseMatRef.current.opacity = 0.4 * (1 - t);
  });
  return (
    <group position={[EARTH_X, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.08, 20, 20]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshBasicMaterial color="#ffd9a3" transparent opacity={0.3} />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshBasicMaterial
          ref={pulseMatRef}
          color="#ffd9a3"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      <pointLight color="#ffd9a3" intensity={1.8} distance={2.5} decay={2} />
    </group>
  );
}

/** Subtle "→ time" axis hint positioned where there's empty space. */
function TimeAxisLabel() {
  return (
    <Billboard position={[ANDROMEDA_X - 0.35, WORLDLINE_H / 2 - 0.1, 0]}>
      <Text
        fontSize={0.1}
        color="#4a5262"
        anchorX="right"
        anchorY="middle"
      >
        time ↑
      </Text>
    </Billboard>
  );
}

export function Chapter4Scene({
  tiltA = 0.36,
  tiltB = -0.36,
}: {
  tiltA?: number;
  tiltB?: number;
}) {
  return (
    <SceneFrame camera={{ position: [0, 0, 5.0], fov: 46 }}>
      <CameraSetup position={[0, 0, 5.0]} target={[0, 0, 0]} />
      <Starfield count={420} radius={55} />

      <Worldline x={EARTH_X} />
      <Worldline x={ANDROMEDA_X} />

      <SimulPlane tilt={tiltA} color="#e8a96b" />
      <SimulPlane tilt={tiltB} color="#7aa7c7" />

      <IntersectionDot
        tilt={tiltA}
        color="#e8a96b"
        label="a moment on Andromeda"
        labelAbove
      />
      <IntersectionDot
        tilt={tiltB}
        color="#7aa7c7"
        label="…days apart"
        labelAbove={false}
      />

      <EarthOrigin />
      <TimeAxisLabel />

      <Galaxy
        position={[EARTH_X, 0, 0]}
        color="#f4f1ea"
        scale={0.55}
        label="Earth"
      />
      <Galaxy
        position={[ANDROMEDA_X, 0, 0]}
        color="#c9c4b8"
        scale={0.72}
        label="Andromeda"
      />
    </SceneFrame>
  );
}
