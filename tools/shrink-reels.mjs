/* Re-encode the six hero comb reels down to the size they are actually shown at.
 *
 * They are 420x420 VP9 at roughly 440 kbps, about 2.0 MB together, and they play
 * inside hexagons between 92 and 152 CSS pixels wide, clipped, and colour-graded
 * down to 72% brightness. Two reviewers named the video files as the reason the
 * site felt heavy; this is the honest answer to that — keep all six reels, keep
 * the comb alive, and stop shipping four times the pixels anyone can see.
 *
 * There is no ffmpeg on this machine, so the transcode is done by Chrome:
 * play the source into a canvas at the target size, capture that canvas as a
 * MediaStream, and record it with MediaRecorder at a fixed bitrate. Same shape
 * as the thumbnail pipeline — the browser is the codec.
 *
 *   node tools/shrink-reels.mjs [--size 288] [--kbps 115]
 *
 * Writes site/assets/hero/reels/small/<slug>.webm and adds them to
 * site/js/thumb-map.js, which is the same "prefer the light copy when it can be
 * resolved" table the images use. Originals are left untouched.
 */
import { spawn } from 'node:child_process';
import { readdir, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';
import { replaceMap } from './map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const REELS = path.join(SITE, 'assets/hero/reels');
const OUT = path.join(REELS, 'small');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d; };
// 288/115 by default because that is what the six shipped reels are already
// encoded at — the cells that play them are 92-152 CSS px wide, so 288 is
// generous even at 2x, and a bare run should reproduce what is already committed.
const SIZE = arg('size', 288);
const KBPS = arg('kbps', 115);

const CHROME = requireChrome();

const PORT = 9390 + (process.pid % 200);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-reels'),
  'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
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
  if (k) { waiting.delete(m.id); k(m); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
async function ev(expr) {
  const r = await send('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.error) throw new Error(r.error.message);
  if (r.result.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text + ' ' +
      ((r.result.exceptionDetails.exception || {}).description || ''));
  }
  return r.result.result.value;
}

/* Runs in the page. A data: URI source keeps this independent of any server.
   The recording runs for exactly one source loop so the result still loops
   seamlessly; the first frame is drawn before recording starts, because
   MediaRecorder will happily open with a black frame otherwise. */
const SHRINK = `(async (dataUri, size, kbps) => {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.loop = false;
  v.src = dataUri;
  await new Promise((res, rej) => {
    v.onloadeddata = res; v.onerror = () => rej(new Error('decode failed'));
    setTimeout(() => rej(new Error('metadata timeout')), 20000);
  });
  const dur = v.duration;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const cx = cv.getContext('2d', { alpha: false });
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';

  // Square source, square target — but never assume; cover-crop to be safe.
  const draw = () => {
    const s = Math.max(size / v.videoWidth, size / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s;
    cx.drawImage(v, (size - w) / 2, (size - h) / 2, w, h);
  };

  v.currentTime = 0;
  await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
  draw();                                  // never start on a black frame

  const stream = cv.captureStream(30);
  const chunks = [];
  const rec = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: kbps * 1000,
  });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });

  let raf = 0;
  const pump = () => { draw(); raf = requestAnimationFrame(pump); };
  rec.start();
  await v.play();
  pump();
  await new Promise((res) => setTimeout(res, Math.round(dur * 1000)));
  cancelAnimationFrame(raf);
  v.pause();
  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: 'video/webm' });
  const buf = await blob.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return { b64: btoa(bin), dur: dur, w: v.videoWidth, h: v.videoHeight };
})`;

await send('Runtime.enable');
await mkdir(OUT, { recursive: true });

/* ONLY THE REELS THE HERO COMB ACTUALLY PLAYS.
   This folder now holds two different things: the six reels the comb plays in
   its hexagons, which need a 288px copy because a 420px file into a 120px cell
   is the exact waste this tool exists to remove — and the client dossier films,
   which are shown at 420px in a 420px block and resolve through media(), not
   thumb(). Shrinking those nine produced 1.4 MB of files in the deployable root
   that no code path can ever request, and nine more entries in the light map,
   every one of which audit-light then demanded be uploaded to the CDN so that
   nothing would fetch them.
   The list is read out of hive.js rather than repeated here, because two copies
   of it would drift; tools/audit-light.mjs asserts every slug in it has a copy,
   so adding one to the comb without re-running this fails loudly. */
const hiveSrc = await readFile(path.join(SITE, 'js/hive.js'), 'utf8');
const combSlugs = (/REELS\s*=\s*RICH\s*\?\s*\[([^\]]*)\]/.exec(hiveSrc) || [, ''])[1]
  .split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
if (!combSlugs.length) {
  console.error('could not read the hero comb reel list out of js/hive.js');
  chrome.kill(); process.exit(1);
}
const all = (await readdir(REELS)).filter((f) => /\.webm$/i.test(f));
const files = all.filter((f) => combSlugs.includes(f.replace(/\.webm$/i, '')));
console.log('  ' + files.length + ' hero comb reels (of ' + all.length +
  ' in the folder — dossier films are shown at full size and need no copy)\n');
let inBytes = 0, outBytes = 0;
const map = {};

for (const f of files) {
  const src = path.join(REELS, f);
  const buf = await readFile(src);
  inBytes += buf.length;
  const uri = 'data:video/webm;base64,' + buf.toString('base64');
  process.stdout.write('  ' + f.padEnd(24));
  try {
    const r = await ev(`(${SHRINK})(${JSON.stringify(uri)}, ${SIZE}, ${KBPS})`);
    const out = Buffer.from(r.b64, 'base64');
    if (out.length >= buf.length) {
      console.log('left alone (re-encode was not smaller)');
      continue;
    }
    await writeFile(path.join(OUT, f), out);
    outBytes += out.length;
    map['assets/hero/reels/' + f] = 'assets/hero/reels/small/' + f;
    console.log(`${r.w}x${r.h} -> ${SIZE}x${SIZE}   ` +
      `${(buf.length / 1024).toFixed(0)} KB -> ${(out.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.log('FAILED: ' + e.message);
  }
}

/* Merged through tools/map.mjs, which is the only thing that writes this file.
   This tool owns the reel folder; make-thumbs.mjs and squeeze.mjs own theirs,
   and none of the three may erase another's table just because it ran second.
   That exact bug cost a page 1.8 MB with nothing in the diff to explain it. */
const counts = await replaceMap(path.join(SITE, 'js/thumb-map.js'),
  'assets/hero/reels/small/', { BV_THUMBS: map });

console.log(`\n  ${(inBytes / 1048576).toFixed(2)} MB of reels -> ` +
  `${(outBytes / 1048576).toFixed(2)} MB`);
console.log(`  thumb-map.js holds ${counts.thumbs} display copies + ${counts.cells} comb cells`);
ws.close(); chrome.kill(); process.exit(0);
