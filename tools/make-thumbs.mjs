/* Downscale every gallery image into the sizes the page actually displays.
 *
 * The site shows 1200px JPEGs in three very different boxes:
 *   · work cards and carousel tiles   up to 440px  -> the 480px tier
 *   · hero comb cells                  92 to 152px -> the 200px tier
 * Shipping one 1200px file into all of them was most of the "this site is very
 * heavy" complaint, and it is decode work on every scroll as well as download.
 *
 * Output is WebP: at these sizes it is roughly 40% smaller than JPEG at matching
 * quality. The JPEG originals stay exactly where they are and remain what the
 * lightbox and the dossier shelf open — this only ever adds a lighter copy, and
 * beeviro.js falls back to the original whenever a light copy cannot be
 * resolved, so a partial or failed run cannot break a single image.
 *
 * There is no image library on this machine and no Python, so the resize runs in
 * headless Chrome over CDP: the file goes in as a data: URI, is drawn into a
 * canvas at the target width, and comes back out of toDataURL('image/webp', q).
 *
 *   node tools/make-thumbs.mjs [--wide 480] [--cell 200] [--q 0.78]
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';
import { replaceMap } from './map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
const WIDE = arg('wide', 480);
const CELL = arg('cell', 200);
const Q = arg('q', 0.78);

const CHROME = requireChrome();

const PORT = 9333 + (process.pid % 400);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-thumbs'),
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const tabs = await r.json();
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
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send(method, params) {
        return new Promise((res, rej) => {
          const n = ++id;
          waiting.set(n, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: n, method, params: params || {} }));
        });
      },
      close: () => ws.close(),
    }));
  });
}

/* Runs inside the page. Decodes once and emits BOTH tiers, so a 181-image run
   costs 181 decodes rather than 362. Returns null for a tier that would be an
   upscale — a "thumbnail" bigger than its source helps nobody. */
const RESIZE = `
(async (dataUri, sizes, q) => {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const out = {};
  for (const [name, maxw] of Object.entries(sizes)) {
    if (img.naturalWidth <= maxw) { out[name] = null; continue; }
    const s = maxw / img.naturalWidth;
    const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);
    const uri = cv.toDataURL('image/webp', q);
    out[name] = uri.startsWith('data:image/webp') ? uri.split(',')[1] : null;
  }
  return out;
})`;

async function main() {
  const cdp = await connect(await wsUrl());
  await cdp.send('Runtime.enable');

  const jobs = [];
  const workDir = path.join(SITE, 'assets/work');
  for (const slug of await readdir(workDir)) {
    const dir = path.join(workDir, slug);
    if (!(await stat(dir)).isDirectory()) continue;
    for (const f of await readdir(dir)) {
      if (!/^\d+\.jpg$/i.test(f)) continue;
      const webp = f.replace(/\.jpg$/i, '.webp');
      jobs.push({
        src: path.join(dir, f),
        from: `assets/work/${slug}/${f}`,
        wide: { file: path.join(dir, 'thumb', webp), key: `assets/work/${slug}/thumb/${webp}` },
        cell: { file: path.join(dir, 'cell', webp), key: `assets/work/${slug}/cell/${webp}` },
      });
    }
  }

  let done = 0, bytesIn = 0, wideOut = 0, cellOut = 0, skipped = 0;
  const wideMap = {}, cellMap = {};

  for (const j of jobs) {
    const buf = await readFile(j.src);
    bytesIn += buf.length;
    const uri = 'data:image/jpeg;base64,' + buf.toString('base64');
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(${RESIZE})(${JSON.stringify(uri)}, ` +
        `{"wide":${WIDE},"cell":${CELL}}, ${Q})`,
      awaitPromise: true, returnByValue: true,
    });
    const got = (r.result && r.result.value) || {};
    done++;

    for (const tier of ['wide', 'cell']) {
      const b64 = got[tier];
      if (!b64) { skipped++; continue; }
      const out = Buffer.from(b64, 'base64');
      if (out.length >= buf.length) { skipped++; continue; }
      await mkdir(path.dirname(j[tier].file), { recursive: true });
      await writeFile(j[tier].file, out);
      (tier === 'wide' ? wideMap : cellMap)[j.from] = j[tier].key;
      if (tier === 'wide') wideOut += out.length; else cellOut += out.length;
    }
    if (done % 25 === 0) process.stdout.write(`  ${done}/${jobs.length}\n`);
  }

  /* Written through tools/map.mjs. This tool owns the two work-image tiers and
     nothing else; the reel and brand entries other tools wrote stay put.
     replaceMap, not mergeMap: a client whose gallery shrank must lose its old
     keys rather than leave the map pointing at files that no longer exist. */
  await replaceMap(path.join(SITE, 'js/thumb-map.js'), 'assets/work/',
    { BV_THUMBS: wideMap, BV_CELLS: cellMap });
  const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
  console.log(`\n  ${jobs.length} images  ${mb(bytesIn)} of originals`);
  console.log(`  ${WIDE}px tier  ${Object.keys(wideMap).length} files  ${mb(wideOut)}`);
  console.log(`  ${CELL}px tier  ${Object.keys(cellMap).length} files  ${mb(cellOut)}`);
  if (skipped) console.log(`  ${skipped} tier(s) skipped (already small enough)`);
  cdp.close();
  chrome.kill();
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
