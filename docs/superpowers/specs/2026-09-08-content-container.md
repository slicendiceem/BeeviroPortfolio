# The content container — spec

## What was asked

From the supervisor, verbatim:

> in the website there needs to be a container where when adding a new page it
> is added in this container that when adding anything new like case studies
> etc. but there must be no backend whatsoever
>
> بحيث لما نضيف صفحات جديده يعمل pull و تبقى باينه
>
> محتاج تسهل عليا ال embed

Three requirements:

1. **A container.** One place where a new page — a new case study — is added.
2. **A pull, with no backend.** The live site fetches that container itself, so
   a new case appears without rebuilding or re-pasting anything.
3. **An easier embed.** The current flow pastes a 528 KB file into GoHighLevel
   on every change. That has to stop.

## What already exists

The site is already fully data-driven. Every surface — the work grid, the hero
comb lattice, the two creative reels, the counters, the case panel and its
`#case=<slug>` route — is built from `window.BV_CLIENTS`. **A "page" on this
site is a record in that array.** There is no page-adding problem to solve;
there is a *delivery* problem: that array is baked into the bundle.

Two properties of the existing code make the fix small:

- `media()` (`site/js/beeviro.js:51`) returns any absolute URL unchanged, and
  `light()`/`thumb()` fall through to it. So a client whose images are absolute
  URLs already renders everywhere, with no code change and no media-map entry.
- `index.html` already loads a second data file with a plain script tag, and
  `i18n.js` already merges a second language over `BV_CLIENTS` by slug. The
  merge point exists.

## The approach

**The container is a JavaScript file hosted on GitHub Pages, loaded by an
ordinary parser-blocking `<script src="https://…">` tag.**

```
clients.js  (25 baked-in records)
clients.ar.js  (Arabic, conditional)
content.js  ← THE CONTAINER, remote, absolute URL          [new]
js/content.js  ← validates and merges it into BV_CLIENTS   [new]
i18n.js
beeviro.js  → renders
```

Why a script tag and not `fetch`:

- **It blocks the parser**, so the merge is finished before anything renders.
  Nothing in the boot sequence, the render path or the motion tiers has to be
  restructured, and there is no flash of the old content.
- **It needs no CORS headers**, unlike `fetch`. A classic script tag is
  cross-origin by default.
- **It fails safely.** If GitHub Pages is unreachable the tag 404s,
  `window.BV_CONTENT` stays undefined, the merger returns immediately, and the
  page renders the 25 baked-in records exactly as it does today. A new case
  study can never take the site down — the worst it can do is not appear.
- **The codebase already does this** for `clients.ar.js`.

"Pull" becomes literal: edit `content.js`, `git push`, live in ~10 minutes
(GitHub Pages serves `Cache-Control: max-age=600`).

### Images for a new case

A baked-in client numbers its pieces out of `assets/work/<slug>/NN.jpg` and
stores the count in `work: N`. A pulled client has no such folder, so it
carries an explicit `shots: [url, url, …]` of absolute URLs — uploaded through
the GoHighLevel media library UI, which the team already uses.

The merger sets `c.work = c.shots.length`, which means **all fourteen existing
readers of `c.work` keep working unchanged**. Only the two functions that build
a path from a slug need to consult `shots` first.

### The easier embed

Once GitHub Pages hosts one file it can host three. The bundle moves there and
the GoHighLevel paste becomes a fixed three-line snippet that never changes
again: a root div, a stylesheet link and a script tag. Updating the site
becomes `git push`, with nothing pasted.

## Non-goals

- A general page-type system. "Pages" here means case studies, which is what
  was asked for and what the site renders. The container format leaves room for
  more types; nothing speculative gets built.
- A CMS, an admin login, or anything server-side. There is no backend.
- Changing the 25 shipped records, the editorial rule, or the redaction rule.

## Constraints carried in from the project

- **REDACTION RULE.** Nothing published may contain competitor names or
  teardowns, internal media budgets, unpublished projections, phone numbers or
  personal handles. `sources/` must never ship. The content repository is
  public — it must contain **only** the container file and the site bundle.
- **EDITORIAL RULE.** `outcome.kind: 'result'` only when the figure is
  published in the client-approved document. Never promote a `goal` to a
  `result` without a source. Never add a metric without a `note`.
- **Client films: delivered creative only** — never `bts/` or `raw/`.
- Vanilla ES2019, no build step, no dependencies, no framework.
- `site/` is the only deployable root.

## New constraint this introduces

**Anyone who can push to the content repository can run JavaScript on the live
site**, because the container is loaded as a script. Keep the repository's
collaborator list to people who already have publish rights to the site. This
is stated so it is a decision rather than an accident.

## Acceptance

- A case study added to `content.js` appears in the work grid, the reels, the
  hero comb and the counters, and opens at `#case=<slug>` — with the deployed
  bundle untouched.
- Its images load from absolute URLs with no media-map entry.
- With the container host blocked, the site renders all 25 baked-in records
  and logs nothing fatal.
- A malformed record is dropped with a console warning; the rest still render.
- A colleague can produce a valid `content.js` from a form without editing code.
- `node tools/content-check.mjs` fails on an editorial-rule breach.
- The existing suites still pass: `check`, `strips`, `flow`, `film`, `video`,
  `mobile`, `pointer`, `jank`.
