/* Exercise the two reported dossier bugs, end to end, in a real browser.
 *
 *   1. "when I choose case 1/25 Izar, when I scroll it does not make all the
 *       journey glow on the side tab"
 *   2. "open a test case and scroll down then close it and open another one,
 *       you will find it scrolled-down by default"
 *
 * Both are only observable by actually scrolling a laid-out panel, so this
 * drives the page rather than asserting on the source.
 *
 *   node tools/flow.mjs [--lang ar] [--url http://localhost:4173/]
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
const LANG = arg('lang', 'en');
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('chrome not found'); process.exit(1); }

const PORT = 9600 + (process.pid % 300);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1440,900',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-flow'),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('devtools never came up');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const waiting = new Map();
    const errors = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push(m.params.entry.text);
        return;
      }
      if (m.method) return;
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      errors,
      send(method, params) {
        return new Promise((res, rej) => {
          const n = ++id;
          waiting.set(n, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: n, method, params: params || {} }));
        });
      },
      async eval(expr) {
        const r = await this.send('Runtime.evaluate', {
          expression: expr, awaitPromise: true, returnByValue: true,
        });
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.text + ' ' +
            ((r.exceptionDetails.exception || {}).description || ''));
        }
        return r.result.value;
      },
      close: () => ws.close(),
    }));
  });
}

/* A real pointer press and release. element.click() skips pointerdown/up
   entirely, which is exactly the class of bug this file exists to catch. */
async function clickAt(cdp, x, y) {
  const base = { x, y, button: 'left', clickCount: 1, buttons: 1 };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await sleep(35);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
}

/* Dispatched mouse events are in VIEWPORT coordinates, so an element below the
   fold has to be scrolled to first or the press lands on empty space three
   thousand pixels off screen and the test reports a bug that is not there. */
async function clickSel(cdp, sel) {
  const box = await cdp.eval(`(async () => {
    const n = document.querySelector(${JSON.stringify(sel)});
    if (!n) return null;
    let r = n.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 20) {
      // 'instant', not 'auto': the stylesheet sets scroll-behavior: smooth, and
      // 'auto' defers to it — so the page is still gliding when the rect is
      // measured and the click lands wherever the button used to be.
      n.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((res) => setTimeout(res, 260));
      r = n.getBoundingClientRect();
    }
    if (r.width < 2 || r.height < 2) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error('not clickable: ' + sel);
  await clickAt(cdp, box.x, box.y);
}

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const cdp = await connect(await wsUrl());
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: BASE + '?lang=' + LANG });
  await sleep(2800);

  /* ---- 1. six cards, then show more ------------------------------------- */
  const before = await cdp.eval(
    '[...document.querySelectorAll(".bv-card")].filter(c=>!c.hidden).length');
  check('work shows 6 cards on arrival', before === 6, 'saw ' + before);

  await clickSel(cdp, '#moreBtn');
  await sleep(700);
  const after = await cdp.eval(
    '[...document.querySelectorAll(".bv-card")].filter(c=>!c.hidden).length');
  check('show more reveals the next six', after === 12, 'saw ' + after);

  /* ---- 2. open case 1 and walk the journey ------------------------------- */
  await cdp.eval('scrollTo(0,0)');
  await sleep(400);
  await cdp.eval('window.BV_OPEN_CASE("izar")');
  await sleep(900);

  const inset = await cdp.eval(`(() => {
    const sh = document.querySelector('.bv-case__shell').getBoundingClientRect();
    return { left: Math.round(sh.left), top: Math.round(sh.top),
             right: Math.round(innerWidth - sh.right) };
  })()`);
  check('dossier is inset from the viewport edges',
    inset.left > 8 && inset.top > 8 && inset.right > 8, JSON.stringify(inset));

  const veilVisible = await cdp.eval(
    "getComputedStyle(document.getElementById('caseVeil')).opacity");
  check('the page behind is dimmed, not replaced', Number(veilVisible) > 0.5,
    'veil opacity ' + veilVisible);

  // Scroll the panel to the very bottom in steps, sampling the rail.
  const walk = await cdp.eval(`(async () => {
    const panel = document.getElementById('casePanel');
    const seen = new Set();
    const steps = [...panel.querySelectorAll('.bv-step')];
    const total = panel.scrollHeight - panel.clientHeight;
    /* Sampled on ANIMATION FRAMES, not on a 55ms timer, and in 60 steps rather
       than 40. The rail is repainted from a rAF-throttled scroll handler, so on
       a loaded machine a frame can outlast the timer: several scroll steps get
       coalesced into one paint, the highlight jumps two stages at once, and the
       walk reports "4 of 6 stages highlighted" — about one run in three, only
       ever when other Chromes were running. Waiting for two frames ties the
       sample to the renderer instead of the clock, so a slow machine takes
       longer rather than skipping. */
    for (let i = 0; i <= 60; i++) {
      panel.scrollTop = (total * i) / 60;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.querySelectorAll('#caseSteps button.is-on')
        .forEach((b) => seen.add(b.textContent.trim()));
    }
    await new Promise((r) => setTimeout(r, 200));
    return {
      steps: steps.length,
      litHexes: steps.filter((s) => s.classList.contains('is-in')).length,
      railSeen: seen.size,
      spine: getComputedStyle(document.getElementById('caseSpine')).transform,
      done: document.querySelectorAll('#caseSteps button.is-done').length,
    };
  })()`);
  check('every journey hex lights by the bottom',
    walk.litHexes === walk.steps && walk.steps === 6,
    walk.litHexes + '/' + walk.steps + ' lit');
  check('the rail highlight visits every stage', walk.railSeen === walk.steps,
    walk.railSeen + ' of ' + walk.steps + ' stages highlighted while scrolling');
  const spineY = /matrix\(([^)]+)\)/.exec(walk.spine);
  const scaleY = spineY ? Number(spineY[1].split(',')[3]) : 0;
  check('the spine fills to the end of the journey', scaleY > 0.95,
    'scaleY ' + scaleY.toFixed(3));

  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(OUT, `case-${LANG}.png`), Buffer.from(shot1.data, 'base64'));

  /* ---- 3. close, open another: it must NOT arrive scrolled --------------- */
  const scrolledTo = await cdp.eval("document.getElementById('casePanel').scrollTop");
  await clickSel(cdp, '#caseX');
  await sleep(900);
  await cdp.eval('window.BV_OPEN_CASE("speakup")');
  await sleep(900);
  const nextTop = await cdp.eval("document.getElementById('casePanel').scrollTop");
  check('a freshly opened case starts at the top',
    nextTop === 0, 'previous case was at ' + Math.round(scrolledTo) + 'px, new one at ' + nextTop);

  /* ---- 4. reopening fast must not hide the dossier ----------------------- */
  await clickSel(cdp, '#caseX');
  await sleep(120);                                     // inside the 520ms close
  await cdp.eval('window.BV_OPEN_CASE("freestyle")');
  await sleep(900);
  const stillOpen = await cdp.eval(
    "document.getElementById('case').classList.contains('is-open')");
  check('reopening during the close animation still opens', stillOpen === true);

  /* ---- 5. clicking the margin closes ------------------------------------- */
  await clickAt(cdp, 12, 450);
  await sleep(900);
  const closed = await cdp.eval(
    "!document.getElementById('case').classList.contains('is-shown')");
  check('clicking the page around the dossier closes it', closed === true);

  /* ---- 6. a hero cell still opens its case ------------------------------- */
  await sleep(500);
  await cdp.eval('scrollTo(0,0)');
  await sleep(300);
  const cellHit = await cdp.eval(`(() => {
    const cells = [...document.querySelectorAll('.bv-cellx')];
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (document.elementFromPoint(x, y) === c ||
          c.contains(document.elementFromPoint(x, y))) return { x, y, slug: c.dataset.slug };
    }
    return null;
  })()`);
  if (cellHit) {
    await clickAt(cdp, cellHit.x, cellHit.y);
    await sleep(900);
    const opened = await cdp.eval(
      "document.getElementById('case').classList.contains('is-open') || location.hash");
    check('a hero comb cell still opens a case', !!opened,
      cellHit.slug + ' -> ' + opened);
  } else {
    check('a hero comb cell is reachable', false, 'no cell passed a hit test');
  }

  const errs = cdp.errors;
  check('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  const failed = results.filter((r) => !r.pass);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  cdp.close();
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
