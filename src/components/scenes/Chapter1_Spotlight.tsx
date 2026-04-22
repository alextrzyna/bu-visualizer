"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";
import { damp, smoothstep } from "@/lib/ease";

/**
 * Chapter 1: the naive spotlight of "now".
 * A horizontal timeline with labeled events; a vertical ember blade
 * sweeps back and forth across it, illuminating events it passes over.
 * Each event's illumination ("litness") is a smooth gradient driven by
 * proximity to the blade — scale, halo opacity, and color all ease in
 * and out rather than snapping.
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

// Distance over which an event responds to the passing blade. Wider than
// the blade's own width so litness eases in/out over ~0.55 world units.
const LIT_RADIUS = 0.55;

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

/**
 * A single event: a small core sphere, a halo that fades in with litness,
 * and a label that brightens with litness. Controlled via a stable ref
 * that exposes setLitness so the parent can drive it from useFrame without
 * causing React re-renders.
 */
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

  useEffect(() => {
    // Publish a handle to the parent spotlight loop so it can drive our
    // litness without causing React re-renders. Released on unmount.
    nodeRef.current = {
      setLitness: (l: number) => {
        const g = groupRef.current;
        if (!g) return;
        const scale = 1 + l * 0.5;
        g.scale.setScalar(scale);
        if (haloMatRef.current) haloMatRef.current.opacity = 0.42 * l;
        if (coreMatRef.current) {
          const c = coreMatRef.current.color;
          c.r = 0.42 + (0.96 - 0.42) * l;
          c.g = 0.405 + (0.946 - 0.405) * l;
          c.b = 0.37 + (0.917 - 0.37) * l;
        }
        if (labelMatRef.current && labelMatRef.current.color) {
          const c = labelMatRef.current.color;
          c.r = 0.42 + (0.96 - 0.42) * l;
          c.g = 0.405 + (0.946 - 0.405) * l;
          c.b = 0.37 + (0.917 - 0.37) * l;
        }
        if (labelRef.current) {
          labelRef.current.position.y = 0.3 + l * 0.06;
        }
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

type EventHandle = { setLitness: (l: number) => void };

function Spotlight({ events }: { events: Ev[] }) {
  const bladeRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const xRef = useRef(0);
  // Stable array of per-event handles so the spotlight loop can drive
  // each event's litness without re-rendering.
  const handles = useRef<Array<EventHandle | null>>(events.map(() => null));

  // Per-event smoothed litness values; damped each frame toward target.
  const litness = useRef<Float32Array>(new Float32Array(events.length));

  useFrame(({ clock }, dt) => {
    // Ease the blade's horizontal position with a cubic-shaped ping-pong
    // (slower at the endpoints) so the sweep never feels like it's tracked
    // at constant speed.
    const raw = (Math.sin(clock.elapsedTime * 0.22) + 1) / 2;
    const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    const x = (eased - 0.5) * 2 * 1.7;
    xRef.current = x;
    if (bladeRef.current) bladeRef.current.position.x = x;
    if (haloRef.current) haloRef.current.position.x = x;
    if (lightRef.current) lightRef.current.position.x = x;

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      // Smoothstep the raw proximity into a 0..1 target, then exponentially
      // damp the current litness toward it. This is the fix for the "hop":
      // litness never changes discontinuously, and its approach rate is
      // frame-rate independent.
      const dist = Math.abs(e.t - x);
      const target = 1 - smoothstep(0, LIT_RADIUS, dist);
      const current = litness.current[i];
      const next = damp(current, target, 5, dt);
      litness.current[i] = next;
      handles.current[i]?.setLitness(next);
    }
  });

  return (
    <group>
      {/*
        The spotlight blade: a thin ember core plus a widened translucent
        core so bloom has something to latch onto. No background halo
        rectangle — the previous version was getting bisected by the
        ground plane and read as an exclamation point. Now the blade is
        one continuous column that fades softly at the top and bottom
        via the halo mesh's lower opacity, and the point light provides
        the actual scene-wide glow.
      */}
      <mesh ref={bladeRef}>
        <planeGeometry args={[0.022, 1.2]} />
        <meshBasicMaterial color="#ffd9a3" />
      </mesh>
      <mesh ref={haloRef}>
        <planeGeometry args={[0.09, 1.4]} />
        <meshBasicMaterial
          color="#e8a96b"
          transparent
          opacity={0.45}
          depthWrite={false}
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

// The ground plane was previously cutting the spotlight halo in half —
// and it wasn't doing much work aesthetically — so it's removed. The
// starfield gives the scene all the depth it needs.

/**
 * Keep the whole timeline on screen regardless of column aspect ratio.
 * Computes the camera z so a horizontal half-width of `halfWidth` world
 * units always fits, then locks the camera on origin vertically.
 *
 * Perspective geometry: halfWidthOnScreen = z · tan(fov/2) · aspect
 * → z = halfWidth / (tan(fov/2) · aspect)
 */
function TimelineCamera({ halfWidth = 2.0 }: { halfWidth?: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    // The camera's fov is set once by SceneFrame (42°); we only need to
    // choose z so the requested half-width fits the current aspect.
    const aspect = size.width / size.height;
    const fovRad = (camera.fov * Math.PI) / 180;
    const z = halfWidth / (Math.tan(fovRad / 2) * aspect);
    camera.position.set(0, 0, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, halfWidth]);
  return null;
}

export function Chapter1Scene() {
  // The scene is now full-bleed (landscape). We still use the aspect-aware
  // TimelineCamera, but push the half-width wider so the timeline spans a
  // generous portion of the canvas instead of feeling lost in it.
  return (
    <SceneFrame camera={{ position: [0, 0, 3.0], fov: 42 }}>
      <TimelineCamera halfWidth={2.8} />
      <Starfield count={600} radius={55} />
      <Axis />
      <Spotlight events={EVENTS} />
    </SceneFrame>
  );
}
