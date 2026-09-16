/* One place that knows how to write site/js/thumb-map.js.
 *
 * Three tools contribute to that file — make-thumbs.mjs (card and comb tiers),
 * shrink-reels.mjs (the hero videos) and squeeze.mjs (brand marks and the hero
 * photograph) — and each of them used to rewrite it wholesale. Running them in
 * the wrong order silently deleted another tool's table: shrink-reels dropped
 * BV_CELLS, the hero comb fell back to full-size originals, and the page went
 * from 1.4 MB to 3.2 MB with nothing in the diff to explain it.
 *
 * So writing is a merge, per table, and every tool goes through here.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const HEADER = `/* GENERATED — do not edit by hand.
   Heavy original -> light display copy, written by three tools:
     tools/make-thumbs.mjs   the 480px card tier and the 200px comb-cell tier
     tools/shrink-reels.mjs  the shrunken hero reels
     tools/squeeze.mjs       brand marks, the favicon and the hero photograph

     BV_THUMBS  everything shown at up to ~480px: work cards, carousel tiles,
                logos, hero stills, and the reels.
     BV_CELLS   the 200px tier, for the hero comb's 92-152px hexagons.

   Anything missing from either table falls back to the full-size original, so a
   partial run is safe and a failed one changes nothing. */
`;

async function read(file) {
  if (!existsSync(file)) return { BV_THUMBS: {}, BV_CELLS: {} };
  const txt = await readFile(file, 'utf8');
  const grab = (name) => {
    const m = txt.match(new RegExp('window\\.' + name + '\\s*=\\s*(\\{[\\s\\S]*?\\});'));
    if (!m) return {};
    try { return JSON.parse(m[1]); } catch { return {}; }
  };
  return { BV_THUMBS: grab('BV_THUMBS'), BV_CELLS: grab('BV_CELLS') };
}

/* `patch` is { BV_THUMBS?: {...}, BV_CELLS?: {...} }. Keys are merged over what
   is already there — a tool only ever adds or refreshes its own entries, and
   never has to know what the other two wrote. */
export async function mergeMap(file, patch) {
  const cur = await read(file);
  const out = {
    BV_THUMBS: Object.assign({}, cur.BV_THUMBS, patch.BV_THUMBS || {}),
    BV_CELLS: Object.assign({}, cur.BV_CELLS, patch.BV_CELLS || {}),
  };
  await writeFile(file, HEADER +
    'window.BV_THUMBS = ' + JSON.stringify(out.BV_THUMBS) + ';\n' +
    'window.BV_CELLS = ' + JSON.stringify(out.BV_CELLS) + ';\n');
  return { thumbs: Object.keys(out.BV_THUMBS).length, cells: Object.keys(out.BV_CELLS).length };
}

/* Drop every key whose light path starts with `prefix`, then merge. For a tool
   that owns a whole folder and needs a deleted source to disappear from the map
   rather than linger as a broken reference. */
export async function replaceMap(file, prefix, patch) {
  const cur = await read(file);
  const keep = (t) => {
    const o = {};
    for (const k in t) if (!String(t[k]).startsWith(prefix)) o[k] = t[k];
    return o;
  };
  const out = {
    BV_THUMBS: Object.assign(keep(cur.BV_THUMBS), patch.BV_THUMBS || {}),
    BV_CELLS: Object.assign(keep(cur.BV_CELLS), patch.BV_CELLS || {}),
  };
  await writeFile(file, HEADER +
    'window.BV_THUMBS = ' + JSON.stringify(out.BV_THUMBS) + ';\n' +
    'window.BV_CELLS = ' + JSON.stringify(out.BV_CELLS) + ';\n');
  return { thumbs: Object.keys(out.BV_THUMBS).length, cells: Object.keys(out.BV_CELLS).length };
}
