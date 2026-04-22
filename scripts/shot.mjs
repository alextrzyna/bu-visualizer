#!/usr/bin/env node
/**
 * Headless-browser screenshot helper, used by the maintainer for
 * visual regression during development.
 *
 * Usage:
 *   node scripts/shot.mjs [url] [focus] [outfile]
 *
 * `focus` can be:
 *   - a chapter number (e.g. `3`) — scroll the chapter into view
 *   - a numeric progress in [0,1] (e.g. `0.5`) — set the scrubber
 *   - a CSS selector (e.g. `.foo`) — scroll into view
 *
 * Examples:
 *   node scripts/shot.mjs                              # home page full viewport
 *   node scripts/shot.mjs /your-life                   # the capstone
 *   node scripts/shot.mjs / 3                          # home, chapter 3
 *   node scripts/shot.mjs /your-life 0.5               # capstone, scrubber at 50%
 *   node scripts/shot.mjs / 3 /tmp/ch3.png             # custom output path
 *
 * Honors env:
 *   BU_PORT     (default 3191)
 *   BU_WIDTH    (default 1440)
 *   BU_HEIGHT   (default 900)
 *   BU_DPR      (default 1)
 *   BU_MODE     ("experiential" or "block"; click corresponding button after load)
 */
import puppeteer from "puppeteer";

const port = process.env.BU_PORT ?? "3191";
const width = Number(process.env.BU_WIDTH ?? 1440);
const height = Number(process.env.BU_HEIGHT ?? 900);
const dpr = Number(process.env.BU_DPR ?? 1);

const [, , pathArg = "/", focusArg, outArg = "/tmp/bu-shot.png"] = process.argv;
const url = `http://localhost:${port}${pathArg}`;

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: dpr });

const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console.error: " + m.text());
});

console.log(`→ ${url} @ ${width}×${height} ×${dpr}`);
await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
await new Promise((r) => setTimeout(r, 1500));

if (process.env.BU_MODE) {
  const target = process.env.BU_MODE.toLowerCase();
  await page.evaluate((wanted) => {
    const btns = Array.from(document.querySelectorAll("button"));
    const re = new RegExp(wanted, "i");
    btns.find((b) => re.test(b.textContent || ""))?.click();
  }, target);
  await new Promise((r) => setTimeout(r, 1500));
}

if (focusArg !== undefined) {
  // Chapter index: scroll chapter into view
  if (/^\d+$/.test(focusArg)) {
    await page.evaluate((idx) => {
      document
        .querySelector(`[data-chapter="${idx}"]`)
        ?.scrollIntoView({ block: "start" });
    }, focusArg);
    await new Promise((r) => setTimeout(r, 2500));
  } else if (/^0?\.\d+$|^\d+\.\d+$/.test(focusArg)) {
    // Numeric progress in [0, 1]: set the range input's value via the
    // *prototype* setter so React's controlled-input value tracker
    // registers the change and fires onChange. `el.value = x` alone
    // gets swallowed by React's reconciler.
    const v = Number(focusArg);
    await page.evaluate((val) => {
      const el = /** @type {HTMLInputElement} */ (
        document.querySelector('input[type="range"]')
      );
      if (el) {
        const desc = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        );
        desc?.set?.call(el, String(val));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, v);
    await new Promise((r) => setTimeout(r, 2500));
  } else {
    // Assume CSS selector
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: "start" });
    }, focusArg);
    await new Promise((r) => setTimeout(r, 2500));
  }
}

await page.screenshot({ path: outArg });
console.log(`✓ wrote ${outArg}`);
if (errs.length) {
  console.log("errors:");
  for (const e of errs.slice(0, 10)) console.log("  " + e);
}
await browser.close();
