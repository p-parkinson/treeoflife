# Working on this project

A single-page app that shows how any two — or up to five — animals are related on the tree of
life, written for 10–15 year olds and meant to survive a school network or a museum bench.
Read this before changing `index.html`.

## What must stay true

1. **One file, no dependencies, no network at runtime.** `index.html` carries the markup, the
   styles, the data and the code. No frameworks, no bundler, no CDN scripts, no analytics, no API
   calls. It has to work opened from a USB stick (`file://`) with the wifi off. The only external
   request is the Google Fonts stylesheet, and the page is fully usable when it fails.
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

## The accessibility bar

Not aspirational — it is checked. `node tools/check.mjs` must pass before pushing
(needs `npm i -D playwright axe-core`; see `tools/README.md`).

- **axe-core, WCAG 2.1/2.2 A + AA + best practice: zero violations**, on both views × light and
  dark × desktop and phone.
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

- `CLADES` / `SPECIES` near the top of the script are the data. Genus nodes are generated from
  species names, so adding an animal is usually one line. A taxon whose parent id is missing is
  reported in the console at startup.
- `MILESTONES` decides which groups a reader sees by default. Add to it only for groups a
  12-year-old would recognise — everything else is compression noise.
- `FIG_STYLES` holds the figure palettes. `page` uses `var(--…)` so it follows the theme and
  prints light; the rest are literal so an exported file is predictable. Colour references inside
  the figure must come from the style object, never from a hard-coded literal.
- Words on the figure (`title`, `footer`, per-animal `names`) live in `figState`, where `null`
  means "work it out for me" and a string — even an empty one — means the person decided.

## Habits that have paid off here

- Look at the rendered thing. Several real bugs (labels crossed by branch lines, a title clipped
  at the frame edge, a duplicate `xmlns` that silently broke PNG export) were invisible in code
  and obvious in a screenshot.
- Test the export paths end to end, not just the happy render: a serialised SVG loses CSS
  variables, and a canvas refuses to export a tainted image.
- When compressing anything away, say so in the picture — the numbered badge on a dashed branch
  exists so the reader knows groups were skipped.
- Prefer plain words. Only the school-taught ranks are named; everything else is "group".
