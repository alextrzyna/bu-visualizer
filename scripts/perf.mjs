#!/usr/bin/env node
/**
 * Per-scene FPS sampler. Boots a headless browser, scrolls each named
 * chapter into view, samples FPS for `SAMPLE_MS` ms, then prints a
 * summary table with median FPS and p1/p5 frame-time percentiles. Use
 * for before/after comparisons across scene upgrades.
 *
 *   BU_PORT=3192 node scripts/perf.mjs
 *   BU_PORT=3192 BU_LABEL=before node scripts/perf.mjs > /tmp/perf-before.txt
 *
 * Output rows are stable across runs (same chapters, same warmup).
 */
import puppeteer from "puppeteer";

const port = process.env.BU_PORT ?? "3192";
const label = process.env.BU_LABEL ?? "run";
const WARMUP_MS = 6000;
const SAMPLE_MS = 5000;
const WIDTH = 1600;
const HEIGHT = 1000;

const SCENES = [
  { name: "hero", path: "/", focus: null },
  { name: "ch1", path: "/", focus: 1 },
  { name: "ch2", path: "/", focus: 2 },
  { name: "ch3", path: "/", focus: 3 },
  { name: "ch4", path: "/", focus: 4 },
  { name: "ch5", path: "/", focus: 5 },
  { name: "ch6", path: "/", focus: 6 },
  { name: "ch7", path: "/", focus: 7 },
  { name: "your-life", path: "/your-life", focus: null },
  { name: "afterword", path: "/afterword", focus: null },
];

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu-vsync"],
});

async function sample(page) {
  return await page.evaluate(
    ({ ms }) =>
      new Promise((resolve) => {
        const ts = [];
        let raf = 0;
        const start = performance.now();
        const tick = (t) => {
          ts.push(t);
          if (t - start < ms) raf = requestAnimationFrame(tick);
          else {
            cancelAnimationFrame(raf);
            const dts = [];
            for (let i = 1; i < ts.length; i++) dts.push(ts[i] - ts[i - 1]);
            dts.sort((a, b) => a - b);
            const pct = (p) => dts[Math.min(dts.length - 1, Math.floor(p * dts.length))];
            const median = pct(0.5);
            const p1 = pct(0.99);
            const p5 = pct(0.95);
            const fps = 1000 / median;
            const frames = dts.length;
            const longFrames = dts.filter((d) => d > 33).length;
            resolve({ frames, fps, median, p5, p1, longFrames });
          }
        };
        raf = requestAnimationFrame(tick);
      }),
    { ms: SAMPLE_MS },
  );
}

const rows = [];
for (const sc of SCENES) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  const url = `http://localhost:${port}${sc.path}`;
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    if (sc.focus !== null) {
      await page.evaluate(
        (idx) =>
          document
            .querySelector(`[data-chapter="${idx}"]`)
            ?.scrollIntoView({ block: "start" }),
        sc.focus,
      );
    }
    await new Promise((r) => setTimeout(r, WARMUP_MS));
    const m = await sample(page);
    rows.push({ scene: sc.name, ...m });
    console.error(
      `[${label}] ${sc.name.padEnd(11)} fps=${m.fps.toFixed(1).padStart(5)} ` +
        `p95=${m.p5.toFixed(1)}ms p99=${m.p1.toFixed(1)}ms ` +
        `longframes=${m.longFrames}/${m.frames}`,
    );
  } catch (e) {
    console.error(`[${label}] ${sc.name} ERROR ${e.message}`);
    rows.push({ scene: sc.name, error: e.message });
  } finally {
    await page.close();
  }
}

await browser.close();

console.log(`# label=${label}`);
console.log("scene\tfps\tp95_ms\tp99_ms\tlong/total");
for (const r of rows) {
  if (r.error) {
    console.log(`${r.scene}\tERROR\t${r.error}`);
  } else {
    console.log(
      `${r.scene}\t${r.fps.toFixed(1)}\t${r.p5.toFixed(1)}\t${r.p1.toFixed(1)}\t${r.longFrames}/${r.frames}`,
    );
  }
}
