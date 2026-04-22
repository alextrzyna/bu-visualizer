"use client";

import { useEffect, useRef } from "react";

/**
 * Tracks mouse position normalized to [-1, 1] in viewport coords and
 * exposes a mutable ref that the render loop can read without causing
 * React re-renders. Touch drags write the same signal. Idle returns to
 * (0, 0) via the consumer's damp rate (we don't decay here — let the
 * scene decide how sluggish the parallax feels).
 */
export function useMousePointer(): React.RefObject<{ x: number; y: number }> {
  const ref = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ref.current.x = (e.clientX / w) * 2 - 1;
      ref.current.y = -((e.clientY / h) * 2 - 1);
    };
    const onTouch = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ref.current.x = (e.touches[0].clientX / w) * 2 - 1;
      ref.current.y = -((e.touches[0].clientY / h) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);
  return ref;
}
