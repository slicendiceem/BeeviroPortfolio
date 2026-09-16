/* Is every light copy actually wired in, everywhere it should be?
 *
 * There are four independent things that all have to line up, and a break in
 * any one of them is silent — the page falls back to the full-size original and
 * looks completely normal while costing four times as much:
 *
 *   1. the file exists on disk
 *   2. thumb-map.js points at it
 *   3. media-map.js has a GHL id for it, so the hosted build can use it too
 *   4. the code that renders that surface actually calls thumb()/cell()
 *
 * (4) is the one a map dump cannot tell you, so it is checked by reading the
 * source for the specific call sites rather than by trusting them.
 *
 *   node tools/audit-light.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');

global.window = {};
await import('file://' + path.join(SITE, 'js/media-map.js').replace(/\\/g, '/'));
await import('file://' + path.join(SITE, 'js/thumb-map.js').replace(/\\/g, '/'));
const { BV_MEDIA: MEDIA, BV_MEDIA_BASE: BASE, BV_THUMBS: THUMBS, BV_CELLS: CELLS } = global.window;

let bad = 0;
const ok = (pass, label, detail) => {
  if (!pass) bad++;
  console.log((pass ? '  ok    ' : '  FAIL  ') + label + (detail ? '   ' + detail : ''));
};

console.log('\n1. the light files exist on disk');
const missingFiles = [];
for (const t of [THUMBS, CELLS]) {
  for (const heavy in t) {
    if (!existsSync(path.join(SITE, t[heavy]))) missingFiles.push(t[heavy]);
  }
}
ok(!missingFiles.length, 'every mapped light path is a real file',
  missingFiles.length ? missingFiles.slice(0, 3).join(', ') : '');

console.log('\n2. every light copy has a GHL id, so the hosted build gets it too');
const unmapped = [];
for (const t of [THUMBS, CELLS]) {
  for (const heavy in t) if (!MEDIA[t[heavy]]) unmapped.push(t[heavy]);
}
ok(!unmapped.length, 'every light path resolves to the CDN',
  unmapped.length ? unmapped.length + ' unmapped, e.g. ' + unmapped[0] : '');

console.log('\n3. the tiers cover what they are supposed to cover');
const counts = { thumb: 0, cell: 0, light: 0, reel: 0 };
for (const heavy in THUMBS) {
  const v = THUMBS[heavy];
  if (/\/thumb\//.test(v)) counts.thumb++;
  else if (/assets\/light\//.test(v)) counts.light++;
  else if (/reels\/small/.test(v)) counts.reel++;
}
counts.cell = Object.keys(CELLS).length;
/* Counted off disk, not typed in here. The reel count below was derived for
   exactly this reason and these two kept their magic number — the day a client
   gains a gallery image they fail for the one reason that is not a fault. */
const workDir = path.join(SITE, 'assets/work');
let onDisk = 0;
for (const slug of readdirSync(workDir)) {
  const t = path.join(workDir, slug, 'thumb');
  if (existsSync(t)) onDisk += readdirSync(t).filter((f) => /\.webp$/i.test(f)).length;
}
ok(counts.thumb === onDisk, onDisk + ' card thumbnails', String(counts.thumb));
ok(counts.cell === onDisk, onDisk + ' comb cells', String(counts.cell));
/* Counted against what is on disk, not against a number typed in here. This
   said `=== 6` back when six reels existed only for the hero comb; the day nine
   client films were added it failed for the one reason that is not a fault. The
   invariant is that EVERY reel has a small copy — not that there are six. */
/* Deliberately NOT "every reel has a small copy" any more. The folder holds two
   kinds of file: the reels the hero comb plays in 120px hexagons, which need a
   288px copy, and the dossier films, which are shown at 420px in a 420px block
   through media() and would only be dead weight. The precise invariant — the
   small-copy set is EXACTLY the comb list — is asserted in section 7, where the
   comb list is read out of hive.js. Here, just report the split. */
const reelFiles = readdirSync(path.join(SITE, 'assets/hero/reels'))
  .filter((f) => /\.webm$/i.test(f));
console.log('  --    ' + reelFiles.length + ' reels on disk, ' + counts.reel +
  ' with a 288px comb copy (the rest are dossier films, shown full size)');
ok(counts.light >= 9, 'brand marks + hero photographs', String(counts.light));

console.log('\n4. resolution, in both contexts');
// The exact logic from beeviro.js, kept here so a change there shows up as a
// failure here rather than as a quietly heavier page.
const media = (p) => { const id = MEDIA[p]; return id ? (/^https?:/.test(id) ? id : BASE + id) : p; };
const light = (table, p, EMBED) => {
  const t = table[p];
  if (!t) return media(p);
  if (MEDIA[t]) return media(t);
  return EMBED ? media(p) : t;
};
const SURFACES = [
  ['work card',        'assets/work/izar/01.jpg',            THUMBS],
  ['carousel tile',    'assets/work/speakup/04.jpg',         THUMBS],
  ['comb cell',        'assets/work/izar/01.jpg',            CELLS],
  ['hero photo wide',  'assets/hero/comb-wide.jpg',          THUMBS],
  ['hero photo tall',  'assets/hero/comb-tall.jpg',          THUMBS],
  ['brand icon',       'assets/logos/beeviro-icon.png',      THUMBS],
  ['brand wordmark',   'assets/logos/beeviro.png',           THUMBS],
  ['client logo',      'assets/logos/rojana.png',            THUMBS],
  ['hero reel',        'assets/hero/reels/freestyle.webm',   THUMBS],
];
for (const [label, p, table] of SURFACES) {
  const hosted = light(table, p, true);
  const local = light(table, p, false);
  const isLight = hosted !== media(p);
  ok(isLight && /^https:\/\/assets\.cdn/.test(hosted), label,
    isLight ? '' : 'still resolving to the FULL-SIZE original');
  if (local !== hosted) ok(false, label + ' (local)', 'differs from hosted: ' + local);
}

console.log('\n5. full-size stays full-size where the work is actually looked at');
const full = ['assets/work/izar/01.jpg'];
ok(media(full[0]) !== light(THUMBS, full[0], true),
  'the lightbox / dossier shelf path is a different url from the card path');

console.log('\n6. the render code calls the light resolvers');
const bee = readFileSync(path.join(SITE, 'js/beeviro.js'), 'utf8');
const hive = readFileSync(path.join(SITE, 'js/hive.js'), 'utf8');
const html = readFileSync(path.join(SITE, 'index.html'), 'utf8');
ok(/shotSmall\s*=\s*function[^]*?thumb\(/.test(bee), 'cards + tiles go through thumb()');
ok(/var small = window\.BV_CELL/.test(hive), 'the comb goes through BV_CELL (200px)');
ok(/var reel = window\.BV_THUMB/.test(hive), 'the comb reels go through BV_THUMB');
ok(/root\.setProperty\('--hero-wide', 'url\("' \+ abs\(thumb\(/.test(bee),
  'the hero photograph goes through thumb(), absolutised');
ok(/now = thumb\(was\)/.test(bee), 'static <img> tags go through thumb()');
ok(/thumb\('assets\/logos\/' \+ c\.logo\)/.test(bee), 'client logo plates go through thumb()');
ok(/assets\/light\/beeviro-icon\.webp/.test(html),
  'the markup points at the light brand mark directly (no double fetch)');
ok(!/background-image: var\(--hero-wide, url/.test(readFileSync(path.join(SITE, 'css/beeviro.css'), 'utf8')),
  'the CSS has no url() fallback that would double-fetch the hero photo');

/* ── 7. the dossier films ───────────────────────────────────────────────────
   THESE LIVE OUTSIDE THUMBS/CELLS ENTIRELY. Everything above walks the two
   thumbnail maps, which was the whole story when thumbnails were the only
   derived asset. A film's `src` and its optional `poster` are shipped display
   assets referenced from clients.js DATA, not from markup — so build-embed's
   attribute rewriting never sees them either. Nothing checked them, which meant
   that once the reels were uploaded this file would have gone all-green while
   the one dossier that has no gallery to fall back on still showed a broken
   poster. Drive this section from the client records, not from the maps. */
console.log('\n7. dossier films resolve for the hosted build');
await import('file://' + path.join(SITE, 'js/clients.js').replace(/\\/g, '/'));
const CLIENTS = global.window.BV_CLIENTS || [];
const filmed = CLIENTS.filter((c) => c.film && c.film.src);
const filmMissing = [];
const filmUnmapped = [];
for (const c of filmed) {
  for (const p of [c.film.src, c.film.poster].filter(Boolean)) {
    if (!existsSync(path.join(SITE, p))) filmMissing.push(c.slug + ' -> ' + p);
    // A light path is allowed to resolve through the copy it was made from;
    // a film src and a film poster have no heavier original to fall back to.
    if (!MEDIA[p]) filmUnmapped.push(c.slug + ' -> ' + p);
  }
}
ok(!filmMissing.length, filmed.length + ' films, every src and poster on disk',
  filmMissing.slice(0, 3).join(', '));
ok(!filmUnmapped.length, 'every film src and poster resolves to the CDN',
  filmUnmapped.length ? filmUnmapped.length + ' unmapped, e.g. ' + filmUnmapped[0] : '');
/* A client with work: 0 has no gallery image to borrow, so it MUST carry its
   own poster or the markup falls back to src="". */
const posterless = filmed.filter((c) => !c.work && !c.film.poster).map((c) => c.slug);
ok(!posterless.length, 'every film with no gallery carries its own poster',
  posterless.join(', '));

/* The hero comb's reel list is hardcoded in hive.js. A slug in that list with no
   288px copy silently serves the full 420px file into a 120px hexagon — six of
   those is exactly the quietly-heavier page this file exists to prevent, and a
   count of reels would not notice. */
const combList = (/REELS\s*=\s*RICH\s*\?\s*\[([^\]]*)\]/.exec(hive) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
const combBad = combList.filter((s) => !THUMBS['assets/hero/reels/' + s + '.webm']);
/* And nothing else. A leftover copy for a reel the comb no longer plays is
   1.4 MB of files in the deployable root that no code path can request, plus an
   entry in the light map that makes section 2 demand it be uploaded to the CDN
   so that nothing will fetch it. That is exactly what nine dossier films did. */
const combExtra = Object.values(THUMBS)
  .filter((v) => /reels\/small\//.test(v))
  .map((v) => v.split('/').pop().replace(/\.webm$/i, ''))
  .filter((s) => !combList.includes(s));
ok(combList.length > 0, 'the hero comb reel list was found in hive.js',
  combList.length + ' slugs');
ok(!combBad.length, 'every hero comb reel has a 288px copy', combBad.join(', '));
ok(!combExtra.length, 'and nothing else does', combExtra.join(', '));

console.log('\n8. weight of what is shipped');
const sum = (pred) => {
  let n = 0, bytes = 0;
  for (const t of [THUMBS, CELLS]) {
    for (const heavy in t) {
      const v = t[heavy];
      if (!pred(v)) continue;
      const f = path.join(SITE, v);
      if (existsSync(f)) { n++; bytes += readFileSync(f).length; }
    }
  }
  return n + ' files, ' + (bytes / 1048576).toFixed(2) + ' MB';
};
console.log('  480px card tier   ' + sum((v) => /\/thumb\//.test(v)));
console.log('  200px comb tier   ' + sum((v) => /\/cell\//.test(v)));
console.log('  shrunken reels    ' + sum((v) => /reels\/small/.test(v)));
console.log('  brand + hero      ' + sum((v) => /assets\/light\//.test(v)));

console.log('\n' + (bad ? bad + ' FAILED' : 'all checks passed'));
process.exit(bad ? 1 : 0);
