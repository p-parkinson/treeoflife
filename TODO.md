# Outstanding

Things noticed, deferred or blocked while building this. Rough sizes are for someone who
has read [AGENTS.md](AGENTS.md). Nothing here is a bug in what ships today.

## Blocked on network access

The authoring environment blocked Wikimedia, GBIF and Wikidata, so these are written and
verified as far as they can be offline, but never run for real.

- [ ] **Fetch the pictures.** `node tools/fetch-images.mjs --contact you@example.org` for the
  milestone groups, then `--species all` (or a chosen subset) for the animals. Then uncomment
  the one `<script src="images/images.js">` line in `index.html`. *Half an hour, plus review.*
- [ ] **Review the 14 flagged groups** the fetcher reports (`"check": true` in
  `tools/milestone-images.json`): Animal, Insect, Mammal, Reptile and friends usually have a
  collage or a diagram as their Wikipedia lead image. Pin a real photo per group.
- [ ] **Show the credits.** `images/credits.json` is written but nothing displays it yet. Most
  Commons photos are CC BY or CC BY-SA: **the photographer and licence must appear wherever the
  picture appears.** A caption under each figure photo, or a generated credits panel, is required
  before shipping images publicly. *Half a day, and it gates the whole picture feature.*
- [ ] **Decide how many animal photos.** All 343 is roughly 7 MB, too much to inline; a curated
  120 is about 2.5 MB. Either keep files in `images/` and serve the folder, or inline a subset.

## Translation

- [ ] **Get French and Spanish reviewed by native speakers.** Both are first drafts by a
  non-speaker and say so on the page (`foot.translation`). This is the single most valuable
  outstanding task: an unreviewed translation in a classroom is worse than none.
- [ ] **Gendered articles in generated sentences.** Both drafts dodge *le/la/el/la* by rephrasing
  around a dash or a colon (*"l'ancêtre commun de ces deux-là — lion et ours brun"*). A proper
  fix is a per-name gender field in `data/names.<lang>.js` and an article helper the sentence
  templates can call. *A day, and it needs a speaker's judgement.*
- [ ] **45 animals still have no translated name** (298 of 343 in each language, plus 170 groups).
  They fall back to English, then to the scientific name, so nothing breaks — but the gap is
  visible, and those are the only taxa where an English name is still searchable in another
  language (by design: you can search for what you can see).
- [ ] **A "search all languages" escape hatch** might help a bilingual classroom: typed search is
  deliberately scoped to the language on screen, so a French speaker reading the Spanish page
  cannot type *pieuvre*. Links resolve across languages, so the need is narrow — but a checkbox
  or a `&search=all` parameter would cover it if it comes up.
- [ ] **Step 3 of [docs/multilingual.md](docs/multilingual.md): `tools/fetch-names.mjs`.** Pull
  Wikidata P1843 (taxon common name) per language to extend and cross-check the hand-written
  names. One SPARQL query covers all 343 animals; commit the result so runtime stays offline.
  *A day, and it makes each new language cheap.*
- [ ] **Load language files on demand** once there are more than a few. All shipped languages
  currently load up front (~60 KB for three). Dynamic `<script>` injection keeps `file://`
  working where `fetch` would not.
- [ ] **Right-to-left** (Arabic, Urdu — both plausible in a Manchester classroom) needs
  `dir="rtl"`, logical CSS properties, and a mirrored figure. Treat as its own piece of work.
- [ ] **Check the fixed figure styles against non-Latin scripts.** Field guide forces a serif
  stack that may not cover CJK or Arabic.

## Photos people supply

- [ ] **A real crop tool.** Photos get a centre crop plus an up/down nudge, which handles most
  pet photos and no more. A pan-and-zoom crop is the obvious next step and the one place a library
  earns its keep — Cropper.js is about 30 KB and would have to be **vendored into the repo**, not
  loaded from a CDN, to keep the offline promise. Check its licence (MIT) and pin the version.
- [ ] **HEIC photos from iPhones** fail outside Safari; the page says so and suggests JPEG. A
  decoder library would fix it but costs hundreds of kilobytes — probably not worth it.
- [ ] **Photos are per-device.** They live in `localStorage`, so they do not follow a shared link
  and are lost if the browser is cleared. A "save these settings to a file" export/import would
  make a lesson portable.
- [ ] **No face detection**, so a group photo needs manual framing. Deliberate: it would mean
  either a library or a service, and safeguarding argues against sending a child's photo anywhere.

## The figure

- [ ] **Time-scaled option** (`&scale=time`): place branch points by divergence date instead of
  depth, with an axis along the bottom. It is the most educational version of the picture and was
  deliberately deferred — the open question is what to do with the many nodes that have no age.
- [ ] **Embed the fonts in exports.** A PNG rendered through canvas uses system fonts, because
  webfonts are not loaded for an SVG drawn into a canvas. Base64 `@font-face` inside the exported
  SVG would fix it, at ~80 KB per file.
- [ ] **`@page { size }` is patchy** outside Chrome and Edge, so Firefox and Safari users may have
  to pick A3 in the print dialog by hand. Worth a line of on-screen guidance next to the picker.
- [ ] **Downloads do nothing inside a published Artifact** (its sandbox blocks them). Declaring the
  `downloads` capability and saving through `window.claude.downloads.save` would fix it for that
  one host, at the cost of host-specific code in a file that is otherwise portable.

## Data

- [ ] **Reconcile against a real backbone** if the dataset ever grows past a teaching model:
  Open Tree of Life or the GBIF backbone, with TimeTree for dates. The app is structured so a
  fetched dataset could replace the two arrays in `data/taxonomy.js`.
- [ ] **Near-miss search.** An animal outside the 343 gets "not in the tree yet"; suggesting the
  closest match ("no bottlenose dolphin — did you mean *dolphin*?") would be kinder.
- [ ] **Sub-ranks are flattened to "group"** in plain-English mode (suborder, subfamily, tribe).
  Correct for a 12-year-old, but a "show scientific ranks" toggle might suit older students.

## Accessibility and infrastructure

- [ ] **The tree explorer is a list of buttons, not an ARIA treeview.** Everything is reachable,
  but a screen-reader user tabs through rows instead of using arrow keys. Full treeview means
  `role="tree"`, roving tabindex and arrow-key handling. *Half a day.*
- [ ] **`tools/check.mjs` takes about four minutes** offline, most of it waiting for the blocked
  Google Fonts request on each page load. Stubbing that route in the checker would cut it to
  under a minute.
- [ ] **Wire the checks into CI.** The script already exits non-zero; a GitHub Action running it
  on pull requests would stop the accessibility bar drifting.
- [ ] **Turn on GitHub Pages** (Settings → Pages → deploy from `main`, root) so the URLs in the
  footer and in worksheets actually resolve.
- [ ] **Decide whether to publish `dist/tree-of-life.html`.** It is gitignored as a build output;
  attaching it to a release would give teachers a one-file download without a build step.
