/* The pointer must never vanish.
 *
 * REPORTED: "the custom cursor disappears". It did, on every load, a few
 * seconds in. The FPS watchdog in perf.js demoted the motion tier at runtime,
 * .bv-lite hid the custom cursor, and html.bv-cursor-on was still hiding the
 * OPERATING SYSTEM cursor — so the reader was left with no pointer at all and
 * nothing on screen to explain why.
 *
 * Two rules came out of it, and this file is what holds them:
 *   1. Nothing may hide the custom cursor while the OS cursor is also hidden.
 *   2. A RUNTIME demotion may switch off per-frame work and nothing else. It
 *      may not change layout or remove an element somebody is already using —
 *      that is what .bv-lite-boot is for.
 *
 *   node tools/pointer.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CH = requireChrome();
const PORT = 9682;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(ROOT, '.chrome-pointer'), 'about:blank'],
  { stdio: 'ignore' });
let u;
for (let i = 0; i < 60; i++) {
  try {
    const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const p = t.find((x) => x.type === 'page');
    if (p) { u = p.webSocketDebuggerUrl; break; }
  } catch { /* not up */ }
  await sleep(250);
}
const ws = new WebSocket(u);
let id = 0; const w = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const k = w.get(m.id);
  if (k) { w.delete(m.id); k(m.result); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; w.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
const ev = async (x) => (await send('Runtime.evaluate',
  { expression: x, awaitPromise: true, returnByValue: true })).result.value;
const move = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(120);
};

const SNAP = `(() => {
  const de = document.documentElement;
  const cur = document.getElementById('cursor');
  const dot = cur.querySelector('.bv-cursor__dot');
  const rail = document.getElementById('pinRail');
  const track = document.querySelector('#reelA .bv-reel__track');
  return JSON.stringify({
    lite: !!(window.BV_PERF && window.BV_PERF.lite),
    boot: de.classList.contains('bv-lite-boot'),
    cursorShown: getComputedStyle(cur).display !== 'none',
    osCursorHidden: getComputedStyle(document.body).cursor === 'none',
    dot: dot.style.transform,
    railH: rail ? rail.offsetHeight : 0,
    docH: document.documentElement.scrollHeight,
    scrollY: Math.round(scrollY),
    track: track ? track.style.transform : '',
  });
})()`;

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

/* ---- 1. a runtime demotion, with a reader mid-page ----------------------- */
await send('Page.navigate', { url: 'http://localhost:4173/' });
await sleep(3000);
await move(400, 400);
await move(520, 430);
await ev("document.getElementById('services').scrollIntoView({block:'start',behavior:'instant'})");
await sleep(400);
const before = JSON.parse(await ev(SNAP));

/* Fire the demotion by hand rather than waiting for the watchdog. It is the
   exact call the watchdog makes, and the watchdog is deliberately reluctant
   now — a test that only runs when a machine happens to be slow is not a test. */
await ev('window.BV_PERF.set(true, false); document.documentElement.classList.add("bv-lite-auto");');
await sleep(1200);
await move(700, 500);
const after = JSON.parse(await ev(SNAP));

console.log('\nruntime demotion:', before.lite, '->', after.lite);
if (!after.lite) {
  console.log('  (the watchdog did not fire this run — the demotion assertions are skipped)');
} else {
  check('the pointer is still on screen', after.cursorShown === true);
  check('never both cursors hidden at once',
    !(after.osCursorHidden && !after.cursorShown));
  check('the custom cursor still tracks', after.dot !== before.dot, after.dot);
  check('the document did not change height',
    Math.abs(after.docH - before.docH) < 40,
    before.docH + ' -> ' + after.docH);
  check('the reader was not teleported',
    Math.abs(after.scrollY - before.scrollY) < 40,
    before.scrollY + ' -> ' + after.scrollY);
  check('the pinned section stayed pinned',
    Math.abs(after.railH - before.railH) < 40, before.railH + ' -> ' + after.railH);
}

/* ---- 2. lite chosen at boot: no custom cursor, but the OS one is back ---- */
await send('Page.addScriptToEvaluateOnNewDocument',
  { source: "try{localStorage.setItem('bv:motion','lite')}catch(e){}" });
await send('Page.navigate', { url: 'http://localhost:4173/' });
await sleep(3000);
await move(400, 400);
await move(520, 430);
const boot = JSON.parse(await ev(SNAP));
check('boot-lite marks itself', boot.boot === true);
check('boot-lite hides the custom cursor', boot.cursorShown === false);
check('boot-lite leaves the OS cursor alone', boot.osCursorHidden === false);

/* ---- 3. and back to full, so the profile is not left on lite ------------- */
await send('Page.addScriptToEvaluateOnNewDocument',
  { source: "try{localStorage.setItem('bv:motion','full')}catch(e){}" });
await send('Page.navigate', { url: 'http://localhost:4173/' });
await sleep(2500);
await move(400, 400);
const full = JSON.parse(await ev(SNAP));
check('full tier draws the custom cursor', full.cursorShown === true);
check('full tier hides the OS cursor', full.osCursorHidden === true);

const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); c.kill(); process.exit(failed ? 1 : 0);
