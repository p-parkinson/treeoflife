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

- [ ] **The real Cropper.js has never been run.** cdnjs is blocked in the environment this was
  built in, so the integration is checked against a stand-in with the same small API surface
  (`new Cropper(img, opts)`, `zoom`, `move`, `reset`, `getCroppedCanvas`, `destroy`) and the
  offline fallback is checked for real. **Open the page online once and frame a photo** before
  relying on it. Every call is inside a `try`, and the button only appears after the script
  loads, so the worst case is the fallback — but "probably fine" is not the same as tested.
- [ ] **Fill in `CROPPER_SRI`.** `index.html` loads the CDN copy without subresource integrity
  because the hash cannot be computed offline. Third-party code runs in a page that handles
  photographs of children, so before any public deployment either run
  `node tools/vendor-cropper.mjs` (which prints the hash and vendors the file) or paste the hash
  in by hand. The CI build vendors it, so anything built by the workflow is already safe; a
  hand-served copy of the repo is not.
- [ ] **HEIC photos from iPhones** fail outside Safari; the page says so and suggests JPEG. A
  decoder library would fix it but costs hundreds of kilobytes — and it is now allowed under
  rule 1 as a lazy, network-only enhancement, if anyone thinks the size is worth it.
- [ ] **Photos are per-device.** They live in `localStorage`, so they do not follow a shared link
  and are lost if the browser is cleared. A "save these settings to a file" export/import would
  make a lesson portable.
- [ ] **No face detection**, so a group photo needs manual framing. Deliberate: it would mean
  either a library or a service, and safeguarding argues against sending a child's photo anywhere.

## Libraries: what was considered and rejected

Rule 1 now allows a networked enhancement, so the question "would a library help?" was asked of
every part of the app, not just cropping. The bar is the one the rule sets: **it must be
inessential, so that losing it degrades instead of breaking.** That bar excludes most of them
before size or quality even comes up — anything on the critical path cannot be a CDN script,
because the app has to work from a USB stick.

| Instead of | Considered | Verdict |
| --- | --- | --- |
| the crop UI | Cropper.js | **Adopted.** Genuinely inessential, and pointer maths for pan/zoom/pinch is the fiddliest code here. |
| `inducedTree`/`condense`/layout | d3-hierarchy | **No.** On the critical path, so it cannot fail gracefully. It would also only supply the dendrogram maths, not the compression, the skipped-group badges, the label collision work or the two responsive layouts — that is where the code actually is. |
| the search index | Fuse.js | **No.** On the critical path. Fuzzy matching also fights a deliberate decision: search is scoped to the reader's language to avoid cross-language mishits, and typo tolerance widens exactly that. |
| SVG → PNG | canvg, dom-to-image | **No.** On the critical path, and ~20 lines today. Both libraries are weaker at the thing that actually matters here: resolving `var(--x)` to literals so the export is not blank. |
| print → PDF | jsPDF + svg2pdf | **No.** On the critical path. It would fix the patchy `@page { size }` support, but the browser's own print gives real vector text in the real fonts; jsPDF would need the fonts embedded (~80 KB each) to match. |
| `t()` and the string files | i18next | **No.** On the critical path, and ~20 lines. Plurals and word order are already handled by making a string a function. A translator editing one plain object is the point. |
| the theme, layout, components | Tailwind, any framework | **No.** On the critical path, and the markup, styles and code together are ~100 KB. |

The short version: cropping was the only place a library earned its keep, which is roughly what
was expected. The rule change is still worth having — it is what makes the crop tool possible at
all, and it gives HEIC decoding a legitimate route in if anyone wants it.

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

- [ ] **`tools/check.mjs` takes about four minutes** offline, most of it waiting for the blocked
  Google Fonts request on each page load. Stubbing that route in the checker would cut it to
  under a minute.
- [x] **Wire the checks into CI.** `.github/workflows/build.yml` runs `tools/check.mjs` on every
  pull request, then builds the single-file copy and the site on merge to `main`.
- [ ] **Turn on GitHub Pages, once.** Settings → Pages → Source: **GitHub Actions**. Until that is
  done the `pages` job fails and the rest of the workflow is unaffected. The footer URLs and any
  worksheet links only resolve after this.
- [ ] **The workflow has never run.** It is written against this repo's layout but was committed
  from an environment with no access to Actions. Expect to fix something on the first run —
  most likely the Chromium install step or the Pages permissions.
- [ ] **Attach the single file to a release.** The build uploads it as a workflow artifact, which
  expires and needs a GitHub login to download. A release asset on a tag would give teachers a
  plain, permanent link.
