/**
 * Procedural 3D LUT for cinematic color grading. Generated once at
 * startup and fed to <LUT> in the postprocessing chain.
 *
 * The grade is performed in OKLCH (perceptually uniform polar
 * coordinates over OKLab): we lift shadows toward navy, push warm
 * highlights toward amber, and keep midtones close to neutral. This is
 * the "teal-and-orange" idiom, applied with restraint to match the
 * site's contemplative palette.
 */

import { LookupTexture } from "postprocessing";

const M1 = [
  0.4122214708, 0.5363325363, 0.0514459929,
  0.2119034982, 0.6806995451, 0.1073969566,
  0.0883024619, 0.2817188376, 0.6299787005,
];
const M2 = [
  0.2104542553, 0.793617785, -0.0040720468,
  1.9779984951, -2.428592205, 0.4505937099,
  0.0259040371, 0.7827717662, -0.808675766,
];
const M2_INV = [
  1.0, 0.3963377774, 0.2158037573,
  1.0, -0.1055613458, -0.0638541728,
  1.0, -0.0894841775, -1.291485548,
];
const M1_INV = [
  4.0767416621, -3.3077115913, 0.2309699292,
  -1.2684380046, 2.6097574011, -0.3413193965,
  -0.0041960863, -0.7034186147, 1.707614701,
];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function linRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = M1[0] * r + M1[1] * g + M1[2] * b;
  const m = M1[3] * r + M1[4] * g + M1[5] * b;
  const s = M1[6] * r + M1[7] * g + M1[8] * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    M2[0] * l_ + M2[1] * m_ + M2[2] * s_,
    M2[3] * l_ + M2[4] * m_ + M2[5] * s_,
    M2[6] * l_ + M2[7] * m_ + M2[8] * s_,
  ];
}
function oklabToLinRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = M2_INV[0] * L + M2_INV[1] * a + M2_INV[2] * b;
  const m_ = M2_INV[3] * L + M2_INV[4] * a + M2_INV[5] * b;
  const s_ = M2_INV[6] * L + M2_INV[7] * a + M2_INV[8] * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    M1_INV[0] * l + M1_INV[1] * m + M1_INV[2] * s,
    M1_INV[3] * l + M1_INV[4] * m + M1_INV[5] * s,
    M1_INV[6] * l + M1_INV[7] * m + M1_INV[8] * s,
  ];
}

const TAU = Math.PI * 2;
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function angularBand(h: number, center: number, halfWidth: number): number {
  let d = Math.abs(((h - center + Math.PI) % TAU + TAU) % TAU - Math.PI);
  return 1 - smoothstep(halfWidth, halfWidth * 1.6, d);
}

const WARM_CENTER = (60 * Math.PI) / 180;
const COOL_CENTER = (250 * Math.PI) / 180;
const BAND_HALF = (60 * Math.PI) / 180;

function grade(srIn: number, sgIn: number, sbIn: number): [number, number, number] {
  const lr = srgbToLinear(srIn);
  const lg = srgbToLinear(sgIn);
  const lb = srgbToLinear(sbIn);

  const [L, a, b] = linRgbToOklab(lr, lg, lb);

  const C = Math.sqrt(a * a + b * b);
  const h = Math.atan2(b, a);

  const shadow = 1 - smoothstep(0.0, 0.45, L);
  const highlight = smoothstep(0.55, 0.95, L);
  const warmW = angularBand(h, WARM_CENTER, BAND_HALF);
  const coolW = angularBand(h, COOL_CENTER, BAND_HALF);

  const Lg = L + shadow * 0.012 - highlight * 0.01;
  const Cg = Math.max(
    0,
    C * (1 + 0.06 * highlight * warmW + 0.05 * shadow * coolW - 0.04 * (1 - shadow - highlight)),
  );
  const hg = h + 0.04 * shadow * coolW - 0.03 * highlight * warmW;

  const ag = Cg * Math.cos(hg);
  const bg = Cg * Math.sin(hg);

  const [lr2, lg2, lb2] = oklabToLinRgb(Lg, ag, bg);
  return [linearToSrgb(lr2), linearToSrgb(lg2), linearToSrgb(lb2)];
}

export function buildGradedLUT(size = 33): LookupTexture {
  const lut = LookupTexture.createNeutral(size);
  const data = lut.image.data as Float32Array;
  const N = size;
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = (z * N * N + y * N + x) * 4;
        const out = grade(data[i], data[i + 1], data[i + 2]);
        data[i] = out[0];
        data[i + 1] = out[1];
        data[i + 2] = out[2];
      }
    }
  }
  lut.needsUpdate = true;
  return lut;
}
