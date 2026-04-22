"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield, Worldline } from "./common";
import { palette } from "@/lib/palette";

function HeroWorldline() {
  const groupRef = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = (t - 0.5) * 7;
      const x = Math.sin(t * Math.PI * 1.6) * 0.55 + Math.sin(t * Math.PI * 4.5) * 0.12;
      const z = Math.cos(t * Math.PI * 1.2) * 0.4;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.04;
  });

  return (
    <group position={[2.3, 0, 0]} rotation={[0, 0, 0.12]}>
      <group ref={groupRef}>
        <Worldline
          curve={curve}
          radius={0.026}
          haloWidth={6}
          haloOpacity={0.22}
          color={palette.ember}
          haloColor={palette.ember}
          emissiveIntensity={3.6}
          tubularSegments={400}
          endpoints
        />
        <Sparkles
          count={28}
          scale={[1.6, 7.5, 1.6]}
          size={2}
          speed={0.18}
          opacity={0.5}
          noise={0.6}
          color={palette.ember}
        />
      </group>
    </group>
  );
}

export function HeroScene() {
  return (
    <SceneFrame
      camera={{ position: [0, 0.4, 7.5], fov: 42 }}
      bg="radial-gradient(ellipse at 70% 50%, rgba(30,28,24,0.55), rgba(5,6,8,1) 70%)"
      bloom={{ intensity: 1.05, threshold: 0.85, smoothing: 0.25 }}
      dof={{ focusDistance: 0.02, focalLength: 0.04, bokehScale: 1.2 }}
      dprCap={2}
      parallax={{ strength: 0.12 }}
    >
      <Starfield count={900} radius={50} />
      <HeroWorldline />
    </SceneFrame>
  );
}
