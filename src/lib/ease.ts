/**
 * Frame-rate-independent exponential smoothing toward a target.
 * `rate` is roughly "how many e-foldings per second of convergence" —
 * higher = snappier. Safe to call every frame with the frame's dt.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

export function dampVec(
  out: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  rate: number,
  dt: number,
): void {
  const k = 1 - Math.exp(-rate * dt);
  out.x += (target.x - out.x) * k;
  out.y += (target.y - out.y) * k;
  out.z += (target.z - out.z) * k;
}

/** Classic Ken Perlin smoothstep: C¹-continuous ramp from 0 → 1 on [0,1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
