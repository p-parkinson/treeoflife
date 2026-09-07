#!/usr/bin/env node
/**
 * Stamp a version onto the data scripts, so a deploy cannot serve a fresh
 * index.html beside cached data files.
 *
 *   node tools/stamp-assets.mjs <directory> <version>
 *
 * Why this exists: index.html and data/strings.<lang>.js change together, but
 * a browser caches them separately and by URL. A returning visitor can end up
 * running new markup against an old string file, and then the page shows raw
 * ids - "ui.photoChoose" - where a label should be. That happened once, live,
 * in front of the person testing it.
 *
 * Adding ?v=<commit> to each data script makes the URL change whenever the
 * content does, so the browser has to fetch it again. index.html itself is
 * revalidated by every static host worth using, so it needs no stamp.
 *
 * The single-file build does not need this at all: it inlines everything, so
 * there is nothing separate to go stale.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [dir, version] = process.argv.slice(2);
if (!dir || !version) {
  console.error("usage: node tools/stamp-assets.mjs <directory> <version>");
  process.exit(2);
}
/* Anything that would end up inside an attribute would break the tag. */
if (!/^[A-Za-z0-9._-]+$/.test(version)) {
  console.error(`version "${version}" must be letters, digits, dot, dash or underscore`);
  process.exit(2);
}

const file = join(dir, "index.html");
const page = await readFile(file, "utf8");

let stamped = 0;
const out = page.replace(/(<script src="data\/[^"?]+\.js)(")/g, (_, head, tail) => {
  stamped++;
  return head + "?v=" + version + tail;
});

if (!stamped) {
  console.error("no data scripts found in " + file + " - has the markup changed?");
  process.exit(1);
}
await writeFile(file, out);
console.log(`stamped ${stamped} data script(s) with ?v=${version}`);
