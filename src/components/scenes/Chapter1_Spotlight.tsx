"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { damp, smoothstep } from "@/lib/ease";
import { useUncoveredZone } from "@/lib/uncovered";

/**
 * Chapter 1: the naive spotlight of "now".
 * A horizontal timeline with labeled events; a vertical ember blade
 * sweeps from "born" toward "death" and back, illuminating events it
 * passes over. Each event's illumination ("litness") is a smooth
 * gradient driven by proximity to the blade — scale, halo opacity,
 * and color all ease in and out rather than snapping.
 */

type Ev = { t: number; label: string };
const EVENTS: Ev[] = [
  { t: -1.5, label: "born" },
  { t: -1.0, label: "first memory" },
  { t: -0.45, label: "school" },
  { t: 0.05, label: "now" },
  { t: 0.55, label: "a summer" },
  { t: 1.1, label: "a wedding" },
  { t: 1.5, label: "death" },
];

const SWEEP_HALF = 1.7;
const LIT_RADIUS = 0.55;
const SWEEP_RATE = 0.22;

function bladePositionAt(t: number): number {
  const raw = (1 - Math.cos(t * SWEEP_RATE)) / 2;
  const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
  return (eased - 0.5) * 2 * SWEEP_HALF;
}

function Axis() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 3.6, 16]} />
        <meshBasicMaterial color="#3a4050" />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => {
        const x = -1.5 + i * 0.5;
        return (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.008, 0.08, 0.008]} />
            <meshBasicMaterial color="#3a4050" />
          </mesh>
        );
      })}
    </group>
  );
}

type EventHandle = { setLitness: (l: number) => void };

function applyLitness(
  l: number,
  group: THREE.Group | null,
  coreMat: THREE.MeshBasicMaterial | null,
  haloMat: THREE.MeshBasicMaterial | null,
  labelMat: (THREE.Material & { color: THREE.Color }) | null,
  label: THREE.Group | null,
  sparkGroup: THREE.Group | null,
) {
  if (!group) return;
  const scale = 1 + l * 0.5;
  group.scale.setScalar(scale);
  if (haloMat) haloMat.opacity = 0.42 * l;
  if (coreMat) {
    const c = coreMat.color;
    c.r = 0.42 + (0.96 - 0.42) * l;
    c.g = 0.405 + (0.946 - 0.405) * l;
    c.b = 0.37 + (0.917 - 0.37) * l;
  }
  if (labelMat?.color) {
    const c = labelMat.color;
    c.r = 0.42 + (0.96 - 0.42) * l;
    c.g = 0.405 + (0.946 - 0.405) * l;
    c.b = 0.37 + (0.917 - 0.37) * l;
  }
  if (label) label.position.y = 0.3 + l * 0.06;
  // Sparks emerge as the event ignites; growth is non-linear so the
  // burst feels sudden near the threshold and stable when fully lit.
  if (sparkGroup) {
    const s = Math.pow(Math.max(0, l - 0.15) / 0.85, 1.4);
    sparkGroup.scale.setScalar(s);
  }
}

function EventNode({
  t,
  label,
  nodeRef,
}: {
  t: number;
  label: string;
  nodeRef: React.MutableRefObject<EventHandle | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const labelRef = useRef<THREE.Group>(null);
  const labelMatRef = useRef<THREE.Material & { color: THREE.Color }>(null);
  const sparkGroupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    nodeRef.current = {
      setLitness: (l: number) => {
        applyLitness(
          l,
          groupRef.current,
          coreMatRef.current,
          haloMatRef.current,
          labelMatRef.current,
          labelRef.current,
          sparkGroupRef.current,
        );
      },
    };
    return () => {
      nodeRef.current = null;
    };
  }, [nodeRef]);

  return (
    <group ref={groupRef} position={[t, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshBasicMaterial ref={coreMatRef} color="#6b675e" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color="#ffd9a3"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <group ref={sparkGroupRef} scale={0}>
        <Sparkles
          count={14}
          scale={[0.36, 0.36, 0.36]}
          size={2.4}
          speed={0.5}
          opacity={0.9}
          noise={0.6}
          color="#ffd9a3"
        />
      </group>
      <group ref={labelRef} position={[0, 0.2, 0]}>
        <Billboard>
          <Text
            fontSize={0.075}
            color="#6b675e"
            anchorX="center"
            anchorY="bottom"
            maxWidth={0.7}
            material-ref={labelMatRef}
          >
            {label}
          </Text>
        </Billboard>
      </group>
    </group>
  );
}

const BLADE_VS = /* glsl */ `
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

const BLADE_FS = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    // Soft vertical fade so the blade dies into nothing at top/bottom
    // rather than terminating in a hard line.
    float v = vUv.y;
    float endFade = smoothstep(0.0, 0.18, v) * (1.0 - smoothstep(0.82, 1.0, v));

    // Fresnel-rim brightening — the cylinder's silhouette glows where
    // its normals run perpendicular to the view, giving the blade a
    // volumetric core-and-rim look rather than a flat strip.
    float fres = pow(1.0 - abs(dot(normalize(vWorldNormal), normalize(vViewDir))), 2.4);
    float core = (1.0 - fres) * 0.45 + 0.18;

    float a = (fres * 0.92 + core * 0.55) * endFade;
    vec3 col = uColor * uIntensity * (0.6 + 1.6 * fres + 0.4 * core);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
  }
`;

function Spotlight({ events }: { events: Ev[] }) {
  const bladeRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const bladeUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#ffd9a3") },
      uIntensity: { value: 1.4 },
    }),
    [],
  );
  const handles = useRef<Array<EventHandle | null>>(events.map(() => null));
  const litness = useRef<Float32Array>(
    new Float32Array(events.map((e) => 1 - smoothstep(0, LIT_RADIUS, Math.abs(e.t - bladePositionAt(0))))),
  );
  const startTime = useRef<number | null>(null);

  // Steady-state initialization: as soon as event handles register,
  // apply the litness for the initial blade position so there's no
  // visible ramp-up flash on first frames.
  useEffect(() => {
    const x0 = bladePositionAt(0);
    if (bladeRef.current) bladeRef.current.position.x = x0;
    if (haloRef.current) haloRef.current.position.x = x0;
    if (lightRef.current) lightRef.current.position.x = x0;
    let raf = 0;
    const tick = () => {
      let allReady = true;
      for (let i = 0; i < events.length; i++) {
        const h = handles.current[i];
        if (h) h.setLitness(litness.current[i]);
        else allReady = false;
      }
      if (!allReady) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [events]);

  useFrame(({ clock }, dt) => {
    if (startTime.current === null) startTime.current = clock.elapsedTime;
    const t = clock.elapsedTime - startTime.current;
    const x = bladePositionAt(t);
    if (bladeRef.current) bladeRef.current.position.x = x;
    if (haloRef.current) haloRef.current.position.x = x;
    if (lightRef.current) lightRef.current.position.x = x;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const dist = Math.abs(e.t - x);
      const target = 1 - smoothstep(0, LIT_RADIUS, dist);
      const next = damp(litness.current[i], target, 5, dt);
      litness.current[i] = next;
      handles.current[i]?.setLitness(next);
    }
  });

  return (
    <group>
      {/* Volumetric blade — a thin cylinder with a Fresnel-rim shader.
          Reads as a column of light cutting vertically through the
          timeline. The thin core glows + the rim brightens so it has
          real body, not just a flat ribbon. */}
      <mesh ref={bladeRef}>
        <cylinderGeometry args={[0.04, 0.04, 1.4, 24, 1, true]} />
        <shaderMaterial
          vertexShader={BLADE_VS}
          fragmentShader={BLADE_FS}
          uniforms={bladeUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Bright inner core — a tiny cylinder rendered with emissive
          PhysicalMaterial so Bloom sets it ablaze. */}
      <mesh ref={haloRef}>
        <cylinderGeometry args={[0.011, 0.011, 1.25, 12]} />
        <meshPhysicalMaterial
          color="#ffffff"
          emissive="#ffd9a3"
          emissiveIntensity={4.5}
          roughness={0.2}
          clearcoat={1.0}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#ffd9a3"
        intensity={2.6}
        distance={2.2}
        decay={2}
      />
      {events.map((e, i) => (
        <EventNode
          key={e.label}
          t={e.t}
          label={e.label}
          nodeRef={{
            get current() {
              return handles.current[i];
            },
            set current(v) {
              handles.current[i] = v;
            },
          }}
        />
      ))}
    </group>
  );
}

const CAM_Z = 3.0;
const FOV = 42;
// Padding on each side of the timeline accounts for the leftmost label
// ("born") and rightmost ("death") extending past their event dots.
const LABEL_HALF_WIDTH = 0.32;

function Chapter1SceneInner() {
  const { offsetX, uncoveredHalfW } = useUncoveredZone(1, FOV, CAM_Z);
  const size = useThree((s) => s.size);
  // Timeline is fixed-width in world units (±SWEEP_HALF). Scale the
  // group so its full extent (including label overhang) fits the
  // uncovered zone.
  const targetHalf = SWEEP_HALF + LABEL_HALF_WIDTH;
  const liveScale = uncoveredHalfW > 0 ? uncoveredHalfW / targetHalf : 1;
  // Mobile browsers resize the visual viewport as the URL bar shows
  // and hides during scroll. That propagates into size.width/height,
  // which re-runs useUncoveredZone, which returns a slightly different
  // uncoveredHalfW, which changes scale — visible as the timeline
  // breathing in and out every time the user scrolls. Freeze the
  // scale on mobile after the first valid measurement so it's stable
  // for the rest of the session; desktop keeps the live value.
  const isMobile = size.width > 0 && size.width <= 768;
  const frozenMobileScale = useRef<number | null>(null);
  if (isMobile && frozenMobileScale.current === null && uncoveredHalfW > 0) {
    frozenMobileScale.current = liveScale;
  }
  const scale =
    isMobile && frozenMobileScale.current !== null
      ? frozenMobileScale.current
      : liveScale;
  return (
    <>
      <Starfield count={600} radius={55} />
      <group position={[offsetX, 0, 0]} scale={scale}>
        <Axis />
        <Spotlight events={EVENTS} />
      </group>
    </>
  );
}

export function Chapter1Scene() {
  return (
    <SceneFrame camera={{ position: [0, 0, CAM_Z], fov: FOV }} parallax={{ strength: 0.06 }}>
      <Chapter1SceneInner />
    </SceneFrame>
  );
}
