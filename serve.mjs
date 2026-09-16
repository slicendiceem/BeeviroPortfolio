// Local host for the Beeviro portfolio. No dependencies.
//   node serve.mjs            -> http://localhost:4173
//   PORT=8080 node serve.mjs  -> another port
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// Drop every traversal segment, then require the result to stay under ROOT.
// The second check is the real guard; the split just keeps paths tidy.
function resolveSafe(rel) {
  const parts = path.normalize(rel)
    .split(/[\\/]+/)
    .filter((p) => p && p !== '..' && p !== '.');
  const file = path.join(ROOT, ...parts);
  return file.startsWith(ROOT) ? file : null;
}

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  const file = resolveSafe(rel);
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('403 forbidden');
    return;
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 ' + rel);
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // Assets are content-stable and heavy; the HTML/CSS/JS must not be cached
    // or an edit will not show up on reload.
    const cache = /\/assets\//.test(rel) ? 'public, max-age=86400' : 'no-cache';
    const head = { 'content-type': type, 'cache-control': cache, 'content-length': st.size };

    // Range support so video/large assets can be scrubbed.
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = Number(s) || 0;
      const end = e ? Number(e) : st.size - 1;
      if (start >= st.size) { res.writeHead(416).end(); return; }
      res.writeHead(206, Object.assign({}, head, {
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${st.size}`,
        'accept-ranges': 'bytes',
      }));
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    /* Compress the text. HTML, CSS and JS are the only things here that shrink —
       JPEG, WebP, WebM and TTF are already compressed and re-compressing them
       burns CPU to add bytes. Any real host does this, so without it every local
       measurement of "how heavy is this page" is wrong by a factor of four on
       exactly the files we most want to be honest about. */
    const COMPRESSIBLE = /^(text\/|application\/json|application\/javascript|image\/svg)/;
    const accepts = String(req.headers['accept-encoding'] || '');
    const enc = !COMPRESSIBLE.test(type) ? null
      : /\bbr\b/.test(accepts) ? 'br'
      : /\bgzip\b/.test(accepts) ? 'gzip'
      : null;

    if (enc && req.method !== 'HEAD') {
      const h = Object.assign({}, head, { 'content-encoding': enc, vary: 'accept-encoding' });
      delete h['content-length'];             // the compressed length is not known yet
      res.writeHead(200, h);
      const z = enc === 'br' ? zlib.createBrotliCompress({
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
      }) : zlib.createGzip({ level: 6 });
      fs.createReadStream(file).pipe(z).pipe(res);
      return;
    }

    res.writeHead(200, Object.assign({}, head, { 'accept-ranges': 'bytes' }));
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Either it is already serving, or run:  PORT=4174 node serve.mjs\n`);
    process.exit(1);
  }
  throw e;
});

// 0.0.0.0 so the site is reachable from a phone on the same wifi — the mobile
// layout is a first-class design and deserves testing on real glass.
server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address)
    .filter((a) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a));

  console.log('\n  Beeviro portfolio is up\n');
  console.log(`    local     http://localhost:${PORT}`);
  lan.forEach((a) => console.log(`    network   http://${a}:${PORT}`));
  console.log('\n  Ctrl-C to stop.\n');
});
