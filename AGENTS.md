# Working on this project

A single-page app that shows how any two — or up to five — animals are related on the tree of
life, written for 10–15 year olds and meant to survive a school network or a museum bench.
Read this before changing anything.

**What exists today.** Two views (the two-animal answer, the family tree of up to five); 1,050 taxa
and 343 animals; English, French and Spanish; five figure styles; per-animal names and photos a
teacher supplies; print/PDF and SVG/PNG export; light/dark; a browsable tree. Everything is driven
from the URL. `node tools/check.mjs` is the gate — 44 checks, and it must stay green.

## What must stay true

1. **No dependencies, no network at runtime.** No frameworks, no bundler, no CDN scripts, no
   analytics, no API calls. The only external request is the Google Fonts stylesheet, and the page
   is fully usable when it fails. `index.html` holds the markup, styles and code; the data, the
   interface text and the translated names sit beside it in `data/` as plain scripts, which is what
   lets a translator or a taxonomist work on one small file. Everything still has to work from a
   USB stick (`file://`): use classic `<script src>` tags, never `fetch` or ES modules.
   `node tools/build-single.mjs` folds it all back into one `dist/tree-of-life.html` for offline
   distribution, plus `dist/artifact.html` (the same page minus the document skeleton) for
   publishing as an Artifact. Never hand-strip that copy: the tool exists so the published page
   cannot drift from the built one.
2. **One layout engine.** The two-animal answer and the five-animal figure share
   `inducedTree`/`condense`, the milestone set and the autocomplete. Presentation differs;
   the tree logic does not. Don't fork the renderer — add a parameter.
3. **The data is a teaching model, not a database.** ~1,050 taxa and 343 animals compiled by
   hand. It is allowed to be incomplete; it is not allowed to be wrong or to imply more precision
   than it has. Dates are rounded consensus estimates and shown only on major clades. An animal
   that isn't in the set says so rather than guessing.
4. **The address bar is the state.** `#a=&b=` for the two-animal answer, `#tree=…` plus
   `style`, `title`, `footer`, `names` and `bare=1` for the figure. Any picture a teacher can see
   must be reachable as a link, because that is what makes it printable and screenshottable.

## Every visible string goes through `t()`

This is the rule most easily broken, so it is checked: **no user-visible English in `index.html`.**

- Text in the markup carries `data-i18n="id"` (or `data-i18n-ph` for a placeholder,
  `data-i18n-al` for an aria-label), and `applyStrings()` fills it in.
- Text built in code comes from `t("id", {vars})`. Where a sentence has to be assembled, the
  string is a **function** in the language file — never concatenation in the app, because word
  order, articles and plurals differ by language.
- `data/strings.en.js` is the reference: `tools/check.mjs` fails if the app asks for an id English
  does not define, and reports ids nothing appears to use (only as a note — some are reached
  through lookup tables, so a human decides whether they are really dead). Other languages may be
  partial; they fall back to English, and English falls back to the scientific name.
- Names of animals and groups are data, not interface text: `data/names.<lang>.js`, keyed by clade
  id or `sp-<slug of scientific name>`.
- **Typed search is scoped to the language on screen** — the reader's language, English only where
  that language has no name for a taxon, and scientific names always. Adding a language must never
  make another language's names matchable, or mishits multiply as the corpus grows. Link
  resolution is the deliberate exception: `search(q, n, true)` searches every language, because a
  URL is machine input and has to resolve whoever wrote it. Both halves are checked.
- Adding a string means editing `data/strings.en.js` **and** checking which other languages now
  fall back — the check script prints the coverage. Draft translations must say so in their header
  and in `foot.translation`, which the page shows to the reader.

## Photos people supply

A teacher can put a photo of the class pet on a leaf. Two rules, and the second is not negotiable:

- **It never leaves the device.** Read with `createImageBitmap` (which also corrects EXIF
  rotation), cropped and shrunk on a canvas, stored as a data URI in `localStorage`. No upload, no
  request, no third party — the page has no network at runtime and this must not become the
  exception. The UI says so plainly, because the photo may be of a child.
- **It does travel into the exports.** A data URI is inlined in the SVG, the PNG and the print
  output, which is the point — and also why the wording tells the reader that the picture they
  download contains it. Data URIs are also what keeps the canvas untainted, so PNG export works.

Photos are per-device and deliberately absent from the URL: a shared link carries names, titles
and style, never someone's photograph.

## The accessibility bar

Not aspirational — it is checked. `node tools/check.mjs` must pass before pushing
(needs `npm i -D playwright axe-core`; see `tools/README.md`).

- **axe-core, WCAG 2.1/2.2 A + AA + best practice: zero violations**, on both views × light and
  dark × desktop and phone. Every shipped language must also render with no missing strings and no
  script errors.
- **Every colour clears 4.5:1 against its own background**, including tinted table rows and each
  fixed figure style against that style's own paper. Check before choosing a colour, not after.
- **Keyboard-complete**: visible focus everywhere, a skip link, the suggestion list is a real ARIA
  combobox (`aria-expanded`, `aria-activedescendant`, `role="option"`), the tree's expanders and
  names are buttons, and focus survives a re-render — the tree rebuilds its whole DOM, so put
  focus back where it was.
- **Announce results**: every answer goes through a live region in one sentence, and each figure
  carries a `<title>`/`<desc>` plus a text equivalent (the classification table, or the tree as a
  nested list).
- **Touch and zoom**: 44 px targets, nothing under 13 px, text inputs at 16 px so iOS doesn't zoom
  on focus, no sideways page scroll at 320 px or 200 % zoom, nothing clipped under the WCAG
  text-spacing overrides, and `prefers-reduced-motion` honoured — including scrolling.

## Multi-viewport rules

- The page itself never scrolls sideways. Wide things (figures, tables) scroll inside their own
  container, and that container becomes keyboard-reachable **only while it actually overflows**.
- Below ~600 px of usable width the two-animal diagram is redrawn as an indented list; the
  five-animal figure keeps its size and pans, because shrinking it makes the labels unreadable.
  Both are chosen from measured width, not a user-agent guess.
- Print is a supported viewport: the print stylesheet drops the page furniture, forces the light
  palette whatever the screen theme is, and keeps the SVG vector so PDF text stays real text.

## How things are shaped

- Files: `index.html` (markup, styles, code), `data/taxonomy.js` (the tree), `data/strings.<lang>.js`
  (interface text), `data/names.<lang>.js` (translated names), `tools/` (image fetcher, single-file
  build, checks), `docs/multilingual.md`, `TODO.md`.
- `data/taxonomy.js` holds `CLADES` and `SPECIES`. Genus nodes are generated from species names,
  so adding an animal is usually one line. A taxon whose parent id is missing is reported in the
  console at startup. `tools/fetch-images.mjs` reads this same file, so the two cannot drift.
- `MILESTONES` decides which groups a reader sees by default. Add to it only for groups a
  12-year-old would recognise — everything else is compression noise.
- `FIG_STYLES` holds the figure palettes. `page` uses `var(--…)` so it follows the theme and
  prints light; the rest are literal so an exported file is predictable. Colour references inside
  the figure must come from the style object, never from a hard-coded literal.
- Words on the figure (`title`, `footer`, per-animal `names`) live in `figState`, where `null`
  means "work it out for me" and a string — even an empty one — means the person decided.

## Before you start

[TODO.md](TODO.md) lists what is outstanding, deferred or blocked, with sizes — check it before
adding something new, and move an item there rather than dropping it silently.

## Habits that have paid off here

- Look at the rendered thing. Several real bugs (labels crossed by branch lines, a title clipped
  at the frame edge, a duplicate `xmlns` that silently broke PNG export) were invisible in code
  and obvious in a screenshot.
- Test the export paths end to end, not just the happy render: a serialised SVG loses CSS
  variables, and a canvas refuses to export a tainted image.
- When compressing anything away, say so in the picture — the numbered badge on a dashed branch
  exists so the reader knows groups were skipped.
- Prefer plain words. Only the school-taught ranks are named; everything else is "group".
