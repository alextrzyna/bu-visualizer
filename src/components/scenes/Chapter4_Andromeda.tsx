"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Line, Text, Trail } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { palette } from "@/lib/palette";

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

const GALAXY_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GALAXY_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uCoreColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uArmTwist;
  uniform float uArmCount;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Polar coords centered on the disc.
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    if (r > 1.0) discard;
    float theta = atan(c.y, c.x);

    // Logarithmic spiral arms — phase is constant along a true log
    // spiral, so banding by cos(phase * armCount) draws the arms.
    float phase = theta + log(max(r, 0.04)) * uArmTwist + uTime * 0.03;
    float arms = cos(phase * uArmCount);
    arms = pow(0.5 + 0.5 * arms, 1.7);

    // Dust lanes — narrow dark bands along the leading edge of arms.
    float dust = pow(0.5 + 0.5 * cos(phase * uArmCount + 0.6), 16.0);
    arms = max(0.0, arms - dust * 0.55);

    // Central bulge: brighter core that fades outward.
    float bulge = pow(1.0 - r, 4.5);

    // Outer disc fades to transparent at the rim.
    float discMask = pow(1.0 - r, 1.4);

    // Star speckle: small per-pixel hash modulated by arm intensity.
    float speckle = step(0.96, hash(floor(vUv * 320.0))) * arms;

    float intensity = (arms * 0.55 + bulge * 1.4 + speckle * 1.6) * discMask * uIntensity;
    vec3 col = mix(uColor, uCoreColor, smoothstep(0.0, 0.65, bulge + arms * 0.4));
    float a = clamp((arms * 0.5 + bulge * 0.95 + speckle) * discMask, 0.0, 0.95);
    gl_FragColor = vec4(col * (0.45 + intensity), a);
  }
`;

function Galaxy({
  position,
  color,
  scale = 1,
  label,
  labelOffset = [0, -0.5, 0] as [number, number, number],
  armTwist = 4.5,
  armCount = 2,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  label: string;
  labelOffset?: [number, number, number];
  armTwist?: number;
  armCount?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uCoreColor: { value: new THREE.Color("#fff4d6") },
      uIntensity: { value: 1.4 },
      uArmTwist: { value: armTwist },
      uArmCount: { value: armCount },
    }),
    [color, armTwist, armCount],
  );

  useFrame(({ clock }, dt) => {
    if (group.current) group.current.rotation.z -= dt * 0.05;
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group position={position}>
      <group ref={group} scale={scale} rotation={[Math.PI / 2.4, 0, 0]}>
        {/* Procedural spiral disc — log-spiral arms, central bulge,
            dust lanes, sparse star speckle. Replaces the old
            sphere-and-ring sprite. */}
        <mesh>
          <planeGeometry args={[1.6, 1.6]} />
          <shaderMaterial
            ref={matRef}
            vertexShader={GALAXY_VS}
            fragmentShader={GALAXY_FS}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Bright bulge sphere on top so the galactic core has a 3D
            lift and Bloom catches it harder than a flat disc would. */}
        <mesh>
          <sphereGeometry args={[0.075, 24, 24]} />
          <meshPhysicalMaterial
            color="#fff4d6"
            emissive="#ffd9a3"
            emissiveIntensity={3.0}
            roughness={0.2}
            clearcoat={1.0}
            toneMapped={false}
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
 * A small bright "ticker" rising along a worldline. Distinct speeds
 * for Earth and Andromeda encode the galaxies' independence — each
 * proceeds through its own time, regardless of the simultaneity-plane
 * geometry imposed by an observer.
 */
function WorldlineFlow({
  x,
  color,
  speed,
  phase,
}: {
  x: number;
  color: string;
  speed: number;
  phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime * speed + phase) % 1);
    const y = -WORLDLINE_H / 2 + t * WORLDLINE_H;
    ref.current.position.set(x, y, 0.001);
  });
  return (
    <>
      <Trail
        width={0.06}
        length={1.6}
        color={color}
        attenuation={(t) => t * t}
        target={ref as React.RefObject<THREE.Object3D>}
      />
      <mesh ref={ref}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={3.5}
          roughness={0.2}
          clearcoat={1.0}
          toneMapped={false}
        />
      </mesh>
    </>
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
    <SceneFrame camera={{ position: [0, 0, 5.0], fov: 46 }} parallax={{ strength: 0.08 }}>
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
        color={palette.ink0}
        scale={0.55}
        label="Earth"
        armCount={2}
        armTwist={5.0}
      />
      <Galaxy
        position={[ANDROMEDA_X, 0, 0]}
        color={palette.ink1}
        scale={0.72}
        label="Andromeda"
        armCount={3}
        armTwist={4.2}
      />

      {/* Independent flows up each worldline at slightly different
          speeds — visually encodes that each galaxy proceeds through
          its own time, while the simultaneity planes are observer
          constructs. */}
      <WorldlineFlow x={EARTH_X} color={palette.ember} speed={0.07} phase={0} />
      <WorldlineFlow x={ANDROMEDA_X} color={palette.cool} speed={0.055} phase={0.42} />
    </SceneFrame>
  );
}
