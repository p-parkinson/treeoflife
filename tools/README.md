# Pictures for the milestone groups

`fetch-images.mjs` collects one photo for each milestone group in the diagram (Animals,
Arthropods, Mammals, Birds…) from Wikimedia Commons, along with the credit each licence
requires. It runs on your machine and commits its results; the app itself never calls an API.

## Run it

Node 18 or newer, no npm install needed:

```bash
node tools/fetch-images.mjs --contact you@example.org
```

Wikimedia asks every script to say who is running it, so `--contact` (an email or a URL) is
required and goes into the User-Agent header.

| Option | Meaning |
| --- | --- |
| `--contact <email or url>` | **Required.** Identifies you to the Wikimedia APIs. |
| `--width 400` | Thumbnail width in pixels (default 400). |
| `--only <id>` | Fetch a single group, e.g. `--only insecta`. |
| `--force` | Re-download pictures that are already on disk. |
| `--inline` | Also write `images/images.js`, every picture as a data URI. |
| `--species all` | Fetch a photo of each **animal** instead of each group. Also takes a list: `--species "lion,emu,octopus"`. |
| `--dry-run` | Look everything up and report, but write nothing. |
| `--delay 250` | Milliseconds between requests. |

Output:

```
images/<id>.webp      one picture per group (or .jpg if sharp isn't installed)
images/credits.json   caption, photographer, licence, and link to the source page
images/images.js      only with --inline: the same pictures as data URIs
```

`npm i -D sharp` is optional; if it's present the pictures are re-encoded as WebP, which is
roughly a third of the size. Expect about 1–2 MB for all 66 groups.

## Photos of the animals themselves

The family-tree view puts a picture at the end of each branch. Those come from
`--species`, which reads the animal list straight out of `index.html` — no second copy to
keep in step — and uses each scientific name as the Wikipedia title:

```bash
node tools/fetch-images.mjs --contact you@example.org --species all --inline
```

A species' lead image on Wikipedia is nearly always a decent photo of the animal, so these
need no hand-curation, unlike the big groups above. Ids come out as `sp-panthera-leo`, matching
what the page builds.

All 343 animals is roughly 7 MB, which is too much to inline into one HTML file. Either fetch
the ones you actually use — `--species "lion,brown bear,emu,octopus,honey bee"` — or keep the
files in `images/` and serve the folder. The app draws a plain coloured ring for any animal with
no picture, so a partial set is fine.

To switch the pictures on, uncomment the line near the bottom of `index.html`:

```html
<script src="images/images.js"></script>
```

## How it picks a picture

For each entry in `milestone-images.json` it reads the lead image of the named English
Wikipedia page, works out which Commons file that is, then asks Commons for a resized copy
and the licence metadata. An entry can name a Commons file directly with `"file"`, which
overrides the Wikipedia lookup.

Nothing is guessed. A group with no usable free picture is listed at the end of the run and
simply has no entry in `credits.json`.

## Review the flagged entries

Fourteen entries are marked `"check": true` — the big groups whose Wikipedia lead image is
often a collage or a diagram rather than a photograph (Animal, Insect, Mammal, Reptile…).
The script prints them at the end of every run. Look at each one and, where it isn't a good
picture for a 12-year-old, pick a better file on Commons and pin it:

```jsonc
"insecta": {
  "title": "Insect",
  "caption": "An insect: six legs, usually wings",
  "file": "Apis mellifera flying.jpg"      // exact Commons file name, no "File:" prefix
}
```

Then re-fetch just that one: `node tools/fetch-images.mjs --contact you@example.org --force --only insecta`.

Choosing by hand matters for the top of the tree: "Animals" has no single portrait, so pick a
creature that makes the point — a sponge or a jellyfish says "this group is bigger than you
think" far better than a collage does.

## Crediting the photographers

Most Commons photos are CC BY or CC BY-SA: **you must name the photographer and the licence
wherever the picture appears.** `credits.json` carries everything needed:

```json
"carnivora": {
  "caption": "A carnivoran",
  "image": "carnivora.webp",
  "artist": "Jane Doe",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
  "source": "https://commons.wikimedia.org/wiki/File:Example.jpg"
}
```

A caption line under each picture (`Photo: Jane Doe, CC BY-SA 4.0`, linking to `source`) meets
the requirement, and one generated credits panel listing all of them is worth having as well.
The script refuses anything marked fair-use or non-free, so everything it saves is reusable —
but attribution is still not optional.

## Wiring the pictures into the app

Two ways, depending on how the page is served:

- **Served from a folder** (GitHub Pages, a school web server): reference the files directly,
  `<img src="images/insecta.webp" alt="">`, and load `credits.json` for the caption line.
- **Kept as one file** (opening `index.html` off a USB stick, or publishing it as an Artifact —
  whose content policy blocks external images): run with `--inline` and add
  `<script src="images/images.js"></script>` before the main script, or paste that file's
  contents in. Every picture is then a data URI inside the page.

Rendering one into the diagram is a clip-path and an `<image>` on the node:

```js
// inside drawDiagram(), where a milestone node is drawn
const pic = typeof TAXON_IMAGES !== "undefined" && TAXON_IMAGES[n.id];
if(pic){
  p.push('<clipPath id="clip-' + n.id + '"><circle cx="' + x + '" cy="' + yy + '" r="22"/></clipPath>' +
         '<image href="' + pic.src + '" x="' + (x-22) + '" y="' + (yy-22) + '" width="44" height="44" ' +
         'preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-' + n.id + ')"/>' +
         '<circle cx="' + x + '" cy="' + yy + '" r="22" fill="none" stroke="var(--shared)" stroke-width="3"/>');
}
```

The picture is decoration next to a label that already names the group, so `alt=""` (or no
`<title>` in SVG) is right — a screen reader shouldn't have to hear "photograph of a bee"
before the word "Insects". The caption and credit go in visible text underneath.
