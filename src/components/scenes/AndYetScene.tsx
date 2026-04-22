"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { mulberry32 } from "@/lib/prng";
import { palette } from "@/lib/palette";
import { SceneFrame } from "./SceneFrame";

/**
 * The "and yet" scene. A companion to AfterwordScene, but the worldline
 * here is *not quite* solid. Three beats driven by page scroll:
 *
 *   beat 1 (0 → ~0.33)  the single worldline, as the afterword left it —
 *                       but with a faint quantum shimmer running along
 *                       it, hinting at underlying indeterminacy.
 *   beat 2 (~0.33 → ~0.66)  branches fade in: faint alternate threads
 *                       diverging and rejoining — the Many-Worlds read,
 *                       the "crack of light" in the block.
 *   beat 3 (~0.66 → 1)  pull back; the branches keep going. The block
 *                       isn't broken, it's *more* than the line we drew.
 */

function buildLifeCurve(seed: number, height: number): THREE.CatmullRomCurve3 {
  const rnd = mulberry32(seed);
  const pts: THREE.Vector3[] = [];
  const N = 220;
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

/**
 * Build a branch curve that diverges from the main worldline at `tStart`,
 * wanders with its own seed for a stretch, then returns to the trunk at
 * `tEnd`. The deviation amplitude is eased — zero at the endpoints, max
 * in the middle — so branches look like they belong to the same life.
 */
function buildBranchCurve(
  trunk: THREE.CatmullRomCurve3,
  seed: number,
  tStart: number,
  tEnd: number,
  amp: number,
): THREE.CatmullRomCurve3 {
  const rnd = mulberry32(seed);
  const N = 48;
  const pts: THREE.Vector3[] = [];
  const fx = 2.0 + rnd() * 2.2;
  const fz = 1.8 + rnd() * 2.2;
  const phx = rnd() * Math.PI * 2;
  const phz = rnd() * Math.PI * 2;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const t = tStart + (tEnd - tStart) * u;
    const base = trunk.getPoint(t);
    const ease = Math.sin(u * Math.PI);
    const dx = amp * ease * Math.sin(u * Math.PI * fx + phx);
    const dz = amp * ease * Math.cos(u * Math.PI * fz + phz);
    pts.push(new THREE.Vector3(base.x + dx, base.y, base.z + dz));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

type TrunkHandle = {
  setShimmer: (v: number) => void;
};

const TRUNK_VS = /* glsl */ `
  varying float vT;
  void main() {
    vT = (position.y + 1.0) * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRUNK_FS = /* glsl */ `
  precision highp float;
  uniform float uShimmer;
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uWarm;
  varying float vT;
  void main() {
    // Slow travelling wave along the length — reads as quantum shimmer.
    float w = 0.5 + 0.5 * sin(vT * 28.0 - uTime * 0.9);
    float pulse = mix(1.0, 0.75 + 0.6 * w, uShimmer);
    vec3 col = mix(uCore, uWarm, uShimmer * w * 0.5);
    gl_FragColor = vec4(col * pulse, 1.0);
  }
`;

function MainWorldline({
  height,
  handleRef,
}: {
  height: number;
  handleRef: React.MutableRefObject<TrunkHandle | null>;
}) {
  const curve = useMemo(() => buildLifeCurve(7, height), [height]);
  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.026, 16, false),
    [curve],
  );
  const halo = useMemo(
    () => new THREE.TubeGeometry(curve, 600, 0.075, 16, false),
    [curve],
  );
  const birth = useMemo(() => curve.getPoint(0), [curve]);
  const death = useMemo(() => curve.getPoint(1), [curve]);

  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uShimmer: { value: 0 },
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(palette.ink0) },
      uWarm: { value: new THREE.Color(palette.ember) },
    }),
    [],
  );

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  useEffect(() => {
    handleRef.current = {
      setShimmer: (v: number) => {
        if (matRef.current) matRef.current.uniforms.uShimmer.value = v;
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  useEffect(
    () => () => {
      tube.dispose();
      halo.dispose();
    },
    [tube, halo],
  );

  return (
    <group>
      <mesh geometry={halo}>
        <meshBasicMaterial
          color={palette.ember}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={tube}>
        <shaderMaterial
          ref={matRef}
          vertexShader={TRUNK_VS}
          fragmentShader={TRUNK_FS}
          uniforms={uniforms}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[birth.x, birth.y, birth.z]}>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={palette.ink0}
          emissive={palette.ink0}
          emissiveIntensity={2.4}
          roughness={0.15}
          clearcoat={1.0}
        />
      </mesh>
      <mesh position={[death.x, death.y, death.z]}>
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshPhysicalMaterial
          color={palette.ink0}
          emissive={palette.ink0}
          emissiveIntensity={2.4}
          roughness={0.15}
          clearcoat={1.0}
        />
      </mesh>
      <Sparkles
        position={[birth.x, birth.y, birth.z]}
        count={20}
        scale={[0.5, 0.5, 0.5]}
        size={2.2}
        speed={0.18}
        opacity={0.55}
        noise={0.5}
        color="#ffd9a3"
      />
      <Sparkles
        position={[death.x, death.y, death.z]}
        count={20}
        scale={[0.5, 0.5, 0.5]}
        size={2.2}
        speed={0.18}
        opacity={0.55}
        noise={0.5}
        color="#ffd9a3"
      />
    </group>
  );
}

type BranchHandle = { setIntensity: (v: number) => void };

function BranchTrunk({
  curve,
  opacityRef,
}: {
  curve: THREE.CatmullRomCurve3;
  opacityRef: React.MutableRefObject<number>;
}) {
  const geom = useMemo(
    () => new THREE.TubeGeometry(curve, 200, 0.012, 10, false),
    [curve],
  );
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (matRef.current) matRef.current.opacity = 0.38 * opacityRef.current;
  });
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial
        ref={matRef}
        color={palette.ember}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function Branches({
  trunk,
  handleRef,
}: {
  trunk: THREE.CatmullRomCurve3;
  handleRef: React.MutableRefObject<BranchHandle | null>;
}) {
  const branches = useMemo(() => {
    const rnd = mulberry32(2027);
    const segments: {
      curve: THREE.CatmullRomCurve3;
      key: string;
    }[] = [];
    // Six branches, staggered along the life. Small amp so they read as
    // deviations, not different lives — "the path you nearly took."
    const windows: [number, number, number][] = [
      [0.08, 0.22, 0.28],
      [0.2, 0.38, 0.36],
      [0.34, 0.5, 0.32],
      [0.48, 0.64, 0.38],
      [0.6, 0.76, 0.3],
      [0.72, 0.9, 0.34],
    ];
    windows.forEach(([a, b, amp], i) => {
      const c = buildBranchCurve(trunk, 100 + i * 17, a, b, amp);
      segments.push({ curve: c, key: `br-${i}` });
      // A second, finer sibling per window at lower amplitude for
      // texture — the cloud of "also possible."
      const c2 = buildBranchCurve(
        trunk,
        500 + i * 31,
        a + rnd() * 0.02,
        b - rnd() * 0.02,
        amp * 0.55,
      );
      segments.push({ curve: c2, key: `br-${i}-b` });
    });
    return segments;
  }, [trunk]);

  const opacityRef = useRef(0);
  useFrame((_, dt) => {
    // Smoothly follow the scroll-driven target set via handleRef below.
    const k = 1 - Math.exp(-3 * dt);
    opacityRef.current += (targetRef.current - opacityRef.current) * k;
  });
  const targetRef = useRef(0);

  useEffect(() => {
    handleRef.current = {
      setIntensity: (v: number) => {
        targetRef.current = v;
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <group>
      {branches.map((b) => (
        <BranchTrunk key={b.key} curve={b.curve} opacityRef={opacityRef} />
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
    pos: [
      lerp(a.pos[0], b.pos[0]),
      lerp(a.pos[1], b.pos[1]),
      lerp(a.pos[2], b.pos[2]),
    ],
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

  const stations: Station[] = useMemo(
    () => [
      // Beat 1: close, angled on the line, contemplative
      { pos: [3.2, -height * 0.05, 4.4], look: [0, 0, 0] },
      // Beat 2: slightly pulled out + lifted, seeing the branches bloom
      { pos: [4.4, height * 0.1, 5.4], look: [0, 0, 0] },
      // Beat 3: far pull-back, the shape is one of many possible shapes
      { pos: [0, 0, 14], look: [0, 0, 0] },
    ],
    [height],
  );

  useFrame((_, dt) => {
    const p = scrollRef.current ?? 0;
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

function ScrollDrivenEffects({
  scrollRef,
  height,
}: {
  scrollRef: React.RefObject<number>;
  height: number;
}) {
  const trunk = useMemo(() => buildLifeCurve(7, height), [height]);
  const trunkRef = useRef<TrunkHandle | null>(null);
  const branchRef = useRef<BranchHandle | null>(null);

  useFrame(() => {
    const p = scrollRef.current ?? 0;
    // Shimmer begins almost immediately — the "bummer" section already
    // hints at the underlying indeterminacy; the prose names it in beat 2.
    const shimmer = smoothstep(0.08, 0.42, p);
    trunkRef.current?.setShimmer(shimmer);
    // Branches come in during beat 2.
    const branches = smoothstep(0.34, 0.72, p);
    branchRef.current?.setIntensity(branches);
  });

  return (
    <>
      <MainWorldline height={height} handleRef={trunkRef} />
      <Branches trunk={trunk} handleRef={branchRef} />
    </>
  );
}

export function AndYetScene({
  scrollRef,
}: {
  scrollRef: React.RefObject<number>;
}) {
  const HEIGHT = 4.6;
  return (
    <SceneFrame
      camera={{ position: [3.2, -0.2, 4.4], fov: 38 }}
      bg="radial-gradient(ellipse at 50% 55%, rgba(18,22,32,0.6), rgba(5,6,8,1) 80%)"
      bloom={{ intensity: 1.0, threshold: 0.82, smoothing: 0.28 }}
      dprCap={2}
    >
      <Starfield />
      <GentleRotation speed={0.025}>
        <ScrollDrivenEffects scrollRef={scrollRef} height={HEIGHT} />
      </GentleRotation>
      <ScrollCameraRig scrollRef={scrollRef} height={HEIGHT} />
    </SceneFrame>
  );
}
