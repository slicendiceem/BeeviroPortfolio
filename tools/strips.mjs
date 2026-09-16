/* The four running strips: two marquee bands and two picture carousels.
 *
 * They are driven by hand from motion.js rather than by a CSS animation, so
 * "is it moving" and "is it moving smoothly" and "is it covered" are three
 * different questions and any of them can fail on its own.
 *
 *   node tools/strips.mjs [--lang ar] [--lite]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const LANG = arg('lang', 'en');
const LITE = args.includes('--lite');
const BASE = arg('url', 'http://localhost:4173/');
const W = Number(arg('w', 1440));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9560 + (process.pid % 120);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-strips'),
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
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const k = waiting.get(m.id);
  if (k) { waiting.delete(m.id); k(m.result); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
const ev = async (x) => (await send('Runtime.evaluate',
  { expression: x, awaitPromise: true, returnByValue: true })).result.value;

/* Sampled inside the page on rAF, because sampling over CDP measures the round
   trip, not the animation. Reports for each strip:
     moved     total px travelled over the window
     jitter    stddev of per-frame movement, as a share of the mean. A JS-driven
               strip should be near-constant; a big number is visible stutter.
     stalls    frames where it did not move at all
     gap       the widest run of viewport with no tile over it — a seam
     covered   tiles overlapping the strip's own box */
const SAMPLE = `(async (ms, only) => {
  const strips = (only ? [only] : ['#mq1', '#reelA', '#reelB', '#mq2']).map((sel) => {
    const el = document.querySelector(sel);
    return el && { sel, el, track: el.querySelector('.bv-marquee__track, .bv-reel__track') };
  }).filter((s) => s && s.track);

  const xOf = (t) => {
    const m = /matrix\\(([^)]+)\\)/.exec(getComputedStyle(t).transform);
    return m ? parseFloat(m[1].split(',')[4]) : 0;
  };
  const series = strips.map(() => []);
  const times = [];
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = (now) => {
      times.push(now);
      strips.forEach((s, i) => series[i].push(xOf(s.track)));
      if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });

  return JSON.stringify(strips.map((s, i) => {
    const xs = series[i];
    const d = [];
    /* VELOCITY, not movement per frame. The driver advances by elapsed time, so
       it holds a constant px/second by construction — what varies frame to
       frame is how long the frame took, which is the renderer's business, not
       the strip's. Measuring px/frame therefore reports a headless browser at
       20fps on a 2560px viewport as stutter while the strip is perfectly even.
       px/ms isolates the one from the other. */
    const v = [];
    for (let k = 1; k < xs.length; k++) {
      const dt = times[k] - times[k - 1];
      d.push(Math.abs(xs[k] - xs[k - 1]));
      if (dt > 0) v.push(Math.abs(xs[k] - xs[k - 1]) / dt);
    }
    const mean = d.reduce((a, b) => a + b, 0) / (d.length || 1);
    const vMean = v.reduce((a, b) => a + b, 0) / (v.length || 1);
    const vSd = Math.sqrt(v.reduce((a, b) => a + (b - vMean) ** 2, 0) / (v.length || 1));
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (d.length || 1));
    const stalls = d.filter((v2) => v2 < 0.01).length;

    /* Seams: walk the strip's box and find the widest span nothing covers.
       EVERY child counts, dots and separators included — measuring only the
       tiles reports the designed 40px gap between a marquee word and its dot as
       a 94px hole, which is how this first reported four seams that were not
       there. What is left after that is compared against the track's own CSS
       gap, so a real seam is a gap wider than the one that was authored. */
    const box = s.el.getBoundingClientRect();
    const designed = parseFloat(getComputedStyle(s.track).columnGap ||
      getComputedStyle(s.track).gap) || 0;
    const kids = [...s.track.parentElement.querySelectorAll('*')]
      .filter((n) => !n.children.length || n.classList.contains('bv-tile'))
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.right > box.left && r.left < box.right)
      .sort((a, b) => a.left - b.left);
    let gap = 0, cursor = box.left;
    kids.forEach((r) => { if (r.left > cursor) gap = Math.max(gap, r.left - cursor);
      cursor = Math.max(cursor, r.right); });
    gap = Math.max(gap, box.right - cursor);
    gap = Math.max(0, gap - designed);

    return {
      sel: s.sel,
      moved: +(xs[xs.length - 1] - xs[0]).toFixed(1),
      travel: +d.reduce((a, b) => a + b, 0).toFixed(1),
      perFrame: +mean.toFixed(2),
      jitter: mean ? +(sd / mean).toFixed(2) : 0,
      /* Absolute, in pixels, because RELATIVE jitter is meaningless on a slow
         strip: mq2 travels under 1px a frame, so ordinary frame-time variance
         is a huge fraction of a tiny number and it reports as stutter while
         looking perfectly smooth. What a reader actually sees is how many
         pixels a frame deviates, not by what percentage. */
      jitterPx: +sd.toFixed(2),
      pxPerSec: +(vMean * 1000).toFixed(0),
      speedWobble: vMean ? +(vSd / vMean).toFixed(2) : 0,
      stalls: stalls,
      frames: d.length,
      gap: Math.max(0, Math.round(gap)),
      tiles: kids.length,
      w: Math.round(box.width),
    };
  }));
})`;

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: "try{localStorage.setItem('bv:motion','" + (LITE ? 'lite' : 'full') + "')}catch(e){}",
});
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(4000);

/* Each strip is measured while it is ON SCREEN. An off-screen strip is supposed
   to hold still — the driver stops writing transforms for anything the reader
   cannot see — so measuring all four from one scroll position reports whichever
   ones are parked as broken. */
const rows = [];
for (const sel of ['#mq1', '#reelA', '#reelB', '#mq2']) {
  await ev(`document.querySelector('${sel}').scrollIntoView({block:'center',behavior:'instant'})`);
  // The strips deliberately speed up with scroll velocity, and that velocity
  // decays over roughly a second. Sampling before it has is measuring the
  // decay, not the strip: it reports jitter that a reader never sees.
  await sleep(2200);
  rows.push(JSON.parse(await ev(`(${SAMPLE})(2200, '${sel}')`))[0]);
}

/* THE SEAM IS ONLY VISIBLE AT THE JOIN. Letting the strips run and hoping the
   wrap point drifts through the viewport is how a 14px hole in both carousels
   went unnoticed until somebody said the picture loop "isn't working as well as
   the band" — one run reported it, the next did not. So park each strip ON its
   wrap point and look there. */
const seams = JSON.parse(await ev(`(async () => {
  const out = [];
  for (const sel of ['#mq1', '#reelA', '#reelB', '#mq2']) {
    const el = document.querySelector(sel);
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const s = el.__bvStrip;
    /* NOT a free pass. This used to report gap -1, which sailed straight through
       a "gap <= 2" assertion — so when a typo collapsed the $$ helper to $ and
       the JS strip driver stopped registering anything at all, every strip
       silently fell back to the CSS animation and this file still reported
       12/12. An unavailable path has to FAIL, not pass.

       But on the lite tier and under reduced motion the driver is SUPPOSED to be
       absent: a CSS animation runs the strips instead. There the seam cannot be
       found by parking the strip, so check the invariant that guarantees the CSS
       loop has no seam — the copies must span the frame plus one whole loop,
       because the animation translates each track by exactly its own width.
       (No backticks in here: this block is inside a template literal.) */
    if (!s || !s.w) {
      const expected = !window.BV_MOTION || window.BV_MOTION.rich === false;
      if (!expected) {
        out.push({ sel, gap: 9999, note: 'the JS strip driver never registered this strip' });
        continue;
      }
      const tks = el.querySelectorAll('.bv-marquee__track, .bv-reel__track');
      const tw = tks[0] ? tks[0].scrollWidth : 0;
      const span = tks.length * tw;
      const need = el.clientWidth + tw;
      out.push({
        sel,
        gap: span >= need ? 0 : Math.round(need - span),
        note: 'css-driven: ' + tks.length + ' copies of ' + Math.round(tw) +
          'px span ' + Math.round(span) + 'px, needs ' + Math.round(need) + 'px',
      });
      continue;
    }
    const track = el.querySelector('.bv-marquee__track, .bv-reel__track');
    const designed = parseFloat(getComputedStyle(track).columnGap ||
      getComputedStyle(track).gap) || 0;
    let worst = 0, at = 0;
    // sweep the last stretch before the wrap, where the join crosses the frame
    for (let frac = 0.80; frac <= 1.0001; frac += 0.01) {
      s.hold = true;
      s.off = s.w * frac;
      const x = (document.documentElement.dir === 'rtl' ? 1 : -1) * s.off;
      s.tracks.forEach((t) => { t.style.transform = 'translateX(' + x.toFixed(2) + 'px)'; });
      await new Promise((r) => requestAnimationFrame(r));
      const box = el.getBoundingClientRect();
      const kids = [...el.querySelectorAll('*')]
        .filter((n) => !n.children.length || n.classList.contains('bv-tile'))
        .map((n) => n.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.right > box.left && r.left < box.right)
        .sort((a, b) => a.left - b.left);
      let gap = 0, cursor = box.left;
      kids.forEach((r) => { if (r.left > cursor) gap = Math.max(gap, r.left - cursor);
        cursor = Math.max(cursor, r.right); });
      gap = Math.max(0, Math.max(gap, box.right - cursor) - designed);
      if (gap > worst) { worst = gap; at = frac; }
    }
    s.hold = false;
    out.push({ sel, gap: Math.max(0, Math.round(worst)), at: +at.toFixed(2) });
  }
  return JSON.stringify(out);
})()`));

console.log('  at the wrap point:');
seams.forEach((s) => console.log('  ' + s.sel.padEnd(8) +
  (s.note ? s.note : s.gap + 'px hole' + (s.gap ? '  (at ' + s.at + ' of the loop)' : ''))));
console.log('');
console.log('\n' + (LITE ? 'LITE' : 'FULL') + ' · ' + LANG + '\n');
console.log('  strip    width  tiles   travel  px/frame  px/s  wobble  stalls  gap');
rows.forEach((r) => {
  console.log('  ' + r.sel.padEnd(8) + String(r.w).padStart(5) + String(r.tiles).padStart(7) +
    String(r.travel).padStart(9) + String(r.perFrame).padStart(10) +
    String(r.pxPerSec).padStart(6)+String(r.speedWobble).padStart(8) + String(r.stalls).padStart(8) + String(r.gap).padStart(5));
});
console.log('');

const band = rows.filter((r) => /mq/.test(r.sel));
const reel = rows.filter((r) => /reel/.test(r.sel));
reel.forEach((r) => check(r.sel + ' is moving', r.travel > 20, r.travel + 'px in 2.5s'));
band.forEach((r) => check(r.sel + ' is moving', r.travel > 20, r.travel + 'px in 2.5s'));
seams.forEach((s) => check(s.sel + ' loops with no seam', s.gap <= 2,
  s.note || (s.gap + 'px hole at the join')));
rows.forEach((r) => check(r.sel + ' holds a steady speed',
  r.speedWobble < 0.35 && r.stalls < r.frames * 0.2,
  r.pxPerSec + 'px/s, wobble ' + r.speedWobble + ', ' + r.stalls + '/' + r.frames + ' stalled'));

/* THE SAME STRIP MUST RUN AT THE SAME PACE ON EVERY TIER.
   REPORTED: "some carousels break, stop, or slow down to the point of appearing
   frozen." The creative reels ran at HALF speed on the lite tier and nothing
   here noticed, because every assertion above measures one tier at a time and
   asks only "is it moving" — 32 px/s is moving.

   The cause: --dur was authored as a fixed 168s for a 44-tile track, and the
   lite tier builds 22 tiles. Speed is width/duration, so half the width in the
   same time is half the speed. The pace is per-tile now, but the invariant is
   what belongs in a test: this is computed from layout and the authored
   duration, so it is deterministic — no sampling, no load sensitivity — and the
   SAME band is asserted whether the run is lite or full. Halve a tier's tiles
   again and it fails on that tier alone. */
const pace = JSON.parse(await ev(`JSON.stringify(['#mq1','#reelA','#reelB','#mq2'].map(function (s) {
  var el = document.querySelector(s);
  var t = el && el.querySelector('.bv-marquee__track, .bv-reel__track');
  var dur = el ? parseFloat(getComputedStyle(el).getPropertyValue('--dur')) : 0;
  return { sel: s, px: (t && dur) ? Math.round(t.offsetWidth / dur) : 0 };
}))`));
console.log('  authored pace (width / --dur), identical on every tier:');
pace.forEach((p) => console.log('  ' + p.sel.padEnd(8) + p.px + ' px/s'));
pace.forEach((p) => check(p.sel + ' runs at a readable pace on this tier',
  p.px >= 30 && p.px <= 90, p.px + ' px/s'));

const failed = results.filter((x) => !x).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
