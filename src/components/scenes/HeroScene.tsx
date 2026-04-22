"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";

/**
 * A gently curving worldline that sits off to the right, tilted slightly
 * so it never reads as a vertical UI bar. Slowly drifts.
 */
function Worldline() {
  const groupRef = useRef<THREE.Group>(null);

  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = (t - 0.5) * 7;
      // Gentle serpentine in x, small drift in z
      const x = Math.sin(t * Math.PI * 1.6) * 0.55 + Math.sin(t * Math.PI * 4.5) * 0.12;
      const z = Math.cos(t * Math.PI * 1.2) * 0.4;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const tube = useMemo(
    () => new THREE.TubeGeometry(curve, 360, 0.028, 16, false),
    [curve],
  );
  const halo = useMemo(
    () => new THREE.TubeGeometry(curve, 360, 0.09, 16, false),
    [curve],
  );

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.04;
    }
  });

  return (
    // Shift the whole worldline to the right so the title on the left reads cleanly.
    <group position={[2.3, 0, 0]} rotation={[0, 0, 0.12]}>
      <group ref={groupRef}>
        <mesh geometry={tube}>
          <meshBasicMaterial color="#e8a96b" />
        </mesh>
        <mesh geometry={halo}>
          <meshBasicMaterial
            color="#e8a96b"
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>
        {/* Endpoints: birth (bottom), a projected end (top) */}
        <mesh position={[0, -3.5, 0]}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshBasicMaterial color="#f4f1ea" />
        </mesh>
        <mesh position={[0, 3.5, 0]}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshBasicMaterial color="#f4f1ea" />
        </mesh>
      </group>
    </group>
  );
}

export function HeroScene() {
  return (
    <SceneFrame
      camera={{ position: [0, 0.4, 7.5], fov: 42 }}
      bg="radial-gradient(ellipse at 70% 50%, rgba(30,28,24,0.55), rgba(5,6,8,1) 70%)"
    >
      <Starfield count={900} radius={50} />
      <Worldline />
    </SceneFrame>
  );
}
