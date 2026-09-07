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
import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { deflateSync, crc32 } from "node:zlib";
import { execFileSync } from "node:child_process";
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

console.log("\ninterface text");
{
  /* every id the code asks for must exist in English; other languages may be partial */
  const page = readFileSync(join(ROOT, "index.html"), "utf8");
  /* ids reach t() three ways: written out, sitting in a lookup table, or built from a
     prefix ("age.million" + form). Collect every id-shaped literal, and treat a prefix
     match as used, so a table-driven id is not reported as dead. */
  const literals = [...page.matchAll(/"([a-z][a-zA-Z0-9]*\.[a-zA-Z]+)"/g)].map(m => m[1]);
  const used = new Set(literals);
  [...page.matchAll(/data-i18n(?:-ph|-al)?="([^"]+)"/g)].forEach(m => used.add(m[1]));
  const isUsed = id => used.has(id) || literals.some(l => id.startsWith(l));
  const files = readdirSync(join(ROOT, "data")).filter(f => /^strings\.[a-z-]+\.js$/.test(f));
  const ids = {};
  for(const file of files){
    const code = readFileSync(join(ROOT, "data", file), "utf8");
    ids[file.split(".")[1]] = new Set([...code.matchAll(/^  "([^"]+)":/gm)].map(m => m[1]));
  }
  report(!!ids.en, "data/strings.en.js is present");
  const missing = [...used].filter(id => ids.en && !ids.en.has(id) && /^(ui|ph|a11y|foot|story|close|era|rank|grp|fig|diag|tree|list|pick|verdict|table|age|many|announce|lang)\./.test(id));
  report(missing.length === 0, "every id the app uses is defined in English", missing.join(", "));
  const unused = ids.en ? [...ids.en].filter(id => !isUsed(id)) : [];
  /* informational: a static scan cannot see every dynamic id, so this is a hint, not a gate */
  console.log(unused.length ? "  info  ids no static reference could be found for: " + unused.join(", ")
                            : "  ok   every English id has a reference in the app");
  for(const code of Object.keys(ids).filter(c => c !== "en")){
    const gaps = [...ids.en].filter(id => !ids[code].has(id));
    console.log("  info  " + code + ": " + (ids.en.size - gaps.length) + "/" + ids.en.size +
      " interface strings" + (gaps.length ? " (falls back to English for " + gaps.length + ")" : ""));
  }
}

console.log("\nevery language renders with no missing text");
{
  const codes = readdirSync(join(ROOT, "data")).filter(f => /^strings\./.test(f)).map(f => f.split(".")[1]);
  for(const code of codes){
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", e => problems.push(e.message));
    page.on("console", m => { if (m.text().includes("No text for")) problems.push(m.text()); });
    await page.goto(PAGE + "#tree=lion,octopus,honey+bee&lang=" + code);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelectorAll("details").forEach(d => (d.open = true)));
    await page.waitForTimeout(200);
    report(problems.length === 0, code + ": page renders cleanly", problems.slice(0, 3).join(" | "));
    await ctx.close();
  }
}

console.log("\na photo of your own");
{
  /* a real PNG, written here so the check needs no fixtures on disk */
  const w = 240, h = 160;
  const rows = [];
  for(let y = 0; y < h; y++){
    const line = [0];
    for(let x = 0; x < w; x++) line.push(y < h / 3 ? 240 : 40, y < h / 3 ? 90 : 120, 40);
    rows.push(Buffer.from(line));
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const file = join(tmpdir(), "tol-check-photo.png");
  writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]));

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", e => problems.push(e.message));
  await page.goto(PAGE + "#tree=domestic+cat,human&names=Mr+Whiskers");
  await page.waitForTimeout(700);
  await page.evaluate(() => (document.querySelector("#figWords").open = true));
  await page.setInputFiles('[data-photo-for="sp-felis-catus"]', file);
  await page.waitForTimeout(900);
  const href = await page.$eval("#familySvg image", el => el.getAttribute("href")).catch(() => "");
  report(href.startsWith("data:image/"), "a chosen photo lands on the animal, inlined not linked",
    href.slice(0, 30));
  report(await page.evaluate(() => !!JSON.parse(localStorage.getItem("tol-photos") || "{}")["sp-felis-catus"]),
    "the photo is remembered on this device");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnPng")]);
  const bytes = readFileSync(await download.path()).length;
  report(bytes > 20000, "the photo survives into the PNG export (canvas not tainted)", Math.round(bytes / 1024) + " KB");
  await page.click("[data-photo-drop]");
  await page.waitForTimeout(500);
  report((await page.$$("#familySvg image")).length === 0, "removing the photo clears it from the figure");
  report(problems.length === 0, "no script errors while handling a photo", problems.slice(0, 2).join(" | "));
  await ctx.close();
  try { unlinkSync(file); } catch { /* fine */ }
}

console.log("\ntyped search stays in the reader's language");
{
  const codes = readdirSync(join(ROOT, "data")).filter(f => /^names\./.test(f)).map(f => f.split(".")[1]);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(PAGE);
  await page.waitForTimeout(700);
  /* A name from one language must not find its taxon while another language is on
     screen - otherwise every language added makes mishits more likely. A link,
     which is machine input, must still resolve. */
  const result = await page.evaluate(codes => {
    const probes = ["sp-octopus-vulgaris", "sp-panthera-leo", "sp-apis-mellifera", "sp-felis-catus", "sp-aptenodytes-forsteri"];
    const leaks = [], unresolvable = [];
    const all = ["en", ...codes];
    for(const from of all) for(const to of all){
      if(from === to) continue;
      for(const id of probes){
        const entry = from === "en" ? null : (window.TOL_NAMES[from] || {})[id];
        const node = nodes.get(id);
        if(!node) continue;
        const term = from === "en" ? node.common : (Array.isArray(entry) ? entry[0] : entry);
        if(!term) continue;
        const theirs = to === "en" ? [node.common] :
          [].concat((window.TOL_NAMES[to] || {})[id] || []).map(String);
        if(theirs.some(n => n && n.toLowerCase() === term.toLowerCase())) continue;  // same word in both
        pickLanguage(to);
        if(search(term, 5).some(n => n.id === id)) leaks.push(to + ' found the ' + from + ' name "' + term + '"');
        if(!search(term, 1, true).some(n => n.id === id)) unresolvable.push(from + ' name "' + term + '" in a link');
      }
    }
    pickLanguage("en");
    return { leaks, unresolvable };
  }, codes);
  report(result.leaks.length === 0, "a name from another language does not match what you type",
    result.leaks.slice(0, 3).join(" | "));
  report(result.unresolvable.length === 0, "links still resolve names from any language",
    result.unresolvable.slice(0, 3).join(" | "));
  await ctx.close();
}

console.log("\nthe single-file build");
{
  let built = true;
  try { execFileSync(process.execPath, [join(ROOT, "tools", "build-single.mjs")], { stdio: "pipe" }); }
  catch (e) { built = false; report(false, "tools/build-single.mjs runs", String(e.message).slice(0, 120)); }
  if(built){
    const out = join(ROOT, "dist", "tree-of-life.html");
    report(existsSync(out), "dist/tree-of-life.html written");
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", e => problems.push(e.message));
    page.on("requestfailed", r => { if(!r.url().includes("fonts.google")) problems.push("failed request " + r.url()); });
    await page.goto(pathToFileURL(out).href + "#tree=lion,octopus");
    await page.waitForTimeout(700);
    const taxa = await page.evaluate(() => (typeof nodes !== "undefined" ? nodes.size : 0));
    report(taxa > 1000 && problems.length === 0, "the built file works on its own",
      "taxa " + taxa + " " + problems.slice(0, 2).join(" | "));
    await ctx.close();
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
