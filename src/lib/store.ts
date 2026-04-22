"use client";

import { create } from "zustand";

/**
 * Quality tier drives the postprocessing/particle/DOF ladder in
 * SceneFrame. PerformanceMonitor pushes it down on sustained frame
 * drops; we never push it above the user-detected ceiling.
 *
 * 1.0 high  — full chain, MSAA=4, DPR up to 2, mipmap bloom, DOF on
 * 0.66 mid  — MSAA=2, DPR up to 1.75, no DOF, half-res N8AO
 * 0.33 low  — MSAA=0, DPR=1, bloom only, no AO, no DOF
 */
type BUStore = {
  activeChapter: number;
  setActiveChapter: (n: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (b: boolean) => void;
  qualityTier: number;
  setQualityTier: (t: number) => void;
  qualityCeiling: number;
  setQualityCeiling: (t: number) => void;
};

export const useBUStore = create<BUStore>((set) => ({
  activeChapter: 0,
  setActiveChapter: (n) => set({ activeChapter: n }),
  reducedMotion: false,
  setReducedMotion: (b) => set({ reducedMotion: b }),
  qualityTier: 1.0,
  setQualityTier: (t) => set({ qualityTier: t }),
  qualityCeiling: 1.0,
  setQualityCeiling: (t) => set({ qualityCeiling: t, qualityTier: t }),
}));
