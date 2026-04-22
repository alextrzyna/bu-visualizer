"use client";

import { Canvas } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  N8AO,
  DepthOfField,
  SMAA,
  LUT,
  Vignette,
  Noise,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import { Environment } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildGradedLUT } from "@/lib/grading";
import { useBUStore } from "@/lib/store";
import { useMousePointer } from "@/lib/parallax";
import { detectInitialQualityCeiling } from "./common";

const HDRI_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/hdri/studio_small_09_1k.hdr`;

/**
 * Mobile camera pull-back multiplier. Applied to the camera's initial
 * position (and inside scene-level CameraSetup helpers) so that wide
 * scene content fits a ~0.8 aspect viewport. 1.5 was chosen
 * empirically to fit the widest scene (Ch2 spacetime grid) without
 * shrinking the tallest (Ch3 light cone) too aggressively. Exported
 * so scene modules with their own CameraSetup can apply it consistently.
 */
export const MOBILE_CAM_SCALE = 1.5;
export function mobileCamPos(
  pos: [number, number, number],
  isMobile: boolean,
): [number, number, number] {
  if (!isMobile) return pos;
  return [
    pos[0] * MOBILE_CAM_SCALE,
    pos[1] * MOBILE_CAM_SCALE,
    pos[2] * MOBILE_CAM_SCALE,
  ];
}

let cachedLUT: ReturnType<typeof buildGradedLUT> | null = null;
function getLUT() {
  if (!cachedLUT) cachedLUT = buildGradedLUT(33);
  return cachedLUT;
}

/**
 * SceneFrame: shared Canvas wrapper with the production postprocessing
 * stack. Each chapter drops its scene content inside.
 *
 * Pipeline order (linear → display → grade → spatial AA → dither):
 *   N8AO* → Bloom → DepthOfField* → ToneMapping(AgX) → LUT → Vignette → SMAA → Noise
 *   (* = opt-in via `ao`/`dof` props; off-by-default to keep the
 *   chain cheap on chapters that don't benefit.)
 *
 * Two perf mechanisms:
 *   1) IntersectionObserver pauses the Canvas (`frameloop="never"`)
 *      when the frame is far from the viewport — critical because the
 *      walkthrough mounts ~8 Canvases on one page.
 *   2) Pipeline shape is fixed at mount; ceiling-tier flags govern
 *      DPR / MSAA / halfRes / DOF height once and never reconfigure.
 */
/**
 * Optional wrapper applied to scene children when `parallax` is on.
 * Tracks the mouse, damps toward the normalized pointer each frame,
 * and offsets the group's position by a small amplitude. Reads the
 * reduced-motion flag to short-circuit. Never throws.
 */
function ParallaxGroup({
  strength = 0.09,
  children,
}: {
  strength?: number;
  children: ReactNode;
}) {
  const mouse = useMousePointer();
  const reducedMotion = useBUStore((s) => s.reducedMotion);
  const ref = useRef<THREE.Group>(null);
  const cur = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    if (!ref.current) return;
    const targetX = reducedMotion ? 0 : mouse.current.x * strength;
    const targetY = reducedMotion ? 0 : mouse.current.y * strength * 0.6;
    const k = 1 - Math.exp(-3 * dt);
    cur.current.x += (targetX - cur.current.x) * k;
    cur.current.y += (targetY - cur.current.y) * k;
    ref.current.position.x = cur.current.x;
    ref.current.position.y = cur.current.y;
  });
  return <group ref={ref}>{children}</group>;
}

export function SceneFrame({
  children,
  camera = { position: [3.2, 2.4, 4.2], fov: 40 },
  bg = "transparent",
  overlay,
  postprocessing = true,
  bloom,
  ao,
  dof,
  dprCap,
  parallax = false,
}: {
  children: ReactNode;
  camera?: { position: [number, number, number]; fov?: number };
  bg?: string;
  overlay?: ReactNode;
  postprocessing?: boolean;
  bloom?: { intensity?: number; threshold?: number; smoothing?: number };
  ao?: { radius?: number; intensity?: number };
  dof?: { focusDistance?: number; focalLength?: number; bokehScale?: number };
  /** Per-scene cap on devicePixelRatio. Default 1.5 to keep fragment
   * cost reasonable on retina; bump to 2 for hero/capstone. */
  dprCap?: number;
  /** Enable subtle mouse-driven parallax on scene content. Small
   * amplitude (~0.08 world units) with critical damping. Disabled
   * automatically on `prefers-reduced-motion`. Opt in per-scene; not
   * compatible with scenes that run their own camera rig. */
  parallax?: boolean | { strength?: number };
}) {
  const lut = useMemo(() => getLUT(), []);
  const ceiling = useBUStore((s) => s.qualityCeiling);
  const setCeiling = useBUStore((s) => s.setQualityCeiling);
  const setReducedMotion = useBUStore((s) => s.setReducedMotion);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  // Mobile detection fixed at mount (after hydration) — matches the
  // "pipeline shape never reconfigures" invariant. Initial value is
  // false on both server and client so hydration matches; a one-shot
  // effect below captures the real value and the DPR/AO/DOF gates read
  // it thereafter. Resize/rotation is deliberately ignored to avoid a
  // Canvas rebuild mid-session.
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 768px)").matches);
  }, []);

  useEffect(() => {
    setCeiling(detectInitialQualityCeiling());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setCeiling, setReducedMotion]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        setInView(visible);
      },
      // Pre-warm 30% of a viewport before/after — enough to start the
      // scene before it scrolls in, tight enough that two heavy
      // shader scenes don't share GPU at the same time.
      { rootMargin: "30% 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Mobile overrides: cap DPR at 1.0 and skip the two priciest passes
  // (N8AO needs a normal-pass; DOF is a second full-screen blur). Bloom,
  // tonemap, LUT, vignette, SMAA, noise all stay — those are what give
  // the image its atmosphere and they're cheap enough on phones.
  const dprDefault = isMobile
    ? 1
    : (dprCap ?? (ceiling >= 0.7 ? 1.5 : 1.25));
  const msaa = isMobile ? 0 : ceiling >= 0.7 ? 4 : ceiling >= 0.4 ? 2 : 0;
  const aoSamples = ceiling >= 0.7 ? 12 : 6;
  const aoHalfRes = ceiling < 0.7;
  const dofHeight = ceiling >= 0.85 ? 480 : 360;
  const useAO = !isMobile && !!ao;
  const useDOF = !isMobile && !!dof;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        background:
          bg === "transparent"
            ? "radial-gradient(ellipse at 50% 55%, rgba(24,28,38,0.6), rgba(5,6,8,1) 70%)"
            : bg,
      }}
    >
      <Canvas
        dpr={[1, dprDefault]}
        frameloop={inView ? "always" : "never"}
        gl={{
          antialias: false,
          alpha: true,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          // Mobile pull-back: scenes are composed for a widescreen
          // canvas, so on a ~0.8 aspect viewport horizontal content
          // falls off both edges. Pushing the camera further from the
          // origin along its current ray preserves framing direction
          // while enlarging the visible horizontal frustum — a uniform
          // remedy that doesn't require per-scene tuning. Scenes with
          // their own CameraSetup effect apply the same factor there.
          position: isMobile
            ? [
                camera.position[0] * MOBILE_CAM_SCALE,
                camera.position[1] * MOBILE_CAM_SCALE,
                camera.position[2] * MOBILE_CAM_SCALE,
              ]
            : camera.position,
          fov: camera.fov ?? 40,
        }}
      >
        <Suspense fallback={null}>
          <Environment
            files={HDRI_PATH}
            environmentIntensity={0.28}
            background={false}
          />
          <ambientLight intensity={0.18} />
          <directionalLight position={[4, 6, 5]} intensity={0.45} />
          {parallax && !isMobile ? (
            <ParallaxGroup
              strength={typeof parallax === "object" ? parallax.strength : undefined}
            >
              {children}
            </ParallaxGroup>
          ) : (
            children
          )}
          {postprocessing && (
            <EffectComposer multisampling={msaa} enableNormalPass={useAO}>
              {useAO ? (
                <N8AO
                  aoRadius={ao?.radius ?? 0.6}
                  intensity={ao?.intensity ?? 1.4}
                  distanceFalloff={1.0}
                  quality={ceiling >= 0.7 ? "medium" : "low"}
                  halfRes={aoHalfRes}
                  aoSamples={aoSamples}
                  depthAwareUpsampling
                />
              ) : (
                <></>
              )}
              <Bloom
                intensity={bloom?.intensity ?? 0.85}
                luminanceThreshold={bloom?.threshold ?? 0.9}
                luminanceSmoothing={bloom?.smoothing ?? 0.2}
                mipmapBlur
              />
              {useDOF ? (
                <DepthOfField
                  focusDistance={dof?.focusDistance ?? 0.02}
                  focalLength={dof?.focalLength ?? 0.05}
                  bokehScale={dof?.bokehScale ?? 2}
                  height={dofHeight}
                />
              ) : (
                <></>
              )}
              <ToneMapping mode={ToneMappingMode.AGX} />
              <LUT lut={lut} tetrahedralInterpolation />
              <Vignette eskil={false} offset={0.25} darkness={0.85} />
              <SMAA />
              <Noise opacity={0.025} blendFunction={BlendFunction.SOFT_LIGHT} />
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
