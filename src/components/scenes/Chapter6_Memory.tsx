"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield } from "./common";

/**
 * Chapter 6: memory, consciousness, and the moving spotlight.
 * A gently curving worldline is fully present as a shape in the block,
 * while a traveling highlight (our subjective "now") moves along it,
 * leaving a fading trail behind (memory) and dimness ahead (the unknown).
 */

function Worldline() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = Math.sin(t * Math.PI * 2.2) * 0.8;
      const y = (t - 0.5) * 6;
      const z = Math.cos(t * Math.PI * 1.6) * 0.6;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const tubeGeom = useMemo(
    () => new THREE.TubeGeometry(curve, 400, 0.02, 12, false),
    [curve],
  );

  // A second, brighter segment ("present + short memory") that slides along the curve.
  const headRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    // Replace the raw sinusoid with an easeInOutCubic-shaped ping-pong:
    // slower at the endpoints, never jerks at the turnaround.
    const raw = (Math.sin(clock.elapsedTime * 0.14) + 1) / 2;
    const eased =
      raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    const p = curve.getPointAt(eased);
    if (headRef.current) headRef.current.position.copy(p);
    if (haloRef.current) haloRef.current.position.copy(p);
  });

  return (
    <group>
      {/* Whole worldline, rendered dim — "the block view" */}
      <mesh geometry={tubeGeom}>
        <meshBasicMaterial color="#e8a96b" transparent opacity={0.25} />
      </mesh>
      {/* Brighter glow head — "the spotlight of now" */}
      <mesh ref={headRef}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <pointLight
        ref={haloRef}
        color="#e8a96b"
        intensity={2.6}
        distance={2.6}
        decay={2}
      />
    </group>
  );
}

export function Chapter6Scene() {
  // Centered camera so the worldline sits in the middle of the frame
  // rather than hugging the right edge.
  return (
    <SceneFrame camera={{ position: [0, 0.2, 6.2], fov: 40 }}>
      <Starfield count={350} radius={50} />
      <Worldline />
    </SceneFrame>
  );
}
