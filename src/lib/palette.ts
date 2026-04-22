/**
 * Source of truth for colors used inside Three.js scenes. CSS holds the
 * same colors in OKLCH (in globals.css) for perceptual ramping; the hex
 * values here are what materials/uniforms consume because three.js's
 * Color.setStyle doesn't parse oklch() yet (as of r184).
 */
export const palette = {
  void0: "#050608",
  void1: "#0a0c11",
  void2: "#11141b",
  ink0: "#f4f1ea",
  ink1: "#c9c4b8",
  ink2: "#6b675e",
  ember: "#e8a96b",
  emberFaint: "#8a5c34",
  cool: "#7aa7c7",
  grid: "#1b2028",
  rule: "#1a1d24",
} as const;

export type PaletteKey = keyof typeof palette;
