"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";

/**
 * The closing scene. One worldline — the same shape that the capstone
 * just spent time on, stripped to its essence — hanging in space, lit
 * fully end-to-end, never dimmer in the past or future portions. No
 * spotlight (it was always us, never the world). No event dots (those
 * were narrative; the line is the thing). Camera moves through three
 * sustained beats driven by page-scroll progress:
 *
 *   beat 1 (0 → ~0.33)  past portion, slow pan upward
 *   beat 2 (~0.33 → ~0.66)  future portion, lit identically
 *   beat 3 (~0.66 → 1)  pull back, reveal a field of dim parallel
 *                       worldlines (other lives)
 *
 * The continuity matters: a single uninterrupted shot, not three
 * discrete vignettes. Three vignettes would re-introduce the framing
 * the chapter is trying to dissolve — the spotlight choosing what to
 * show.
 */

function buildLifeCurve(seed: number, height: number): THREE.CatmullRomCurve3 {
  const rnd = mulberry32(seed);
  const pts: THREE.Vector3[] = [];
  const N = 220;
  // The curve serpentines softly through (x, z) as it climbs y from
  // -height/2 (birth) to +height/2 (death). The exact path is arbitrary
  // — it's "a life-shape" in the abstract, not Greg's life specifically.
  const ax = 0.6 + rnd() * 0.5;
  const az = 0.55 + rnd() * 0.5;
  const phx = rnd() * Math.PI * 2;
  const phz = rnd() * Math.PI * 2;
  const fx = 1.4 + rnd() * 1.2;
  const fz = 1.1 + rnd() * 1.3;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = (t - 0.5) * height;
    const x = ax * Math.sin(t * Math.PI * fx + phx);
    const z = az * Math.cos(t * Math.PI * fz + phz);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

function MainWorldline({ height }: { height: number }) {
  const curve = useMemo(() => buildLifeCurve(7, height), [height]);
  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.024, 16, false),
    [curve],
  );
  const halo = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.07, 16, false),
    [curve],
  );
  useEffect(
    () => () => {
      tube.dispose();
      halo.dispose();
    },
    [tube, halo],
  );
  return (
    <group>
      {/* Soft outer halo for bloom to bite into */}
      <mesh geometry={halo}>
        <meshBasicMaterial
          color="#e8a96b"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      {/* Bright bone-white core, fully lit end-to-end (the point
          of this whole scene: no past/future dimming) */}
      <mesh geometry={tube}>
        <meshBasicMaterial color="#f4f1ea" transparent opacity={0.95} />
      </mesh>
      {/* Two endcaps marking birth (bottom) and death (top), so the
          finite extent of the worldline reads as a fact, not a
          consequence of the camera's framing. */}
      <mesh position={[0, -height / 2, 0]}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <mesh position={[0, height / 2, 0]}>
        <sphereGeometry args={[0.045, 20, 20]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
    </group>
  );
}

/**
 * A field of dimmer parallel worldlines surrounding the focal one.
 * Their opacity is driven by `intensity` — fades in as the camera
 * pulls back during beat 3. Stable across renders thanks to a seeded
 * PRNG; their positions and shapes are deterministic.
 */
function WorldlineField({
  intensity,
  height,
  count = 70,
}: {
  intensity: number;
  height: number;
  count?: number;
}) {
  const tubes = useMemo(() => {
    const rnd = mulberry32(2026);
    const arr: { geom: THREE.TubeGeometry; offset: [number, number] }[] = [];
    for (let i = 0; i < count; i++) {
      const ox = (rnd() - 0.5) * 14;
      const oz = (rnd() - 0.5) * 14;
      // Skip the central region so the field doesn't crowd the focal line
      if (Math.hypot(ox, oz) < 1.4) continue;
      const seed = Math.floor(rnd() * 1e6);
      const curve = buildLifeCurve(seed, height * (0.85 + rnd() * 0.3));
      arr.push({
        geom: new THREE.TubeGeometry(curve, 220, 0.008, 8, false),
        offset: [ox, oz],
      });
    }
    return arr;
  }, [count, height]);
  useEffect(
    () => () => {
      for (const t of tubes) t.geom.dispose();
    },
    [tubes],
  );
  return (
    <group>
      {tubes.map((t, i) => (
        <mesh key={i} position={[t.offset[0], 0, t.offset[1]]} geometry={t.geom}>
          <meshBasicMaterial
            color="#c9c4b8"
            transparent
            opacity={0.2 * intensity}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Starfield() {
  const points = useMemo(() => {
    const rnd = mulberry32(3001);
    const n = 700;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 40 + rnd() * 18;
      const phi = Math.acos(2 * rnd() - 1);
      const theta = rnd() * Math.PI * 2;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        color="#f4f1ea"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Scroll-driven camera. We define three target "stations" and ease
 * between them based on the scroll progress 0..1, with cubic
 * smoothstep so the camera lingers at each station instead of moving
 * at constant speed.
 */
type Station = {
  pos: [number, number, number];
  look: [number, number, number];
};

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function lerpStation(a: Station, b: Station, t: number): Station {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    pos: [lerp(a.pos[0], b.pos[0]), lerp(a.pos[1], b.pos[1]), lerp(a.pos[2], b.pos[2])],
    look: [
      lerp(a.look[0], b.look[0]),
      lerp(a.look[1], b.look[1]),
      lerp(a.look[2], b.look[2]),
    ],
  };
}

function ScrollCameraRig({
  scrollRef,
  height,
}: {
  scrollRef: React.RefObject<number>;
  height: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3(0, 0, 0));

  // Three sustained "stations". The camera eases between them with a
  // smoothstep so we dwell at each one rather than move at constant
  // speed.
  const stations: Station[] = useMemo(
    () => [
      // beat 1: looking at the past portion (lower half of the line)
      {
        pos: [3.4, -height * 0.18, 4.6],
        look: [0, -height * 0.32, 0],
      },
      // beat 2: looking at the future portion (upper half) — same
      // distance, same composition; the future is rendered identically
      // to the past
      {
        pos: [3.4, height * 0.18, 4.6],
        look: [0, height * 0.32, 0],
      },
      // beat 3: pulled way back, the worldline becomes one curve in a
      // field of curves
      {
        pos: [0, 0, 18],
        look: [0, 0, 0],
      },
    ],
    [height],
  );

  useFrame((_, dt) => {
    const p = scrollRef.current ?? 0;
    // Map scroll progress to a stage in [0, 2] indexing into stations.
    // Use smoothstep transitions so the camera lingers at each station.
    let s: Station;
    if (p < 0.5) {
      const t = smoothstep(0.18, 0.5, p);
      s = lerpStation(stations[0], stations[1], t);
    } else {
      const t = smoothstep(0.5, 0.85, p);
      s = lerpStation(stations[1], stations[2], t);
    }
    desired.current.set(s.pos[0], s.pos[1], s.pos[2]);
    target.current.lerp(
      new THREE.Vector3(s.look[0], s.look[1], s.look[2]),
      Math.min(1, dt * 2),
    );
    const k = 1 - Math.exp(-1.8 * dt);
    camera.position.lerp(desired.current, k);
    camera.lookAt(target.current);
  });
  return null;
}

function GentleRotation({
  speed = 0.04,
  children,
}: {
  speed?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

export function AfterwordScene({
  scrollRef,
}: {
  /** Live ref of normalized page-scroll progress, 0..1. Updated by
   *  the parent on scroll events. */
  scrollRef: React.RefObject<number>;
}) {
  const HEIGHT = 4.6;
  return (
    <div className="relative w-full h-full">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [3.4, -0.8, 4.6], fov: 38 }}
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(14,18,26,0.55), rgba(5,6,8,1) 80%)",
        }}
      >
        <ambientLight intensity={0.4} />
        <Starfield />
        <GentleRotation speed={0.025}>
          <MainWorldline height={HEIGHT} />
          <WorldlineFieldWatcher scrollRef={scrollRef} height={HEIGHT} />
        </GentleRotation>
        <ScrollCameraRig scrollRef={scrollRef} height={HEIGHT} />
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={0.45}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.28} darkness={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

/**
 * Watches scroll progress and feeds the field's intensity. Wrapping
 * the field in this lets us read the live scroll value inside a
 * component that owns its own state (ref → state pattern), keeping
 * useFrame clean of React state churn.
 */
function WorldlineFieldWatcher({
  scrollRef,
  height,
}: {
  scrollRef: React.RefObject<number>;
  height: number;
}) {
  const intensityRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const p = scrollRef.current ?? 0;
    const target = smoothstep(0.62, 0.95, p);
    const k = 1 - Math.exp(-3 * dt);
    intensityRef.current += (target - intensityRef.current) * k;
    if (groupRef.current) {
      // Apply intensity by scaling each child material's opacity. We
      // walk the children's materials directly to avoid re-rendering
      // React on every frame.
      groupRef.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (mat && "opacity" in mat) {
            mat.opacity = 0.2 * intensityRef.current;
          }
        }
      });
    }
  });
  return (
    <group ref={groupRef}>
      <WorldlineField intensity={1} height={height} />
    </group>
  );
}
