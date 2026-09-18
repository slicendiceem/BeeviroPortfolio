/* Cut a dossier film for a client out of the deliverable video on Drive.
 *
 *   node tools/ingest-reels.mjs [--only slug,slug] [--secs 10] [--size 420]
 *                               [--kbps 340] [--start 1.5] [--force]
 *
 * Reads reel-sources.json (which Drive file belongs to which client, and why),
 * downloads each source once into a cache OUTSIDE the repo — these are 8-120 MB
 * originals and must never be committed or shipped — and writes a square
 * `site/assets/hero/reels/<slug>.webm` clip at the size the film block actually
 * renders (420px, aspect-ratio 1/1, object-fit: cover).
 *
 * There is no ffmpeg on this machine, so Chrome is the codec, exactly as in
 * make-thumbs and shrink-reels: play the source into a canvas at the target
 * size, captureStream() it, record with MediaRecorder.
 *
 * Two things this does differently from shrink-reels:
 *
 *  - The source is served over a LOCAL HTTP SERVER WITH RANGE SUPPORT, not a
 *    data: URI. shrink-reels inlines ~400 KB webm files, which is fine; a
 *    120 MB mp4 becomes a 160 MB base64 string inside a JS expression sent over
 *    the DevTools socket, which is not. Range matters because seeking past the
 *    opening frames is the whole point of --start.
 *  - It records a WINDOW, not the whole file. These sources are 30-90 second
 *    finished ads; the dossier wants a loopable glimpse, and the weight budget
 *    that the reviewers complained about has not gone away.
 *
 * After this, run: node tools/shrink-reels.mjs --size 288 --kbps 115
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, stat, rename, unlink } from 'node:fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const REELS = path.join(SITE, 'assets/hero/reels');
/* Deliberately outside the repo: nothing here may end up in a commit or in
   site/. It is a download cache, not source material. */
const CACHE = path.join(os.tmpdir(), 'bv-reel-cache');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const num = (k, d) => Number(arg(k, d));
const ONLY = arg('only', '').split(',').filter(Boolean);
const SECS = num('secs', 10);
const SIZE = num('size', 420);
const KBPS = num('kbps', 340);
const START = num('start', 1.5);
const FORCE = args.includes('--force');

const manifest = JSON.parse(await readFile(path.join(ROOT, 'reel-sources.json'), 'utf8'));
const jobs = manifest.reels.filter((r) => !ONLY.length || ONLY.includes(r.slug));
if (!jobs.length) { console.error('nothing selected'); process.exit(1); }

await mkdir(CACHE, { recursive: true });
await mkdir(REELS, { recursive: true });

/* ── download ────────────────────────────────────────────────────────────────
   Drive interrupts anything large with a virus-scan confirmation page, so the
   download is `confirm=t` from the start and the result is checked: an HTML
   body coming back where video bytes were expected means the token changed
   again, and silently writing that to a .mp4 would fail much later, inside
   Chrome, as "decode failed". */
async function download(id, dest) {
  if (existsSync(dest) && (await stat(dest)).size > 100000 && !FORCE) {
    return (await stat(dest)).size;
  }
  const url = 'https://drive.usercontent.google.com/download?id=' + id +
    '&export=download&confirm=t';
  const r = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' },
  });
  if (!r.ok) throw new Error('http ' + r.status);
  if (/text\/html/.test(r.headers.get('content-type') || '')) {
    throw new Error('got an HTML page, not the file (confirm token changed?)');
  }
  /* Streamed to a .part file and renamed, rather than buffered whole.
     `arrayBuffer()` peaks at roughly twice the file — about 340 MB on a 170 MB
     source — and, worse, an interrupted download used to be indistinguishable
     from a good one on the next run. A half-written .part is never renamed, so
     the cache can only ever hold complete files. */
  const part = dest + '.part';
  try {
    await pipeline(Readable.fromWeb(r.body), createWriteStream(part));
  } catch (e) {
    await unlink(part).catch(() => {});
    throw e;
  }
  const size = (await stat(part)).size;
  if (size < 100000) {
    await unlink(part).catch(() => {});
    throw new Error('download was only ' + size + ' bytes');
  }
  await rename(part, dest);
  return size;
}

/* ── a local server that honours Range ─────────────────────────────────────
   Range, not a data: URI, because a 170 MB source becomes a 227 MB base64
   string inside a JS expression on the DevTools socket — and because seeking
   past the opening frames is the whole point of --start.
   Bound to 127.0.0.1 ONLY. These are unpublished client originals; for the
   minutes a run takes, 0.0.0.0 would serve every one of them to the LAN. */
const HTTP_PORT = 4577 + (process.pid % 400);
const server = http.createServer((req, res) => {
  (async () => {
    const name = decodeURIComponent(req.url.replace(/^\/+/, '').split('?')[0]);
    const file = path.join(CACHE, path.basename(name));   // no traversal out of CACHE
    if (!existsSync(file)) { res.writeHead(404); res.end('no'); return; }
    const size = (await stat(file)).size;
    const range = req.headers.range;
    let stream;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = Math.min(m[1] ? Number(m[1]) : 0, Math.max(0, size - 1));
      // Clamp to EOF: an unclamped end promises a content-length the stream
      // cannot deliver, and the response is silently truncated.
      const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
      res.writeHead(206, {
        'content-type': 'video/mp4',
        'content-range': `bytes ${start}-${end}/${size}`,
        'accept-ranges': 'bytes',
        'content-length': end - start + 1,
      });
      stream = createReadStream(file, { start, end });
    } else {
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size,
        'accept-ranges': 'bytes' });
      stream = createReadStream(file);
    }
    // Without this a read error is an unhandled 'error' event, which by default
    // takes the whole process down mid-run.
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  })().catch((e) => {
    try { res.writeHead(500); res.end(String(e.message).slice(0, 120)); } catch { res.destroy(); }
  });
});
server.on('error', (e) => {
  console.error('the local video server could not start: ' + e.message);
  process.exit(1);
});
await new Promise((r) => server.listen(HTTP_PORT, '127.0.0.1', r));

/* ── chrome ──────────────────────────────────────────────────────────────── */
const CHROME = requireChrome();
const PORT = 9260 + (process.pid % 120);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-ingest'),
  'about:blank'], { stdio: 'ignore' });
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
// `new WebSocket(undefined)` throws something unhelpful about an invalid URL 20
// seconds after the real problem, which is that Chrome never came up.
if (!wsUrl) { console.error('devtools never came up'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
let id = 0; const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const k = waiting.get(m.id);
  if (k) { waiting.delete(m.id); k(m); }
});
await new Promise((r) => ws.addEventListener('open', r));
/* Every pending call is rejected if the socket dies. Without this a Chrome that
   crashes mid-transcode leaves the tool waiting forever, holding an orphaned
   browser and an open server, with nothing on stdout to say why. */
let socketDead = null;
const failAll = (why) => {
  socketDead = new Error(why);
  waiting.forEach((r) => r({ error: { message: why } }));
  waiting.clear();
};
ws.addEventListener('close', () => failAll('the devtools socket closed'));
ws.addEventListener('error', () => failAll('the devtools socket errored'));

const send = (m, p) => new Promise((r) => {
  if (socketDead) { r({ error: { message: socketDead.message } }); return; }
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
/* A hard ceiling on any one evaluation. The in-page guards (40s for metadata,
   8s for a seek) protect against a stuck VIDEO; this protects against a stuck
   SOCKET, which is a different failure and was previously unbounded. */
async function ev(expr, timeoutMs = 180000) {
  let timer;
  const r = await Promise.race([
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    new Promise((res) => { timer = setTimeout(() => res({ error: { message: 'evaluate timed out after ' + timeoutMs + 'ms' } }), timeoutMs); }),
  ]);
  clearTimeout(timer);
  if (r.error) throw new Error(r.error.message);
  if (r.result.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text + ' ' +
      ((r.result.exceptionDetails.exception || {}).description || '').slice(0, 200));
  }
  return r.result.result.value;
}
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/blank' });
await sleep(400);

/* Runs in the page. Returns the clip AND a poster frame, because a film nobody
   has looked at is a film nobody should publish. */
const CUT = `(async (url, size, kbps, secs, start) => {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
  /* ONE persistent error handler, set once. Binding v.onerror inside each
     promise means the handler belongs to an already-settled promise the moment
     that step finishes — so a decode failure DURING the ten-second recording is
     invisible, the canvas simply stops updating, and the clip comes back partly
     frozen. This flag is checked after the recording instead. */
  let died = '';
  v.addEventListener('error', () => {
    died = (v.error && v.error.message) || 'media error ' + ((v.error || {}).code || '?');
  });
  v.src = url;
  await new Promise((res, rej) => {
    v.onloadedmetadata = res;
    v.addEventListener('error', () => rej(new Error('decode failed')));
    setTimeout(() => rej(new Error('metadata timeout')), 40000);
  });
  /* loadedmetadata fires for a file Chrome cannot actually decode — an HEVC
     iPhone capture, say — and every later step then "succeeds" against a 0x0
     frame: the canvas stays black, MediaRecorder writes a 110-byte container,
     and the run reports 8/8. Check the dimensions here, where it is still an
     error rather than a mystery. */
  if (!v.videoWidth || !v.videoHeight) {
    throw new Error('no decodable video track (unsupported codec?)');
  }
  const dur = v.duration || 0;
  // Never start on the very first frame (fades, slates) and never run off the end.
  const from = Math.max(0, Math.min(start, Math.max(0, dur - secs - 0.2)));
  /* Record only what the source actually has left. Running the recorder for a
     flat "secs" past the end writes a frozen tail, and the dossier player loops,
     so the freeze is the most visible part of the clip. */
  const span = dur > 0.4 ? Math.max(1, Math.min(secs, dur - from - 0.1)) : secs;

  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const cx = cv.getContext('2d', { alpha: false });
  cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
  const draw = () => {
    const s = Math.max(size / v.videoWidth, size / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s;
    cx.drawImage(v, (size - w) / 2, (size - h) / 2, w, h);
  };

  v.currentTime = from;
  await new Promise((res, rej) => {
    v.onseeked = res;
    // REJECT, not resolve. Resolving on timeout meant a failed seek carried on
    // and cut from wherever the video happened to be — a clip from the wrong
    // part of the film, reported as a success.
    setTimeout(() => rej(new Error('seek to ' + from.toFixed(1) + 's timed out')), 8000);
  });
  if (died) throw new Error('decode failed after seek: ' + died);
  draw();                                   // never open on a black frame
  const poster = cv.toDataURL('image/jpeg', 0.72);
  // WebP for the shippable copy — same encoder, same reason as squeeze.mjs.
  const posterWebp = cv.toDataURL('image/webp', 0.78);

  const stream = cv.captureStream(30);
  const chunks = [];
  const rec = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: kbps * 1000,
  });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  let raf = 0;
  const pump = () => { draw(); raf = requestAnimationFrame(pump); };
  rec.start();
  await v.play();
  pump();
  await new Promise((res) => setTimeout(res, Math.round(span * 1000)));
  cancelAnimationFrame(raf);
  v.pause();
  rec.stop();
  await done;
  if (died) throw new Error('the source stopped decoding mid-recording: ' + died);

  const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
  let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return { b64: btoa(bin), dur: dur, from: from, span: span, w: v.videoWidth, h: v.videoHeight,
           poster: poster, posterWebp: posterWebp };
})`;

await mkdir(path.join(ROOT, '.shots/reels'), { recursive: true });
let ok = 0;
for (const job of jobs) {
  process.stdout.write('  ' + job.slug.padEnd(16));
  /* KEYED BY DRIVE ID, NOT BY SLUG. Attribution in reel-sources.json has already
     been corrected twice; with a slug-keyed cache, changing an `id` and
     re-running silently re-cuts from the stale download and the only symptom is
     a poster that looks the same as last time. The cache must be keyed by the
     thing the manifest actually changes. */
  const cached = path.join(CACHE, job.id + '.mp4');
  try {
    const bytes = await download(job.id, cached);
    process.stdout.write((bytes / 1048576).toFixed(0).padStart(4) + ' MB in   ');
    const url = 'http://127.0.0.1:' + HTTP_PORT + '/' + job.id + '.mp4';
    // A per-reel start, because the useful frame is not 1.5s into every film —
    // some open on a slate, some on a fade from black.
    const from = job.start != null ? job.start : START;
    const r = await ev(`(${CUT})(${JSON.stringify(url)}, ${SIZE}, ${KBPS}, ${SECS}, ${from})`);
    const out = Buffer.from(r.b64, 'base64');
    // A webm header with no frames in it is about 110 bytes. Anything near that
    // is a failed recording wearing a success.
    if (out.length < 20000) throw new Error('recording came back empty (' + out.length + ' bytes)');
    await writeFile(path.join(REELS, job.slug + '.webm'), out);
    await writeFile(path.join(ROOT, '.shots/reels', job.slug + '.jpg'),
      Buffer.from(r.poster.split(',')[1], 'base64'));
    /* Only where the client has no gallery to borrow a poster from. Shipping
       nine of these when one is used would just be clutter. */
    if (job.poster) {
      await mkdir(path.join(REELS, 'poster'), { recursive: true });
      await writeFile(path.join(REELS, 'poster', job.slug + '.webp'),
        Buffer.from(r.posterWebp.split(',')[1], 'base64'));
    }
    console.log(`${r.w}x${r.h} ${r.dur.toFixed(0)}s -> ${SIZE}px ${r.span.toFixed(1)}s @${r.from.toFixed(1)}s   ` +
      `${(out.length / 1024).toFixed(0)} KB`);
    ok++;
  } catch (e) {
    console.log('FAILED: ' + e.message);
  }
}
console.log(`\n  ${ok}/${jobs.length} cut. Posters in .shots/reels/ — LOOK AT THEM before wiring`);
console.log('  then: node tools/shrink-reels.mjs --size 288 --kbps 115');
ws.close(); chrome.kill(); server.close(); process.exit(ok === jobs.length ? 0 : 1);
