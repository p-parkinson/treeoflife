#!/usr/bin/env node
/**
 * Build one self-contained file: dist/tree-of-life.html
 *
 *   node tools/build-single.mjs
 *
 * index.html loads its data, strings and names as separate scripts, which keeps
 * them reviewable and lets a translator work on one file. This inlines all of
 * them (and images/images.js, if it exists) so the result opens from a USB stick,
 * an email attachment or a published Artifact with nothing else beside it.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist", "tree-of-life.html");

let page = await readFile(join(ROOT, "index.html"), "utf8");
/* a <script src> inside an HTML comment is a hint to the reader, not a real one */
const commentedOut = at => {
  const open = page.lastIndexOf("<!--", at), close = page.lastIndexOf("-->", at);
  return open > close;
};
const tags = [...page.matchAll(/<script src="([^"]+)"><\/script>\n?/g)].filter(m => !commentedOut(m.index));
if(!tags.length) console.warn("No external scripts found - nothing to inline.");

let inlined = 0;
for(const [tag, src] of tags){
  let code;
  try { code = await readFile(join(ROOT, src), "utf8"); }
  catch { console.warn("skipped (not found): " + src); continue; }
  page = page.replace(tag, "<script>\n/* inlined from " + src + " */\n" + code + "\n</script>\n");
  inlined++;
}

/* pictures, when they have been fetched */
if(!/images\/images\.js/.test(page)){
  try {
    const images = await readFile(join(ROOT, "images", "images.js"), "utf8");
    page = page.replace("<script>\n/* =====", "<script>\n/* inlined from images/images.js */\n" + images +
      "\n</script>\n<script>\n/* =====");
    inlined++;
    console.log("pictures inlined");
  } catch { /* none fetched yet */ }
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, page);
const kb = (Buffer.byteLength(page) / 1024).toFixed(0);
console.log("dist/tree-of-life.html written: " + kb + " KB, " + inlined + " file(s) inlined");
const leftover = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)].filter(m => !commentedOut(m.index));
if(leftover.length) console.warn("warning: still external: " + leftover.map(m => m[1]).join(", "));
