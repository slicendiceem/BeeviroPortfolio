/* Beeviro portfolio — behaviour.
   Plain ES2019, no dependencies, works from file:// as well as a server. */
(function () {
  'use strict';

  /* Sorted once, here, rather than at each of the four places that walk the list
     — the grid, the dossier's prev/next, the carousel and the hero comb all have
     to agree on what "case 3 of 25" means. hive.js reads window.BV_CLIENTS
     directly and gets the sorted array because this mutates in place. */
  var C = window.BV_CLIENTS || [];
  (function applyOrder() {
    var order = window.BV_ORDER;
    if (!order || !order.length) return;
    var rank = {};
    for (var i = 0; i < order.length; i++) rank[order[i]] = i;
    var at = function (c) {
      return rank[c.slug] == null ? order.length + C.indexOf(c) : rank[c.slug];
    };
    var keyed = C.map(function (c, i) { return { c: c, k: at(c), i: i }; });
    keyed.sort(function (a, b) { return a.k - b.k || a.i - b.i; });
    for (var j = 0; j < keyed.length; j++) C[j] = keyed[j].c;
  })();
  var STAGES = window.BV_STAGES || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* Set first: the CSS that fades a tile in hides it until this class exists,
     so a reader whose scripts never ran gets the plain page instead of a grid
     of blank boxes. Anything below can now assume JS is live.
     `load` does not bubble, but it does capture — one listener covers every
     image on the page, including the ~350 that lazy-load later. */
  document.documentElement.classList.add('bv-js');
  document.addEventListener('load', function (e) {
    var n = e.target;
    if (!n || n.tagName !== 'IMG') return;
    n.classList.add('is-loaded');
    // stop the shimmer on whichever frame this image fills
    var host = n.closest('.bv-tile, .bv-gal__t, .bv-card__img');
    if (host) host.classList.add('is-loaded');
  }, true);

  var el = function (t, cls, html) {
    var n = document.createElement(t);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  // Resolve what was clicked on a strip that may have been moving. A click's
  // target is the common ancestor of press and release, so on a travelling
  // carousel it can land on the container — fall back to hit-testing the point.
  var hitAt = function (e, sel, root) {
    var t = e.target.closest(sel);
    if (t) return t;
    var under = document.elementFromPoint(e.clientX, e.clientY);
    var hit = under && under.closest(sel);
    return hit && (!root || root.contains(hit)) ? hit : null;
  };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  /* Arabic paragraphs reorder the numbers inside them.
   *
   * "~1.15 مليون" renders as "1.15~ مليون": the tilde is bidi-neutral, so in a
   * right-to-left paragraph it takes the paragraph's direction and crosses to
   * the far side of the number it modifies. "9–13.2" comes out "13.2–9" — a
   * range reading backwards. A reviewer screenshotted both and said the case
   * files were not understandable; they were not, because the figures in them
   * were inverted.
   *
   * A TECHNICAL RUN is a maximal stretch with no Arabic letters that carries at
   * least one digit or Latin letter. Wrapping it in an element with an explicit
   * direction isolates it: the bidi algorithm resolves the run on its own and
   * places the result as a single unit in the sentence.
   *
   * Runs containing Arabic are left alone — clients.ar.js may translate a metric
   * value, and forcing that one left-to-right would be the same bug mirrored.
   *
   * Tokenise the RAW string and escape each piece, rather than escaping first:
   * "&amp;" is Latin letters and would otherwise be wrapped as a technical run.
   *
   * The ranges are written as \u escapes on purpose. Spelled with literal Arabic
   * characters this class ends at U+FEFF, which is also the byte-order mark — an
   * editor that normalises it silently widens the class to everything. */
  var ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  function bidi(s) {
    s = String(s == null ? '' : s);
    if (!/[0-9A-Za-z]/.test(s)) return esc(s);
    var out = '';
    var run = '';
    function flush() {
      if (!run) return;
      // Trailing spaces belong to the sentence, not to the run.
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(run);
      var lead = m[1], core = m[2], tail = m[3];
      if (/[0-9A-Za-z]/.test(core) && core.length > 1) {
        out += esc(lead) + '<span dir="ltr">' + esc(core) + '</span>' + esc(tail);
      } else {
        out += esc(run);
      }
      run = '';
    }
    for (var i = 0; i < s.length; i++) {
      if (ARABIC_RE.test(s.charAt(i))) { flush(); out += esc(s.charAt(i)); }
      else run += s.charAt(i);
    }
    flush();
    return out;
  }
  /* Resolve an asset through the GHL media map when js/media-map.js is loaded,
     otherwise return the local relative path. That way the same build runs
     locally with no map and inside GHL with one — nothing else has to change. */
  var MEDIA = window.BV_MEDIA || {};
  var MEDIA_BASE = window.BV_MEDIA_BASE || '';
  function media(p) {
    if (!p) return '';
    if (/^(https?:)?\/\/|^data:/i.test(p)) return p;
    var id = MEDIA[p];
    if (!id) return p;
    return /^(https?:)?\/\//i.test(id) ? id : MEDIA_BASE + id;
  }
  window.BV_ASSET = media;      // hive.js resolves through the same table

  /* The gallery originals are ~1200px and get shown in boxes between 117 and
     440px wide — roughly ten times the pixels anybody sees, on every card, every
     carousel tile and every hero cell. tools/make-thumbs.mjs writes a 480px copy
     of each and lists it in thumb-map.js: 29.5 MB of gallery art becomes 5.8 MB.

     RESOLUTION ORDER, and why it is in this order:
       1. the thumbnail through the media map — it was uploaded to the library,
          so it works everywhere;
       2. the thumbnail as a local file — correct for a standalone deploy of
          site/, which ships the thumb/ folders alongside everything else;
       3. the full-size image — the only safe answer inside the embed build,
          where NOTHING is served locally and an unmapped path is a 404.
     BV_EMBED is stamped in by build-embed.mjs, which is the one context where
     rule 2 would be wrong. Anything unresolved falls back to the full image, so
     the worst case of a missing thumbnail is the page exactly as it was. */
  var THUMBS = window.BV_THUMBS || {};
  var CELLS = window.BV_CELLS || {};
  var EMBED = !!window.BV_EMBED;
  function light(table, p) {
    var t = table[p];
    if (!t) return media(p);
    if (MEDIA[t]) return media(t);
    return EMBED ? media(p) : t;
  }
  // 480px WebP: cards (≤440px) and carousel tiles (≤232px).
  function thumb(p) { return light(THUMBS, p); }
  // 200px WebP: the hero comb, whose cells are 92–152px wide. Feeding those a
  // 480px file was still four times the pixels they can show.
  function cell(p) { return light(CELLS, p); }
  window.BV_THUMB = thumb;
  window.BV_CELL = cell;

  /* WebP is universal in every browser this site targets, but a light copy is
     never load-bearing: if one fails to decode or 404s, swap that <img> back to
     the original it was derived from. The light paths are derivable, so this
     needs no extra markup — and it runs once per image, so a genuinely missing
     original cannot loop.
     Capturing, because `error` does not bubble. */
  var HEAVY = {};                 // light path -> the original it was made from
  (function buildReverse() {
    [THUMBS, CELLS].forEach(function (t) {
      for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) HEAVY[t[k]] = k;
    });
  })();
  document.addEventListener('error', function (e) {
    var n = e.target;
    if (!n || n.tagName !== 'IMG' || n.dataset.bvFellBack) return;
    var src = n.getAttribute('src') || '';
    var orig = HEAVY[src] || HEAVY[src.replace(/^.*?(assets\/)/, '$1')];
    if (!orig) return;
    n.dataset.bvFellBack = '1';
    n.src = media(orig);
  }, true);

  /* NO VIDEO GOES FULLSCREEN.
     Every video here is framed on purpose — six reels inside hexagons, a
     client's film in a 420px square. Fullscreen throws the frame, the crop and
     the page away and blows a 420px file up on a black screen, which is the
     worst possible view of the work, and it is a way back to the raw media the
     blob-url handoff exists to close.

     `controlslist="nofullscreen"` removes the button and that is all it does:
     Chrome treats it as a hint, and requestFullscreen() still works — asked
     with a real user gesture the film went fullscreen every time. So the
     attribute is the polish and this is the guarantee. One listener on the
     document covers the comb reels, the dossier film and anything added later.

     iOS is a separate path: it honours neither controlsList nor this event, and
     fires `webkitbeginfullscreen` from its own gesture instead. That is handled
     per-video where each one is built, in this file and in hive.js. */
  window.BV_NO_FULLSCREEN = function (v) {
    if (!v || v.dataset.bvNoFs) return v;
    v.dataset.bvNoFs = '1';
    v.addEventListener('webkitbeginfullscreen', function () {
      if (v.webkitExitFullscreen) v.webkitExitFullscreen();
    });
    return v;
  };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      var fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fs || fs.tagName !== 'VIDEO') return;
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    });
  });

  /* Static markup and the stylesheet carry local paths of their own. Swap the
     ones the map knows about — the hero stills come through as custom
     properties because CSS cannot read the table. */
  (function resolveStatic() {
    Array.prototype.forEach.call(document.querySelectorAll('img[src^="assets/"]'), function (im) {
      var was = im.getAttribute('src');
      /* The brand marks are written into the HTML pointing at their light copy
         rather than swapped here, because the parser starts fetching a src the
         moment it reads it — rewriting afterwards downloaded the logo twice,
         109 KB of it, on every cold load. The cost of that is this branch: in
         the embed nothing is served locally, so a light path the media library
         has never seen has to go back to the original it came from. */
      if (EMBED && !MEDIA[was] && HEAVY[was]) {
        im.setAttribute('src', media(HEAVY[was]));
        return;
      }
      var now = thumb(was);
      if (now !== was) im.setAttribute('src', now);
    });
    // The favicon stays on the original PNG. It is 21 KB smaller as WebP and no
    // reader would ever notice, but a favicon is the one image whose decoder is
    // outside the page — OS taskbars, bookmark bars and link unfurlers all get
    // to have an opinion about it, and none of them are worth 21 KB.
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.setAttribute('href', media(icon.getAttribute('href')));
    /* The hero photograph reaches CSS as a custom property, because CSS cannot
       read the media table. The stylesheet deliberately has no url() fallback:
       it is parsed long before this runs, so a fallback would be fetched and
       then thrown away when the real value lands — 191 KB downloaded twice. */
    /* ABSOLUTE, not relative. A url() inside a custom property is resolved
       against the stylesheet that USES it, not the document that set it — so
       "assets/light/comb-wide.webp" was fetched as "/css/assets/light/..." and
       404'd, leaving the hero with no photograph at all. It only worked before
       because the media map always returned an absolute CDN URL and the
       question never came up. */
    var abs = function (p) {
      try { return new URL(p, location.href).href; } catch (e) { return p; }
    };
    var root = document.documentElement.style;
    root.setProperty('--hero-wide', 'url("' + abs(thumb('assets/hero/comb-wide.jpg')) + '")');
    root.setProperty('--hero-tall', 'url("' + abs(thumb('assets/hero/comb-tall.jpg')) + '")');
  })();

  var path = function (c, i) {
    return 'assets/work/' + c.slug + '/' + String(i).padStart(2, '0') + '.jpg';
  };
  // Full size — for the lightbox and the dossier shelf, where the piece is the
  // point and it is shown large.
  var shot = function (c, i) { return media(path(c, i)); };
  // Display size — for cards and carousel tiles, which are never wider than the
  // 480px thumbnail and were downloading eight times what they showed.
  var shotSmall = function (c, i) { return thumb(path(c, i)); };
  var ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  var T = window.T || function (k) { return k; };
  var LITE = !!(window.BV_PERF && window.BV_PERF.lite);

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ── hero: split the headline into animated letters ──────────────────── */
  (function heroSplit() {
    var h = document.getElementById('heroTitle');
    if (!h) return;
    var words = h.textContent.trim().split(/\s+/);
    /* ARABIC IS A CONNECTED SCRIPT. Wrapping every character in its own inline
       box severs the joins, and each letter falls back to its isolated form —
       "نحوّل" comes out as five unrelated shapes. So in Arabic the reveal is by
       WORD, which is the same effect at a coarser grain and still legible. */
    var perLetter = !(window.BV_I18N && window.BV_I18N.rtl);
    h.textContent = '';
    var n = 0;
    words.forEach(function (w, wi) {
      var span = el('span');
      span.style.display = 'inline-block';
      span.style.whiteSpace = 'nowrap';
      if (perLetter) {
        w.split('').forEach(function (ch) {
          var s = el('span', 'bv-ltr', esc(ch));
          s.style.animationDelay = (n * 0.028 + 0.15).toFixed(3) + 's';
          span.appendChild(s);
          n++;
        });
      } else {
        var s2 = el('span', 'bv-ltr', esc(w));
        s2.style.animationDelay = (wi * 0.09 + 0.15).toFixed(3) + 's';
        span.appendChild(s2);
      }
      h.appendChild(span);
      if (wi < words.length - 1) h.appendChild(document.createTextNode(' '));
    });
    requestAnimationFrame(function () { h.classList.add('is-lit'); });
  })();

  /* ── strip pace ────────────────────────────────────────────────────────
     A STRIP'S SETTING IS A SPEED, NOT A DURATION, and writing it as a duration
     is what made carousels crawl.

     Both the CSS fallback (translateX(-100%) over --dur) and the JS driver
     (speed = width / dur) divide the track's width by that time — so a fixed
     --dur means the pace changes whenever the track's width does, and the
     track's width changes for two reasons nobody thought about when the numbers
     were authored against a 1440px English page on the full tier:

       the TIER    — lite builds half the carousel tiles, so the reels ran at
                     half speed for exactly the readers whose devices were
                     already struggling;
       the LANGUAGE — Arabic capability words are shorter, so that marquee's
                     track is 1240px against English's 1544px and it ran 20%
                     slower in one language than the other.

     So the pace is authored in px/s and the duration is computed from the width
     actually laid out. Measured after the fonts have settled, because a
     marquee's width is its text, and text measured before its webfont arrives
     is the wrong width. */
  function pace(host, pxPerSec) {
    if (!host) return;
    var apply = function () {
      var t = host.querySelector('.bv-marquee__track, .bv-reel__track');
      var w = t && t.offsetWidth;
      if (w) host.style.setProperty('--dur', (w / pxPerSec).toFixed(1) + 's');
    };
    apply();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
    // Re-derive on resize: a marquee rewraps, and a stale --dur would leave it
    // running at the old width's pace.
    var t2 = null;
    addEventListener('resize', function () {
      clearTimeout(t2); t2 = setTimeout(apply, 200);
    });
  }
  window.BV_PACE = pace;

  /* ── marquees ─────────────────────────────────────────────────────────── */
  function marquee(id, items, pxPerSec) {
    var host = document.getElementById(id);
    if (!host) return;
    var html = items.map(function (t) {
      return '<span class="bv-marquee__item">' + esc(t) + '</span><span class="bv-marquee__dot">⬢</span>';
    }).join('');
    // Two identical tracks make the -100% translate loop seamless.
    host.appendChild(el('div', 'bv-marquee__track', html));
    host.appendChild(el('div', 'bv-marquee__track', html));
    pace(host, pxPerSec);
  }
  // The pace the design was tuned at: 2020px / 38s and 1544px / 44s in English
  // on the full tier — now expressed as what those numbers actually meant.
  marquee('mq1', T('mq1'), 53);
  marquee('mq2', T('mq2'), 35);

  /* ── the count ────────────────────────────────────────────────────────── */
  (function stats() {
    var host = document.getElementById('stats');
    if (!host) return;
    ['25', '4', '873', '13'].forEach(function (v, i) {
      host.appendChild(el('div', 'bv-stat',
        '<div class="bv-stat__v">' + v + '</div>' +
        '<div class="bv-stat__l">' + esc(T('stat.' + (i + 1) + '.l')) + '</div>' +
        '<div class="bv-stat__n">' + esc(T('stat.' + (i + 1) + '.n')) + '</div>'));
    });
  })();

  /* ── the comb (method) ────────────────────────────────────────────────── */
  // Six hexes in a real comb strip — alternating offset, each filling with
  // honey as it activates. The description lives in one panel that swaps,
  // rather than six blocks of small text competing for attention.
  (function comb() {
    var host = document.getElementById('hive');
    if (!host) return;
    STAGES.forEach(function (s, i) {
      var c = el('button', 'bv-cell');
      c.type = 'button';
      c.setAttribute('data-i', i);
      c.setAttribute('aria-label', s.label);
      c.innerHTML =
        '<span class="bv-cell__hex">' +
          '<span class="bv-cell__fill"></span>' +
          '<span class="bv-cell__n">' + String(i + 1).padStart(2, '0') + '</span>' +
        '</span>' +
        '<span class="bv-cell__t">' + esc(s.label) + '</span>';
      host.appendChild(c);
    });
    // Clicking a cell jumps the pinned section to that stage's scroll offset.
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.bv-cell');
      if (!b || !window.BV_PIN) return;
      window.BV_PIN.goTo(Number(b.getAttribute('data-i')));
    });
  })();

  /* ── services ─────────────────────────────────────────────────────────── */
  /* This was eight lines of text in a table, and it read as one. It is the only
     section on the page with nothing to look at, sitting between a comb that
     fills with honey and twenty-five pieces of client art — so it disappeared.
     Each service now carries a drawn glyph inside a real hexagon cell: vector,
     so it costs nothing to download, scales to any screen, and inherits the
     brand colour rather than fighting it. */
  var SVC_ICONS = [
    // 01 Strategy & SWOT — four quadrants, one of them claimed
    '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/><path d="M14.6 19.4 19.4 14.6M19.4 18v-3.4H16"/>',
    // 02 Brand Identity — a mark being set, with its baseline
    '<path d="M12 3 20 7.5v9L12 21 4 16.5v-9z"/><path d="M9.4 15V9.4h3a2 2 0 0 1 0 4h-3"/><path d="M12.6 13.4 15 15"/>',
    // 03 Media Buying — spend moving to the winner
    '<path d="M4 20V13M9.6 20V9M15.2 20v-4M20.8 20V4"/><path d="M4 8.6 9.6 4l4 3.4L20 3"/><path d="M16.6 3H20v3.4"/>',
    // 04 Content Production — a frame being shot
    '<path d="M3 6.5h12.5v11H3zM15.5 10l5.5-3v10l-5.5-3z"/><path d="M6.4 9.6h3"/>',
    // 05 Funnels & Web — the funnel, narrowing
    '<path d="M3 4h18l-7 8v8l-4-2.4V12z"/><path d="M3 4h18"/>',
    // 06 UGC & Creators — a person on a phone screen
    '<path d="M7 2.6h10a1.6 1.6 0 0 1 1.6 1.6v15.6A1.6 1.6 0 0 1 17 21.4H7a1.6 1.6 0 0 1-1.6-1.6V4.2A1.6 1.6 0 0 1 7 2.6z"/><circle cx="12" cy="10" r="2.2"/><path d="M8.4 17.4a3.8 3.8 0 0 1 7.2 0"/>',
    // 07 Performance Analysis — the line, read closely
    '<path d="M3 19h17"/><path d="m3.6 14.4 4.2-4.6 3.2 2.6 4.4-6"/><circle cx="17" cy="9" r="3.4"/><path d="m19.6 11.4 1.8 1.8"/>',
    // 08 Positioning — one claim, held
    '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.6"/><path d="M12 1.4v3M12 19.6v3M1.4 12h3M19.6 12h3"/>',
  ];

  // Service media: videos for all eight services.
  // Empty URLs intentionally show the reserved video space, without a broken player.
  window.BV_SERVICE_VIDEOS = Object.assign({
    strategy:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6e59d5d1647127872112b.mp4',
    branding:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab66db16407f2cbe4d1bf68.mp4',
    mediaBuying:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6e59d3dbd5f2bbbd61608.mp4',
    production:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab67f2e3dbd5f2bbbcb6d7e.mp4',
    web:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6e59d1f3be2be1bb98cbc.mp4',
    creators:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab67f2e3dbd5f2bbbcb6d88.mp4',
    performance:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6a8dbf64e25296bd1b0000f3.mp4',
    positioning:'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab66de348b1d5ffbefa6f1b.mp4'
  }, window.BV_SERVICE_VIDEOS || {});

  (function services() {
    var host=document.getElementById('svc');
    if(!host)return;
    host.replaceChildren();
    var ar=!!window.BV_I18N.rtl;
    // Preserve the original eight services and their existing bilingual copy.
    var services=['strategy','branding','mediaBuying','production','web','creators','performance','positioning'].map(function(id,i){
      var title=T('svc.'+(i+1)+'.t');
      return {id:id, copy:[title,title,T('svc.'+(i+1)+'.d')]};
    });
    var tabs=el('div','bv-service-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',ar?'الخدمات':'Services');
    var panel=el('div','bv-service-panel');panel.id='servicePanel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;
    var controls=el('div','bv-service-controls');
    var status=el('span','bv-service-status');status.setAttribute('role','status');
    var pause=el('button','bv-service-pause',ar?'إيقاف التبديل':'Stop autoplay');pause.type='button';
    controls.append(status,pause);host.append(tabs,panel,controls);
    var active=0, stopped=false, visible=false, timer=null, buttons=[];
    var videoCache=Object.create(null), videoBank=document.createElement('div');
    videoBank.hidden=true;videoBank.style.display='none';host.append(videoBank);
    function serviceVideo(url){
      if(videoCache[url])return videoCache[url];
      var video=document.createElement('video');
      video.controls=false;video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
      video.disablePictureInPicture=true;video.disableRemotePlayback=true;
      video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
      video.preload='auto';video.src=url;videoCache[url]=video;videoBank.append(video);video.load();
      return video;
    }
    // Warm each direct video once; reuse the player and its playback position on every visit.
    services.forEach(function(service){
      try{var url=new URL(window.BV_SERVICE_VIDEOS[service.id],location.href);
        if(/^https?:$/.test(url.protocol)&&/\.(mp4|webm)$/i.test(url.pathname))serviceVideo(url.href);
      }catch(error){}
    });
    function clear(){if(timer!==null){clearTimeout(timer);timer=null;}}
    function syncVideo(){
      var video=panel.querySelector('video');if(!video)return;
      video.autoplay=visible&&!document.hidden;
      if(!video.autoplay){video.pause();return;}
      var playback=video.play();if(playback&&playback.catch)playback.catch(function(){/* Retry on the next section interaction or visibility change. */});
    }
    function schedule(){clear();if(!stopped&&visible&&!document.hidden)timer=setTimeout(function(){select((active+1)%services.length,false);},10000);}
    function stop(){stopped=true;clear();host.classList.add('is-manual');pause.disabled=true;pause.textContent=ar?'تم إيقاف التبديل':'Autoplay stopped';status.textContent=ar?'اختر أي خدمة لاستكشافها':'Choose any service to explore';}
    function select(index,manual){
      if(manual)stop();active=index;
      buttons.forEach(function(button,i){button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
      requestAnimationFrame(function(){
        if(tabs.scrollWidth<=tabs.clientWidth)return;
        var tab=buttons[active].getBoundingClientRect(),rail=tabs.getBoundingClientRect();
        tabs.scrollBy({left:tab.left+tab.width/2-rail.left-rail.width/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      });
      var oldVideo=panel.querySelector('video');if(oldVideo){oldVideo.autoplay=false;oldVideo.pause();videoBank.append(oldVideo);}
      panel.replaceChildren();panel.setAttribute('aria-labelledby','serviceTab-'+index);
      var service=services[index], copy=service.copy;
      var body=el('div','bv-service-copy');
      body.append(el('span','bv-service-kicker',(ar?'الخدمة ':'Service ')+String(index+1).padStart(2,'0')));
      var heading=el('h3','bv-service-title');heading.textContent=copy[1];
      var description=el('p','bv-service-description');description.textContent=copy[2];body.append(heading,description);
      var media=el('div','bv-service-video');media.setAttribute('aria-label',copy[0]+(ar?' — فيديو':' — video'));
      var url=window.BV_SERVICE_VIDEOS[service.id];
      if(url){
        try {
          var parsed=new URL(url,location.href);
          if(!/^https?:$/.test(parsed.protocol))throw new Error('Use an HTTP(S) video URL');
          if(/\.(jpe?g|png|webp|avif)(?:$)/i.test(parsed.pathname)){
            var picture=document.createElement('img');picture.src=parsed.href;picture.alt=copy[0];picture.loading='lazy';picture.decoding='async';media.setAttribute('aria-label',copy[0]);media.append(picture);
          }else if(/(^|\.)(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)$/.test(parsed.hostname)){
            var frame=document.createElement('iframe');frame.src=parsed.href;frame.title=copy[0];frame.allow='fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.loading='lazy';media.append(frame);
          }else{
            media.append(serviceVideo(parsed.href));
          }
        }catch(error){url='';}
      }
      if(!url){var placeholder=el('div','bv-service-placeholder');var title=el('strong','');title.textContent=copy[0];placeholder.append(title,el('span','',ar?'الفيديو قريبًا':'Video coming soon'));media.append(placeholder);}
      panel.append(body,media);
      syncVideo();
      if(!stopped)status.textContent=ar?'تتغير الخدمة كل 10 ثوانٍ · اختر خدمة لإيقاف التبديل':'Changes every 10 seconds · select a service to stop';
      schedule();
    }
    services.forEach(function(service,i){var button=el('button','bv-service-tab');button.type='button';button.id='serviceTab-'+i;button.textContent=service.copy[0];button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);button.addEventListener('click',function(){select(i,true);});buttons.push(button);tabs.append(button);});
    tabs.addEventListener('keydown',function(e){var next=active;if(e.key==='ArrowRight')next=(active+(ar?-1:1)+services.length)%services.length;else if(e.key==='ArrowLeft')next=(active+(ar?1:-1)+services.length)%services.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=services.length-1;else return;e.preventDefault();select(next,true);buttons[next].focus();});
    pause.addEventListener('click',stop);
    panel.addEventListener('click',stop);
    panel.addEventListener('focusin',stop);
    host.addEventListener('pointerup',function(){var video=panel.querySelector('video');if(video&&video.paused)syncVideo();});
    document.addEventListener('visibilitychange',function(){schedule();syncVideo();});
    new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;host.classList.toggle('is-away',!visible);schedule();syncVideo();},{threshold:.2}).observe(host);
    select(0,false);
  })();

  /* ── work grid ────────────────────────────────────────────────────────── */
  /* Twenty-five cards laid out at once is a wall, not a portfolio — the reader
     stops reading around the ninth. Six are shown; the rest arrive on request,
     six at a time. That also means six card images on first load instead of
     twenty-five, which is the cheapest weight saving on the page. */
  var PAGE = 6;
  (function grid() {
    var host = document.getElementById('grid');
    if (!host) return;
    var shown = PAGE;

    C.forEach(function (c, i) {
      var b = el('button', 'bv-card bv-rise');
      b.style.setProperty('--a', c.accent);
      b.setAttribute('data-slug', c.slug);
      b.setAttribute('data-cursor', T('card.open'));
      /* Lead art, in the order a reviewer asked for it: the brand's own mark
         first, then a gallery shot, then a branded hex with their initial.
         Reviewed as "put the brands' logos instead of taking images from their
         content" — a card is an index entry, and a brand is recognised by its
         mark faster than by one of its posts.
         The gallery fallback is not a stopgap: logos arrive per client, and a
         client without one has to keep reading as a finished card rather than a
         lettered placeholder. */
      var lead;
      if (c.logo) {
        lead = '<span class="bv-card__plate"><img loading="lazy" decoding="async" src="' +
          thumb('assets/logos/' + c.logo) + '" alt="' + esc(c.name) + ' logo"></span>';
      } else if (c.work) {
        lead = '<img loading="lazy" decoding="async" src="' + shotSmall(c, 1) + '" alt="">';
      } else {
        lead = '<span class="bv-card__mark"><span class="bv-hex"></span><b>' +
          esc(c.name.charAt(0)) + '</b></span>';
      }
      b.innerHTML =
        '<div class="bv-card__img">' +
          '<span class="bv-card__tag">' + esc(c.industry.split('/')[0].trim()) + '</span>' +
          lead +
          '<span class="bv-card__veil"></span>' +
        '</div>' +
        '<div class="bv-card__body">' +
          '<div class="bv-card__meta">' + esc(T('card.meta', {
            i: String(i + 1).padStart(2, '0'), country: c.country, year: c.year,
          })) + '</div>' +
          '<div class="bv-card__t"><span>' + esc(c.name) + '</span>' + ARROW + '</div>' +
          '<div class="bv-card__o">' + bidi(c.outcome.headline) + '</div>' +
          '<span class="bv-card__kind bv-kind--' + c.outcome.kind + '">' +
            esc(T(c.outcome.kind === 'result' ? 'card.kindResult' : 'card.kindGoal')) + '</span>' +
        '</div>';
      // A logo plate or a lettered hex is opaque and already covers the frame,
      // so there is nothing to wait for — retire the skeleton immediately.
      if (c.logo || !c.work) b.querySelector('.bv-card__img').classList.add('is-loaded');
      b.addEventListener('click', function () { openCase(c.slug, b); });
      host.appendChild(b);
    });

    var cards = Array.prototype.slice.call(host.children);
    var wrap = document.getElementById('moreWrap');
    var btn = document.getElementById('moreBtn');
    var label = document.getElementById('moreLabel');
    var count = document.getElementById('moreCount');
    if (!wrap || cards.length <= PAGE) return;
    wrap.hidden = false;

    /* `hidden` rather than display:none via a class, because a hidden card must
       be out of the tab order and out of the accessibility tree as well as out
       of sight — a keyboard reader should not walk nineteen cards they cannot
       see. Deliberately NOT lazy-revealed on scroll: the supervisor's note was
       that the section is crowded, and an infinite scroll is the same wall
       arriving more slowly. */
    function paint(reveal) {
      cards.forEach(function (b, i) {
        var on = i < shown;
        if (on && b.hidden) {
          b.hidden = false;
          if (reveal) {
            // stagger only the cards that just appeared
            b.classList.remove('is-in');
            b.style.transitionDelay = (((i - (shown - PAGE)) % PAGE) * 0.06).toFixed(2) + 's';
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { b.classList.add('is-in'); });
            });
          }
        } else if (!on) {
          b.hidden = true;
        }
      });
      count.textContent = T('work.showing', { a: Math.min(shown, cards.length), b: cards.length });
      var all = shown >= cards.length;
      label.textContent = T(all ? 'work.less' : 'work.more');
      btn.classList.toggle('is-open', all);
      btn.setAttribute('aria-expanded', String(all));
    }

    btn.addEventListener('click', function () {
      if (shown >= cards.length) {
        shown = PAGE;
        paint(false);
        // Collapsing from the bottom of a long list leaves the reader in
        // whitespace; put them back at the top of the section they collapsed.
        document.getElementById('work').scrollIntoView({
          behavior: (window.BV_PERF && window.BV_PERF.reduced) ? 'auto' : 'smooth',
          block: 'start',
        });
      } else {
        shown = Math.min(shown + PAGE, cards.length);
        paint(true);
      }
    });
    paint(false);

    /* A deep link has to be able to reach a card that is not on screen yet —
       openCase measures the clicked card to grow the dossier out of it, and a
       `hidden` card has no box at all. */
    window.BV_REVEAL_CARD = function (slug) {
      var i = C.findIndex(function (c) { return c.slug === slug; });
      if (i < 0 || i < shown) return;
      shown = Math.min(cards.length, Math.ceil((i + 1) / PAGE) * PAGE);
      paint(false);
    };
  })();

  /* ── infinite creative carousel ───────────────────────────────────────── */
  var REEL = [];
  (function reels() {
    /* This used to carry every gallery image on the site — 181 tiles, each
       duplicated for the seamless loop, in two strips. That is 362 <img> nodes
       on the home page, and a reader who let the carousel run eventually pulled
       every one of them. It is billed as "a sample", so make it one: a bounded
       number per client, which also keeps the mix even instead of letting the
       clients with the biggest folders dominate. */
    var PER = LITE ? 2 : 4;
    var all = [];
    for (var depth = 1; depth <= PER; depth++) {
      C.forEach(function (c) {
        if (depth <= c.work) all.push({ src: shot(c, depth), thumb: shotSmall(c, depth), name: c.name });
      });
    }

    // Properly scrambled, but seeded so the order is stable between loads —
    // a Fisher-Yates over a small LCG. A round-robin looked ordered because it
    // repeats the same client sequence every cycle.
    var seed = 0x9e3779b9;
    var rnd = function () {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (var k = all.length - 1; k > 0; k--) {
      var j = Math.floor(rnd() * (k + 1));
      var tmp = all[k]; all[k] = all[j]; all[j] = tmp;
    }

    // Then push apart any neighbours that landed on the same client, so the
    // scramble never reads as a clump. Bounded so it always terminates.
    for (var pass = 0; pass < 4; pass++) {
      var moved = 0;
      for (var i2 = 1; i2 < all.length; i2++) {
        if (all[i2].name !== all[i2 - 1].name) continue;
        for (var s = i2 + 2; s < all.length; s++) {
          if (all[s].name !== all[i2 - 1].name &&
              all[s].name !== (all[i2 + 1] || {}).name &&
              all[s - 1].name !== all[i2].name) {
            var t2 = all[i2]; all[i2] = all[s]; all[s] = t2; moved++;
            break;
          }
        }
      }
      if (!moved) break;
    }
    var mixed = all;
    REEL = mixed;
    function fill(id, list) {
      var host = document.getElementById(id);
      if (!host) return;
      // The tile shows a 232px-wide box, so it gets the thumbnail; the lightbox
      // opens the full file. data-src stays the FULL path so it still keys the
      // lightbox list correctly.
      var html = list.map(function (t) {
        return '<div class="bv-tile" data-cursor="' + esc(T('cursor.view')) + '" data-src="' + t.src +
          '" data-c="' + esc(t.name) + '">' +
          '<img loading="lazy" decoding="async" src="' + t.thumb + '" alt="' + esc(t.name) + ' creative"></div>';
      }).join('');
      host.appendChild(el('div', 'bv-reel__track', html));
      host.appendChild(el('div', 'bv-reel__track', html));

      /* DURATION IS THE WRONG UNIT WHEN THE CONTENT LENGTH VARIES.
         REPORTED: "some carousels break, stop, or slow down to the point of
         appearing frozen." These two did, and only on the lite tier.

         --dur was authored in the markup as a fixed 168s/196s for a 44-tile
         track. The lite tier builds HALF the tiles to save memory and decode
         work, so the track is half as long — and both the CSS animation
         (translateX(-100%) over --dur) and the JS driver (speed = w / dur)
         derive speed by dividing width by that fixed time. Half the width in
         the same time is half the speed: 64 px/s became 32, and 55 became 28.
         At 28 px/s a 232px tile takes eight seconds to move its own width,
         which is exactly "so slow it looks frozen" — and the lite tier is what
         a struggling device gets, so the readers most likely to notice were the
         only ones seeing it.

         The marquees were unaffected because their tile count does not change
         with the tier, which is why it was SOME carousels and not all.

         So the authored numbers become a pace PER TILE, and the duration is
         computed from however many tiles were actually built. Same fix, and the
         same reasoning, as the case shelf's per-tile --dur. */
      // px/s, computed from the width actually built — see pace() above for why
      // a duration is the wrong thing to author here.
      pace(host, parseFloat(host.getAttribute('data-px-per-sec')) || 60);
      host.addEventListener('click', function (e) {
        var tile = hitAt(e, '.bv-tile', host);
        if (!tile) return;
        var srcs = list.map(function (t) { return t.src; });
        openLb(srcs, srcs.indexOf(tile.getAttribute('data-src')), function (i) {
          // The strip is moving and every tile exists twice, so resolve the
          // origin box at call time and prefer a copy that is actually on screen.
          var all = Array.prototype.slice.call(
            host.querySelectorAll('.bv-tile[data-src="' + srcs[i] + '"] img'));
          return all.filter(function (im) {
            var r = im.getBoundingClientRect();
            return r.right > 0 && r.left < innerWidth && r.width > 0;
          })[0] || all[0] || null;
        }, list.map(function (t) { return t.name; }));
      });
    }
    var half = Math.ceil(mixed.length / 2);
    fill('reelA', mixed.slice(0, half));
    fill('reelB', mixed.slice(half));
  })();

  /* Spread the running shelf into a grid and back, animating each tile from
     exactly where it was — FLIP: measure First, change layout, measure Last,
     apply the inverse as a transform, then release it to zero. */
  function wireSpread(gal, n) {
    var btn = gal.querySelector('.bv-gal__toggle');
    var label = gal.querySelector('.bv-gal__toggleT');
    var track = gal.querySelector('.bv-gal__track');
    if (!btn || !track) return;

    btn.addEventListener('click', function () {
      var toGrid = gal.getAttribute('data-mode') === 'reel';
      var tiles = Array.prototype.slice.call(track.querySelectorAll('.bv-gal__t'));
      var first = tiles.map(function (t) { return t.getBoundingClientRect(); });

      gal.setAttribute('data-mode', toGrid ? 'grid' : 'reel');
      label.textContent = toGrid ? T('case.run') : T('case.spread', { n: n });
      btn.setAttribute('aria-pressed', String(toGrid));

      // Park the running strip NOW, before the new layout is measured. The
      // driver would otherwise zero the track on its next frame and every tile
      // would jump by that offset just as the animation started. Coming back to
      // the run, hold it still until the tiles have landed, then let it go.
      var strip = gal.__bvStrip;
      if (strip) {
        strip.off = 0;
        strip.fling = 0;
        for (var k = 0; k < strip.tracks.length; k++) {
          strip.tracks[k].style.transform = 'translateX(0px)';
        }
        strip.hold = true;
      }

      var last = tiles.map(function (t) { return t.getBoundingClientRect(); });
      tiles.forEach(function (t, i) {
        var dx = first[i].left - last[i].left;
        var dy = first[i].top - last[i].top;
        var sx = first[i].width / (last[i].width || 1);
        var sy = first[i].height / (last[i].height || 1);
        t.style.transition = 'none';
        t.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) +
          'px) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
      });

      void track.offsetWidth;                       // flush the inverse

      tiles.forEach(function (t, i) {
        t.style.transition = 'transform .62s cubic-bezier(.22,1,.36,1) ' +
          (i * 0.024).toFixed(3) + 's, opacity .4s';
        t.style.transform = '';
      });
      // Hand control back to CSS so :hover works again, and release the strip
      // only once the tiles have landed — otherwise the run resumes underneath
      // a transition that is still moving toward a target that has shifted.
      setTimeout(function () {
        tiles.forEach(function (t) { t.style.transition = ''; t.style.transform = ''; });
        if (strip) strip.hold = false;
      }, 620 + tiles.length * 24 + 120);
    });
  }

  /* ── modal focus plumbing ─────────────────────────────────────────────── */
  /* Both overlays cover the page completely. Without this, Tab keeps walking
     the 25 cards and 350 tiles still sitting behind them, a screen reader
     reads straight through, and closing drops focus back at <body>. */
  var FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
  var bgLayers = ['mast', 'menu'].map(function (id) { return document.getElementById(id); })
    .concat([document.querySelector('main'), document.querySelector('.bv-foot')])
    .filter(Boolean);

  /* THE PAGE BEHIND AN OVERLAY IS NOT VISIBLE, SO STOP PAYING FOR IT.
     This already meant "hidden from assistive technology". It now also means
     hidden from the renderer, because those are the same fact and the site was
     only acting on one of them.

     A dossier covers the screen, and behind it the hero canvas kept repainting
     a few hundred hexagons every frame, the comb kept oscillating with six
     videos decoding inside it, four strips kept writing transforms and the drip
     rail kept animating — all of it invisible, all of it competing with the
     open animation the reader is actually looking at. Under a 4x CPU throttle
     that was 2.5 seconds of blocked main thread for one case open.

     One signal, broadcast once per state change rather than polled per frame:
     everything expensive listens for `bv:cover` and stops. New effects get this
     for free, which is the point — the previous arrangement had each loop
     inventing its own idea of when it was allowed to run, and a case file was
     not on anybody's list.

     NOT the pointer companion: the honey cursor is drawn ON TOP of the overlay
     and has to keep tracking. "Covered" means the page behind, not the chrome
     in front. */
  var covered = false;
  function setCovered(on) {
    on = !!on;
    if (on === covered) return;
    covered = on;
    document.documentElement.classList.toggle('bv-covered', on);
    try {
      document.dispatchEvent(new CustomEvent('bv:cover', { detail: { covered: on } }));
    } catch (e) {
      var ev2 = document.createEvent('CustomEvent');       // very old engines
      ev2.initCustomEvent('bv:cover', false, false, { covered: on });
      document.dispatchEvent(ev2);
    }
  }
  window.BV_COVERED = function () { return covered; };

  function hideBackground(on) {
    bgLayers.forEach(function (n) {
      if (on) n.setAttribute('aria-hidden', 'true');
      else n.removeAttribute('aria-hidden');
    });
    setCovered(on);
  }

  // Wrap Tab at the ends of one container. Recomputed per keypress because the
  // dossier rebuilds its whole panel when you walk to the next client.
  function trapTab(root, e) {
    if (e.key !== 'Tab') return;
    var items = Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  /* ── case dossier ─────────────────────────────────────────────────────── */
  var caseEl = document.getElementById('case');
  var panel = document.getElementById('casePanel');
  var current = -1;
  var caseReturn = null;      // what to give focus back to when it closes

  /* Object URLs for dossier films, keyed by the url they were fetched from, and
     BOUNDED. An object URL is only released by revokeObjectURL — dropping the
     <video> that used it does nothing — so without this a reader who plays
     films in several case files retains every one of them, half a megabyte at a
     time. Three is enough to make going back to the case you just left free
     while capping what is held at roughly 1.5 MB. */
  var filmBlobs = {};
  var filmOrder = [];
  var FILM_CACHE = 3;
  function keepFilmBlob(url, obj) {
    filmBlobs[url] = obj;
    filmOrder.push(url);
    while (filmOrder.length > FILM_CACHE) {
      var old = filmOrder.shift();
      if (filmBlobs[old] && old !== url) {
        URL.revokeObjectURL(filmBlobs[old]);
        delete filmBlobs[old];
      }
    }
  }

  function buildCase(c, idx) {
    // Release the previous shelf before its markup is thrown away.
    var oldGal = panel.querySelector('.bv-gal');
    if (oldGal && window.BV_STRIPS) window.BV_STRIPS.drop(oldGal);

    document.getElementById('caseNo').textContent = T('case.n', {
      i: String(idx + 1).padStart(2, '0'), n: String(C.length).padStart(2, '0'),
    });
    document.getElementById('caseName').textContent = c.name;

    var steps = document.getElementById('caseSteps');
    steps.innerHTML = '';
    STAGES.forEach(function (s, i) {
      var li = el('li');
      var b = el('button', '', '<span class="bv-case__pip"></span>' + esc(s.label));
      b.addEventListener('click', function () {
        var t = panel.querySelector('[data-step="' + s.key + '"]');
        if (t) panel.scrollTo({ top: t.offsetTop - 12, behavior: 'smooth' });
      });
      li.appendChild(b);
      steps.appendChild(li);
    });

    // The rail had a screen-height gap between the last step and the nav
    // buttons. These are the facts a reader scanning the dossier wants pinned
    // where they can always see them, rather than only in the masthead they
    // have already scrolled past.
    var facts = document.getElementById('caseFacts');
    if (facts) {
      var rows = [[T('case.sector'), c.industry], [T('case.market'), c.country],
        [T('case.year'), c.year]];
      if (c.site) rows.push([T('case.site'), c.site]);
      facts.innerHTML = rows.map(function (r) {
        return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('');
    }

    var h = '';
    var shelfHtml = '';                 // the work shelf, mounted after the open

    /* masthead */
    h += '<div class="bv-case__mast">' +
      '<div class="bv-case__meta">' + esc(c.industry) + ' · ' + esc(c.country) + ' · ' + esc(c.year) +
        (c.site ? ' · ' + esc(c.site) : '') + '</div>' +
      '<h2 class="bv-case__tagline">' + bidi(c.tagline) + '</h2>' +
      '<p class="bv-lede">' + bidi(c.summary) + '</p>' +
      '<div class="bv-case__chips">' +
        c.services.map(function (s) { return '<span class="bv-chip">' + esc(s) + '</span>'; }).join('') +
      '</div></div>';

    /* outcome band */
    h += '<div class="bv-case__sec"><h3>' +
      esc(T(c.outcome.kind === 'result' ? 'case.result' : 'case.goal')) +
      '</h3><div class="bv-case__tagline bv-case__out" style="color:' +
      c.accent + '">' + bidi(c.outcome.headline) + '</div>' +
      (c.outcome.kind === 'goal'
        ? '<p class="bv-dim bv-case__caveat">' + esc(T('case.goalNote')) + '</p>'
        : '') + '</div>';

    /* metrics */
    if (c.metrics && c.metrics.length) {
      h += '<div class="bv-case__sec"><h3>' + esc(T('case.metrics')) + '</h3><div class="bv-mx">';
      c.metrics.forEach(function (m) {
        h += '<button class="bv-m"><span class="bv-m__in">' +
          '<span class="bv-m__f"><span class="bv-m__hint">' + esc(T('case.tap')) + '</span>' +
            '<span class="bv-m__v">' + esc(m.v) + '</span>' +
            '<span class="bv-m__l">' + esc(m.l) + '</span></span>' +
          '<span class="bv-m__b"><span class="bv-m__n">' + bidi(m.note) + '</span></span>' +
          '</span></button>';
      });
      h += '</div></div>';
    }

    /* the journey */
    h += '<div class="bv-case__sec"><h3>' + esc(T('case.journey')) + '</h3><div class="bv-journey">';
    STAGES.forEach(function (s, i) {
      var body = (c.journey && c.journey[s.key]) || '';
      if (!body) return;
      h += '<div class="bv-step" data-step="' + s.key + '">' +
        (i < STAGES.length - 1 ? '<span class="bv-step__line"><i></i></span>' : '') +
        '<div><div class="bv-step__hex">' + String(i + 1).padStart(2, '0') + '</div></div>' +
        '<div><div class="bv-step__t">' + esc(s.label) + '</div>' +
        '<div class="bv-step__b">' + bidi(body) + '</div></div></div>';
    });
    h += '</div></div>';

    /* campaign readout */
    if (c.campaign) {
      h += '<div class="bv-case__sec"><h3>' + esc(T('case.campaign')) + '</h3><div class="bv-camp">' +
        '<div class="bv-camp__h">' + esc(c.campaign.title) + '</div><div class="bv-camp__rows">';
      c.campaign.rows.forEach(function (r) {
        h += '<div class="bv-camp__c"><div class="bv-camp__v">' + esc(r[1]) +
          '</div><div class="bv-camp__k">' + esc(r[0]) + '</div></div>';
      });
      h += '</div><div class="bv-camp__f">' + bidi(c.campaign.split) + '</div></div>' +
        '<div class="bv-redact"><b>&nbsp;' + esc(T('case.redacted')) + '&nbsp;</b> ' +
        bidi(c.campaign.note) + '</div></div>';
    }

    /* the film ---------------------------------------------------------------
       Fifteen of the twenty-five dossiers describe video deliverables and show
       still frames of them — Volt EMS's own copy apologises for it. Where the
       actual reel exists, it goes here, ABOVE the stills, because for these
       clients the film IS the deliverable and the gallery is a poster of it.

       Poster-first: nothing loads until somebody presses play, so a dossier is
       no heavier to open than it was. media(), not thumb() — the hero comb gets
       the 288px copy, this gets the full 420px file, because here it is being
       watched rather than glimpsed in a hexagon. */
    if (c.film && c.film.src) {
      /* The poster is the client's own first gallery image — usually already
         cached, and for a client like Volt EMS it is literally a frame of this
         film. But a client whose ENTIRE engagement was video has no gallery:
         Dar El Hadith is work: 0, so this fell back to src="", which browsers
         resolve against the page URL and then fetch and fail. An explicit
         film.poster covers that case; with neither, draw no <img> at all and
         let the block's own background stand. */
      var poster = c.film.poster ? thumb(c.film.poster) : (c.work ? shotSmall(c, 1) : '');
      h += '<div class="bv-case__sec"><h3>' + esc(T('case.film')) + '</h3>' +
        '<div class="bv-film" data-src="' + esc(media(c.film.src)) + '" style="--a:' + c.accent + '">' +
          (poster ? '<img class="bv-film__poster" loading="lazy" decoding="async" src="' +
            esc(poster) + '" alt="">' : '') +
          '<button class="bv-film__play" type="button" data-cursor="' + esc(T('case.filmPlay')) + '">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
              '<path d="M8 5v14l11-7z"/></svg>' +
            '<span>' + esc(T('case.filmPlay')) + '</span>' +
          '</button>' +
        '</div>' +
        (c.film.note ? '<p class="bv-film__note bv-dim">' + bidi(c.film.note) + '</p>' : '') +
        '</div>';
    }

    /* the work — a running shelf that can spread into a grid */
    if (c.work) {
      var tiles = '';
      for (var i = 1; i <= c.work; i++) {
        /* NOT lazy: the shelf sizes each tile from its image's natural width, so
           a lazy image deadlocks — zero width means "not visible", which means
           it never loads, which means it never gets a width.

           Which is exactly why the TIER matters here more than anywhere else.
           Every one of these decodes during the open animation, and this was
           asking for the full-size ~1200px original — sixteen of them for a
           client like Moafa, on the critical path of the one transition the
           reader is watching. The shelf is ~370px tall; the 480px copy is the
           same tiering the cards and carousel tiles already use.
           The LIGHTBOX still opens the full-size file, which is the surface
           where the work is actually being looked at — same split as the home
           carousel, where the tile is a thumbnail and the enlargement is not.
           decoding="async" so a decode cannot block the frame either. */
        tiles += '<button class="bv-gal__t" data-cursor="' + esc(T('cursor.view')) +
          '" data-i="' + (i - 1) + '">' +
          '<img decoding="async" src="' + shotSmall(c, i) + '" alt="' + esc(c.name) +
          ' creative ' + i + '"></button>';
      }
      /* THE SHELF IS BUILT, BUT NOT YET. It is the heaviest part of a dossier —
         up to thirty-two tiles and their decodes, a strip registration and two
         full re-measures — and at the moment a case opens it is a screen and a
         half below the fold. Putting it in the same innerHTML as the masthead
         meant all of that landed inside the open transition, which is the one
         animation the reader is actually watching.
         So the markup is prepared here and mounted after the panel has settled;
         see mountShelf(). Nothing about the result differs, only when it costs. */
      shelfHtml = '<div class="bv-case__sec"><h3>' + esc(T('case.work', { n: c.work })) +
        (c.workNote ? ' — ' + bidi(c.workNote) : '') + '</h3>' +
        /* --dur is written here as a CONCRETE value, not as
           calc(var(--n) * 2.2s) in the stylesheet, because the strip driver
           reads it with parseFloat(getComputedStyle(el).getPropertyValue()) —
           and an unregistered custom property computes to its raw token
           sequence, so parseFloat("calc(8 * 2.2s)") is NaN and the shelf
           silently falls back to the 40s default.

           Per TILE rather than a flat duration: speed is width/duration, so one
           number for every shelf means a sixteen-piece gallery runs four times
           faster than a four-piece one. 2.4s a tile keeps the pace the same
           whatever the client delivered. */
        '<div class="bv-gal" data-mode="reel" style="--n:' + c.work +
          '; --dur:' + (Math.max(4, c.work) * 2.4).toFixed(1) + 's">' +
          '<div class="bv-gal__view">' +
            '<div class="bv-gal__track">' + tiles + '</div>' +
            // second copy makes the -50% loop seamless; hidden when spread
            '<div class="bv-gal__track bv-gal__track--ghost" aria-hidden="true">' + tiles + '</div>' +
          '</div>' +
          '<button class="bv-gal__toggle" type="button">' +
            '<span class="bv-gal__toggleT">' + esc(T('case.spread', { n: c.work })) + '</span>' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
              '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>' +
          '</button>' +
        '</div></div>';
      // A place to put it, so the panel's height is roughly right from the start
      // and mounting the shelf does not shove the journey around underneath the
      // reader. contain-intrinsic-size on the slot does the reserving.
      h += '<div class="bv-case__sec bv-shelf-slot" aria-hidden="true"></div>';
    }

    panel.innerHTML = h;
    panel.scrollTop = 0;

    /* metric flip */
    Array.prototype.forEach.call(panel.querySelectorAll('.bv-m'), function (b) {
      b.addEventListener('click', function () { b.classList.toggle('is-flipped'); });
    });

    /* the film: nothing is fetched until it is asked for --------------------- */
    var film = panel.querySelector('.bv-film');
    if (film) {
      film.addEventListener('click', function () {
        if (film.classList.contains('is-playing')) return;
        film.classList.add('is-playing', 'is-loading');
        var v = document.createElement('video');
        v.controls = true; v.loop = true; v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.preload = 'auto';
        // Same defence as the hero comb: fetched as page data and handed over as
        // a blob, so a download manager has no media URL to offer.
        v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback nofullscreen');
        v.disablePictureInPicture = true;
        // iOS ignores controlsList and the Fullscreen API both; it fires its own
        // webkitbeginfullscreen instead, so that gets caught per element.
        window.BV_NO_FULLSCREEN && window.BV_NO_FULLSCREEN(v);
        v.addEventListener('loadeddata', function () { film.classList.remove('is-loading'); });
        var url = film.getAttribute('data-src');
        /* CACHED BY URL, exactly like the hero comb's reels (hive.js).
           `panel.innerHTML` is replaced on the next dossier open, which throws
           the <video> away but does NOT release its object URL — the ~400-500 KB
           blob behind it stays alive for the life of the document. Walk eight
           case files and that is several megabytes retained on the device class
           this whole site exists to protect. Keying the cache by url also stops
           the same film being downloaded again every time a reader reopens the
           same case. */
        if (filmBlobs[url]) {
          v.src = filmBlobs[url];
          var p0 = v.play();
          if (p0 && p0.catch) p0.catch(function () {});
          film.appendChild(v);
          return;
        }
        fetch(url, { credentials: 'omit', mode: 'cors' })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
          .then(function (b) {
            keepFilmBlob(url, URL.createObjectURL(b));
            v.src = filmBlobs[url];
          })
          .catch(function () { v.src = url; })     // CORS or offline: play it anyway
          .then(function () {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          });
        film.appendChild(v);
      });
    }

    /* gallery: lightbox, hover pop, blur-to-sharp, and the spread toggle.
       Mounted after the open transition rather than during it — see shelfHtml.
       Guarded so it can only ever run once per build, because the deep-link and
       the settle timer can both reach it. */
    function mountShelf() {
      var slot = panel.querySelector('.bv-shelf-slot');
      if (!slot || !shelfHtml) return;
      slot.insertAdjacentHTML('beforebegin', shelfHtml);
      slot.parentNode.removeChild(slot);
      shelfHtml = '';
      var gal = panel.querySelector('.bv-gal');
      if (!gal) return;
      var list = [];
      for (var g = 1; g <= c.work; g++) list.push(shot(c, g));

      var realTrack = gal.querySelector('.bv-gal__track:not(.bv-gal__track--ghost)');
      var originAt = function (i) {
        var t = realTrack.querySelectorAll('.bv-gal__t')[i];
        return t ? t.querySelector('img') : null;
      };
      gal.addEventListener('click', function (e) {
        var b = hitAt(e, '.bv-gal__t', gal);
        if (b) openLb(list, Number(b.getAttribute('data-i')), originAt, c.name);
      });

      // Hovering a tile pauses the run so it can be looked at.
      var view = gal.querySelector('.bv-gal__view');
      view.addEventListener('pointerover', function (e) {
        if (e.target.closest('.bv-gal__t')) gal.classList.add('is-held');
      });
      view.addEventListener('pointerout', function (e) {
        if (!view.contains(e.relatedTarget)) gal.classList.remove('is-held');
      });

      wireSpread(gal, c.work);
      // Hand the shelf to the strip driver so it can be dragged, freeze with
      // everything else while a picture is open, and stop dead when spread.
      // motion.js defines BV_STRIPS and loads AFTER this file, so a `#case=`
      // deep link builds a shelf before it exists — retry rather than give up,
      // or that shelf silently never enrols.
      (function enrol(tries) {
        if (window.BV_STRIPS) { window.BV_STRIPS.add(gal); return; }
        if (tries > 0) setTimeout(function () { enrol(tries - 1); }, 120);
      })(15);

      var gio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var img = e.target;
          var lift = function () { img.classList.add('is-sharp'); };
          img.complete ? setTimeout(lift, 60) : img.addEventListener('load', lift, { once: true });
          gio.unobserve(img);
        });
      }, { root: panel, threshold: 0.05 });
      Array.prototype.forEach.call(gal.querySelectorAll('img'), function (im) { gio.observe(im); });
    }

    /* WHEN. requestIdleCallback lands it in the first gap after the transition;
       the timeout is the guarantee that a busy main thread cannot postpone the
       shelf indefinitely, and the setTimeout is the fallback for Safari, which
       still has no rIC. Either way the reader is looking at the top of a dossier
       a screen and a half above this. */
    if (window.requestIdleCallback) requestIdleCallback(mountShelf, { timeout: 700 });
    else setTimeout(mountShelf, 420);
    // Anything that needs the shelf NOW — a spread toggle, a deep link, a test —
    // can force it rather than wait.
    panel.__bvMountShelf = mountShelf;

    trackJourney();
  }

  /* ── the journey rail ─────────────────────────────────────────────────────
     REPORTED BUG: scrolling a case did not light the whole journey on the side
     rail. Two causes, both in the IntersectionObserver this replaces.

     1. `threshold: 0.45` means 45% of the STEP has to be visible. Several
        journey steps are taller than 45% of the panel, so their ratio can never
        reach 0.45 and they never lit at all. Izar's diagnosis paragraph is one.
     2. The callback fired on threshold crossings in BOTH directions, and
        `isIntersecting` is true at ratio 0.44 as well as 0.46 — so a step
        LEAVING upward re-claimed the highlight from the step arriving below it,
        and the rail walked backwards.

     Position is a scroll question, so it is answered by reading the scroll.
     Every stage the reader has passed stays lit, the current one is marked
     separately, and a spine fills behind the list — so the rail shows progress
     through the journey rather than one lamp hopping about. */
  var journeyOff = null;
  function trackJourney() {
    if (journeyOff) { journeyOff(); journeyOff = null; }

    var stepEls = Array.prototype.slice.call(panel.querySelectorAll('.bv-step'));
    var btns = Array.prototype.slice.call(document.querySelectorAll('#caseSteps button'));
    var spine = document.getElementById('caseSpine');
    if (!stepEls.length || !btns.length) {
      if (spine) spine.style.transform = 'scaleY(0)';
      return;
    }

    var keys = stepEls.map(function (s) { return s.getAttribute('data-step'); });
    var raf = 0;

    function measure() {
      raf = 0;
      // The reading line: a third of the way down the panel. A step counts as
      // reached once its top crosses it, which is also true for a step taller
      // than the whole panel — the case the observer could not express.
      var line = panel.clientHeight * 0.34;
      var seen = -1;
      /* READ EVERYTHING, THEN WRITE. panel.getBoundingClientRect() was inside
         this loop, so the panel's box was re-read once per journey step — and
         because classList.toggle in the same pass invalidates layout, each read
         forced a fresh one. Six steps meant thirteen forced layouts on every
         scroll frame of an open dossier.
         One read for the panel, all the step reads together, then the writes. */
      var panelTop = panel.getBoundingClientRect().top;
      var tops = stepEls.map(function (s) { return s.getBoundingClientRect().top - panelTop; });
      stepEls.forEach(function (s, i) {
        var reached = tops[i] <= line;
        s.classList.toggle('is-in', reached);
        if (reached) seen = i;
      });

      // Once the panel is scrolled to the very bottom the last step may still
      // sit under the line — nothing more to scroll, so call it read.
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4) seen = stepEls.length - 1;

      var key = seen >= 0 ? keys[seen] : null;
      btns.forEach(function (b, bi) {
        var stage = STAGES[bi];
        var at = keys.indexOf(stage ? stage.key : '');
        b.classList.toggle('is-on', !!key && stage && stage.key === key);
        b.classList.toggle('is-done', at >= 0 && at < seen);
      });

      if (spine) {
        var f = stepEls.length > 1 ? (seen + 1) / stepEls.length : (seen >= 0 ? 1 : 0);
        spine.style.transform = 'scaleY(' + Math.max(0, Math.min(1, f)).toFixed(3) + ')';
      }
    }

    function onScroll() { if (!raf) raf = requestAnimationFrame(measure); }
    panel.addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    journeyOff = function () {
      panel.removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // Twice: once now for the closed/zero-height case, once after the overlay
    // has been laid out, because clientHeight is 0 while it is display:none.
    measure();
    setTimeout(measure, 120);
  }

  // Stagger the freshly-built sections in, top to bottom.
  function dealIn() {
    var secs = panel.querySelectorAll('.bv-case__mast, .bv-case__sec');
    Array.prototype.forEach.call(secs, function (s, i) {
      s.style.transitionDelay = (0.12 + i * 0.075).toFixed(3) + 's';
    });
    setTimeout(function () { caseEl.classList.add('is-ready'); }, 40);
    /* The veil's blur is switched on here, once the shell has finished scaling
       — see .bv-case.is-settled. A backdrop-filter re-blurs everything behind
       it whenever that scene changes, so running it DURING the 520ms open meant
       recomputing a full-screen blur on every frame of the animation.
       transitionend on the shell's transform is the honest signal; the timeout
       is the guarantee, because a transition that never starts (reduced motion,
       a display change mid-flight) would otherwise leave the dossier unblurred
       for good. */
    var shell = caseEl.querySelector('.bv-case__shell');
    var settle = function () {
      clearTimeout(settleTimer);
      if (caseEl.classList.contains('is-shown')) caseEl.classList.add('is-settled');
    };
    var settleTimer = setTimeout(settle, 620);
    if (shell) shell.addEventListener('transitionend', function once(e) {
      if (e.propertyName !== 'transform') return;
      shell.removeEventListener('transitionend', once);
      settle();
    });
  }

  var closeTimer = null;

  function openCase(slug, originEl) {
    var idx = C.findIndex(function (c) { return c.slug === slug; });
    if (idx < 0) return;
    current = idx;

    // Closing hides the overlay on a timer so the shrink can play out. Reopening
    // inside that window would otherwise have the old timer fire mid-open and
    // hide the dossier that just arrived.
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

    // Only six cards are on screen at a time now, so a deep link or a hero cell
    // may point at one that is still hidden — and a hidden card has no box to
    // grow the dossier out of.
    if (!originEl && window.BV_REVEAL_CARD) window.BV_REVEAL_CARD(slug);

    // Expand from the card that was clicked, when we know which one it was.
    // Clamped: a card far down the page yields an origin way outside the
    // viewport, which throws the growth off to one side.
    var card = originEl || document.querySelector('.bv-card[data-slug="' + slug + '"]');
    if (card) {
      var r = card.getBoundingClientRect();
      var pc = function (v) { return Math.max(0, Math.min(100, v)).toFixed(1) + '%'; };
      caseEl.style.setProperty('--ox', pc((r.left + r.width / 2) / innerWidth * 100));
      caseEl.style.setProperty('--oy', pc((r.top + r.height / 2) / innerHeight * 100));
    }

    // Only remember the opener on a fresh open — walking Prev/Next re-enters
    // here, and overwriting would leave focus on a button inside the dossier.
    if (caseReturn === null) {
      caseReturn = (originEl && originEl.focus) ? originEl
        : (document.activeElement && document.activeElement.focus ? document.activeElement : null);
    }

    caseEl.classList.remove('is-ready', 'is-settled');
    buildCase(C[idx], idx);
    caseEl.classList.add('is-open');
    document.body.classList.add('bv-locked');
    hideBackground(true);

    /* REPORTED BUG: open a case, scroll down, close it, open another — and the
       new one arrived already scrolled down. buildCase does set panel.scrollTop
       = 0, but at that moment the dossier is still `display:none` from the last
       close, and a scroll write to a box that does not exist is silently
       dropped; the browser then restores the old offset when the box comes
       back. So it is set again HERE, one frame after the overlay is displayed,
       which is the first moment the panel actually has a scrollport. */
    panel.scrollTop = 0;
    requestAnimationFrame(function () { panel.scrollTop = 0; });
    setTimeout(function () { panel.scrollTop = 0; }, 60);
    // setTimeout, not rAF — rAF is frozen while the tab is hidden, and the
    // overlay would then never reach its shown state.
    setTimeout(function () { caseEl.classList.add('is-shown'); }, 20);
    // Land on the close button: it is the one control every reader wants next,
    // and it puts focus inside the trap without scrolling the panel.
    setTimeout(function () {
      var x = document.getElementById('caseX');
      if (x && caseEl.classList.contains('is-open')) x.focus({ preventScroll: true });
    }, 60);
    dealIn();
    if (location.hash !== '#case=' + slug) history.replaceState(null, '', '#case=' + slug);
  }

  function closeCase() {
    caseEl.classList.remove('is-shown', 'is-ready', 'is-settled');
    document.body.classList.remove('bv-locked');
    hideBackground(false);
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      panel.scrollTop = 0;                 // while it still HAS a scrollport…
      caseEl.classList.remove('is-open');  // …and only then take the box away
      closeTimer = null;
    }, 520);
    if (journeyOff) { journeyOff(); journeyOff = null; }
    current = -1;
    history.replaceState(null, '', location.pathname + location.search);
    if (caseReturn) {
      var back = caseReturn;
      caseReturn = null;
      // after the overlay has stopped painting, so the page does not jump
      setTimeout(function () { try { back.focus({ preventScroll: true }); } catch (err) {} }, 60);
    }
  }

  caseEl.addEventListener('keydown', function (e) { trapTab(caseEl, e); });

  // Walking between clients: the panel leaves in the direction of travel, the
  // next one is built while it is out of sight, then it deals back in.
  var stepBusy = false;
  function step(d) {
    if (current < 0 || stepBusy) return;
    stepBusy = true;
    var next = C[(current + d + C.length) % C.length];
    caseEl.style.setProperty('--swap', (d > 0 ? 22 : -22) + 'px');
    caseEl.classList.add('is-swapping');
    caseEl.classList.remove('is-ready', 'is-settled');
    setTimeout(function () {
      current = C.indexOf(next);
      buildCase(next, current);
      caseEl.style.setProperty('--swap', (d > 0 ? -22 : 22) + 'px');
      history.replaceState(null, '', '#case=' + next.slug);
      setTimeout(function () {
        caseEl.classList.remove('is-swapping');
        dealIn();
        stepBusy = false;
      }, 20);
    }, 250);
  }
  // The hero comb opens cases too, so it needs a way in.
  window.BV_OPEN_CASE = openCase;

  document.getElementById('caseX').addEventListener('click', closeCase);
  // The dossier is inset now, so the page shows around it — and a strip of the
  // page you can see but not click reads as broken. Clicking it closes.
  var caseVeil = document.getElementById('caseVeil');
  if (caseVeil) caseVeil.addEventListener('click', closeCase);
  document.getElementById('casePrev').addEventListener('click', function () { step(-1); });
  document.getElementById('caseNext').addEventListener('click', function () { step(1); });

  /* ── lightbox ─────────────────────────────────────────────────────────── */
  // Nothing here cuts. Opening grows the picture out of the thumbnail that was
  // clicked, stepping slides in the direction of travel, and closing shrinks
  // back into whichever thumbnail is now current.
  var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg');
  var lbCount = document.getElementById('lbCount');
  var lbList = [], lbI = 0, lbOrigin = null, lbBusy = false;
  var EASE = 'cubic-bezier(.22,1,.36,1)';

  function ready(img, fn) {
    if (img.complete && img.naturalWidth) fn();
    else {
      var done = false;
      var go = function () { if (!done) { done = true; fn(); } };
      img.addEventListener('load', go, { once: true });
      img.addEventListener('error', go, { once: true });
      setTimeout(go, 700);
    }
  }

  // Grow from (or shrink to) a thumbnail's box using FLIP.
  function lbFlip(fromEl, back, after) {
    var to = lbImg.getBoundingClientRect();
    if (!fromEl || !to.width) {
      lbImg.style.transition = 'none';
      lbImg.style.transform = back ? '' : 'scale(.94)';
      lbImg.style.opacity = back ? 1 : 0;
      void lbImg.offsetWidth;
      lbImg.style.transition = 'transform .34s ' + EASE + ', opacity .28s ease';
      lbImg.style.transform = back ? 'scale(.96)' : '';
      lbImg.style.opacity = back ? 0 : 1;
      if (after) setTimeout(after, 300);
      return;
    }
    var from = fromEl.getBoundingClientRect();
    var sx = from.width / to.width, sy = from.height / to.height;
    var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
    var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
    var inv = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' +
      sx.toFixed(4) + ',' + sy.toFixed(4) + ')';

    lbImg.style.transition = 'none';
    lbImg.style.transform = back ? '' : inv;
    lbImg.style.opacity = back ? 1 : 0.35;
    void lbImg.offsetWidth;
    lbImg.style.transition = 'transform .5s ' + EASE + ', opacity .3s ease';
    lbImg.style.transform = back ? inv : '';
    lbImg.style.opacity = back ? 0 : 1;
    if (after) setTimeout(after, 480);
  }

  // Whose work this is. Without it a reader who spots something they like in
  // the creative reel gets a full-screen image and no way to tell which client
  // it belongs to — the hover tag they saw is gone the moment it opens.
  var lbLabels = null;
  function labelAt(i) {
    if (!lbLabels) return '';
    return typeof lbLabels === 'string' ? lbLabels : (lbLabels[i] || '');
  }

  function stamp() {
    if (!lbCount) return;
    var who = labelAt(lbI);
    lbCount.innerHTML = (who ? '<b>' + esc(who) + '</b>' : '') +
      '<span>' + (lbI + 1) + ' / ' + lbList.length + '</span>';
  }

  var lbReturn = null;

  function openLb(list, i, originFn, labels) {
    if (lbBusy) return;
    lbList = list; lbI = i < 0 ? 0 : i; lbOrigin = originFn || null;
    lbLabels = labels || null;
    lbReturn = (document.activeElement && document.activeElement.focus) ? document.activeElement : null;
    lbImg.src = lbList[lbI];
    stamp();
    lb.classList.add('is-open');
    // Everything that moves holds still while a picture is enlarged.
    document.body.classList.add('bv-locked', 'bv-lb-open');
    setCovered(true);
    setTimeout(function () { lb.classList.add('is-shown'); }, 20);
    // Blur only once the picture has finished growing out of its thumbnail —
    // same reason as the dossier veil.
    setTimeout(function () {
      if (lb.classList.contains('is-open')) lb.classList.add('is-settled');
    }, 460);
    setTimeout(function () {
      var x = document.getElementById('lbX');
      if (x && lb.classList.contains('is-open')) x.focus({ preventScroll: true });
    }, 60);
    ready(lbImg, function () {
      lbFlip(lbOrigin ? lbOrigin(lbI) : null, false);
    });
  }

  function closeLb() {
    // Deliberately NOT gated on lbBusy. Stepping sets that flag until the next
    // image has loaded, and over the CDN that can outlast the reader's patience
    // — closing must always win, and it cancels whatever step was in flight.
    if (!lb.classList.contains('is-open')) return;
    lbBusy = true;
    lb.classList.remove('is-shown', 'is-settled');
    lbFlip(lbOrigin ? lbOrigin(lbI) : null, true, function () {
      lb.classList.remove('is-open');
      lbImg.style.transition = 'none';
      lbImg.style.transform = '';
      lbImg.style.opacity = '';
      lbImg.removeAttribute('src');
      document.body.classList.remove('bv-lb-open');   // strips run again
      // …unless a dossier is STILL open behind this picture, in which case the
      // page underneath is as covered as it was a moment ago.
      setCovered(current >= 0);
      if (current < 0) document.body.classList.remove('bv-locked');
      lbBusy = false;
      // Back to the tile that was clicked — which may sit inside the dossier
      // still open behind this, so it is checked for reachability first.
      if (lbReturn) {
        var back = lbReturn;
        lbReturn = null;
        if (back.isConnected) { try { back.focus({ preventScroll: true }); } catch (err) {} }
      }
    });
  }

  lb.addEventListener('keydown', function (e) { trapTab(lb, e); });

  // Directional swap: the outgoing frame leaves the way you are travelling and
  // the incoming one arrives from the far side.
  function lbStep(d) {
    if (!lbList.length || lbBusy) return;
    lbBusy = true;
    lbI = (lbI + d + lbList.length) % lbList.length;
    stamp();

    // Wait for the outgoing frame to actually finish rather than trusting a
    // fixed timer — if the transition starts late the swap would clip it and
    // the picture appears to jump.
    var swapped = false;
    var swap = function () {
      if (swapped) return;
      swapped = true;
      lbImg.removeEventListener('transitionend', onEnd);
      lbImg.src = lbList[lbI];
      ready(lbImg, function () {
        lbImg.style.transition = 'none';
        lbImg.style.transform = 'translateX(' + (d * 70) + 'px) scale(.95)';
        void lbImg.offsetWidth;
        lbImg.style.transition = 'transform .42s ' + EASE + ', opacity .32s ease';
        lbImg.style.transform = '';
        lbImg.style.opacity = 1;
        setTimeout(function () { lbBusy = false; }, 430);
      });
    };
    var onEnd = function (e) { if (e.propertyName === 'opacity') swap(); };
    lbImg.addEventListener('transitionend', onEnd);
    setTimeout(swap, 420);                       // fallback if it never fires

    lbImg.style.transition = 'transform .24s ease-in, opacity .24s ease-in';
    lbImg.style.transform = 'translateX(' + (-d * 70) + 'px) scale(.95)';
    lbImg.style.opacity = 0;
  }

  document.getElementById('lbX').addEventListener('click', closeLb);
  document.getElementById('lbP').addEventListener('click', function (e) { e.stopPropagation(); lbStep(-1); });
  document.getElementById('lbN').addEventListener('click', function (e) { e.stopPropagation(); lbStep(1); });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target === lbImg || e.target.id === 'lbBg') closeLb();
  });

  /* ── keyboard ─────────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (lb.classList.contains('is-open')) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
      return;
    }
    if (caseEl.classList.contains('is-open')) {
      if (e.key === 'Escape') closeCase();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    }
  });

  /* ── masthead state + scroll spy ──────────────────────────────────────── */
  var mast = document.getElementById('mast');
  // Both navs are spied — the masthead one and the mobile menu — so the menu
  // already shows where the reader is the moment it opens.
  var links = Array.prototype.slice.call(document.querySelectorAll('#nav a[data-to], #menu a[data-to]'));
  function onScroll() {
    mast.classList.toggle('is-stuck', window.scrollY > 24);
    var bestTo = null, bestTop = -Infinity;
    links.forEach(function (a) {
      var s = document.getElementById(a.getAttribute('data-to'));
      if (!s) return;
      var top = s.getBoundingClientRect().top - 120;
      if (top <= 0 && top > bestTop) { bestTop = top; bestTo = a.getAttribute('data-to'); }
    });
    links.forEach(function (a) {
      var on = bestTo !== null && a.getAttribute('data-to') === bestTo;
      a.classList.toggle('is-here', on);
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── reveal on scroll ─────────────────────────────────────────────────── */
  var rio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  Array.prototype.forEach.call(document.querySelectorAll('.bv-rise'), function (n, i) {
    n.style.transitionDelay = ((i % 6) * 0.05).toFixed(2) + 's';
    rio.observe(n);
  });

  /* ── deep link ────────────────────────────────────────────────────────── */
  var m = /^#case=(.+)$/.exec(location.hash);
  if (m) openCase(decodeURIComponent(m[1]));
})();
