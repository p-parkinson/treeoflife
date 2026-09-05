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
- **Shareable links** — the URL hash carries the pair, e.g. `index.html#a=Panthera%20leo&b=Octopus%20vulgaris`.
- Plus *Surprise me*, *Swap*, and one-click example pairs.

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
  WCAG text-spacing overrides. Touch targets are at least 44 px tall.
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
