# treeoflife

A single-page app for exploring the animal tree of life: type any two animals and it shows their
**most recent common ancestor (MRCA)**, both full lineages, and where the two branches meet.

Everything lives in **`index.html`** — no build step, no dependencies, no network calls.
Open the file in a browser, or serve the folder anywhere static (GitHub Pages works as-is).

```
open index.html            # macOS
xdg-open index.html        # Linux
python3 -m http.server     # or serve it
```

## What it does

- **Search two animals** by common name (`lion`, `honey bee`, `roly poly`), scientific name
  (`Panthera leo`), or nickname/alias (`grizzly`, `killer whale`, `budgie`). Autocomplete with
  keyboard navigation; higher taxa (`Felidae`, `Aves`) can be picked as endpoints too.
- **Finds the MRCA** by tracing both lineages to the root and taking the deepest shared node —
  e.g. lion + brown bear → *Carnivora*, human + octopus → *Bilateria*, orca + great white → *Gnathostomata*.
- **Draws the split**: an SVG showing the shared trunk from the root of life down to the MRCA,
  then the two lineages diverging, with approximate divergence ages on major clades.
- **Full lineages** side by side, rank by rank, shared rows highlighted.
- **Browsable tree** of the whole dataset — expand/collapse, filter, click any taxon to load it
  into slot A or B. The current selection is revealed and highlighted automatically.
- **Deep links**: the URL hash carries the pair, e.g. `index.html#a=Panthera%20leo&b=Octopus%20vulgaris`.
- Plus *Surprise me* for a random pair, *Swap*, and example pairs.

## The data

A curated, clade-based backbone of ~1,050 taxa including **343 animal species**, spanning
vertebrates, insects, arachnids, crustaceans, molluscs, echinoderms, worms, cnidarians and sponges.

Two arrays near the top of the `<script>` block define everything:

```js
// CLADES: [id, scientific name, rank, common name, parent id, approx crown age in Mya]
["carnivora","Carnivora","order","Carnivorans","ferae",55],

// SPECIES: [scientific name, common name, parent clade id, "alias|alias"]
["Panthera leo","Lion","pantherinae","lions"],
```

Genus nodes are generated automatically from the first word of each species name, so adding an
animal is usually one line in `SPECIES` pointing at an existing family or order. Taxa whose parent
id doesn't exist are reported in the browser console at startup.

Classification follows modern phylogeny, so birds sit inside the reptiles, whales inside the
even-toed ungulates, and termites inside the cockroaches. Ages are rounded consensus estimates for
the crown group, shown only for major clades — orders of magnitude, not measurements.

**Scope:** the dataset covers common and widely known animals rather than all ~1.5 million described
species, and it stops at animals (no plants, fungi or microbes below the root). An animal that isn't
in it returns "no match" instead of a wrong answer.
