/* Beeviro — the revolving comb in the hero.
   A honeycomb cluster of REAL client work. Six cells play actual client reels;
   the rest hold stills and quietly turn over to new pieces.

   Loaded after clients.js and beeviro.js. If anything here fails the hero is
   still a complete design — the photo, canvas comb and copy stand on their own.

   Three things this file is careful about:

   1. THE NAME IS NOT INSIDE THE HEXAGON. A pointy-top hex tapers to a single
      point at the bottom, which is exactly where a bottom-anchored caption
      sits, so every label was being clipped by the clip-path and long names
      ("SpeakUp English Training") lost whole lines. The readout is a separate
      element outside the 3D context, positioned beside whichever cell is hot.

   2. THE POOL IS CHEAP, NOT NARROW. It used to walk all ~176 gallery images at
      full size, one every 2.6s, so a reader who lingered downloaded the whole
      gallery through the hero. It still walks every client's gallery — 178
      pieces across 22 clients, one client at a time — and nextPiece() skips any
      brand already in another cell, so no client holds two hexagons at once.
      What keeps it cheap is the tier, not the count: cells resolve through
      BV_CELL to 200px WebP, and nothing is fetched until a cell turns over.

   3. NOTHING IS CREATED PER TURN. Each face keeps its <img> for the life of the
      cell and only its `src` changes. */
(function () {
  'use strict';

  var host = document.getElementById('hive3d');
  var tilt = document.getElementById('hiveTilt');
  var lattice = document.getElementById('lattice');
  var read = document.getElementById('hiveRead');
  if (!host || !lattice || !window.BV_CLIENTS) return;

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LITE = !!(window.BV_PERF && window.BV_PERF.lite);
  var RICH = !REDUCED && !LITE;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var T = window.T || function (k) { return k; };
  var C = window.BV_CLIENTS;
  var byslug = {};
  C.forEach(function (c) { byslug[c.slug] = c; });

  // Clients whose reels were transcoded down to cell size. Six looping videos
  // decoding behind a headline is the single most expensive thing on this page,
  // so on the lite tier the comb is all stills — same lattice, same work, no
  // video decoders.
  /* Six of the nineteen cells play a real client reel. Rino's Kitchen came out
     on review — the frame that landed in the comb read as a dish on a dark
     counter and said nothing about the work. MasterCraft went in for it; its
     420px cut was already in the library, only the 288px copy was missing.
     Every slug here needs an entry in small/ (tools/shrink-reels.mjs) or the
     comb streams the full file into a 116px hexagon. */
  var REELS = RICH ? ['freestyle', 'kinetic-health', 'eqbal', 'master-craft', 'daily-box', 'beeviro'] : [];

  // same resolver the rest of the site uses; falls back to the local path
  var asset = window.BV_ASSET || function (p) { return p; };
  // Cells are 92–152px wide, so they take the 200px tier — a 1200px original in
  // a 117px hexagon was ten times the download and ten times the decode, and
  // even the 480px card thumbnail is four times too much here.
  var small = window.BV_CELL || window.BV_THUMB || asset;
  // The reels have their own light copy (300px, tools/shrink-reels.mjs) and it
  // lives in the same table the card thumbnails use.
  var reel = window.BV_THUMB || asset;
  var shot = function (slug, i) {
    return small('assets/work/' + slug + '/' + String(i).padStart(2, '0') + '.jpg');
  };

  /* ---- the pool ---------------------------------------------------------------
     Reviewed as "the cells repeat projects, and the material is not the best we
     have". Both were the same cause: the pool was images 01 and 02 of each
     client — 44 pieces, taken in filename order, for 19 cells that turn over
     every few seconds.
     It now walks each client's WHOLE gallery, still one client at a time, so a
     brand cannot come back until every other brand has had a turn, and every
     piece gets used rather than only whichever two sorted first. That is 178
     pieces across 22 clients. (181 thumbnails exist on disk; three of them are
     Beeviro's own work, which is not a client record and never enters the pool.)
     Still bounded, and still cheap: the cells resolve through BV_CELL to 200px
     WebP, and nothing is fetched until the cell it lands in turns over. */
  // The reference's hero comb shows a brand mark for only a hand-picked
  // 10-slug list — "Keep the strongest marks and use artwork for the rest"
  // (beeviro-embed.html:7619-7622) — not every client BV_CARD_LOGOS knows
  // about; everyone else's cells still show real gallery photos here, same
  // as before this port, and only pick up the mark on their work-grid card.
  // This map is now both that scope gate (its own keys ARE the 10 slugs) and
  // their plate colour, picked for the marks most likely to show a plate
  // edge (transparent PNGs, or artwork not quite square).
  // Keyed black-star, not the reference's block-star — see the matching note
  // on BV_CARD_LOGOS in beeviro.js; the two maps have to agree on the spelling
  // or the gate below never matches a real roster record for this client.
  var LOGO_BG = {
    'black-star': '#fff', 'kinetic-health': '#ededed', 'freestyle': '#000',
    'speakup': '#bde300', 'rinos-kitchen': '#d8bd28', 'cognistar': '#f5f5f5',
    'electro-master': '#f3eadd', 'daily-box': '#fff', 'master-craft': '#000',
    'qr-tably': '#000',
  };
  var pool = [];
  (function buildPool() {
    var withWork = C.filter(function (c) { return c.work; });
    var deepest = 0;
    withWork.forEach(function (c) { if (c.work > deepest) deepest = c.work; });
    for (var depth = 1; depth <= deepest; depth++) {
      for (var b = 0; b < withWork.length; b++) {
        var c = withWork[b];
        if (depth > c.work) continue;
        // A cell prefers the brand's approved mark the first time it turns to
        // this client, but only for the 10 slugs LOGO_BG knows about — see
        // the comment above. Deeper depths, and every other client, keep
        // cycling real gallery work so the pool stays varied.
        var logoSrc = depth === 1 && LOGO_BG.hasOwnProperty(c.slug) && (window.BV_CARD_LOGOS || {})[c.slug];
        if (logoSrc) {
          pool.push({ src: logoSrc, slug: c.slug, logo: true, background: LOGO_BG[c.slug] });
        } else {
          pool.push({ src: shot(c.slug, depth), slug: c.slug });
        }
      }
    }
  })();
  if (!pool.length) return;

  /* ---- cluster geometry -------------------------------------------------------
     Rows of a pointy-top hex cluster. Uneven counts read as a comb fragment
     rather than a rectangle of tiles. */
  var ROWS = [3, 4, 5, 4, 3];

  function cellSize() {
    var w = innerWidth;
    if (w < 700) return 92;
    if (w < 1100) return 108;
    if (w < 1500) return 116;   // narrower cluster: the headline is ~730px here
    return 152;
  }

  var cells = [];
  var poolAt = 0;
  var step = { x: 0, y: 0 };
  /* Nineteen cells drawing from ONE sequential cursor over a pool ordered by
     depth. Widening that pool from 44 pieces to 178 made the cursor take much
     longer to come back round, but it did not change what happens when it does:
     it lands on a brand that is still sitting in another cell, and the comb
     shows the same client twice at once. Cells also turn over on a timer that
     picks one at random, so nothing about WHICH cell is rewritten has any
     relation to what is currently displayed. "The cells repeat projects" is the
     note this whole pass answers, so the pool being bigger is not enough — the
     guard is what makes it true rather than merely unlikely.

     The displayed slugs are read off the live cells every time instead of being
     tracked alongside them: a parallel list is one more thing that can drift out
     of step with what the reader is actually looking at.

     A reel cell never turns over, so its brand is on screen for the life of the
     page. Those are seeded from REELS because during build() the reel cells may
     not have been pushed to `cells` yet, and a still must not double a brand the
     comb is already playing. REELS is empty on the lite tier, where there are no
     reel cells to clash with.

     Bounded to a single lap of the pool. If every brand in it somehow turned out
     to be on screen the cursor gives up and takes whatever is next, so a short
     client list degrades to the old behaviour rather than spinning forever. */
  var nextPiece = function () {
    var onScreen = {};
    for (var r = 0; r < REELS.length; r++) onScreen[REELS[r]] = true;
    for (var i = 0; i < cells.length; i++) onScreen[cells[i].slug] = true;
    for (var seen = 0; seen < pool.length; seen++) {
      var p = pool[poolAt % pool.length];
      poolAt++;
      if (!onScreen[p.slug]) return p;
    }
    var q = pool[poolAt % pool.length];
    poolAt++;
    return q;
  };

  function build() {
    lattice.innerHTML = '';
    cells = [];

    var W = cellSize();
    var H = W * 1.1547;            // pointy-top hexagon
    var stepX = W * 1.02;          // a hair of air between cells
    var stepY = H * 0.755;
    step = { x: stepX, y: stepY };

    /* Which cells get a real client reel.
       The old rule was `(r * 5 + c) % 4 === 1`, which on a 3-4-5-4-3 cluster
       happens to select exactly FIVE cells — so the sixth transcoded reel
       (Beeviro's own, already sitting in the media library) was never placed at
       all. Spreading the slots evenly across the flattened cluster guarantees
       every reel is used and keeps the motion distributed. */
    var total = ROWS.reduce(function (a, b) { return a + b; }, 0);
    var reelSlots = {};
    for (var q = 0; q < REELS.length && q < total; q++) {
      reelSlots[Math.round((q + 0.5) * total / REELS.length)] = REELS[q];
    }

    var k = -1;
    for (var r = 0; r < ROWS.length; r++) {
      var n = ROWS[r];
      var y = (r - (ROWS.length - 1) / 2) * stepY;
      for (var c = 0; c < n; c++) {
        k++;
        var x = (c - (n - 1) / 2) * stepX;

        var btn = document.createElement('button');
        btn.className = 'bv-cellx';
        btn.type = 'button';
        btn.style.width = W + 'px';
        btn.style.height = H + 'px';
        btn.style.left = x + 'px';
        btn.style.top = y + 'px';
        // depth by ring: the middle of the cluster stands proud of the edges
        var ring = Math.abs(r - (ROWS.length - 1) / 2) + Math.abs(c - (n - 1) / 2);
        btn.style.setProperty('--z', (36 - ring * 17).toFixed(0) + 'px');
        btn.style.setProperty('--float', (7 + (r * 1.3 + c * 0.7) % 5).toFixed(1) + 's');
        btn.style.setProperty('--floaty', (-5 - ((r + c) % 4) * 2) + 'px');
        btn.style.setProperty('--fdelay', ((r * 0.4 + c * 0.25) % 3).toFixed(2) + 's');

        var reelSlug = reelSlots[k];
        var rec = reelSlug
          ? {
              slug: reelSlug,
              video: reel('assets/hero/reels/' + reelSlug + '.webm'),
              videoFull: asset('assets/hero/reels/' + reelSlug + '.webm'),
            }
          : nextPiece();

        var faceA = document.createElement('span');
        faceA.className = 'bv-cellx__a';
        faceA.appendChild(makeMedia(rec));
        btn.appendChild(faceA);

        // The back face carries a permanent <img> so a turn only rewrites src.
        var faceB = document.createElement('span');
        faceB.className = 'bv-cellx__b';
        if (!rec.video) faceB.appendChild(makeMedia({ src: '' }));
        btn.appendChild(faceB);

        btn.setAttribute('data-slug', rec.slug);
        btn.setAttribute('data-cursor', T('card.open'));
        btn.setAttribute('aria-label', nameOf(rec.slug));
        // Out of the tab order on purpose. Nineteen of these sit between the
        // masthead and the first line of copy, and the work they open is the
        // SAME dossier reachable from the twenty-five cards in Work — which are
        // properly labelled, ordered and keyboard-operable. Keeping them as tab
        // stops would cost a keyboard reader nineteen presses to reach the page
        // and gain them nothing they cannot already do downstairs. The cells
        // stay in the accessibility tree with their labels, so they are still
        // announced in browse mode; they simply are not a stop.
        btn.tabIndex = -1;

        lattice.appendChild(btn);
        cells.push({
          el: btn, x: x, y: y, r: r, c: c,
          isReel: !!rec.video, front: true, slug: rec.slug,
          a: faceA, b: faceB,
        });
      }
    }
  }

  /* One of the six reels is Beeviro's OWN showreel, and 'beeviro' is not a
     client slug — so that cell used to be labelled with the raw lowercase slug
     and clicking it silently did nothing (openCase finds no match and returns).
     It is real Beeviro footage and deserves to be in the comb, so it gets its
     own record and sends the reader to the work instead of to a dossier. */
  var SELF = {
    slug: 'beeviro',
    name: 'Beeviro',
    industry: T('hive.self'),
    accent: '#ffc202',
    outcome: { headline: T('hive.selfLine') },
    go: function () {
      var w = document.getElementById('work');
      if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
  function recordFor(slug) { return slug === SELF.slug ? SELF : byslug[slug]; }

  function nameOf(slug) {
    var c = recordFor(slug);
    return c ? c.name : slug;
  }

  /* ---- video, without handing it to a download manager -----------------------
     REPORTED: "if you have a downloader like Neat Download Manager or IDM it
     will detect the videos and ask if you want to download". That is what those
     tools are for — they watch for a media element pointing at a media URL and
     offer to grab it. Two problems with that here: the pop-up interrupts a
     reader who only wanted to look at a portfolio, and these are the clients'
     campaign films, not downloads on offer.

     The fix is to stop the video ever being a media URL the browser navigates
     to. The file is pulled with fetch() — page data, which download managers do
     not intercept — and handed to the element as a blob: URL, which is local to
     the document and cannot be re-requested from outside it. If the fetch fails
     (a CDN without CORS, an offline reader) it falls back to the direct src, so
     the comb never loses its motion over this.

     Everything else here is the same defence one layer down: no <source>, no
     controls, no picture-in-picture, no download item in any menu. */
  var blobs = {};

  /* The six reels are about 2 MB together, and pulling them all at once while
     the browser is still laying out the page is a large part of why the site
     felt heavy on arrival. They are queued instead: nothing starts until the
     boot screen has lifted, and then one at a time, so the hero has its stills
     and its type long before the first frame of video arrives. */
  var queue = [];
  var pumping = false;

  function pump() {
    if (pumping || !queue.length) return;
    /* Nothing is fetched while the comb is off screen. A reader who lands and
       scrolls straight to the work used to pay for six videos they never saw;
       now the queue simply stalls, and resumes from where it stopped if they
       come back up. `visible` is maintained by the hero IntersectionObserver at
       the bottom of this file, which also restarts the pump. */
    if (!visible || document.hidden) return;
    pumping = true;
    var job = queue.shift();
    fetch(job.url, { credentials: 'omit', mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (b) {
        blobs[job.url] = URL.createObjectURL(b);
        job.v.src = blobs[job.url];
      })
      // A CDN without CORS, an offline reader, or a shrunken copy that was never
      // generated. Hand the element the full-size reel and let it play normally —
      // heavier, but the comb keeps its motion rather than showing a dead cell.
      .catch(function () { job.v.src = job.full; })
      .then(function () { pumping = false; setTimeout(pump, 220); });
  }

  function startQueue() {
    if (document.documentElement.classList.contains('is-booted')) { pump(); return; }
    // The boot sequence has its own 4.2s failsafe, so this cannot wait forever.
    var t = setInterval(function () {
      if (!document.documentElement.classList.contains('is-booted')) return;
      clearInterval(t);
      pump();
    }, 200);
    setTimeout(function () { clearInterval(t); pump(); }, 5000);
  }

  function attachVideo(v, url, full) {
    // A resize rebuilds the lattice, so the second time round the blob is
    // already made and the cell fills instantly with no network at all.
    if (blobs[url]) { v.src = blobs[url]; return; }
    queue.push({ v: v, url: url, full: full || url });
    if (document.documentElement.classList.contains('is-booted')) pump();
  }

  function makeMedia(rec) {
    if (rec.video) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.autoplay = true;
      v.playsInline = true; v.setAttribute('playsinline', '');
      v.preload = 'auto';
      v.disablePictureInPicture = true;
      // same iOS-only path as the dossier film; see BV_NO_FULLSCREEN in beeviro.js
      window.BV_NO_FULLSCREEN && window.BV_NO_FULLSCREEN(v);
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback nofullscreen');
      v.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      v.addEventListener('canplay', function () {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
      attachVideo(v, rec.video, rec.videoFull);
      return v;
    }
    var img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    if (rec.src) img.src = rec.src;
    if (rec.logo) { img.classList.add('bv-hero-logo'); img.style.setProperty('--logo-bg', rec.background); }
    return img;
  }

  /* ---- the readout ------------------------------------------------------------
     One shared panel, OUTSIDE the lattice and outside the 3D context, so it is
     never clipped by a hexagon and never sheared by the revolve. Positioned
     beside the hot cell, flipping side and clamping vertically to stay on
     screen — which is what makes a 24-character client name possible at all. */
  var readName = read && read.querySelector('.bv-hive__read-n');
  var readSec = read && read.querySelector('.bv-hive__read-s');
  var readOut = read && read.querySelector('.bv-hive__read-o');
  var readGo = read && read.querySelector('.bv-hive__read-go b');

  function showRead(cell) {
    if (!read) return;
    var c = recordFor(cell.slug);
    if (!c) return;
    readName.textContent = c.name;
    readSec.textContent = c.industry;
    readOut.textContent = c.outcome ? c.outcome.headline : '';
    read.style.setProperty('--a', c.accent || 'var(--honey)');
    read.classList.toggle('is-self', c === SELF);
    // Beeviro's own showreel has no dossier — it must not promise a case. Set
    // in JS rather than a CSS ::before so it exists in both languages.
    if (readGo) readGo.textContent = T(c === SELF ? 'hive.selfCta' : 'card.open');

    // measure after the text is in, so the panel's own height is current
    read.classList.add('is-on');
    var r = cell.el.getBoundingClientRect();
    var p = read.getBoundingClientRect();
    var gap = 14;

    var left = r.right + gap;
    if (left + p.width > innerWidth - 16) left = r.left - gap - p.width;
    if (left < 16) left = Math.min(innerWidth - p.width - 16, Math.max(16, r.left));

    var top = r.top + r.height / 2 - p.height / 2;
    top = Math.max(78, Math.min(innerHeight - p.height - 16, top));

    read.style.transform = 'translate3d(' + Math.round(left) + 'px,' + Math.round(top) + 'px,0)';
  }
  function hideRead() { if (read) read.classList.remove('is-on'); }

  /* ---- hover: lift the cell, push its neighbours out of the way ---------------
     The comb should behave like a physical thing. Pointing at a cell nudges the
     ring around it away and dims it, so the hot cell reads as pulled forward out
     of the sheet rather than just scaled up in place. Written once per hover as
     custom properties — CSS does the easing, so there is no per-frame work. */
  var hot = null;

  function setHot(cell) {
    if (cell === hot) return;
    if (hot) clearHot();
    hot = cell;
    if (!cell) { hideRead(); return; }

    cell.el.classList.add('is-hot');
    var reach = step.x * 1.35;

    for (var i = 0; i < cells.length; i++) {
      var o = cells[i];
      if (o === cell) continue;
      var dx = o.x - cell.x, dy = o.y - cell.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach || d === 0) continue;
      var f = (1 - d / reach) * 13;                 // px of push, strongest adjacent
      o.el.style.setProperty('--px', (dx / d * f).toFixed(1) + 'px');
      o.el.style.setProperty('--py', (dy / d * f).toFixed(1) + 'px');
      o.el.classList.add('is-near');
    }
    showRead(cell);
  }

  function clearHot() {
    if (hot) hot.el.classList.remove('is-hot');
    for (var i = 0; i < cells.length; i++) {
      var o = cells[i];
      if (!o.el.classList.contains('is-near')) continue;
      o.el.classList.remove('is-near');
      o.el.style.removeProperty('--px');
      o.el.style.removeProperty('--py');
    }
    hot = null;
  }

  lattice.addEventListener('pointerover', function (e) {
    var el = e.target.closest && e.target.closest('.bv-cellx');
    if (!el) return;
    var cell = cells.filter(function (c) { return c.el === el; })[0];
    if (cell) { stopPulse(); setHot(cell); }
  });
  lattice.addEventListener('pointerleave', function () { clearHot(); hideRead(); });

  /* ---- the cluster leans toward the pointer ----------------------------------
     Blended on a WRAPPER, never on the lattice itself: the lattice carries the
     `bv-revolve` CSS animation, and a running animation outranks an inline
     transform, so writing to it would be silently ignored. */
  var lean = { x: 0, y: 0, tx: 0, ty: 0 };
  var leaning = false, visible = true;

  function onMove(e) {
    if (!FINE || !RICH || !tilt) return;
    // -1..1 from the centre of the viewport
    lean.tx = (e.clientX / innerWidth - 0.5) * 2;
    lean.ty = (e.clientY / innerHeight - 0.5) * 2;
    if (!leaning) { leaning = true; requestAnimationFrame(leanStep); }
  }

  function leanStep() {
    lean.x += (lean.tx - lean.x) * 0.06;
    lean.y += (lean.ty - lean.y) * 0.06;
    // small angles: the revolve is already doing ±19°, this is a nudge on top
    tilt.style.transform =
      'rotateY(' + (lean.x * 7).toFixed(2) + 'deg) rotateX(' + (-lean.y * 5).toFixed(2) + 'deg)';
    if (visible && (Math.abs(lean.tx - lean.x) > 0.001 || Math.abs(lean.ty - lean.y) > 0.001)) {
      requestAnimationFrame(leanStep);
    } else {
      leaning = false;
    }
  }
  if (FINE && !REDUCED) addEventListener('pointermove', onMove, { passive: true });

  /* ---- idle pulse -------------------------------------------------------------
     Every few seconds a highlight walks a short path from cell to neighbouring
     cell, like honey moving through the comb. It is the thing that tells a
     reader these are touchable before they ever point at one. Cancelled the
     moment they do. */
  var pulseTimer = null, pulseWalk = null, lit = [];

  function neighbours(cell) {
    var reach = step.x * 1.35;
    return cells.filter(function (o) {
      if (o === cell) return false;
      var dx = o.x - cell.x, dy = o.y - cell.y;
      return Math.sqrt(dx * dx + dy * dy) <= reach;
    });
  }

  function stopPulse() {
    clearTimeout(pulseWalk); pulseWalk = null;
    lit.forEach(function (c) { c.el.classList.remove('is-pulse'); });
    lit = [];
  }

  function runPulse() {
    if (!RICH || hot || !visible || document.hidden) return;
    var cell = cells[Math.floor(Math.random() * cells.length)];
    var hops = 4;
    (function hop() {
      if (hot || !visible) { stopPulse(); return; }
      cell.el.classList.add('is-pulse');
      lit.push(cell);
      var c = cell;
      setTimeout(function () {
        c.el.classList.remove('is-pulse');
        lit = lit.filter(function (x) { return x !== c; });
      }, 620);
      if (--hops <= 0) return;
      var ns = neighbours(cell).filter(function (n) { return lit.indexOf(n) < 0; });
      if (!ns.length) return;
      cell = ns[Math.floor(Math.random() * ns.length)];
      pulseWalk = setTimeout(hop, 180);
    })();
  }

  function startPulse() {
    if (!RICH) return;
    stopPulseTimer();
    pulseTimer = setInterval(runPulse, 6400);
  }
  function stopPulseTimer() { if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; } stopPulse(); }

  /* ---- turn cells over to new work ------------------------------------------ */
  var turnTimer = null;
  function startTurning() {
    if (!RICH) return;
    stopTurning();
    turnTimer = setInterval(function () {
      // never disturb a reel, and never turn the cell being pointed at
      var candidates = cells.filter(function (c) { return !c.isReel && c !== hot; });
      if (!candidates.length) return;
      var cell = candidates[Math.floor(Math.random() * candidates.length)];
      var rec = nextPiece();

      // Reuse the face's existing <img>; only the src changes. Creating a new
      // element every 2.6s for the life of the page is pure churn.
      var incoming = cell.front ? cell.b : cell.a;
      var img = incoming.querySelector('img');
      if (!img) { img = makeMedia({ src: '' }); incoming.appendChild(img); }
      img.src = rec.src;
      img.classList.toggle('bv-hero-logo', !!rec.logo);
      img.style.setProperty('--logo-bg', rec.background || '#0a0909');

      cell.slug = rec.slug;
      cell.el.setAttribute('data-slug', rec.slug);
      cell.el.setAttribute('aria-label', nameOf(rec.slug));

      cell.el.classList.toggle('is-turning');
      cell.front = !cell.front;
    }, 2600);
  }
  function stopTurning() { if (turnTimer) { clearInterval(turnTimer); turnTimer = null; } }

  /* ---- open the case a cell belongs to -------------------------------------- */
  lattice.addEventListener('click', function (e) {
    var cell = e.target.closest('.bv-cellx');
    if (!cell) return;
    var slug = cell.getAttribute('data-slug');
    if (!slug) return;
    // a beat of honey before the dossier grows out of the cell
    cell.classList.add('is-firing');
    setTimeout(function () { cell.classList.remove('is-firing'); }, 420);

    if (slug === SELF.slug) { SELF.go(); return; }
    if (window.BV_OPEN_CASE) window.BV_OPEN_CASE(slug, cell);
  });

  /* ---- lifecycle ------------------------------------------------------------ */
  build();
  setTimeout(function () { host.classList.add('is-in'); }, 60);
  startQueue();                  // video only after the boot screen is out of the way
  startTurning();
  startPulse();

  // Stop the whole thing when the hero is off screen, and while a picture is
  // enlarged — 20-odd cells and six videos have no business running unseen.
  var hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        visible = en.isIntersecting;
        var vids = lattice.querySelectorAll('video');
        if (visible) {
          startTurning();
          startPulse();
          pump();                       // resume any reels the reader scrolled past
          Array.prototype.forEach.call(vids, function (v) {
            var p = v.play(); if (p && p.catch) p.catch(function () {});
          });
        } else {
          stopTurning();
          stopPulseTimer();
          clearHot();
          hideRead();
          Array.prototype.forEach.call(vids, function (v) { v.pause(); });
        }
      });
    }, { threshold: 0.05 }).observe(hero);
  }

  // A background tab should cost nothing at all.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopTurning(); stopPulseTimer(); }
    else if (visible) { startTurning(); startPulse(); }
  });

  /* Neither should a comb sitting behind an open dossier. This is the same
     situation as the hero being scrolled away — the reader cannot see it — but
     the IntersectionObserver above never fires for it, because the hero has not
     moved: something was simply drawn on top of it. So the comb kept
     oscillating and six videos kept decoding behind a full-screen overlay.
     `covered` is tracked separately from `visible` so that closing the dossier
     restores exactly what was running before it opened, rather than starting
     the comb up while the reader is scrolled half a page down. */
  var coveredNow = false;
  document.addEventListener('bv:cover', function (e) {
    var on = !!(e.detail && e.detail.covered);
    if (on === coveredNow) return;
    coveredNow = on;
    var vids = lattice.querySelectorAll('video');
    if (on) {
      stopTurning(); stopPulseTimer(); clearHot(); hideRead();
      Array.prototype.forEach.call(vids, function (v) { v.pause(); });
    } else if (visible && !document.hidden) {
      startTurning(); startPulse(); pump();
      Array.prototype.forEach.call(vids, function (v) {
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
    }
  });

  var rebuild = null;
  addEventListener('resize', function () {
    clearTimeout(rebuild);
    rebuild = setTimeout(function () {
      clearHot();
      hideRead();
      build();
      host.classList.add('is-in');
      startTurning();
      startPulse();
    }, 260);
  });
})();
