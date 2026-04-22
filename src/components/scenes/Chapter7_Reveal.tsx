"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SceneFrame } from "./SceneFrame";
import { Starfield, BlockFrame } from "./common";
import { mulberry32 } from "@/lib/prng";

/** Apply camera position and lookAt imperatively so changes actually
 * take effect (Canvas's `camera` prop only sets initial values). */
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

/**
 * Chapter 7: the block revealed.
 * A lattice of glowing worldlines (many lives) threaded through a large
 * wireframe "block". Slowly rotating. This is the synthesis image:
 * every moment of every life, equally real, arrayed in 4D.
 */

// Block radius in x/z, used so the scene offset and camera framing
// line up with the actual geometry.
const BLOCK_RX = 0.9;
const BLOCK_Y = 3.0;

function WorldlineBundle() {
  const curves = useMemo(() => {
    const rnd = mulberry32(2024);
    const out: THREE.TubeGeometry[] = [];
    const N_LINES = 36;
    for (let i = 0; i < N_LINES; i++) {
      const pts: THREE.Vector3[] = [];
      const ox = (rnd() - 0.5) * 2 * BLOCK_RX * 0.8;
      const oz = (rnd() - 0.5) * 2 * BLOCK_RX * 0.8;
      const amp = 0.1 + rnd() * 0.22;
      const freq = 0.8 + rnd() * 2;
      const phase = rnd() * Math.PI * 2;
      const K = 120;
      for (let k = 0; k <= K; k++) {
        const t = k / K;
        const y = (t - 0.5) * BLOCK_Y;
        const x = ox + Math.sin(t * Math.PI * freq + phase) * amp;
        const z = oz + Math.cos(t * Math.PI * (freq * 0.8) + phase) * amp;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      out.push(new THREE.TubeGeometry(curve, 160, 0.01, 8, false));
    }
    return out;
  }, []);

  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.05;
  });

  return (
    <group ref={group}>
      <BlockFrame size={[2 * BLOCK_RX, BLOCK_Y, 2 * BLOCK_RX]} />
      {curves.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={i % 7 === 0 ? "#e8a96b" : "#c9c4b8"}
            transparent
            opacity={i % 7 === 0 ? 0.85 : 0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * With a straight-ahead camera (at x=cx, z=cz, target at x=cx, z=0),
 * pixel-to-world conversion at z=0 is exact:
 *
 *   visibleHalfW = cz · tan(fov/2) · aspect
 *   worldX(pixel) = cx + (pixel/canvasW * 2 - 1) · visibleHalfW
 *
 * We read the card's right edge and the canvas bounds from the DOM,
 * compute the world-x of the card's right edge, and then position the
 * block so its LEFT edge sits `gap` world units to the right of that
 * point.
 */
const CAM_Z = 7;
const CAM_Y = 1.2;
const FOV = 32;

function useBlockOffset(chapterIndex: number): number {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const [offset, setOffset] = useState(3);
  useEffect(() => {
    const measure = () => {
      const section = document.querySelector(
        `[data-chapter="${chapterIndex}"]`,
      ) as HTMLElement | null;
      const cardEl = section?.querySelector(
        '[class*="max-w-"]',
      ) as HTMLElement | null;
      const canvasEl = section?.querySelector("canvas") as HTMLElement | null;
      const cardRect = cardEl?.getBoundingClientRect();
      const canvasRect = canvasEl?.getBoundingClientRect();
      if (!cardRect || !canvasRect) return;
      const cardRightNdc =
        ((cardRect.right - canvasRect.left) / canvasRect.width) * 2 - 1;
      const fovRad = (FOV * Math.PI) / 180;
      const halfVisibleH = CAM_Z * Math.tan(fovRad / 2);
      const halfVisibleW = halfVisibleH * (canvasRect.width / canvasRect.height);
      // With camera centered at world x=0 on this focal plane:
      const cardRightWorldX = cardRightNdc * halfVisibleW;
      // Center the block in the *middle* of the uncovered zone between
      // the card's right edge and the canvas's right edge. This keeps
      // equal whitespace on both sides of the block at every aspect,
      // and avoids pushing it off the right edge.
      const uncoveredMidX = (cardRightWorldX + halfVisibleW) / 2;
      setOffset(uncoveredMidX);
    };
    measure();
    const id = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [camera, size.width, size.height, chapterIndex]);
  return offset;
}

function Chapter7SceneInner() {
  const offsetX = useBlockOffset(7);
  return (
    <>
      {/* Camera sits at world x=0 (not at offset) so pixel-to-world
          math is simple; the block is shifted into the uncovered right
          half by its own group transform. */}
      <CameraSetup position={[0, CAM_Y, CAM_Z]} target={[0, 0, 0]} />
      <Starfield count={600} radius={55} />
      <group position={[offsetX, 0, 0]}>
        <WorldlineBundle />
      </group>
    </>
  );
}

export function Chapter7Scene() {
  return (
    <SceneFrame camera={{ position: [0, CAM_Y, CAM_Z], fov: FOV }}>
      <Chapter7SceneInner />
    </SceneFrame>
  );
}
