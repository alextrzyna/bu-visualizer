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

/**
 * Named eases for cross-scene coherence. Every camera transition and
 * scroll-driven animation in the piece should pick from this set so
 * the rhythm reads as a single authorial voice rather than ad-hoc.
 *
 * - `breath`   — gentle, symmetrical, sinusoidal. Idle motion.
 * - `settle`   — slight overshoot then ease. For "arriving at" moments
 *                that want a tiny kick of life.
 * - `arrive`   — ease-out quartic. Fast departure, long gentle approach.
 *                The default for camera fly-ins to a station.
 */
export function breathEase(t: number): number {
  // Symmetric cosine ramp — starts slow, accelerates through middle,
  // decelerates slow. Identical to easeInOutSine.
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

export function settleEase(t: number): number {
  // Slight overshoot (damped spring-like). Overshoots by ~5% at t≈0.72
  // then settles back to 1.
  const c = 1.7;
  const c1 = c + 1;
  return 1 + c1 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export function arriveEase(t: number): number {
  // Ease-out quartic — fast start, slow approach. Camera fly-ins feel
  // intentional and never abrupt on arrival.
  const u = 1 - t;
  return 1 - u * u * u * u;
}
