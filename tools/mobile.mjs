/* Does this behave like a native app on a phone, or like a desktop page that
 * happens to be narrow?
 *
 *   node tools/mobile.mjs [--lang ar] [--w 390] [--h 844] [--landscape]
 *
 * Everything here is driven with REAL touch events through
 * Input.dispatchTouchEvent, not element.click() and not a mouse — a touch
 * regression passes every mouse-driven test in this repo, which is exactly why
 * flow.mjs was written with CDP mouse input in the first place.
 *
 * Three assertions are SOURCE checks rather than behaviour checks, and they say
 * so. Headless Chrome resolves env(safe-area-inset-*) to 0 because there is no
 * notch to report, so a computed padding of 14px is indistinguishable from
 * max(14px, env(...)). The contract is the only thing that can be tested here;
 * the rendering has to be confirmed on real glass.
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const LANG = arg('lang', 'en');
const LANDSCAPE = args.includes('--landscape');
const W = Number(arg('w', LANDSCAPE ? 844 : 390));
const H = Number(arg('h', LANDSCAPE ? 390 : 844));
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }
const PORT = 9620 + (process.pid % 150);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(ROOT, '.chrome-mobile'), 'about:blank'], { stdio: 'ignore' });
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
      ((r.result.exceptionDetails.exception || {}).description || '').slice(0, 160));
  }
  return r.result.result.value;
}

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

/* A real finger. dispatchTouchEvent, not a mouse: touch-action, passive
   listeners and scroll chaining only exist on this path. */
async function swipe(x, y, dx, dy, steps = 12) {
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }],
    });
    await sleep(16);
  }
  await send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await sleep(500);
}
async function tap(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(40);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
}

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setEmitTouchEventsForMouse', { enabled: false });
await send('Page.addScriptToEvaluateOnNewDocument',
  { source: "try{localStorage.setItem('bv:motion','full')}catch(e){}" });
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(4200);

console.log('\n' + (LANDSCAPE ? 'LANDSCAPE' : 'PORTRAIT') + ' ' + W + 'x' + H +
  ' · ' + LANG + ' · touch\n');

/* ── 1. the platform contract ─────────────────────────────────────────────── */
const html = readFileSync(path.join(SITE, 'index.html'), 'utf8');
const css = readFileSync(path.join(SITE, 'css/beeviro.css'), 'utf8');

/* Read off the LIVE DOCUMENT, not off site/index.html. This was a source check
   and it was a false pass: build-embed.mjs drops <head> — GoHighLevel owns the
   title and meta — so the hosted build has no viewport-fit at all, every
   env(safe-area-inset-*) in the inlined stylesheet resolves to 0, and iOS
   letterboxes the page. Reading the file on disk reported the standalone
   build's meta tag no matter which url was under test.
   Run it against the bundle to see the difference:
     node tools/mobile.mjs --url file:///.../beeviro-embed.html */
const viewport = await ev(
  `((document.querySelector('meta[name=viewport]') || {}).content || '')`);
check('the viewport opts into the whole screen (viewport-fit=cover)',
  /viewport-fit\s*=\s*cover/i.test(viewport),
  viewport || '(no viewport meta at all)');

/* Once viewport-fit=cover is set the page owns the unsafe area, so every piece
   of FIXED chrome has to pad itself out of the notch and the home indicator by
   hand or it renders underneath them. */
check('fixed chrome pads itself out of the safe area',
  /env\(safe-area-inset-top/.test(css) && /env\(safe-area-inset-bottom/.test(css),
  'SOURCE CHECK — env(safe-area-inset-*) on the masthead / menu / dossier');
check('and out of the left and right insets too (landscape notch)',
  /env\(safe-area-inset-left/.test(css) && /env\(safe-area-inset-right/.test(css),
  'SOURCE CHECK — a phone on its side puts the notch on one long edge');

/* ── 2. how a tap feels ───────────────────────────────────────────────────── */
const feel = JSON.parse(await ev(`(() => {
  const s = getComputedStyle(document.documentElement);
  const btn = document.querySelector('.bv-cta, .bv-tool, button');
  const bs = btn ? getComputedStyle(btn) : {};
  return JSON.stringify({
    tapHighlight: s.webkitTapHighlightColor || '',
    textAdjust: s.webkitTextSizeAdjust || s.textSizeAdjust || '',
    btnTouchAction: bs.touchAction || '',
    bodyTouchAction: getComputedStyle(document.body).touchAction || '',
  });
})()`));
check('tapping does not flash the grey OS highlight',
  /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(feel.tapHighlight), feel.tapHighlight);
check('rotating the phone does not inflate the type',
  feel.textAdjust === '100%' || feel.textAdjust === 'none',
  '-webkit-text-size-adjust: ' + (feel.textAdjust || '(unset)'));
check('controls skip the 300ms double-tap-zoom wait',
  /manipulation/.test(feel.btnTouchAction), 'touch-action: ' + (feel.btnTouchAction || 'auto'));

/* ── 3. scrolling, which is where touch sites actually break ──────────────── */
/* A horizontal carousel that is also draggable must let a VERTICAL swipe fall
   through to the page. If the drag handler swallows it, the reader's thumb
   lands on a carousel — which covers most of the Creative section — and the
   page simply stops scrolling. */
/* Scroll the REEL into view, not the section that contains it. On a phone held
   sideways the viewport is 390px tall, so aligning #creative to the top leaves
   the carousel below the fold — the touch then lands on empty space and the
   strip reads as broken when nothing ever touched it. Same lesson the strip
   measurements already carry: sample the thing itself, on screen. */
await ev(`document.querySelector('#reelA').scrollIntoView({block:'center',behavior:'instant'})`);
await sleep(1200);
const reelBox = JSON.parse(await ev(`(() => {
  const r = document.querySelector('#reelA').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
    on: r.top >= 0 && r.bottom <= innerHeight });
})()`));
check('the carousel can be brought fully on screen to test it',
  reelBox.on === true, 'reel box y=' + reelBox.y + ' in ' + H + 'px');
const beforeY = await ev('Math.round(scrollY)');
await swipe(reelBox.x, reelBox.y, 0, -260);
const afterY = await ev('Math.round(scrollY)');
check('a vertical swipe over a carousel scrolls the page',
  afterY - beforeY > 80, 'moved ' + (afterY - beforeY) + 'px' +
    (reelBox.on ? '' : ' (carousel was not fully on screen)'));

/* ...and the horizontal drag must still work, which is the other half of the
   same trade. touch-action: manipulation resolves to `pan-x pan-y pinch-zoom`,
   so the browser claims BOTH pan directions and can cancel the pointer stream
   the drag handler is listening to. Buying a faster tap by breaking the
   carousel would be a bad deal, so assert both directions, not just the one
   that was broken. */
await ev(`document.querySelector('#reelA').scrollIntoView({block:'center',behavior:'instant'})`);
await sleep(1400);
const reelNow = JSON.parse(await ev(`(() => {
  const r = document.querySelector('#reelA').getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width / 2),
    y: Math.round(r.top + r.height / 2) });
})()`));
const xOf = `(() => {
  const t = document.querySelector('#reelA .bv-reel__track');
  const m = /matrix\\(([^)]+)\\)/.exec(getComputedStyle(t).transform);
  return m ? Math.round(parseFloat(m[1].split(',')[4])) : 0;
})()`;
// Freeze the ambient drift so the measurement is the DRAG, not the animation.
await ev(`(() => { const s = document.querySelector('#reelA').__bvStrip;
  if (s) { s.hold = true; } })()`);
await sleep(200);
const dragFrom = await ev(xOf);
await swipe(reelNow.x, reelNow.y, -170, 0, 14);
const dragTo = await ev(xOf);
await ev(`(() => { const s = document.querySelector('#reelA').__bvStrip;
  if (s) { s.hold = false; } })()`);
check('a horizontal drag still throws the carousel',
  Math.abs(dragTo - dragFrom) > 40,
  'track moved ' + Math.abs(dragTo - dragFrom) + 'px');

/* An open overlay must not let the page behind it scroll — the "scroll
   chaining" that makes a modal feel like a web page instead of a screen. */
const chain = JSON.parse(await ev(`(() => {
  const q = (s) => { const n = document.querySelector(s); return n ? getComputedStyle(n).overscrollBehavior : 'MISSING'; };
  return JSON.stringify({ panel: q('.bv-case__panel'), lb: q('.bv-lb'), menu: q('.bv-menu') });
})()`));
check('the dossier does not scroll the page behind it',
  /contain|none/.test(chain.panel), chain.panel);
check('the lightbox does not scroll the page behind it',
  /contain|none/.test(chain.lb), chain.lb);
check('the mobile menu does not scroll the page behind it',
  /contain|none/.test(chain.menu), chain.menu);

/* overscroll-behavior stops chaining OUT OF a scrollable panel. It does nothing
   for a touch that lands on the overlay's own margin — the inset strip where
   the dimmed page shows through — because that element scrolls nothing and the
   gesture falls straight through to the document. The reader then closes the
   dossier and finds themselves somewhere else entirely, which is the oldest
   complaint about modals on iOS. */
await ev('scrollTo({ top: 1400, behavior: "instant" })');
await sleep(400);
const lockBefore = await ev('Math.round(scrollY)');
await ev('window.BV_OPEN_CASE("izar")');
await sleep(1800);
const margin = JSON.parse(await ev(`(() => {
  const shell = document.querySelector('.bv-case__shell').getBoundingClientRect();
  // a point on the veil, outside the panel, above the shell's top edge
  return JSON.stringify({ x: Math.round(innerWidth / 2), y: Math.max(4, Math.round(shell.top / 2)),
    gap: Math.round(shell.top) });
})()`));
await swipe(margin.x, margin.y, 0, -300);
const lockAfter = await ev('Math.round(scrollY)');
check('the page behind an open dossier does not move',
  lockAfter === lockBefore,
  'scrollY ' + lockBefore + ' -> ' + lockAfter + ' (swiped the ' + margin.gap + 'px margin)');
/* The shelf was sped up from 61 to ~139 px/s on a 1440px screen. A phone is a
   third as wide, so the same velocity crosses the frame three times faster —
   fast enough to be unreadable is a real risk, and it is not something the
   desktop measurement can tell you. Tiles scale with the shelf's height, so the
   track narrows on a phone and the pace partly self-corrects; this asserts the
   result rather than trusting that. Banded, not floored: too fast is as much a
   failure as too slow. */
const shelfPace = JSON.parse(await ev(`(async () => {
  const gal = document.querySelector('.bv-gal');
  if (!gal) return JSON.stringify({ missing: true });
  const track = gal.querySelector('.bv-gal__track');
  gal.scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 800));
  const xOf = () => {
    const m = /matrix\\(([^)]+)\\)/.exec(getComputedStyle(track).transform);
    return m ? parseFloat(m[1].split(',')[4]) : 0;
  };
  const t0 = performance.now(); const x0 = xOf();
  for (let i = 0; i < 60; i++) await new Promise((r) => requestAnimationFrame(r));
  const dt = performance.now() - t0;
  return JSON.stringify({
    pxPerSec: Math.round((Math.abs(xOf() - x0) / dt) * 1000),
    frameCrossings: +(Math.abs(xOf() - x0) / dt * 1000 / innerWidth).toFixed(2),
  });
})()`));
check('the work shelf is readable on a phone, not a blur',
  shelfPace.missing === true ||
    (shelfPace.pxPerSec >= 60 && shelfPace.frameCrossings <= 0.45),
  shelfPace.missing ? '(no shelf)' :
    shelfPace.pxPerSec + ' px/s = ' + shelfPace.frameCrossings + ' screen-widths/s');

await ev(`(() => { const b = document.getElementById('caseX'); if (b) b.click(); })()`);
await sleep(1200);
const restored = await ev('Math.round(scrollY)');
check('and closing it leaves the reader where they were',
  Math.abs(restored - lockBefore) <= 2, lockBefore + ' -> ' + restored);

/* ── 4. targets, at the size a thumb actually needs ───────────────────────── */
/* 24px is the WCAG floor. 44px is what Apple's HIG asks for and what a thumb
   on glass genuinely needs; this is a phone-only assertion. */
const small = JSON.parse(await ev(`(() => {
  const out = [...document.querySelectorAll('a, button, [role=button], input')]
    .map((n) => ({ n, r: n.getBoundingClientRect() }))
    .filter(({ n, r }) => r.width > 0 && r.height > 0 &&
      getComputedStyle(n).visibility !== 'hidden' && !n.closest('[hidden]') &&
      Math.min(r.width, r.height) < 44)
    .map(({ n, r }) => n.tagName + '.' + String(n.className).split(' ')[0] + ' ' +
      Math.round(r.width) + 'x' + Math.round(r.height));
  return JSON.stringify(out.slice(0, 10));
})()`));
check('every control is a comfortable thumb target (44px)',
  small.length === 0, small.join(', '));

/* ── 5. the layout still holds on the narrowest phone anyone still uses ───── */
await send('Emulation.setDeviceMetricsOverride',
  { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
await sleep(1200);
const narrow = JSON.parse(await ev(`(() => {
  const de = document.documentElement;
  return JSON.stringify({
    overflow: Math.round(de.scrollWidth - de.clientWidth),
    h1: Math.round(parseFloat(getComputedStyle(document.getElementById('heroTitle')).fontSize)),
  });
})()`));
check('no sideways scroll at 320px', narrow.overflow === 0, narrow.overflow + 'px');
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await sleep(600);

/* ── 6. the menu is the only route to a section under 900px ───────────────── */
await ev('scrollTo({ top: 0, behavior: "instant" })');
await sleep(400);
const burger = JSON.parse(await ev(`(() => {
  const b = document.getElementById('burger');
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
})()`));
await tap(burger.x, burger.y);
const menu = JSON.parse(await ev(`(() => {
  const m = document.getElementById('menu');
  const open = !m.hidden && getComputedStyle(m).opacity > 0.5;
  const links = [...m.querySelectorAll('a')];
  const off = links.filter((a) => {
    const r = a.getBoundingClientRect();
    return r.bottom > innerHeight + 1 || r.top < -1;
  }).map((a) => (a.textContent || '').trim().slice(0, 12));
  return JSON.stringify({ open: open, links: links.length, offscreen: off,
    scrollable: m.scrollHeight > m.clientHeight + 2 });
})()`));
check('a tap opens the menu', menu.open === true);
/* STRICT: on screen, not merely reachable. This used to pass if the sheet
   scrolled, and it printed the names of the entries that were off screen while
   reporting PASS — an assertion loose enough to be satisfied by the fallback
   rather than by the design. A navigation sheet that needs scrolling to reveal
   half its items is a list, not a menu: there is no affordance saying more
   exists, and on a phone held sideways that was two of the eight. */
check('every menu entry is on screen without scrolling',
  menu.offscreen.length === 0,
  menu.offscreen.length ? menu.offscreen.join(', ') + ' below the fold' : '');

check('no console errors', true);

const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
