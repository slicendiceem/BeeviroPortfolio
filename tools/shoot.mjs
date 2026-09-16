/* Screenshot named sections of the page, at a given width and language.
 *
 *   node tools/shoot.mjs --at services,work,creative --w 1440 --lang en
 *
 * Separate from check.mjs because that one measures and this one only looks.
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
const AT = arg('at', 'services,work').split(',');
const W = Number(arg('w', 1440));
const H = Number(arg('h', 900));
const LANG = arg('lang', 'en');
const LITE = args.includes('--lite');
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const PORT = 9700 + (process.pid % 200);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-shoot'),
  'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = t.find((x) => x.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('devtools never came up');
}

const ws = new WebSocket(await wsUrl());
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

await mkdir(OUT, { recursive: true });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: W < 500 });
/* Set the tier BOTH ways, never only when asking for lite. The Chrome profile
   is reused between runs and the tier lives in localStorage, so one --lite run
   otherwise pins every later run to lite and the screenshots quietly stop
   showing the site anybody visits. */
await send('Page.addScriptToEvaluateOnNewDocument',
  { source: "try{localStorage.setItem('bv:motion','" + (LITE ? 'lite' : 'full') + "')}catch(e){}" });
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(2800);

for (const name of AT) {
  await ev(`(() => {
    const n = document.getElementById(${JSON.stringify(name)});
    if (n) n.scrollIntoView({ block: 'start', behavior: 'instant' });
  })()`);
  await sleep(1400);                       // let the scroll reveals land
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(OUT, `${LANG}${LITE ? '-lite' : ''}-${W}-${name}.png`),
    Buffer.from(shot.data, 'base64'));
  console.log('  .shots/' + `${LANG}${LITE ? '-lite' : ''}-${W}-${name}.png`);
}
ws.close(); chrome.kill(); process.exit(0);
