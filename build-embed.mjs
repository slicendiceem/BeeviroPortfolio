// Build the paste-ready single file for the GoHighLevel website builder.
//
//   node build-embed.mjs
//     -> beeviro-embed.html          one self-contained file
//     -> split/1-head-css.html       for builders with separate head/body/footer
//        split/2-body-html.html         slots (same content, three pieces)
//        split/3-footer-js.html
//
// Everything the page needs is inlined: CSS, all five scripts, and the Aclonica
// webfont as a data URI. Media is NOT inlined — it is already hosted in the GHL
// media library, so every asset path is rewritten to its CDN URL at build time.
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'site';
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8');

/* ---- media map: site path -> absolute CDN url ----------------------------- */
const mapSrc = read('js/media-map.js');
const BASE = (mapSrc.match(/BV_MEDIA_BASE\s*=\s*'([^']+)'/) || [, ''])[1];
const MAP = {};
for (const m of mapSrc.matchAll(/'([^']+)':\s*'([^']+)'/g)) MAP[m[1]] = m[2];
const cdn = (rel) => {
  const key = rel.replace(/^\.\.\//, '').replace(/^\.\//, '');
  return MAP[key] ? BASE + MAP[key] : null;
};

/* ---- CSS: inline the font, point asset urls at the CDN -------------------- */
let css = read('css/beeviro.css');

const ttf = fs.readFileSync(path.join(SITE, 'assets/fonts/Aclonica-Regular.ttf'));
css = css.replace(
  /src:\s*url\('\.\.\/assets\/fonts\/Aclonica-Regular\.ttf'\)\s*format\('truetype'\);/,
  "src: url('data:font/ttf;base64," + ttf.toString('base64') + "') format('truetype');"
);

// the hero stills appear as var() fallbacks; JS overrides them, but the fallback
// must still resolve inside GHL or it 404s before the script runs
let cssMissed = [];
css = css.replace(/url\('(\.\.\/assets\/[^']+)'\)/g, (whole, rel) => {
  const u = cdn(rel);
  if (!u) { cssMissed.push(rel); return whole; }
  return "url('" + u + "')";
});

/* ---- HTML: body markup, with static asset paths rewritten ---------------- */
let html = read('index.html');

/* The light copies (thumb-map.js) exist on disk but not in the media library
   until somebody uploads them, and the embed serves nothing from disk. So a
   light path in the markup is rewritten to the CDN url of the ORIGINAL it was
   made from — the reader gets the heavier file rather than a broken image, and
   the moment the light copies are uploaded this resolves to them instead with
   no code change. Inverted here so the same table drives both. */
const thumbSrc = read('js/thumb-map.js');
const LIGHT_TO_HEAVY = {};
for (const table of ['BV_THUMBS', 'BV_CELLS']) {
  const m = thumbSrc.match(new RegExp('window\\.' + table + '\\s*=\\s*(\\{[\\s\\S]*?\\});'));
  if (!m) continue;
  const obj = JSON.parse(m[1]);
  for (const heavy in obj) LIGHT_TO_HEAVY[obj[heavy]] = heavy;
}
const isLight = (p) => Object.prototype.hasOwnProperty.call(LIGHT_TO_HEAVY, p);

/* Body FIRST, then rewrite. <head> is dropped from the bundle — GHL owns the
   title, the meta and the favicon — so rewriting it wastes work and, worse,
   warns loudly about paths (the favicon) that never ship. */
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error('could not find <body> in index.html');
let body = bodyMatch[1];

let htmlMissed = [];
const swapAttr = (attr) => {
  body = body.replace(new RegExp(attr + '="(assets/[^"]+)"', 'g'), (whole, rel) => {
    const u = cdn(rel) || (isLight(rel) ? cdn(LIGHT_TO_HEAVY[rel]) : null);
    if (!u) { htmlMissed.push(rel); return whole; }
    return attr + '="' + u + '"';
  });
};
swapAttr('src');
swapAttr('href');

// the script tags are replaced by the inlined bundle
body = body.replace(/\s*<script src="[^"]+"><\/script>/g, '');

/* The conditional Arabic loader has to go too, and it is an INLINE script so
   the rule above does not catch it. In the standalone site it document.write()s
   js/clients.ar.js only for Arabic readers, which is 62 KB an English reader
   never downloads. Here every script is already inlined, so all it would do is
   document.write a relative path that does not exist on GoHighLevel — a 404 on
   every Arabic load, written into the document mid-parse.

   Scanned rather than matched with a regex: `<script>[^]*?clients\.ar\.js` looks
   right and is not — the lazy quantifier still starts at the FIRST <script> in
   the body, so it deleted every byte from there to the loader. The body came
   out at 0.0 KB. Find the exact block, cut only that. */
function dropInlineScript(html, needle) {
  let i = 0;
  for (;;) {
    const open = html.indexOf('<script>', i);
    if (open < 0) return { html, found: false };
    const close = html.indexOf('</script>', open);
    if (close < 0) return { html, found: false };
    const end = close + '</script>'.length;
    if (html.slice(open, end).includes(needle)) {
      // take an immediately-preceding HTML comment with it
      let start = open;
      const before = html.slice(0, open);
      const m = before.match(/<!--(?:(?!-->)[^])*-->\s*$/);
      if (m) start = open - m[0].length;
      return { html: html.slice(0, start).trimEnd() + '\n' + html.slice(end), found: true };
    }
    i = end;
  }
}
const stripped = dropInlineScript(body, 'clients.ar.js');
body = stripped.html.trimEnd();
if (!stripped.found) {
  console.warn('  ! the conditional clients.ar.js loader was not found to strip —\n' +
    '    check index.html still matches, or it will 404 inside GoHighLevel');
}

/* ---- JS: concatenate in load order --------------------------------------- */
// perf.js comes FIRST: it decides the motion tier before anything is built.
// i18n.js has to sit after the two data files and before beeviro.js, because it
// merges the Arabic records in place and beeviro.js renders from the result.
const ORDER = ['js/perf.js', 'js/media-map.js', 'js/thumb-map.js', 'js/clients.js',
  'js/clients.ar.js', 'js/i18n.js', 'js/beeviro.js', 'js/motion.js', 'js/hive.js'];

// The one context where local files genuinely do not exist. thumb() reads this
// to decide whether an unmapped thumbnail path is a working relative file or a
// 404 waiting to happen.
const embedFlag = '/* ==== embed marker ' + '='.repeat(44) + ' */\nwindow.BV_EMBED = true;\n';

const js = embedFlag + '\n' + ORDER.map((f) =>
  '/* ==== ' + f + ' ' + '='.repeat(Math.max(0, 60 - f.length)) + ' */\n' + read(f)
).join('\n\n');

/* ---- strip the commentary out of the shipped copy ------------------------
   The stylesheet is 40% explanation by weight, and every one of those bytes is
   worth keeping in site/css/beeviro.css — but nobody reads them through a
   GoHighLevel paste box, and they are downloaded on every visit. The source is
   untouched; only the bundle is stripped.

   Hand-written rather than reached for from npm because this repo has no build
   step and no dependencies, and the job is small enough to do exactly: walk the
   file, and skip a comment only when we are not inside a string. Getting that
   wrong would eat a url("...(*...") or a content: "/*". */
function stripCssComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === '\\') { out += src[i + 1] || ''; i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  // Comments leave behind the blank lines they used to sit on.
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

const cssRaw = css;
css = stripCssComments(css);

/* ---- emit ---------------------------------------------------------------- */
const head = '<style>\n' + css + '\n</style>';
const foot = '<script>\n' + js + '\n</script>';

const single =
  '<!-- Beeviro portfolio — generated by build-embed.mjs. Do not hand-edit;\n' +
  '     edit site/ and rebuild. Media resolves to the GHL library CDN. -->\n' +
  head + '\n' + body + '\n' + foot + '\n';

fs.writeFileSync('beeviro-embed.html', single, 'utf8');
fs.mkdirSync('split', { recursive: true });
fs.writeFileSync('split/1-head-css.html', head, 'utf8');
fs.writeFileSync('split/2-body-html.html', body, 'utf8');
fs.writeFileSync('split/3-footer-js.html', foot, 'utf8');

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' KB';
console.log('Built beeviro-embed.html  (' + kb(single) + ')');
console.log('  css stripped of comments: ' + kb(cssRaw) + ' -> ' + kb(css));
console.log('  split/1-head-css.html   (' + kb(head) + ')');
console.log('  split/2-body-html.html  (' + kb(body) + ')');
console.log('  split/3-footer-js.html  (' + kb(foot) + ')');

const missed = [...new Set(cssMissed.concat(htmlMissed))];
if (missed.length) {
  console.log('\n  ! These asset paths are NOT in the media map, so they stay relative');
  console.log('    and will 404 inside GoHighLevel:');
  missed.forEach((m) => console.log('      ' + m));
} else {
  console.log('\n  every asset path resolves to the GHL CDN');
}

// A relative path left in the output is the one thing that breaks inside GHL —
// but only if nothing resolves it. Most of the `assets/...` strings in the
// bundle are arguments to media()/BV_ASSET, i.e. KEYS into the media map, and
// those are meant to survive: they are swapped for a CDN url at runtime.
// So the real fault is a path that is not in the map at all.
const leftovers = [...new Set(
  (single.match(/["'(](?:\.\.\/)?(assets\/[^"')]+)/g) || [])
    .map((s) => s.replace(/^["'(](?:\.\.\/)?/, ''))
)].filter((p) => !MAP[p] && !/base64/.test(p) && !p.endsWith('/')
  // Every light copy — the two work-image tiers, the shrunken reels and the
  // brand marks — is a local-only optimisation until it is uploaded to the
  // media library. thumb() refuses to use an unmapped light path inside the
  // embed (BV_EMBED), so these strings are inert here, not broken links.
  && !isLight(p));
//                                              ^ a trailing slash means the JS
//   builds the rest by concatenation — `media('assets/logos/' + c.logo)` — so
//   the literal is a prefix, not a path, and there is nothing to look up.

if (leftovers.length) {
  console.log('\n  ! asset paths with no entry in the media map — these 404 in GoHighLevel:');
  leftovers.slice(0, 12).forEach((l) => console.log('      ' + l));
  if (leftovers.length > 12) console.log('      … and ' + (leftovers.length - 12) + ' more');
} else {
  console.log('  every ' + Object.keys(MAP).length + '-entry media key resolves at runtime too');
}
