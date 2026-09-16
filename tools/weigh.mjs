/* Weigh the home page: what it actually pulls off the wire, and whether it can
 * hold a frame budget while being scrolled.
 *
 *   node tools/weigh.mjs            full tier
 *   node tools/weigh.mjs --lite     lite tier
 *   node tools/weigh.mjs --deep     also scroll the whole page and weigh again
 *
 * "Heavy" was the first thing every reviewer said, so it needs a number.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const LITE = args.includes('--lite');
const DEEP = args.includes('--deep');
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const URL_ = arg('url', 'http://localhost:4173/') + '?lang=' + arg('lang', 'en');
const W = Number(arg('w', 1440));

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9800 + (process.pid % 150);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-weigh'),
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
const bytes = new Map();            // requestId -> { type, size }
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Network.responseReceived') {
    bytes.set(m.params.requestId, { type: m.params.type, size: 0 });
  } else if (m.method === 'Network.loadingFinished') {
    const r = bytes.get(m.params.requestId);
    if (r) r.size = m.params.encodedDataLength;
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

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
/* Without this the profile's HTTP cache makes the second run of this script
   report ~0 MB of images and look like a spectacular improvement. A weight
   measurement has to be a cold one. */
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 500 });
if (LITE) {
  await send('Page.addScriptToEvaluateOnNewDocument',
    { source: "try{localStorage.setItem('bv:motion','lite')}catch(e){}" });
}
/* --full-images measures what the page weighed BEFORE the thumbnails existed.
   BV_THUMBS is locked to {} before any script runs; thumb-map.js is not in
   strict mode, so its assignment fails silently and thumb() falls through to
   the full-size image on every card, tile and hero cell. */
if (args.includes('--full-images')) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "Object.defineProperty(window,'BV_THUMBS',{value:{},writable:false,configurable:false});",
  });
}
await send('Page.navigate', { url: URL_ });
await sleep(5000);

function tally(label) {
  const by = {};
  let total = 0, n = 0;
  for (const r of bytes.values()) {
    by[r.type] = (by[r.type] || 0) + r.size;
    total += r.size; n++;
  }
  console.log('\n' + label);
  console.log('  requests     ' + n);
  console.log('  transferred  ' + (total / 1048576).toFixed(2) + ' MB');
  Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([k, v]) => console.log('    ' + k.padEnd(12) + (v / 1048576).toFixed(2) + ' MB'));
}
tally((LITE ? 'LITE' : 'FULL') + ' tier · first view, no scrolling');

/* Frames while the page is driven past every section. A dropped frame budget
   is what "lagging when scrolling" actually means, so measure it rather than
   trusting that switching effects off was enough. */
const fps = await ev(`(async () => {
  const doc = document.documentElement.scrollHeight - innerHeight;
  let frames = 0, stop = false;
  const tick = () => { frames++; if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const t0 = performance.now();
  for (let i = 0; i <= 60; i++) {
    scrollTo(0, (doc * i) / 60);
    await new Promise((r) => setTimeout(r, 60));
  }
  stop = true;
  return +(frames / ((performance.now() - t0) / 1000)).toFixed(1);
})()`);
console.log('  fps under scroll  ' + fps);

if (DEEP) {
  await sleep(3000);
  tally((LITE ? 'LITE' : 'FULL') + ' tier · after scrolling the whole page');
}

ws.close(); chrome.kill(); process.exit(0);
