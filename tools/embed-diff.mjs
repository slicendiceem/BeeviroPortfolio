/* Compare two beeviro-embed.html builds along the dimensions that separate
 * the hand-merged reference from a fresh build-embed.mjs run, and fail when
 * the fresh one lost ground.
 *
 * beeviro-embed.html is GENERATED from site/, but picked up five features
 * across several sessions that have no source in site/ at all: the merged
 * redesign, the Cairo font, the mobile hero, the client filter bar, and the
 * language-toggle fix. A plan (see
 * .superpowers/sdd/2026-09-30-port-and-roster/) moves each one into site/ so
 * the build can be run again without deleting it. This tool is the
 * *structural* half of "did that actually land" — it counts markers in the
 * built HTML text. It does not open a browser; see tools/verify-port.mjs for
 * the behavioural half.
 *
 *   node tools/embed-diff.mjs <ref.html> <cand.html>
 *   node tools/embed-diff.mjs <ref.html> <cand.html> --expect-clients 20
 *   node tools/embed-diff.mjs <ref.html> <cand.html> --json
 *   node tools/embed-diff.mjs <ref.html> <cand.html> --tokens
 *
 * Exit 0  no tracked dimension regressed.
 * Exit 1  at least one did — the regressed names are printed (and listed
 *         under "regressed" in --json output).
 * Exit 2  bad invocation: wrong argument count, unreadable file, unknown flag.
 *
 * A count-based dimension regresses when the candidate's count is LOWER than
 * the reference's. --expect-clients N replaces the client-slug comparison
 * with an exact assertion on the candidate alone instead, for the one task in
 * this plan (Task 8) where the candidate is supposed to have fewer clients
 * than the reference — a deliberate drop, not a regression.
 *
 * --tokens is a DIFFERENT kind of check, and opt-in: the nine FEATURE_MARKERS
 * above were the features one planning pass happened to notice. A token-level
 * sweep of the reference found dozens more `bv-*`/`BV_*` identifiers a fresh
 * build does not produce. Most of that gap is explained by a frozen snapshot
 * of generated output sitting in the reference's #grid (~81 pre-rendered
 * .bv-card elements, the exact DOM beeviro.js's grid() builds at runtime) —
 * porting that snapshot as static markup would commit generated output as
 * source, so counting it as a regression would fail forever on CORRECT
 * output. --tokens therefore tests ABSENCE, not count: it fails only on a
 * token the reference has at least once and the candidate has exactly zero
 * of. A token the candidate merely has fewer of is not reported. Left off by
 * default so Tasks 2-7, written against the nine-marker signal, keep the
 * exact behaviour they were authored against.
 */
import { readFileSync } from 'node:fs';

/* ---- the tracked feature markers ---------------------------------------- */
/* Verbatim strings, not patterns — a marker is counted by substring search,
   so whatever a later task ports into site/ has to reproduce these bytes
   exactly for the count to pick it up. That is the point of freezing them
   here rather than inferring them from the reference each run. */
const FEATURE_MARKERS = [
  'bv-service-',
  'bv-testi',
  'BV_TESTIMONIALS',
  'BV_CARD_LOGOS',
  'bv-card--logo',
  'bv-filter-bar',
  'workStatus',
  'shalaby-labs',
  "font-family: 'Cairo'",
];

/* ---- argv ----------------------------------------------------------------*/

function usage(msg) {
  if (msg) console.error('embed-diff: ' + msg);
  console.error('usage: node tools/embed-diff.mjs <ref.html> <cand.html> [--expect-clients N] [--json] [--tokens]');
  process.exit(2);
}

const args = process.argv.slice(2);
let JSON_MODE = false;
let TOKENS_MODE = false;
let EXPECT_CLIENTS = null;
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') { JSON_MODE = true; continue; }
  if (a === '--tokens') { TOKENS_MODE = true; continue; }
  if (a === '--expect-clients') {
    const v = args[++i];
    EXPECT_CLIENTS = Number(v);
    if (!Number.isInteger(EXPECT_CLIENTS)) usage('--expect-clients wants an integer, got ' + JSON.stringify(v));
    continue;
  }
  if (a.startsWith('--')) usage('unknown flag ' + a);
  positional.push(a);
}
if (positional.length !== 2) usage('expected <ref.html> <cand.html>, got ' + positional.length + ' path(s)');
const [REF_PATH, CAND_PATH] = positional;

function readOrDie(p) {
  try { return readFileSync(p, 'utf8'); }
  catch (e) { usage('cannot read ' + p + ' (' + e.code + ')'); }
}
const refText = readOrDie(REF_PATH);
const candText = readOrDie(CAND_PATH);

/* ---- counting helpers ---------------------------------------------------
 * text.indexOf() chains, not brace-matching. Several of the i18n strings
 * quote a placeholder like '{n}' — counting braces to find where an object
 * literal ends is wrong on this file, since some of those braces are inside
 * string values, not part of the structure. A literal search for the '};'
 * this codebase always closes a top-level object with does not have that
 * problem, and every dimension below builds on it.
 */

const countOccurrences = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);

function countMediaEntries(text) {
  const openNeedle = 'BV_MEDIA = {';
  const open = text.indexOf(openNeedle);
  if (open < 0) return 0;
  const bodyStart = open + openNeedle.length;
  const close = text.indexOf('};', bodyStart);
  if (close < 0) return 0;
  const body = text.slice(bodyStart, close);
  const pairRe = /'(?:[^'\\]|\\.)*':\s*'(?:[^'\\]|\\.)*'/g;
  return (body.match(pairRe) || []).length;
}

function extractClientSlugs(text) {
  /* Scoped to the window.BV_CLIENTS array body, the same way countMediaEntries
   * above is scoped to BV_MEDIA's — an unscoped scan of the whole file also
   * matches hive.js's unrelated `slug: 'beeviro'` (the hero comb's own
   * self-promo reel cell, not a client record; see hive.js's SELF object),
   * inflating every count by exactly one. That one-off collision is invisible
   * until something actually asserts an exact number — which --expect-clients
   * is for — so it surfaced only once a task needed that assertion to be
   * trustworthy rather than illustrative. */
  const openNeedle = 'BV_CLIENTS = [';
  const open = text.indexOf(openNeedle);
  if (open < 0) return new Set();
  const bodyStart = open + openNeedle.length;
  const close = text.indexOf('];', bodyStart);
  const body = close < 0 ? text.slice(bodyStart) : text.slice(bodyStart, close);
  const re = /slug:\s*'([a-z0-9-]+)'/g;
  const slugs = new Set();
  let m;
  while ((m = re.exec(body))) slugs.add(m[1]);
  return slugs;
}

function extractModules(text) {
  const re = /\/\*\s*====\s*(js\/\S+)\s+=+\s*\*\//g;
  const modules = [];
  let m;
  while ((m = re.exec(text))) modules.push(m[1]);
  return modules;
}

function countDictKeys(body) {
  const keyRe = /'(?:[^'\\]|\\.)*':/g;
  return (body.match(keyRe) || []).length;
}

/* var STR = { en: { ...keys... }, ar: { ...keys... } }; — i18n.js's whole
   dictionary. Scoped to start from 'var STR = {' so an unrelated 'en: {' or
   'ar: {' elsewhere in the file could not be mistaken for it (neither is,
   today, but the scoping costs nothing). */
function countI18nKeys(text) {
  const strStart = text.indexOf('var STR = {');
  if (strStart < 0) return { en: 0, ar: 0 };
  const enNeedle = 'en: {';
  const enStart = text.indexOf(enNeedle, strStart);
  if (enStart < 0) return { en: 0, ar: 0 };
  const enBodyStart = enStart + enNeedle.length;
  const arNeedle = 'ar: {';
  const arStart = text.indexOf(arNeedle, enBodyStart);
  if (arStart < 0) return { en: countDictKeys(text.slice(enBodyStart)), ar: 0 };
  const enBody = text.slice(enBodyStart, arStart);
  const arBodyStart = arStart + arNeedle.length;
  const closeRe = /\r?\n {2}\};/;
  const closeMatch = closeRe.exec(text.slice(arBodyStart));
  const arBody = closeMatch ? text.slice(arBodyStart, arBodyStart + closeMatch.index) : text.slice(arBodyStart);
  return { en: countDictKeys(enBody), ar: countDictKeys(arBody) };
}

/* `bv-foo-bar`, `bv-foo__bar`, `bv-foo--bar`, or a `BV_SHOUTING_CASE` global —
   every hook this codebase uses to wire CSS, JS and markup together. Counted
   with a plain global match, same spirit as countOccurrences above: this is a
   token sweep, not a parser, and a literal \b-bounded match is enough to tell
   "zero" from "at least one" without caring where each hit sits. */
const TOKEN_RE = /\b(?:bv-[a-z0-9_-]{2,}|BV_[A-Z0-9_]+)\b/g;

function countTokens(text) {
  const counts = new Map();
  const matches = text.match(TOKEN_RE) || [];
  for (const tok of matches) counts.set(tok, (counts.get(tok) || 0) + 1);
  return counts;
}

/* Absence, not count — see the --tokens note in the file header for why. */
function buildTokenReport(refText, candText) {
  const refCounts = countTokens(refText);
  const candCounts = countTokens(candText);
  const absent = [];
  for (const [name, ref] of refCounts) {
    const cand = candCounts.get(name) || 0;
    if (cand === 0) absent.push({ name, ref });
  }
  absent.sort((a, b) => b.ref - a.ref || a.name.localeCompare(b.name));
  return { totalRefTokens: refCounts.size, absent, regressed: absent.length > 0 };
}

/* Every module in `small` has to show up in `big`, in the same relative
   order. Extra modules inserted between are fine; one missing, or two
   swapped, is not. */
function isSubsequence(small, big) {
  let i = 0;
  for (const item of big) {
    if (i < small.length && item === small[i]) i++;
  }
  return i === small.length;
}

/* ---- build the report ---------------------------------------------------*/

function buildReport() {
  const featureMarkers = FEATURE_MARKERS.map((name) => {
    const ref = countOccurrences(refText, name);
    const cand = countOccurrences(candText, name);
    return { name, ref, cand, regressed: cand < ref };
  });

  const mediaRef = countMediaEntries(refText);
  const mediaCand = countMediaEntries(candText);
  const mediaEntries = { ref: mediaRef, cand: mediaCand, regressed: mediaCand < mediaRef };

  const refSlugs = extractClientSlugs(refText);
  const candSlugs = extractClientSlugs(candText);
  const notInCandidate = [...refSlugs].filter((s) => !candSlugs.has(s));
  const clientSlugs = EXPECT_CLIENTS === null
    ? {
      mode: 'compare',
      ref: refSlugs.size,
      cand: candSlugs.size,
      notInCandidate,
      regressed: candSlugs.size < refSlugs.size,
    }
    : {
      mode: 'expect',
      ref: refSlugs.size,
      cand: candSlugs.size,
      expected: EXPECT_CLIENTS,
      notInCandidate,
      regressed: candSlugs.size !== EXPECT_CLIENTS,
    };

  const refModules = extractModules(refText);
  const candModules = extractModules(candText);
  const missingModules = refModules.filter((m) => !candModules.includes(m));
  const modules = {
    ref: refModules,
    cand: candModules,
    missing: missingModules,
    regressed: missingModules.length > 0 || !isSubsequence(refModules, candModules),
  };

  const refI18n = countI18nKeys(refText);
  const candI18n = countI18nKeys(candText);
  const i18n = {
    en: { ref: refI18n.en, cand: candI18n.en, regressed: candI18n.en < refI18n.en },
    ar: { ref: refI18n.ar, cand: candI18n.ar, regressed: candI18n.ar < refI18n.ar },
  };

  const tokens = TOKENS_MODE ? buildTokenReport(refText, candText) : null;

  return { featureMarkers, mediaEntries, clientSlugs, modules, i18n, tokens };
}

function regressedNames(report) {
  const names = report.featureMarkers.filter((m) => m.regressed).map((m) => m.name);
  if (report.mediaEntries.regressed) names.push('media-entries');
  if (report.clientSlugs.regressed) names.push('client-slugs');
  if (report.modules.regressed) names.push('modules');
  if (report.i18n.en.regressed) names.push('i18n:en');
  if (report.i18n.ar.regressed) names.push('i18n:ar');
  if (report.tokens && report.tokens.regressed) names.push('tokens');
  return names;
}

/* ---- report ---------------------------------------------------------- */

const report = buildReport();
const regressed = regressedNames(report);
const pass = regressed.length === 0;

if (JSON_MODE) {
  console.log(JSON.stringify({ pass, regressed, report }, null, 2));
} else {
  const row = (label, ok, detail) =>
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + ' '.repeat(Math.max(1, 29 - label.length)) + detail);

  console.log('embed-diff: ' + REF_PATH + ' -> ' + CAND_PATH);

  console.log('\nfeature markers');
  for (const m of report.featureMarkers) {
    row(m.name, !m.regressed, 'ref=' + m.ref + '  cand=' + m.cand);
  }

  console.log('\nmedia entries (BV_MEDIA)');
  row('media entries', !report.mediaEntries.regressed,
    'ref=' + report.mediaEntries.ref + '  cand=' + report.mediaEntries.cand);

  console.log('\nclient slugs');
  if (report.clientSlugs.mode === 'expect') {
    row('client slugs (--expect-clients)', !report.clientSlugs.regressed,
      'expected=' + report.clientSlugs.expected + '  cand=' + report.clientSlugs.cand +
      '  (ref was ' + report.clientSlugs.ref + ')');
  } else {
    row('client slugs', !report.clientSlugs.regressed,
      'ref=' + report.clientSlugs.ref + '  cand=' + report.clientSlugs.cand);
  }
  if (report.clientSlugs.notInCandidate.length) {
    console.log('        in reference but not candidate: ' + report.clientSlugs.notInCandidate.join(', '));
  }

  console.log('\ninlined modules');
  row('modules', !report.modules.regressed,
    'ref=' + report.modules.ref.length + '  cand=' + report.modules.cand.length);
  if (report.modules.missing.length) {
    console.log('        missing from candidate: ' + report.modules.missing.join(', '));
  }

  console.log('\ni18n keys');
  row('i18n:en', !report.i18n.en.regressed,
    'ref=' + report.i18n.en.ref + '  cand=' + report.i18n.en.cand);
  row('i18n:ar', !report.i18n.ar.regressed,
    'ref=' + report.i18n.ar.ref + '  cand=' + report.i18n.ar.cand);

  if (report.tokens) {
    console.log('\ntokens (bv-*/BV_*, absence only)');
    row('tokens', !report.tokens.regressed,
      'ref has ' + report.tokens.totalRefTokens + ' distinct token(s)  absent-from-candidate=' + report.tokens.absent.length);
    if (report.tokens.absent.length) {
      for (const t of report.tokens.absent) console.log('        0 in candidate: ' + t.name + ' (ref=' + t.ref + ')');
    }
  }

  console.log();
  if (pass) {
    console.log('PASS  nothing regressed');
  } else {
    console.log('FAIL  ' + regressed.length + ' regressed marker' + (regressed.length === 1 ? '' : 's') + ':');
    for (const name of regressed) console.log('  - ' + name);
  }
}

process.exit(pass ? 0 : 1);
