"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { buildWorldline } from "@/lib/worldline";

type Meta = ReturnType<typeof buildWorldline>;

/**
 * Soft radial-gradient texture used for each heat-map blob. Canvas-2D
 * radial gradient → THREE.CanvasTexture — warm ember core fading to
 * transparent — rendered with additive blending so overlapping blobs
 * accumulate intensity.
 */
function makeBlobTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255, 217, 163, 1.0)");
  g.addColorStop(0.3, "rgba(232, 169, 107, 0.55)");
  g.addColorStop(0.7, "rgba(138, 92, 52, 0.18)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Cosine-eased fade for micro-location activity near its window edges. */
function activeIntensity(
  atTime: number,
  tStart: number,
  tEnd: number,
  baseIntensity: number,
  edgeDays = 365,
): number {
  const edge = edgeDays * 24 * 3600 * 1000;
  if (atTime < tStart - edge || atTime > tEnd + edge) return 0;
  let fade = 1;
  if (atTime < tStart) fade = (atTime - (tStart - edge)) / edge;
  else if (atTime > tEnd) fade = 1 - (atTime - tEnd) / edge;
  fade = Math.max(0, Math.min(1, fade));
  // ease in/out
  fade = 0.5 - 0.5 * Math.cos(fade * Math.PI);
  return baseIntensity * fade;
}

export function HeatBlobs({
  microLocations,
  atTime,
  y,
  zoomScale,
}: {
  microLocations: Meta["microLocations"];
  /** Current subjective time in ms. */
  atTime: number;
  /** The y-height at which to render the heat plane. */
  y: number;
  /** Current zoom scale — used to shrink blob screen-size slightly as we
   * zoom in so a daily-frequented spot stays perceptually bounded. */
  zoomScale: number;
}) {
  const texture = useMemo(() => makeBlobTexture(), []);

  const active = microLocations
    .map((m) => ({
      m,
      weight: activeIntensity(atTime, m.tStart, m.tEnd, m.intensity),
    }))
    .filter((x) => x.weight > 0.01);

  return (
    <group position={[0, y, 0]}>
      {active.map(({ m, weight }) => {
        // Blob radius in world units. Scaled inversely with zoom so
        // dense downtown clusters don't swallow the frame when zoomed
        // into a city.
        // Base radius is chosen so at zoom=1 a daily-intensity blob is
        // ~0.8 world units wide; at higher zoom we divide directly so
        // the pixel footprint of a blob stays roughly bounded.
        const baseRadius = 0.35 + weight * 0.45;
        const radius = baseRadius / zoomScale;
        const opacity = Math.min(0.95, 0.35 + weight * 0.9);
        return (
          <mesh
            key={m.name}
            position={[m.position.x, 0, m.position.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={2}
          >
            <planeGeometry args={[radius * 2, radius * 2]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
