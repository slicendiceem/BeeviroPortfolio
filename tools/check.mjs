/* Drive the site in headless Chrome over CDP and report on it.
 *
 * The Browser pane cannot screenshot while it is not displayed, so verification
 * happens here instead. Usage:
 *
 *   node tools/check.mjs                    measure + screenshot, English
 *   node tools/check.mjs --lang ar          the Arabic build
 *   node tools/check.mjs --lite             force the lite tier
 *   node tools/check.mjs --shot name.png    where the screenshots go
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes('--' + k);

const LANG = arg('lang', 'en');
const LITE = has('lite');
const BASE = arg('url', 'http://localhost:4173/');
const WIDTHS = (arg('widths', '1440,1100,390')).split(',').map(Number);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }

const PORT = 9500 + (process.pid % 300);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-check'),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = tabs.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools never came up');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const waiting = new Map();
    const events = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method) { events.push(m); return; }
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      events,
      send(method, params) {
        return new Promise((res, rej) => {
          const n = ++id;
          waiting.set(n, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: n, method, params: params || {} }));
        });
      },
      async eval(expr, awaitPromise = false) {
        const r = await this.send('Runtime.evaluate', {
          expression: expr, awaitPromise, returnByValue: true,
        });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
          (r.exceptionDetails.exception || {}).description);
        return r.result.value;
      },
      close: () => ws.close(),
    }));
  });
}

const PROBE = `(() => {
  const q = (s) => document.querySelectorAll(s);
  const de = document.documentElement;
  const cards = [...q('.bv-card')];
  const overflow = de.scrollWidth - de.clientWidth;
  // Anything sticking out past the right edge of the viewport.
  const wide = [...q('main *')].filter((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2);
  }).slice(0, 6).map((n) => n.className || n.tagName);
  /* THE LEFT GRID LINE. Every section pads by --pad and caps at 1320, so every
     eyebrow starts on the same inline edge — that shared edge is most of what
     makes the page read as one composition rather than a stack of blocks.
     Two sections had opted out of it by hand and the page stepped 72 -> 132 ->
     200 on the way down at 1440px. Measured from the INLINE start, so the same
     number has to come back in Arabic. */
  const rtl = de.dir === 'rtl';
  const sections = [...q('main > section')];
  const edges = sections.map((s) => {
    const eb = s.querySelector('.bv-eyebrow');
    if (!eb) return null;
    const r = eb.getBoundingClientRect();
    return { id: s.id, x: Math.round(rtl ? innerWidth - r.right : r.left) };
  }).filter(Boolean);
  const spread = edges.length
    ? Math.max(...edges.map((e) => e.x)) - Math.min(...edges.map((e) => e.x)) : 0;

  /* Anything a finger has to hit. 24px is the floor; below it the control is
     fiddly on a phone whatever the spacing exception says. */
  const tiny = [...q('a, button, [role=button], input')]
    .map((n) => ({ n, r: n.getBoundingClientRect() }))
    .filter(({ n, r }) => r.width > 0 && r.height > 0 &&
      Math.min(r.width, r.height) < 24 &&
      getComputedStyle(n).visibility !== 'hidden' && !n.closest('[hidden]'))
    .map(({ n, r }) => (n.tagName + '.' + String(n.className).split(' ')[0] + ' ' +
      Math.round(r.width) + 'x' + Math.round(r.height)));

  return {
    lang: de.lang, dir: de.dir, cls: de.className,
    overflowPx: overflow,
    offscreen: wide,
    gridLine: edges.map((e) => e.id + ':' + e.x).join(' '),
    gridLineSpread: spread,
    /* Reported so the assertion can refuse to pass on an empty sample. A
       section that loses or renames its eyebrow drops silently out of "edges",
       and with none left "spread" is 0 and the check goes green having measured
       nothing — the same shape as the "gap: -1" bug in strips.mjs, in the very
       check written to stop reports going green while the page drifts.
       #hero has no eyebrow of its own, so the expected count is sections - 1. */
    gridLineSeen: edges.length,
    sections: sections.length,
    tinyTargets: tiny.slice(0, 8),
    cards: cards.length,
    cardsVisible: cards.filter((c) => !c.hidden).length,
    more: (document.getElementById('moreLabel') || {}).textContent,
    moreCount: (document.getElementById('moreCount') || {}).textContent,
    svcIcons: q('.bv-svc__art svg').length,
    hiveCells: q('.bv-cellx').length,
    hiveVideos: q('.bv-cellx video').length,
    reelTiles: q('#reelA .bv-tile, #reelB .bv-tile').length,
    brokenImgs: [...q('img')].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).length,
    h1: (document.getElementById('heroTitle') || {}).textContent,
    h1px: document.getElementById('heroTitle')
      ? parseFloat(getComputedStyle(document.getElementById('heroTitle')).fontSize) : 0,
    h2px: q('.bv-h2')[0] ? parseFloat(getComputedStyle(q('.bv-h2')[0]).fontSize) : 0,
    ledepx: q('.bv-lede')[0] ? parseFloat(getComputedStyle(q('.bv-lede')[0]).fontSize) : 0,
  };
})()`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const cdp = await connect(await wsUrl());
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');

  const url = BASE + '?lang=' + LANG;
  const report = {};

  /* Registered ONCE, outside the loop. It applies to every new document, so
     registering it per width just stacks identical copies that are never
     removed — by the last width the tier is being written three times per
     navigation. Set either way: the tier is remembered in localStorage and the
     Chrome profile is reused between runs, so a previous --lite run would
     otherwise keep every later run on the lite tier and quietly invalidate it. */
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: LITE
      ? "try { localStorage.setItem('bv:motion','lite'); } catch(e) {}"
      : "try { localStorage.setItem('bv:motion','full'); } catch(e) {}",
  });

  for (const w of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: w < 500 ? 844 : 900, deviceScaleFactor: 1, mobile: w < 500,
    });
    // A fresh document each width: the lattice and the strips size themselves at
    // build time, so resizing an already-built page is not the same test.
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await sleep(120);
    await cdp.send('Page.navigate', { url });
    await sleep(2600);
    report[w] = await cdp.eval(PROBE);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(OUT, `${LANG}${LITE ? '-lite' : ''}-${w}.png`),
      Buffer.from(shot.data, 'base64'));
  }

  const errors = cdp.events
    .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map((e) => e.params.entry.text);
  const failed = cdp.events
    .filter((e) => e.method === 'Network.loadingFailed')
    .map((e) => e.params.errorText);

  console.log(JSON.stringify(report, null, 1));
  console.log('\nconsole errors:', errors.length ? errors.slice(0, 8) : 'none');
  console.log('failed requests:', failed.length ? failed.slice(0, 8) : 'none');
  console.log('screenshots in .shots/');

  /* This file used to only ever print. A report nobody has to read is a report
     that goes green while the page drifts, so the things worth asserting are
     asserted and the exit code says so. */
  const bad = [];
  for (const [w, r] of Object.entries(report)) {
    if (r.overflowPx > 0) bad.push(w + 'px: ' + r.overflowPx + 'px of horizontal overflow');
    if (r.brokenImgs > 0) bad.push(w + 'px: ' + r.brokenImgs + ' broken images');
    // The sample has to be complete before its spread means anything.
    if (r.gridLineSeen < r.sections - 1) {
      bad.push(w + 'px: only measured ' + r.gridLineSeen + ' of ' + (r.sections - 1) +
        ' section eyebrows — the grid-line check is not looking at the whole page');
    }
    // 1px of subpixel disagreement between sections is not a broken grid.
    if (r.gridLineSpread > 1) bad.push(w + 'px: sections do not share a left edge — ' + r.gridLine);
    if (r.tinyTargets.length) bad.push(w + 'px: targets under 24px — ' + r.tinyTargets.join(', '));
  }
  if (errors.length) bad.push('console errors: ' + errors.slice(0, 3).join(' | '));
  if (failed.length) bad.push('failed requests: ' + failed.slice(0, 3).join(' | '));

  console.log('');
  bad.forEach((b) => console.log('  FAIL  ' + b));
  console.log(bad.length ? '\n' + bad.length + ' problems' : '\nall checks passed');

  cdp.close();
  chrome.kill();
  process.exitCode = bad.length ? 1 : 0;
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
