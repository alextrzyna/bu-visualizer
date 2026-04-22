"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { mulberry32 } from "@/lib/prng";

/**
 * Chapter 5: the thermodynamic arrow of time.
 * A box of N particles that begin in a tight cluster in one corner and
 * diffuse outward under random-walk dynamics. The fundamental laws are
 * time-reversible, but the *statistical* evolution away from a low-entropy
 * initial condition gives the arrow its apparent direction.
 */

const N = 260;
const BOX = 1.7;
const CYCLE = 16; // seconds of spreading, then a ~1.5s soft contraction back to the corner

function initialState() {
  const rnd = mulberry32(91);
  const positions = new Float32Array(N * 3);
  const velocities = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // Tight ember cluster in one corner of the box
    positions[i * 3] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
    positions[i * 3 + 1] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
    positions[i * 3 + 2] = -BOX * 0.82 + (rnd() - 0.5) * 0.22;
    const dir = new THREE.Vector3(
      rnd() - 0.5,
      rnd() - 0.5,
      rnd() - 0.5,
    ).normalize();
    const speed = 0.22 + rnd() * 0.18;
    velocities[i * 3] = dir.x * speed;
    velocities[i * 3 + 1] = dir.y * speed;
    velocities[i * 3 + 2] = dir.z * speed;
  }
  return { positions, velocities };
}

// Pre-computed, module-scoped buffers keep the render body pure. React's
// hook rules forbid reading from refs or mutating values produced by hooks
// during render; computing once here sidesteps that entirely.
const { positions: INITIAL_POSITIONS, velocities: VELOCITIES } = initialState();

function GasBox() {
  const points = useRef<THREE.Points>(null);
  const resetAccum = useRef(0);
  const resetRnd = useRef(mulberry32(7311));

  useFrame((_, dt) => {
    if (!points.current) return;
    const pos = points.current.geometry.attributes.position
      .array as Float32Array;
    const velocities = VELOCITIES;
    resetAccum.current += dt;
    if (resetAccum.current > CYCLE) {
      // Soft reset: ease each particle toward the low-entropy corner
      // rather than teleporting. Lasts ~1.5s thanks to the exponential
      // damp on each component.
      const r = resetRnd.current;
      const k = 1 - Math.exp(-4 * dt);
      for (let i = 0; i < N; i++) {
        const tx = -BOX * 0.82 + (r() - 0.5) * 0.22;
        const ty = -BOX * 0.82 + (r() - 0.5) * 0.22;
        const tz = -BOX * 0.82 + (r() - 0.5) * 0.22;
        pos[i * 3] += (tx - pos[i * 3]) * k;
        pos[i * 3 + 1] += (ty - pos[i * 3 + 1]) * k;
        pos[i * 3 + 2] += (tz - pos[i * 3 + 2]) * k;
      }
      // Exit the reset phase once we're mostly converged — measured by
      // the first particle's distance to corner as a cheap proxy.
      const dx = pos[0] - -BOX * 0.82;
      if (Math.abs(dx) < 0.05) resetAccum.current = 0;
    } else {
      for (let i = 0; i < N; i++) {
        pos[i * 3] += velocities[i * 3] * dt;
        pos[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        for (let k = 0; k < 3; k++) {
          const idx = i * 3 + k;
          if (pos[idx] > BOX) {
            pos[idx] = BOX;
            velocities[idx] = -velocities[idx];
          } else if (pos[idx] < -BOX) {
            pos[idx] = -BOX;
            velocities[idx] = -velocities[idx];
          }
        }
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[INITIAL_POSITIONS, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.055}
        sizeAttenuation
        color="#e8a96b"
        transparent
        opacity={0.95}
      />
    </points>
  );
}

function BoxWire() {
  const geom = useMemo(() => {
    return new THREE.EdgesGeometry(
      new THREE.BoxGeometry(2 * BOX, 2 * BOX, 2 * BOX),
    );
  }, []);
  return (
    <group>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#4a5262" />
      </lineSegments>
      {/* a very soft translucent cube behind the wires so the "container"
          reads as volume rather than just a skeleton */}
      <mesh>
        <boxGeometry args={[2 * BOX, 2 * BOX, 2 * BOX]} />
        <meshBasicMaterial
          color="#0e1119"
          transparent
          opacity={0.28}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * A permanent "ghost" of the starting cluster in the low-entropy corner —
 * a dim, static cloud of points. This makes the narrative
 * ("started concentrated, ended spread out") readable from any single
 * frame, not only when the animation happens to reset.
 */
const GHOST_POSITIONS = (() => {
  const rnd = mulberry32(203);
  const M = 55;
  const p = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    p[i * 3] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
    p[i * 3 + 1] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
    p[i * 3 + 2] = -BOX * 0.82 + (rnd() - 0.5) * 0.24;
  }
  return p;
})();

function StartingGhost() {
  return (
    <group>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[GHOST_POSITIONS, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.07}
          sizeAttenuation
          color="#a06c3c"
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </points>
      {/* soft halo marking "the past" — slightly stronger so the corner
          reads as an origin anchor even at small scales */}
      <mesh position={[-BOX * 0.82, -BOX * 0.82, -BOX * 0.82]}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial
          color="#e8a96b"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={[-BOX * 0.82, -BOX * 0.82, -BOX * 0.82]}
        color="#ffd9a3"
        intensity={0.9}
        distance={1.6}
      />
    </group>
  );
}

export function Chapter5Scene() {
  // Camera pulled in and slightly lifted so the box fills the frame and
  // the low-entropy corner is prominent in the lower-left of the view.
  return (
    <SceneFrame camera={{ position: [2.6, 1.8, 2.9], fov: 44 }}>
      <BoxWire />
      <StartingGhost />
      <GasBox />
    </SceneFrame>
  );
}
