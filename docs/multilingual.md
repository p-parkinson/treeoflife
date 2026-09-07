# Making it work in another language

Not built yet. This is the cheapest credible route, in the order I'd do it, keeping the
project's offline, no-dependency promise.

## What actually has to be translated

| Layer | Rough size | Difficulty |
| --- | --- | --- |
| Interface text — labels, buttons, hints, panel titles | ~120 strings | easy |
| Generated sentences — the two-animal answer, closeness, "what was happening then" | ~25 templates | needs care |
| Group names — the ~200 clades a reader can see | ~200 strings | needs a speaker who knows the subject |
| Animal common names and search aliases | ~343 + aliases | the real cost |
| Scientific names, ranks | 0 | already universal |

The insight worth keeping: **scientific names need no translation**, so a partial translation is
still a usable app. A French child with a French interface and French group names, seeing
*Panthera leo* at the leaf, is well served. That makes the layers above shippable one at a time.

## Step 1 — pull the strings out (half a day)

Replace literals with `t("id")` against a `STRINGS = { en: {...} }` object, and make every
generated sentence a **template function**, not concatenation:

```js
STRINGS.en = {
  "story.meet": ({a, b, when, group}) =>
    `Go back ${when} and you reach a single animal that is an ancestor of both the ${a} and the ${b}...`
};
```

Concatenation is what breaks first in translation: word order, gendered articles ("le lion" /
"la vache"), and plural rules all live inside the sentence. A function per sentence lets a
translator move the pieces.

Language choice: `?lang=fr` → `localStorage` → `navigator.language` → `en`, with a picker beside
the Colours switch. Set `<html lang>` from it so screen readers use the right voice.

## Step 2 — one pilot language (a day, plus a speaker)

Translate the interface and the ~200 group names into one language and ship it. Do not scale to
five languages before one has been read by someone who speaks it: the group names are where a
machine translation will quietly produce nonsense ("Amniotes", "Lobe-finned vertebrates").

## Step 3 — animal names, from Wikidata (a day)

Common names per language already exist as Wikidata property **P1843** (taxon common name).
`tools/fetch-images.mjs` already knows how to talk to the Wikimedia APIs; a sibling
`tools/fetch-names.mjs` would take the same `SPECIES` list, query
`https://www.wikidata.org/w/api.php` (or one SPARQL query for all 343), and write
`data/names.fr.json` as `{ "sp-panthera-leo": ["lion", "lion d'Afrique"] }` — committed, so
runtime stays offline. First name becomes the label, the rest become search aliases.

Budget a review pass: P1843 contains regional and informal variants, and some taxa have none.
Missing names fall back to the scientific name, which is correct rather than broken.

## Step 4 — search in the reader's language

`searchIndex` already indexes several strings per taxon, so adding the translated names and
aliases is a loop, not a redesign. Keep English and Latin indexed alongside, so a link written
by an English-speaking teacher still resolves for a French class.

## Costs and traps

- **Sentence assembly** is the main risk; templates above are the mitigation.
- **Figure text** ("they meet at…", the auto title) is generated, so it needs the same templates.
  Custom titles and names are already the teacher's own words and need nothing.
- **Right-to-left** (Arabic, Hebrew) needs `dir="rtl"` — mostly CSS logical properties — plus a
  mirrored figure: the layout is symmetric, so it's a coordinate flip, but leaf labels and the
  indented phone layout would need checking. Treat RTL as its own piece of work.
- **Font coverage**: Nunito and Fredoka cover Latin and Cyrillic but not CJK. The fallback stack
  handles it, but check that the figure's fixed styles don't force a face that lacks the script.
- **File size**: each language adds roughly 15–25 KB uncompressed. Loading them all inline would
  undermine the single-file promise past a handful; at that point split into `lang/<code>.js`
  loaded on demand, and keep a single-file build for offline use.

## What I would not do

Machine-translate at runtime (needs the network and a key, and mistranslates the exact terms
that matter), or add an i18n library (this is one object and one function).
