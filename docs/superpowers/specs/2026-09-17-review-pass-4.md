# Review Pass 4 — Spec

**Source:** `تعديلات (4).pdf`, client review of the live portfolio, received 2026-09-17.
**Status:** scoped and approved for implementation.

The review is five numbered notes in Egyptian Arabic plus two screenshots. This
spec translates each note, records what was decided about it, and states the
constraints any implementation has to hold. Two plans implement it:

- `docs/superpowers/plans/2026-09-17-review-pass-4-structure.md` — notes 1, 3, 4
  and the mechanical half of 2 and 5. Code and assets.
- `docs/superpowers/plans/2026-09-17-review-pass-4-copy.md` — the editorial half
  of notes 2 and 5. Prose, in both languages.

They are split because the second one cannot start until the first has defined
what "bidi-safe copy" means and shipped the checker that enforces it. Each plan
leaves the site working on its own.

---

## The review, note by note

### Note 1 — the hero comb

> الخلايا فيه اكتر من بروجيكت نقدر نستخدمهم بدل ما نعيد، وفيه ماتريال افضل من
> اللي محطوطة في كل بروجيكت. الفيديو دة ممكن نشيله ونحط فيديوهات لماستر كرافت
> V 2 NEW.mp4

> *The cells — there are more projects we could use instead of repeating, and
> there is better material than what is placed in each project. This video can
> be removed and MasterCraft videos put in instead.*

Three separate complaints:

1. **The comb repeats brands.** `site/js/hive.js` sets `PER_CLIENT = 2` and
   builds its pool from images `01` and `02` of each client. 23 clients have
   work, so the pool is 46 pieces for 19 cells — a brand can reappear before the
   comb has shown everyone.
2. **The material is the weakest available.** Images `01` and `02` are whatever
   sorted first in the folder, not each client's strongest piece.
3. **One reel does not belong.** The attached screenshot is a dark frame of a
   round dish. Confirmed with the client as **Rino's Kitchen**. MasterCraft
   replaces it.

**Decided:** widen the pool algorithmically — no per-client curation, so this
ships without waiting on anyone to choose 46 images. Swap the reel roster.

`site/assets/hero/reels/master-craft.webm` already exists at 420px. It has no
`small/` copy and is not in the roster, which is the whole of the work.

**Not in scope:** the client named a file, `V 2 NEW.mp4`. It is not on this
machine and is not needed — the existing MasterCraft reel is a real delivered
cut. If they send `V 2 NEW.mp4` and want that specific cut instead, it is a
re-run of `tools/ingest-reels.mjs --only master-craft`, not a code change.

### Note 2 — Arabic is broken

> الترجمة بالعربي بايظة فيها مشكلة في الويبسايت
>
> *The Arabic translation is broken, there is a problem with it on the website.*

### Note 5 — the client copy does not read

> الكلام عن كل عميل برضو فيه مشكلة مش واضح او مش مفهوم
>
> *The copy about each client also has a problem — it is not clear or not
> understandable.*

Attached: the Izar case file in Arabic, with the outcome headline reading
`809+ عملية شراء · 1.15~ مليون ج.م · عائد 9–13.2`.

These two notes are one root cause plus one editorial problem, and both are real.

**The mechanical half — confirmed, measured.** Latin and numeric runs inside
Arabic paragraphs are not isolated, so neutral characters next to them take the
paragraph's direction and jump to the wrong side, and numeric ranges read
backwards. Measured in a real bidi engine against the live data:

| authored | reader sees | |
|---|---|---|
| `~EGP 1.15M` | `EGP 1.15M~` | tilde crosses the number |
| `~1.15` | `1.15~` | **exactly what the client screenshotted** |
| `9–13.2` | `13.2–9` | a range reading backwards |
| `25 → 43–57` | `57–43 → 25` | an arrow pointing at its own origin |
| `(25–34، 35–44)` | `(34–25 ،44–35)` | age bands, in the Izar diagnosis |

**21 fields across 8 clients** are affected. It is not a translation problem at
all — the Arabic words are fine; the numbers inside them are inverted. It also
explains why note 5 says the copy is *"not understandable"* rather than *"badly
worded"*: a reader hitting `13.2–9` and `34–25` in consecutive paragraphs stops
trusting the page.

**The editorial half.** Beyond the inversion, the client wants the per-client
copy rewritten: **a more Egyptian Arabic register, and copy that is informative
and clear in both languages.** This applies to `clients.ar.js` *and*
`clients.js` — the English is in scope too.

**Decided:** both. The mechanical fix and its checker land in the structure
plan; the rewrite is the copy plan and is authored against the checker.

### Note 3 — brand logos for the clients

> في العملاء اللي تحت ممكن نحط لوجوهات البراندات بدل ما تيجي صور من المحتوي
> بتاعهم (هجمعهم في فولدر وابعتلكوا الفولدر كامل)
>
> *For the clients below we could put the brands' logos instead of taking
> images from their content — I'll gather them in a folder and send you the
> whole folder.*

Attached: the Selected Work grid, where each card's cover is the client's
`01.jpg` campaign image.

`site/js/beeviro.js` already prefers `c.logo` over gallery art — but only for
clients with `work: 0`, of which there are two. 23 cards show campaign images.

**The folder has not arrived.**

**Decided:** build the pipeline now, let the assets land later. The `logo` field,
the rendering preference and the light-copy step all ship; the gallery-shot
fallback stays, so the site is correct with zero logos present and correct again
with all 25. Dropping the folder into `site/assets/logos/` and re-running
`tools/squeeze.mjs` then becomes a data change, not a code change.

### Note 4 — the order of the work

> نحط اول واحدة revenue lab علشان ممكن يفتحها بالصدفة كعميل بيشوف الشغل اللي
> اتعمله وتعجبه ويشترك
>
> *Put Revenue Lab first, because a prospect might open it by chance, see the
> work that went into it, like it, and sign up.*

Requested order:

1. `revenuelab360`
2. `cognistar` — *"+ updated material"*
3. `master-craft`
4. `tamahwour`
5. `speakup`
6. `kinetic-health`

> الباقي عادي بعد كدة — *the rest is normal after that*, i.e. the remaining 19
> keep their current relative order.

The grid shows six cards before "Show more work". The six named are exactly one
page: this is a request about what a first-time visitor sees without scrolling,
not a reshuffle of the whole list.

**Decided:** implement as an explicit order list rather than by physically moving
records. The client has now reordered once and is reasoning about ordering as a
commercial decision, so they will do it again; a list of 25 slugs is a safe,
reviewable edit, and moving 200-line record blocks is not.

**"cognistar + updated material"** is an asset request with no material attached.
Out of scope here. Logged so it is not lost.

---

## Constraints

Carried from the existing plans in this repository; every task inherits them.

- **REDACTION RULE.** Nothing published may contain competitor names or
  teardowns, internal media budgets, unpublished projections, phone numbers or
  personal handles. `sources/` must never ship.
- **EDITORIAL RULE.** `outcome.kind: 'result'` only where the figure is published
  in the client-approved document. Never promote a `goal` to a `result` without a
  source. Never add a metric without a `note`.
- Site JavaScript is **plain ES2019**: `var`, `function`, no arrow functions, no
  `const`/`let`, no template literals, no optional chaining. It must run from
  `file://`. Tooling under `tools/` and at the repo root is modern Node ESM and
  has no such limit.
- **No dependencies and no build step.** There is no `package.json` and none is
  to be added.
- `site/` is the only deployable root.
- Never hand-edit `beeviro-embed.html`, `split/*`, `site/js/media-map.js` or
  `site/js/thumb-map.js` — all four are generated.
- Anchor every edit on unique surrounding text, never on line numbers. A previous
  line-numbered edit in this repo silently clobbered working code twice.

## Environment

The repository was developed on Windows and this working copy is on Linux. Every
Chrome-driven tool under `tools/` hardcodes
`C:/Program Files/Google/Chrome/Application/chrome.exe` and exits with
`chrome not found` here. **There is no Chrome or Chromium installed on this
machine at all.**

That blocks `shrink-reels`, `squeeze`, `make-thumbs`, `ingest-reels`, `check`,
`flow`, `jank`, `film`, `mobile`, `profile`, `shoot`, `strips`, `video` and
`weigh` — which is every asset tool and every verification tool in the
repository. The structure plan opens by fixing the lookup; installing a browser
is a prerequisite the operator has to satisfy.

## Out of scope

- `V 2 NEW.mp4` — not supplied; the existing MasterCraft reel is used.
- CogniStar "updated material" — not supplied.
- The brand logo image files — not supplied; the pipeline that consumes them is.
