"use client";

import { create } from "zustand";

type BUStore = {
  activeChapter: number;
  setActiveChapter: (n: number) => void;
  reducedMotion: boolean;
  setReducedMotion: (b: boolean) => void;
};

export const useBUStore = create<BUStore>((set) => ({
  activeChapter: 0,
  setActiveChapter: (n) => set({ activeChapter: n }),
  reducedMotion: false,
  setReducedMotion: (b) => set({ reducedMotion: b }),
}));
