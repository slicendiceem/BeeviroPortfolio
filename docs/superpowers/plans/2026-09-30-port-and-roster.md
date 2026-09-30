# Port and Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move five shipped features out of the generated embed and back into
`site/`, then trim the client roster from 25 to 20 in a named order — so that
`build-embed.mjs` can be run again without deleting work.

**Architecture:** The embed is generated from `site/` but has been hand-edited
until it holds features with no source. Rather than diff 727KB of generated
output by eye, Task 1 freezes today's embed in git as the reference and builds
`tools/embed-diff.mjs`, which reports feature markers, media entries, client
slugs and module list across two embeds. Every later task is then a red/green
cycle: the diff names a missing feature, the task ports it, the diff goes quiet.
The roster change lands last, when the rebuild is already trustworthy.

**Tech Stack:** Plain ES2019 browser JavaScript, modern Node ESM for tooling, no
dependencies, no build step, no test framework. Verification is
`tools/embed-diff.mjs`, `node --check`, `tools/check.mjs` (headless Chrome over
CDP) and `tools/audit-light.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-30-roster-and-media-refresh-design.md`

## Global Constraints

- Site JavaScript is **plain ES2019**: `var` and `function` only — no arrow
  functions, no `const`/`let`, no template literals, no optional chaining. It
  must run from `file://`. Tooling under `tools/` and at the repo root is modern
  Node ESM and carries no such limit.
- **No dependencies, no build step.** There is no `package.json` and none is to
  be added. Image work goes through Chromium, as the existing tools do.
- **Never hand-edit** `beeviro-embed.html`, `split/*`, `site/js/media-map.js` or
  `site/js/thumb-map.js`. All four are generated. Restoring this rule is the
  point of the plan; from Task 2 onward every change goes into `site/`.
- **No new JS modules.** `build-embed.mjs:127` inlines a hardcoded list of nine
  and `site/index.html` names the same nine in the same order.
- `site/` is the only deployable root.
- **REDACTION RULE.** Nothing published may carry competitor names or teardowns,
  internal media budgets, unpublished projections, phone numbers or personal
  handles. `sources/` must never ship.
- **EDITORIAL RULE.** `outcome.kind: 'result'` only where the figure appears in
  the client-approved document. Never promote a `goal` to a `result` without a
  source. Never add a metric without a `note`.
- Anchor every edit on unique surrounding text, never on line numbers.
- Record removals must not delete files under `site/assets/`.

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has a
test in the task that owns the code.

1. **A `BV_ORDER` slug with no record** — `hadeel-maqlad` is in the list today
   with nothing behind it. Must sort harmlessly, never throw. *(Task 8)*
2. **A client with no `BV_CARD_LOGOS` entry** — `revenuelab360` and `tamahwour`
   have none. Their cards must fall back to gallery art, not render an empty
   plate. *(Task 4)*
3. **Arabic missing for a ported feature** — an RTL reader must not get English
   strings or a broken layout in the services or testimonials sections.
   *(Task 3)*
4. **Running from `file://`** — a constraint the whole site carries; a ported
   module that assumes a server breaks it silently. *(Task 9)*
5. **A reel whose client was removed** — `volt-ems.webm` and
   `dar-al-hadith.webm` stay on disk but leave the roster. The hero comb must
   not 404 or leave a dead cell. *(Task 8)*

---

### Task 1: Freeze the reference, build the comparison harness

**Files:**
- Modify: `beeviro-embed.html` (commit as-is; no edits)
- Create: `tools/embed-diff.mjs`, `tools/verify-port.mjs`

**Interfaces:**
- Produces: `node tools/embed-diff.mjs <ref.html> <cand.html> [--expect-clients N] [--json]`.
  Exits 0 when no tracked marker regressed, 1 otherwise, printing the regressed
  markers. This is the *structural* test.
- Produces: `node tools/verify-port.mjs [--only <name>] [--lang ar] [--url …]`,
  a browser-driven check registry following the shape of `tools/flow.mjs` —
  spawn Chrome, drive over CDP, assert, report, exit non-zero on failure. Task 1
  ships it with an empty registry; **each later task adds its own named check**.
  This is the *behavioural* test.

**Serving:** every browser-driven tool defaults to `http://localhost:4173/`.
Serve `site/` there before running them:

```bash
(cd site && python3 -m http.server 4173 >/dev/null 2>&1 &)
```

- [ ] **Step 1: Commit the current embed unchanged as the reference**

It carries uncommitted work from several sessions — the merged redesign, the
Cairo font, the mobile hero, the language-toggle fix. It becomes the thing every
rebuild is measured against, so it must be in history before anything moves.

```bash
git add beeviro-embed.html
git commit -m "chore: freeze the hand-merged embed as the port reference"
git tag port-reference
```

The tag is how Task 9 finds this commit. Do not skip it — counting back with
`HEAD~n` breaks the moment a task commits twice.

- [ ] **Step 2: Write `tools/embed-diff.mjs`**

Reports across two embed files and exits non-zero on regression:

| dimension | how it is counted |
|---|---|
| feature markers | occurrences of `bv-service-`, `bv-testi`, `BV_TESTIMONIALS`, `BV_CARD_LOGOS`, `bv-card--logo`, `bv-filter-bar`, `workStatus`, `shalaby-labs`, `font-family: 'Cairo'` |
| media entries | `'…': '…'` pairs inside `BV_MEDIA = {…}` |
| client slugs | the set matched by `slug: '([a-z0-9-]+)'` |
| inlined modules | the `/* ==== js/x.js ==== */` banners, in order |
| i18n keys | key count in each of the EN and AR dictionaries |

A marker regresses when its candidate count is lower than the reference count.
`--expect-clients N` asserts the candidate's slug-set size instead of comparing
it, for Task 8 where a drop is intended. `--json` prints the raw report.

- [ ] **Step 3: Run it against the reference and a fresh build — expect failure**

```bash
mkdir -p /tmp/portcheck/site /tmp/portcheck/split && cp build-embed.mjs /tmp/portcheck/ \
  && cp -r site/js site/css site/index.html /tmp/portcheck/site/ \
  && mkdir -p /tmp/portcheck/site/assets/fonts \
  && cp site/assets/fonts/Aclonica-Regular.ttf /tmp/portcheck/site/assets/fonts/ \
  && (cd /tmp/portcheck && node build-embed.mjs >/dev/null)
node tools/embed-diff.mjs beeviro-embed.html /tmp/portcheck/beeviro-embed.html
```

Expected: exit 1, naming all nine feature markers as regressed to 0 (or near
it), because `site/` has none of them. This is the failing test the next six
tasks turn green.

- [ ] **Step 4: Write `tools/verify-port.mjs` with an empty registry**

A `CHECKS` map of name → async function receiving a CDP session, plus `--only`
to run one. With nothing registered it must exit 0 and print "0 checks". Later
tasks register into this map rather than writing their own drivers.

- [ ] **Step 5: Commit**

```bash
git add tools/embed-diff.mjs tools/verify-port.mjs
git commit -m "test: harnesses that compare a rebuilt embed and drive the ported page"
```

---

### Task 2: Port the services section

**Files:**
- Modify: `site/css/beeviro.css`, `site/js/beeviro.js`, `site/index.html`
- Reference: `beeviro-embed.html` — CSS around lines 1854–1980, markup and
  builder inside the `js/beeviro.js` block from line 5054

**Interfaces:**
- Consumes: `tools/embed-diff.mjs` from Task 1.
- Produces: the `.bv-service-*` class family and its tab builder. Task 7 restyles
  `.bv-service-title` for Arabic and needs that selector to exist.

- [ ] **Step 1: Run the diff to confirm `bv-service-` is at 0 in a fresh build**

Run the Task 1 Step 3 command. Expected: `bv-service-` reported 51 → 0.

- [ ] **Step 2: Port the styles into `site/css/beeviro.css`**

Every `.bv-service-*` rule from the embed, including the `@media(max-width:760px)`
and `prefers-reduced-motion` blocks. Keep the embed's rule order — the tab
`::before` animation depends on it.

- [ ] **Step 3: Port the builder into `site/js/beeviro.js`**

The tab list, panel and `bv-service-title` construction, ES2019 only. It reads
service copy from the existing client records; do not introduce a new data
global.

- [ ] **Step 4: Port the section markup into `site/index.html`**

In the same document position it occupies in the embed, between the work grid
and what follows it.

- [ ] **Step 5: Verify**

```bash
node --check site/js/beeviro.js
```
Then rebuild and diff as in Task 1 Step 3. Expected: `bv-service-` no longer
regressed; the other eight markers still are.

- [ ] **Step 6: Commit**

```bash
git add site/css/beeviro.css site/js/beeviro.js site/index.html
git commit -m "feat: restore the services section to site/"
```

---

### Task 3: Port the testimonials

**Files:**
- Modify: `site/css/beeviro.css`, `site/js/beeviro.js`, `site/js/i18n.js`, `site/index.html`
- Reference: `beeviro-embed.html` — `BV_TESTIMONIALS` and the builder inside the
  `js/beeviro.js` block, styles near line 2048

**Interfaces:**
- Consumes: `tools/embed-diff.mjs`.
- Produces: `window.BV_TESTIMONIALS`, an array of `{ src, secs, poster }`. No
  `name` or `role` fields — the films carry their own lower-thirds, and the page
  must not make claims about real people on their behalf.

- [ ] **Step 1: Run the diff — expect `bv-testi` and `BV_TESTIMONIALS` at 0**

- [ ] **Step 2: Add the five i18n keys to `site/js/i18n.js`**

`testi.eyebrow`, `testi.h2`, `testi.lede`, `testi.play`, `testi.n` — in both
dictionaries, copied verbatim from the embed. `testi.n` is `'testimonial {i}'`
in English and `'الشهادة {i}'` in Arabic.

- [ ] **Step 3: Port `BV_TESTIMONIALS` and the builder into `site/js/beeviro.js`**

One `<video>` element with `preload='none'`, reused across all three; a rail of
three `role="tab"` buttons with arrow-key navigation; `show(i, andPlay)` swaps
`src` and `poster`. Pause on IntersectionObserver exit and on `bv:cover`.

- [ ] **Step 4: Port the styles and the section markup**

Markup goes directly after the work grid, which is where the client asked for
it.

- [ ] **Step 5 (Review Focus 3): Register `testimonials-arabic` in `tools/verify-port.mjs`**

Asserts the section is `dir=rtl`, its rail labels read `01 / 02 / 03`, the play
label is `تشغيل الشهادة 1`, and no text node inside the section matches
`/[A-Za-z]{4,}/` — durations are digits and a colon, so any Latin word is
leakage.

```bash
node tools/verify-port.mjs --only testimonials-arabic --lang ar
```
Expected: PASS. Run it before Step 3 to watch it fail.

- [ ] **Step 6: Verify and commit**

```bash
node --check site/js/beeviro.js site/js/i18n.js
git add site/css/beeviro.css site/js/beeviro.js site/js/i18n.js site/index.html
git commit -m "feat: restore the testimonials section to site/"
```

---

### Task 4: Port logo-first cards and adaptive fitting

**Files:**
- Modify: `site/js/beeviro.js`, `site/js/hive.js`, `site/css/beeviro.css`
- Reference: `beeviro-embed.html:5523` for `BV_CARD_LOGOS`, `:5561` for the card
  swap, `:7622` for the comb cell, grading near `:2026`

**Interfaces:**
- Consumes: `tools/embed-diff.mjs`.
- Produces: `window.BV_CARD_LOGOS`, a map of slug → absolute CDN URL, and
  `gradeLogo(img)`, which toggles `bv-card--wide` on the card when the logo's
  aspect ratio would lose more than 25% of the image to `cover` cropping.

- [ ] **Step 1: Run the diff — expect `BV_CARD_LOGOS` and `bv-card--logo` at 0**

- [ ] **Step 2: Port `BV_CARD_LOGOS` into `site/js/beeviro.js`**

Eighteen entries. Drop `volt-ems` and `moamen-medhat`: both clients leave the
roster in Task 8, and a logo for a client with no record is dead weight.

- [ ] **Step 3: Port the grading and its CSS**

```js
var FRAME_RATIO = 372 / 416;
var MAX_CROP = 0.25;
```
`gradeLogo` computes the fraction lost against `FRAME_RATIO` and toggles
`bv-card--wide`; a delegated capture-phase `load` listener grades images that
arrive later. CSS gives `.bv-card--logo .bv-card__plate img` `object-fit: cover`
with no padding, and the `--wide` variant `contain` with `14% 9%`.

- [ ] **Step 4: Port the comb cell preference into `site/js/hive.js`**

A cell prefers the brand mark when one exists for that slug.

- [ ] **Step 5 (Review Focus 2): Register `logo-fallback` in `tools/verify-port.mjs`**

`revenuelab360` and `tamahwour` have no entry. Asserts their cards carry neither
`bv-card--logo` nor `bv-card--wide`, and that the image they do render reports a
non-zero `naturalWidth` — an empty plate and a broken image both look like a
styling choice from a screenshot.

```bash
node tools/verify-port.mjs --only logo-fallback
```

- [ ] **Step 6: Verify and commit**

```bash
node --check site/js/beeviro.js site/js/hive.js
git add site/js/beeviro.js site/js/hive.js site/css/beeviro.css
git commit -m "feat: restore logo-first work cards and adaptive fitting"
```

---

### Task 5: Port the work filter and search

**Files:**
- Modify: `site/js/beeviro.js`, `site/css/beeviro.css`, `site/index.html`
- Reference: `beeviro-embed.html` — `bv-filter-bar` near line 1854, `workStatus`
  near 5609

**Interfaces:**
- Consumes: the grid built in `site/js/beeviro.js`. The filter narrows that grid
  in place and **must not re-sort it** — ordering belongs to `BV_ORDER`, which
  Task 8 rewrites. A filter that sorts would silently undo the client's
  requested order.
- Produces: the `#workStatus` live region announcing result counts.

- [ ] **Step 1: Run the diff — expect `bv-filter-bar` and `workStatus` at 0**

- [ ] **Step 2: Port the filter bar markup, styles and behaviour**

Industry `<select>` built from the distinct `industry` values on the records,
plus a brand-name text input. Both narrow the same grid. `#workStatus` is
`aria-live` and reports how many cards match.

- [ ] **Step 3: Register `filter-empty-result` in `tools/verify-port.mjs`**

Types a brand query matching nothing. Asserts the grid renders zero cards,
`#workStatus` announces zero rather than going silent, no console error is
raised, and clearing the query restores all twenty cards **in `BV_ORDER`
order** — the regression that would prove the filter re-sorts.

```bash
node tools/verify-port.mjs --only filter-empty-result
```

- [ ] **Step 4: Verify and commit**

```bash
node --check site/js/beeviro.js
git add site/js/beeviro.js site/css/beeviro.css site/index.html
git commit -m "feat: restore the work filter and brand search"
```

---

### Task 6: Port the Shalaby Labs case file

**Files:**
- Modify: `site/js/clients.js`, `site/js/clients.ar.js`
- Reference: `beeviro-embed.html` — the record in the `js/clients.js` block, the
  overlay in `js/clients.ar.js`

**Interfaces:**
- Produces: a record with `slug: 'shalaby-labs'`, `accent: '#38b9c6'`,
  `work: 10`, and `outcome.headline` `'16.9K conversations · 9.86s average reply'`.

- [ ] **Step 1: Run the diff — expect `shalaby-labs` at 0**

- [ ] **Step 2: Port the English record into `site/js/clients.js`**

Copy verbatim, including the comment recording that shalabylabs.com is the
client's own site and must never be linked or presented as our work.

- [ ] **Step 3: Port the Arabic overlay into `site/js/clients.ar.js`**

- [ ] **Step 4: Verify the ten media paths already resolve**

```bash
node tools/audit-light.mjs
```
Expected: no `assets/work/shalaby-labs/*` reported as missing from
`media-map.js`. The spec records `BV_MEDIA` as already in sync at 572 against
574, so this should pass without touching the generated map. If it does not,
stop — that is a generated-file problem, not a porting one.

- [ ] **Step 5: Commit**

```bash
git add site/js/clients.js site/js/clients.ar.js
git commit -m "feat: restore the Shalaby Labs case file to site/"
```

---

### Task 7: Port the Cairo face, the RTL font stacks and the two fixes

**Files:**
- Modify: `site/css/beeviro.css`, `site/js/i18n.js`
- Reference: `beeviro-embed.html` — `@font-face` blocks near line 41, RTL
  variables near 1529, mobile hero near 1218, toggle handler near 4994

**Interfaces:**
- Produces: `--display-ar` and `--body-ar` leading with Cairo, and a
  `html[dir="rtl"]` block redefining `--display`, `--body` and `--mono`.

- [ ] **Step 1: Port the two Cairo `@font-face` blocks**

One variable face, weights 400–700, split Arabic and Latin behind
`unicode-range` exactly as in the embed, both as `data:font/woff2;base64` URIs.
SIL OFL 1.1.

- [ ] **Step 2: Port the Arabic stacks and the variable redefinition**

Aclonica stays ahead of Cairo in `--display-ar`: it carries no Arabic glyph, so
Arabic falls through to Cairo while Latin inside Arabic headings keeps the
display face. Then:

```css
html[dir="rtl"] { --display: var(--display-ar); --body: var(--body-ar); --mono: var(--body-ar); }
```
This reaches elements that ask for a font directly, which naming forty class
names did not. Also zero `letter-spacing` and `text-transform` for
`.bv-card__tag`, `.bv-cell__t` and `.bv-service-title` in RTL — tracking breaks a
connected script.

- [ ] **Step 3: Port the mobile hero rebalance**

Inside `@media (max-width: 1099.98px)`: the hero gets `justify-content: flex-end`,
`padding-top: 92px`, `padding-bottom: max(34px, env(safe-area-inset-bottom))`;
the comb mask fades in from `transparent 0%` rather than a hard edge.

- [ ] **Step 4: Port the language-toggle fix into `site/js/i18n.js`**

Strip `lang=` from the fragment as well as the query; drop the fragment when the
element it names is off screen; and reload explicitly, because
`location.replace()` to a URL differing only after the `#` is a same-document
navigation that changes nothing.

- [ ] **Step 5: Register `lang-toggle-shapes` in `tools/verify-port.mjs`**

Six cases, each loading a URL, clicking `[data-lang-toggle]` and asserting
`document.documentElement.lang` flipped:

| start URL | expected after the click |
|---|---|
| clean | language flips |
| `#work` | flips, `#work` kept |
| `?lang=ar` | flips, query stripped |
| `#lang=ar` | flips, fragment stripped |
| `#work`, scrolled to top | flips, fragment **dropped**, stays at top |
| `#work`, scrolled to the work section | flips, fragment kept, stays there |

Plus one non-toggle case: a fresh `#lang=ar` with empty storage still loads
Arabic, proving the share link survived the fix.

```bash
node tools/verify-port.mjs --only lang-toggle-shapes
```

- [ ] **Step 6: Commit**

```bash
node --check site/js/i18n.js
git add site/css/beeviro.css site/js/i18n.js
git commit -m "feat: restore Cairo, the RTL stacks, the mobile hero and the toggle fix"
```

---

### Task 8: Trim and reorder the roster

**Files:**
- Modify: `site/js/clients.js`, `site/js/clients.ar.js`, `site/index.html`
- Reference: spec Part 2

**Interfaces:**
- Consumes: every ported feature above — the grid this reorders is the one
  Task 5 filters and Task 4 gives logos to.
- Produces: `window.BV_ORDER`, twenty slugs, consumed by `site/js/beeviro.js:12`.

- [ ] **Step 1: Remove five records from `clients.js` and their Arabic overlays**

`volt-ems`, `dr-eman`, `moamen-medhat`, `sheikh-hosney`, `dar-al-hadith`.
**Delete no files under `site/assets/`** — `dar-al-hadith.webm` and
`volt-ems.webm` stay on disk.

- [ ] **Step 2: Replace `BV_ORDER` with the twenty**

```js
window.BV_ORDER = [
  'revenuelab360', 'cognistar', 'master-craft', 'kinetic-health', 'tamahwour',
  'qr-tably', 'daily-box', 'edara-plus', 'moaafa', 'electro-master',
  'eqbal', 'block-star', 'speakup', 'izar', 'renda-perfumes',
  'rojana', 'rinos-kitchen', 'freestyle', 'kirin', 'shalaby-labs',
];
```
This also corrects `black-star` → `block-star`, the typo behind that client's
404ing dossier images, and drops `hadeel-maqlad`, which has no record.

- [ ] **Step 3: Update the two hardcoded counts**

`24 client journeys` in the meta description and `رحلات 24 عميلًا` in the Arabic
one both become 20.

- [ ] **Step 4 (Review Focus 1): Register `order-unknown-slug` in `tools/verify-port.mjs`**

Injects a slug with no record into `BV_ORDER` before the grid builds, then
asserts twenty cards still render and no console error is raised — the sort must
put unknowns last rather than throwing. `hadeel-maqlad` sat in that list for
months, so this is a regression guard, not a hypothetical.

```bash
node tools/verify-port.mjs --only order-unknown-slug
```

- [ ] **Step 5 (Review Focus 5): Register `no-orphan-reels` in `tools/verify-port.mjs`**

`volt-ems.webm` and `dar-al-hadith.webm` stay on disk but leave the roster.
Asserts, from the network log, that neither is requested, that the hero comb
renders a full set of cells with no empty one, and that no response in the trace
has status 404.

```bash
node tools/verify-port.mjs --only no-orphan-reels
```

- [ ] **Step 6: Verify the shape**

```bash
node --check site/js/clients.js site/js/clients.ar.js
node tools/embed-diff.mjs beeviro-embed.html /tmp/portcheck/beeviro-embed.html --expect-clients 20
```
Expected: exit 0. No feature marker regressed, and the candidate holds exactly
twenty client slugs.

- [ ] **Step 7: Commit**

```bash
git add site/js/clients.js site/js/clients.ar.js site/index.html
git commit -m "feat: trim the roster to twenty clients in the requested order"
```

---

### Task 9: Rebuild, verify end to end, ship

**Files:**
- Modify: `beeviro-embed.html`, `split/1-head-css.html`, `split/2-body-html.html`,
  `split/3-footer-js.html` — all four written by `build-embed.mjs`, never by hand

- [ ] **Step 1: Rebuild for real**

```bash
node build-embed.mjs
```

- [ ] **Step 2: Diff the real rebuild against the frozen reference**

```bash
git show port-reference:beeviro-embed.html > /tmp/ref.html
node tools/embed-diff.mjs /tmp/ref.html beeviro-embed.html --expect-clients 20
```
Expected: exit 0 — no feature marker regressed against the frozen reference, and
exactly twenty client slugs. This is the moment the port is proven: a file
generated from `site/` alone now carries everything the hand-edited one did.

- [ ] **Step 3 (Review Focus 4): Assert the site still runs from `file://`**

```bash
node tools/check.mjs --url file://$PWD/site/index.html
```
Expected: the grid renders, no module throws, no request is made to a
`http(s)://localhost` origin. This is a standing constraint and the port touched
five modules.

- [ ] **Step 4: Run the full verification sweep**

```bash
node tools/verify-port.mjs
node tools/verify-port.mjs --lang ar
node tools/check.mjs --url http://localhost:4173/
node tools/check.mjs --lang ar --url http://localhost:4173/
node tools/audit-light.mjs
node tools/bidi.mjs
```
The first two run every check the six porting tasks registered, together, for
the first time.
Expected: twenty cards in the requested order in both languages; services,
testimonials, logo cards and the filter all present; no light copy unwired; no
new bidi finding.

- [ ] **Step 5: Confirm the ES2019 floor held**

```bash
node -e '
const fs=require("fs"),s=fs.readFileSync("beeviro-embed.html","utf8");
const js=[...s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(m=>!/src=|ld\+json/.test(m[1])).map(m=>m[2]).join("\n")
  .replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
const bad={arrow:/=>/g,"const/let":/(?<![\w.])(const|let)\s+[A-Za-z_$]/g,
  template:/`/g,optchain:/\?\./g};
let fail=0;
for(const k in bad){const n=(js.match(bad[k])||[]).length;
  console.log(k,n); if(n)fail=1;}
process.exit(fail);'
```
Expected: every count 0, exit 0. Comments are stripped first — the prose in this
codebase contains the word "let" and backtick-quoted identifiers, which a naive
grep reports as violations.

- [ ] **Step 6: Commit**

```bash
git add beeviro-embed.html split/
git commit -m "build: regenerate the embed from a site/ that finally holds everything"
```

---

## What this plan does not cover

Part 3 of the spec — the media refresh for fourteen clients from twenty-six
Drive folders — is a separate plan, written once this one lands. Its task
shapes depend on facts only enumeration can supply: how many files each folder
holds, what clustering threshold separates near-duplicates from distinct
designs, and how many composites each client ends up with. Writing those tasks
now would be inventing numbers.

Two things from the spec's risk list must be settled before that plan is
written:

- `stage-upload.mjs` opens with an `rmSync` and re-flattens all 585 shipped
  assets. Uploading that wholesale would duplicate the entire library. An
  incremental path — diff the new manifest against the harvested ids, stage only
  what is new — is a prerequisite, not a detail.
- The Drive folders are world-readable today and nothing guarantees they stay
  that way. Enumerate and fetch early; keep the raw files until the work ships.
