"use client";

import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { gamma, simultaneitySlope } from "@/lib/physics";
import { palette } from "@/lib/palette";

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

const GRID_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GRID_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uAxisColor;
  uniform float uSpan;
  uniform float uFade;
  varying vec2 vUv;

  float gridLine(vec2 p, float thickness, float aa) {
    vec2 g = abs(fract(p + 0.5) - 0.5);
    vec2 d = fwidth(p) * aa;
    float lx = 1.0 - smoothstep(thickness, thickness + d.x, g.x);
    float ly = 1.0 - smoothstep(thickness, thickness + d.y, g.y);
    return max(lx, ly);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uSpan;
    float r = length(p);
    // Radial fade — far cells fade into the void, conveying depth in
    // an otherwise flat 1+1D diagram.
    float fade = exp(-r * uFade);

    float minor = gridLine(p, 0.0008, 1.5);
    // Major lines on integer multiples of 1.0 (already what fract gives)
    // — minor and major coincide here; we boost them where x or y is
    // small (close to the axes).
    float axisProx = exp(-min(abs(p.x), abs(p.y)) * 1.4);

    float a = clamp(minor * fade * 0.85 + axisProx * 0.05, 0.0, 0.95);
    vec3 col = mix(uColor, uAxisColor, axisProx * 0.6);
    gl_FragColor = vec4(col, a);
  }
`;

function Grid() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#374052") },
      uAxisColor: { value: new THREE.Color("#5a6478") },
      uSpan: { value: 2.4 },
      uFade: { value: 0.42 },
    }),
    [],
  );
  return (
    <mesh>
      <planeGeometry args={[4.8, 4.8]} />
      <shaderMaterial
        vertexShader={GRID_VS}
        fragmentShader={GRID_FS}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
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
  const dx = 2.1;
  const dt = slope * dx;
  const points = useMemo<[number, number, number][]>(
    () => [
      [-dx, -dt, 0],
      [dx, dt, 0],
    ],
    [dx, dt],
  );

  // Slider-driven flash: when v changes, a brief brightness pulse
  // ripples through the plane to acknowledge the interaction.
  const flashRef = useRef(1);
  const prevV = useRef(v);
  const haloRef = useRef<THREE.Mesh | null>(null);
  const midRef = useRef<THREE.Mesh | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    if (Math.abs(v - prevV.current) > 0.001) {
      flashRef.current = 1.7;
      prevV.current = v;
    }
  }, [v]);

  useFrame((_, dt) => {
    flashRef.current += (1.0 - flashRef.current) * (1 - Math.exp(-3.5 * dt));
    const f = flashRef.current;
    const apply = (obj: THREE.Object3D | null, base: number) => {
      if (!obj) return;
      const mat = (obj as THREE.Mesh).material as
        | (THREE.Material & { opacity?: number })
        | undefined;
      if (mat && "opacity" in mat) mat.opacity = base * f;
    };
    apply(haloRef.current, 0.16);
    apply(midRef.current, 0.32);
    apply(coreRef.current, 1.0);
  });

  return (
    <group>
      <Line
        ref={haloRef as unknown as React.Ref<never>}
        points={points}
        color={palette.ember}
        lineWidth={14}
        transparent
        opacity={0.16}
        depthWrite={false}
      />
      <Line
        ref={midRef as unknown as React.Ref<never>}
        points={points}
        color={palette.ember}
        lineWidth={6}
        transparent
        opacity={0.32}
        depthWrite={false}
      />
      <Line
        ref={coreRef as unknown as React.Ref<never>}
        points={points}
        color={"#ffd9a3"}
        lineWidth={2.4}
        transparent
        opacity={1}
        toneMapped={false}
      />
    </group>
  );
}

function BoostedWorldline({ v }: { v: number }) {
  const dt = 2.1;
  const dx = v * dt;
  const points = useMemo<[number, number, number][]>(
    () => [
      [-dx, -dt, 0],
      [dx, dt, 0],
    ],
    [dx, dt],
  );
  return (
    <Line
      points={points}
      color={palette.cool}
      lineWidth={1.8}
      transparent
      opacity={0.95}
    />
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
    <SceneFrame camera={{ position: [0, 0, 5.8], fov: 42 }} postprocessing parallax={{ strength: 0.08 }}>
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
