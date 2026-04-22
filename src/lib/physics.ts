/**
 * Minimal special-relativity helpers used by the visualizations.
 *
 * We work in natural units where c = 1. "Space" is one or two spatial
 * dimensions scaled so a 45° line is a light ray. Under a boost by velocity
 * v (|v| < 1), the Lorentz transformation is:
 *
 *   t' = γ (t − v·x)
 *   x' = γ (x − v·t)       with γ = 1 / sqrt(1 − v²)
 *
 * The plane (line, in 1+1D) of simultaneity for the boosted observer is
 * the locus {(t, x) : t' = 0} = {(t, x) : t = v·x}, i.e. a line through
 * the origin with slope v in (t, x) coordinates. This is the geometric
 * heart of the relativity-of-simultaneity scene.
 */

export const C = 1;

export function gamma(v: number): number {
  const v2 = v * v;
  if (v2 >= 1) return Infinity;
  return 1 / Math.sqrt(1 - v2);
}

export function lorentzBoost1D(
  t: number,
  x: number,
  v: number,
): { t: number; x: number } {
  const g = gamma(v);
  return {
    t: g * (t - v * x),
    x: g * (x - v * t),
  };
}

/** Slope of the tilted plane of simultaneity (t as a function of x) for a boost v. */
export function simultaneitySlope(v: number): number {
  return v;
}

/** Slope of the tilted worldline (t as a function of x) for an observer with velocity v. */
export function worldlineSlope(v: number): number {
  // worldline is the t'-axis of the boosted frame, i.e. x = v t → t = x / v
  // but as a function x(t) = v t, slope on a (horizontal=x, vertical=t) diagram is 1/v.
  // We'll keep this as the "dx/dt" scalar.
  return v;
}

/** Time-dilation factor: proper time elapses at 1/γ relative to coordinate time. */
export function properTime(coordTime: number, v: number): number {
  return coordTime / gamma(v);
}
