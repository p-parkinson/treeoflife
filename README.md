# treeoflife

A single-page app for exploring the animal tree of life, written for curious 10–15 year olds:
pick any two animals and it shows **where their family trees join** — the most recent ancestor they
share, roughly when the two branches split, and what was happening on Earth at the time.

Everything lives in **`index.html`** — no build step, no dependencies, no server.
Open the file in a browser, or serve the folder anywhere static (GitHub Pages works as-is).

```
open index.html            # macOS
xdg-open index.html        # Linux
python3 -m http.server     # or serve it
```

## What it does

- **Pick two animals** by everyday name (`lion`, `honey bee`, `roly poly`), scientific name
  (`Panthera leo`), or nickname (`grizzly`, `killer whale`, `budgie`). Autocomplete, keyboard
  navigation, and a plain-English "not in the tree yet" message when there's no match.
- **Answers in a sentence**, not a table: *"Go back about 55 million years and you reach a single
  animal that is an ancestor of both the lion and the brown bear… That is after the asteroid strike
  that finished off the big dinosaurs."* Plus a closeness badge (very close cousins → super-distant
  relatives), the split date, and how many animals in the tree belong to that group.
- **A branch diagram** that shows the milestones only — Life → Animals → Vertebrates → Mammals →
  the meeting point → each animal — with skipped rungs marked as "+3 more groups" so nothing is
  hidden dishonestly. **Show every step** switches to the complete lineage.
- **Full scientific classification** tucked behind a collapsed panel for anyone who wants the Latin.
- **A browsable tree** of the whole dataset, collapsed by default: open it to expand, filter, and click any
  group to load it into a slot.
- **A second view** for up to five animals at once — see below.
- **Shareable links** — the URL hash carries the pair, e.g. `index.html#a=Panthera%20leo&b=Octopus%20vulgaris`.
- **Two layouts.** On a laptop or tablet the two lineages fork left and right; on a phone the same
  tree is redrawn as an indented list so the names get the full width. It switches on rotation.
- Plus *Surprise me*, *Swap*, and one-click example pairs.

## The family tree of up to five animals

The second tab takes up to five animals and draws the tree that connects them all — no
sentences, no dates, just the shape: shared history down the middle, a branch point wherever
the lineages split, and each animal at the end of its own coloured branch with a photo if one
has been fetched. Dashed lines carry a small number saying how many in-between groups are not
shown, so the compression is visible rather than silent.

Branches are ordered by the tree, not by the order you typed them, which is what keeps the
lines from crossing.

**Every picture is a URL**, so it can be linked, bookmarked, put in a worksheet or screenshotted
by any tool:

```
index.html#tree=lion,brown+bear,honey+bee,octopus,emperor+penguin
index.html#tree=Panthera+leo,Ursus+arctos          # scientific names work too
index.html#tree=lion,emu&bare=1                    # just the picture: no header, no controls
```

**Getting it out of the browser:**

- **Print or save as PDF** uses the browser's own print dialog with a print stylesheet — the
  page's furniture drops away, colours are kept, and the SVG stays vector, so the text in the PDF
  is real text. A paper picker sets `@page` to A4 or A3, portrait or landscape. Chrome and Edge
  honour that; Firefox and Safari may still need the paper chosen in the dialog.
- **Download SVG** resolves the CSS custom properties to real colours first, so the file works
  anywhere, and **Download PNG** renders that at 2× through a canvas. Both are plain browser APIs,
  no library. (Downloads are blocked inside a published Claude Artifact; they work on a normal
  web host or from a local file.)

For a class set, `page.pdf({format:'A3', landscape:true})` in a short Playwright script turns a
list of those URLs into a folder of PDFs without touching the print dialog.

## Design notes

Plain words carry the page: common names lead, scientific names sit underneath, and the only ranks
named are the ones taught in school (kingdom, phylum, class, order, family, genus, species) —
everything else is simply called a "group". Ages are phrased as "about 650 million years ago" and
anchored to something a reader can picture ("back then, every animal on Earth lived in the sea").

Nature-notebook palette on soft green paper, Fredoka for headings and Nunito for text (both from
Google Fonts, with system fallbacks), and a full dark theme that follows the reader's device.

## Accessibility

Built for a classroom or a museum bench, so it is meant to work for whoever sits down at it.
Checked with axe-core (WCAG 2.1/2.2 A and AA, plus best practices): **no violations in either
light or dark theme**, and the manual parts were tested too.

- **Keyboard only:** a skip link, then the two search boxes, buttons, panels and tree — all
  reachable and operable, with a visible focus ring on everything. The suggestion list is a
  proper ARIA combobox (arrow keys, Enter, Escape, `aria-activedescendant`); the tree's expanders
  and names are real buttons, and focus stays put when the tree re-renders underneath you.
- **Screen readers:** every answer is announced in one sentence through a live region
  ("Lion and brown bear: close cousins. They meet at Carnivorans, about 55 million years ago."),
  the diagram carries a written description of the same shape, and the full classification panel
  is its text equivalent.
- **Contrast:** every colour meets 4.5:1 against its own background in both themes — checked on
  the tinted rows too, not just white.
- **Zoom and reflow:** no sideways scrolling at 320 px or at 200% zoom; nothing clips under the
  WCAG text-spacing overrides. Touch targets are at least 44 px tall, and any box that does scroll
  sideways becomes keyboard-reachable while it does.
- **Phones and tablets:** checked on iPhone SE, iPhone 13 (both orientations), iPad and Galaxy Tab —
  no sideways page scroll, text inputs at 16 px so iOS doesn't zoom on focus, and taps verified on
  the suggestion list and panels.
- **Motion:** `prefers-reduced-motion` is honoured, including the scrolling.

Known limitation: the tree explorer is a list of buttons rather than a full ARIA treeview, so a
screen-reader user tabs through it rather than using arrow keys. It is a secondary panel, closed
by default, and everything in it is reachable another way.

## Pictures for each group

`tools/fetch-images.mjs` collects one photo per milestone group from Wikimedia Commons, with the
credits each licence requires — run on your machine, results committed, so the app still makes no
network calls. See [tools/README.md](tools/README.md).

## The data

A curated, clade-based backbone of ~1,050 taxa including **343 animal species**, spanning
vertebrates, insects, arachnids, crustaceans, molluscs, echinoderms, worms, cnidarians and sponges.

Three structures near the top of the `<script>` block define everything:

```js
// CLADES: [id, scientific name, rank, common name, parent id, approx crown age in Mya]
["carnivora","Carnivora","order","Carnivorans","ferae",55],

// SPECIES: [scientific name, common name, parent clade id, "alias|alias"]
["Panthera leo","Lion","pantherinae","lions"],

// MILESTONES: the ids shown in the simplified diagram — the groups a reader would recognise
```

Genus nodes are generated automatically from the first word of each species name, so adding an
animal is usually one line in `SPECIES` pointing at an existing family or order. Any taxon whose
parent id doesn't exist is reported in the browser console at startup.

Classification follows modern phylogeny, so birds sit inside the reptiles, whales inside the
even-toed ungulates, and termites inside the cockroaches. Ages are rounded consensus estimates for
the crown group, shown only for major clades — orders of magnitude, not measurements.

**Scope:** the dataset covers common and widely known animals rather than all ~1.5 million described
species, and it stops at animals (no plants, fungi or microbes below the root). An animal that isn't
in it says so instead of guessing.

## Sources, credit and licence

**Where the data comes from.** The taxa, the groupings and the divergence dates were compiled by hand
for this project, following the modern published picture of animal phylogeny. Nothing is copied from,
or looked up live in, a taxonomic database, and the tree has not been reconciled against one — it is a
teaching model chosen for recognisability, so it stops at ~1,050 taxa and rounds every date. Treat it
accordingly, and point anyone who needs authoritative data at:

- [Open Tree of Life](https://tree.opentreeoflife.org) — synthetic phylogeny, open data
- [GBIF Backbone Taxonomy](https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c) and
  [NCBI Taxonomy](https://www.ncbi.nlm.nih.gov/taxonomy) — classification, both with public APIs
- [WoRMS](https://www.marinespecies.org) — the marine groups in particular
- [TimeTree](https://timetree.org) — divergence-time estimates of the kind the dates here approximate

Those are the right sources to wire up if you ever want the app to cover every described species rather
than a curated few hundred; the app is structured so a fetched dataset could replace the two arrays.

**Fonts.** Fredoka and Nunito, served by Google Fonts under the SIL Open Font License. The page falls
back to system fonts and works fully offline without them.

**Code.** No dependencies, no frameworks, no analytics, no network calls at runtime — nothing to
acknowledge and nothing that phones home. Suitable for a school network or an offline museum kiosk.

**Pictures.** Not bundled. `tools/fetch-images.mjs` fetches them from Wikimedia Commons and records
per-image credits; those images keep their own licences (usually CC BY or CC BY-SA) and must be
credited wherever they appear. See [tools/README.md](tools/README.md).

**This repository** is released under [CC0 1.0](LICENSE) — public domain dedication. Reuse the app,
the data file, or the tooling in a classroom, a museum, or anything else without asking. That covers
this project's own content only: fonts and any fetched images keep their own terms.
