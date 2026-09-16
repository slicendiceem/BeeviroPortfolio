// Flatten every shipped media file to a UNIQUE name for GHL, which discards
// folder paths on upload. Writes a manifest mapping site path -> upload name.
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'site/assets';
const OUT  = 'upload-staging';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const map = [];               // { sitePath, uploadName, bytes }
const add = (src, name, sub) => {
  const dir = sub ? path.join(OUT, sub) : OUT;
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, name));
  map.push({ sitePath: src.split(path.sep).join(String.fromCharCode(47)).replace(/^site./, String()),
             uploadName: name, bytes: fs.statSync(src).size });
};

/* THE LIGHT COPIES GO IN THEIR OWN SUB-FOLDER — the small copies the page
   substitutes for something heavier:
     work/<slug>/thumb/NN.webp   480px, work cards and carousel tiles
     work/<slug>/cell/NN.webp    200px, the hero comb's hexagons
     hero/reels/small/*.webm     288px, and ONLY for the six reels the comb
                                 plays; a dossier film is watched at 420px in a
                                 420px block and has no light copy at all
     hero/reels/poster/*.webp    the film poster for a client with no gallery
     light/*.webp                brand marks and the hero photograph
   Together they take a cold load from 3.5 MB to 0.86 MB. Until they are in the
   media library the HOSTED site keeps serving 1200px originals into 200px boxes
   and 420px video into 120px cells, which is exactly what the reviewers called
   heavy — the local build is already fast, the deployed one is not.
   NOTE the full-size reels outside this folder are DISPLAYED too, in the case
   files, so they are not optional extras — an unmapped one is a dead play
   button.
   Their own folder so this batch can be uploaded on its own, without hunting
   through the files that are already up there. */
const LIGHT = '_light';
for (const slug of fs.readdirSync(path.join(SITE, 'work'))) {
  const dir = path.join(SITE, 'work', slug);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    add(path.join(dir, f), `bv-${slug}-${f}`);
  }
  for (const [sub, prefix] of [['thumb', 'bv-t'], ['cell', 'bv-c']]) {
    const tdir = path.join(dir, sub);
    if (!fs.existsSync(tdir)) continue;
    for (const f of fs.readdirSync(tdir).sort()) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      add(path.join(tdir, f), `${prefix}-${slug}-${f}`, LIGHT);
    }
  }
}
// brand marks and hero photographs, recompressed by tools/squeeze.mjs
const lightDir = path.join(SITE, 'light');
if (fs.existsSync(lightDir)) for (const f of fs.readdirSync(lightDir).sort())
  if (/\.(webp|png)$/i.test(f)) add(path.join(lightDir, f), `bv-l-${f}`, LIGHT);

// hero reels: assets/hero/reels/<slug>.webm -> bv-reel-<slug>.webm
const reels = path.join(SITE, 'hero', 'reels');
if (fs.existsSync(reels)) for (const f of fs.readdirSync(reels).sort())
  if (/\.webm$/i.test(f)) add(path.join(reels, f), `bv-reel-${f}`);
const smallReels = path.join(reels, 'small');
if (fs.existsSync(smallReels)) for (const f of fs.readdirSync(smallReels).sort())
  if (/\.webm$/i.test(f)) add(path.join(smallReels, f), `bv-reel-sm-${f}`, LIGHT);
/* Film posters. Only clients whose ENTIRE engagement was video have one — every
   other dossier borrows its first gallery image — so this folder holds one file
   and is easy to forget. Forgetting it means the one dossier that has nothing
   else to show is the one that 404s in the hosted build. */
const reelPosters = path.join(reels, 'poster');
if (fs.existsSync(reelPosters)) for (const f of fs.readdirSync(reelPosters).sort())
  if (/\.(webp|jpe?g|png)$/i.test(f)) add(path.join(reelPosters, f), `bv-reel-poster-${f}`, LIGHT);
// hero stills
for (const f of fs.readdirSync(path.join(SITE, 'hero')).sort())
  if (/\.(jpe?g|png)$/i.test(f)) add(path.join(SITE, 'hero', f), `bv-hero-${f}`);
// logos
for (const f of fs.readdirSync(path.join(SITE, 'logos')).sort())
  if (/\.(jpe?g|png)$/i.test(f)) add(path.join(SITE, 'logos', f), `bv-logo-${f}`);

fs.writeFileSync(path.join(OUT, '_manifest.json'), JSON.stringify(map, null, 1));

const names = map.map(m => m.uploadName);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
const total = map.reduce((a, b) => a + b.bytes, 0);
console.log('staged      :', map.length, 'files');
console.log('duplicates  :', dupes.length ? dupes.join(', ') : 'none');
console.log('total size  :', (total / 1048576).toFixed(1) + 'MB');
console.log('largest     :', map.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,3)
  .map(m => m.uploadName + ' ' + (m.bytes/1024).toFixed(0) + 'KB').join(', '));
console.log('\nsample:');
map.slice(0, 3).concat(map.slice(-4)).forEach(m =>
  console.log('  ' + m.sitePath.padEnd(38) + ' -> ' + m.uploadName));
