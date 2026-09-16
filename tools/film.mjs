/* The film block in a dossier: it must cost nothing until it is asked for.
 *
 * Fifteen of the twenty-five case files describe video deliverables and could
 * only show still frames of them. Where the reel exists it now plays in the
 * dossier — but the whole point is that opening a case is no heavier than it
 * was, so the assertions here are mostly about what does NOT happen.
 *
 *   node tools/film.mjs [--lang ar]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const LANG = arg('lang', 'en');
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9640 + (process.pid % 120);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-film'),
  'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let u;
for (let i = 0; i < 60; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = t.find((x) => x.type === 'page');
    if (p) { u = p.webSocketDebuggerUrl; break; }
  } catch { /* not up */ }
  await sleep(250);
}
const ws = new WebSocket(u);
let id = 0; const waiting = new Map();
const media = [];
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Network.responseReceived' && /\.webm/.test(m.params.response.url)) {
    media.push(m.params.response.url);
  } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    errors.push(m.params.entry.text);
  } else if (!m.method) {
    const k = waiting.get(m.id);
    if (k) { waiting.delete(m.id); k(m.result); }
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
const ev = async (x) => (await send('Runtime.evaluate',
  { expression: x, awaitPromise: true, returnByValue: true })).result.value;

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Log.enable'); await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(3500);

/* The hero comb fetches its own six reels, so count only what the DOSSIER adds
   from here on. */
const heroReels = media.length;

/* FOUND, not named. The skip assertion below already learned this lesson — it
   used to hard-code "izar" and broke the day Izar got a reel — but the primary
   fixture kept its hard-coded "freestyle" sixty lines above the comment
   explaining why that is wrong.

   The subject needs three things, and the third is easy to miss: a film, a
   gallery to take its poster from, and a reel whose comb copy is a DIFFERENT
   url from the original. Only reels the hero comb actually plays have a 288px
   copy, and for the rest thumb() and media() return the same string — so "it
   points at the full-size file, not the comb copy" is unfalsifiable on those
   clients and would pass or fail on a coin toss. Ask the resolvers. */
const subject = await ev(`(window.BV_CLIENTS.filter(function (c) {
  return c.film && c.work &&
    window.BV_THUMB(c.film.src) !== window.BV_ASSET(c.film.src);
})[0] || {}).slug || ""`);
if (!subject) {
  console.log('  FAIL  no client has a film, a gallery AND a distinct comb copy — ' +
    'the full-size-vs-comb-copy assertion has no subject it can actually test');
  ws.close(); chrome.kill(); process.exit(1);
}
console.log('  (subject: ' + subject + ')\n');
await ev('window.BV_OPEN_CASE(' + JSON.stringify(subject) + ')');
await sleep(1500);

const before = await ev(`(() => {
  const SUBJECT = ${JSON.stringify(subject)};
  const f = document.querySelector('.bv-film');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  return JSON.stringify({
    exists: true,
    src: f.getAttribute('data-src'),
    hasVideo: !!f.querySelector('video'),
    /* Once the light copies are in the media library every asset is an opaque
       CDN id, so "does the url contain /thumb/" proves nothing. Ask the site's
       own resolvers instead: the poster must be what thumb() returns, and must
       NOT be the full-size original that media() returns. */
    poster: (f.querySelector('.bv-film__poster') || {}).src || '',
    posterIsLight: (f.querySelector('.bv-film__poster') || {}).src ===
      window.BV_THUMB('assets/work/' + SUBJECT + '/01.jpg'),
    posterIsFullSize: (f.querySelector('.bv-film__poster') || {}).src ===
      window.BV_ASSET('assets/work/' + SUBJECT + '/01.jpg'),
    /* Same reasoning as the poster, applied to the reel itself. This used to be
       a substring test for "reels/small" in the url — which is exactly the
       thing the comment above says proves nothing once every asset is an opaque
       CDN id. Ask the resolvers. */
    srcIsFullSize: f.getAttribute('data-src') ===
      window.BV_ASSET('assets/hero/reels/' + SUBJECT + '.webm'),
    srcIsCombCopy: f.getAttribute('data-src') ===
      window.BV_THUMB('assets/hero/reels/' + SUBJECT + '.webm'),
    playLabel: (f.querySelector('.bv-film__play span') || {}).textContent,
    note: (document.querySelector('.bv-film__note') || {}).textContent || '',
    w: Math.round(r.width),
  });
})()`);
const b = before && JSON.parse(before);

check('the dossier has a film block', !!b);
if (b) {
  check('it points at the FULL-size reel, not the 288px comb copy',
    b.srcIsFullSize === true && b.srcIsCombCopy === false, b.src.slice(-46));
  check('no <video> exists before anybody presses play', b.hasVideo === false);
  check('the poster is the light copy, not the full-size original',
    b.posterIsLight === true && b.posterIsFullSize === false, b.poster.slice(-40));
  check('nothing extra was fetched just by opening the case',
    media.length === heroReels, media.length - heroReels + ' new .webm requests');
  check('the caption is translated', b.note.length > 10,
    b.note.slice(0, 44));

  // press play
  await ev("document.querySelector('.bv-film').click()");
  await sleep(4000);
  const after = JSON.parse(await ev(`(() => {
    const f = document.querySelector('.bv-film');
    const v = f.querySelector('video');
    return JSON.stringify({
      playing: !!v && !v.paused,
      blob: !!v && /^blob:/.test(v.src),
      controls: !!v && v.controls,
      ready: v ? v.readyState : -1,
      posterGone: getComputedStyle(f.querySelector('.bv-film__poster')).display === 'none',
    });
  })()`));
  check('pressing play fetches and plays it', after.playing === true,
    'readyState ' + after.ready);
  check('served as a blob, so download managers stay quiet', after.blob === true);
  check('it has real controls', after.controls === true);
  check('the poster steps out of the way', after.posterGone === true);
}

/* ── the work shelf's pace ────────────────────────────────────────────────────
   The shelf is the other moving thing in a case file and it was the slowest
   strip on the site. Its tiles are full-height — far larger than a carousel
   tile on the home page — and a big object crossing the frame at the same
   px/second reads as slower than a small one, so it needs MORE speed than the
   home reels to feel equally alive, not the same.

   Measured the way strips.mjs learned to: px per SECOND, not per frame (the
   driver advances by elapsed time, so per-frame variance is the renderer's),
   sampled on animation frames, and only while the shelf is on screen. */
/* The shelf is mounted AFTER the open transition now, on requestIdleCallback, so
   it is not in the DOM the instant a case opens. Waiting for it is not a
   workaround for a slow test — it is the behaviour under test: deferring the
   shelf must not mean the shelf never arrives. This passed alone and failed
   inside a full suite run, which is exactly the shape of a race.
   The bound is deliberately just over the mount's own 700ms idle timeout. */
const shelfArrived = await ev(`(async () => {
  for (let i = 0; i < 40; i++) {
    if (document.querySelector('.bv-gal')) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
})()`);
check('the deferred work shelf does arrive', shelfArrived === true,
  shelfArrived ? '' : 'no .bv-gal after 2s — the idle mount never ran');

const shelf = JSON.parse(await ev(`(async () => {
  // __bvStrip is registered on .bv-gal (the outer element BV_STRIPS.add receives),
  // not on the scrollport — probing the wrong one reports "not driven" for a
  // shelf that is being driven perfectly well.
  const view = document.querySelector('.bv-gal');
  if (!view) return JSON.stringify({ missing: true });
  view.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 900));
  const track = view.querySelector('.bv-gal__track');
  const xOf = () => {
    const m = /matrix\\(([^)]+)\\)/.exec(getComputedStyle(track).transform);
    return m ? parseFloat(m[1].split(',')[4]) : 0;
  };
  const t0 = performance.now();
  const x0 = xOf();
  for (let i = 0; i < 70; i++) {
    await new Promise((r) => requestAnimationFrame(r));
  }
  const dt = performance.now() - t0;
  const moved = Math.abs(xOf() - x0);
  const s = view.__bvStrip;
  return JSON.stringify({
    pxPerSec: Math.round((moved / dt) * 1000),
    dur: s ? s.dur : null,
    speed: s ? s.speed : 0,
    driven: !!s,
    onScreen: view.getBoundingClientRect().top < innerHeight,
  });
})()`));
check('the work shelf is driven by the strip engine', shelf.driven === true,
  'authored --dur ' + shelf.dur + 's');
/* TWO assertions, because the observed rate is load-sensitive and the authored
   one is not. The driver clamps its frame delta to 50ms so a stalled tab cannot
   teleport a strip — which means that under heavy load it advances LESS than
   real time, and a measured px/s dips below the authored figure through no
   fault of the setting. This failed at 113 px/s with two other suites running
   beside it.
   So the PACE is asserted against s.speed, which is w/dur, exactly what --dur
   configures; and the observed sample only has to show real movement. */
check('the work shelf is configured to run at a brisk pace',
  shelf.speed >= 120, Math.round(shelf.speed) + ' px/s authored');
check('and it is actually moving', shelf.pxPerSec > 30,
  shelf.pxPerSec + ' px/s observed');

/* A faster strip makes its brakes MORE important, not less: the reader has less
   time to catch a piece they wanted to look at. Assert the two ways of stopping
   it still work at the new pace — speeding something up by taking away the
   ability to stop it is not an improvement. */
const brakes = JSON.parse(await ev(`(async () => {
  const gal = document.querySelector('.bv-gal');
  const track = gal.querySelector('.bv-gal__track');
  const xOf = () => {
    const m = /matrix\\(([^)]+)\\)/.exec(getComputedStyle(track).transform);
    return m ? parseFloat(m[1].split(',')[4]) : 0;
  };
  const tile = gal.querySelector('.bv-gal__t');
  const r = tile.getBoundingClientRect();
  tile.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  tile.dispatchEvent(new PointerEvent('pointerover', { bubbles: true,
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  await new Promise((r2) => setTimeout(r2, 500));
  const a = xOf();
  for (let i = 0; i < 40; i++) await new Promise((r2) => requestAnimationFrame(r2));
  const held = Math.abs(xOf() - a);
  tile.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
  tile.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  await new Promise((r2) => setTimeout(r2, 400));
  const b = xOf();
  for (let i = 0; i < 40; i++) await new Promise((r2) => requestAnimationFrame(r2));
  const freed = Math.abs(xOf() - b);
  return JSON.stringify({ held: Math.round(held), freed: Math.round(freed) });
})()`));
check('hovering a piece still stops the shelf', brakes.held < 12,
  brakes.held + 'px drift while held');
check('and it runs again when the pointer leaves', brakes.freed > 30,
  brakes.freed + 'px after release');

/* A client with no film must be untouched. The film-less client is FOUND, not
   named: this used to hard-code "izar", and the day Izar got a reel of its own
   the assertion started failing for the one reason that is not a bug. A fixture
   that names a record by hand goes stale the moment the data moves. */
const noFilm = await ev(
  '(window.BV_CLIENTS.filter(function (c) { return !c.film; })[0] || {}).slug || ""');
if (!noFilm) {
  /* NOT a pass. `check(..., true)` here would report green for a check that did
     not run — the same silent-success shape this file was fixed for once
     already. If every client gains a film the assertion has no subject and the
     suite must say so out loud rather than quietly shrinking. */
  check('a client without a reel has no film block', false,
    'NO SUBJECT LEFT — every client has a film; delete this check or give it one');
} else {
  await ev('window.BV_OPEN_CASE(' + JSON.stringify(noFilm) + ')');
  await sleep(1200);
  check('a client without a reel has no film block',
    (await ev("!document.querySelector('.bv-film')")) === true, noFilm);
}

/* A client whose ENTIRE engagement was video has a film and no gallery, so the
   poster cannot be borrowed from the first work image the way every other one
   is. That fell back to src="", which the browser resolves against the page URL
   and then fetches and fails. Assert the whole shape: the block is there, the
   poster is a real decoded image, and nothing anywhere in the dossier carries
   an empty src. */
const noGallery = await ev(
  '(window.BV_CLIENTS.filter(function (c) { return c.film && !c.work; })[0] || {}).slug || ""');
if (!noGallery) {
  /* Three assertions live inside the branch below. Without this they would
     simply stop existing — the suite would go from 15/15 to 12/12 and still
     report that everything passed, and the three that vanished are precisely
     the ones covering the src="" bug. A missing fixture is a finding. */
  check('a film with no gallery still has a poster', false,
    'NO SUBJECT — no client has a film and work: 0; this case is now untested');
} else {
  await ev('window.BV_OPEN_CASE(' + JSON.stringify(noGallery) + ')');
  await sleep(1800);
  const g = JSON.parse(await ev(`(() => {
    const f = document.querySelector('.bv-film');
    const img = f && f.querySelector('.bv-film__poster');
    return JSON.stringify({
      block: !!f,
      loaded: !!(img && img.complete && img.naturalWidth > 0),
      empty: [...document.querySelectorAll('#case img')]
        .filter((i) => i.getAttribute('src') === '').length,
      gallery: !!document.querySelector('.bv-gal'),
    });
  })()`));
  check('a film with no gallery still has a poster', g.block && g.loaded, noGallery);
  check('no image in the dossier has an empty src', g.empty === 0,
    g.empty + ' empty src attributes');
  check('and it has no work shelf to show', g.gallery === false);
}

check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
