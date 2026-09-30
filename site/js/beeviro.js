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

  // Approved card logos; shared with the hero to reuse cached image requests.
  // Eighteen entries here, not the reference's twenty — volt-ems and
  // moamen-medhat leave the roster in a later task, so a logo for a client
  // with no record would be dead weight.
  // Keyed black-star, not the reference's block-star: the embed's own roster
  // shares that same stale spelling (it 404s this client's dossier images in
  // the hosted build), while site/js/clients.js and site/assets/work/ have
  // always used black-star.
  window.BV_CARD_LOGOS = {
    "black-star": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762d48b1d5ffbefb501d.jpg",
    "speakup": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762b8256c2fa61392950.jpg",
    "rinos-kitchen": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762bd1d912a8581560ac.jpg",
    "cognistar": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762e7e654f1003c15036.jpg",
    "qr-tably": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762b18bb814cf3e569e1.jpg",
    "master-craft": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762918bb814cf3e569ac.jpg",
    "electro-master": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab676298256c2fa613928c8.jpg",
    "daily-box": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762918bb814cf3e569a1.jpg",
    "freestyle": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab676297e654f1003c14f7c.jpg",
    "kinetic-health": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab67629d1d912a85815605f.jpg",
    "edara-plus": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6762c1f3be2be1badd8e5.jpg",
    "renda-perfumes": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0c7e654f1003c6d4ee.jpeg",
    "moaafa": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0a53ee44f56b3800d1.png",
    "eqbal": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0a974a9da6eec32f61.png",
    "rojana": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0a7e654f1003c6d4a2.png",
    "kirin": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0a5d164712786c1b6e.png",
    "izar": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6aa0a3ae3da26fb64da9c.jpg",
    "shalaby-labs": "https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6a7ff81199074f5ef6c347cc.png"
};

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
         lettered placeholder.
         BV_CARD_LOGOS holds the approved, CDN-hosted marks and outranks
         everything below — including the older local asset in c.logo — once a
         client's mark is approved there. */
      var lead;
      var updatedLogo=window.BV_CARD_LOGOS[c.slug];
      if (updatedLogo) {
        b.classList.add('bv-card--logo');
        lead='<span class="bv-card__plate"><img loading="eager" decoding="async" width="640" height="640" src="'+esc(updatedLogo)+'" alt="'+esc(c.name)+' logo"></span>';
      } else if (c.logo) {
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
      if (updatedLogo || c.logo || !c.work) b.querySelector('.bv-card__img').classList.add('is-loaded');
      b.addEventListener('click', function () { openCase(c.slug, b); });
      host.appendChild(b);
    });

    var cards = Array.prototype.slice.call(host.children);

    /* ── industry filter + brand search ──────────────────────────────────
       Ported from beeviro-embed.html's work section. There the filter bar
       sits inside a horizontally-scrolling carousel (prev/next arrows,
       scroll-snap) — that carousel is a later reconciliation task's
       territory, so only the bar and #workStatus are wired up here.
       Both controls narrow this SAME `cards` array by toggling `hidden`;
       neither ever touches `host`'s child order, which stays exactly what
       applyOrder() produced from BV_ORDER at the top of this file — a
       filter that re-sorted would silently undo whatever order a later
       task gives BV_ORDER.
       Wiring this up also takes over full-roster visibility from "six,
       then Show More" below: the reference has no page cap at all (every
       card is always in the DOM, narrowed only by the filter), and a
       six-card default alongside an independent filter would fight over
       who owns `.hidden` — paging after a search would either resurrect
       filtered-out cards or re-hide filtered-in ones. Returning below
       leaves `wrap` and its button permanently dormant instead. */
    var industryFilter = document.getElementById('industryFilter');
    var searchFilter = document.getElementById('searchFilter');
    var workStatus = document.getElementById('workStatus');
    if (industryFilter && searchFilter && workStatus) {
      var rtl = !!window.BV_I18N.rtl;
      industryFilter.add(new Option(rtl ? 'كل الفئات' : 'All categories', ''));
      Array.from(new Set(C.map(function (c) { return c.industry; }))).sort().forEach(function (name) {
        industryFilter.add(new Option(name, name));
      });
      if (rtl) {
        searchFilter.placeholder = 'ابحث باسم العلامة التجارية...';
        searchFilter.setAttribute('aria-label', searchFilter.placeholder);
        industryFilter.setAttribute('aria-label', 'تصفية حسب الفئة');
      }
      var runFilter = function () {
        var query = searchFilter.value.trim().toLocaleLowerCase(), matched = 0;
        cards.forEach(function (card, i) {
          card.hidden = !!((industryFilter.value && C[i].industry !== industryFilter.value) ||
            (query && !C[i].name.toLocaleLowerCase().includes(query)));
          if (!card.hidden) matched++;
        });
        // No "swipe or use the arrows" tail here — that instruction only
        // means anything next to the carousel this task does not port.
        workStatus.textContent = matched
          ? (rtl ? matched + ' علامة تجارية' : matched + (matched === 1 ? ' brand' : ' brands'))
          : (rtl ? 'لا توجد نتائج. جرّب بحثًا آخر.' : 'No matching brands. Try another search or category.');
      };
      industryFilter.addEventListener('change', runFilter);
      searchFilter.addEventListener('input', runFilter);
      runFilter();
      window.BV_REVEAL_CARD = function (slug) {
        var card = cards.find(function (c) { return c.dataset.slug === slug; });
        if (card && card.hidden) { industryFilter.value = ''; searchFilter.value = ''; runFilter(); }
      };
      return;
    }

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

  /* Mark the logo cards whose artwork is too far from the frame's shape to be
     cropped into it. `cover` is right for a square mark and ruinous for a wide
     lockup, and which one a client sends is not knowable in advance — so read
     it off the file. FRAME_RATIO tracks .bv-card__img; MAX_CROP is the share of
     the long edge we are willing to lose before showing the mark whole
     instead. A square mark against this frame loses about 0.11. */
  var FRAME_RATIO = 372 / 416;
  var MAX_CROP = 0.25;
  function gradeLogo(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    var card = img.closest('.bv-card--logo');
    if (!card) return;
    var r = img.naturalWidth / img.naturalHeight;
    var lost = r > FRAME_RATIO ? 1 - (FRAME_RATIO / r) : 1 - (r / FRAME_RATIO);
    card.classList.toggle('bv-card--wide', lost > MAX_CROP);
  }
  /* Capturing, because `load` does not bubble — the same reason the light-copy
     swap above listens this way. Covers cards the carousel builds later. */
  document.addEventListener('load', function (e) {
    var n = e.target;
    if (n && n.tagName === 'IMG' && n.closest('.bv-card--logo')) gradeLogo(n);
  }, true);
  (function gradeLoaded() {
    var done = document.querySelectorAll('.bv-card--logo .bv-card__plate img');
    for (var i = 0; i < done.length; i++) if (done[i].complete) gradeLogo(done[i]);
  })();

  /* ── testimonials ──────────────────────────────────────────────────────
     Real client footage, straight after the cases it is talking about.

     THE POSTERS ARE BAKED IN. These are 15, 51 and 45 MB files and not one of
     them is fast-start, so `preload="metadata"` would spend three range
     requests reaching the END of three large files just to learn their
     dimensions — and still paint black. A 512px frame lifted out of each film
     costs about 11 KB here, needs no upload, and means the section has
     something to look at the moment it is reached.

     Nobody is named here. Each film already carries its own lower-third, so
     the speaker identifies themselves on screen — repeating it in the chrome
     would be this page making a claim about a real person on their behalf,
     which is not ours to make. The rail numbers the films instead. */
  window.BV_TESTIMONIALS = [
    { src: 'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6a8cb5d164712786bf8c4.mp4', secs: 57,
      poster: 'data:image/jpeg;base64,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' },
    { src: 'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6a8cb70f8593c3295229e.mp4', secs: 42,
      poster: 'data:image/jpeg;base64,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' },
    { src: 'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6a8cb15ef56c94e495ff1.mp4', secs: 103,
      poster: 'data:image/jpeg;base64,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' }
  ];

  window.BV_TESTIMONIALS.push({
    src: 'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6f51f5d16471278733f85.mp4',
    poster: 'https://assets.cdn.filesafe.space/PWyhncZ0y766gD1TL1PO/media/6ab6f761974a9da6eecaae0e.png'
  });

  (function testimonials() {
    var host = document.getElementById('testi');
    if (!host) return;
    var list = (window.BV_TESTIMONIALS || []).filter(function (t) { return t && t.src; });
    if (!list.length) { host.closest('.bv-section').hidden = true; return; }

    function clock(n) {
      var r = n % 60;
      return Math.floor(n / 60) + ':' + (r < 10 ? '0' : '') + r;
    }

    /* ONE video element for the whole section. Three would each be able to
       buffer a 45 MB file; this way only the chosen film is ever in flight,
       and switching picks abandons the previous one by construction. */
    var stage = el('div', 'bv-testi__stage');
    var v = document.createElement('video');
    v.preload = 'none';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('controls', '');
    v.disablePictureInPicture = true;
    v.setAttribute('disablepictureinpicture', '');
    /* Same house rule the dossier film follows: nothing here takes the screen. */
    v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback nofullscreen');
    window.BV_NO_FULLSCREEN && window.BV_NO_FULLSCREEN(v);
    v.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    var play = el('button', 'bv-testi__play');
    play.type = 'button';
    play.innerHTML = '<span class="bv-testi__hex"><svg width="24" height="24" viewBox="0 0 24 24"'
      + ' fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span>';

    var bar = el('div', 'bv-testi__bar');
    bar.innerHTML = '<i></i>';
    var fill = bar.firstChild;

    stage.appendChild(v); stage.appendChild(play);
    stage.appendChild(bar);

    var rail = el('div', 'bv-testi__rail');
    var picks = [];
    var at = -1;

    function start() {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function show(i, andPlay) {
      if (i === at) { if (andPlay) start(); return; }
      at = i;
      var t = list[i];
      v.pause();
      stage.classList.remove('is-playing');
      fill.style.width = '0';
      v.poster = t.poster || '';
      v.src = t.src;
      v.setAttribute('aria-label', T('testi.n', { i: i + 1 }));
      for (var k = 0; k < picks.length; k++) {
        picks[k].classList.toggle('is-on', k === i);
        picks[k].setAttribute('aria-selected', String(k === i));
      }
      if (andPlay) start();
    }

    v.addEventListener('play', function () { stage.classList.add('is-playing'); });
    v.addEventListener('pause', function () { stage.classList.remove('is-playing'); });
    v.addEventListener('ended', function () { stage.classList.remove('is-playing'); });
    v.addEventListener('timeupdate', function () {
      if (!v.duration) return;
      fill.style.width = (v.currentTime / v.duration * 100).toFixed(2) + '%';
    });
    play.addEventListener('click', start);

    list.forEach(function (t, i) {
      var b = el('button', 'bv-testi__pick');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', T('testi.play') + ' ' + T('testi.n', { i: i + 1 }));
      b.innerHTML =
        (t.poster ? '<img loading="lazy" decoding="async" src="' + t.poster + '" alt="">' :
          '<svg viewBox="0 0 160 90" width="100%" aria-hidden="true"><rect width="160" height="90" fill="#171717"/><path d="M70 30v30l24-15z" fill="#ffea00"/></svg>') +
        '<span class="bv-testi__meta"><b>' +
          (i + 1 < 10 ? '0' : '') + (i + 1) +
        '</b><span>' + (t.secs ? clock(t.secs) : T('testi.play')) + '</span></span>';
      b.addEventListener('click', function () { show(i, true); });
      /* Left and right walk the rail, the way a tab list should. */
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + picks.length) % picks.length;
        picks[n].focus();
        show(n, false);
      });
      picks.push(b);
      rail.appendChild(b);
    });

    rail.setAttribute('role', 'tablist');
    host.appendChild(stage);
    host.appendChild(rail);
    show(0, false);

    /* Scrolling away should not leave a voice talking behind the reader, and
       neither should opening a dossier over the top of it. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting && !v.paused) v.pause();
      }, { threshold: 0.15 }).observe(host);
    }
    document.addEventListener('bv:cover', function (e) {
      if (e.detail && e.detail.covered && !v.paused) v.pause();
    });
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
