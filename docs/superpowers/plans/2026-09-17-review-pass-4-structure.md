# Review Pass 4 — Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the mechanical half of the client's fourth review — stop Arabic numbers rendering backwards, put the six requested clients on the first page of the work grid, widen the hero comb so it stops repeating brands, swap Rino's Kitchen out of the reel roster for MasterCraft, and build the brand-logo pipeline so the client's folder is a drop-in when it arrives.

**Architecture:** Six independent changes over a no-build static site. The bidi fix is one render-time helper in `beeviro.js` that isolates non-Arabic technical runs, replacing `esc()` at the call sites that carry client data — one mechanism for metric values and in-prose ranges alike, rather than a CSS rule for one and JS for the other. Display order becomes an explicit `BV_ORDER` slug list applied once at load, because the client reorders for commercial reasons and will do it again. Everything else is data and asset work. A new `tools/bidi.mjs` walks the rendered Arabic DOM and fails on any run whose on-screen character order differs from its authored order; it is the regression gate for this plan and the authoring contract for the copy plan that follows.

**Tech Stack:** Vanilla ES2019 browser JS (no framework, no build step, no dependencies), Node 18+ ESM for tooling, headless Chrome over CDP for verification.

**Spec:** `docs/superpowers/specs/2026-09-17-review-pass-4.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **REDACTION RULE.** Nothing published may contain competitor names or teardowns, internal media budgets, unpublished projections, phone numbers or personal handles. `sources/` must never ship.
- **EDITORIAL RULE.** `outcome.kind: 'result'` only where the figure is published in the client-approved document. Never promote a `goal` to a `result` without a source. Never add a metric without a `note`.
- Site JavaScript is **plain ES2019**: `var`, `function`, no arrow functions, no `const`/`let`, no template literals, no optional chaining. It must run from `file://`. Tooling under `tools/` and at the repo root is modern Node ESM and has no such limit.
- **No dependencies and no build step.** There is no `package.json` and none is to be added.
- `site/` is the only deployable root.
- Never hand-edit `beeviro-embed.html`, `split/*`, `site/js/media-map.js` or `site/js/thumb-map.js` — all four are generated.
- Anchor every edit on unique surrounding text, never on line numbers. A previous line-numbered edit in this repo silently clobbered working code twice.
- Run the dev server with `node serve.mjs` (port 4173). Never run it through a package manager; there isn't one.

## Prerequisite — a browser must be installed

There is no Chrome or Chromium on this machine. Task 1 makes the lookup
cross-platform, but it cannot conjure a binary. Before starting, install one:

```bash
sudo apt install chromium-browser     # Debian / Ubuntu
sudo dnf install chromium             # Fedora
```

Or set `CHROME_PATH=/path/to/chrome` in the environment. Verify with
`node tools/chrome.mjs` at the end of Task 1.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tools/chrome.mjs` | **new** — one cross-platform Chrome lookup, imported by all 15 browser-driven tools | 1 |
| `tools/bidi.mjs` | **new** — walks the rendered Arabic DOM, fails on any mis-ordered run | 2 |
| `site/js/beeviro.js` | the `bidi()` helper and the call sites that use it; `BV_ORDER` applied | 3, 4 |
| `site/js/clients.js` | `BV_ORDER`, and the `logo` field per client | 4, 6 |
| `site/js/hive.js` | comb pool width and the reel roster | 5 |
| `site/assets/hero/reels/small/master-craft.webm` | **generated** — the light copy the comb plays | 5 |
| `site/assets/logos/` | where the client's brand folder lands | 6 |
| `README.md` | the layout table and the editing instructions | 4, 5, 6 |

Tasks 4, 5 and 6 are independent of each other and of 2–3. Tasks 2 and 3 are a
pair: 2 writes the failing check, 3 makes it pass. Task 1 gates all of them,
because nothing else can be verified without a browser.

---

### Task 1: One Chrome lookup, on every platform

Fifteen tools each carry their own two-entry list of Windows install paths. The
repository moved to Linux and all fifteen now exit with `chrome not found` —
which is every asset tool and every verification tool there is. Nothing else in
this plan can be verified until this is fixed.

**Files:**
- Create: `tools/chrome.mjs`
- Modify: `tools/check.mjs`, `tools/film.mjs`, `tools/flow.mjs`, `tools/ingest-reels.mjs`, `tools/jank.mjs`, `tools/make-thumbs.mjs`, `tools/mobile.mjs`, `tools/pointer.mjs`, `tools/profile.mjs`, `tools/shoot.mjs`, `tools/shrink-reels.mjs`, `tools/squeeze.mjs`, `tools/strips.mjs`, `tools/video.mjs`, `tools/weigh.mjs`

**Interfaces:**
- Produces: `findChrome(): string | null` — the first Chrome-family executable that exists, or `null`.
- Produces: `requireChrome(): string` — same, but prints install instructions and calls `process.exit(1)` when there is none. This is the drop-in for the existing `const CHROME = [...].find(...)` plus its guard.

- [ ] **Step 1: Write the failing test**

There is no test runner in this repo; tools are their own tests and print
`PASS`/`FAIL` lines. `tools/chrome.mjs` is runnable directly and reports what it
found. Create it with only the self-test, so the run fails on a missing export:

```js
/* Where is Chrome?
 *
 * Every browser-driven tool here used to carry its own two-entry list of Windows
 * install paths. The repository moved to Linux and all fifteen died at once with
 * `chrome not found`. One lookup, imported everywhere, so the next move costs one
 * edit instead of fifteen.
 *
 *   node tools/chrome.mjs          print the resolved binary, or how to get one
 *
 * CHROME_PATH in the environment always wins.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function findChrome() {
  return null;
}
```

Append the self-test at the bottom of the same file:

```js
/* Run directly: report, and exit non-zero when there is nothing to drive. */
if (import.meta.url === 'file://' + process.argv[1]) {
  const found = findChrome();
  if (found) {
    console.log('PASS  chrome: ' + found);
  } else {
    console.log('FAIL  no chrome-family browser found');
    process.exit(1);
  }
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node tools/chrome.mjs`
Expected: `FAIL  no chrome-family browser found`, exit code 1 — because
`findChrome` is still a stub. Confirm with `echo $?` printing `1`.

- [ ] **Step 3: Write the implementation**

Replace the stub `findChrome` with the real lookup, and add `requireChrome`:

```js
const CANDIDATES = [
  process.env.CHROME_PATH,
  // Windows — where this repository was built
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
];

/* A distro can put it anywhere; ask the shell before giving up. `which` writes
   to stderr and exits non-zero when it misses, so both are swallowed. */
function fromPath() {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const name of names) {
    try {
      const out = execFileSync(probe, [name], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
      const first = out.split(/\r?\n/)[0].trim();
      if (first && existsSync(first)) return first;
    } catch (e) { /* not on PATH — try the next name */ }
  }
  return null;
}

export function findChrome() {
  for (const p of CANDIDATES) if (p && existsSync(p)) return p;
  return fromPath();
}

/* What the tools actually want: a path, or a clear death. */
export function requireChrome() {
  const found = findChrome();
  if (found) return found;
  console.error('chrome not found.');
  console.error('Install one, or set CHROME_PATH to an existing binary:');
  console.error('  Debian/Ubuntu   sudo apt install chromium-browser');
  console.error('  Fedora          sudo dnf install chromium');
  console.error('  macOS           brew install --cask google-chrome');
  process.exit(1);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node tools/chrome.mjs`
Expected: `PASS  chrome: /usr/bin/chromium-browser` (or wherever it landed),
exit code 0. If it still fails, the browser is not installed — see the
prerequisite section above. Do not continue past this step without a binary.

- [ ] **Step 5: Commit**

```bash
git add tools/chrome.mjs
git commit -m "tools: one cross-platform chrome lookup"
```

- [ ] **Step 6: Point the fifteen tools at it**

Each of the fifteen files carries the lookup in one of two shapes. Shape A, in
`tools/check.mjs` and `tools/flow.mjs`:

```js
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }
```

Shape B, in the other thirteen:

```js
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }
```

Replace either shape, in every file, with:

```js
const CHROME = requireChrome();
```

and add the import beside the file's existing `node:` imports:

```js
import { requireChrome } from './chrome.mjs';
```

Anchor each edit on the literal block above, not on a line number. Some files
import `existsSync` only for this lookup — leave the import alone; it is
harmless, and several of them use it elsewhere.

- [ ] **Step 7: Verify every tool resolves a browser**

Run:

```bash
grep -l "Program Files/Google/Chrome" tools/*.mjs | wc -l
```

Expected: `0`.

Then confirm one tool of each shape actually starts a browser — with the dev
server running in another terminal (`node serve.mjs`):

```bash
node tools/weigh.mjs
```

Expected: it reports page weight instead of `chrome not found`.

- [ ] **Step 8: Commit**

```bash
git add tools/
git commit -m "tools: resolve chrome through tools/chrome.mjs everywhere"
```

---

### Task 2: A check that fails on backwards Arabic

The client screenshotted `~1.15` rendering as `1.15~` and could not read the Izar
outcome. Measured against the live data, 21 fields across 8 clients render with
their characters in an order nobody authored — ranges backwards (`9–13.2` shown
as `13.2–9`), arrows reversed (`25 → 43–57` shown as `57–43 → 25`), age bands
inverted (`25–34` shown as `34–25`).

This task writes the detector and leaves it red. Task 3 makes it green. It walks
the **rendered DOM**, not the data, so it also catches the dictionary strings and
the `{n}` interpolations that no data scan would see.

**Files:**
- Create: `tools/bidi.mjs`

**Interfaces:**
- Consumes: `requireChrome()` from `tools/chrome.mjs` (Task 1).
- Produces: `node tools/bidi.mjs` — drives the Arabic site over CDP, opens every case dossier, and prints one `FAIL` line per mis-ordered run plus an `n/m passed` summary. Exits non-zero on any finding. This is the regression gate for Task 3 and the authoring contract for the copy plan.

- [ ] **Step 1: Write the check**

The heart of it is: render a string, ask the browser for the screen x-position of
every character, and assert that each non-Arabic technical run reads
left-to-right on screen exactly as authored. Create `tools/bidi.mjs`:

```js
/* Does the Arabic build render the numbers the way they were written?
 *
 *   node tools/bidi.mjs            against http://localhost:4173/?lang=ar
 *
 * Latin and numeric runs inside an Arabic paragraph are bidi-neutral at their
 * edges. An unisolated "~1.15" puts the tilde on the wrong side of the number,
 * and "9-13.2" reads as "13.2-9" — a range pointing backwards. The client
 * screenshotted both. Words are not the problem here; the digits between them
 * are, which is why this reads pixels rather than source.
 *
 * Every character's on-screen x is measured with a Range. Inside a run that was
 * authored left-to-right, x must increase monotonically. Where it does not, the
 * reader is seeing something nobody wrote.
 */
import { spawn } from 'node:child_process';
import { requireChrome } from './chrome.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = requireChrome();
const PORT = 9800 + (process.pid % 300);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/bv-bidi-' + process.pid,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { await sleep(250); }
  }
  throw new Error('chrome did not open a debugging port');
}
```

- [ ] **Step 2: Add the CDP plumbing and the page-side probe**

Append to the same file. The probe is a single expression evaluated in the page —
it is the same measurement proven against the live site, so keep it verbatim:

```js
/* The probe, as a string, because it runs in the page rather than here.
   TECHNICAL RUN: a maximal stretch with no Arabic letters that holds at least
   one digit or Latin letter. Those are the runs the bidi algorithm reorders. */
const PROBE = `(() => {
  const ARABIC = /[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;
  const findings = [];

  function xsOf(node) {
    const out = [];
    for (let i = 0; i < node.data.length; i++) {
      const r = document.createRange();
      r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      out.push(b.width || b.height ? b.left : null);
    }
    return out;
  }

  function scanTextNode(node) {
    const s = node.data;
    if (!/[0-9A-Za-z]/.test(s)) return;
    const x = xsOf(node);
    let run = null;
    const flush = () => {
      if (!run) return;
      const seg = s.slice(run.a, run.b);
      if (/[0-9A-Za-z]/.test(seg) && seg.trim().length > 1) {
        let ok = true, prev = null;
        for (let i = run.a; i < run.b; i++) {
          if (x[i] == null) continue;
          if (prev != null && x[i] < prev) { ok = false; break; }
          prev = x[i];
        }
        if (!ok) findings.push({
          text: seg.trim(),
          context: s.trim().slice(0, 90),
          where: (node.parentElement && node.parentElement.className) || '',
        });
      }
      run = null;
    };
    for (let i = 0; i < s.length; i++) {
      if (ARABIC.test(s[i])) flush();
      else if (run) run.b = i + 1;
      else run = { a: i, b: i + 1 };
    }
    flush();
  }

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (!n.parentElement) continue;
    if (n.parentElement.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
    scanTextNode(n);
  }
  return JSON.stringify(findings);
})()`;
```

- [ ] **Step 3: Add the driver that opens every case and reports**

Append to the same file:

```js
const ws = await wsUrl();
const sock = new WebSocket(ws);
let seq = 0;
const pending = new Map();
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r) => sock.addEventListener('open', r));
const send = (method, params) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  sock.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  return r && r.result ? r.result.value : undefined;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE + '?lang=ar' });
await sleep(3500);

const findings = [];
const seen = new Set();
const collect = async (label) => {
  const raw = await evaluate(PROBE);
  for (const f of JSON.parse(raw || '[]')) {
    const key = label + '|' + f.text + '|' + f.context;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(Object.assign({ at: label }, f));
  }
};

/* The home page first, with every card revealed. */
await evaluate('(() => { const b = document.getElementById("moreBtn"); '
  + 'for (let i = 0; i < 5; i++) if (b && !b.classList.contains("is-open")) b.click(); '
  + 'return 1; })()');
await sleep(600);
await collect('home');

/* Then every dossier, because that is where the numbers live.
   Called through BV_OPEN_CASE rather than by setting location.hash: the deep
   link is read exactly once, at the bottom of beeviro.js, and there is no
   hashchange listener — so a hash set after load opens nothing and this would
   have measured twenty-five copies of the home page. */
const slugs = await evaluate('JSON.stringify((window.BV_CLIENTS||[]).map(c=>c.slug))');
for (const slug of JSON.parse(slugs || '[]')) {
  await evaluate('(() => { window.BV_OPEN_CASE(' + JSON.stringify(slug) + '); return 1; })()');
  await sleep(450);
  await collect(slug);
  await evaluate('(() => { const x = document.getElementById("caseX"); if (x) x.click(); return 1; })()');
  await sleep(250);
}

for (const f of findings) {
  console.log('FAIL  ' + f.at + '  ' + JSON.stringify(f.text) + '  in: ' + f.context);
}
console.log(findings.length === 0
  ? 'PASS  every technical run reads as authored'
  : findings.length + ' mis-ordered run(s)');

sock.close();
chrome.kill();
process.exit(findings.length ? 1 : 0);
```

- [ ] **Step 4: Run it and confirm it fails with the known findings**

With `node serve.mjs` running in another terminal:

Run: `node tools/bidi.mjs`
Expected: **non-zero exit**, and `FAIL` lines including at least these, which
were measured against the current build:

```
izar      "~1.15"        ← exactly what the client screenshotted
izar      "9–13.2"
izar      "25–34"        ← the age bands in the diagnosis
izar      "~EGP 1.15M"
speakup   "~30–35"
cognistar "24 → 100"
kinetic-health  "25 → 43–57"
```

If the run reports **zero** findings, the probe is not reaching the text — check
that the dossier actually opened, not that the bug is gone.

- [ ] **Step 5: Verify the check is honest about the English build**

Run: `node tools/bidi.mjs --url http://localhost:4173/`

Note this drives the Arabic build regardless — the script appends `?lang=ar`.
That is deliberate: there is no bidi to get wrong in a left-to-right page, and a
check that passes trivially in English would hide a regression. Confirm the
output is identical to Step 4.

- [ ] **Step 6: Commit the red check**

```bash
git add tools/bidi.mjs
git commit -m "tools: check that arabic renders its numbers as authored (red)"
```

---

### Task 3: Isolate technical runs at render time

Make Task 2 pass.

**The metric tiles are already fixed and are not in scope.**
`site/css/beeviro.css:2009-2013` has carried `unicode-bidi: plaintext` on
`.bv-m__v`, `.bv-camp__v` and `.bv-stat__v` since the Initial Commit, with a
comment describing this exact bug. Whole-value fields render correctly today.
Confirmed by measuring the live Arabic page: no finding lands on `bv-m__v` or
`bv-camp__v`.

What is still broken is **prose with a technical run inside it** — the case the
client actually screenshotted. A CSS rule cannot reach it, because the run is
mid-sentence rather than alone in its own element. Measured, the 22 findings
land on exactly five classes:

| class | field |
|---|---|
| `bv-card__o` | `outcome.headline` on a work card |
| `bv-case__out` | `outcome.headline` in the dossier |
| `bv-step__b` | `journey.<stage>` body |
| `bv-m__n` | `metrics[].note` |
| `bv-lede` | `summary` |

The helper wraps each non-Arabic technical run in `<span dir="ltr">`. A run that
contains Arabic is left alone, so an Arabic metric value — which
`clients.ar.js` is allowed to supply via `am.v` — is never forced the wrong way.

**Files:**
- Modify: `site/js/beeviro.js` (the `esc` helper block, and the render call sites)

**Interfaces:**
- Consumes: the existing `esc(s)` in `beeviro.js`.
- Produces: `bidi(s): string` — HTML-escaped, with non-Arabic technical runs wrapped in `<span dir="ltr">…</span>`. A drop-in for `esc()` at any call site that renders client data into `innerHTML`. Safe to use in English: the wrap is inert in a left-to-right paragraph.

- [ ] **Step 1: Write the helper**

In `site/js/beeviro.js`, directly after the existing `esc` definition — anchor on
the closing of that function:

```js
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
```

Insert below it:

```js
  /* Arabic paragraphs reorder the numbers inside them.
   *
   * "~1.15 مليون" renders as "1.15~ مليون": the tilde is bidi-neutral, so in a
   * right-to-left paragraph it takes the paragraph's direction and crosses to
   * the far side of the number it modifies. "9–13.2" comes out "13.2–9" — a
   * range reading backwards. A reviewer screenshotted both and said the case
   * files were not understandable; they were not, because the figures in them
   * were inverted.
   *
   * A TECHNICAL RUN is a maximal stretch with no Arabic letters that carries at
   * least one digit or Latin letter. Wrapping it in an element with an explicit
   * direction isolates it: the bidi algorithm resolves the run on its own and
   * places the result as a single unit in the sentence.
   *
   * Runs containing Arabic are left alone — clients.ar.js may translate a metric
   * value, and forcing that one left-to-right would be the same bug mirrored.
   *
   * Tokenise the RAW string and escape each piece, rather than escaping first:
   * "&amp;" is Latin letters and would otherwise be wrapped as a technical run.
   *
   * The ranges are written as \u escapes on purpose. Spelled with literal Arabic
   * characters this class ends at U+FEFF, which is also the byte-order mark — an
   * editor that normalises it silently widens the class to everything. */
  var ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  function bidi(s) {
    s = String(s == null ? '' : s);
    if (!/[0-9A-Za-z]/.test(s)) return esc(s);
    var out = '';
    var run = '';
    function flush() {
      if (!run) return;
      // Trailing spaces belong to the sentence, not to the run.
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(run);
      var lead = m[1], core = m[2], tail = m[3];
      if (/[0-9A-Za-z]/.test(core) && core.length > 1) {
        out += esc(lead) + '<span dir="ltr">' + esc(core) + '</span>' + esc(tail);
      } else {
        out += esc(run);
      }
      run = '';
    }
    for (var i = 0; i < s.length; i++) {
      if (ARABIC_RE.test(s.charAt(i))) { flush(); out += esc(s.charAt(i)); }
      else run += s.charAt(i);
    }
    flush();
    return out;
  }
```

- [ ] **Step 2: Run the check to confirm it is still red**

The helper exists but nothing calls it yet.

Run: `node tools/bidi.mjs`
Expected: the same findings as Task 2 Step 4. Non-zero exit.

- [ ] **Step 3: Use it at the call sites that carry client data**

Six call sites in `site/js/beeviro.js`. Each is an `esc(...)` around a field that
comes from `clients.js` or `clients.ar.js`. Replace `esc` with `bidi` in exactly
these, anchoring on the surrounding text:

1. The work card's outcome line:

```js
          '<div class="bv-card__o">' + bidi(c.outcome.headline) + '</div>' +
```

2. The dossier outcome band:

```js
      '</h3><div class="bv-case__tagline bv-case__out" style="color:' +
      c.accent + '">' + bidi(c.outcome.headline) + '</div>' +
```

3. The metric NOTE — and **not** the metric value. `.bv-m__v` is already
   isolated by `unicode-bidi: plaintext` in the stylesheet; wrapping it again
   would be a second mechanism for a solved problem, and would override the
   `plaintext` first-strong resolution that lets `clients.ar.js` supply an
   Arabic value. Leave `esc(m.v)` exactly as it is:

```js
            '<span class="bv-m__v">' + esc(m.v) + '</span>' +
            '<span class="bv-m__l">' + esc(m.l) + '</span></span>' +
          '<span class="bv-m__b"><span class="bv-m__n">' + bidi(m.note) + '</span></span>' +
```

4. The dossier summary and tagline:

```js
      '<h2 class="bv-case__tagline">' + bidi(c.tagline) + '</h2>' +
      '<p class="bv-lede">' + bidi(c.summary) + '</p>' +
```

5. Each journey stage's body — this is where the age bands live:

```js
        '<div class="bv-step__b">' + bidi(body) + '</div></div></div>';
```

6. The campaign readout's closing line — and **not** the row value, for the same
   reason as `bv-m__v`: `.bv-camp__v` is already covered by the stylesheet's
   `unicode-bidi: plaintext` rule. Leave `esc(r[1])` alone:

```js
        h += '<div class="bv-camp__c"><div class="bv-camp__v">' + esc(r[1]) +
          '</div><div class="bv-camp__k">' + esc(r[0]) + '</div></div>';
```

```js
      h += '</div><div class="bv-camp__f">' + bidi(c.campaign.split) + '</div></div>' +
```

Leave `esc()` in place everywhere else. Labels (`m.l`, `r[0]`), service chips,
industry and country are prose without technical runs, and a needless wrapper is
a needless DOM node on a page that builds several hundred of them.

**Five call sites take `bidi()`, not six**: card outcome, dossier outcome,
`m.note`, `tagline` + `summary`, journey `body`, and `campaign.split`. The two
whole-value fields (`m.v`, `r[1]`) keep `esc()` — the stylesheet owns those.

- [ ] **Step 4: Run the check to verify it passes**

Run: `node tools/bidi.mjs`
Expected: `PASS  every technical run reads as authored`, exit code 0.

If a finding survives, it is in a call site not on the list above — the `at`
column names the client and the `where` column names the CSS class, which is
enough to find it. Add `bidi()` there rather than editing the data.

- [ ] **Step 5: Verify the English build is unchanged**

`<span dir="ltr">` inside a left-to-right paragraph is inert, but confirm it
rather than assume.

Run: `node tools/check.mjs --lang en`
Expected: it completes and reports measurements. Then open
`http://localhost:4173/?lang=en`, open the Izar case, and confirm the metric
tiles still read `809+`, `~EGP 1.15M`, `9–13.2`, `~830K`.

- [ ] **Step 6: Verify the Arabic reads correctly by eye**

Run: `node tools/shoot.mjs --at work --w 1440 --lang ar`

Open the written screenshot and confirm the Izar card's outcome line reads
`809+ عملية شراء · ~1.15 مليون ج.م · عائد 9–13.2` — tilde before the number,
range ascending. This is the exact line from the client's screenshot.

- [ ] **Step 7: Commit**

```bash
git add site/js/beeviro.js
git commit -m "fix: isolate latin and numeric runs inside arabic paragraphs

A bidi-neutral character next to a number takes the paragraph direction, so
'~1.15' rendered as '1.15~' and the range '9-13.2' as '13.2-9'. Twenty-one
fields across eight clients were showing figures nobody authored. Reported as
'the Arabic is broken' and 'the copy is not understandable' — it was the
numbers, not the words."
```

---

### Task 4: The client's order for the work grid

Revenue Lab 360 first, then CogniStar, MasterCraft, Tamahwour, SpeakUp, Kinetic
Health. The grid shows six before "Show more work", so the six named are exactly
the first page — this is a request about what a visitor sees without scrolling.

An explicit slug list, not a physical reshuffle of the records. The client has
reordered once for commercial reasons and will again; a list of 25 slugs is a
reviewable edit and moving 200-line blocks is not.

**Files:**
- Modify: `site/js/clients.js` (add `BV_ORDER` above `window.BV_CLIENTS`)
- Modify: `site/js/beeviro.js` (apply it once, before anything renders)
- Modify: `README.md`

**Interfaces:**
- Consumes: `window.BV_CLIENTS` from `clients.js`.
- Produces: `window.BV_ORDER: string[]` — display order by slug. Any slug absent from the list keeps its relative position, after every listed one.

- [ ] **Step 1: Declare the order**

In `site/js/clients.js`, directly above `window.BV_CLIENTS = [`:

```js
/* DISPLAY ORDER, by slug.
 *
 * The work grid shows six cards before "Show more work", so the first six here
 * are the whole of what a visitor sees without scrolling — which is why the
 * client specifies them and not the other nineteen. Revenue Lab 360 leads on
 * their instruction: a prospect who opens it by chance sees the work that went
 * into it.
 *
 * The array below stays grouped however is convenient for editing; this decides
 * what renders. A slug missing from this list is not an error — it sorts after
 * everything listed, keeping its relative position, so adding a client without
 * touching this list still works. */
window.BV_ORDER = [
  'revenuelab360', 'cognistar', 'master-craft', 'tamahwour', 'speakup', 'kinetic-health',
  'izar', 'freestyle', 'qr-tably', 'kirin', 'volt-ems', 'dr-eman', 'rojana',
  'black-star', 'daily-box', 'edara-plus', 'eqbal', 'moaafa', 'renda-perfumes',
  'rinos-kitchen', 'electro-master', 'moamen-medhat', 'hadeel-maqlad',
  'dar-al-hadith', 'sheikh-hosney',
];
```

- [ ] **Step 2: Apply it before anything renders**

In `site/js/beeviro.js`, find the line that captures the client list. It reads:

```js
  var C = window.BV_CLIENTS || [];
```

Replace with:

```js
  /* Sorted once, here, rather than at each of the four places that walk the list
     — the grid, the dossier's prev/next, the carousel and the hero comb all have
     to agree on what "case 3 of 25" means. hive.js reads window.BV_CLIENTS
     directly and gets the sorted array because this mutates in place. */
  var C = window.BV_CLIENTS || [];
  (function applyOrder() {
    var order = window.BV_ORDER;
    if (!order || !order.length) return;
    var rank = {};
    for (var i = 0; i < order.length; i++) rank[order[i]] = i;
    var at = function (c) {
      return rank[c.slug] == null ? order.length + C.indexOf(c) : rank[c.slug];
    };
    var keyed = C.map(function (c, i) { return { c: c, k: at(c), i: i }; });
    keyed.sort(function (a, b) { return a.k - b.k || a.i - b.i; });
    for (var j = 0; j < keyed.length; j++) C[j] = keyed[j].c;
  })();
```

`hive.js` loads after `beeviro.js` and reads `window.BV_CLIENTS`, which is the
same array object — mutating in place rather than reassigning is what keeps them
in agreement.

- [ ] **Step 3: Verify the first page is the six the client asked for**

With `node serve.mjs` running, open `http://localhost:4173/` and read the first
six card titles top to bottom. Expected, in order:

```
Revenue Lab 360
CogniStar
MasterCraft Egypt
Tamahwour
SpeakUp English Training
Kinetic Health
```

Confirm the meta line on the first card reads `Case 01`, and that pressing "Show
more work" reveals Izar as card 07.

- [ ] **Step 4: Verify nothing else broke**

Open the Revenue Lab 360 case. Confirm:
- the rail reads `Case 1 / 25`
- "Previous client" is disabled or wraps sensibly, and "Next client" opens CogniStar
- the hero comb still names clients on hover and opens the right case on click

Then run: `node tools/flow.mjs`
Expected: it completes without reporting a regression in the dossier navigation.

- [ ] **Step 5: Update the README**

In `README.md`, find the paragraph beginning "To edit copy, numbers or journeys"
and add after it:

```markdown
The order the clients appear in is **`window.BV_ORDER`** at the top of
`site/js/clients.js` — a list of slugs. The work grid shows six cards before
"Show more work", so the first six entries are what a visitor sees without
scrolling. A slug left out of the list still renders; it sorts after everything
listed.
```

- [ ] **Step 6: Commit**

```bash
git add site/js/clients.js site/js/beeviro.js README.md
git commit -m "feat: explicit display order, revenue lab 360 first"
```

---

### Task 5: A comb that does not repeat, and MasterCraft in the roster

Three complaints in one note. The comb's pool is images `01` and `02` of each
client — 44 pieces for 19 cells, so brands reappear before everyone has been
shown, and `01`/`02` are whatever sorted first rather than anyone's strongest
work. And Rino's Kitchen's reel is the dark dish frame the client wants gone.

`site/assets/hero/reels/master-craft.webm` already exists at 420px. It has no
`small/` copy and is not in the roster; that is the whole of the video work.

**Files:**
- Modify: `site/js/hive.js` (`PER_CLIENT`, the pool builder, and `REELS`)
- Create: `site/assets/hero/reels/small/master-craft.webm` (generated)
- Modify: `site/js/thumb-map.js` (generated by the same command — do not hand-edit)
- Modify: `README.md`

**Interfaces:**
- Consumes: `window.BV_CLIENTS` (sorted by Task 4, though this task does not depend on it).
- Produces: a comb pool that walks every client's full gallery before repeating a brand, and a six-reel roster containing `master-craft` and not `rinos-kitchen`.

> **Step order is load-bearing.** `tools/shrink-reels.mjs` has no slug list of
> its own — it parses `REELS = RICH ? [...]` straight out of `site/js/hive.js`
> (`tools/shrink-reels.mjs:159-165`) and encodes exactly what it finds there.
> Run it before the roster is edited and it re-encodes the old five and never
> produces the MasterCraft copy. The roster is edited first, on purpose.

- [ ] **Step 1: Swap the reel roster**

In `site/js/hive.js`, find:

```js
  var REELS = RICH ? ['freestyle', 'kinetic-health', 'eqbal', 'rinos-kitchen', 'daily-box', 'beeviro'] : [];
```

Replace with:

```js
  /* Six of the nineteen cells play a real client reel. Rino's Kitchen came out
     on review — the frame that landed in the comb read as a dish on a dark
     counter and said nothing about the work. MasterCraft went in for it; its
     420px cut was already in the library, only the 288px copy was missing.
     Every slug here needs an entry in small/ (tools/shrink-reels.mjs) or the
     comb streams the full file into a 116px hexagon. */
  var REELS = RICH ? ['freestyle', 'kinetic-health', 'eqbal', 'master-craft', 'daily-box', 'beeviro'] : [];
```

- [ ] **Step 2: Cut the light copy of the MasterCraft reel, and retire Rino's**

The comb plays the 288px copies, resolved through `thumb-map.js`. MasterCraft has
none, so without this it would stream the full 420px file into a 116px hexagon.
`shrink-reels` now reads the roster edited in Step 1.

**Pass the flags.** `tools/shrink-reels.mjs:35-36` defaults to `--size 300
--kbps 170`, but the canonical settings this repo ships its comb reels at are
288px and 115 kbps — `README.md:847`, `:924` and `:1133` all say so. Running it
bare re-encodes every comb reel at ~48% more bitrate and the wrong dimension,
which silently enlarges the five that did not need touching and produces a
MasterCraft copy about 50% over budget.

Run:

```bash
node tools/shrink-reels.mjs --size 288 --kbps 115
```

Expected: it reports `6 hero comb reels (of 15 in the folder…)`, writes
`site/assets/hero/reels/small/master-craft.webm`, and rewrites
`site/js/thumb-map.js`. It calls `replaceMap` with the
`assets/hero/reels/small/` prefix, which drops every mapping under that prefix
before merging — so the stale `rinos-kitchen` entry disappears on its own.

The **file** does not. `tools/audit-light.mjs` derives its orphan check from the
map rather than from disk, so it will pass while 97 KB sits unreachable in the
deployable root. Delete it by hand:

```bash
rm site/assets/hero/reels/small/rinos-kitchen.webm
```

Confirm:

```bash
ls site/assets/hero/reels/small/
grep -c "reels/master-craft.webm" site/js/thumb-map.js
grep -c "reels/small/rinos-kitchen.webm" site/js/thumb-map.js
```

Expected: `small/` holds six files including `master-craft.webm` (roughly
90–120 KB at the documented settings) and **not** `rinos-kitchen.webm`; the
first grep prints `1` and the second prints `0`.

`shrink-reels` re-encodes every slug in the roster, not just the missing one,
so the five that already had copies come back a few KB different for no reason.
Revert those five to keep the diff honest — only MasterCraft's copy should
change:

```bash
git checkout HEAD -- site/assets/hero/reels/small/beeviro.webm \
  site/assets/hero/reels/small/daily-box.webm \
  site/assets/hero/reels/small/eqbal.webm \
  site/assets/hero/reels/small/freestyle.webm \
  site/assets/hero/reels/small/kinetic-health.webm
```

- [ ] **Step 3: Widen the pool so no brand repeats before everyone is shown**

In `site/js/hive.js`, find the pool block:

```js
  var PER_CLIENT = 2;
  var pool = [];
  (function buildPool() {
    var withWork = C.filter(function (c) { return c.work; });
    for (var depth = 0; depth < PER_CLIENT; depth++) {
      for (var b = 0; b < withWork.length; b++) {
        var c = withWork[b];
        var n = depth + 1;
        if (n > c.work) continue;
        pool.push({ src: shot(c.slug, n), slug: c.slug });
      }
    }
  })();
```

Replace with:

```js
  /* Reviewed as "the cells repeat projects, and the material is not the best we
     have". Both were the same cause: the pool was images 01 and 02 of each
     client — 44 pieces, taken in filename order, for 19 cells that turn over
     every few seconds.
     It now walks each client's WHOLE gallery, still one client at a time, so a
     brand cannot come back until every other brand has had a turn, and every
     piece gets used rather than only whichever two sorted first. That is 178
     pieces across 22 clients.
     Still bounded, and still cheap: the cells resolve through BV_CELL to 200px
     WebP, and nothing is fetched until the cell it lands in turns over. */
  var pool = [];
  (function buildPool() {
    var withWork = C.filter(function (c) { return c.work; });
    var deepest = 0;
    withWork.forEach(function (c) { if (c.work > deepest) deepest = c.work; });
    for (var depth = 1; depth <= deepest; depth++) {
      for (var b = 0; b < withWork.length; b++) {
        var c = withWork[b];
        if (depth > c.work) continue;
        pool.push({ src: shot(c.slug, depth), slug: c.slug });
      }
    }
  })();
```

- [ ] **Step 4: Verify the pool and the roster in the browser**

With `node serve.mjs` running, open `http://localhost:4173/` and run this in the
browser console:

```js
(() => {
  const cells = document.querySelectorAll('.bv-cellx');
  const vids = [...cells].map(c => c.querySelector('video')).filter(Boolean);
  return {
    cells: cells.length,
    reels: vids.map(v => v.currentSrc.split('/').pop()).sort(),
  };
})()
```

Expected: `cells: 19`, and `reels` listing six `.webm` files including
`master-craft.webm` and **not** `rinos-kitchen.webm`.

- [ ] **Step 5: Verify the comb stopped repeating brands**

In the same console:

```js
(() => {
  const C = window.BV_CLIENTS.filter(c => c.work);
  const total = C.reduce((n, c) => n + c.work, 0);
  return { clients: C.length, pieces: total };
})()
```

Expected: `clients: 22`, `pieces: 178`. Note 181 .jpg files sit on disk, but
`assets/work/beeviro/`'s three belong to no client record and never enter the
pool. Widening alone makes a repeat rare, not impossible — 19 cells over 22
clients means the cursor still wraps onto brands on screen, which is why
`nextPiece()` also skips a slug already displayed. Watch the comb for
thirty seconds and confirm no brand shows twice in that window.

- [ ] **Step 6: Verify the page did not get heavier**

Run: `node tools/weigh.mjs`

Expected: first-view weight within a few KB of the pre-change figure. The pool
grew from 44 entries to 178, but entries are strings — nothing is fetched until a
cell turns over to it, and each is a 200px WebP. If weight jumped, the cells are
resolving to full-size originals: check `site/js/thumb-map.js` has `cell/` entries
for the clients now reachable.

Then run: `node tools/audit-light.mjs`
Expected: no report of an unmapped light copy.

- [ ] **Step 7: Update the README**

In `README.md`, find the line describing the reels:

```
│     ├─ hero/reels/*.webm       ← 6 real client reels, 420px, 2.0 MB
```

The count of files in that folder is 15, of which six play in the comb. Add after
the `assets/` block:

```markdown
The six reels that play in the hero comb are named in `REELS` at the top of
`site/js/hive.js`. Every slug listed there needs a 288px copy in
`assets/hero/reels/small/` — run `node tools/shrink-reels.mjs` after changing the
list, or the comb streams the full 420px file into a 116px hexagon.
```

- [ ] **Step 8: Commit**

```bash
git add site/js/hive.js site/js/thumb-map.js README.md
git add site/assets/hero/reels/small/master-craft.webm
git rm --cached site/assets/hero/reels/small/rinos-kitchen.webm 2>/dev/null || true
git add -u site/assets/hero/reels/small/
git commit -m "feat: comb walks every gallery, mastercraft replaces rino's kitchen

Reviewed as repeating brands and showing weaker material than we have. The pool
was images 01-02 of each client, 44 pieces for 19 cells; it now walks all 178."
```

---

### Task 6: The brand-logo pipeline

The client wants brand logos on the work cards instead of campaign images, and is
sending a folder. The folder has not arrived. Build the path it lands on, so
dropping it in is a data change.

`beeviro.js` already prefers `c.logo` — but only for clients with `work: 0`, of
which there are two. The gallery shot wins for the other 23 because of the order
of the branches, not because anyone chose it.

**Files:**
- Modify: `site/js/beeviro.js` (the `lead` branch in the work grid)
- Modify: `site/js/clients.js` (a `logo` field per client, where a file exists)
- Modify: `README.md`

**Interfaces:**
- Consumes: `c.logo` — a filename in `site/assets/logos/`, already the convention for the two logo-only clients.
- Produces: card lead art that prefers the brand logo when one exists, and falls back to the gallery shot when it does not. Correct with zero logos present and correct with all 25.

- [ ] **Step 1: Prefer the logo over the gallery shot**

In `site/js/beeviro.js`, find the lead-art branch:

```js
      // Lead art: a gallery shot, else the client's logo on a tinted plate,
      // else a branded hex with their initial (only where no logo was delivered).
      var lead;
      if (c.work) {
        lead = '<img loading="lazy" decoding="async" src="' + shotSmall(c, 1) + '" alt="">';
      } else if (c.logo) {
```

Replace the comment and the first two branches with:

```js
      /* Lead art, in the order a reviewer asked for it: the brand's own mark
         first, then a gallery shot, then a branded hex with their initial.
         Reviewed as "put the brands' logos instead of taking images from their
         content" — a card is an index entry, and a brand is recognised by its
         mark faster than by one of its posts.
         The gallery fallback is not a stopgap: logos arrive per client, and a
         client without one has to keep reading as a finished card rather than a
         lettered placeholder. */
      var lead;
      if (c.logo) {
        lead = '<span class="bv-card__plate"><img loading="lazy" decoding="async" src="' +
          thumb('assets/logos/' + c.logo) + '" alt="' + esc(c.name) + ' logo"></span>';
      } else if (c.work) {
        lead = '<img loading="lazy" decoding="async" src="' + shotSmall(c, 1) + '" alt="">';
```

Then find the skeleton-retirement line below it:

```js
      if (!c.work) b.querySelector('.bv-card__img').classList.add('is-loaded');
```

Replace with:

```js
      // A logo plate or a lettered hex is opaque and already covers the frame,
      // so there is nothing to wait for — retire the skeleton immediately.
      if (c.logo || !c.work) b.querySelector('.bv-card__img').classList.add('is-loaded');
```

- [ ] **Step 2: Verify the two existing logo clients still render**

Open `http://localhost:4173/`, press "Show more work" until all 25 are visible,
and find Dr. Eman Khamis and Sheikh Hosney. Both have `logo:` set and `work: 0`.

Expected: both still show a logo plate, unchanged. Every other card still shows
its gallery image, because no other client has a `logo` field yet. Confirm in the
console:

```js
window.BV_CLIENTS.filter(c => c.logo).map(c => c.slug)
```

Expected: `["dr-eman", "sheikh-hosney"]`.

- [ ] **Step 3: Prove the pipeline with one real client**

Three logos already sit in `site/assets/logos/` with no client pointing at them:
`kirin.png`, `rojana.png` and `hadeel-maqlad.png`. Wire all three, which
exercises the new branch on clients that **do** have galleries — the case
`dr-eman` and `sheikh-hosney` never covered.

In `site/js/clients.js`, add to each of the three records a `logo` field beside
the existing `work:` line at the end of that record, matching how `dr-eman`
declares `work: 0, logo: 'dr-eman.png',`:

- the `kirin` record — `logo: 'kirin.png',`
- the `rojana` record — `logo: 'rojana.png',`
- the `hadeel-maqlad` record — `logo: 'hadeel-maqlad.png',`

Anchor each edit on that record's `work:` line, which is unique per record.

- [ ] **Step 4: Verify all three switched to their logo plate**

Reload `http://localhost:4173/`, reveal all cards, and confirm the Kirin Top Up,
Rojana Kids Store and Hadeel Maqlad cards now show a logo on a tinted plate
rather than a campaign image — while their case dossiers still open with the
full gallery intact. That last part is the point of the test: these three have
galleries, and the gallery must survive the card no longer leading with it.

Confirm in the console:

```js
window.BV_CLIENTS.filter(c => c.logo).map(c => c.slug)
```

Expected: exactly these five slugs, in whatever order `BV_ORDER` put them —
`kirin`, `rojana`, `dr-eman`, `hadeel-maqlad`, `sheikh-hosney`.

Run: `node tools/audit-light.mjs`
Expected: no unmapped light copy. `kirin.webp`, `rojana.webp` and
`hadeel-maqlad.webp` already exist in `site/assets/light/`, so each plate
resolves to its light copy without a `squeeze` run.

- [ ] **Step 5: Document how the folder lands**

In `README.md`, find the paragraph beginning "To edit copy, numbers or journeys"
and add after it:

```markdown
**Brand logos on the work cards.** A card leads with the client's mark whenever
`logo:` is set on their record in `site/js/clients.js`, and falls back to their
first gallery image when it is not. To add one:

1. Drop the file into `site/assets/logos/<slug>.png` — cut out, transparent.
2. Run `node tools/squeeze.mjs`, which discovers everything in that folder and
   writes the 520px WebP copy the card actually displays.
3. Add `logo: '<slug>.png',` to that client's record.

Nothing else needs touching. A logo with no record still ships unused, and a
record with no file falls back to the gallery shot — neither breaks the page.
```

- [ ] **Step 6: Commit**

```bash
git add site/js/beeviro.js site/js/clients.js README.md
git commit -m "feat: work cards lead with the brand mark when one exists

Reviewed as 'put the brands' logos instead of images from their content'. The
preference and the squeeze step ship now; the client's logo folder is a data
drop once it arrives. Kirin and Rojana wired from marks already in the repo."
```

- [ ] **Step 7: Run the whole gate before closing the plan**

```bash
node tools/bidi.mjs          # Arabic renders its numbers as authored
node tools/audit-light.mjs   # every light copy is wired in
node tools/weigh.mjs         # the page did not get heavier
node tools/flow.mjs          # the dossier still navigates
```

Expected: all four exit zero. Then rebuild the embed bundle, which is generated
from `site/` and is now stale:

```bash
node build-embed.mjs
git add beeviro-embed.html split/
git commit -m "build: rebuild embed bundle for review pass 4"
```

---

## What this plan does not do

Handed to the copy plan (`2026-09-17-review-pass-4-copy.md`):

- Rewriting the per-client prose in Arabic to a more Egyptian register, and in
  English for clarity. Task 3 fixes what the bidi algorithm was doing to the
  figures; it does not change a single word.

Blocked on the client:

- The brand logo image files. Task 6 ships the pipeline and wires the four marks
  already in the repository.
- CogniStar's "updated material".
- `V 2 NEW.mp4`. Task 5 uses the MasterCraft cut already in the library. If they
  send that specific file, it is
  `node tools/ingest-reels.mjs --only master-craft --force`, then
  `node tools/shrink-reels.mjs` — not a code change.
