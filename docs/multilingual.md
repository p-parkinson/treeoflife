# Making it work in another language

**Steps 1 and 2 are built**: the interface, the generated sentences, and a first-draft French
translation with 124 group names and 298 animal names. Step 3 (names from Wikidata) and step 4
(searching in the reader's language — partly done, see below) are the remaining work.

This is the route, in the order it is worth doing, keeping the project's offline,
no-dependency promise.

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

## How it works now

```
data/strings.en.js    the reference: every id the app can ask for
data/strings.<lang>.js   one file per language, partial is fine
data/names.<lang>.js  names for groups (by clade id) and animals (by "sp-<slug>")
```

- `t("id", {vars})` looks up the current language, falls back to English, and warns in the console
  if an id is missing everywhere. `tools/check.mjs` turns that into a failing check.
- Sentences are **functions**, so a translator controls word order:
  `"fig.titleTwo": v => "De " + v.a + " à " + v.b`.
- Markup carries `data-i18n` / `data-i18n-ph` / `data-i18n-al`; `applyStrings()` fills them in and
  is re-run when the language changes.
- `label(node)` prefers `data/names.<lang>.js`, then the English common name, then the scientific
  name — so partial coverage degrades to something correct rather than blank.
- The search index contains **every** shipped language's names at once, so links survive a
  language change and a bilingual classroom can type in either.
- Language comes from `#…&lang=xx`, then `localStorage`, then `navigator.language`, then English.
  `<html lang>` is set so screen readers switch voice.

### Adding a language

1. Copy `data/strings.en.js` to `data/strings.<code>.js`, translate the values, keep the ids, and
   set `lang.name` plus a `foot.translation` note while it is unreviewed.
2. Optionally add `data/names.<code>.js` — group ids first (they appear in every figure), animals
   second.
3. Add two `<script src>` tags in `index.html` next to the others. That is the whole wiring.
4. Run `node tools/check.mjs`: it reports coverage per language and fails if the page throws or a
   string is missing everywhere.

## Step 1 — pull the strings out (done)

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

## Step 2 — one pilot language (done for French, still needs a speaker)

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

## Step 4 — search in the reader's language (done)

Done: `searchIndex` indexes the translated names and aliases of every shipped language alongside
English and the scientific names, so a link written by an English-speaking teacher still resolves
for a French class, and vice versa.

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
