/* Per-URL byte profile of a cold first view. `weigh.mjs` says how heavy the page
 * is; this says which files made it that way.
 *
 *   node tools/profile.mjs [--lang ar] [--lite] [--w 1440] [--scroll]
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = Number(arg('w', 1440));
const LITE = args.includes('--lite');
const SCROLL = args.includes('--scroll');
const URL_ = arg('url', 'http://localhost:4173/') + '?lang=' + arg('lang', 'en');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9880 + (process.pid % 90);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-prof'),
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
const req = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Network.requestWillBeSent') {
    req.set(m.params.requestId, { url: m.params.request.url, size: 0, type: '' });
  } else if (m.method === 'Network.responseReceived') {
    const r = req.get(m.params.requestId);
    if (r) r.type = m.params.type;
  } else if (m.method === 'Network.loadingFinished') {
    const r = req.get(m.params.requestId);
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

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 500 });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: "try{localStorage.setItem('bv:motion','" + (LITE ? 'lite' : 'full') + "')}catch(e){}",
});
await send('Page.navigate', { url: URL_ });
await sleep(6000);
if (SCROLL) {
  await ev(`(async () => { const d = document.documentElement.scrollHeight - innerHeight;
    for (let i = 0; i <= 40; i++) { scrollTo(0, d * i / 40);
      await new Promise((r) => setTimeout(r, 70)); } })()`);
  await sleep(3000);
}

const rows = [...req.values()].filter((r) => r.size > 0);
/* A request with no finish event is a 404, an abort, or still in flight. Worth
   printing loudly: a light copy that silently 404s falls back to the original
   and the page looks fine while quietly costing double. */
const dead = [...req.values()].filter((r) => !r.size && !/^data:|^blob:/.test(r.url));
if (dead.length) {
  console.log('\n  NEVER FINISHED (404, aborted, or still loading):');
  dead.slice(0, 12).forEach((r) =>
    console.log('    ' + r.url.replace(/^https?:\/\/[^/]+\//, '')));
}
/* Once the light copies are in the media library every asset arrives as an
   opaque CDN id, and grouping by path stops telling you anything — the whole
   page lands in "other". Invert media-map.js so each id is reported as the site
   path it actually is; that is the only way to see whether a full-size original
   is still being fetched somewhere it should not be. */
const CDN_TO_PATH = {};
try {
  const src = readFileSync(path.join(ROOT, 'site/js/media-map.js'), 'utf8');
  const m = src.match(/window\.BV_MEDIA\s*=\s*\{([\s\S]*?)\n\};/);
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/'([^']+)':\s*'([^']+)'/);
      if (kv) CDN_TO_PATH[kv[2]] = kv[1];
    }
  }
} catch { /* no map — grouping falls back to raw paths */ }

const groups = {};
for (const r of rows) {
  let u2 = r.url.replace(/^https?:\/\/[^/]+\//, '');
  const id = (u2.match(/\/media\/([^/?]+)$/) || [])[1];
  if (id && CDN_TO_PATH[id]) u2 = CDN_TO_PATH[id];
  const key = /assets\/work\/[^/]+\/thumb\//.test(u2) ? 'card thumbnails 480'
    : /assets\/work\/[^/]+\/cell\//.test(u2) ? 'comb cells 200'
    : /assets\/light\//.test(u2) ? 'brand + hero (light)'
    : /assets\/work\//.test(u2) ? 'work full-size'
    : /reels\/small/.test(u2) ? 'hero reels (shrunken)'
    : /assets\/hero\/reels/.test(u2) ? 'hero reels (video)'
    : /assets\/hero\//.test(u2) ? 'hero stills'
    : /assets\/logos/.test(u2) ? 'logos'
    : /assets\/fonts|\.ttf/.test(u2) ? 'font'
    : /\.js$/.test(u2) ? 'scripts'
    : /\.css$/.test(u2) ? 'css'
    : 'other';
  groups[key] = groups[key] || { n: 0, size: 0 };
  groups[key].n++; groups[key].size += r.size;
}
const total = rows.reduce((a, b) => a + b.size, 0);
console.log(`\n${LITE ? 'LITE' : 'FULL'} @ ${W}px${SCROLL ? ' · whole page scrolled' : ' · first view'}`);
console.log('  ' + rows.length + ' requests · ' + (total / 1048576).toFixed(2) + ' MB\n');
Object.entries(groups).sort((a, b) => b[1].size - a[1].size).forEach(([k, v]) => {
  console.log('  ' + k.padEnd(20) + String(v.n).padStart(4) + '  ' +
    (v.size / 1024).toFixed(0).padStart(7) + ' KB');
});
const asPath = (url) => {
  const u = url.replace(/^https?:\/\/[^/]+\//, '');
  const id = (u.match(/\/media\/([^/?]+)$/) || [])[1];
  return (id && CDN_TO_PATH[id]) || u;
};
console.log('\n  ten heaviest single files:');
rows.sort((a, b) => b.size - a.size).slice(0, 10).forEach((r) => {
  console.log('    ' + (r.size / 1024).toFixed(0).padStart(6) + ' KB  ' + asPath(r.url).slice(0, 70));
});
ws.close(); chrome.kill(); process.exit(0);
