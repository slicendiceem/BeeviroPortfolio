# Review Pass 4 — Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all 25 case files so a reader in either language finishes one knowing what the brand sold, what was wrong, what we did and what came back — in Arabic that sounds like an Egyptian wrote it, and in English that says something rather than sounds like something.

**Architecture:** No code changes. `site/js/clients.js` holds the English records and `site/js/clients.ar.js` overlays the Arabic by slug; both are edited in place, record by record, and `i18n.js` merges them untouched. A new `tools/copy.mjs` enforces the things a reviewer should never have to catch by eye — a field that silently fell back to English, a metric note that went missing, a figure that drifted from the English record, a number authored so the bidi algorithm inverts it. Judgement stays human; bookkeeping does not.

**Tech Stack:** Vanilla ES2019 data files (no framework, no build step), Node 18+ ESM for tooling, headless Chrome over CDP for the rendered checks.

**Spec:** `docs/superpowers/specs/2026-09-17-review-pass-4.md`

**Depends on:** `docs/superpowers/plans/2026-09-17-review-pass-4-structure.md` — Tasks 1 to 3. `tools/chrome.mjs` must resolve a browser, and `bidi()` must be live in `beeviro.js`, or new copy gets authored against a renderer that is still inverting its own numbers.

## Global Constraints

Every task's requirements implicitly include this section.

- **REDACTION RULE.** Nothing published may contain competitor names or teardowns, internal media budgets, unpublished projections, phone numbers or personal handles. `sources/` must never ship. The strategy decks in `sources/` are the research input for this rewrite and stay out of the deployable tree.
- **EDITORIAL RULE.** `outcome.kind: 'result'` only where the figure is published in the client-approved document. Never promote a `goal` to a `result` while rewriting the sentence around it. Never add a metric without a `note`.
- **Figures are not editorial.** `metrics[].v`, `outcome.kind` and every number in `campaign.rows` come from the client-approved document. A rewrite may change how a figure is introduced; it may never change the figure.
- Site JavaScript is **plain ES2019**. These two files are data, but they are parsed as site JS: `var`, no template literals, no trailing-comma-sensitive syntax beyond what is already there.
- **No dependencies and no build step.**
- `site/js/clients.ar.js` is an **overlay**. An untranslated field falls back to the English, which is a readable failure — never paste the English into the Arabic file to "fill" a field.
- Brand names stay in Latin script. That is how these clients write their own names.
- Anchor every edit on unique surrounding text, never on line numbers.

## The register decision, and one thing to confirm

The review asks for *"a more Egyptian Arabic tone"*. Taken literally — full
عامية — that collides with the rest of the site: Beeviro sells into Saudi
Arabia, the UAE and Qatar, four of the 25 clients are Gulf-facing, and
`hero.eyebrow` says so.

**The register this plan writes in:** modern, plain, Egyptian-leaning Arabic.
Sentence rhythm and word choice an Egyptian marketer would actually use, no
classical constructions, no ornament — but not dialect spelling, and nothing a
Gulf reader would stumble on. Concretely:

| Not this | This |
|---|---|
| بنينا الحُجّة للتنافس على الخامة | بنينا الحجّة إننا ننافس بالخامة |
| ثم وضعنا ميزانية حقيقية خلف المحتوى الذي يُثبت ذلك | وحطّينا ميزانية حقيقية ورا المحتوى اللي بيثبت ده |
| الجودة كانت تُدّعى ولا تُبرهن | الجودة كانت بتتقال، ومحدش بيثبتها |

**Confirm with the client before Task 2.** If they want full عامية — «إحنا
عملنا», «مكنش فيه» — that is a different register and this plan's reference
client should be rewritten to match before the other 24 are touched. Ask once,
in writing, and paste the answer into this section.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tools/copy.mjs` | **new** — coverage, figure drift, bidi-safe authoring, forbidden terms | 1 |
| `docs/superpowers/specs/2026-09-17-copy-contract.md` | **new** — the style contract the rewrite is checked against | 1 |
| `site/js/clients.js` | English records, rewritten record by record | 2–8 |
| `site/js/clients.ar.js` | Arabic overlay, rewritten record by record | 2–8 |

Tasks 3 to 8 are independent of each other and can run in any order or in
parallel. Each is a self-contained batch: the same work, different clients.

---

### Task 1: The contract, and a check that enforces its mechanical half

Twenty-five records × two languages × ~14 fields is 700 edits. A reviewer reading
for tone should not also be counting whether metric 3 of client 17 kept its note.

**Files:**
- Create: `docs/superpowers/specs/2026-09-17-copy-contract.md`
- Create: `tools/copy.mjs`

**Interfaces:**
- Consumes: `requireChrome()` from `tools/chrome.mjs` (structure plan, Task 1).
- Produces: `node tools/copy.mjs [--only slug,slug]` — prints `PASS`/`FAIL` per rule, an `n/m passed` summary, and exits non-zero on any failure.

- [ ] **Step 1: Write the contract**

Create `docs/superpowers/specs/2026-09-17-copy-contract.md`:

```markdown
# Case File Copy Contract

Both languages. Checked mechanically by `node tools/copy.mjs`; the rest is
judgement and is reviewed by a human.

## What a case file has to answer

In order, and a reader should be able to stop at any point and still have got
something:

1. **tagline** — the one claim, in under 60 characters. Not a slogan for the
   client; a summary of what we did for them.
2. **summary** — 40 to 70 words. What the brand sells, what was wrong, what we
   did, what came back. If the record has a delivered result, the summary names
   the headline figure. If it has a goal, the summary does not.
3. **journey.contact** — the state the brand arrived in. Concrete: channels,
   assets, what was already running.
4. **journey.diagnose** — what we found, with the finding that decided the work
   called out as such.
5. **journey.position** — the single claim, and what it displaced.
6. **journey.build** — what was actually produced. Nouns, countable.
7. **journey.launch** — where it went live and how it was run.
8. **journey.outcome** — what came back, restating the figures in prose.
9. **metrics[].note** — where this number comes from and what window it covers.

## Rules

- **Concrete over literary.** "almost nobody in the category shows the fabric"
  beats "quality was being claimed, never demonstrated". If a sentence would
  survive being moved to another client's record, it is not doing its job.
- **No figure appears in prose that is not in `metrics` or `campaign`.**
- **A goal is a goal.** Where `outcome.kind === 'goal'`, the prose says what the
  strategy was built to hit — never what it hit.
- **Journey stages: 25 to 60 words.** Under 25 says nothing; over 60 stops being
  read.
- **Arabic register:** modern, plain, Egyptian-leaning. See the register section
  of the copy plan.
- **Latin and numeric runs are authored as they read**, left to right. The
  renderer isolates them (`bidi()` in `beeviro.js`), so write `~1.15`, `9–13.2`
  and `25 → 43–57` the natural way. Never pre-reverse a range to "make it look
  right" — that breaks the moment the isolation lands.
- **Ranges use an en dash** (`–`), not a hyphen. Arrows are `→`. These are the
  characters `bidi()` and `tools/bidi.mjs` are written against.
- **Percentages sit against their number**: `40–50%`, not `40–50 %`.
- **Brand names stay Latin.** Never transliterate.

## Forbidden

Beyond the redaction rule: no competitor named, no media budget, no unpublished
projection, no personal handle. Also no "leverage", no "synergy", no "in today's
fast-paced digital landscape", and no sentence whose subject is "we" three times
running.
```

- [ ] **Step 2: Write the check, and run it against today's data**

Create `tools/copy.mjs`:

```js
/* Is every case file complete, honest about its figures, and safe to render?
 *
 *   node tools/copy.mjs                    every client
 *   node tools/copy.mjs --only izar,speakup
 *
 * Twenty-five records in two languages is seven hundred edits, and the failures
 * that matter are the quiet ones: a field that fell back to English and reads
 * fine, a metric that lost its note, a figure retyped one digit off. Tone is
 * reviewed by a person. This is the bookkeeping.
 *
 * Reads the two data files directly rather than through a browser — they are
 * plain assignments to `window`, so a tiny sandbox is enough and the check stays
 * fast enough to run on every record.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ['site/js/clients.js', 'site/js/clients.ar.js']) {
  vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const EN = sandbox.window.BV_CLIENTS || [];
const AR = sandbox.window.BV_CLIENTS_AR || {};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  if (!pass) console.log('FAIL  ' + name + (detail ? '  — ' + detail : ''));
};

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const STAGES = ['contact', 'diagnose', 'position', 'build', 'launch', 'outcome'];
/* Pre-reversed ranges are the one thing a well-meaning translator does that the
   renderer cannot undo: "13.2–9" is authored backwards and renders backwards. */
const DESCENDING = /(\d+(?:\.\d+)?)\s*[–—]\s*(\d+(?:\.\d+)?)/g;

for (const c of EN) {
  if (ONLY.length && ONLY.indexOf(c.slug) < 0) continue;
  const a = AR[c.slug];
  const id = c.slug;

  check(id + ' · has an Arabic record', !!a);
  if (!a) continue;

  for (const f of ['tagline', 'summary']) {
    check(id + ' · ar.' + f, !!a[f], 'falls back to English');
  }
  check(id + ' · summary length (40–70 words)',
    words(c.summary) >= 40 && words(c.summary) <= 70, words(c.summary) + ' words');

  for (const s of STAGES) {
    const en = c.journey && c.journey[s];
    if (!en) continue;
    check(id + ' · journey.' + s + ' length (25–60 words)',
      words(en) >= 25 && words(en) <= 60, words(en) + ' words');
    check(id + ' · ar.journey.' + s, !!(a.journey && a.journey[s]), 'falls back to English');
  }

  (c.metrics || []).forEach((m, i) => {
    check(id + ' · metrics[' + i + '].note', !!m.note, 'a metric without a source');
    const am = (a.metrics || [])[i];
    check(id + ' · ar.metrics[' + i + '].l', !!(am && am.l), 'falls back to English');
    check(id + ' · ar.metrics[' + i + '].note', !!(am && am.note), 'falls back to English');
    // The Arabic overlay may translate a value, but never invent a different one.
    if (am && am.v && /\d/.test(am.v) && /\d/.test(m.v)) {
      const digits = (s) => String(s).replace(/[^\d]/g, '');
      check(id + ' · metrics[' + i + '] figure matches',
        digits(am.v) === digits(m.v), JSON.stringify(m.v) + ' vs ' + JSON.stringify(am.v));
    }
  });

  check(id + ' · outcome.kind unchanged',
    c.outcome.kind === 'result' || c.outcome.kind === 'goal', c.outcome.kind);
  check(id + ' · ar.outcome.headline',
    !!(a.outcome && a.outcome.headline), 'falls back to English');

  // Every authored range must ascend, in both languages.
  const prose = [c.summary, c.outcome.headline, a.summary, a.outcome.headline]
    .concat(STAGES.map((s) => c.journey && c.journey[s]))
    .concat(STAGES.map((s) => a.journey && a.journey[s]))
    .filter(Boolean).join('\n');
  let m2, backwards = [];
  DESCENDING.lastIndex = 0;
  while ((m2 = DESCENDING.exec(prose))) {
    if (parseFloat(m2[1]) > parseFloat(m2[2])) backwards.push(m2[0]);
  }
  check(id + ' · ranges ascend', backwards.length === 0, backwards.join(', '));

  // Hyphen-minus between digits renders differently from an en dash; the bidi
  // tooling is written against the en dash.
  check(id + ' · ranges use an en dash',
    !/\d\s*-\s*\d/.test(prose), 'found a hyphen between digits');
}

const passed = results.filter((r) => r.pass).length;
console.log(passed + '/' + results.length + ' passed');
process.exit(passed === results.length ? 0 : 1);
```

- [ ] **Step 3: Run it and record the starting state**

Run: `node tools/copy.mjs`

Expected: a non-zero exit with a list of failures. This is the baseline — every
`FAIL` line is a real gap in today's data. Save the output:

```bash
node tools/copy.mjs > /tmp/copy-baseline.txt 2>&1 || true
wc -l /tmp/copy-baseline.txt
```

Do not fix anything yet. Tasks 2 to 8 close these as they go.

- [ ] **Step 4: Commit**

```bash
git add tools/copy.mjs docs/superpowers/specs/2026-09-17-copy-contract.md
git commit -m "tools: copy contract and its mechanical check"
```

---

### Task 2: Izar, as the reference

The client screenshotted the Izar case. Rewrite it first, in both languages, and
treat the result as the pattern the other 24 are matched against — so a reviewer
approves the register once rather than 25 times.

**Files:**
- Modify: `site/js/clients.js` (the `izar` record)
- Modify: `site/js/clients.ar.js` (the `'izar'` entry)

**Interfaces:**
- Consumes: the contract from Task 1, and `sources/izar/plan.pdf` for the facts.
- Produces: one approved record in each language, cited by every later task as the register and density to match.

- [ ] **Step 1: Read the source before writing a word**

Read `sources/izar/plan.pdf`. Confirm against the existing record that the
figures are unchanged: 809+ purchases, ~EGP 1.15M revenue, ROAS 9–13.2, ~830K
reach, three-month window. **Those numbers do not change in this task.**

- [ ] **Step 2: Rewrite the English record**

In `site/js/clients.js`, in the `izar` record, replace `tagline`, `summary` and
the six `journey` stages with:

```js
    tagline: 'Sell the cloth, not the discount.',
    summary: 'Izar sells one thing: heavy gabardine trousers for men. Everyone in the category competes on price. We showed buyers what the fabric actually does — on camera, at close range — and put the budget behind the ads that proved it. Over three months the store took more than 809 orders and about EGP 1.15M.',
    journey: {
      contact: 'One product, one sales channel. The web store worked and the ad account was already running, but the brand had almost no visual identity of its own, and every competitor in the category was discounting.',
      diagnose: 'We split the buyer into three age bands — 25–34, 35–44 and 45–54 — because each buys trousers for a different reason. Then we went through the category. One finding decided the campaign: almost nobody shows the fabric, few show the stitching, and almost none publish a fit guide. Quality was claimed everywhere and demonstrated nowhere.',
      position: 'Compete on proof instead of price. Four claims the brand could put on camera and defend: gabardine heavy enough to last, tailoring detail you can see, colour that survives washing, and a cut that works on more than one body shape.',
      build: 'Content built to demonstrate rather than assert: close-ups on stitching, a stretch test, a colour-fastness video shot after washing, and a fit guide using real models across different body types. Plus a card in every order carrying a discount code for the next one and a link back for feedback.',
      launch: 'Paid social, with spend consolidated into the winning campaign rather than spread evenly across all of them, and structure and KPIs reviewed monthly. Every ad was cut to 10–15 seconds on a fixed beat: look, then fit, then details, then lifestyle.',
      outcome: 'Across a three-month window the account returned more than 809 purchases and roughly EGP 1.15M in revenue. The best campaigns ran at a return on ad spend between 9 and 13.2, and the single strongest returned 13.2.',
    },
```

- [ ] **Step 3: Rewrite the Arabic record**

In `site/js/clients.ar.js`, in the `'izar'` entry, replace `tagline`, `summary`,
the six `journey` stages and the four `metrics` notes with:

```js
    tagline: 'بيع القماش، مش الخصم.',
    summary: 'Izar بتبيع حاجة واحدة: بنطلونات جبردين تقيلة للرجالة. كل اللي في السوق بينافس على السعر. إحنا ورّينا المشتري الخامة بتعمل إيه فعلًا — قدّام الكاميرا ومن قُرب — وحطّينا الميزانية ورا الإعلانات اللي أثبتت ده. في تلات شهور المتجر عمل أكتر من 809 طلب وحوالي 1.15 مليون جنيه.',
    journey: {
      contact: 'منتج واحد وقناة بيع واحدة. المتجر شغّال والحساب الإعلاني كان ماشي بالفعل، بس العلامة مكانش ليها هوية بصرية تخصّها، وكل المنافسين في الفئة بيخصموا.',
      diagnose: 'قسّمنا المشتري لتلات شرايح عمرية — 25–34 و35–44 و45–54 — لأن كل واحدة بتشتري بنطلون لسبب مختلف. بعدين مشّينا على الفئة كلها. اكتشاف واحد حدّد الحملة: محدش تقريبًا بيوري القماش، وقليل اللي بيوري الحياكة، وأقل من كده اللي ناشر دليل مقاسات. الجودة كانت بتتقال في كل حتة ومحدش بيثبتها.',
      position: 'ننافس بالبرهان مش بالسعر. أربع دعاوى تقدر العلامة تحطها قدّام الكاميرا وتدافع عنها: جبردين تقيل يدوم، تفاصيل تفصيل تشوفها بعينك، لون يستحمّل الغسيل، وقَصّة تظبط على أكتر من شكل جسم.',
      build: 'محتوى مبني على الإثبات مش الادّعاء: لقطات قريبة للحياكة، اختبار شدّ، فيديو لثبات اللون بعد الغسيل، ودليل مقاسات بعارضين حقيقيين بأجسام مختلفة. وكمان كارت جوّه كل طلب فيه كود خصم للطلب اللي بعده ورابط يرجّع رأي العميل.',
      launch: 'إعلانات مدفوعة، والميزانية اتجمّعت في الحملة الرابحة بدل ما تتوزّع بالتساوي، مع مراجعة البنية والمؤشرات كل شهر. وكل إعلان اتقصّ على 10–15 ثانية بإيقاع ثابت: مظهر، وبعدين قَصّة، وبعدين تفاصيل، وبعدين أسلوب حياة.',
      outcome: 'في تلات شهور الحساب رجّع أكتر من 809 عملية شراء وحوالي 1.15 مليون جنيه إيرادات. أحسن الحملات اشتغلت بعائد على الإنفاق بين 9 و13.2، وأقواها لوحدها رجّعت 13.2.',
    },
    outcome: { headline: '809+ عملية شراء · ~1.15 مليون ج.م · عائد 9–13.2' },
    film: { note: 'القماش والحياكة والقَصّة معروضة مش مُدّعاة — وهي حجّة الحالة كلها.' },
    metrics: [
      { l: 'عمليات الشراء', note: 'عمليات شراء من الموقع اتحسبت خلال فترة التقرير، تلات شهور.' },
      { l: 'الإيرادات', note: 'قيمة التحويلات في نفس التلات شهور.' },
      { l: 'العائد على الإنفاق', note: 'المدى عبر أحسن الحملات أداءً؛ أقوى حملة لوحدها رجّعت 13.2.' },
      { l: 'الوصول', note: 'عدد الناس اللي وصلهم الإعلان في التلات شهور.' },
    ],
```

- [ ] **Step 4: Run the mechanical check on this record alone**

Run: `node tools/copy.mjs --only izar`
Expected: `n/n passed`, exit code 0.

If the summary fails its word band, cut — do not pad. If a range fails, it was
authored descending or with a hyphen; fix the authoring, never the checker.

- [ ] **Step 5: Verify it renders correctly in both languages**

With `node serve.mjs` running:

Run: `node tools/bidi.mjs`
Expected: `PASS  every technical run reads as authored`. The new Arabic carries
`25–34`, `9–13.2` and `~1.15`, so this is a real test of the structure plan's
Task 3, not a formality.

Then open `http://localhost:4173/?lang=ar`, open the Izar case, and read it
end to end. Confirm the age bands read `25–34` and not `34–25`, and the outcome
headline reads `809+ عملية شراء · ~1.15 مليون ج.م · عائد 9–13.2`.

- [ ] **Step 6: Get the register approved before writing 24 more**

Send the client the Arabic Izar case — the rendered page, not the source file —
and ask one question: *is this the tone you meant?* Paste the answer into the
register section of this plan.

**Do not start Task 3 before that answer arrives.** Rewriting 24 records in a
register that gets rejected is the single most expensive mistake available here.

- [ ] **Step 7: Commit**

```bash
git add site/js/clients.js site/js/clients.ar.js
git commit -m "copy: rewrite the izar case in both languages

The record the reviewer screenshotted. Concrete over literary in English,
Egyptian-leaning and plain in Arabic. Figures unchanged."
```

---

### Tasks 3–8: The remaining 24, in batches

Every one of these tasks is the same work on different records, so the steps are
written once here and the batches follow. **Do not start any of them before Task
2 Step 6 has an answer.**

**The steps, for each client in the batch:**

- [ ] **Step 1: Read the source**

Open the client's folder under `sources/<slug>/` — most have `plan.pdf` or
`strategy-swot.pdf`, and `infosource/Beeviro Portfolio Formatted .pdf` carries
the approved figures for all of them. Confirm every number in the existing record
against it before touching a sentence. Where a client has no source folder, the
existing record is the only source: the rewrite is then a clarity pass and may
not introduce a single new fact.

- [ ] **Step 2: Rewrite the English record**

`tagline`, `summary`, six `journey` stages, and any `metrics[].note` that says
less than it should. Match the density of the Izar record in Task 2: concrete
nouns, the deciding finding called out as such, the figure named in the summary
only where `outcome.kind === 'result'`.

- [ ] **Step 3: Rewrite the Arabic record**

The same fields plus `outcome.headline` and the `metrics[].l` labels, in the
register approved in Task 2. Translate the *argument*, not the sentence — an
Arabic case file that tracks the English clause for clause reads like a
translation, which is what the review objected to.

- [ ] **Step 4: Run the check on the batch**

Run: `node tools/copy.mjs --only <the batch's slugs, comma-separated>`
Expected: `n/n passed`, exit code 0.

- [ ] **Step 5: Verify the batch renders**

Run: `node tools/bidi.mjs`
Expected: `PASS`. Then open each rewritten case at
`http://localhost:4173/?lang=ar` and read it through once.

- [ ] **Step 6: Commit the batch**

```bash
git add site/js/clients.js site/js/clients.ar.js
git commit -m "copy: rewrite <slugs> in both languages"
```

---

#### Task 3 — the first page, part one

`revenuelab360`, `cognistar`, `master-craft`

These three open the site after the structure plan's reordering, so they are the
first case files anyone reads. Two notes specific to this batch:

- **`master-craft` carries `A+` in both `summary` and `journey.diagnose`**, which
  the bidi check flags. Keep the term if it is the client's own — the renderer
  isolates it — but confirm it reads as intended in Arabic.
- **`cognistar` is `outcome.kind: 'goal'`.** The rewrite says what the strategy
  was built to reach. It does not say it was reached. The client has also asked
  for updated CogniStar material, which is not in this plan; if it arrives before
  this task runs, read it first.

Sources: `sources/cognistar/go-to-market-strategy.pdf`. Revenue Lab 360 and
MasterCraft have no source folder — clarity pass only, no new facts.

#### Task 4 — the first page, part two

`tamahwour`, `speakup`, `kinetic-health`

- **`kinetic-health` is the densest numeric record on the site**: `40–50%`,
  `60–70%`, `25 → 43–57`, `60–80` in a metric note, and two ranges in
  `journey.outcome`. Every one is a `goal`, not a result. Get the arrows and en
  dashes exactly as the contract specifies.
- **`speakup` carries `~65`, `~30–35` and `~5–10`** in `journey.diagnose` — audience
  splits that currently render inverted.

Sources: `sources/speakup/strategy-swot.pdf`,
`sources/kinetic-health/full-marketing-strategy.pdf`. Tamahwour has none.

#### Task 5

`freestyle`, `qr-tably`, `kirin`, `volt-ems`

`freestyle` has a `campaign` block — `campaign.note` and `campaign.split` are in
scope, and the numbers in `campaign.rows` are not.

Sources: `sources/freestyle/plan.pdf`,
`sources/freestyle/ads-report-aug-sep-2025.pdf`, `sources/qr-tably/plan.pdf`,
`sources/kirin/strategy.pdf`, `sources/volt-ems/strategy-swot.pdf`.

#### Task 6

`dr-eman`, `rojana`, `black-star`, `daily-box`

`dr-eman` is `work: 0` — no gallery at all, so the prose is the entire case and
carries more weight than its length suggests. The other three have galleries.

Sources: `sources/dr-eman/strategy-swot.pdf`, `sources/black-star/plan.pdf`,
`sources/daily-box/plan.pdf`. Rojana has none.

#### Task 7

`edara-plus`, `eqbal`, `moaafa`, `renda-perfumes`

`edara-plus` carries `0 → 1` and `moaafa` carries `0 → launch` as metric values —
both currently invert. Neither value changes; only the note around it.

Source: `sources/edara-plus/plan.pdf`. The other three have none.

#### Task 8

`rinos-kitchen`, `electro-master`, `moamen-medhat`, `hadeel-maqlad`,
`dar-al-hadith`, `sheikh-hosney`

Six, because these are the shortest records on the site. `dar-al-hadith` is
`work: 0` with a film — its `film.note` is the gallery. `sheikh-hosney` is
`work: 0` with a logo.

No source folders. Clarity pass only; introduce no new facts.

---

### Task 9: Close the plan

- [ ] **Step 1: Run everything**

```bash
node tools/copy.mjs        # all 25 records complete and consistent
node tools/bidi.mjs        # every technical run renders as authored
node tools/check.mjs --lang ar
node tools/check.mjs --lang en
```

Expected: all four exit zero.

- [ ] **Step 2: Compare against the baseline**

```bash
node tools/copy.mjs | tail -1
```

Expected: `n/n passed`, against the failures recorded in
`/tmp/copy-baseline.txt` at Task 1 Step 3.

- [ ] **Step 3: Read four case files end to end, in Arabic**

Pick `revenuelab360`, `kinetic-health`, `izar` and one of Task 8's short records.
Read each one through in the browser at `?lang=ar`. The question is not whether
the words are correct — the check covers that. It is whether a reader who knows
nothing about the client finishes knowing what was sold, what was wrong, what was
done and what came back.

- [ ] **Step 4: Rebuild the embed bundle**

`beeviro-embed.html` and `split/*` are generated from `site/` and are now stale.

```bash
node build-embed.mjs
git add beeviro-embed.html split/
git commit -m "build: rebuild embed bundle after the copy rewrite"
```
