# Beeviro Portfolio

An interactive portfolio for **Beeviro LLC**, a digital marketing agency working across
Egypt and the Gulf. 25 clients, each shown as a full journey from first contact to
outcome, with the real design work and campaign numbers attached.

Revenue Lab 360 appears here as one of the 25 — it is both a Beeviro product and a
Beeviro client.

---

## Run it

```bash
node beeviro-portfolio/serve.mjs
```

Then open <http://localhost:4173>.

The server binds `0.0.0.0` and prints your **LAN address** on start, so you can open the
same site on a phone on the same wifi — the mobile layout is a first-class design, not a
shrunk desktop, and is worth checking on real glass. Use `PORT=4174 node ...` for a
different port.

No build step and no external request: fonts, images, CSS and JS are all local. Assets
are cached for a day while HTML/CSS/JS are sent `no-cache`, so an edit shows on reload.
Range requests are supported, so large assets and any hero video can be scrubbed. It
also opens straight from `file://`.

**Deploy `site/` only.** Everything else in this repo is source material.

---

## Layout

```
beeviro-portfolio/
├─ site/                    ← the deployable site
│  ├─ index.html
│  ├─ css/beeviro.css
│  ├─ js/perf.js            ← motion tier; MUST load first (see revision pass)
│  ├─ js/lang.js            ← language + direction, decided in <head>
│  ├─ js/media-map.js       ← generated: site path -> GHL media id
│  ├─ js/thumb-map.js       ← generated: heavy original -> light display copy
│  ├─ js/clients.js         ← all client copy + journeys + metrics
│  ├─ js/clients.ar.js      ← Arabic overlay; only fetched when lang is ar
│  ├─ js/i18n.js            ← strings; merges the Arabic overlay by slug
│  ├─ js/beeviro.js         ← behaviour
│  ├─ js/motion.js          ← scroll + motion layer (deletable)
│  ├─ js/hive.js            ← the revolving hero comb
│  └─ assets/
│     ├─ hero/reels/*.webm       ← 6 real client reels, 420px, 2.0 MB
│     ├─ hero/reels/small/       ← generated 288px copies, 0.63 MB  ← SHIPPED
│     ├─ work/<slug>/NN.jpg      ← 181 curated deliverables (~28 MB)
│     ├─ work/<slug>/thumb/*.webp ← generated 480px, cards + tiles   ← SHIPPED
│     ├─ work/<slug>/cell/*.webp  ← generated 200px, hero comb       ← SHIPPED
│     ├─ light/*.webp            ← generated brand marks + hero photo ← SHIPPED
│     ├─ logos/                  ← originals, kept as the fallback
│     ├─ og/beeviro-og.jpg       ← 1200×630 social card
│     └─ fonts/Aclonica-Regular.ttf
├─ tools/                   ← build + verification scripts (headless Chrome)
├─ sources/                 ← ⚠ NOT FOR PUBLICATION (see below)
├─ inspiration/
├─ infosource/
└─ serve.mjs
```

The six reels that play in the hero comb are named in `REELS` at the top of
`site/js/hive.js`. Every slug listed there needs a 288px copy in
`assets/hero/reels/small/` — run `node tools/shrink-reels.mjs` after changing the
list, or the comb streams the full 420px file into a 116px hexagon.

Script order in `index.html` is load-bearing: `perf.js` first (it decides how much
motion gets BUILT), then the data files, then `i18n.js` (it merges the Arabic
records in place), then `beeviro.js`, which renders from the result.

To edit copy, numbers or journeys, edit **`site/js/clients.js`**, and its Arabic in
**`site/js/clients.ar.js`** — an untranslated field falls back to the English rather
than to an empty box. To change how many gallery images a client shows, change its
`work` count, add matching files to `site/assets/work/<slug>/`, and re-run
`node tools/make-thumbs.mjs`.

The order the clients appear in is **`window.BV_ORDER`** at the top of
`site/js/clients.js` — a list of slugs. The work grid shows six cards before
"Show more work", so the first six entries are what a visitor sees without
scrolling. A slug left out of the list still renders; it sorts after everything
listed.

---

## The editorial rule

Every client record carries `outcome.kind`:

- **`result`** — the figure is published in the client-approved portfolio document.
  Rendered as a solid yellow *"Delivered result"* badge.
- **`goal`** — the strategy set this as a target. Rendered as an outlined
  *"Strategy target"* badge, and the case file says in plain words that it is not a
  reported result.

Currently **7 clients carry delivered results, 18 carry targets.** Only SpeakUp,
Freestyle and Izar have hard performance numbers; the rest are identity, strategy or
production engagements. Do not promote a `goal` to a `result` without a source — the
honesty is the differentiator against every other agency portfolio.

Every metric card flips to show *where the number came from*. Never add a metric
without a `note`.

---

## Building for the website builder

GoHighLevel wants one pasteable block, not a folder:

```bash
node build-embed.mjs
```

That writes **`beeviro-embed.html`** (~450 KB, self-contained) plus a three-way
**`split/`** for builders that expose separate slots:

| File | Paste into |
|---|---|
| `split/1-head-css.html` | head / custom CSS |
| `split/2-body-html.html` | the page body |
| `split/3-footer-js.html` | footer / custom JS |

What the build does:

- Inlines the CSS and all nine scripts **in load order** — perf, media-map, thumb-map,
  clients, clients.ar, i18n, beeviro, motion, hive. Order matters: `perf` must be first
  because it decides how much motion is BUILT; `i18n` must sit after both data files and
  before `beeviro`, because it merges the Arabic records in place; and `hive` is last
  because it calls `window.BV_ASSET`, `window.BV_THUMB` and `window.BV_OPEN_CASE`.
- Stamps `window.BV_EMBED = true` at the top of the bundle. `thumb()` reads it to know
  that nothing is served locally here, so an unmapped thumbnail path is a 404 and it must
  fall back to the full-size CDN image instead.
- Inlines the **Aclonica webfont as a data URI**. It is the only asset that has to travel
  inside the file — a relative font path cannot resolve once pasted into GHL.
- Rewrites every remaining asset path to its **GHL CDN URL**, including the
  `var(--hero-wide)` / `var(--hero-tall)` fallbacks in CSS, and warns about anything
  missing from the media map.
- Drops `<head>` — GHL owns the title, meta and favicon.

Verified in a browser from the bundled file: **0 requests to local `assets/`**, 26 to the
CDN, font loaded, 0 broken images, 5 reels playing, and cards, hero cells, the shelf and
the lightbox all working.

**Rebuild after any change to `site/`** — the embed is generated, so edits made directly
to `beeviro-embed.html` are destroyed on the next run.

---

## Hosting the media on GHL

All 196 shipped media files live in the **demo cairo** sub-account
(`PWyhncZ0y766gD1TL1PO`), folder **Beeviro Portfolio**. `site/js/media-map.js` maps each
site-relative path to its media id; `media()` in `beeviro.js` resolves through it, and
`window.BV_ASSET` gives `hive.js` the same table. **Anything not in the map falls back to
the local path**, so the site still runs from `site/` with no map at all.

To redo it after adding assets:

```bash
node stage-upload.mjs
```

That flattens everything into `upload-staging/` under unique names with a manifest.
Upload that folder's contents into the GHL folder, harvest the ids, then:

```bash
node gen-media-map.mjs
```

### Traps that cost real time here

- **GHL keeps no folder in the URL** — it is
  `assets.cdn.filesafe.space/<location>/media/<id>`. Folders are organisational only, so
  moving a file never breaks its link.
- **Names must be unique before upload.** Twelve basenames collide across the 25 client
  folders (`01.jpg` exists in every one) and GHL discards paths, hence `bv-<slug>-NN.jpg`.
  GHL also silently renames a collision to `name (1).jpg` — one file came back that way.
- **The media id is the tile element's `id` attribute**, with the filename in its
  `img[alt]`. Do *not* read the img `src`: for a video that is GHL's generated poster
  (`transcoded_videos/*.jpg`), so the six reels first mapped to still images. Build the
  id from the element plus the extension in the alt.
- **Library search reaches inside folders**, and the list renders only ~10 rows with no
  pagination. Harvest by searching per group; do not try to scroll the folder.
- **Clicking a folder tile over CDP never worked** — four attempts, zero files visible
  each time. An earlier run trusted a "clicked" return value and dumped 196 files into
  the library root by mistake. Verify navigation by asserting content appeared.
- **`closeLb` must not be gated on `lbBusy`.** Stepping holds that flag until the next
  image loads, and over the CDN that outlasts a reader's patience — closing has to win.

---

## ⚠ Redaction policy — what is deliberately NOT on this site

`sources/` holds 13 strategy decks (232 pages) and a Meta/TikTok campaign report. They
were read to write the journeys. **They must not be published.** They contain:

| Withheld | Why |
|---|---|
| Named competitor SWOT teardowns | Every deck critiques named real businesses. Publishing that is a legal and reputational risk. |
| Competitor pricing tables | Same. |
| Client media budgets | e.g. planned monthly spend, per-campaign spend, total account spend. Not the client's to publish for them. |
| Internal projections | Estimated conversions, forecast revenue, December targets — these are planning artefacts, not results. |
| Internal campaign names | e.g. account-structure names that expose how the ad account is built. |
| Phone numbers and creator handles | The Freestyle report carries an order line inside TikTok captions and a partner creator handle. |
| The raw campaign report image | It carries a "Reportei trial period" watermark and the order phone number. The metrics were transcribed into a designed readout instead. |

**What IS published:** figures already in the client-approved portfolio document
(SpeakUp EGP 8,000 → 60,000+; Freestyle 232K views / sold-out drop; Izar 809+
purchases / ~EGP 1.15M / ROAS 9–13.2), plus counts of things that exist — files
delivered, funnels built, personas defined.

Client social creative in `assets/work/` is the clients' **own published marketing** —
already public on their channels, which is what a portfolio is for. Some of it carries
the client's public business phone or a named staff member, exactly as the client
published it. Nothing there was sourced from private data.

---

## Polish pass — what was added and why

Everything below was verified against the running site with real CDP mouse and
keyboard input, not `element.click()`.

**Navigation**

- **Mobile menu** (`.bv-menu`, `motion.js` §0a). Under 900px the masthead nav is
  `display:none` and there was previously *no other route to a section* — the phone
  build was scroll-only. The burger opens a full-screen comb of the six sections.
  Closes on tap, on Escape, and when a rotation crosses 901px (otherwise the panel
  goes `display:none` while `body` is still scroll-locked).
- Both navs are scroll-spied, so the menu already shows where you are when it opens.

**Accessibility**

- **Skip link.** First Tab now offers it.
- **Hero comb cells are `tabIndex = -1`.** Nineteen of them sat between the masthead
  and the first line of copy. They open the *same* dossier as the 25 properly
  labelled cards in Work, so removing the tab stops costs a keyboard reader nothing
  and saves them nineteen presses. The cells stay in the a11y tree with their labels.
- **Focus trap + restore** on the dossier and the lightbox, `aria-hidden` on the
  background while the dossier is open, focus lands on the close button and returns
  to whatever opened it. Verified: 26 consecutive Tabs, 0 escapes.
- Footer headings `h4 → h3` (the `h2 → h4` jump is gone), `aria-current` on the
  active nav link, `scroll-margin-top` on the pinned method section.

**Sharing**

- Open Graph + Twitter card + canonical + `theme-color` + `ProfessionalService`
  JSON-LD. `assets/og/beeviro-og.jpg` is a **real 1200×630 screenshot of the hero**,
  regenerated by `scratchpad/og.mjs` — a capture of the page can never drift from
  the page. Note the embed build drops `<head>`, so inside GHL the social card comes
  from GHL's own page settings, not from here.
- `preconnect` to the media CDN.

**Visual**

- **The method section was 652px wide inside a 1440px viewport.** `.bv-wrap` is a
  flex *item* under `.bv-pin__stage`, so it was sizing to its content instead of
  taking the width every other section's `.bv-wrap` gets. Fixed with `width:100%`,
  then laid out as two columns ≥1180px so the heading sits beside the comb and the
  detail panel changes next to the cell being scrubbed.
- **Edge fades** on the reels, the marquees and the dossier shelf. They ran
  edge-to-edge and ended in a hard vertical cut through whatever tile was there.
  The mask goes on the scrollport, never the track — on the track it would travel
  with the tiles. Disabled in `data-mode="grid"`.
- **Loading skeletons.** Lazy tiles were flat grey rectangles until they decoded.
  The shimmer sits on the container and is simply covered when the picture lands,
  so it needs no load event to stop. The tile fade-in is gated on `html.bv-js` —
  without that a reader with no JS would get a page of invisible tiles.
- **Dossier rail facts** (sector / market / year / site) fill what was a
  screen-height gap above the Prev/Next buttons.
- **The lightbox names the client.** Spotting something in the creative reel used to
  give you a full-screen image and no way to tell whose work it was.

Measured after: CLS **0.0017**, no JS errors, no 4xx, 0 broken images, no horizontal
overflow at 360–1920px, and reduced-motion still shows all 25 cards and every tile.

---

## The hero comb (`js/hive.js`)

**The name is not inside the hexagon.** A pointy-top hex tapers to a single point
at the bottom — exactly where a bottom-anchored caption sits — so the `clip-path`
was eating the label on *every* cell, and anything longer than one short word
("SpeakUp English Training") lost whole lines. The readout is now one shared panel
outside the lattice and outside the 3D context, positioned beside whichever cell is
hot, flipping side and clamping vertically to stay on screen. It carries the
client's sector, full name, outcome headline and accent colour. Verified: **all 25
client names fit without truncation.**

**The pointer lean lives on its own wrapper.** `#hiveTilt` holds the lean;
`#lattice` inside it holds the `bv-revolve` animation. They cannot be the same
element — a running CSS animation outranks an inline transform, so a lean written
onto the animated element is silently ignored.

**Interaction.** Hovering pushes the ring of neighbours away (`--px`/`--py`, written
once per hover, CSS eases them) and holds them back, so the hot cell reads as pulled
out of the sheet. An idle pulse walks honey cell-to-cell every ~6.4s when nobody is
pointing, which is what tells a reader the comb is touchable. Clicking flashes honey
before the dossier grows out of the cell.

**Two bugs found while rebuilding it:**

- The reel-placement rule `(r * 5 + c) % 4 === 1` selects exactly **five** cells on a
  3-4-5-4-3 cluster, so the sixth transcoded reel — Beeviro's own, already uploaded
  to the media library — was never placed at all. Slots are now spread evenly across
  the flattened cluster, so every reel is used. Six play, not five.
- `beeviro` is **not a client slug**, so that cell was labelled with the raw lowercase
  slug and clicking it silently did nothing (`openCase` finds no match and returns).
  It now has its own record — "Our own reel", CTA "See the work" — and scrolls to the
  Work section instead of promising a dossier.

**Optimization.**

| | before | after |
|---|---|---|
| turnover pool | all ~176 gallery images | 44 (2 per client), then cached |
| network while idling on the hero | ~23 new images/min, forever | converges to zero |
| elements per turn | a new `<img>` every 2.6s | none — the face's `<img>` keeps its src slot |
| background tab | kept turning | `visibilitychange` stops everything |

The one remaining win needs an upload: cell images are **~10× oversampled** (1200px
files rendered at ~117px). The GHL CDN is a plain object store — `?width=`, `?w=`,
`?tr=w-` all return the identical bytes — so the only fix is generating ~44 small
hive thumbnails and putting them in the media library. That would take the comb's
image budget from ~4 MB to ~0.6 MB.

---

## Design

Beeviro brand: **Yellow `#FFC202` · Black `#0A0909` · White `#F5F5F5` · Aclonica**
headings (self-hosted from the client's own font folder, OFL).

The structural motif is the **honeycomb**, taken from the Beeviro mark itself — the
six-stage method is six cells, and the journey in each case file is a comb the reader
walks down, lighting up as it scrolls.

Layout and motion take their cue from `inspiration/` (navbardigital.com): huge display
type, `( parenthetical )` mono eyebrows, numbered service rows, per-card accent colour,
marquees, and the two-row infinite creative carousel.

---

## Motion

`site/js/motion.js` owns everything scroll-driven and is separate from `beeviro.js`
(structure/data) on purpose — it can be deleted and the site still works.

- Fixed **scroll progress rail** across the top.
- **The revolving comb (the hero).** `site/js/hive.js` builds a honeycomb cluster of
  **real client work** — 19 hexagonal cells in a 3-4-5-4-3 fragment, six of them playing
  **actual client reels**, the rest holding stills that quietly turn over to new pieces
  every few seconds. The lattice *oscillates* between ±19° rather than spinning a full
  turn: a complete rotation puts every cell edge-on for half the cycle and the hero goes
  empty. Cells sit at different `translateZ` by ring, so the middle stands proud.
  Hovering a cell names the client; clicking opens that case (`BV_OPEN_CASE`).
  It pauses entirely when the hero scrolls away or a picture is enlarged.
  Above 1100px the copy and the comb get **separate columns** — they were fighting over
  the same pixels and the headline lost. Below it, the comb moves above the copy at 38%
  and fades out before the type starts.
- **Photographic ground.** `assets/hero/comb-wide.jpg` (AI-generated, 2 credits) sits dim
  behind the live comb for depth, and parallaxes as the hero leaves. The pointer *torch*
  that used to light it was removed when the revolving comb took over the hero — the
  torch code in `motion.js` is guarded on `#torch` existing, so it simply no longer runs.
  Delete it if you want the file shorter.
- **Hero honeycomb canvas** (`#comb`) over the photo: a live hex field that waves out
  from the pointer and takes a kick from scroll velocity. Sharp at any DPR, no asset.
- **Pinned, scroll-scrubbed comb.** `.bv-pin__rail` is 300vh and the stage is
  `position: sticky`. The six stages are a real honeycomb strip — alternating vertical
  offset — and each cell **fills with honey** over its own slice of the scroll while the
  active one scales up. One detail panel below swaps to the active stage rather than six
  blocks of small text competing. Cells are clickable (`BV_PIN.goTo`) to jump the scrub.
  Falls back to ordinary flow under 900px and under reduced motion.
- **Word-by-word heading reveals** on every `.bv-h2` / `.bv-quote`, split at runtime
  while preserving inline markup.
- **Decode scramble** on the mono eyebrows as they enter.
- **Hex-iris wipe** on card art — images open through an expanding hexagon.
- **Magnetic CTAs** that pull toward the cursor.
- **The case-file work shelf.** Each dossier's images run as a slow looping carousel at
  **full size** — the shelf has a fixed height and every tile takes its image's natural
  width, so pieces are shown whole and uncropped rather than squared off. Hovering a
  tile **pops it up** (lift + scale + gold edge) and pauses the run; moving away sinks it
  and the run continues. A **"Spread all N"** button explodes the shelf into a grid and
  back, animating every tile from exactly where it was using **FLIP** (measure First,
  change layout, measure Last, apply the inverse, release to zero), staggered per tile.
- **Honey drip rail** down the left edge: the column fills with scroll and a droplet
  rides the leading edge, stretching when you move fast and rounding when you stop.
- **Direction-aware strips.** Marquees and creative reels are driven from JS, so they
  **reverse when you scroll up** and speed up with scroll velocity. The reels also
  **smear** (blur) proportionally to how fast you are moving.
- **3D card entry** — work cards arrive tipped away on the X axis and settle flat.
- **Gradient text fill** — the contact headline fills with honey left-to-right as it
  crosses the viewport, via `background-clip: text` driven by scroll position.
- **Footer mark turns** with page progress.

### Boot, cursor, drag

- **Boot sequence** — the hex mark draws itself (`stroke-dashoffset`), a counter runs to
  100 and the screen lifts. Body scroll is locked while it is up, with a hard 4.2s
  failsafe so a stalled frame loop can never trap the page behind it.
- **The OS cursor is hidden** while the honey cursor is up. The `bv-cursor-on` class
  is added by JS on the FIRST POINTERMOVE — never from CSS alone, or a reader would be
  left with no cursor at all when the script fails, on touch, or under reduced motion.
  The rule is `html.bv-cursor-on *` with `!important` on purpose: buttons, links, the
  drag strips and zoom tiles all set their own cursor and would each bring the OS
  pointer back.
- **Pointer companion** — a honey dot that tracks exactly plus a ring that trails behind
  it. Over anything carrying `data-cursor` the ring swells and captions itself
  (*Open case*, *View*). Hidden on touch and under reduced motion.
- **Every strip is draggable.** Grab a marquee, a creative reel or a case shelf and throw
  it; the flick decays back into the ambient drift. Movement past 5px swallows the click
  so a drag never opens a lightbox by accident.
- **Enlarging a picture freezes everything** — marquees, reels and the case shelf all
  hold still while the lightbox is open (`body.bv-lb-open`), and resume on close.
  Case shelves enrol with the driver via `BV_STRIPS.add()` when a case opens and are
  dropped again when its markup is replaced.

### Nothing cuts

Every state change is a transition, not a swap:

- **Opening an image** grows it out of the exact thumbnail you clicked (FLIP against the
  tile's box) while the backdrop fades and blurs in and the chrome follows. Works from
  both the home carousel and a case shelf — the carousel resolves its origin *at call
  time* and prefers an on-screen copy, because the strip is moving and every tile exists
  twice.
- **Stepping** slides the outgoing frame out in the direction of travel and brings the
  next one in from the far side. The swap waits on `transitionend`, not a fixed timer,
  so a late-starting transition never gets clipped.
- **Closing** shrinks the picture back into whichever thumbnail is now current.
- **Opening a case** expands the dossier from the card that was clicked
  (`--ox`/`--oy` transform origin, clamped to the viewport), then deals the masthead and
  sections in on a stagger with the rail sliding in beside them.
- **Walking between clients** sends the panel out in the direction of travel, rebuilds
  while it is out of sight, and deals the next one back in.
- **Blur-to-sharp** case-gallery images, and **self-drawing journey connectors** in the
  dossier.
- **Count-up stats**, staggered **hive**, **service row** and **card** reveals,
  pointer **tilt** on work cards, marquees that **lean into scroll velocity**, and
  carousel tiles that lean the opposite way.
- Everything switches off under `prefers-reduced-motion`.

### Where the hero image came from

`assets/hero/comb-wide.jpg` (1920×1072) and `comb-tall.jpg` (900×1613) were generated
with Higgsfield `nano_banana_pro` at 2K, prompted to keep the **left third / bottom
half empty and near-black** so the hero copy always has clean ground to sit on. 2
credits each; converted PNG→JPEG through headless Chrome (7 MB → 190 KB).

### Hero video slot

There is a commented `<video class="bv-hero__video">` in `index.html`. Drop a file at
`site/assets/hero.mp4`, uncomment it, and it plays full-bleed behind the comb — the
scrim and canvas already sit on top. Nothing else needs changing.

---

## Notes for whoever picks this up

- **Carousel tiles are seed-shuffled, then de-clumped** — a seeded Fisher-Yates so the
  order is stable between loads, followed by a bounded pass that swaps apart any
  neighbours from the same client. An earlier round-robin read as ordered because it
  repeated the same client sequence every cycle.
- **Clients with no gallery fall back to their logo** (`logo:` in `clients.js`) on a
  tinted plate. Only lightly desaturated, not greyscaled — it is their only visual.
  Dar El Hadith has **no logo in the deliverables**, so it still shows a hex with its
  initial; drop `dar-al-hadith.png` into `assets/logos/` and add `logo:` to fix that.
- **Volt EMS's gallery is poster frames off its finished reels.** Drive renders posters
  for video files at the same `thumbnail?id=…` endpoint — useful for any video-only
  client. Dar El Hadith's posters were deliberately **not** used: they are raw candid
  footage of identifiable people, not delivered creative.
- **A running CSS animation outranks inline `style.transform`**, so the marquee lean is
  passed as a `--skew` custom property the items consume, not written to the track.
- **Never rewrite `animation-duration` on scroll** — it remaps elapsed time and the
  marquee jumps every frame.
- **Comb contrast follows the fill, not the active state.** A cell that has filled with
  honey is gold, so `.is-filled` (set at `f > 0.55`) is what turns its number dark —
  keying that off `.is-on` leaves grey numerals on five gold cells.
- **The work shelf carries a hidden ghost track** so the `-100%` loop is seamless. Count
  tiles with `.bv-gal__track:not(.bv-gal__track--ghost)` or you get double.
- **The FLIP clears its inline transform synchronously** — the transition runs off the
  *computed* value. Asserting on `el.style.transform` mid-flip reads empty and looks
  like a failure when the animation is actually fine.
- **A hash-only URL change does not reload**, so the `#case=` deep-link handler (which
  runs once at script load) never fires. Navigate to `about:blank` first when scripting.
- **Case-shelf images must NOT be `loading="lazy"`.** The shelf sizes each tile from its
  image's natural width, and a lazy image deadlocks: zero width means "not visible",
  which means it never loads, which means it never gets a width. There is also a
  `min-width` guard on the tile for the moment before decode.
- **Two overlapping breakpoints disable everything between them.**
  `@media (min-width: 1100px)` and `@media (max-width: 1100px)` BOTH match at exactly
  1100px, so the mobile block's `.bv-cellx { pointer-events: none }` killed every hero
  cell at that one width. Use `max-width: 1099.98px`. Only an exhaustive width sweep
  catches this — 1180px and up were all fine.
- **The hero headline is `pointer-events: none`.** Its box overlaps the comb by up to
  147px between 1100 and 1600px, and no geometry fixes that: a ~730px headline and a
  ~650px comb do not both fit at 1280. Display type nobody selects is the right thing
  to make click-transparent; the lede and CTAs keep theirs.
- **An overlay that only *looks* transparent still eats clicks.** `.bv-hero__inner`
  is a full-width block at `z-index: 1` over the hero comb, so it swallowed every click
  aimed at a cell — only the ones past its right edge were reachable, which read as
  "the left side is covered". Fix: `pointer-events: none` on the CONTAINER and
  `auto` on its children, so each child only blocks over its own box and text stays
  selectable. Full-width children (`.bv-eyebrow`, `.bv-hero__actions`, `.bv-scrollcue`)
  also need `width: max-content` or they re-create the problem across the whole row.
  Verify with `elementFromPoint` at each cell centre, not by eye.
- **A spread-open gallery must be taken off the strip driver.**
  It is a GRID, not a strip. The old CSS `animation: none` used to stop it, but the
  shelf is JS-driven now and the driver kept writing `translateX` every frame, so a
  spread gallery still slid sideways. The driver checks `data-mode` and parks it at 0;
  `wireSpread` also zeroes the track SYNCHRONOUSLY before FLIP measures the new layout,
  or every tile jumps by the old offset the moment the driver catches up. Returning to
  the run holds the strip (`s.hold`) until the tiles have landed.
- **`.js-strips` must disable every track it takes over**, including `.bv-gal__track`.
  It listed only marquees and reels, so galleries ran on BOTH the CSS animation and the
  JS driver.
- **A `#case=` deep link builds a shelf before `motion.js` exists.** `beeviro.js` loads
  first and opens the case during its own run, so `window.BV_STRIPS` was undefined and
  that shelf silently never enrolled — no drag, no lightbox freeze. It now retries.
- **A rect on screen is not a clickable tile.** The shelf clips with `overflow: hidden`,
  so a scrolled-out tile still reports an on-screen `getBoundingClientRect`. Test
  selection must confirm with `elementFromPoint` — this cost a false regression.
- **Never `setPointerCapture` on pointerdown for a drag.** Capturing immediately
  retargets the following `click` to the capturing element, so `closest('.bv-tile')`
  finds nothing and a plain click silently stops working. Capture only once movement
  passes the threshold (6px) and it is genuinely a drag.
- **A moving strip must freeze on pointerdown.** A click's target is the common ancestor
  of press and release; if the carousel travels between them the click resolves to the
  container, not the tile. There is also an `elementFromPoint` fallback (`hitAt`) for
  the same reason.
- **`element.click()` cannot test any of this.** Programmatic clicks skip
  pointerdown/pointerup entirely, so a pointer regression passes every such test. Use
  CDP `Input.dispatchMouseEvent` — `scratchpad/flow.mjs` drives the real order.
- **Overlay reveal uses `setTimeout`, not `requestAnimationFrame`.** rAF is frozen while
  a tab is hidden, and an overlay gated on it would open invisible and stay that way.
- **Sequence multi-phase transitions on `transitionend` with a timeout fallback.** A
  fixed timer assumes the transition started when you set it; if style recalc is delayed
  the phase gets cut off mid-way and reads as a jump.
- **Marquees and reels are JS-driven, not CSS-animated** (`html.js-strips` switches the
  animation off). The stylesheet keeps the animation as a no-JS fallback. This exists
  because flipping `animation-direction` remaps elapsed time and jumps the strip — the
  only clean way to reverse on scroll-up is to own the transform.
- **`.bv-m__in` needs `display:block`.** It is a `<span>`; as an inline box its
  absolutely-positioned faces have no containing block and the metric cards collapse.
- **`transform-style: preserve-3d` carries its `-webkit-` prefix** — Safari flattens
  without it and the front face stays visible through the whole flip.
- Images were fetched at `drive.google.com/thumbnail?...&sz=w1200` and recompressed
  through headless Chrome (119 MB → 27 MB). Drive's thumbnails are near-lossless and
  far too heavy to ship raw.
- Deep links work: `#case=izar` opens that dossier directly. Arrow keys walk clients,
  Escape closes.

---

## Revision pass — answering the supervisor review

Two reviewers looked at the site. The praise was for the identity, the navbar, the
custom pointer, the dossiers and the carousel. The criticism was consistent and
specific, and every point below names the note it answers.

### 1. "Very heavy · not suitable for weak or normal devices · lags when scrolling"

Three separate problems were hiding inside one complaint: **too many pixels
downloaded**, **too much video on arrival**, and **too much work per frame**.

**Pixels.** The gallery originals are ~1200px wide and were being shown in boxes
between 117px (a hero comb cell) and 440px (a work card) — roughly ten times the
pixels anybody could see, on every card, every carousel tile and every hero cell.
`tools/make-thumbs.mjs` writes a 480px copy of each of the 181 gallery images
(29.5 MB → 5.8 MB) and lists them in `site/js/thumb-map.js`; `thumb()` in
`beeviro.js` picks the small one for anything displayed small. Full-size files are
still what the lightbox and the dossier shelf open, because those are the surfaces
where the client's work is actually being looked at.

There is no image library on this machine and no Python, so the resize is done by
headless Chrome over CDP — file in as a data: URI, drawn into a canvas at the
target width, out through `toDataURL('image/jpeg', 0.74)`. Same trick as the
original Drive recompression.

Measured cold, at 1440px, with `tools/weigh.mjs`:

| | first view | after scrolling the whole page |
|---|---|---|
| full-size images (`--full-images`) | 4.04 MB | 4.98 MB |
| with thumbnails | **1.60 MB** | **1.78 MB** |

**Video.** The six hero reels are ~2 MB and were all fetched during page load,
competing with the images and the layout. They are queued now: nothing starts
until the boot screen has lifted, then one at a time. The hero has its stills and
its type long before the first frame of video arrives, and on the lite tier the
comb is stills only — the video decoders never start.

**Frames.** `site/js/perf.js` decides a motion tier BEFORE anything is built, from
`deviceMemory`, `hardwareConcurrency`, `pointer: coarse` at a small width, and
`saveData`/`effectiveType`. Two weak signals is enough to go lite. A watchdog then
measures real frames for three seconds after boot and demotes below ~42fps, because
device hints miss the four-year-old laptop that reports 8 cores and still cannot
paint this.

The lite tier drops the per-frame work and keeps the design: no hero canvas, no
pointer companion, no pointer tilt on cards, no magnetic buttons, no decode
scramble, no cell turnover, no JS strip driver (the CSS animation that was always
there as the no-JS fallback takes over — it runs on the compositor and costs the
main thread nothing), no `backdrop-filter` anywhere, the pinned method section
un-pins, and the sections below the fold get `content-visibility: auto`. Layout,
colour, type and every scroll reveal are untouched.

**The tier must be decided before the page is built, not after.** Tearing down a
running canvas or a half-built lattice is how you get a broken page instead of a
quiet one. That is why `perf.js` is the first script in the document.

There is a switch for it in the masthead and in the mobile menu, so a reader on a
fast machine who was auto-demoted can turn everything back on, and a reader on a
device the heuristics called fast can turn it off. It persists, and it reloads —
because the effects are built at load, and pretending a half-torn-down canvas is
the same experience would be a lie.

### 2. "It doesn't support Arabic"

The site now reads in English and Arabic, right to left, including all
twenty-five case files. `site/js/i18n.js` holds every string the page owns;
`site/js/clients.ar.js` is an *overlay* merged over `clients.js` by slug, so the
accent colour, the slug, the year, the gallery count, the metric values and — most
importantly — `outcome.kind` have exactly one source of truth and cannot drift
between languages. A goal is still labelled a goal in Arabic.

Switching language reloads. Half this site is generated markup measured in pixels
at build time; re-rendering it live in the other direction gives you a mirrored
layout with unmirrored measurements. `?lang=ar` on any URL wins over the stored
choice, so a case file can be shared in the language it was read in.

Things that are not obvious about doing this properly:

- **Arabic is a connected script, so tracking breaks it.** Every `letter-spacing`
  in the display and mono stacks is reset to `normal` under `[dir="rtl"]`, and
  `text-transform: uppercase` is removed — it does nothing to Arabic anyway.
- **The hero headline reveal had to change grain.** It wraps every *character* in
  its own inline box, which severs the joins and drops each letter to its isolated
  form. In Arabic it reveals by word instead.
- **The decode scramble is off in Arabic** for the same reason: replacing
  characters with block glyphs makes a connected word visibly fall apart rather
  than decode.
- **`(` at the start of an RTL run renders as `)`.** Brackets are bidi-mirrored.
  Rather than author them backwards and rely on the mirroring to undo it, each
  eyebrow bracket is isolated as its own LTR run (`direction: ltr; unicode-bidi:
  isolate`) so it draws the glyph it says. Verified against a mirrored control.
- **"حالة 01 / 25" renders as "25 / 01".** A slash and spaces between two numbers
  are neutral characters and take the paragraph direction, which swaps the numbers.
  An Arabic word between them holds each in place — so it reads "حالة 01 من 25".
- **Arrows are NOT mirrored,** so `→ Previous` had to be authored for the direction
  it is read in. Back is to the right here.
- **The JS strip driver had a real direction bug.** A flex row in an RTL document
  lays out from the right edge leftwards, so the duplicate track that makes the
  loop seamless sits to the LEFT of the first one. Writing `translateX(-off)` walks
  the strip away from its own duplicate and after one track-width the shelf is
  simply empty — measured with an Arabic case gallery's first tile sitting at
  x = -2117 in a window starting at x = 130. Every offset is a distance now, and
  `SIGN` turns it into a direction exactly once, where it becomes a transform.
- **The CSS fallback animation needs its own keyframe, not a reversed one.**
  `animation-direction: reverse` starts the strip a full width out of place and
  leaves a gap on the first pass; `bv-slide-rtl` travels to `+100%` instead.
- The hero comb moves to the left third and the scrim that holds the type down
  changes sides, because in Arabic the copy starts on the right.

### 3. "Lack of visuals in the SERVICES section"

Eight rows of text between a comb that fills with honey and a wall of client art —
it read as a gap in the page. Each service now leads with a drawn glyph inside a
real hexagon that fills with honey on hover. Inline SVG: no download, scales to
any screen, inherits the brand colour. The title column is also sized to its
content now, so the descriptions sit next to the titles instead of being flung
across a 1440px screen.

### 4. "WORK must show 6 max with a SHOW MORE button"

Six on arrival, then six more per press, with a `Showing 6 of 25` count and a
collapse that puts the reader back at the top of the section. Hidden cards use
`hidden`, not a class — a card nobody can see should not be a tab stop either.
This is also the cheapest weight saving on the page: six card images on first load
instead of twenty-five. `BV_REVEAL_CARD` exists so a deep link or a hero cell can
still open a card that has not been revealed yet — `openCase` measures the card to
grow the dossier out of it, and a `hidden` card has no box.

### 5. "The text is still quite big for the screen"

The whole scale came down. The hero headline was 102px at 1440px and is now 66px;
`.bv-h2` 47px from 74px; the lede, the quote, the marquee, the stats, the card
titles, the dossier tagline and the metric values all with it.

### 6. "The modal is crowded and needs margins so the site shows behind"

The dossier is inset now — `min(1280px, 100% − 2×clamp(12px,4.5vw,84px))` wide,
full height less a small margin, rounded, over a dimmed and blurred page. Clicking
the margin closes it, because a strip of page you can see but not click reads as
broken. Density came down with it: two metric cards per row until 1320px, tighter
section padding, a 64ch measure on the journey body, and a 24ch cap on the outcome
line.

**The growth transform moved from the overlay to the shell.** With the veil inside
an element that scales from 0.94, the dim layer shrinks with the panel and flashes
an undimmed border for the length of the animation.

### 7. "Case 1/25 Izar — scrolling does not make all the journey glow on the side tab"

A real bug, with two causes, both in the IntersectionObserver that used to drive it:

1. `threshold: 0.45` means 45% of the *step* has to be visible. Several journey
   steps are taller than 45% of the panel, so their ratio can never reach 0.45 and
   they never lit at all.
2. The callback fires on threshold crossings in both directions, and
   `isIntersecting` is true at ratio 0.44 as well as 0.46 — so a step leaving
   upward re-claimed the highlight from the step arriving below it and the rail
   walked backwards.

Position is a scroll question, so `trackJourney()` answers it by reading the
scroll. Every stage the reader has passed stays lit, the current one is marked
separately, and a spine fills behind the rail. `tools/flow.mjs` walks the panel in
40 steps and asserts all six hexes light and the rail visits all six stages.

### 8. "Open a case, scroll down, close it, open another — it starts scrolled down"

Also real. `buildCase` did set `panel.scrollTop = 0`, but at that moment the
dossier is still `display:none` from the previous close: a scroll write to a box
that does not exist is silently dropped, and the browser restores the old offset
when the box comes back. It is set again one frame after the overlay is displayed,
which is the first moment the panel actually has a scrollport.

Found while fixing it: closing hides the overlay on a 520ms timer, and reopening
inside that window let the stale timer fire and hide the dossier that had just
arrived. The timer is cancelled on open now.

### 9. "A download manager detects the videos and offers to download them"

That is what IDM and Neat Download Manager are for — they watch for a media element
pointing at a media URL. The pop-up interrupts someone who only wanted to look at a
portfolio, and these are the clients' campaign films, not downloads on offer.

The reels are pulled with `fetch()` — page data, which download managers do not
intercept — and handed to the element as a `blob:` URL, which is local to the
document and cannot be re-requested from outside it. If the fetch fails (a CDN
without CORS, an offline reader) it falls back to the direct `src`, so the comb
never loses its motion over this. Backed up with `controlslist="nodownload"`,
`disablepictureinpicture`, no `<source>` element and no context menu.

### Tools added

| | |
|---|---|
| `tools/make-thumbs.mjs` | 480px display copies of every gallery image, via headless Chrome. Writes `site/js/thumb-map.js`. |
| `tools/check.mjs` | Width sweep — overflow, broken images, console errors, failed requests, type sizes, target sizes and the shared left edge. **Asserts, and exits non-zero.** Screenshots each width. `--lang ar`, `--lite`. |
| `tools/flow.mjs` | Drives the reported bugs end to end with real pointer events. 12 assertions, both languages. |
| `tools/weigh.mjs` | Cold-cache transfer weight and frames-under-scroll. `--lite`, `--full-images`, `--deep`. |
| `tools/shoot.mjs` | Screenshots named sections at a given width and language. |

Traps these tools taught, worth keeping:

- **`scrollIntoView({behavior: 'auto'})` is not instant here.** The stylesheet sets
  `scroll-behavior: smooth`, and `auto` defers to it — so the page is still gliding
  when the rect is measured and a dispatched click lands where the button used to
  be. Reported a working "Show more" as broken until it was `behavior: 'instant'`.
- **Dispatched mouse events are in viewport coordinates.** An element below the
  fold has to be scrolled to first, or the press lands on empty space three
  thousand pixels off screen.
- **The Chrome profile is reused between runs, and the tier is in localStorage.**
  One `--lite` run silently pinned every later run to the lite tier. Set it either
  way, never just when you want it.
- **Disable the HTTP cache before weighing anything.** The second run of a weight
  script otherwise reports ~0 MB of images and looks like a triumph.

### Thumbnails and the hosted build

`thumb()` resolves in this order: the thumbnail through the media map → the
thumbnail as a local file → the full-size image. `build-embed.mjs` stamps
`window.BV_EMBED = true` into the bundle, which is the one context where the
middle rule would be wrong (nothing is served locally there, so an unmapped path
is a 404).

So the standalone `site/` deploy gets the thumbnails today, and the GHL build keeps
serving the full-size originals until the thumbnails are uploaded too. To finish
that: `node stage-upload.mjs` now also stages them into
`upload-staging/_thumbs-480/` (181 files, 6.0 MB, named `bv-t-<slug>-NN.jpg`), so
that folder can be uploaded on its own; then harvest the ids and re-run
`gen-media-map.mjs` with them. It refuses to write an empty map now — the ids file
lives outside the repo, and a missing path used to produce a valid-looking
`media-map.js` with nothing in it, which un-hosts all 196 assets at once.

### Verified after

At 390 / 900 / 1280 / 1440 / 1920px, in English and Arabic: no horizontal
overflow, no broken images, no console errors, no failed requests. `tools/flow.mjs`
passes 12/12 in both languages. The tier switch and the language switch both
round-trip and persist; the language survives a plain reload. A phone-shaped
viewport auto-selects the lite tier while a desktop does not.

**RTL LEAKS HORIZONTAL SCROLL THAT LTR HIDES (2026-08-28).** The Arabic build had 6px
of horizontal overflow at every width and English had none — same markup, same CSS. The
source was `.bv-svc__row { transform: translateX(-26px) }`, the pre-reveal resting state
of the services rows, eight screens below the fold. `overflow-x: hidden` on `<body>`
clips overflow past the END edge; Chrome does NOT clip overflow past the START edge, and
in RTL a leftward translate is past the start. Fixes: make the slide enter from the
reader's own leading edge (`translateX(26px)` in RTL) AND `overflow-x: clip` on the
container — `clip`, not `hidden`, because clip does not create a scroll container.
- **Hunting it:** hide each top-level section in turn and re-read
  `documentElement.scrollWidth - clientWidth`. Walking boxes and testing
  `rect.right > innerWidth` finds NOTHING, because the page has already shifted to
  absorb the overflow and every box then measures inside the viewport. The arithmetic
  gives it away: the leak was 6px because `.bv-wrap`'s 20px padding absorbed 20 of the
  26px translate.
- The same section also needs `min-width: 0` on its grid items: a grid item's automatic
  minimum size is its CONTENT, so a long Arabic run pushes a row past its track.

**Bracket glyphs cannot be forced.** The `( parenthetical )` eyebrow renders inside out
in Arabic — brackets are Bidi_Mirrored. `direction: ltr; unicode-bidi: isolate` on the
pseudo-element did NOT stop it (checked by rendering the real eyebrow at 54px and looking
— both glyphs drew as `)`). The Arabic eyebrow now uses two DRAWN boxes with one border
removed, placed with logical properties, so the opening always faces the text and no bidi
is involved. When a text solution needs three paragraphs of bidi reasoning to justify,
draw the shape instead.

---

## Second optimisation pass — "it needs to be optimized more"

The first pass answered every written note. This one went after the number
behind the loudest of them. Everything below is measured cold, cache disabled,
at 1440px, with `tools/profile.mjs` and `tools/weigh.mjs`.

| | first view | whole page scrolled |
|---|---|---|
| before this pass | 3.51 MB | 4.98 MB |
| after | **0.86 MB** | **1.15 MB** |
| lite tier | **0.38 MB** | |

A reader who lands and scrolls straight to the work pays **0.57 MB** — the hero
reels are not fetched at all unless the comb is actually on screen.

### Where the 2.6 MB went

**The six hero reels: 1.96 MB → 0.55 MB.** They were 420×420 at ~440 kbps and
they play inside hexagons 92–152 px wide, clipped, graded down to 72% brightness.
`tools/shrink-reels.mjs` re-encodes them to 288×288 at 115 kbps. There is no
ffmpeg on this machine, so Chrome is the codec: play the source into a canvas at
the target size, `canvas.captureStream()`, record that with `MediaRecorder`.
Checked at 2× DPR magnified 1.4× — no visible damage at the size they are shown.

**Gallery images: two tiers, both WebP.** One 1200 px JPEG was feeding three very
different boxes. Now `tools/make-thumbs.mjs` emits a **480 px** tier for work
cards and carousel tiles and a **200 px** tier for the hero comb, and both are
WebP (~40% under JPEG at matching quality). The full-size originals are
untouched and remain what the lightbox and the dossier shelf open.

**The hero photograph was downloaded twice.** `background-image: var(--hero-wide,
url(...))` — the stylesheet is parsed long before beeviro.js defines that
property, so the browser fetched the fallback and then fetched the CDN copy when
the real value landed. 191 KB, twice, every cold load. The fallback is gone; JS
owns the image, and `<noscript>` covers the reader who has none.

**The logos were downloaded twice too, for the same reason** — the parser starts
fetching a `src` the moment it reads it, so rewriting it afterwards costs a
whole extra file. The markup points at the light copy directly now.

**Everything else fixed got recompressed:** hero photographs, brand marks and
client logos to WebP (716 KB → 207 KB), and the favicon from a 500×500 75 KB PNG
to 64×64 and 2 KB. `tools/squeeze.mjs`.

**Arabic prose is only downloaded in Arabic.** `js/lang.js` resolves the language
in the `<head>` and the body writes the `clients.ar.js` tag only when it is
needed — 62 KB, a fifth of the script payload, and parse time on a cheap phone is
not free. It also removes a direction flash: `dir="rtl"` is now on `<html>` before
the stylesheet lays anything out, instead of the page being built LTR and flipped.

**`serve.mjs` compresses text now** (brotli, gzip fallback, never for already-
compressed formats). Any real host does this; without it every local measurement
of "how heavy is this page" was wrong by 4× on exactly the files we most wanted
to be honest about. CSS 87 KB → 22 KB on the wire, scripts 235 KB → 67 KB.

**The embed bundle ships without the commentary.** The stylesheet is 40%
explanation by weight and every byte of it is worth keeping in the source — but
not worth downloading on every visit through a GoHighLevel paste box. A
hand-written stripper (no build step, no dependencies here) walks the file and
skips comments only when it is not inside a string, so a `content: "/*"` or a
`url("...(*...")` survives. 157 KB → 133 KB.

### Two bugs this pass created and caught

**A relative `url()` in a custom property resolves against the STYLESHEET, not
the document that set it.** `--hero-wide: url("assets/light/comb-wide.webp")` was
fetched as `/css/assets/light/comb-wide.webp` and 404'd, so the hero had no
photograph at all. It only ever worked before because the media map always
returned an absolute CDN URL and the question never came up. The value is
absolutised with `new URL(p, location.href)` now.

**Three tools wrote the same generated file and the last one won.**
`shrink-reels.mjs` rewrote `thumb-map.js` wholesale and dropped `BV_CELLS`; the
hero comb silently fell back to full-size originals and the page went from
1.4 MB to 3.2 MB with nothing in the diff to explain it. All three now write
through `tools/map.mjs`, which merges per table and per owned prefix.

### Tools

| | |
|---|---|
| `tools/make-thumbs.mjs` | 480px + 200px WebP tiers for the gallery. |
| `tools/shrink-reels.mjs` | Re-encodes the hero reels via Chrome's MediaRecorder. |
| `tools/squeeze.mjs` | Hero photographs, brand marks, client logos, favicon. |
| `tools/map.mjs` | The only writer of `js/thumb-map.js`. Merges; never clobbers. |
| `tools/profile.mjs` | Per-URL byte profile of a cold view, grouped, plus 404s. |
| `tools/weigh.mjs` | Totals and frames-under-scroll. `--lite`, `--full-images`. |
| `tools/check.mjs` | Width sweep: overflow, broken images, console errors, target sizes, the shared left edge. Asserts. |
| `tools/flow.mjs` | Drives the reported bugs with real pointer events. |
| `tools/shoot.mjs` | Screenshots named sections. |

Regenerate everything after adding or replacing assets, **in this order** (each
tool owns its own prefix in the map, so order does not corrupt anything — it
just has to all have run at least once):

```bash
node tools/make-thumbs.mjs && node tools/shrink-reels.mjs --size 288 --kbps 115 && node tools/squeeze.mjs
```

### The hosted build still needs the light copies uploaded

`thumb()` resolves: light copy through the media map → light copy as a local file
→ the original. The standalone `site/` deploy gets all of the above today. The
GoHighLevel build serves nothing locally, so it keeps serving 1200 px originals
into 200 px boxes and 420 px video into 120 px cells until the light copies are
in the library — which is exactly the weight the reviewers were describing.

`node stage-upload.mjs` puts all 378 of them in `upload-staging/_light/`
(6.8 MB) under unique flat names, so that batch can be uploaded on its own
without touching the 196 files already there. Then harvest the ids and re-run
`gen-media-map.mjs`. Nothing breaks in the meantime: `build-embed.mjs` rewrites
any light path in the markup to the CDN url of the original it was made from,
and `BV_EMBED` stops `thumb()` reaching for a local file that is not there.

---

## The pointer disappeared — and why that was my fault

Reported after the optimisation pass: *"the custom cursor disappears."* It did,
on most loads, a few seconds in. It was not the cursor code.

`perf.js` has an FPS watchdog that demotes the motion tier at runtime when the
page cannot hold a frame budget. It fired, `.bv-lite .bv-cursor { display: none }`
hid the custom cursor — and `html.bv-cursor-on` was still on `<html>`, applying
`cursor: none !important` to everything. **No custom cursor, no operating-system
cursor, no pointer at all**, and nothing on screen to explain it.

Two rules came out of it. `tools/pointer.mjs` is what holds them.

### 1. Nothing may hide the custom cursor while the OS cursor is also hidden

`cursor: none` is now written as `html.bv-cursor-on:not(.bv-lite-boot)`. That
`:not()` is a safety catch, not decoration: this rule hides the *real* pointer
and the only thing standing in for it is one element. Any state that stops
drawing that element must also stop hiding the real one.

### 2. `.bv-lite` and `.bv-lite-boot` are not the same thing

- **`.bv-lite`** — the tier is lite, however it got there.
- **`.bv-lite-boot`** — it was lite *before the page was built*.

Only the second may change layout or remove something the reader is already
looking at. A runtime demotion happens six seconds in, with somebody's pointer
on the page and their scroll position somewhere, so it is allowed to switch off
per-frame work and nothing else.

Two rules moved to `.bv-lite-boot` as a result, and both were latent bugs of
their own:

- **un-pinning the method section** takes about two viewport heights out of the
  document. Doing that to a reader who is already scrolled teleports them.
- **`content-visibility: auto`** re-estimates every section's height under a
  page that is already laid out.

**And the pointer companion now survives a runtime demotion on purpose.** It is
one rAF loop that sleeps when the pointer stops — it is not what makes this page
slow — and both reviewers singled it out. When lite is chosen at boot the module
never starts at all, which is the only case where the element is hidden.

### The watchdog was also too eager

It sampled one three-second window starting 2.6s in and demoted under 42fps —
which is exactly the window where the page is worst and least representative:
the boot screen has just lifted, nineteen cell images are decoding, six videos
are being fetched and the first reveals are running. It fired on machines that
were fine.

It now starts at **6s**, samples **2.5s** windows, needs **two consecutive**
windows under **36fps**, and ignores any window where the tab was hidden (a
backgrounded tab throttles rAF to a crawl — that is the browser being sensible,
not the device being slow). A reader who presses the masthead switch sets a
sticky preference, which turns the watchdog off entirely from then on.

### `tools/pointer.mjs`

Forces the demotion rather than waiting for a slow machine — a test that only
runs when the hardware happens to be struggling is not a test. Eleven
assertions: the pointer is still on screen, the two cursors are never both
hidden, the custom cursor still tracks, the document height is unchanged, the
reader was not teleported, the pinned section stayed pinned, and boot-lite
correctly hides the custom cursor *while leaving the OS one alone*.

---

## The light copies are live on GoHighLevel

Harvested 2026-08-29. `site/js/media-map.js` now holds **574 entries** — the
original 196 plus all 378 light copies — so the hosted build serves the same
small files the standalone one does.

| | mapped |
|---|---|
| 480px card thumbnails | 181 |
| 200px comb cells | 181 |
| brand marks + hero photographs | 10 |
| shrunken hero reels | 6 |
| full-size originals (lightbox, dossier shelf) | 196 |

Measured on the built `beeviro-embed.html`, cold: **0.93 MB first view**, every
byte of it from the CDN. The reels come down at 73–114 KB each instead of
275–427 KB, and the hero photograph at 66 KB instead of 191 KB.

### How the ids were harvested

The media library is behind the GoHighLevel login, so this runs in a browser
that is already signed in. `tools/harvest-media-ids.js` is the paste-into-the-
console version. Driving it directly is faster, and the thing worth remembering
is **how**, because scraping the grid does not work:

- The grid is virtualised and loads **40 files at a time**. Scrolling it
  programmatically from a background tab does not page it: browsers throttle
  timers in unfocused tabs, so the loop ticks about seven times in ten seconds
  and the grid never fetches more.
- The library calls **`services.leadconnectorhq.com/medias/files/`** with
  `altId, altType, parentId, offset, limit, query, sortBy, sortOrder, mode`.
  Drop `parentId`, set `query=bv-` and `limit=100`, and page through `offset` —
  six requests returned all 579 files. Search reaches inside folders, so the
  folder does not matter.
- **Replay it as XHR, not `fetch`.** `fetch` from the page origin is refused at
  CORS; the app's own calls are XHR and the same request succeeds that way.
- Replay it **inside the page** and return only `filename -> media id`. The auth
  headers never have to leave the browser, and the tooling blocks them anyway.
- The id is the tile's element `id` and the filename its `img[alt]` — but the
  API response is better: it carries the real CDN url, so the extension is read
  rather than guessed. That matters for the `.webm` reels, whose `img` is
  GoHighLevel's generated poster frame.

`gen-media-map.mjs` takes any number of id files now and merges them, later
files winning — the library is harvested in batches and re-harvesting 196 files
to add one is silly. The two batches are kept as `bv-media-ids-originals.json`
and `bv-media-ids-light.json`:

```bash
node gen-media-map.mjs ./bv-media-ids-originals.json ./bv-media-ids-light.json
```

### One bug this shook out

The conditional Arabic loader — the inline `<script>` that `document.write`s
`clients.ar.js` only for Arabic readers — was surviving into the embed, where
every script is already inlined. It would have written a relative path that does
not exist on GoHighLevel: a 404 on every Arabic load, mid-parse. `build-embed.mjs`
strips it now, and warns if it ever stops matching.

It is stripped by **scanning**, not by regex. `<script>[^]*?clients\.ar\.js`
looks correct and is not — the lazy quantifier still begins at the *first*
`<script>` in the body, so it deleted everything from there to the loader and
the body came out at 0.0 KB. The build prints the body size on every run, which
is the only reason that was caught in seconds.

---

## Video, and where it belongs

Not the hero. Both reviewers named video weight as the reason the site felt
heavy, and the hero already carries six reels in the comb.

### The dossier film

Fifteen of the twenty-five case files **describe video deliverables and could
only show still frames of them**. Volt EMS's own copy apologises for it —
*"Frames from the finished reels — Volt's deliverables were video, not static
design."* Dar El Hadith has `work: 0`: its entire engagement was four films, so
its dossier had no work section at all.

So where the reel exists, it now plays in the dossier, above the stills, because
for these clients the film *is* the deliverable and the gallery is a poster of
it. **Fourteen clients have one now** — the five cut from reels that were
already on disk (Freestyle, Kinetic Health, Eqbal, Rino's Kitchen, Daily Box)
plus nine pulled out of the client Drive folders the portfolio PDF links to:
Izar, CogniStar, QR Tably, Volt EMS, Black Star, MasterCraft, Electro Master,
Hadeel Maqlad and Dar El Hadith. Beeviro's own showreel stays in the hero comb:
it is not a client.

- **Poster-first.** Nothing loads until somebody presses play, so opening a
  dossier costs exactly what it did before — asserted in `tools/film.mjs`, which
  counts `.webm` requests before and after opening a case and requires zero.
- The poster is the client's **own first gallery image**, which is already a
  light copy and usually already cached. For Volt EMS that image is literally a
  frame of the film. **Dar El Hadith has no gallery to borrow from** — `work: 0`
  — so it carries `film.poster`, a WebP frame cut from the film itself. Without
  that the markup fell back to `src=""`, which the browser resolves against the
  page URL and then fetches and fails.
- `media()`, not `thumb()`: the comb takes the 288px copy, this takes the full
  420px file, because here it is being watched rather than glimpsed in a hexagon.
- Fetched as a **blob**, same defence as the hero comb, so download managers
  have no media URL to offer. Falls back to a direct `src` if CORS refuses.
- The caption is translated in `clients.ar.js`; the `src` is not — one source of
  truth for which file it is.

### Where the nine came from — `tools/ingest-reels.mjs`

```bash
node tools/ingest-reels.mjs [--only slug,slug] [--secs 10] [--size 420]
```

`reel-sources.json` says which Drive file belongs to which client **and why**.
The tool downloads each source once into a cache outside the repo (these are
8–170 MB originals and must never be committed), serves it over a local HTTP
server that honours **Range**, and cuts a square 420px clip in Chrome — canvas +
`captureStream()` + `MediaRecorder`, the same "browser as codec" trick as
`make-thumbs` and `shrink-reels`. It writes a poster JPEG per reel into
`.shots/reels/` because **a film nobody has looked at is a film nobody should
publish**.

Then: `node tools/shrink-reels.mjs --size 288 --kbps 115`.

**Attribution is the hard part, not the transcode.** The links live in the
portfolio PDF's link annotations; pdf.js reads them page by page (there is no
pdf library on this machine, so it runs inside headless Chrome against a
locally-served copy of the file). A link is then attributed to the client whose
**page** it was printed on — never to its folder name. Nine different brands
have a folder called "Reels".

And the page is only evidence. **The file names are proof, and twice they
overruled the page:**

- The "Reels" folder on Renda Perfumes' page contains `Reno's kitchen
  kitchen.mp4`. It is Rino's Kitchen's.
- The "Reels" folder on Rojana Kids Store's page is eight adult women's dresses,
  and Rojana is a children's clothing brand — the content flatly contradicts the
  page. A sibling named `HM Beige dress.mp4`, a count of exactly eight against
  the "8 reels" figure in her record, and a folder full of collection pieces all
  point at **Hadeel Maqlad** instead.

Two folders were **left alone** for the same reason: one sits between the Moafa
App and Renda Perfumes sections with file names that settle neither, and one
could be Dr. Eman Khamis or Hadeel Maqlad. Guessing there puts one client's film
in another client's dossier, which is worse than a dossier with no film.

**Delivered creative only.** Never the `bts/` or `raw/` folders — candid phone
footage of identifiable people is not work a client approved for publication.
That is the same line that kept Dar El Hadith's raw poster frames out of the
gallery.

Two traps this shook out:

- **Google's `_DRIVE_ivd` blob is a JS string literal, and JS escapes are a
  superset of JSON's.** Unescaping `\xNN` is not enough: the rows carry Drive
  urls containing `?usp\=drivesdk`, and `\=` is a legal JS identity escape that
  `JSON.parse` rejects outright. Every folder came back with zero files while
  the listing sat there in the HTML. Strip any backslash that is not one of
  JSON's own escapes.
- **`loadedmetadata` fires for a file Chrome cannot decode.** One QR Tably
  source is a codec Chrome will not read; metadata resolved, `videoWidth` was
  0, the canvas stayed black, MediaRecorder wrote a 110-byte container, and the
  run reported **8/8 cut**. The tool now rejects a 0×0 track and any recording
  under 20 KB — an unavailable path has to fail, not pass. A different file from
  the same folder decoded fine.

To add more, put the client in `reel-sources.json`, run the two commands above,
**look at the poster**, then add `film: { src, note }` to `clients.js` and its
`note` to `clients.ar.js`.

### Ruled out

| | |
|---|---|
| **Hero** | Six reels already play there. A seventh, larger, autoplaying film is the complaint returning. |
| **Services** | Just solved with vector icons that weigh nothing. Video would undo it. |
| **Method** | Six stages means six clips. |
| **Creative carousel** | Autoplaying video inside a 176-tile running strip is the worst of both. |

### Still open: one generated brand film for Voices

Voices is the only section with no visual at all, and it is where the agency's
own voice belongs. That is the one job for Gemini/Veo — prompts, references and
the hard budget are in `hero-video/PROMPTS.md`. Poster-first, click-to-play,
≤1.2 MB. The player is not built; it is waiting on the file.

---

## The strips: two seams and a typo

Reported: *"the bottom infinite loop of pictures isn't working as well as the
band."* Three separate faults, and the comparison in that sentence was the clue —
the marquee band was the one built correctly.

### 1. A 14px hole on every loop of the picture carousels

A seamless loop is the same track laid end to end and wrapped at exactly one
track width. `.bv-reel__track` carries `padding-right: 14px` to space its last
tile from the first tile of the next copy, and that padding is *inside* the width
the driver wraps on. But `.bv-reel` — the flex container — also had
`gap: 14px`, which the wrap knows nothing about. So the second copy started 14px
late and a hole opened at every join.

`.bv-marquee` never had one. That is precisely why the band looked right and the
pictures did not. `.bv-gal__view` had the same bug, so every dossier shelf
hiccupped too.

### 2. Two copies is not enough when the track is narrower than the frame

Worse, and not RTL-specific. Two copies span `2w` while a full loop travels `w`,
so once the strip has moved more than `2w − frame` a hole opens at the trailing
edge and stays open until the wrap snaps it back. That is fine while `w ≥ frame`
and broken the moment it is not.

It surfaced in Arabic first because the Arabic capability words are short — that
band's track is 1240px against a 1440px frame:

| | track | frame | 2 copies | loop travels | |
|---|---|---|---|---|---|
| en @1440 | 1544 | 1440 | 3088 | 1544 | ok |
| ar @1440 | 1240 | 1440 | 2480 | 1240 | **200px hole** |
| en @1920 | 1544 | 1920 | 3088 | 1544 | **hole** |

So it was breaking in **English on any screen wider than about 1600px**, which is
most desktops. `tileStrips()` now clones each track until the copies span the
frame plus one whole loop — 2 copies in English at 1440, 3 in Arabic. It runs for
every tier, not just inside the JS driver, because the lite tier and the no-JS
fallback use a CSS animation that translates by one track width and has exactly
the same requirement.

### 3. The typo that hid behind a passing test

While fixing the above I collapsed `$$` to `$` in `register()`, so `s.tracks` was
a single element instead of a list, `s.tracks.length` was `undefined`, every
`register()` returned null, and **the JS strip driver silently stopped running
entirely** — no exception, the strips just fell back to the CSS animation.

`tools/strips.mjs` still reported 12/12, because its "this strip is not driven by
JS" branch returned `gap: -1` and sailed through a `gap <= 2` assertion. **An
unavailable path has to fail, not pass.** It now reports 9999 there, and
`motion.js` exposes `window.BV_MOTION = { reduced, lite, rich }` — the decision
as taken *at load* — so a test can tell "the driver chose not to run" from "the
driver broke", instead of inferring it from side effects.

### What the tool measures now

Each strip is sampled on rAF **while it is on screen** (an off-screen strip is
meant to hold still), after the scroll velocity has decayed (the strips speed up
with scrolling by design — sampling too soon measures the decay), and each one is
then **parked exactly on its wrap point**, because a seam is only visible at the
join and letting it drift past is how a 14px hole went unnoticed.

Smoothness is measured as **px per second, not px per frame**. The driver
advances by elapsed time, so it holds a constant velocity by construction; what
varies frame to frame is how long the frame took, which is the renderer's
business. Measuring px/frame reported a headless browser at 20fps on a 2560px
viewport as stutter while the strip was perfectly even.

```
  strip    width  tiles   travel  px/frame  px/s  wobble  stalls  gap
  #mq1     1440     13    101.8      2.10    49    0.16       0    0
  #reelA   1440     14    131.7      1.78    62    0.09       0    0
  #reelB   1440     14    118.4      1.38    55    0.08       0    0
  #mq2     1440     15     78.1      0.66    35    0.01       0    0
```

---

## Final review pass

A last sweep over the whole site before it goes back to the supervisors. The
existing suites were all green going in, so this one went looking for what they
do not measure: whether the page reads as one composition, and whether every
control is comfortable to hit.

### The page had three different left edges

Every section pads by `--pad` and caps its content at 1320px, so every eyebrow
and every heading should start on the same inline edge at every width. That
shared edge is most of what makes a long page read as one composition rather
than a stack of blocks — and the honey drip rail runs down it.

Two sections had opted out of it by hand, and at 1440px the page stepped
**72 → 132 → 200** on the way down.

- **Creative** moved the padding off the section so the reels can run edge to
  edge, and put it on the wrap instead. But the wrap is also where the 1320 cap
  lives, so the padding got charged twice: the wrap took the full 1320 and then
  indented inside it. `.bv-wrap--bleed` grows the cap by exactly the padding it
  now contains — `calc(1320px + 2 * var(--pad))`.
- **Voices and Contact** narrowed the *wrap* to a comfortable 1040px reading
  width and left `margin-inline: auto` on it, which centres that narrow box
  inside the wide one and pushes its leading edge 128px in. A measure belongs on
  the text, not on the box that establishes the grid line, so
  `.bv-wrap--measure` caps the children instead.

### The one that only broke in Arabic

`.bv-comb` was doing two unrelated jobs: it was the **faint comb wash** painted
behind dark sections *and* the **honeycomb strip**, a flex row of six cells. The
two sections that only wanted the wallpaper — `#count` and `#work` — were
therefore silently turned into flex containers. Their single `.bv-wrap` child
became a flex item, sized to its own content instead of to the row, and its
`margin-inline: auto` centred it in whatever was left over.

In English the card grid made that content wider than the row, so it filled and
nobody ever saw it. In Arabic the prose is shorter, the wrap shrank to ~1114px
inside a 1296px row, and **the entire Work section — eyebrow, headline, lede and
all twenty-five cards — sat 91px inside the edge every other section shares.**
Same markup, same stylesheet, visible in one language only.

The wash is now `.bv-wash` and carries no layout at all. `#hive` keeps both
classes because it wants both things.

**One class, two jobs, and only one of them is layout — that is the shape of
this bug.** It is worth looking for elsewhere: an accidental flex or grid
container is invisible until a child happens to be narrower than its row.

### `:where()` for a ceiling that must not win

`.bv-wrap--measure > *` looks right and is not. It ties with `.bv-lede` on
specificity and wins on document order, so it quietly widened the contact lede
from its 62ch measure to the full 1040 and left one very long line under the
display type. Written as `:where(.bv-wrap--measure) > *` the rule weighs
nothing, which is what a *ceiling* should weigh: anything that sets a tighter
measure of its own keeps it.

### Footer links were 20px tall

Bare inline text in a 9px-gap list. That squeaks past WCAG's target-size
spacing exception and is still a fiddly thing to hit on a phone. Padding the
anchor to 28px and taking the difference back off the row gap leaves the
footer's rhythm identical.

### `tools/check.mjs` asserts now

It used to only ever print a report, and **a report nobody has to read is a
report that goes green while the page drifts** — the Arabic Work section had
been 91px out of line in every screenshot this tool has ever taken. It now
fails, and exits non-zero, on horizontal overflow, broken images, console
errors, failed requests, targets under 24px, and — the new one — any
disagreement greater than 1px between sections about where the left edge is.
That last check measures from the INLINE start, so the same number has to come
back in Arabic.

`tools/shoot.mjs` had the tier trap the other tools had already been fixed for:
it only wrote `bv:motion` when asked for `--lite`, and the Chrome profile is
reused, so one lite run pinned every later run and the screenshots quietly
stopped showing the site anybody visits. It sets the tier both ways now.

### Checked, and correct — do not re-chase these

- **Work cards look blank in a screenshot taken ~1.4s after scrolling to them.**
  They are not broken. The images arrive at ~1.5s and the shimmer skeleton
  covers the wait; measured at 500/1500/3000/6000ms, the state goes
  `notstarted → ok` and the iris is open the whole time.
- **The phone step-strip's trailing-edge fade** is already mirrored for Arabic
  (`linear-gradient(270deg, …)` under `[dir="rtl"]`).
- **The boot overlay still computes `display: grid` after it lifts** — it is
  `opacity: 0; visibility: hidden; pointer-events: none`. Reduced motion
  dismisses it correctly.
- **Hero comb cells do not take focus** (`tabIndex = -1`, as designed); the 19
  tab stops that saves are still in the a11y tree. Tab order runs skip link →
  brand → nav → language → tier → CTAs → method cells, every one with a visible
  ring.
- **An `IntersectionObserver` does not fire while the document is hidden.**
  Probing the page from a background tab reports every reveal as stuck and every
  lazy image as unloaded. That is the tab, not the site.
- **`$?` after `cmd | tail` is tail's exit status,** not the tool's. Two runs of
  `check.mjs` looked like they were passing while printing failures.

### Verified after

Strips 12/12 at 1440/1920/2560 × en/ar and lite at 1440/1920. Flow 12/12 en and
ar, film 12/12 en and ar, pointer 11/11, light audit all-pass. `check.mjs` all
checks passed at 390/900/1280/1440/1920 in English, Arabic and lite: no
overflow, no broken images, no console errors, no failed requests, no target
under 24px, and one left edge — 72px at 1440, 620px at 2560, 20px at 390 — in
both directions.

### Still the one visible gap

**Voices is the only section with no visual.** It is a pull quote on an empty
screen, and it is where the generated brand film goes: prompts, references and
the ≤1.2 MB budget are in `hero-video/PROMPTS.md`, poster-first and
click-to-play. The player is not built; it is waiting on the file.

### What the code review changed

A reviewer went over both batches. Everything below is a real defect it found;
none of it was visible from the site.

**The dossier film leaked its blob.** `URL.createObjectURL` is only released by
`revokeObjectURL` — replacing `panel.innerHTML` throws the `<video>` away and
keeps the ~450 KB blob behind it alive for the life of the document. Play films
in eight case files and several megabytes are retained, on exactly the device
class this site exists to protect. There is now a bounded cache keyed by url
(`beeviro.js`, `filmBlobs` / `keepFilmBlob`), the same shape as the hero comb's:
three held, oldest revoked, so reopening the case you just left is free and the
ceiling is about 1.5 MB. Verified end to end — five films fetch five times,
reopening the newest fetches nothing, and reopening an evicted one re-fetches
rather than handing a revoked url to a video.

**Nine 288px reel copies that nothing could ever request.** `shrink-reels.mjs`
shrank everything in the reels folder, which was right when the folder held only
hero-comb reels. A dossier film is watched at 420px in a 420px block and
resolves through `media()`, so its small copy was 1.4 MB of files in the
deployable root that no code path can reach — plus nine light-map entries, every
one of which `audit-light.mjs` then demanded be uploaded to the CDN so that
nothing would fetch them. It now reads the comb's slug list out of `hive.js`
rather than repeating it, and `audit-light.mjs` asserts the small-copy set is
**exactly** that list — no missing copy, and nothing left over.

**`audit-light.mjs` could not see the films at all.** It walks `BV_THUMBS` and
`BV_CELLS`; a film's `src` and `poster` are shipped display assets referenced
from `clients.js` DATA, so they were in neither, and `build-embed.mjs`'s
attribute rewriting never sees a path that lives in data either. Once the reels
were uploaded this tool would have gone all-green while Dar El Hadith — the one
dossier with no gallery to fall back on — still showed a broken poster. Section
7 is now driven by the client records instead of the maps.

**Three assertions that could pass without running.**
- `check.mjs` dropped any section with no eyebrow out of the grid-line sample
  silently; with none left, spread is 0 and the check goes green having measured
  nothing. It now reports how many it saw and fails if that is not every
  section but the hero.
- `film.mjs` had two skip branches. One asserted a literal `true`; the other put
  three assertions inside an `if` with no `else`, so if Dar El Hadith ever gained
  a gallery the suite would drop from 15/15 to 12/12 and still say everything
  passed — and the three that vanished are the ones covering the `src=""` bug.
  A missing fixture is now a finding.
- `film.mjs` also still hard-coded `freestyle` as its subject, one block above
  the comment explaining why hard-coding `izar` had been wrong, and tested the
  film src with a `reels/small` substring — the exact test the neighbouring
  comment says proves nothing once every asset is an opaque CDN id. Both now ask
  the site's own resolvers.
- `audit-light.mjs`'s `181` card/cell counts were still typed in; they are
  counted off disk now, like the reels.

**`ingest-reels.mjs` hardening.** The download cache was keyed by slug, not by
Drive id — so correcting an `id` in `reel-sources.json` (which has already
happened twice) would silently re-cut from the stale file. The Range server
bound `0.0.0.0`, serving every unpublished client original to the LAN for the
minutes a run takes; it is `127.0.0.1` now, on a pid-derived port, with error
handling on the server, the streams and the request handler, and `end` clamped
to EOF. The download streams to a `.part` file and renames, so a half-written
file can never be mistaken for a good cache entry and peak memory is no longer
twice the source. A dead Chrome now fails instead of hanging forever: there is a
guard when devtools never comes up, every pending call is rejected if the socket
closes, and `ev()` has a ceiling. In the page, one persistent `error` listener
replaces the per-promise ones — a decode failure *during* the recording used to
be invisible — the seek timeout rejects instead of resolving (it used to cut
from wherever the video happened to be and call it a success), and the recording
window is clamped to what the source actually has left, so a short source gets a
shorter clip rather than a frozen tail in a looping player.

**Deliberate, after checking:** `.bv-wash` still sets no `position`. On `#count`
and `#work` the wash fills the section; on `#hive` it resolves against the
sticky method stage and washes the whole stage. That is the behaviour it had as
`.bv-comb::before` and it is kept — the comment now says so, so it is a decision
rather than an inheritance.

---

## Mobile-native pass

Built test-first: `tools/mobile.mjs` was written against a specification of what
"native on a phone" means, run to watch it fail, and only then was the CSS
changed. It went in at **6/15** and came out at **19/19**.

```bash
node tools/mobile.mjs [--lang ar] [--landscape] [--w 390] [--h 844]
```

Everything is driven with **real touch events** through
`Input.dispatchTouchEvent`. That matters: `touch-action`, passive listeners and
scroll chaining only exist on the touch path, so a touch regression passes every
mouse-driven test in this repo. `flow.mjs` already used CDP *mouse* input for
the same reason at the other end.

### What the failures were

| | |
|---|---|
| No `viewport-fit=cover` | iOS letterboxes the page beside the notch, so the full-bleed carousels stopped at a black bar. |
| No `env(safe-area-inset-*)` | Once the page owns the whole screen, the fixed masthead, the menu, the dossier close button and the lightbox all have to pad themselves out of the notch and the home indicator by hand. `max(design, env(...))` so a phone with no notch keeps the design's own padding. |
| `-webkit-tap-highlight-color` was the default | The grey-blue rectangle the OS paints over whatever you touched. It fires on scroll-starts as well as taps and is the most obviously not-native thing on a touch site. |
| `-webkit-text-size-adjust: auto` | iOS re-guesses a "readable" body size on rotate. On a page built from `clamp()` display type that guess is always wrong and the headline reflows. |
| `touch-action: auto` everywhere | The browser holds every tap ~300ms in case it becomes a double-tap zoom. The cheapest perceived-speed win on touch. |
| Lightbox and menu chained their scroll | A swipe past the end of an overlay scrolled the page underneath it. |
| Targets in the high twenties | Fine to click, fiddly to tap. 44px on coarse pointers only — the desktop rhythm is untouched. |
| The landscape menu didn't fit | 390px tall against a menu built for 844: two of the eight entries sat below the fold of a sheet with no affordance saying more existed. Two columns now, nothing scrolled. |

### Two things the test disproved, and one it caught

**Disproved — so nothing was changed.** A vertical swipe over a carousel already
scrolled the page (245px), and the dossier already contained its own scroll.
Both were on my list of suspected bugs; the test said no, so the code was left
alone. That is the whole value of writing it first.

**Caught.** Adding `touch-action: manipulation` broke dragging the carousels.
`manipulation` is `pan-x pan-y pinch-zoom`, so the browser claims *both* pan
directions and cancels the pointer stream the drag handler listens to — the
strips went from 170px of throw to 24px. The strips carry `pan-y` instead:
vertical stays with the browser so a thumb travelling down the page still
scrolls, horizontal is left to the JS. **Both directions are asserted now**,
because fixing one gesture by breaking the other is a trade worth failing on.

### Press feedback is not optional after removing the highlight

Suppressing the tap highlight removes the only signal that a tap landed, so
every control gets a real `:active` state under `@media (pointer: coarse)` —
opacity at 60ms, a slight scale on the CTAs, an image nudge on cards, a dim on
carousel tiles. Without those this change would be a downgrade wearing the
clothes of a polish pass. The hover-pop and the pointer companion never run on
touch, so tiles had *no* press state at all before.

### Two assertions that pass and always did

The page behind an open dossier does not move when its margin is swiped, and
closing it puts the reader back where they were. Both passed on the first run —
they are regression guards, not fixes, and they are labelled as such here so
nobody reads them as work that was done.

### Verified

`mobile.mjs` **19/19** in portrait and landscape, English and Arabic. No
desktop regression: `check` en/ar/lite all pass, `flow` 12/12 both languages,
`film` 15/15 both, `strips` 12/12, `pointer` 11/11. Cold weight unchanged —
every rule is inside `pointer: coarse`, a short-viewport query, or a root
declaration with no desktop effect.

### The hosted build had no viewport meta at all

The rebuild exposed it: `build-embed.mjs` drops `<head>` — GoHighLevel owns the
title and meta tags — so the bundle went out with **no viewport meta**, every
`env(safe-area-inset-*)` in the inlined stylesheet resolved to 0, and iOS
letterboxed the page. All the safe-area work was inert in the one build that
actually ships to phones.

The check had missed it because it read `site/index.html` off disk no matter
which `--url` was under test: a source check that reports the standalone
build's markup while claiming to describe the bundle. It reads the live DOM
now, and the two builds can be compared directly:

```bash
node tools/mobile.mjs --url file:///…/beeviro-embed.html
```

The fix is in `perf.js`, the first script in the document: it appends
`viewport-fit=cover` to the viewport meta, creating the tag if there isn't one.
Appended rather than replaced, because GHL may have written its own scale
settings into that tag and those are not ours to discard, and idempotent, so
the standalone build — which already declares it in markup — is untouched.
`tools/mobile.mjs` now passes **19/19 against the bundle** as well as the site.

---

## No fullscreen, and a faster work shelf

Both built test-first. `tools/video.mjs` is new; the shelf assertions went into
`tools/film.mjs`.

### Videos cannot be taken fullscreen

Every video here is framed on purpose — six reels inside hexagons, a client's
film in a 420px square. Fullscreen throws the frame, the crop and the page away
and blows a 420px file up on a black screen, which is the worst possible view of
the work, and it is a route back to the raw media the blob-url handoff exists to
close.

```bash
node tools/video.mjs [--lang ar]
```

**`controlslist="nofullscreen"` was not enough, and the test proved it.** It
removes the button and nothing more: Chrome treats the list as a hint, and
`requestFullscreen()` still works. Asked **with a real user gesture** — CDP's
`Runtime.evaluate` has a `userGesture` flag, without which fullscreen rejects on
its own and the assertion passes while proving nothing — the film went
fullscreen every time. So the attribute is the polish and a document-level
`fullscreenchange` guard is the guarantee: any `<video>` that reaches fullscreen
is put straight back.

iOS is a third path. It honours neither `controlsList` nor the Fullscreen API
and fires `webkitbeginfullscreen` from its own gesture, which headless Chrome
cannot produce. `BV_NO_FULLSCREEN(v)` handles it per element, and the test
asserts **the wiring** — that the helper handles the iOS event and that every
file building a video calls it. The first version of that assertion demanded the
literal event name in both files, which would have failed a correct
implementation and passed a duplicated one.

### The work shelf runs at 139 px/s instead of 61

Measured, not guessed. The shelf was the slowest strip on the site while
carrying the largest tiles, and a big object crossing the frame at a given
px/second reads as slower than a small one — it needed *more* speed than the
home reels to feel equally alive, not the same.

Two things came out of the measurement:

- **The pace is per TILE now, not a flat duration.** Speed is width ÷ duration,
  so a single `--dur` for every shelf meant a sixteen-piece gallery ran four
  times faster than a four-piece one. It is `work × 2.4s`, so all twenty-five
  read the same.
- **`--dur` is written as a concrete value, not `calc()`.** The driver reads it
  with `parseFloat(getComputedStyle(el).getPropertyValue('--dur'))`, and an
  unregistered custom property computes to its raw token sequence — so
  `parseFloat("calc(8 * 2.4s)")` is `NaN` and every shelf would have silently
  fallen back to the 40s default. The stylesheet keeps the `calc()` only as the
  no-JS fallback.

The CSS fallback used `--n × 6.4s`, so the lite tier and the no-JS build were
running the shelf at **a third** of the full tier's pace. Both now read the same
`--dur`.

**A faster strip makes its brakes more important, not less**, so hovering-stops
and resume are asserted at the new speed — 0px of drift while held, 127px after
release. And the pace is checked on a phone as a **band**, not a floor: 126 px/s
there, 0.32 screen-widths per second. Too fast is as much a failure as too slow,
and a third as much viewport is not something a desktop measurement can tell you.

---

## The jitter hunt

Reported: *"a lot of jitter, especially when opening case files."* Four of my
first five hypotheses were wrong, and the only reason the right answer turned up
is that every guess was tested instead of implemented.

```bash
node tools/jank.mjs [--cpu 4] [--lite] [--w 390] [--profile]
                    [--no-blur] [--no-shadow] [--no-deal] [--no-shell]
```

**CPU throttling makes it reproducible.** On this machine nothing janks, so
`Emulation.setCPUThrottlingRate` at 4× stands in for the mid-range phone the
reviewers were using. The sweep is worth knowing: **1× blocks for 0ms, 2× for
55ms, 4× for 2495ms.** The cliff between 2× and 4× is frames starting to miss
and work piling up behind them.

**The `--no-*` switches are the point of the tool.** Each one strips a suspect
property from the page for one run. If the number moves, that was the cost; if
it does not, the next guess would have been wrong. That is what happened four
times.

### What it found

**1. Nothing stopped when a dossier covered the page.** The hero canvas kept
stroking a few hundred hexagons a frame, the comb kept oscillating with six
videos decoding inside it, four strips kept writing transforms, the drip rail
kept animating — all behind a full-screen overlay, all invisible.

`hideBackground()` already meant "hidden from assistive technology". It now also
means hidden from the renderer, because those are the same fact and the site was
acting on only one of them. One `bv:cover` event, broadcast once per state
change rather than polled per frame; every expensive loop listens. New effects
get it for free, which is the point — each loop used to invent its own idea of
when it was allowed to run, and a case file was on nobody's list.

Two details that matter: the pointer companion is deliberately *not* paused (the
honey cursor draws on top of the overlay and has to keep tracking), and the
strip freeze has two levels — the lightbox stops everything including the case
shelf, a dossier stops only what is behind it, or opening a case would freeze
the one strip the reader is looking at.

**2. The work shelf loaded full-size originals.** Sixteen ~1200px images for a
client like Moafa, non-lazy by design, all decoding inside the open transition —
into a shelf 370px tall. It uses the same 480px tier as the cards now; the
lightbox still opens the full-size file, which is where the work is actually
looked at.

**3. The shelf is built after the transition, not during it.** It is a screen
and a half below the fold when a case opens, so it is mounted on
`requestIdleCallback` with a timeout, into a slot that reserves its height.

**4. THE ONE THAT MATTERED: `backdrop-filter` running during motion.** A CPU
profile settled what four hypotheses could not — our own JavaScript for a case
open totals about 150ms, while `(program)`, the browser's own style/layout/paint,
was **2.7 seconds**.

Holding the blur radius constant did *not* help, and that is the interesting
part: the radius was never the problem. A backdrop-filter re-blurs everything
behind it whenever that scene changes, and the shell scales over the veil for
520ms — so the blur was recomputed on every frame of the animation. The frame
timeline is what showed it, because aggregates were too noisy to attribute
anything:

```
baseline   … 100 83 83 83 117 83 50 117 ms
--no-blur  …  67 67 67 50 33 67 67 100 ms      ← the tail collapses
--no-deal / --no-shell   no change at all
```

So the blur is applied **at rest and never during motion** — `.is-settled`, set
on the shell's `transitionend` with a timeout as the guarantee. The dossier dims
instantly, animates against a cheap translucent layer, and gains its blur once
it lands. It reads as a focus pull rather than a hitch, and costs one composite
instead of thirty. Same for the lightbox.

And `saturate(.7)` is gone: measured at 4×, scrolling an open dossier cost 31
stalled frames with blur+saturate and 25 with blur alone — a whole second filter
pass over the viewport for an effect the 62%-opacity dim above it was already
doing. The radius came down to 4px on the same evidence.

### Wrong hypotheses, kept honest

The 130px box-shadow, the staggered section reveal, the shell's scale and the
journey rail's layout reads were all tested and all exonerated. `trackJourney`
*was* calling `panel.getBoundingClientRect()` inside its per-step loop — thirteen
forced layouts per scroll frame — and that is fixed because it is plainly wrong,
but the measurement is clear that it was not the bottleneck. It is recorded here
as a correctness fix, not as a performance win.

### Two budgets, because they are two experiences

A single number hid both. **The build frame** is one hitch — parsing and laying
out a dossier — and one long frame at the start of a deliberate transition reads
as weight, not jitter. **The animation after it** is what "jitter" means, and it
is judged on the median frame from frame 4 onward so the build cannot flatter or
spoil it. Scrolling is judged the same way: a single long frame there is one
`content-visibility` section rendering for the first time, which is the whole
point of deferring it.

The blocking-total check is a **regression gate, not a tight budget**, and says
so — it swings 1200–1850ms run to run on identical code, and exists to catch
bulk work coming back from the 2495ms this started at.

### Where it landed — and why the numbers are relative

**A correction worth reading before the results.** I first reported absolute
figures here — "2495ms → ~1300–1800ms blocked". Those were drawn from too few
samples of a metric that turned out to swing enormously. Repeated runs of
*identical* code drifted from 83ms/frame to 183ms/frame over an afternoon —
nothing to do with the site, everything to do with what else this machine was
running as free RAM moved between 4 and 12 GB. Absolute thresholds in this
harness measure the user's other applications.

So `tools/jank.mjs` asserts nothing absolute. It opens the same dossier twice
in one session — once as the site is now, once with the blur forced back on
during the motion — and compares. Both arms meet whatever conditions currently
hold, so the difference is meaningful even when the absolute numbers are not.
If somebody deletes the fix, the two arms become identical and it fails, which
is the only thing a regression test here can honestly promise.

Four consecutive paired runs:

| | blur at rest | blur during motion |
|---|---|---|
| run 1 | 50 ms/frame | 100 ms/frame |
| run 2 | 50 | 83 |
| run 3 | 50 | 83 |
| run 4 | 67 | 83 |

An earlier paired set, taken hours before under heavier load, read 83/83/100/83
against 100/117/133/117 — different absolutes, same conclusion. That is the
whole argument for pairing.

The build frame, the total blocked time and the scroll medians are **printed but
not asserted**, and the tool says so where it prints them. Gating on a number
that moves ±50% on unchanged code trains you to re-run until green, and the next
real regression gets re-run away with it.

---

## "Some carousels break, stop, or slow down to the point of appearing frozen"

Reported after the jitter pass. My first suspect was my own work — the freeze
logic had just changed — so that got tested first and cleared: every strip
resumes after a dossier or a lightbox closes, and `COVERED` unlatches correctly.

The real cause was older and simpler.

### A strip's setting is a SPEED. It was written as a duration.

Both the CSS fallback (`translateX(-100%)` over `--dur`) and the JS driver
(`speed = width / dur`) get their pace by dividing the track's width by that
time. So a fixed `--dur` means the pace changes whenever the track's width
does — and the width changes for two reasons nobody had in mind when `168s` was
typed against a 1440px English page on the full tier:

| | track | `--dur` | pace |
|---|---|---|---|
| `#reelA` full | 10824 px | 168 s | 64 px/s |
| `#reelA` **lite** | **5412 px** | 168 s | **32 px/s** |
| `#mq2` English | 1544 px | 44 s | 35 px/s |
| `#mq2` **Arabic** | **1240 px** | 44 s | **28 px/s** |

**The lite tier builds half the carousel tiles** to save memory and decode work,
so the creative reels ran at half speed — for exactly the readers whose devices
were already struggling. At 28 px/s a 232px tile takes eight seconds to move its
own width, which is "so slow it looks frozen". The marquees' tile count does not
change with the tier, which is why it was *some* carousels and not all.

And **Arabic capability words are shorter**, so that marquee ran 20% slower in
one language than the other — the same defect on a second axis, found only
because the new assertion was run against both languages.

The pace is now authored as px/s (`data-px-per-sec`) and the duration computed
from the width actually laid out, re-derived after `document.fonts.ready` —
a marquee's width is its text, and text measured before its webfont lands is the
wrong width — and again on resize. Every strip now runs at its designed pace on
both tiers in both languages, and the full tier is unchanged from what it was.

### The assertion that was missing

`tools/strips.mjs` measured one tier at a time and asked "is it moving". 32 px/s
is moving. It now also checks the pace implied by `width / --dur`, which is
computed from layout rather than sampled — deterministic, no load sensitivity —
and the **same band is asserted whether the run is lite or full, English or
Arabic**. Halve a tier's tiles again, or shorten a language's copy, and it fails
on that tier alone.

That check found the Arabic marquee within a minute of being written, which is
the whole argument for testing the invariant rather than the instance.
