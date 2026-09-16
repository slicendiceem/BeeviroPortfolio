/* Where does the page drop frames, and why?
 *
 *   node tools/jank.mjs [--cpu 4] [--lang ar] [--lite] [--w 1440]
 *
 * Opening a case file is the heaviest thing this site does in one go: it builds
 * a whole dossier's markup, enrols a new strip with the driver, and starts
 * decoding up to thirty-two full-size images — while four other strips, a hero
 * canvas and a pinned section are all still running.
 *
 * Two decisions make this measurement worth trusting:
 *
 *  - CPU THROTTLING. On this machine everything is fast enough to hide the
 *    problem. `Emulation.setCPUThrottlingRate` is how you see what the reviewers
 *    saw on a mid-range phone, and it makes the jank reproducible instead of
 *    anecdotal. 4x is roughly a modern mid-range Android.
 *  - LONG TASKS WITH ATTRIBUTION, not just frame deltas. A dropped frame tells
 *    you there was a problem; a longtask entry tells you how long the main
 *    thread was blocked, and `performance.measure` marks around the phases tell
 *    you which part of the open did it. Guessing from a frame graph is how you
 *    end up optimising the wrong thing.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CPU = Number(arg('cpu', 4));
const LANG = arg('lang', 'en');
const LITE = args.includes('--lite');
const W = Number(arg('w', 1440));
const H = Number(arg('h', W < 500 ? 844 : 900));
const BASE = arg('url', 'http://localhost:4173/');
const SLUG = arg('case', '');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }
const PORT = 9860 + (process.pid % 120);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(ROOT, '.chrome-jank'), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = t.find((x) => x.type === 'page');
    if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch { /* not up */ }
  await sleep(250);
}
if (!wsUrl) { console.error('devtools never came up'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
let id = 0; const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const k = waiting.get(m.id);
  if (k) { waiting.delete(m.id); k(m); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
async function ev(expr) {
  const r = await send('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text + ' ' +
      ((r.result.exceptionDetails.exception || {}).description || '').slice(0, 200));
  }
  return r.result.result.value;
}

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: W < 500 });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: "try{localStorage.setItem('bv:motion','" + (LITE ? 'lite' : 'full') + "')}catch(e){}",
});
/* Installed before any of the site's own code so nothing is missed. A single
   PerformanceObserver is cheaper than polling and it reports the blocking
   duration, which is the number that matters — a 300ms task drops eighteen
   frames whatever the frame graph happens to sample. */
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__jank = { long: [], frames: [], on: false };
    try {
      new PerformanceObserver((l) => {
        if (!window.__jank.on) return;
        l.getEntries().forEach((e) => window.__jank.long.push({
          d: Math.round(e.duration), t: Math.round(e.startTime),
        }));
      }).observe({ entryTypes: ['longtask'] });
    } catch (e) { /* no longtask support */ }
    (function frame(prev) {
      requestAnimationFrame(function (now) {
        if (window.__jank.on && prev) window.__jank.frames.push(now - prev);
        frame(now);
      });
    })(0);
  `,
});
/* Diagnostic switches. These change the PAGE, not the tool's opinion of it —
   they exist so a hypothesis can be tested in one run instead of argued about:
     --no-blur    drop every backdrop-filter
     --no-shadow  drop the shell's 130px box-shadow
   If a number moves, that property was the cost. If it does not, it was not,
   and the next guess would have been wrong. */
const off = [];
if (args.includes('--no-blur')) off.push('*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}');
if (args.includes('--no-shadow')) off.push('.bv-case__shell{box-shadow:none!important}');
if (args.includes('--no-deal')) off.push('.bv-case__mast,.bv-case__sec{transition:none!important;opacity:1!important;transform:none!important}');
if (args.includes('--no-shell')) off.push('.bv-case__shell{transition:none!important;transform:none!important}');
if (args.includes('--blur-only')) off.push('.bv-case.is-settled .bv-case__veil{backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important}');
if (args.includes('--blur-small')) off.push('.bv-case.is-settled .bv-case__veil{backdrop-filter:blur(3px)!important;-webkit-backdrop-filter:blur(3px)!important}');
if (args.includes('--blur-during')) off.push('.bv-case__veil{backdrop-filter:blur(6px) saturate(.7)!important;-webkit-backdrop-filter:blur(6px) saturate(.7)!important;transition:opacity .34s,backdrop-filter .4s!important}');
if (off.length) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');
      s.textContent=${JSON.stringify(off.join(''))};document.head.appendChild(s);});`,
  });
}
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(4500);
await send('Emulation.setCPUThrottlingRate', { rate: CPU });
await sleep(1500);

console.log('\n' + (LITE ? 'LITE' : 'FULL') + ' · ' + LANG + ' · ' + W + 'px · CPU ' +
  CPU + 'x slower\n');

/* Pick the client with the most work — the shelf is the expensive part, so the
   worst case is the honest one to measure. */
const target = SLUG || await ev(`(() => {
  const c = window.BV_CLIENTS.slice().sort((a, b) => (b.work || 0) - (a.work || 0))[0];
  return c ? c.slug : '';
})()`);
const tiles = await ev(
  `(window.BV_CLIENTS.filter((c) => c.slug === ${JSON.stringify(target)})[0] || {}).work || 0`);

// settle, then record only the open
await ev('window.__jank.long = []; window.__jank.frames = []; window.__jank.on = true;');
await sleep(600);
const idle = JSON.parse(await ev(`JSON.stringify({
  frames: window.__jank.frames.length,
  worst: Math.round(Math.max.apply(null, window.__jank.frames.concat([0]))),
  long: window.__jank.long.length,
})`));

await ev('window.__jank.long = []; window.__jank.frames = [];');
/* A CPU profile across the open, so the answer is "this function, this many
   milliseconds" instead of a hypothesis. Long-task entries say how long the
   main thread was blocked; only a profile says by what. */
const PROFILE = args.includes('--profile');
if (PROFILE) { await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 200 }); await send('Profiler.start'); }
await ev(`performance.mark('bv-open-start'); window.BV_OPEN_CASE(${JSON.stringify(target)});`);
await sleep(3500);
if (PROFILE) {
  const prof = (await send('Profiler.stop')).result.profile;
  const byFn = new Map();
  const nodes = new Map();
  prof.nodes.forEach((n) => nodes.set(n.id, n));
  // samples + timeDeltas give self time per node; roll it up by function.
  const total = {};
  for (let i = 0; i < prof.samples.length; i++) {
    const n = nodes.get(prof.samples[i]);
    if (!n) continue;
    const f = n.callFrame;
    const key = (f.functionName || '(anonymous)') + '  ' +
      String(f.url || '').split('/').pop() + ':' + (f.lineNumber + 1);
    total[key] = (total[key] || 0) + (prof.timeDeltas[i] || 0) / 1000;
  }
  const top = Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 14);
  console.log('  CPU profile — self time during the open:');
  top.forEach(([k, ms]) => console.log('    ' + ms.toFixed(0).padStart(6) + ' ms  ' + k));
  console.log('');
  void byFn;
}

const open = JSON.parse(await ev(`(() => {
  const f = window.__jank.frames;
  const long = window.__jank.long.slice().sort((a, b) => b.d - a.d);
  const over = f.filter((d) => d > 50).length;
  return JSON.stringify({
    frames: f.length,
    worstFrame: Math.round(Math.max.apply(null, f.concat([0]))),
    stalls: over,
    blocked: long.reduce((a, b) => a + b.d, 0),
    longest: long.slice(0, 5).map((e) => e.d),
    tiles: document.querySelectorAll('.bv-gal__t').length,
    imgs: document.querySelectorAll('.bv-gal__t img').length,
  });
})()`));

/* WHEN, not just how much. An aggregate cannot tell a 230ms build frame from a
   230ms paint frame halfway through the animation, and those have opposite
   fixes. The first dozen deltas after the open show which. */
const timeline = JSON.parse(await ev(
  'JSON.stringify(window.__jank.frames.slice(0, 14).map((d) => Math.round(d)))'));
console.log('  first frames after the open: ' + timeline.join(' ') + ' ms');

console.log('  idle before opening : ' + idle.frames + ' frames, worst ' +
  idle.worst + 'ms, ' + idle.long + ' long tasks');
console.log('  opening "' + target + '" (' + tiles + ' pieces, ' + open.imgs +
  ' img elements in the shelf)');
console.log('    worst frame       ' + open.worstFrame + 'ms');
console.log('    frames over 50ms  ' + open.stalls);
console.log('    main thread blocked ' + open.blocked + 'ms');
console.log('    longest tasks     ' + open.longest.join(', ') + ' ms\n');

/* THE BUDGET. A case opening is a deliberate, animated transition — nobody
   expects it to be free — but the animation has to actually run. One frame over
   ~120ms is a visible hitch; a 300ms block is the dossier appearing to snap
   into place instead of growing out of the card. */
/* TWO BUDGETS, because they are two different experiences with two different
   fixes, and one number hides both.

   THE BUILD FRAME is a single hitch: parsing a dossier's markup, styling it and
   laying it out. It happens once, and one long frame at the start of a
   deliberate transition reads as weight, not as jitter. At 1x CPU this whole
   run blocks for 0ms; the number below is what it costs on a machine made four
   times slower than this one, with software rasterisation on the same throttled
   core — harsher than the phone it stands in for.

   THE ANIMATION AFTER IT is what "jitter" actually means: continuous stutter
   while something moves. That has to be smooth, and it is the one the
   backdrop-filter was ruining. Measured from frame 4 onward so the build frame
   cannot flatter or spoil it. */
const tail = timeline.slice(3);
const tailMedian = tail.slice().sort((a, b) => a - b)[Math.floor(tail.length / 2)] || 0;

/* ONLY THE MEDIANS ARE ASSERTED, and that is a finding rather than a
   convenience. Repeated runs on identical code gave:

     animation median   83  83 100  83 ms      <- tight, and it discriminates:
     with the old blur  100 117 133 117 ms         the distributions do not overlap
     worst build frame  200 233 267 333 ms      <- ±40%
     total blocked     1198 1728 2237 2379 ms   <- ±50%

   A gate on the noisy two would fail at random on unchanged code, which is
   worse than no gate: it trains you to re-run until green, and the next real
   regression gets re-run away with it. They are printed, because the numbers
   are useful to a human reading the output, and they are not asserted, because
   this harness cannot measure them repeatably. */
/* A PAIRED A/B IN ONE SESSION, because an absolute threshold cannot survive
   this machine. Repeated runs of identical code drifted from 83ms/frame to
   183ms/frame over an afternoon — not from any change, but from whatever else
   was running: free RAM moved between 4 and 12 GB and other applications came
   and went. A fixed number would pass or fail on the user's browser tabs.
   So the tool measures BOTH arms back to back in the same document, under
   whatever conditions currently hold, and asserts the DIFFERENCE. If somebody
   deletes the fix, the two arms become identical and this fails — which is the
   only thing a regression test here can honestly promise. */
async function armMedian() {
  await ev('window.__jank.frames = [];');
  await ev(`window.BV_OPEN_CASE(${JSON.stringify(target)})`);
  await sleep(2600);
  const t = JSON.parse(await ev(
    'JSON.stringify(window.__jank.frames.slice(3, 16).map((d) => Math.round(d)))'));
  await ev("(function(){var b=document.getElementById('caseX'); if(b) b.click();})()");
  await sleep(1400);
  const s = t.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] || 0;
}
const armFixed = await armMedian();
// Put the blur back on the veil from the first frame — the behaviour this pass
// removed — and open the very same dossier again.
await ev(`(function () {
  var s = document.createElement('style');
  s.textContent = '.bv-case__veil{backdrop-filter:blur(6px) saturate(.7)!important;' +
    '-webkit-backdrop-filter:blur(6px) saturate(.7)!important}';
  document.head.appendChild(s);
})()`);
await sleep(400);
const armBlurred = await armMedian();

console.log('  paired, same session, same dossier:');
console.log('    blur applied at rest     ' + armFixed + ' ms/frame');
console.log('    blur during the motion   ' + armBlurred + ' ms/frame\n');
check('applying the blur at rest is measurably smoother than during the motion',
  armBlurred - armFixed >= 16,
  armFixed + 'ms vs ' + armBlurred + 'ms — a gain of ' + (armBlurred - armFixed) + 'ms/frame');
void tailMedian;

console.log('  reported, NOT asserted — too noisy in this harness to gate on:');
console.log('    worst build frame   ' + open.worstFrame + 'ms   (spread ~200-333)');
console.log('    total blocked       ' + open.blocked + 'ms   (spread ~1200-2400; ' +
  'was 2495 before the page behind an open dossier was put to sleep)');
console.log('    frames over 50ms    ' + open.stalls + '\n');

/* Scrolling the dossier afterwards is the other half of the complaint. */
await ev('window.__jank.frames = []; window.__jank.long = [];');
await ev(`(async () => {
  const p = document.getElementById('casePanel');
  const total = p.scrollHeight - p.clientHeight;
  for (let i = 0; i <= 30; i++) {
    p.scrollTop = (total * i) / 30;
    await new Promise((r) => requestAnimationFrame(r));
  }
})()`);
await sleep(600);
const scrolled = JSON.parse(await ev(`(() => {
  const f = window.__jank.frames.slice().sort((a, b) => a - b);
  return JSON.stringify({
    worst: Math.round(f[f.length - 1] || 0),
    median: Math.round(f[Math.floor(f.length / 2)] || 0),
    stalls: window.__jank.frames.filter((d) => d > 50).length,
  });
})()`));
console.log('  scrolling the dossier: median ' + scrolled.median + 'ms, worst ' +
  scrolled.worst + 'ms, ' + scrolled.stalls + ' frames over 50ms\n');
/* REPORTED, NOT ASSERTED, for the same reason as the build frame: this drifts
   with whatever else the machine is doing. The paired comparison above is the
   gate. A single long frame here is also expected by design — it is one
   content-visibility section rendering as the reader arrives at it. */
console.log('  (scroll medians drift with machine load; the paired test above is the gate)');


await send('Emulation.setCPUThrottlingRate', { rate: 1 });
const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
