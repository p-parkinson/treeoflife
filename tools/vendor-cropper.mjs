#!/usr/bin/env node
/**
 * Fetch the crop library into vendor/, so a build needs no network at all.
 *
 *   node tools/vendor-cropper.mjs
 *
 * The page tries vendor/ first and falls back to the CDN, so this is optional
 * for development and worth doing for anything published: a vendored copy is
 * a file you have read, pinned and can serve yourself, rather than whatever
 * the CDN hands the reader today.
 *
 * It also prints the subresource-integrity hash for the CDN fallback. Paste it
 * into CROPPER_SRI in index.html: without it the browser cannot verify third-
 * party code running in a page that handles photographs of children.
 *
 * Cropper.js is MIT licensed (c) Chen Fengyuan. The licence is written next to
 * the files so the vendored copy carries its own terms.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = process.env.CROPPER_VERSION || "1.6.2";
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/cropperjs/${VERSION}/`;
const FILES = ["cropper.min.js", "cropper.min.css"];

/* A vendored file is only worth having if it is the file we meant to fetch, so
   anything surprising is a failure rather than something written to disk. */
const LOOKS_LIKE = {
  "cropper.min.js": /Cropper/,
  "cropper.min.css": /\.cropper-/,
};

async function grab(name) {
  const url = BASE + name;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length < 1000) throw new Error(`${name} is only ${body.length} bytes - not the real file`);
  if (!LOOKS_LIKE[name].test(body.toString("utf8")))
    throw new Error(`${name} does not look like Cropper.js - refusing to vendor it`);
  return body;
}

const out = join(ROOT, "vendor");
await mkdir(out, { recursive: true });

for (const name of FILES) {
  const body = await grab(name);
  await writeFile(join(out, name), body);
  const sri = "sha384-" + createHash("sha384").update(body).digest("base64");
  console.log(`${name}: ${(body.length / 1024).toFixed(0)} KB`);
  if (name === "cropper.min.js") console.log(`  CROPPER_SRI = "${sri}";   <- paste into index.html`);
}

await writeFile(join(out, "README.md"),
  `# Vendored third-party code\n\n` +
  `Cropper.js ${VERSION}, fetched by \`tools/vendor-cropper.mjs\` from cdnjs.\n` +
  `MIT licensed, (c) Chen Fengyuan — https://github.com/fengyuanchen/cropperjs\n\n` +
  `The page loads these if they are here and falls back to the CDN if they are\n` +
  `not, so deleting this directory costs the "Adjust the framing" button on an\n` +
  `offline machine and nothing else. Do not edit these files by hand.\n`);

console.log("vendor/ written - the page will now prefer it over the CDN");
