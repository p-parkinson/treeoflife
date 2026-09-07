#!/usr/bin/env node
/**
 * Fetch one representative picture for each milestone group in the tree.
 *
 *   node tools/fetch-images.mjs --contact you@example.org
 *
 * With --species it does the same for the animals themselves, reading the list
 * straight out of data/taxonomy.js so the two can never drift apart.
 *
 * For every entry in tools/milestone-images.json it:
 *   1. asks English Wikipedia for the page's lead image (or uses an explicit
 *      Commons file name when the mapping overrides it),
 *   2. asks Wikimedia Commons for a resized copy plus the licence metadata,
 *   3. saves images/<id>.<ext> and records the credit in images/credits.json.
 *
 * Nothing is invented: an entry with no usable free image is reported and skipped,
 * so a missing picture is visible rather than silently wrong.
 *
 * Requires Node 18+ (built-in fetch). No npm dependencies.
 * If `sharp` happens to be installed, files are re-encoded to WebP; otherwise the
 * Commons thumbnail is saved as-is.
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_FILE = join(ROOT, "tools", "milestone-images.json");
const OUT_DIR = join(ROOT, "images");

/* ---------- options ---------- */
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? fallback : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true);
};
const CONTACT  = opt("contact", "");           // an email or URL, required by Wikimedia
const WIDTH    = Number(opt("width", 400));    // thumbnail width in pixels
const ONLY     = opt("only", "");              // fetch a single id
const SPECIES  = opt("species", "");           // "all", or a comma-separated list of animals
const FORCE    = !!opt("force", false);        // re-fetch images already on disk
const INLINE   = !!opt("inline", false);       // also emit images/images.js with data URIs
const DRY      = !!opt("dry-run", false);
const DELAY_MS = Number(opt("delay", 250));    // be polite between requests

if (!CONTACT) {
  console.error("Wikimedia asks every script to identify itself.\n" +
                "Run again with:  node tools/fetch-images.mjs --contact you@example.org");
  process.exit(1);
}
const UA = `treeoflife-image-fetcher/1.0 (https://github.com/p-parkinson/treeoflife; ${CONTACT})`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url){
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" } });
  if(!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return res.json();
}

/* ---------- 1. Wikipedia lead image ---------- */
async function leadImageUrl(title){
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_"));
  const data = await getJSON(url);
  return data.originalimage?.source || data.thumbnail?.source || null;
}

/* upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Name.jpg/320px-Name.jpg -> "Name.jpg" */
function commonsFileFromUrl(url){
  const m = /\/wikipedia\/(commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(url);
  if(!m) return null;
  if(m[1] === "en") return { local: true };              // non-free local upload: never reuse
  return { file: decodeURIComponent(m[2]) };
}

/* ---------- 2. Commons thumbnail + licence ---------- */
const stripHTML = s => (s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function commonsInfo(file){
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
    "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=" + WIDTH +
    "&titles=" + encodeURIComponent("File:" + file);
  const page = (await getJSON(url)).query?.pages?.[0];
  if(!page || page.missing || !page.imageinfo?.length) return null;
  const info = page.imageinfo[0], meta = info.extmetadata || {};
  return {
    file,
    thumb: info.thumburl || info.url,
    descriptionUrl: info.descriptionurl,
    artist: stripHTML(meta.Artist?.value) || "Unknown author",
    license: stripHTML(meta.LicenseShortName?.value) || "see source",
    licenseUrl: meta.LicenseUrl?.value || "",
    restrictions: stripHTML(meta.Restrictions?.value)
  };
}

const NON_FREE = /fair use|non-?free|all rights reserved/i;

/* ---------- 3. save ---------- */
let sharp = null;
try { ({ default: sharp } = await import("sharp")); } catch { /* optional */ }

async function saveImage(id, thumbUrl){
  const res = await fetch(thumbUrl, { headers: { "User-Agent": UA } });
  if(!res.ok) throw new Error("HTTP " + res.status + " downloading " + thumbUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  if(sharp){
    const out = await sharp(buf).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await writeFile(join(OUT_DIR, id + ".webp"), out);
    return { name: id + ".webp", bytes: out.length, mime: "image/webp", data: out };
  }
  const ext = (thumbUrl.match(/\.(jpe?g|png|gif|webp)$/i)?.[1] || "jpg").toLowerCase();
  await writeFile(join(OUT_DIR, id + "." + ext), buf);
  const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { name: id + "." + ext, bytes: buf.length, mime, data: buf };
}

const exists = async p => { try { await access(p); return true; } catch { return false; } };

/* ---------- what to fetch ---------- */
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* The animals live in data/taxonomy.js; read them from there rather than keeping
   a second copy that can go stale. Ids must match the ones the page builds. */
async function speciesMapping(which){
  const page = await readFile(join(ROOT, "data", "taxonomy.js"), "utf8");
  const m = /const SPECIES = (\[[\s\S]*?\n\];)/.exec(page);
  if(!m) throw new Error("could not find the SPECIES list in data/taxonomy.js");
  const rows = JSON.parse(m[1]
    .replace(/^\s*\/\/.*$/gm, "")      // the list is commented by group
    .replace(/;\s*$/, "")
    .replace(/,(\s*\])/g, "$1"));
  const wanted = which === "all" || which === true ? null
    : new Set(which.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
  const out = {};
  for(const [sci, common, , aliases] of rows){
    if(wanted && !wanted.has(sci.toLowerCase()) && !wanted.has((common||"").toLowerCase()) &&
       !(aliases||"").toLowerCase().split("|").some(a => wanted.has(a))) continue;
    out["sp-" + slugify(sci)] = {title: sci, caption: common};
  }
  return out;
}

/* ---------- run ---------- */
const mapping = SPECIES ? await speciesMapping(SPECIES) : JSON.parse(await readFile(MAP_FILE, "utf8")).images;
const ids = Object.keys(mapping).filter(id => !ONLY || id === ONLY);
if(!ids.length){ console.error("Nothing matched " + (ONLY || SPECIES)); process.exit(1); }
if(!DRY) await mkdir(OUT_DIR, { recursive: true });

let credits = {};
try { credits = JSON.parse(await readFile(join(OUT_DIR, "credits.json"), "utf8")); } catch { /* first run */ }
const failures = [], review = [];
let bytes = 0;

for(const id of ids){
  const entry = mapping[id];
  process.stdout.write(id.padEnd(26));
  try{
    let file = entry.file || null;
    if(!file){
      const lead = await leadImageUrl(entry.title);
      if(!lead) throw new Error('no lead image on the "' + entry.title + '" page - add a "file" override');
      const parsed = commonsFileFromUrl(lead);
      if(!parsed) throw new Error("could not read a Commons file name out of " + lead);
      if(parsed.local) throw new Error('the "' + entry.title + '" lead image is a non-free local upload - add a "file" override');
      file = parsed.file;
    }
    const info = await commonsInfo(file);
    if(!info) throw new Error("File:" + file + " is not on Commons");
    if(NON_FREE.test(info.license)) throw new Error("licence is not free: " + info.license);

    let saved = { name: null, bytes: 0 };
    if(!DRY){
      const onDisk = credits[id]?.image;
      if(onDisk && !FORCE && await exists(join(OUT_DIR, onDisk))){
        saved.name = onDisk;
        console.log(onDisk + "  already downloaded (use --force to replace)");
      } else {
        saved = await saveImage(id, info.thumb);
        bytes += saved.bytes;
      }
    }
    credits[id] = {
      caption: entry.caption,
      image: saved.name,
      file: "File:" + info.file,
      artist: info.artist,
      license: info.license,
      licenseUrl: info.licenseUrl,
      source: info.descriptionUrl
    };
    if(info.restrictions) credits[id].restrictions = info.restrictions;
    if(entry.check) review.push(id);
    console.log((saved.name || "(dry run)") + "  " + info.license + "  " + info.artist.slice(0, 40));
  }catch(err){
    failures.push({ id, reason: err.message });
    console.log("FAILED - " + err.message);
  }
  await sleep(DELAY_MS);
}

if(!DRY){
  await writeFile(join(OUT_DIR, "credits.json"), JSON.stringify(credits, null, 2) + "\n");
  if(INLINE){
    const inlined = {};
    for(const [id, c] of Object.entries(credits)){
      if(!c.image) continue;
      const path = join(OUT_DIR, c.image);
      if(!await exists(path)) continue;
      const mime = c.image.endsWith(".webp") ? "image/webp" : c.image.endsWith(".png") ? "image/png" : "image/jpeg";
      inlined[id] = { src: "data:" + mime + ";base64," + (await readFile(path)).toString("base64"),
                      caption: c.caption, credit: c.artist, license: c.license, source: c.source };
    }
    await writeFile(join(OUT_DIR, "images.js"),
      "/* Generated by tools/fetch-images.mjs - do not edit by hand. */\n" +
      "const TAXON_IMAGES = " + JSON.stringify(inlined, null, 1) + ";\n");
    console.log("images/images.js written with " + Object.keys(inlined).length + " inlined pictures");
  }
}

console.log("\n" + Object.keys(credits).length + " of " + ids.length + " groups have a picture" +
            (bytes ? "  (" + (bytes/1024/1024).toFixed(2) + " MB" + (sharp ? ", WebP" : ", as downloaded") + ")" : ""));
if(review.length)
  console.log("\nLook at these before shipping - the Wikipedia lead image is often a diagram or collage:\n  " + review.join(", ") +
              '\n  Fix one by adding "file": "Some photo.jpg" to its entry in tools/milestone-images.json, then rerun with --force --only <id>.');
if(failures.length){
  console.log("\nNo picture for:");
  for(const f of failures) console.log("  " + f.id.padEnd(26) + f.reason);
}
if(!sharp && !DRY) console.log("\n(Install sharp for smaller WebP files: npm i -D sharp)");
