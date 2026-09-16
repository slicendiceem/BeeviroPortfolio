/* Harvest GHL media ids — PASTE THIS INTO THE BROWSER CONSOLE.
 *
 * This is the one step in the pipeline that cannot run from here: the media
 * library is behind your GoHighLevel login, so it has to run in a browser that
 * is already signed in.
 *
 *   1. Open https://app.revenuelab360.com/v2/location/PWyhncZ0y766gD1TL1PO/media-storage
 *   2. Make sure you are looking at the folder the files are in, in LIST or GRID
 *      view — whichever shows filenames.
 *   3. F12 → Console → paste this whole file → Enter.
 *   4. It scrolls the library on its own and prints a running count. When it
 *      stops it downloads `bv-media-ids.json` to your Downloads folder.
 *   5. Tell me, and I will wire the ids into site/js/media-map.js.
 *
 * It only READS. It never uploads, renames, moves or deletes anything.
 *
 * Two ways of collecting, run together, because neither is reliable alone:
 *
 *   NETWORK — hooks fetch/XHR and reads the library's own API responses. This
 *   is the accurate one: the response carries the exact CDN url, so there is no
 *   guessing at file extensions. It only sees requests made AFTER the paste,
 *   which is why the script scrolls.
 *
 *   DOM — reads the tiles already on screen. The media id is the tile element's
 *   `id`, and the filename is in its `img[alt]`. Never read the img `src`: for
 *   a video that is GoHighLevel's generated poster frame, so the reels would
 *   map to still images.
 */
(async () => {
  /* Kept on `window` so repeated runs ACCUMULATE. If the totals come up short,
     type a prefix into the library's search box (`bv-t-`, `bv-c-`, `bv-l-`,
     `bv-reel-sm-`) and paste this again — search reaches inside folders, and
     each pass adds to the same table rather than starting over. */
  const FOUND = window.__bvFound || (window.__bvFound = new Map());
  const OID = /^[0-9a-f]{24}$/i;

  const note = (name, tail) => {
    if (!name || !tail) return;
    if (!FOUND.has(name)) FOUND.set(name, tail);
  };

  /* ---- 1. read the library's own API responses ---------------------------- */
  // Anything shaped like a media record: a name, and a url or an id.
  function harvestJson(obj, depth = 0) {
    if (!obj || depth > 6) return;
    if (Array.isArray(obj)) { obj.forEach((o) => harvestJson(o, depth + 1)); return; }
    if (typeof obj !== 'object') return;

    const name = obj.name || obj.fileName || obj.originalName;
    const url = obj.url || obj.publicUrl || obj.link;
    const id = obj._id || obj.id;
    if (name) {
      if (url && /\/media\//.test(url)) note(name, String(url).split('/media/').pop().split('?')[0]);
      else if (id && OID.test(String(id))) {
        const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [, ''])[1];
        note(name, ext ? id + '.' + ext : id);
      }
    }
    Object.keys(obj).forEach((k) => harvestJson(obj[k], depth + 1));
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const u = String((args[0] && args[0].url) || args[0] || '');
      if (/medias|media|files/i.test(u)) {
        res.clone().json().then(harvestJson).catch(() => {});
      }
    } catch (e) { /* never break the page */ }
    return res;
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener('load', () => {
      try {
        if (typeof this.responseText === 'string' && this.responseText[0] === '{') {
          harvestJson(JSON.parse(this.responseText));
        }
      } catch (e) { /* not json, or not ours */ }
    });
    return origSend.apply(this, a);
  };

  /* ---- 2. read whatever is already on screen ------------------------------ */
  function harvestDom() {
    document.querySelectorAll('[id]').forEach((el) => {
      const id = el.id;
      if (!OID.test(id)) return;
      const img = el.querySelector('img[alt]');
      let name = img && img.alt;
      if (!name) {
        const t = el.querySelector('[title]');
        name = t && t.getAttribute('title');
      }
      if (!name || !/\.[a-z0-9]{2,5}$/i.test(name)) return;
      const ext = name.match(/\.([a-z0-9]+)$/i)[1];
      note(name, id + '.' + ext);
    });
  }

  /* ---- 3. scroll until nothing new turns up ------------------------------- */
  // The grid virtualises: roughly ten rows exist at a time and the rest are
  // only built as they come near. Whichever element is actually scrolling, this
  // finds it by looking for the tallest overflowing box on the page.
  function scroller() {
    let best = document.scrollingElement;
    let bestScore = best.scrollHeight - best.clientHeight;
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el).overflowY;
      if (s !== 'auto' && s !== 'scroll') return;
      const score = el.scrollHeight - el.clientHeight;
      if (score > bestScore) { best = el; bestScore = score; }
    });
    return best;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = scroller();
  console.log('%cBeeviro — harvesting media ids…', 'color:#ffc202;font-weight:bold');
  console.log('scrolling', box === document.scrollingElement ? 'the page' : box);

  let stale = 0;
  let last = 0;
  for (let i = 0; i < 400 && stale < 6; i++) {
    harvestDom();
    if (FOUND.size === last) stale++; else { stale = 0; last = FOUND.size; }
    box.scrollTop = Math.min(box.scrollTop + Math.max(400, box.clientHeight * 0.8),
      box.scrollHeight);
    await sleep(450);
    if (i % 5 === 0) console.log('  ' + FOUND.size + ' files so far…');
  }
  harvestDom();

  /* ---- 4. hand it back ---------------------------------------------------- */
  const out = {};
  [...FOUND.keys()].sort().forEach((k) => { out[k] = FOUND.get(k); });

  const groups = { thumb: 0, cell: 0, light: 0, reelSmall: 0, other: 0 };
  Object.keys(out).forEach((n) => {
    if (/^bv-t-/.test(n)) groups.thumb++;
    else if (/^bv-c-/.test(n)) groups.cell++;
    else if (/^bv-l-/.test(n)) groups.light++;
    else if (/^bv-reel-sm-/.test(n)) groups.reelSmall++;
    else groups.other++;
  });

  console.log('%cdone — ' + Object.keys(out).length + ' files',
    'color:#ffc202;font-weight:bold');
  console.table(groups);
  console.log('expected from the light batch: 181 thumb, 181 cell, 10 light, 6 reel-sm');

  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bv-media-ids.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log('saved to your Downloads as bv-media-ids.json');

  window.BV_HARVEST = out;          // in case the download is blocked
  return Object.keys(out).length;
})();
