#!/usr/bin/env node
/**
 * The checks this project is held to. Run before pushing anything that touches
 * index.html:
 *
 *   npm i -D playwright axe-core     # once
 *   npx playwright install chromium   # once, unless TOL_CHROMIUM points at one
 *   node tools/check.mjs
 *
 * It exits non-zero on any failure, so it can go in CI as-is.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = pathToFileURL(join(ROOT, "index.html")).href;
const require = createRequire(import.meta.url);

let chromium, devices, axeSource;
try {
  ({ chromium, devices } = await import("playwright"));
  axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
} catch {
  console.error("This needs playwright and axe-core:\n  npm i -D playwright axe-core");
  process.exit(2);
}
if (!existsSync(join(ROOT, "index.html"))) { console.error("index.html not found"); process.exit(2); }

const AXE_TAGS = ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"];
/* Both views, a named animal, and a figure style that is not the page's own. */
const VIEWS = [
  ["two animals", "#a=Panthera%20leo&b=Ursus%20arctos"],
  ["family tree", "#tree=domestic+cat,human,emu&names=Mr+Whiskers&style=guide"]
];
const SETS = ["human", "lion,tiger", "human,chimpanzee,mouse,chicken,octopus",
  "lion,brown+bear,honey+bee,octopus,emu", "domestic+cat,human,emu&names=Mr+Whiskers&style=chalk"];

let failures = 0;
const report = (ok, what, detail) => {
  if (!ok) failures++;
  console.log((ok ? "  ok   " : "  FAIL ") + what + (detail ? "  -> " + detail : ""));
};

/* TOL_CHROMIUM lets you point at a browser you already have, instead of the one
   `npx playwright install` downloads. */
const browser = await chromium.launch(process.env.TOL_CHROMIUM ? { executablePath: process.env.TOL_CHROMIUM } : {});

console.log("axe-core, WCAG 2.1/2.2 A + AA + best practice");
for (const [viewName, hash] of VIEWS) {
  for (const scheme of ["light", "dark"]) {
    for (const [size, opts] of [["desktop", { viewport: { width: 1200, height: 900 } }],
                                ["phone", { ...devices["iPhone 13"] }]]) {
      const ctx = await browser.newContext({ ...opts, colorScheme: scheme });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(PAGE + hash);
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelectorAll("details").forEach(d => (d.open = true)));
      await page.waitForTimeout(200);
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async tags => await axe.run(document, { runOnly: { type: "tag", values: tags } }), AXE_TAGS);
      report(res.violations.length === 0, `${viewName}, ${scheme}, ${size}`,
        res.violations.map(v => `${v.id} (${v.nodes.length})`).join(", "));
      report(errors.length === 0, `${viewName}, ${scheme}, ${size}: no script errors`, errors.join(" | "));
      await ctx.close();
    }
  }
}

console.log("\nthe figure stays inside its own frame");
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
for (const set of SETS) {
  await page.goto(PAGE + "#tree=" + set);
  await page.waitForTimeout(400);
  const bad = await page.evaluate(() => {
    const svg = document.querySelector("#familySvg");
    if (!svg) return ["no figure drawn"];
    const box = svg.viewBox.baseVal;
    return [...svg.querySelectorAll("text")]
      .filter(t => { const b = t.getBBox(); return b.x < -1 || b.x + b.width > box.width + 1 || b.y + b.height > box.height + 1; })
      .map(t => t.textContent.slice(0, 30));
  });
  report(bad.length === 0, set.slice(0, 46), bad.join(" | "));
}

console.log("\nsmall screens");
for (const [name, width] of [["320 px", 320], ["390 px", 390], ["768 px", 768]]) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(PAGE);
  await page.waitForTimeout(500);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  report(!wide, name + ": the page itself never scrolls sideways");
}
await page.setViewportSize({ width: 1200, height: 900 });
await page.goto(PAGE);
await page.waitForTimeout(400);
const inputs = await page.$$eval("input[type=text]", els => els.map(e => parseFloat(getComputedStyle(e).fontSize)));
report(Math.min(...inputs) >= 16, "text inputs are at least 16px, so iOS does not zoom on focus", "smallest " + Math.min(...inputs) + "px");

console.log("\nevery colour in a fixed figure style clears 4.5:1 on its own paper");
const styleRatios = await page.evaluate(() => {
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(x => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return Object.entries(FIG_STYLES).filter(([, s]) => !s.paper.startsWith("var(")).map(([id, s]) => {
    const values = [s.ink, s.muted, s.faint, s.shared, s.meet, ...s.accents];
    return [s.name, Math.min(...values.map(v => cr(v, s.paper)))];
  });
});
for (const [name, worst] of styleRatios) report(worst >= 4.5, name, "worst " + worst.toFixed(2) + ":1");

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
