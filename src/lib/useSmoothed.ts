"use client";

import { useEffect, useRef, useState } from "react";
import { damp } from "./ease";

/**
 * React hook that returns a smoothed-over-time version of a target value.
 * Use in scenes where a controlled prop (e.g. a slider) changes discretely
 * but we want the visual response to ease in/out rather than snap.
 *
 * `rate` is an exponential-smoothing coefficient. ~6 feels responsive,
 * ~3 feels contemplative.
 */
export function useSmoothed(target: number, rate = 6): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = damp(valueRef.current, target, rate, dt);
      valueRef.current = next;
      setValue(next);
      if (Math.abs(target - next) > 1e-4) {
        raf = requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
        setValue(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, rate]);

  return value;
}
