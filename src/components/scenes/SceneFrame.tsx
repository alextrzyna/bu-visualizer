"use client";

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { type ReactNode, Suspense } from "react";

/**
 * SceneFrame: shared Canvas wrapper with consistent lighting, camera,
 * and a subtle bloom+vignette pass. Each chapter drops its scene content
 * inside.
 */
export function SceneFrame({
  children,
  camera = { position: [3.2, 2.4, 4.2], fov: 40 },
  bg = "transparent",
  overlay,
  postprocessing = true,
}: {
  children: ReactNode;
  camera?: { position: [number, number, number]; fov?: number };
  bg?: string;
  overlay?: ReactNode;
  postprocessing?: boolean;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        background:
          bg === "transparent"
            ? "radial-gradient(ellipse at 50% 55%, rgba(24,28,38,0.6), rgba(5,6,8,1) 70%)"
            : bg,
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: camera.position, fov: camera.fov ?? 40 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[4, 6, 5]} intensity={0.6} />
          {children}
          {postprocessing && (
            <EffectComposer multisampling={4}>
              <Bloom
                intensity={0.6}
                luminanceThreshold={0.35}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <Vignette eskil={false} offset={0.2} darkness={0.7} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
      {overlay && (
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto">{overlay}</div>
        </div>
      )}
    </div>
  );
}
