"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Measures a chapter's prose card and returns the world-space center
 * and half-width of the uncovered zone (the canvas region not occluded
 * by the card). Use this to translate scene content into the uncovered
 * area on chapters with a `cardSide` overlay.
 *
 * Assumes the camera is at (0, 0, camZ) looking at origin and that the
 * card sits on the left (matching FullBleedChapter's default). For a
 * right-anchored card, negate `offsetX`.
 */
export function useUncoveredZone(
  chapterIndex: number,
  fov: number,
  camZ: number,
): { offsetX: number; uncoveredHalfW: number; halfVisibleW: number } {
  const size = useThree((s) => s.size);
  const [zone, setZone] = useState({
    offsetX: 0,
    uncoveredHalfW: 1,
    halfVisibleW: 1,
  });

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
      const fovRad = (fov * Math.PI) / 180;
      const halfVisibleH = camZ * Math.tan(fovRad / 2);
      const halfVisibleW =
        halfVisibleH * (canvasRect.width / canvasRect.height);
      const cardRightNdc =
        ((cardRect.right - canvasRect.left) / canvasRect.width) * 2 - 1;
      const cardRightWorldX = cardRightNdc * halfVisibleW;
      const offsetX = (cardRightWorldX + halfVisibleW) / 2;
      const uncoveredHalfW = (halfVisibleW - cardRightWorldX) / 2;
      setZone({ offsetX, uncoveredHalfW, halfVisibleW });
    };
    measure();
    const id = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [chapterIndex, fov, camZ, size.width, size.height]);

  return zone;
}
