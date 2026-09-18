/* Recompress the site's remaining fixed images — the hero photographs and the
 * logos — into WebP copies at the size they are displayed.
 *
 * These are not gallery art, so make-thumbs.mjs does not touch them, and they
 * were quietly some of the heaviest single files on a cold load: a 191 KB hero
 * photograph sitting at 20% opacity behind a scrim, and a 75 KB PNG of the
 * Beeviro mark rendered at 34 CSS pixels in the masthead.
 *
 * Alpha is preserved — WebP keeps it, which is why the logos can move off PNG.
 * The originals stay on disk and remain the fallback whenever a light copy
 * cannot be resolved.
 *
 *   node tools/squeeze.mjs
 *
 * Writes site/assets/light/<name>.webp and merges into site/js/thumb-map.js.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';
import { replaceMap } from './map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'assets/light');

/* Each entry is [site-relative source, max width, quality].
   The widths are the real display sizes, doubled for a retina screen:
     hero photograph   full-bleed backdrop at 20% opacity behind a scrim
     brand icon        34px in the masthead, 340px watermark in the footer
     brand wordmark    158px in the footer
     client logos      up to 440px on a work card's logo plate */
const JOBS = [
  ['assets/hero/comb-wide.jpg', 1800, 0.72],
  ['assets/hero/comb-tall.jpg', 1100, 0.72],
  ['assets/logos/beeviro-icon.png', 680, 0.86],
  ['assets/logos/beeviro.png', 420, 0.88],
];
// Client logos are the lead art on the cards of the clients who delivered
// identity work but no gallery — one per card, at most 440px wide.
for (const f of await readdir(path.join(SITE, 'assets/logos'))) {
  if (!/\.png$/i.test(f) || /^beeviro/.test(f)) continue;
  JOBS.push(['assets/logos/' + f, 520, 0.88]);
}

const CHROME = requireChrome();

const PORT = 9270 + (process.pid % 100);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-squeeze'),
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
  if (k) { waiting.delete(m.id); k(m); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
const ev = async (x) => {
  const r = await send('Runtime.evaluate',
    { expression: x, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result.result.value;
};

/* alpha:true on the context, because the logos are cut-outs and flattening them
   onto black would put a black plate behind every one. */
const SQUEEZE = `(async (uri, maxw, q) => {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const s = Math.min(1, maxw / img.naturalWidth);
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, w, h);
  const out = cv.toDataURL('image/webp', q);
  return out.startsWith('data:image/webp') ? { b64: out.split(',')[1], w: w, h: h } : null;
})`;

await send('Runtime.enable');
await mkdir(OUT, { recursive: true });

const map = {};
let before = 0, after = 0;
for (const [rel, maxw, q] of JOBS) {
  const src = path.join(SITE, rel);
  if (!existsSync(src)) { console.log('  missing ' + rel); continue; }
  const buf = await readFile(src);
  before += buf.length;
  const mime = /\.png$/i.test(rel) ? 'image/png' : 'image/jpeg';
  const r = await ev(`(${SQUEEZE})(${JSON.stringify('data:' + mime + ';base64,' +
    buf.toString('base64'))}, ${maxw}, ${q})`);
  if (!r) { console.log('  webp unavailable for ' + rel); continue; }
  const out = Buffer.from(r.b64, 'base64');
  if (out.length >= buf.length) {
    console.log('  ' + rel.padEnd(34) + 'left alone (already smaller)');
    after += buf.length;
    continue;
  }
  const name = rel.split('/').pop().replace(/\.(jpe?g|png)$/i, '.webp');
  await writeFile(path.join(OUT, name), out);
  map[rel] = 'assets/light/' + name;
  after += out.length;
  console.log('  ' + rel.padEnd(34) + `${r.w}x${r.h}  ` +
    `${(buf.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`);
}

/* The favicon is the one image that has to stay PNG — OS taskbars, bookmark
   bars and link unfurlers all decode it and not all of them speak WebP. But it
   does not have to stay 500x500 and 75 KB: browsers ask for it on every cold
   load and render it at 16 or 32 pixels. */
{
  const src = path.join(SITE, 'assets/logos/beeviro-icon.png');
  const buf = await readFile(src);
  const r = await ev(`(async (uri) => {
    const img = new Image(); img.src = uri; await img.decode();
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const cx = cv.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, 64, 64);
    return cv.toDataURL('image/png').split(',')[1];
  })(${JSON.stringify('data:image/png;base64,' + buf.toString('base64'))})`);
  const out = Buffer.from(r, 'base64');
  await writeFile(path.join(OUT, 'favicon.png'), out);
  // Deliberately NOT added to thumb-map.js. It has no original of its own — it
  // is a second, smaller derivative of beeviro-icon.png, which already owns its
  // map entry — and the <link rel=icon> in index.html points straight at it.
  console.log('  favicon 64x64'.padEnd(36) +
    `${(buf.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`);
}

// Written through tools/map.mjs, which is the only thing that touches this file
// — this tool owns assets/light/ and must not disturb the work-image or reel
// tables that make-thumbs.mjs and shrink-reels.mjs wrote.
await replaceMap(path.join(SITE, 'js/thumb-map.js'), 'assets/light/', { BV_THUMBS: map });

console.log(`\n  ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
ws.close(); chrome.kill(); process.exit(0);
