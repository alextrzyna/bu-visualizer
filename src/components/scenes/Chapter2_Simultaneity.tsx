"use client";

import { useRef, useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { gamma, simultaneitySlope } from "@/lib/physics";

/**
 * Chapter 2: relativity of simultaneity.
 * A 1+1D spacetime diagram: x axis horizontal, t axis vertical.
 * Two events A (left) and B (right) at the same t.
 * The rest frame's plane of simultaneity is a horizontal line.
 * Dragging the boost slider tilts the moving observer's plane:
 *   t = v·x (slope = v in natural units, c=1).
 * Also shows the boosted worldline (x = v·t → slope 1/v on this diagram)
 * and the light cone as a reference (45°).
 */

const A = new THREE.Vector3(-1.2, 0, 0); // (x, t, 0)
const B = new THREE.Vector3(1.2, 0, 0);

function Grid() {
  const g = useMemo(() => {
    const points: number[] = [];
    const span = 2.2;
    for (let i = -2; i <= 2; i++) {
      points.push(i, -span, 0, i, span, 0);
      points.push(-span, i, 0, span, i, 0);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    return geom;
  }, []);
  return (
    <lineSegments geometry={g}>
      <lineBasicMaterial color="#1b2028" transparent opacity={0.6} />
    </lineSegments>
  );
}

function Axes() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.004, 4.8, 8]} />
        <meshBasicMaterial color="#2f3541" />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.004, 0.004, 4.8, 8]} />
        <meshBasicMaterial color="#2f3541" />
      </mesh>
    </group>
  );
}

function LightCone() {
  // 45° lines through origin (c = 1). Shortened to fit the portrait scene column.
  const g = useMemo(() => {
    const pts = [-2.1, -2.1, 0, 2.1, 2.1, 0, -2.1, 2.1, 0, 2.1, -2.1, 0];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geom;
  }, []);
  return (
    <lineSegments geometry={g}>
      <lineBasicMaterial color="#7aa7c7" transparent opacity={0.35} />
    </lineSegments>
  );
}

function Event({ pos, label, color = "#f4f1ea" }: {
  pos: THREE.Vector3;
  label: string;
  color?: string;
}) {
  return (
    <group position={pos.toArray()}>
      <mesh>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <Billboard position={[0.22, 0.22, 0]}>
        <Text
          fontSize={0.18}
          color="#f4f1ea"
          anchorX="left"
          anchorY="bottom"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

function SimultaneityLine({ v }: { v: number }) {
  const slope = simultaneitySlope(v);
  const ref = useRef<THREE.Mesh>(null);
  const dx = 2.1;
  const dt = slope * dx;
  const length = 2 * Math.hypot(dx, dt);
  const angle = Math.atan2(dt, dx);
  return (
    <group rotation={[0, 0, angle]}>
      <mesh ref={ref}>
        <planeGeometry args={[length, 0.015]} />
        <meshBasicMaterial color="#e8a96b" />
      </mesh>
      <mesh>
        <planeGeometry args={[length, 0.18]} />
        <meshBasicMaterial
          color="#e8a96b"
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function BoostedWorldline({ v }: { v: number }) {
  const dt = 2.1;
  const dx = v * dt;
  const length = 2 * Math.hypot(dx, dt);
  const angle = Math.atan2(dt, dx);
  return (
    <group rotation={[0, 0, angle - Math.PI / 2]}>
      <mesh>
        <planeGeometry args={[length, 0.015]} />
        <meshBasicMaterial color="#7aa7c7" />
      </mesh>
    </group>
  );
}

export function Chapter2Scene({
  v = 0.4,
  offsetX = -1.4,
}: {
  v?: number;
  /** Shift the entire scene content horizontally in world units. With
   *  the prose card on the right, a negative offset keeps both events
   *  visible in the uncovered left half of the viewport. */
  offsetX?: number;
}) {
  return (
    <SceneFrame camera={{ position: [0, 0, 5.8], fov: 42 }} postprocessing>
      <Starfield count={260} radius={45} />
      <group position={[offsetX, 0, 0]}>
        <Grid />
        <Axes />
        <LightCone />
        <SimultaneityLine v={v} />
        <BoostedWorldline v={v} />
        <Event pos={A} label="A" />
        <Event pos={B} label="B" />
      </group>
    </SceneFrame>
  );
}

/**
 * Inline control block for Chapter 2 — meant to live inside the prose
 * card rather than float over the scene. Shows live v and γ values so
 * the reader can watch the time-dilation factor respond to the slider.
 */
export function Chapter2Controls({
  v,
  onChange,
}: {
  v: number;
  onChange: (v: number) => void;
}) {
  const g = gamma(v);
  return (
    <div className="flex flex-col gap-2 text-[var(--ink-1)]">
      <div className="flex items-center justify-between text-[12px] font-mono">
        <span className="text-[var(--ink-2)]">observer velocity</span>
        <span className="tabular-nums text-[var(--ink-0)]">
          v = {v.toFixed(2)} c &nbsp;·&nbsp; γ = {g.toFixed(3)}
        </span>
      </div>
      <input
        type="range"
        min={-0.85}
        max={0.85}
        step={0.01}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--ember)]"
        aria-label="Observer velocity"
      />
      <div className="flex justify-between text-[10.5px] font-mono text-[var(--ink-2)]">
        <span>−0.85 c</span>
        <span>at rest</span>
        <span>+0.85 c</span>
      </div>
    </div>
  );
}
