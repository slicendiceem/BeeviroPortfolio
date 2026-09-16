# Content Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new case study be added to one hosted file and appear on the live site with no rebuild, no re-paste and no backend — and collapse the GoHighLevel embed from a 528 KB paste to three fixed lines.

**Architecture:** A container file (`content.js`) hosted on GitHub Pages is loaded by an ordinary parser-blocking `<script src="https://…">` tag placed between the shipped data files and `i18n.js`. Because it blocks the parser, `window.BV_CONTENT` is defined before anything renders, so a small merger folds its records into `window.BV_CLIENTS` by slug with no change to the boot sequence or the render path. If the host is unreachable the tag simply fails and the 25 baked-in records render as they do today. Images for a pulled case are absolute URLs, which `media()` already passes through untouched.

**Tech Stack:** Vanilla ES2019 browser JS (no framework, no build step, no dependencies), Node 18+ ESM for tooling, headless Chrome over CDP for verification, GitHub Pages for static hosting.

**Spec:** `docs/superpowers/specs/2026-09-08-content-container.md`

## Global Constraints

Every task's requirements implicitly include these.

- **REDACTION RULE.** Nothing published may contain competitor names or teardowns, internal media budgets, unpublished projections, phone numbers or personal handles. `sources/` must never ship. **The content repository is public and must contain only `content.js` and the site bundle — never the project directory.**
- **EDITORIAL RULE.** `outcome.kind: 'result'` only when the figure is published in the client-approved document. Never promote a `goal` to a `result` without a source. Never add a metric without a `note`.
- **Client films: delivered creative only** — never `bts/` or `raw/`.
- Site JavaScript is **plain ES2019**: `var`, `function`, no arrow functions, no `const`/`let`, no template literals, no optional chaining. It must run from `file://`. Tooling under `tools/` and at the repo root is modern Node ESM and has no such limit.
- **No dependencies and no build step.** There is no `package.json` and none is to be added.
- `site/` is the only deployable root.
- **Anyone who can push to the content repository can run JavaScript on the live site.** Limit collaborators to people who already have publish rights.
- Never edit `beeviro-embed.html`, `split/*` or `site/js/media-map.js` by hand — all three are generated.
- Anchor every `sed`/`Edit` on unique surrounding text, never on line numbers. A previous line-numbered edit in this repo silently clobbered working code twice.

---

### Task 1: Absolute script tags survive the embed build

`build-embed.mjs` strips **every** `<script src="…">` from the body, because those are the nine local files it inlines. The container tag is different: it is hosted outside the build on purpose, and it must survive into the pasted bundle or the whole feature dies at the GoHighLevel boundary.

**Files:**
- Modify: `build-embed.mjs` (the `body.replace(/\s*<script src=…/)` line, and the `ORDER` array)
- Create: `tools/container.mjs`

**Interfaces:**
- Produces: `tools/container.mjs`, a runnable check script following the repo idiom — prints `PASS`/`FAIL` lines, a `n/m passed` summary, and exits non-zero on any failure. Later tasks add assertions to it.
- Produces: the rule that a `<script src>` whose URL is absolute (`https:`, `http:` or protocol-relative `//`) is left alone by the embed build.

- [ ] **Step 1: Write the failing test**

Create `tools/container.mjs`:

```js
/* The content container, checked end to end.
 *
 *   node tools/container.mjs          against http://localhost:4173/
 *
 * Static assertions read the built bundle; browser assertions drive the served
 * site over CDP. Run `node build-embed.mjs` first — the static half reads its
 * output, and a stale bundle is a false pass.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

/* ---- static: what survives build-embed.mjs ------------------------------- */
console.log('\nthe built bundle');

const embedPath = path.join(ROOT, 'beeviro-embed.html');
if (!existsSync(embedPath)) {
  console.error('  beeviro-embed.html is missing — run `node build-embed.mjs` first');
  process.exit(1);
}
const embed = readFileSync(embedPath, 'utf8');
const index = readFileSync(path.join(ROOT, 'site/index.html'), 'utf8');

/* The container URL has exactly one home: the tag in index.html. Reading it
   back out here means the test cannot drift from the thing it is testing. */
const tag = index.match(/<script src="(https:\/\/[^"]+\/content\.js)"><\/script>/);
check('index.html carries an absolute container tag', !!tag,
  tag ? tag[1] : 'no <script src="https://…/content.js"> found');

if (tag) {
  check('the container tag survives into the embed', embed.includes(tag[1]),
    'build-embed.mjs must not strip absolute script srcs');
}

check('no relative script src survives into the embed',
  !/<script src="(?!https?:|\/\/)[^"]+"><\/script>/.test(embed),
  'those nine files are inlined, so a leftover tag is a 404 inside GHL');

const failed = results.filter((x) => !x).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
node build-embed.mjs && node tools/container.mjs
```

Expected: `FAIL  index.html carries an absolute container tag`. The tag does not exist yet. This is the honest starting state — do not add the tag yet, Task 4 does that.

- [ ] **Step 3: Change the strip rule so an absolute src is kept**

In `build-embed.mjs`, find this exact line:

```js
// the script tags are replaced by the inlined bundle
body = body.replace(/\s*<script src="[^"]+"><\/script>/g, '');
```

Replace it with:

```js
/* The script tags are replaced by the inlined bundle — but only the RELATIVE
   ones. Those are the nine files below, and a surviving tag for one of them is
   a 404 inside GoHighLevel. An ABSOLUTE src is a different animal: it is the
   content container, deliberately hosted outside this build so that a new case
   study appears without one. Strip the first kind, keep the second. */
body = body.replace(/\s*<script src="(?!https?:|\/\/)[^"]+"><\/script>/g, '');
```

- [ ] **Step 4: Add the merger to the inline order**

In `build-embed.mjs`, find:

```js
const ORDER = ['js/perf.js', 'js/media-map.js', 'js/thumb-map.js', 'js/clients.js',
  'js/clients.ar.js', 'js/i18n.js', 'js/beeviro.js', 'js/motion.js', 'js/hive.js'];
```

Replace with:

```js
const ORDER = ['js/perf.js', 'js/media-map.js', 'js/thumb-map.js', 'js/clients.js',
  'js/clients.ar.js', 'js/content.js', 'js/i18n.js', 'js/beeviro.js',
  'js/motion.js', 'js/hive.js'];
```

`js/content.js` sits after both data files and before `i18n.js`, for the same reason `i18n.js` sits where it does: it edits `BV_CLIENTS` in place and everything downstream renders from the result.

Also update the comment two lines above it, which lists the order in prose:

```js
// perf.js comes FIRST: it decides the motion tier before anything is built.
// content.js merges the pulled container into BV_CLIENTS, so it has to run
// after the two data files. i18n.js has to sit after content.js and before
// beeviro.js, because it merges the Arabic records in place and beeviro.js
// renders from the result.
```

- [ ] **Step 5: Create the merger as an empty file so the build does not throw**

`build-embed.mjs` reads every file in `ORDER` and will crash on a missing one. Task 2 fills this in.

```bash
printf '/* placeholder — Task 2 */\n' > site/js/content.js
```

- [ ] **Step 6: Run the test again**

```bash
node build-embed.mjs && node tools/container.mjs
```

Expected: still `FAIL` on the first assertion (no tag yet), but `PASS` on "no relative script src survives". The build must complete without throwing.

- [ ] **Step 7: Commit**

```bash
git add build-embed.mjs tools/container.mjs site/js/content.js docs/
git commit -m "build: keep absolute script srcs in the embed, reserve js/content.js"
```

---

### Task 2: The merger

Fold `window.BV_CONTENT` into `window.BV_CLIENTS`. Defensive by construction: a malformed record is dropped, not rendered, and never throws.

**Files:**
- Modify: `site/js/content.js` (replace the placeholder entirely)
- Modify: `tools/container.mjs` (add browser assertions)

**Interfaces:**
- Consumes: `window.BV_CLIENTS` and `window.BV_CLIENTS_AR` as defined by `clients.js` / `clients.ar.js`; the `ORDER` slot from Task 1.
- Produces: the container format — `window.BV_CONTENT = { version: <number>, cases: [<record>], casesAr: { <slug>: <record> } }`.
- Produces: `window.BV_CONTENT_STATE = { version: <number>, added: <number>, dropped: [<slug>] }`, which the tests and the README read.
- Produces: the guarantee that a pulled record with `shots: [<absolute url>]` has `work` set to `shots.length`, so all fourteen existing readers of `c.work` need no change.

- [ ] **Step 1: Write the failing test**

Append to `tools/container.mjs`, immediately **before** the `const failed = …` summary block:

```js
/* ---- browser: the merge ---------------------------------------------------
   BV_CONTENT is injected before any page script runs, and the real container
   host is blocked, so this measures the MERGE and nothing else — no network,
   no timing, no dependency on what happens to be published today. */
import { spawn } from 'node:child_process';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }

const BASE = 'http://localhost:4173/';
const PORT = 9700 + (process.pid % 200);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(ROOT, '.chrome-container'), 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try {
    const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = tabs.find((t) => t.type === 'page');
    if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch { /* not up yet */ }
  await sleep(250);
}
if (!wsUrl) { chrome.kill(); console.error('devtools never came up'); process.exit(1); }

const ws = new WebSocket(wsUrl);
let msgId = 0;
const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  const w = waiting.get(m.id);
  if (w) { waiting.delete(m.id); w(m.result); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params) => new Promise((r) => {
  const n = ++msgId; waiting.set(n, r);
  ws.send(JSON.stringify({ id: n, method, params: params || {} }));
});
const ev = async (expression) => {
  const r = await send('Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return { __threw: r.exceptionDetails.text };
  return r.result.value;
};

const FIXTURE = {
  version: 99,
  cases: [
    {
      slug: 'test-pulled', name: 'Test Pulled', accent: '#ff8800', year: '2026',
      industry: 'Testing', country: 'Egypt',
      services: ['Testing'],
      tagline: 'Added without a rebuild.',
      summary: 'A case study that exists only in the content container.',
      journey: { contact: 'a', diagnose: 'b', position: 'c', build: 'd', launch: 'e', outcome: 'f' },
      outcome: { kind: 'goal', headline: 'A target, not a claim' },
      metrics: [{ v: '1', l: 'Thing', note: 'Where the number came from.' }],
      shots: ['https://example.invalid/one.jpg', 'https://example.invalid/two.jpg'],
    },
    { slug: 'broken', name: 'Broken' },
    { name: 'No slug at all', accent: '#fff', year: '2026', summary: 'x' },
  ],
  casesAr: { 'test-pulled': { name: 'حالة مضافة', tagline: 'أضيفت بدون إعادة بناء.' } },
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
if (tag) await send('Network.setBlockedURLs', { urls: [tag[1]] });
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.BV_CONTENT = ' + JSON.stringify(FIXTURE) + ';',
});
await send('Page.navigate', { url: BASE });
await sleep(4000);

console.log('\nthe merge');

const state = await ev('JSON.stringify(window.BV_CONTENT_STATE || null)');
const parsed = state && !state.__threw ? JSON.parse(state) : null;
check('the merger reports what it did', !!parsed, state ? String(state) : 'no BV_CONTENT_STATE');
check('one good record was added', parsed && parsed.added === 1,
  parsed ? 'added ' + parsed.added : '');
check('both malformed records were dropped', parsed && parsed.dropped.length === 2,
  parsed ? 'dropped ' + JSON.stringify(parsed.dropped) : '');

const rec = await ev(`(function () {
  var c = (window.BV_CLIENTS || []).filter(function (x) { return x.slug === 'test-pulled'; })[0];
  return c ? JSON.stringify({ work: c.work, shots: (c.shots || []).length }) : '';
})()`);
check('the pulled record is in BV_CLIENTS', !!rec, 'not found');
check('shots.length was normalised into work',
  !!rec && JSON.parse(rec).work === 2, rec || '');

check('the broken records never reached BV_CLIENTS',
  (await ev(`(window.BV_CLIENTS || []).filter(function (c) {
    return c.slug === 'broken' || !c.slug; }).length`)) === 0);

check('the shipped 25 are still there',
  (await ev('(window.BV_CLIENTS || []).length')) === 26,
  'expected 25 baked-in + 1 pulled');

ws.close(); chrome.kill();
```

Move the existing summary block to the very end of the file, after this.

- [ ] **Step 2: Run it to verify it fails**

Start the server in one terminal:

```bash
node serve.mjs
```

Then:

```bash
node tools/container.mjs
```

Expected: FAIL on "the merger reports what it did" — `site/js/content.js` is still the placeholder from Task 1, so `BV_CONTENT_STATE` is undefined.

- [ ] **Step 3: Write the merger**

Replace the whole of `site/js/content.js`:

```js
/* Beeviro portfolio — the content container.
 *
 * Every surface on this site is built from window.BV_CLIENTS: the work grid,
 * the hero comb, both creative reels, the counters and the #case=<slug> route.
 * The twenty-five records that shipped with the bundle live in clients.js.
 * Anything added AFTER a build arrives here, from a file hosted outside the
 * bundle, and is merged into the same array before anything renders.
 *
 * The pull is an ordinary <script src="https://…/content.js"> in the markup,
 * two tags above this one. That is deliberate and it is not a fetch:
 *
 *   - a classic script tag BLOCKS THE PARSER, so BV_CONTENT is already defined
 *     by the time this file runs. Nothing in the boot sequence, the render path
 *     or the motion tiers has to be restructured, and there is no flash of the
 *     old content;
 *   - it needs no CORS headers, unlike fetch();
 *   - and it FAILS SAFELY. If the host is unreachable the tag 404s, BV_CONTENT
 *     stays undefined, this returns on its first line, and the page renders the
 *     baked-in records exactly as it did before. A new case study can never
 *     take the site down. The worst it can do is not appear.
 *
 * The same reasoning already governs clients.ar.js, which is loaded the same
 * way by the tag above.
 */
(function () {
  'use strict';

  var box = window.BV_CONTENT;
  if (!box || typeof box !== 'object') return;

  var C = window.BV_CLIENTS || (window.BV_CLIENTS = []);
  var at = {};
  var i;
  for (i = 0; i < C.length; i++) at[C[i].slug] = i;

  /* A record missing any of these cannot render — the grid reads name and
     accent, the case panel reads year and summary, and the route is the slug.
     Rather than let one bad paste blank a card or throw mid-render, drop it and
     say so. Twenty-four good case studies and one missing is a far better
     failure than a broken page. */
  var REQUIRED = ['slug', 'name', 'accent', 'year', 'summary'];
  var dropped = [];
  var added = 0;

  function usable(c) {
    if (!c || typeof c !== 'object') return false;
    for (var k = 0; k < REQUIRED.length; k++) {
      if (typeof c[REQUIRED[k]] !== 'string' || !c[REQUIRED[k]]) return false;
    }
    // The slug is written into a url fragment and a data attribute.
    return /^[a-z0-9][a-z0-9-]*$/.test(c.slug);
  }

  var cases = box.cases || [];
  for (i = 0; i < cases.length; i++) {
    var c = cases[i];
    if (!usable(c)) {
      dropped.push((c && c.slug) || '(no slug)');
      continue;
    }

    /* A client that shipped with the bundle numbers its pieces out of
       assets/work/<slug>/NN.jpg and stores the count in `work`. A pulled client
       has no such folder, so it carries an explicit list of absolute urls.
       Normalising the length into `work` right here is what lets all fourteen
       existing readers of c.work keep working untouched — only the two places
       that BUILD a path from a slug had to learn about `shots`. */
    if (Object.prototype.toString.call(c.shots) === '[object Array]') {
      var good = [];
      for (var s = 0; s < c.shots.length; s++) {
        if (/^https?:\/\//i.test(c.shots[s])) good.push(c.shots[s]);
      }
      c.shots = good;
      c.work = good.length;
    } else if (typeof c.work !== 'number') {
      c.work = 0;
    }

    // Shapes the renderer indexes into without checking first.
    if (!c.journey || typeof c.journey !== 'object') c.journey = {};
    if (Object.prototype.toString.call(c.metrics) !== '[object Array]') c.metrics = [];
    if (Object.prototype.toString.call(c.services) !== '[object Array]') c.services = [];

    /* By slug, so a record can either ADD a case study or CORRECT a shipped
       one. A typo in a published record can be fixed from the container
       without rebuilding and re-pasting the bundle. */
    if (at[c.slug] == null) { at[c.slug] = C.length; C.push(c); }
    else C[at[c.slug]] = c;
    added++;
  }

  /* i18n.js merges BV_CLIENTS_AR over BV_CLIENTS by slug, for Arabic readers
     only. Adding to that table here means a pulled case is translated by
     exactly the same path as a shipped one. */
  if (box.casesAr && typeof box.casesAr === 'object') {
    var AR = window.BV_CLIENTS_AR || (window.BV_CLIENTS_AR = {});
    var slugs = Object.keys(box.casesAr);
    for (i = 0; i < slugs.length; i++) AR[slugs[i]] = box.casesAr[slugs[i]];
  }

  window.BV_CONTENT_STATE = {
    version: box.version || 0,
    added: added,
    dropped: dropped,
  };

  if (dropped.length && window.console && console.warn) {
    console.warn('BV: dropped ' + dropped.length +
      ' malformed record(s) from the content container: ' + dropped.join(', '));
  }
})();
```

- [ ] **Step 4: Wire it into the standalone page**

In `site/index.html`, find this exact line:

```html
<script src="js/i18n.js"></script>
```

Insert immediately **before** it:

```html
<!-- The content container merger. Runs after both data files and before i18n,
     because it edits BV_CLIENTS in place and everything downstream renders
     from the result. The container itself is loaded by the absolute tag added
     in Task 4, which sits above this one. -->
<script src="js/content.js"></script>
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
node tools/container.mjs
```

Expected: every assertion in "the merge" passes. The static assertion about the absolute tag still fails — Task 4.

- [ ] **Step 6: Commit**

```bash
git add site/js/content.js site/index.html tools/container.mjs
git commit -m "feat: merge a pulled content container into BV_CLIENTS"
```

---

### Task 3: Resolve images for a pulled case

`media()` and `light()` already return an absolute URL unchanged, so a pulled case's images need no media-map entry and no CDN rewrite. What they do need is for the two functions that *build* a path out of a slug to look at `shots` first.

**Files:**
- Modify: `site/js/beeviro.js` (the `path` helper)
- Modify: `site/js/hive.js` (the pool builder)
- Modify: `tools/container.mjs`

**Interfaces:**
- Consumes: `c.shots` as normalised by Task 2.
- Produces: `path(c, i)` in `beeviro.js` and `shotOf(c, i)` in `hive.js`, both 1-indexed, both returning an absolute URL for a pulled case and the numbered local path for a shipped one.

- [ ] **Step 1: Write the failing test**

In `tools/container.mjs`, add after the `'the shipped 25 are still there'` check:

```js
console.log('\npulled images');

const srcs = await ev(`(function () {
  var card = document.querySelector('.bv-card[data-slug="test-pulled"]');
  var img = card && card.querySelector('img');
  return JSON.stringify({
    card: !!card,
    src: img ? img.getAttribute('src') : '',
  });
})()`);
const got = srcs && !srcs.__threw ? JSON.parse(srcs) : { card: false, src: '' };

check('the pulled case has a card in the work grid', got.card);
check('its lead image is the absolute url from shots, untouched',
  got.src === 'https://example.invalid/one.jpg', got.src || '(none)');

/* The grid paginates, so the pulled case may be behind "Show more". Assert on
   the DATA the grid was built from as well, which cannot be hidden. */
check('BV_CLIENTS carries the shots through unmodified',
  (await ev(`(function () {
    var c = (window.BV_CLIENTS || []).filter(function (x) {
      return x.slug === 'test-pulled'; })[0];
    return c && c.shots ? c.shots.join('|') : '';
  })()`)) === 'https://example.invalid/one.jpg|https://example.invalid/two.jpg');
```

If the card assertion fails only because of pagination, reveal the rest first by adding this line before the `srcs` evaluation:

```js
await ev(`(function () { var b = document.getElementById('moreBtn');
  if (b) b.click(); })()`);
await sleep(400);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node tools/container.mjs
```

Expected: FAIL on the lead image — it currently resolves to `assets/work/test-pulled/01.jpg`, a path that does not exist.

- [ ] **Step 3: Teach `path()` about shots**

In `site/js/beeviro.js`, find this exact block:

```js
  var path = function (c, i) {
    return 'assets/work/' + c.slug + '/' + String(i).padStart(2, '0') + '.jpg';
  };
```

Replace with:

```js
  /* A client that shipped with the bundle has a numbered folder on disk. A
     client that arrived through the content container has no folder at all —
     it carries its pieces as absolute urls, uploaded straight to the media
     library. media() and thumb() both return an absolute url unchanged, so
     past this one function nothing else on the page can tell the difference. */
  var path = function (c, i) {
    if (c.shots && c.shots[i - 1]) return c.shots[i - 1];
    return 'assets/work/' + c.slug + '/' + String(i).padStart(2, '0') + '.jpg';
  };
```

- [ ] **Step 4: Teach the hero comb about shots**

In `site/js/hive.js`, find this exact block:

```js
  var shot = function (slug, i) {
    return small('assets/work/' + slug + '/' + String(i).padStart(2, '0') + '.jpg');
  };
```

Replace with:

```js
  var shot = function (slug, i) {
    return small('assets/work/' + slug + '/' + String(i).padStart(2, '0') + '.jpg');
  };
  /* Same split as path() in beeviro.js: a pulled client has absolute urls
     instead of a numbered folder, and small() passes an absolute url through
     untouched because it is not a key in either light-copy table. */
  var shotOf = function (c, i) {
    if (c.shots && c.shots[i - 1]) return small(c.shots[i - 1]);
    return shot(c.slug, i);
  };
```

Then find this exact line — it is the only call site of `shot(` in the file:

```js
        pool.push({ src: shot(c.slug, n), slug: c.slug });
```

Replace with:

```js
        pool.push({ src: shotOf(c, n), slug: c.slug });
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
node tools/container.mjs
```

Expected: the three "pulled images" assertions pass.

- [ ] **Step 6: Run the existing suites to prove nothing regressed**

The 25 shipped clients must resolve exactly as before — this touched their code path too.

```bash
node tools/check.mjs && node tools/check.mjs --lang ar && node tools/strips.mjs && node tools/film.mjs && node tools/flow.mjs
```

Expected: all pass, at the counts recorded in the README.

- [ ] **Step 7: Commit**

```bash
git add site/js/beeviro.js site/js/hive.js tools/container.mjs
git commit -m "feat: resolve gallery images from shots[] for pulled cases"
```

---

### Task 4: The container file, and a local preview of it

The container needs to exist, the absolute tag needs to go into the markup, and there has to be a way to see unpublished content locally without waiting on a CDN cache.

**Files:**
- Create: `content/content.js`
- Modify: `site/index.html`
- Modify: `serve.mjs`

**Interfaces:**
- Consumes: the container format from Task 2.
- Produces: `content/content.js`, the authored copy of the container. `tools/publish-content.mjs` (Task 5) copies this to the content repository.
- Produces: `BV_LOCAL_CONTENT=1 node serve.mjs`, which serves `content/content.js` at `/content.js` and rewrites the absolute tag in `index.html` to point at it.

- [ ] **Step 1: Write the container file**

The URL below has one placeholder, `<github-user>`. Task 5 fixes its real value; use your own GitHub username consistently in this task and the next.

Create `content/content.js`:

```js
/* Beeviro portfolio — THE CONTENT CONTAINER.
 *
 * This is the only file that has to change to put a new case study on the live
 * site. Edit it, commit it, push it. The site loads it directly and renders
 * what it finds; nothing is rebuilt and nothing is re-pasted into GoHighLevel.
 *
 * HOW TO ADD A CASE STUDY
 *   1. Upload its images through the GoHighLevel media library as usual, and
 *      copy each file's URL.
 *   2. Add a record to `cases` below. Copy an existing one and change it —
 *      or use tools/add-case.html, which builds this file from a form.
 *   3. node tools/content-check.mjs      (refuses to pass a bad record)
 *   4. node tools/publish-content.mjs    (copies here, commits, pushes)
 *   Live within about ten minutes; GitHub Pages caches this for max-age=600.
 *
 * THE TWO RULES THAT APPLY TO EVERY WORD BELOW
 *   EDITORIAL: `outcome.kind: 'result'` means the figure is published in the
 *   client-approved document. `goal` means the strategy set that target and we
 *   are NOT claiming it was hit. Never promote a goal to a result without a
 *   source. Never add a metric without a `note`.
 *
 *   REDACTION: no competitor names or teardowns, no internal media budgets, no
 *   unpublished projections, no phone numbers, no personal handles. This file
 *   is served from a public repository — everything in it is published the
 *   moment it is pushed.
 *
 * A record whose slug matches one already in the site CORRECTS it. A record
 * with a new slug ADDS a case study. A record missing slug, name, accent, year
 * or summary is dropped with a console warning, and the rest still render.
 */
window.BV_CONTENT = {
  // Bump this when you publish. Nothing reads it but you, in the console:
  //   BV_CONTENT_STATE  ->  { version, added, dropped }
  version: 1,

  cases: [
    /* Template — copy the whole block, delete this comment, fill it in.

    {
      slug: 'client-slug',          // lowercase, digits and hyphens only
      name: 'Client Name',
      accent: '#2dd4a8',            // the brand colour the case is themed with
      year: '2026',
      industry: 'Category / Channel',
      country: 'Egypt',
      site: 'example.com',          // optional
      services: ['Media Buying', 'Creative Production'],
      tagline: 'One line, the promise of the work.',
      summary: 'Two or three sentences: who they are, what the problem was, '
             + 'and what we did about it.',
      journey: {
        contact:  'How the brand arrived, and the state it arrived in.',
        diagnose: 'What we read before anything was made.',
        position: 'The single claim the brand would own.',
        build:    'What was actually produced.',
        launch:   'Where it went live and how it was run.',
        outcome:  'What came back.',
      },
      outcome: { kind: 'goal', headline: 'The target, stated as a target' },
      metrics: [
        { v: '3.2x', l: 'Return on ad spend', note: 'Where this number came from.' },
      ],
      // Absolute urls, in display order. The count becomes the piece count
      // shown on the card and in the dossier — there is no `work:` to set.
      shots: [
        'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/xxxx.jpg',
      ],
    },

    */
  ],

  /* Arabic, keyed by the same slug. Only the wording moves — every figure and
     every outcome.kind stays on the English side, so a number can never be
     attached to the wrong caption. Any field you leave out keeps its English. */
  casesAr: {
    /*
    'client-slug': {
      name: 'اسم العميل',
      industry: 'الفئة',
      country: 'مصر',
      tagline: 'سطر واحد.',
      summary: 'ملخص من جملتين أو ثلاث.',
      services: ['شراء إعلامي', 'إنتاج إبداعي'],
      journey: { contact: '…', diagnose: '…', position: '…', build: '…', launch: '…', outcome: '…' },
      outcome: { headline: 'الهدف' },
      metrics: [{ l: 'العائد على الإنفاق الإعلاني', note: 'مصدر الرقم.' }],
    },
    */
  },
};
```

- [ ] **Step 2: Add the absolute tag to the markup**

In `site/index.html`, find this exact block — it is the conditional Arabic loader:

```html
<script src="js/i18n.js"></script>
```

and insert **above** the `<script src="js/content.js">` line you added in Task 2, so the final order reads:

```html
<script>
  // The closing tag is split as "<\/script>" on purpose: written whole, the HTML
  // parser ends THIS script block at it and the rest of the page becomes text.
  if (document.documentElement.lang === 'ar') {
    document.write('<script src="js\/clients.ar.js"><\/script>');
  }
</script>

<!-- THE CONTENT CONTAINER. Hosted outside this build on purpose: a case study
     added to it appears on the live site with no rebuild and no re-paste.
     A plain script tag rather than a fetch, for three reasons — it blocks the
     parser, so the merge below finishes before anything renders; it is
     cross-origin without needing CORS headers; and if this host is ever
     unreachable the tag simply fails, and the page renders the records that
     shipped inside the bundle. Nothing here is load-bearing. -->
<script src="https://<github-user>.github.io/beeviro-content/content.js"></script>

<!-- The merger. After both data files, before i18n: it edits BV_CLIENTS in
     place and everything downstream renders from the result. -->
<script src="js/content.js"></script>
<script src="js/i18n.js"></script>
```

- [ ] **Step 3: Add the local-preview route to the dev server**

In `serve.mjs`, find the constant block near the top:

```js
const PORT = Number(process.env.PORT || 4173);
```

Add below it:

```js
/* Unpublished content, previewed locally.
 *
 * index.html points the container tag at GitHub Pages, which is right for
 * production and useless while you are still writing a case study — Pages
 * caches for ten minutes and you have not pushed yet anyway. With
 * BV_LOCAL_CONTENT=1 this server serves content/content.js at /content.js and
 * rewrites that one tag on the way out, so the page you preview is the file you
 * are editing. Nothing on disk changes; the rewrite is per-response. */
const LOCAL_CONTENT = process.env.BV_LOCAL_CONTENT === '1';
```

Then find the request handler's route table and add, before the static file lookup:

```js
  if (LOCAL_CONTENT && url.pathname === '/content.js') {
    const body = await readFile(path.join(ROOT, 'content/content.js'), 'utf8')
      .catch(() => 'window.BV_CONTENT = { version: 0, cases: [], casesAr: {} };');
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(body);
    return;
  }
```

And where `index.html` is served, wrap the body:

```js
  if (LOCAL_CONTENT && filePath.endsWith('index.html')) {
    text = text.replace(/https:\/\/[^"]+\/content\.js/, '/content.js');
  }
```

Match the surrounding code's own variable names and read/serve style rather than these — the intent is the only thing fixed here.

- [ ] **Step 4: Verify the preview route by hand**

```bash
BV_LOCAL_CONTENT=1 node serve.mjs
```

In another terminal:

```bash
curl -s http://localhost:4173/ | grep -o 'src="[^"]*content\.js"'
```

Expected: `src="/content.js"` and `src="js/content.js"` — the absolute URL rewritten, the merger untouched.

- [ ] **Step 5: Rebuild and run the full container check**

```bash
node build-embed.mjs && node tools/container.mjs
```

Expected: **every** assertion passes now, including the two static ones from Task 1 — the tag exists in `index.html` and survives into `beeviro-embed.html`.

- [ ] **Step 6: Commit**

```bash
git add content/content.js site/index.html serve.mjs
git commit -m "feat: add the content container and a local preview route"
```

---

### Task 5: Publish the container on GitHub Pages

A separate repository containing only what is published. Not a subfolder of this project — that is the guarantee `sources/` can never leak.

**Files:**
- Create: `../beeviro-content/` (a new git repository, outside this project)
- Create: `tools/publish-content.mjs`

**Interfaces:**
- Consumes: `content/content.js`.
- Produces: `node tools/publish-content.mjs`, which copies the container into the content repository, commits and pushes it.
- Produces: the live URL `https://<github-user>.github.io/beeviro-content/content.js`.

- [ ] **Step 1: Create the repository on GitHub**

`gh` is not installed on this machine, so do this in the browser:

1. github.com → **New repository** → name it `beeviro-content`, **Public**, no README.
2. Copy the `https://github.com/<github-user>/beeviro-content.git` URL it shows.

**Public is required** for GitHub Pages on a free account. Re-read the redaction rule before the first push: everything in this repository is published the moment it lands.

- [ ] **Step 2: Create it locally and push the container**

```bash
mkdir -p ../beeviro-content && cd ../beeviro-content && git init -b main
```

```bash
cp ../beeviro-portfolio/content/content.js . && printf 'Beeviro portfolio content container. Published to GitHub Pages.\nEdit content.js in the beeviro-portfolio project, then run tools/publish-content.mjs.\n' > README.md
```

```bash
git add -A && git commit -m "chore: publish the content container" && git remote add origin https://github.com/<github-user>/beeviro-content.git && git push -u origin main
```

- [ ] **Step 3: Turn Pages on**

Repository → **Settings** → **Pages** → Source: **Deploy from a branch** → Branch `main`, folder `/ (root)` → **Save**. Wait for the green check on the Actions tab.

- [ ] **Step 4: Verify the URL actually serves JavaScript**

```bash
curl -sI https://<github-user>.github.io/beeviro-content/content.js | head -6
```

Expected: `HTTP/2 200`, `content-type: application/javascript` (or `text/javascript`), and a `cache-control` with a `max-age`. If you get 404, Pages has not finished its first deploy — wait and repeat. **Do not continue until this returns 200**; every later step assumes it.

- [ ] **Step 5: Put the real URL in the markup**

Replace `<github-user>` in `site/index.html` with your actual username. Verify only one placeholder remains nowhere:

```bash
grep -rn "github-user" site/ content/ tools/ || echo "no placeholders left in shipped files"
```

- [ ] **Step 6: Write the publish script**

Create `tools/publish-content.mjs`:

```js
/* Publish the content container.
 *
 *   node tools/publish-content.mjs            check, copy, commit, push
 *   node tools/publish-content.mjs --dry      do everything except push
 *
 * The content repository is a SEPARATE directory on purpose. It is public, and
 * this project contains sources/ — thirteen strategy decks that must never
 * ship. Copying one named file into a repository that holds nothing else is a
 * guarantee; a .gitignore in a shared repository is a promise.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '../beeviro-content');
const DRY = process.argv.includes('--dry');

if (!existsSync(path.join(REPO, '.git'))) {
  console.error('No content repository at ' + REPO);
  console.error('Create it first — see Task 5 of the content-container plan.');
  process.exit(1);
}

// Never publish something the checker refuses.
try {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/content-check.mjs')],
    { stdio: 'inherit' });
} catch {
  console.error('\ncontent-check failed — nothing was published.');
  process.exit(1);
}

const src = readFileSync(path.join(ROOT, 'content/content.js'), 'utf8');
writeFileSync(path.join(REPO, 'content.js'), src, 'utf8');

const version = (src.match(/version:\s*(\d+)/) || [, '?'])[1];
const git = (...a) => execFileSync('git', a, { cwd: REPO, stdio: 'inherit' });

git('add', 'content.js');
try {
  git('commit', '-m', 'content: publish version ' + version);
} catch {
  console.log('nothing changed since the last publish.');
  process.exit(0);
}

if (DRY) { console.log('\n--dry: committed but not pushed.'); process.exit(0); }
git('push');

console.log('\nPublished version ' + version + '.');
console.log('Live within about ten minutes — GitHub Pages caches for max-age=600.');
```

- [ ] **Step 7: Verify the round trip**

```bash
node tools/publish-content.mjs --dry
```

Expected: content-check runs and passes, `content.js` is copied, a commit is made, nothing is pushed.

- [ ] **Step 8: Commit**

```bash
git add tools/publish-content.mjs site/index.html
git commit -m "feat: publish the container to GitHub Pages in one command"
```

---

### Task 6: The validator

The editorial rule is the project's most important constraint and the easiest to break at 11pm. Make it mechanical.

**Files:**
- Create: `tools/content-check.mjs`

**Interfaces:**
- Consumes: `content/content.js`, evaluated in a Node VM sandbox — it is a script that assigns to `window`, not JSON.
- Produces: `node tools/content-check.mjs`, exit 0 clean / exit 1 on any breach. Task 5's publish script already calls it.

- [ ] **Step 1: Write the failing test**

Create a deliberately bad fixture and confirm the checker catches it. Add to `content/content.js`, inside `cases`:

```js
    {
      slug: 'temp-bad', name: 'Temp Bad', accent: '#ff0000', year: '2026',
      summary: 'Deliberately broken, to prove the checker works.',
      outcome: { kind: 'result', headline: 'A result with no source' },
      metrics: [{ v: '9x', l: 'Return' }],
      shots: ['not-an-absolute-url.jpg'],
    },
```

- [ ] **Step 2: Write the checker**

Create `tools/content-check.mjs`:

```js
/* Check the content container before it is published.
 *
 *   node tools/content-check.mjs
 *
 * The site itself is defensive — a malformed record is dropped at merge time
 * and the page still renders. This is the other half: catching the mistakes
 * that would render PERFECTLY WELL and still be wrong. A goal published as a
 * result is not a broken page, it is a false claim, and no amount of runtime
 * validation can see it. That is what this is for.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(ROOT, 'content/content.js'), 'utf8');

const sandbox = { window: {} };
try {
  vm.runInNewContext(src, sandbox, { timeout: 2000 });
} catch (e) {
  console.error('content/content.js does not parse: ' + e.message);
  process.exit(1);
}
const box = sandbox.window.BV_CONTENT;
if (!box || typeof box !== 'object') {
  console.error('content/content.js did not assign window.BV_CONTENT');
  process.exit(1);
}

const problems = [];
const bad = (slug, msg) => problems.push(slug + ': ' + msg);

const REQUIRED = ['slug', 'name', 'accent', 'year', 'summary'];
const seen = new Set();

/* The 25 records that shipped inside the bundle. A container record sharing one
   of these slugs is a CORRECTION, which is allowed and occasionally the point —
   but it is worth saying out loud, because it is also what a copy-paste
   accident looks like. */
const shipped = new Set(
  [...readFileSync(path.join(ROOT, 'site/js/clients.js'), 'utf8')
    .matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])
);

for (const c of box.cases || []) {
  const slug = (c && c.slug) || '(no slug)';

  for (const k of REQUIRED) {
    if (typeof c[k] !== 'string' || !c[k]) bad(slug, 'missing or empty `' + k + '`');
  }
  if (c.slug && !/^[a-z0-9][a-z0-9-]*$/.test(c.slug)) {
    bad(slug, 'slug must be lowercase letters, digits and hyphens');
  }
  if (seen.has(c.slug)) bad(slug, 'duplicate slug inside the container');
  seen.add(c.slug);
  if (shipped.has(c.slug)) {
    console.log('  note  ' + slug + ' overrides a record that shipped in the bundle');
  }
  if (c.accent && !/^#[0-9a-fA-F]{3,8}$/.test(c.accent)) {
    bad(slug, 'accent must be a hex colour, got ' + c.accent);
  }

  /* THE EDITORIAL RULE. A `result` is a figure published in the
     client-approved document; a `goal` is a target the strategy set. The
     difference is the difference between reporting and claiming. */
  if (c.outcome) {
    if (c.outcome.kind !== 'goal' && c.outcome.kind !== 'result') {
      bad(slug, "outcome.kind must be 'goal' or 'result', got " + c.outcome.kind);
    }
    if (c.outcome.kind === 'result' && !c.outcome.source) {
      bad(slug, "outcome.kind is 'result' but there is no `source` saying where " +
        'it was published — use kind: \'goal\', or cite the document');
    }
    if (!c.outcome.headline) bad(slug, 'outcome has no headline');
  }

  // Every metric card flips to show where the number came from. No note, no card.
  (c.metrics || []).forEach((m, i) => {
    if (!m || !m.note) bad(slug, 'metric ' + (i + 1) + ' (' + ((m && m.l) || '?') +
      ') has no `note` — every figure has to say where it came from');
    if (m && !m.v) bad(slug, 'metric ' + (i + 1) + ' has no value');
    if (m && !m.l) bad(slug, 'metric ' + (i + 1) + ' has no label');
  });

  // Pulled images have no folder on disk to fall back to.
  (c.shots || []).forEach((u, i) => {
    if (!/^https:\/\//i.test(u)) {
      bad(slug, 'shot ' + (i + 1) + ' is not an absolute https url: ' + u);
    }
  });
  if (c.work != null && c.shots) {
    bad(slug, 'set `shots`, not `work` — the count is taken from the list');
  }

  const j = c.journey || {};
  for (const k of ['contact', 'diagnose', 'position', 'build', 'launch', 'outcome']) {
    if (!j[k]) bad(slug, 'journey.' + k + ' is empty — the case panel renders six stages');
  }
}

// An Arabic record for a slug that does not exist is silently never shown.
for (const slug of Object.keys(box.casesAr || {})) {
  if (!seen.has(slug) && !shipped.has(slug)) {
    bad(slug, 'has an Arabic record but no case study anywhere');
  }
}

const n = (box.cases || []).length;
if (problems.length) {
  console.error('\n' + problems.length + ' problem(s) in ' + n + ' case record(s):\n');
  problems.forEach((p) => console.error('  ✗ ' + p));
  console.error('\nNothing published.');
  process.exit(1);
}
console.log('  ' + n + ' case record(s), ' +
  Object.keys(box.casesAr || {}).length + ' translated. Clean.');
```

- [ ] **Step 3: Run it and confirm it catches every planted fault**

```bash
node tools/content-check.mjs
```

Expected: exit 1, with `temp-bad` reported for the missing metric note, the sourceless `result`, the relative shot URL, and the six empty journey stages.

- [ ] **Step 4: Remove the bad fixture and confirm it passes**

Delete the `temp-bad` block from `content/content.js`, then:

```bash
node tools/content-check.mjs
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/content-check.mjs content/content.js
git commit -m "feat: enforce the editorial rule before publishing"
```

---

### Task 7: The authoring form

A colleague fills in fields and gets a valid container file. No code, no JSON, and the editorial rule visible in the interface rather than in a README nobody opens.

**Files:**
- Create: `tools/add-case.html`

**Interfaces:**
- Consumes: nothing at runtime — it opens from `file://` and has no dependencies.
- Produces: the text of `content/content.js`, shown in a textarea and offered as a download, in exactly the format Task 2's merger and Task 6's checker expect.

- [ ] **Step 1: Write the page**

Create `tools/add-case.html`. It is a single self-contained file — no build step, no framework, matching the rest of the project.

Requirements, each of which must be visible in the finished page:

1. **Load an existing container.** A file input that accepts `content/content.js`, runs it through `new Function('window', src)` against a stub, and populates the list of existing cases so they are preserved on export rather than overwritten.
2. **The fields**, in this order and with these labels: Slug, Name, Accent colour (a native `<input type="color">` next to a text field), Year, Industry, Country, Site, Services (comma-separated), Tagline, Summary.
3. **The six journey stages** as six labelled textareas: First contact, Diagnosis, Positioning, Build, Launch, Outcome. All six required — the case panel renders all six.
4. **Outcome**, as two radio buttons with the rule written next to them:
   - `goal` — "the strategy set this target. We are not claiming it was hit."
   - `result` — "published in the client-approved document." Selecting this **reveals a required Source field** and the form will not export until it is filled.
5. **Metrics**, an add/remove repeater of `value` / `label` / `note`. The note field is **required** and its helper text reads "every metric card flips over to show where the number came from."
6. **Images**, an add/remove repeater of URL fields, each validated against `^https://`, with the helper text "upload through the GoHighLevel media library, then paste the file's URL here."
7. **An Arabic panel**, `dir="rtl"`, with Name, Industry, Country, Tagline, Summary, Services, the six journey stages, the outcome headline, and one note field per metric. Every field optional — anything left blank keeps its English.
8. **Export.** Validates everything above, then writes the complete `content.js` — header comment included, `version` incremented — into a textarea with a Copy button and a Download button.
9. **Refuse to export** while any required field is empty or any rule is broken. List the failures above the button; do not silently produce a file that `content-check.mjs` will reject.

Style it with the project's own tokens so it does not look foreign: `Aclonica` for headings via `../site/assets/fonts/Aclonica-Regular.ttf`, and the honey/charcoal palette from `site/css/beeviro.css`. Plain ES2019 is not required here — this is tooling, not the site — but no dependencies and no CDN links.

- [ ] **Step 2: Verify by round trip**

Open it:

```bash
start tools/add-case.html
```

Then, by hand:
1. Load `content/content.js`. Confirm any existing cases are listed.
2. Fill in a complete test case. Try to export with the metric note empty — it must refuse and say why.
3. Select `result` without a source — it must refuse and say why.
4. Paste a relative image path — it must refuse.
5. Fix all three, export, and save over `content/content.js`.

- [ ] **Step 3: Prove the output passes the checker**

This is the real assertion — the form and the validator must agree.

```bash
node tools/content-check.mjs
```

Expected: exit 0, with the test case counted.

- [ ] **Step 4: Prove the output actually renders**

```bash
BV_LOCAL_CONTENT=1 node serve.mjs
```

```bash
node tools/check.mjs --shot with-new-case.png
```

Open `.shots/with-new-case.png` and confirm the new case has a card.

- [ ] **Step 5: Remove the test case and commit**

Delete the test case from `content/content.js` before committing — it is not real work and must never be published.

```bash
git add tools/add-case.html content/content.js
git commit -m "feat: add a form for authoring case studies without code"
```

---

### Task 8: Prove the failure modes

The feature's whole value rests on one claim: a new case study can never break the site. Test that claim, not just the happy path.

**Files:**
- Modify: `tools/container.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: assertions covering an unreachable host, a syntactically broken container, and the Arabic path.

- [ ] **Step 1: Write the failing tests**

In `tools/container.mjs`, refactor the browser section into a reusable function so the page can be loaded three ways. Replace the single navigate-and-assert block with:

```js
/* One helper, three scenarios. The fixture and the host block are per-run,
   because what is being tested is what happens when they are ABSENT. */
async function load(opts) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(200);
  await send('Network.setBlockedURLs', { urls: opts.blockContainer && tag ? [tag[1]] : [] });
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: lastScript })
    .catch(() => {});
  if (opts.inject) {
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: opts.inject });
    lastScript = r.identifier;
  }
  await send('Page.navigate', { url: BASE + (opts.lang ? '?lang=' + opts.lang : '') });
  await sleep(4000);
}
let lastScript = null;
```

Then add these scenarios after the existing ones:

```js
/* ---- the host is unreachable --------------------------------------------- */
console.log('\nwith the container host blocked');

await load({ blockContainer: true });

check('the site still renders all twenty-five shipped clients',
  (await ev('(window.BV_CLIENTS || []).length')) === 25);
check('the work grid still built',
  (await ev("document.querySelectorAll('.bv-card').length")) > 0);
check('the merger left no state behind',
  (await ev('window.BV_CONTENT_STATE == null')) === true,
  'BV_CONTENT was never defined, so there was nothing to merge');
check('nothing threw',
  (await ev("typeof window.BV_OPEN_CASE === 'function'")) === true,
  'beeviro.js finished executing');

/* ---- the container is broken JavaScript ---------------------------------- */
console.log('\nwith a syntactically broken container');

await load({ blockContainer: true, inject: 'window.BV_CONTENT = "not an object";' });

check('a container of the wrong type is ignored, not rendered',
  (await ev('(window.BV_CLIENTS || []).length')) === 25);
check('the page still works',
  (await ev("document.querySelectorAll('.bv-card').length")) > 0);

/* ---- Arabic ---------------------------------------------------------------
   A pulled case has to translate through exactly the same path as a shipped
   one: i18n.js merges BV_CLIENTS_AR by slug, and the merger writes into that
   same table. If this passes, no separate Arabic code path exists to rot. */
console.log('\nthe Arabic path');

await load({
  blockContainer: true,
  lang: 'ar',
  inject: 'window.BV_CONTENT = ' + JSON.stringify(FIXTURE) + ';',
});

check('the pulled case took its Arabic name',
  (await ev(`(function () {
    var c = (window.BV_CLIENTS || []).filter(function (x) {
      return x.slug === 'test-pulled'; })[0];
    return c ? c.name : '';
  })()`)) === 'حالة مضافة');
check('its figures did not move to the Arabic side',
  (await ev(`(function () {
    var c = (window.BV_CLIENTS || []).filter(function (x) {
      return x.slug === 'test-pulled'; })[0];
    return c && c.outcome ? c.outcome.kind : '';
  })()`)) === 'goal');
```

- [ ] **Step 2: Run to verify they fail or pass honestly**

```bash
node tools/container.mjs
```

Expected: these pass on the first run **if** Tasks 2 and 3 were done correctly — they are characterising existing behaviour rather than driving new code. If any fails, that is a real defect in the merger; fix `site/js/content.js` before continuing. Do not adjust the assertion to match the behaviour.

- [ ] **Step 3: Confirm the route works for a pulled case**

Add:

```js
console.log('\nthe pulled case opens as a page');

await load({ blockContainer: true, inject: 'window.BV_CONTENT = ' + JSON.stringify(FIXTURE) + ';' });
await ev("window.BV_OPEN_CASE && window.BV_OPEN_CASE('test-pulled')");
await sleep(900);

check('#case=test-pulled is the route',
  (await ev('location.hash')) === '#case=test-pulled');
check('the panel is showing the pulled client',
  (await ev("(document.getElementById('caseName') || {}).textContent")) === 'Test Pulled');
check('its dossier shelf counted two pieces',
  (await ev(`document.querySelectorAll('.bv-case .bv-gal__t, .bv-shelf-slot img').length`)) >= 2);
```

`BV_OPEN_CASE` is the function `hive.js` already calls; confirm its exact exported name in `site/js/beeviro.js` before relying on it, and use whatever it actually is.

- [ ] **Step 4: Run the whole check**

```bash
node build-embed.mjs && node tools/container.mjs
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add tools/container.mjs
git commit -m "test: cover unreachable host, broken container and the Arabic path"
```

---

### Task 9: Collapse the embed

Everything above solves the content problem. This solves the *embed* problem: stop pasting 528 KB.

**Files:**
- Modify: `build-embed.mjs`
- Create: `tools/paste-me.html` (generated output, committed for reference)
- Modify: `tools/publish-content.mjs`

**Interfaces:**
- Consumes: the existing `head` / `body` / `foot` strings that `build-embed.mjs` already assembles.
- Produces: `node build-embed.mjs --hosted`, writing `../beeviro-content/beeviro.css` and `../beeviro-content/beeviro.js` plus `tools/paste-me.html`.
- Produces: a GoHighLevel paste that is three lines and never changes again.

- [ ] **Step 1: Decide what the loader does, and write it as the test**

The bundle must inject the body markup itself, or the paste still carries 25 KB of HTML. Add to `tools/container.mjs`:

```js
/* ---- the hosted bundle ---------------------------------------------------- */
console.log('\nthe hosted bundle');

const hostedJs = path.resolve(ROOT, '../beeviro-content/beeviro.js');
check('a hosted bundle was built', existsSync(hostedJs),
  'run `node build-embed.mjs --hosted`');

if (existsSync(hostedJs)) {
  const hosted = readFileSync(hostedJs, 'utf8');
  check('the bundle carries the body markup',
    hosted.includes('bv-mast') && hosted.includes('bv-hero'),
    'the paste must not have to contain the HTML');
  check('the bundle mounts itself into #bv-root',
    hosted.includes('bv-root'));
  check('no inline <script> survived into the injected markup',
    !/<script(?![^>]*\bsrc=)/.test(hosted.split('BV_BODY')[1] || ''),
    'innerHTML does not execute scripts, so one here would silently never run');
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
node tools/container.mjs
```

Expected: FAIL on "a hosted bundle was built".

- [ ] **Step 3: Add the hosted target to the build**

At the top of `build-embed.mjs`, after the imports:

```js
/* Two shapes out of one build.
 *
 *   node build-embed.mjs            beeviro-embed.html — the 528 KB paste
 *   node build-embed.mjs --hosted   beeviro.css + beeviro.js for GitHub Pages
 *
 * The hosted pair exists to end the paste. The single file has to be re-pasted
 * into GoHighLevel on EVERY change, which is the thing the supervisor asked to
 * stop; with the pair, the GHL page holds three fixed lines and updating the
 * site is a git push. The single file stays as the fallback for the day
 * GitHub Pages is unavailable and something has to ship anyway. */
const HOSTED = process.argv.includes('--hosted');
const CONTENT_REPO = path.resolve('..', 'beeviro-content');
```

At the bottom, after the existing `fs.writeFileSync` calls, add:

```js
if (HOSTED) {
  if (!fs.existsSync(CONTENT_REPO)) {
    console.error('\n  ! No content repository at ' + CONTENT_REPO);
    process.exit(1);
  }

  /* The body markup travels INSIDE the bundle and is injected on load, so the
     paste is three lines that never change. innerHTML does not execute
     scripts, which is fine — build-embed already stripped every inline script
     from the body, and the only remaining one was the Arabic loader, which is
     moot here because both languages are already inlined. */
  const loader =
    'window.BV_BODY = ' + JSON.stringify(body) + ';\n' +
    '(function () {\n' +
    "  var root = document.getElementById('bv-root');\n" +
    '  if (!root) { if (window.console) console.error(' +
    "'Beeviro: no <div id=\"bv-root\"> on the page'); return; }\n" +
    '  root.innerHTML = window.BV_BODY;\n' +
    '})();\n';

  fs.writeFileSync(path.join(CONTENT_REPO, 'beeviro.css'), css, 'utf8');
  fs.writeFileSync(path.join(CONTENT_REPO, 'beeviro.js'), loader + '\n' + js, 'utf8');

  const url = 'https://' + GH_USER + '.github.io/beeviro-content/';
  const paste =
    '<link rel="stylesheet" href="' + url + 'beeviro.css">\n' +
    '<div id="bv-root"></div>\n' +
    '<script src="' + url + 'beeviro.js"></script>\n';
  fs.writeFileSync('tools/paste-me.html', paste, 'utf8');

  console.log('\nHosted build:');
  console.log('  ' + path.join(CONTENT_REPO, 'beeviro.css') + '  (' + kb(css) + ')');
  console.log('  ' + path.join(CONTENT_REPO, 'beeviro.js') + '   (' + kb(loader + js) + ')');
  console.log('  tools/paste-me.html — paste this into GoHighLevel ONCE:\n');
  console.log(paste.split('\n').map((l) => l && '    ' + l).join('\n'));
}
```

Define `GH_USER` alongside `HOSTED`, reading it out of `site/index.html` so there is still only one place the username lives:

```js
const GH_USER = (fs.readFileSync('site/index.html', 'utf8')
  .match(/https:\/\/([^.]+)\.github\.io\//) || [, 'CHANGE-ME'])[1];
```

- [ ] **Step 4: The loader must run after the body exists**

`beeviro.js` and the rest query the DOM as they execute, so the injection has to happen before them — which it does, since `loader` is concatenated first. Verify the script tag in the paste is **not** `defer`red and sits after the `#bv-root` div.

- [ ] **Step 5: Build and test**

```bash
node build-embed.mjs --hosted && node tools/container.mjs
```

Expected: the four hosted-bundle assertions pass.

- [ ] **Step 6: Prove the hosted bundle actually renders**

Publish it, then point the existing suites at the live URL:

```bash
cd ../beeviro-content && git add -A && git commit -m "build: publish the hosted bundle" && git push && cd ../beeviro-portfolio
```

Wait for Pages, then create a one-line local harness `tools/paste-preview.html` containing exactly the three paste lines, and run:

```bash
node tools/mobile.mjs --url "file:///C:/Users/ahmed/OneDrive/Documents/ClaudeWork/beeviro-portfolio/tools/paste-preview.html"
```

Expected: 20/20, the same as against `site/`. If the count differs, the hosted bundle is not equivalent to the standalone site — find out why before shipping it.

- [ ] **Step 7: Teach the publish script to ship the bundle too**

In `tools/publish-content.mjs`, after the `writeFileSync` of `content.js`, add:

```js
/* The bundle is published from the same command, because a container record
   that needs a code change it has not got is the one failure this design can
   still produce. Keeping them in one commit keeps them in step. */
if (process.argv.includes('--bundle')) {
  execFileSync(process.execPath, [path.join(ROOT, 'build-embed.mjs'), '--hosted'],
    { stdio: 'inherit', cwd: ROOT });
  git('add', 'beeviro.css', 'beeviro.js');
}
```

- [ ] **Step 8: Commit**

```bash
git add build-embed.mjs tools/publish-content.mjs tools/paste-me.html
git commit -m "feat: hosted bundle — the GHL paste becomes three fixed lines"
```

---

### Task 10: Document it and prove nothing regressed

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run every suite**

```bash
node build-embed.mjs && node build-embed.mjs --hosted
```

```bash
node tools/check.mjs && node tools/check.mjs --lang ar && node tools/check.mjs --lite && node tools/strips.mjs && node tools/strips.mjs --lite && node tools/flow.mjs && node tools/film.mjs && node tools/video.mjs && node tools/mobile.mjs && node tools/pointer.mjs && node tools/jank.mjs && node tools/container.mjs
```

Expected: every suite at the count recorded in the README. `tools/audit-light.mjs` stays red until the ten outstanding media files are uploaded — that is the pre-existing gap, not a regression. Record the actual numbers; do not report a count you did not see.

- [ ] **Step 2: Write the README section**

Add a section after "Building for the website builder", covering, in this order:

1. **What the container is** — one file, hosted, loaded by a script tag, merged into `BV_CLIENTS` before render.
2. **Why a script tag and not `fetch`** — blocks the parser so nothing has to be restructured; no CORS; fails safely.
3. **The add-a-case workflow**, as five commands: upload images to GHL → `tools/add-case.html` → `node tools/content-check.mjs` → `node tools/publish-content.mjs` → live in ~10 minutes.
4. **`shots` vs `work`** — why a pulled case carries absolute URLs and why the count is derived, with the note that this is what kept fourteen call sites unchanged.
5. **The three-line paste**, verbatim, and the fact that it never changes again.
6. **The failure modes that are tested**: host down, broken container, malformed record, Arabic.
7. **The security line**: anyone who can push to `beeviro-content` can run JavaScript on the live site. Keep collaborators to people who already have publish rights.
8. **The redaction line**: `beeviro-content` is public and holds only `content.js`, `beeviro.css` and `beeviro.js`. Never add anything else to it.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: the content container and the three-line embed"
```

---

## Self-review

**Spec coverage.** Container → Tasks 2 and 4. Pull with no backend → Tasks 4 and 5. Easier embed → Task 9. Images without a media-map entry → Task 3. Authoring by colleagues → Task 7. Editorial rule → Task 6. Fails safely → Task 8. Redaction → Task 5's separate repository, restated in Task 10.

**Known gaps, stated rather than hidden.**

- **The username placeholder.** `<github-user>` appears in Task 4 and is replaced in Task 5 Step 5. If Tasks 4–5 are executed by different workers, the second must do that replacement or every later task fails at a 404. Task 1's test catches it: the container tag must resolve.
- **`serve.mjs` Step 3 is described, not quoted.** That file's request handler was not read line by line while writing this plan, so the insertion is specified by intent and position rather than by an exact anchor string. Read the handler first and match its own style.
- **`tools/add-case.html` is specified as nine requirements, not as code.** It is a UI, it is ~400 lines, and writing it out here would be a worse guide than the requirement list plus the round-trip test in Step 2, which is the thing that actually has to pass. This is the one deliberate departure from "show the code".
- **Task 8's `BV_OPEN_CASE`** is named from `hive.js` usage. Confirm the exact export before relying on it.
- **GitHub Pages caches for ten minutes.** "Add a page and it appears" is true within that window, not instantly. If the supervisor expects instant, the answer is a `?v=` query on the container tag bumped at publish time — which reintroduces a bundle rebuild and is therefore the wrong trade unless they ask for it.

**Type consistency.** `shots` is `string[]` everywhere; `work` is always a number after the merge; `BV_CONTENT_STATE` is `{ version, added, dropped }` in the merger, the tests and the README; `path(c, i)` and `shotOf(c, i)` are both 1-indexed and both take the record, never the slug.
