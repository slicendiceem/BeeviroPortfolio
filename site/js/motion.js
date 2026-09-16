/* Beeviro portfolio — scroll & motion layer.
   Runs after beeviro.js has rendered the DOM. Everything here degrades to a
   static page if it fails, and switches itself off under prefers-reduced-motion. */
(function () {
  'use strict';

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* The motion tier, decided in perf.js before any of this ran. LITE is not
     "reduced motion" — a reader on lite still gets every scroll reveal, every
     transition and both carousels. What it drops is the per-frame work: the
     hero canvas, the pointer companion, the pointer-tracking tilts and the
     JS strip driver. Those are the four things that cost a frame budget rather
     than a one-off transition, and they are why the page stuttered on a phone.
     RICH is the shorthand for "we can afford per-frame work". */
  var LITE = !!(window.BV_PERF && window.BV_PERF.lite);
  var RICH = !REDUCED && !LITE;

  /* COVERED — an overlay is over the page, so nothing behind it may spend a
     frame. Set from beeviro.js when a dossier or the lightbox opens, broadcast
     once per change rather than polled, and read by every loop below.
     `wake` is what each effect registers so it can restart itself: a rAF loop
     that returns early is stopped for good unless something kicks it. */
  var COVERED = false;
  var wakers = [];
  var onUncover = function (fn) { wakers.push(fn); };
  document.addEventListener('bv:cover', function (e) {
    COVERED = !!(e.detail && e.detail.covered);
    if (!COVERED) wakers.forEach(function (fn) { try { fn(); } catch (err) { /* keep going */ } });
  });

  /* What this file decided, AT LOAD, recorded where a test can read it. These
     are captured once and every effect below branches on them, so reading
     `BV_PERF.lite` or matchMedia() later answers a different question — the tier
     can change under the watchdog after these were fixed. Chasing "the strips
     are not running but nothing is reduced or lite" without this meant guessing
     from side effects. */
  window.BV_MOTION = { reduced: REDUCED, lite: LITE, rich: RICH };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ── 0. boot sequence ─────────────────────────────────────────────────── */
  (function boot() {
    var boot = $('#boot');
    if (!boot) return;
    var n = $('#bootN'), bar = $('#bootBar');
    var lift = function () {
      boot.classList.add('is-done');
      document.body.classList.remove('bv-booting');
      document.documentElement.classList.add('is-booted');
    };
    if (REDUCED) { lift(); return; }

    document.body.classList.add('bv-booting');
    requestAnimationFrame(function () { boot.classList.add('is-drawing'); });

    // A device that is already struggling should not be made to wait through a
    // second and a half of ceremony before it can see anything.
    var t0 = performance.now(), DUR = LITE ? 620 : 1500;
    (function tick(now) {
      var p = clamp((now - t0) / DUR, 0, 1);
      var eased = 1 - Math.pow(1 - p, 2.2);
      if (n) n.textContent = Math.round(eased * 100);
      if (bar) bar.style.transform = 'scaleX(' + eased.toFixed(3) + ')';
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(lift, 220);
    })(t0);

    // Never let a stalled frame loop trap the page behind the boot screen.
    setTimeout(lift, 4200);
  })();

  /* ── 0a. mobile menu ──────────────────────────────────────────────────── */
  /* Under 900px the masthead nav is hidden, so this is the only route to a
     section. Kept deliberately plain: open, close, and get out of the way. */
  (function menu() {
    var btn = $('#burger'), panel = $('#menu');
    if (!btn || !panel) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false;
      document.body.classList.add('bv-locked');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      // one frame on the wall so the opacity transition has a start value;
      // setTimeout rather than rAF, which is frozen in a background tab
      setTimeout(function () { panel.classList.add('is-shown'); }, 15);
    }

    function close(restore) {
      if (panel.hidden) return;
      panel.classList.remove('is-shown');
      document.body.classList.remove('bv-locked');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      setTimeout(function () { panel.hidden = true; }, 380);
      if (restore && lastFocus && lastFocus.focus) lastFocus.focus();
    }

    btn.addEventListener('click', function () {
      panel.hidden ? open() : close(true);
    });

    // A link both navigates and dismisses. The panel is fixed and covers the
    // page, so it has to be out of the way before the scroll lands.
    $$('a', panel).forEach(function (a) {
      a.addEventListener('click', function () { close(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) close(true);
    });

    // Rotating a phone into landscape can cross 900px with the panel open,
    // where it is display:none but body is still scroll-locked.
    matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches) close(false);
    });

    window.BV_MENU_CLOSE = function () { close(false); };
  })();

  /* ── 0b. pointer companion ────────────────────────────────────────────── */
  (function cursor() {
    var c = $('#cursor');
    if (!c || !RICH || !matchMedia('(hover:hover)').matches) return;
    var label = $('#cursorLabel');
    var dot = c.querySelector('.bv-cursor__dot');
    var ring = c.querySelector('.bv-cursor__ring');
    var x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    var wake = function () {};              // assigned once the loop is defined

    addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      wake();
      c.classList.add('is-live');
      // Hide the OS cursor only now — the moment ours is actually on screen.
      // Doing it from CSS alone would leave no cursor at all if this script
      // never ran.
      document.documentElement.classList.add('bv-cursor-on');
      var hit = e.target.closest('[data-cursor]');
      if (hit) {
        c.classList.add('is-hot');
        if (label) label.textContent = hit.getAttribute('data-cursor');
      } else {
        c.classList.remove('is-hot');
      }
    }, { passive: true });
    addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    addEventListener('pointerup', function () { c.classList.remove('is-down'); });
    addEventListener('pointerleave', function () { c.classList.remove('is-live'); });

    /* The follow loop used to run for the life of the page, repainting three
       elements sixty times a second at a pointer that had not moved since the
       reader started reading. It now sleeps as soon as the ring has caught up
       and is woken by the next pointermove. */
    var running = false;
    function follow() {
      // the dot tracks exactly, the ring trails — that lag is the whole effect
      rx = lerp(rx, x, 0.18); ry = lerp(ry, y, 0.18);
      if (dot) dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (ring) ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
      // the -50% keeps the caption centred under the ring at any width
      if (label) label.style.transform =
        'translate(' + rx.toFixed(1) + 'px,' + (ry + 52).toFixed(1) + 'px) translate(-50%,-50%)';
      if (Math.abs(x - rx) > 0.25 || Math.abs(y - ry) > 0.25) requestAnimationFrame(follow);
      else running = false;
    }
    wake = function () { if (!running) { running = true; requestAnimationFrame(follow); } };
    wake();
  })();

  /* ── 1. scroll progress rail ──────────────────────────────────────────── */
  var bar = $('#prog');

  /* ── 2. hero honeycomb canvas ─────────────────────────────────────────── */
  function heroCanvas() {
    var cv = $('#comb');
    if (!cv || !RICH) return function () {};
    var ctx = cv.getContext('2d', { alpha: true, desynchronized: true });
    var hero = $('#hero');
    var W = 0, H = 0, dpr = 1, cells = [], t0 = performance.now();
    var px = 0.5, py = 0.45, tpx = 0.5, tpy = 0.45;   // pointer, eased
    var live = true, energy = 0;
    /* This is a soft glow of hairline hexagons behind a photograph — nobody
       will ever resolve a device pixel of it, and painting it at dpr 2 was
       quadrupling the fill for no visible gain. Capped at 1.25, and the whole
       thing repaints at 30fps rather than 60: it is a slow wave, and at half
       the frames it looks identical and costs half as much. */
    var STEP = 1000 / 30;
    var lastPaint = 0;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      W = hero.clientWidth; H = hero.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Hex grid sized so it always covers the hero with a margin. A bigger
      // circumradius means fewer cells to stroke every frame; at this opacity
      // the difference in the picture is not visible.
      var R = Math.max(34, Math.min(56, W / 26));      // circumradius
      var hstep = R * 1.732;                            // pointy-top horizontal step
      var vstep = R * 1.5;
      cells = [];
      for (var row = -1; vstep * row < H + R * 2; row++) {
        for (var col = -1; hstep * col < W + R * 2; col++) {
          var x = col * hstep + (row % 2 ? hstep / 2 : 0);
          var y = row * vstep;
          cells.push({ x: x, y: y, r: R, seed: Math.random() * Math.PI * 2 });
        }
      }
    }

    function hexPath(x, y, r) {
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 90);
        var px2 = x + r * Math.cos(a), py2 = y + r * Math.sin(a);
        i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
      }
      ctx.closePath();
    }

    function frame(now) {
      if (!live) return;
      if (window.BV_PERF && window.BV_PERF.lite) { live = false; ctx.clearRect(0, 0, W, H); return; }
      /* A few hundred hexagons stroked per frame, behind an opaque dossier.
         This was the single most expensive invisible thing on the page. */
      if (COVERED) { live = false; return; }
      if (now - lastPaint < STEP) { requestAnimationFrame(frame); return; }
      lastPaint = now;
      var t = (now - t0) / 1000;
      px = lerp(px, tpx, 0.06); py = lerp(py, tpy, 0.06);
      var cx = px * W, cy = py * H;
      var maxD = Math.hypot(W, H) * 0.62;

      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;

      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var d = Math.hypot(c.x - cx, c.y - cy) / maxD;
        // travelling wave outward from the pointer + slow idle breathing
        var wave = Math.sin(t * 1.5 - d * 5.2 + c.seed) * 0.5 + 0.5;
        var prox = clamp(1 - d, 0, 1);
        var v = wave * 0.35 + prox * 0.72 + energy * 0.25;
        v = clamp(v, 0, 1);
        if (v < 0.05) continue;

        var r = c.r * (0.52 + v * 0.3);
        hexPath(c.x, c.y, r);
        ctx.strokeStyle = 'rgba(255,194,2,' + (v * 0.30).toFixed(3) + ')';
        ctx.stroke();
        if (v > 0.62) {
          ctx.fillStyle = 'rgba(255,194,2,' + ((v - 0.62) * 0.30).toFixed(3) + ')';
          ctx.fill();
        }
      }
      energy *= 0.94;
      requestAnimationFrame(frame);
    }

    build();
    requestAnimationFrame(frame);
    // Debounced: `resize` fires on every frame of a window drag, and each call
    // reallocates the backing store and rebuilds the whole cell list.
    var rz = null;
    addEventListener('resize', function () {
      clearTimeout(rz);
      rz = setTimeout(build, 180);
    });
    addEventListener('pointermove', function (e) {
      var b = hero.getBoundingClientRect();
      tpx = clamp((e.clientX - b.left) / b.width, -0.2, 1.2);
      tpy = clamp((e.clientY - b.top) / b.height, -0.2, 1.2);
    }, { passive: true });

    // Stop painting once the hero is off screen — this is the only rAF loop
    // on the page and it has no business running behind 25 case files.
    var onScreen = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        onScreen = e.isIntersecting;
        if (onScreen && !live && !COVERED) { live = true; requestAnimationFrame(frame); }
        else if (!onScreen) live = false;
      });
    }, { threshold: 0.01 }).observe(hero);
    // Closing the overlay has to restart it: `live = false` ends the loop, and
    // the observer will not fire again if the hero never left the viewport.
    onUncover(function () {
      if (onScreen && !live) { live = true; requestAnimationFrame(frame); }
    });

    return function (v) { energy = clamp(energy + v, 0, 1.2); };
  }
  var kick = heroCanvas();

  /* ── 3. split headings into words for a scroll reveal ─────────────────── */
  // Wraps every word in a .bv-w while preserving inline markup (<br>, <span>),
  // then staggers them in when the heading arrives.
  function splitWords(host) {
    var out = host.cloneNode(false);
    (function rebuild(src, dst) {
      Array.prototype.slice.call(src.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { dst.appendChild(document.createTextNode(tok)); return; }
            var w = document.createElement('span');
            w.className = 'bv-w';
            w.textContent = tok;
            dst.appendChild(w);
          });
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { dst.appendChild(n.cloneNode()); return; }
          var el = n.cloneNode(false);
          dst.appendChild(el);
          rebuild(n, el);
        }
      });
    })(host, out);
    host.innerHTML = out.innerHTML;
    $$('.bv-w', host).forEach(function (w, i) {
      w.style.transitionDelay = (i * 0.045).toFixed(3) + 's';
    });
  }

  $$('.bv-h2, .bv-quote').forEach(function (h) {
    if (REDUCED) { h.classList.add('is-lit'); return; }
    if (h.dataset.split) return;
    h.dataset.split = '1';
    splitWords(h);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { h.classList.add('is-lit'); io.unobserve(h); }
      });
    }, { threshold: 0.2 });
    io.observe(h);
  });

  /* ── 4. count-up stats ────────────────────────────────────────────────── */
  $$('.bv-stat__v').forEach(function (n) {
    var target = n.textContent.trim();
    var num = parseFloat(target.replace(/[^0-9.]/g, ''));
    if (!isFinite(num) || REDUCED) return;
    var suffix = target.replace(/[0-9.,]/g, '');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(n);
        var t0 = performance.now(), dur = 1100;
        (function tick(now) {
          var p = clamp((now - t0) / dur, 0, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          n.textContent = Math.round(num * eased).toLocaleString() + suffix;
          if (p < 1) requestAnimationFrame(tick); else n.textContent = target;
        })(performance.now());
      });
    }, { threshold: 0.5 });
    io.observe(n);
  });

  /* ── 4b. torch: the lit comb follows the pointer ──────────────────────── */
  var torch = $('#torch');
  var heroEl = $('#hero');
  var tx = 70, ty = 45, ttx = 70, tty = 45, torchOn = false;
  if (torch && heroEl && !REDUCED) {
    heroEl.addEventListener('pointermove', function (e) {
      var b = heroEl.getBoundingClientRect();
      ttx = clamp(((e.clientX - b.left) / b.width) * 100, -10, 110);
      tty = clamp(((e.clientY - b.top) / b.height) * 100, -10, 110);
      torchOn = true;
    }, { passive: true });
    heroEl.addEventListener('pointerleave', function () { torchOn = false; }, { passive: true });

    // Idle drift so the hero is alive before anyone touches it, and on touch
    // devices where there is no pointer at all.
    var t0 = performance.now();
    (function driftAndEase(now) {
      if (!torchOn) {
        var t = (now - t0) / 1000;
        ttx = 62 + Math.cos(t * 0.28) * 22;
        tty = 46 + Math.sin(t * 0.21) * 18;
      }
      tx = lerp(tx, ttx, 0.07);
      ty = lerp(ty, tty, 0.07);
      torch.style.setProperty('--mx', tx.toFixed(2) + '%');
      torch.style.setProperty('--my', ty.toFixed(2) + '%');
      requestAnimationFrame(driftAndEase);
    })(performance.now());
  }

  /* ── 4c. pinned method section, scrubbed by scroll ────────────────────── */
  var pinRail = $('#pinRail');
  var pinFill = $('#pinFill');
  var combCells = $$('.bv-comb .bv-cell');
  var stagePanel = $('#stagePanel');
  var stageNo = $('#stageNo'), stageT = $('#stageT'), stageD = $('#stageD');
  var STAGES = window.BV_STAGES || [];
  var shownStage = -1;

  function showStage(i) {
    if (i === shownStage || !STAGES[i] || !stagePanel) return;
    shownStage = i;
    stagePanel.classList.add('is-swapping');
    setTimeout(function () {
      stageNo.textContent = String(i + 1).padStart(2, '0');
      stageT.textContent = STAGES[i].label;
      stageD.textContent = STAGES[i].hint;
      stagePanel.classList.remove('is-swapping');
    }, 190);
  }

  function scrubPin() {
    if (!pinRail || !combCells.length) return;
    var n = combCells.length;

    // Below the breakpoint the rail collapses to auto height and there is no
    // pin — fill everything and let the ordinary observers handle reveal.
    if (pinRail.offsetHeight < innerHeight * 1.5) {
      combCells.forEach(function (c) {
        c.classList.add('is-on', 'is-in', 'is-filled');
        c.querySelector('.bv-cell__fill').style.setProperty('--f', 1);
      });
      if (pinFill) pinFill.style.transform = 'scaleX(1)';
      showStage(n - 1);
      return;
    }

    var b = pinRail.getBoundingClientRect();
    var travel = b.height - innerHeight;
    var p = clamp(-b.top / (travel || 1), 0, 1);
    if (pinFill) pinFill.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    // Spread the six cells across the first 88% of travel so the last one has
    // a beat to sit before the section releases.
    var pos = clamp(p / 0.88, 0, 1) * n;
    var active = clamp(Math.floor(pos), 0, n - 1);
    combCells.forEach(function (c, i) {
      // each cell fills over its own slice, so honey rises as you scroll
      var f = clamp(pos - i, 0, 1);
      c.querySelector('.bv-cell__fill').style.setProperty('--f', f.toFixed(3));
      c.classList.toggle('is-on', i === active);
      c.classList.toggle('is-filled', f > 0.55);
      c.classList.add('is-in');
    });
    showStage(active);
  }

  // Let a cell click scroll the pin to that stage.
  window.BV_PIN = {
    goTo: function (i) {
      if (!pinRail) return;
      var travel = pinRail.offsetHeight - innerHeight;
      if (travel <= 0) return;
      var top = pinRail.getBoundingClientRect().top + scrollY;
      var frac = ((i + 0.5) / combCells.length) * 0.88;
      scrollTo({ top: Math.round(top + travel * frac), behavior: REDUCED ? 'auto' : 'smooth' });
    },
  };

  /* ── 4d. decode scramble on the mono eyebrows ─────────────────────────── */
  var GLYPHS = '▓▒░#$%&*+=<>/\\|{}[]';
  /* Skipped entirely in Arabic: the effect swaps characters for block glyphs
     before resolving them, and in a connected script that means every letter
     drops to its isolated form and the word visibly falls apart rather than
     decoding. The eyebrow simply arrives. */
  var CAN_SCRAMBLE = RICH && !(window.BV_I18N && window.BV_I18N.rtl);
  $$('.bv-eyebrow').forEach(function (n) {
    if (!CAN_SCRAMBLE) return;
    var real = n.textContent;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(n);
        var start = performance.now(), dur = 620;
        n.classList.add('is-scrambling');
        (function tick(now) {
          var p = clamp((now - start) / dur, 0, 1);
          var keep = Math.floor(real.length * p);
          var out = '';
          for (var i = 0; i < real.length; i++) {
            out += i < keep || real[i] === ' '
              ? real[i]
              : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          n.textContent = out;
          if (p < 1) requestAnimationFrame(tick);
          else { n.textContent = real; n.classList.remove('is-scrambling'); }
        })(start);
      });
    }, { threshold: 0.6 });
    io.observe(n);
  });

  /* ── 4e. magnetic CTAs ────────────────────────────────────────────────── */
  if (RICH && matchMedia('(hover:hover)').matches) {
    $$('.bv-cta').forEach(function (b) {
      b.classList.add('is-mag');
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = 'translate(' + (dx * 12).toFixed(1) + 'px,' + (dy * 9).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ── 5. pointer tilt on work cards ────────────────────────────────────── */
  /* Pointer tilt writes a transform on every pointermove over a card — cheap
     per event, but on a grid of cards it is a continuous stream of layer
     invalidations, and it is invisible on a touch device. Rich tier only. */
  if (RICH && matchMedia('(hover:hover)').matches) {
    $$('.bv-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var b = c.getBoundingClientRect();
        var rx = ((e.clientY - b.top) / b.height - 0.5) * -5;
        var ry = ((e.clientX - b.left) / b.width - 0.5) * 5;
        c.style.transform = 'translateY(-6px) perspective(900px) rotateX(' + rx.toFixed(2) +
          'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }

  /* ── 6. scroll driver: progress, hero parallax, marquee velocity ──────── */
  var hero = $('#hero');
  var heroInner = $('.bv-hero__inner');
  var glow = $('.bv-hero__glow');
  var marquees = $$('.bv-marquee');
  var reels = $$('.bv-reel');
  var photos = $$('.bv-hero__photo');
  var dripFill = $('#dripFill'), dripBead = $('#dripBead'), dripRail = $('#drip');
  var fillHead = $('#fillHead');
  var footMark = $('.bv-foot__mark');
  var last = scrollY, vel = 0, ticking = false, dir = 1;

  function onFrame() {
    ticking = false;
    var y = scrollY;
    var doc = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (doc > 0 ? clamp(y / doc, 0, 1) : 0) + ')';

    if (hero && heroInner && !REDUCED) {
      var h = hero.offsetHeight || 1;
      var p = clamp(y / h, 0, 1);
      heroInner.style.transform = 'translate3d(0,' + (p * 90).toFixed(1) + 'px,0)';
      heroInner.style.opacity = (1 - p * 1.15).toFixed(3);
      if (glow) glow.style.transform = 'translateY(-50%) scale(' + (1 + p * 0.5).toFixed(3) + ')';
      // Photo layers drift slower than the copy and push in slightly. Scaling a
      // full-bleed background image every frame is one of the most expensive
      // things on the page — a whole-viewport raster — so it is rich-tier only.
      if (RICH) {
        photos.forEach(function (ph) {
          ph.style.transform = 'translate3d(0,' + (p * -46).toFixed(1) + 'px,0) scale(' +
            (1 + p * 0.11).toFixed(4) + ')';
        });
      }
      // The torch widens as you move, then settles.
      if (torch) {
        var base = innerWidth < 760 ? 42 : 30;
        torch.style.setProperty('--torch', (base + clamp(Math.abs(vel) / 6, 0, 16)).toFixed(1) + 'vmax');
      }
    }

    scrubPin();

    var prog = doc > 0 ? clamp(y / doc, 0, 1) : 0;

    // Honey running down the edge: the column fills, and a bead rides the
    // leading edge, stretching when you move fast and rounding when you stop.
    if (dripFill && !REDUCED) {
      dripFill.style.transform = 'scaleY(' + prog.toFixed(4) + ')';
      if (dripBead && dripRail) {
        var railH = dripRail.clientHeight;
        var stretch = 1 + clamp(Math.abs(vel) / 40, 0, 1.6);
        dripBead.style.transform = 'translateY(' + (prog * railH).toFixed(1) +
          'px) scaleY(' + stretch.toFixed(2) + ') scaleX(' + (1 / Math.sqrt(stretch)).toFixed(2) + ')';
      }
    }

    // The big contact heading fills with honey as it crosses the viewport.
    if (fillHead && !REDUCED) {
      var r = fillHead.getBoundingClientRect();
      var f = clamp((innerHeight * 0.86 - r.top) / (r.height + innerHeight * 0.34), 0, 1);
      fillHead.style.setProperty('--fill', (f * 100).toFixed(1) + '%');
    }

    // Footer mark turns with the page.
    if (footMark && !REDUCED) footMark.style.setProperty('--spin', (prog * 140).toFixed(1) + 'deg');

    if (RICH) {
      // Carousel tiles lean the opposite way to the marquee text, so the two
      // rows read as one system reacting rather than two effects, and smear
      // when the scroll is fast. `--smear` drives a blur filter over a strip of
      // photographs, which is exactly the sort of thing that turns a scroll
      // into a slideshow on a weak GPU — so it does not exist on lite.
      var lean = clamp(-vel / 26, -3.5, 3.5).toFixed(2) + 'deg';
      var smear = clamp(Math.abs(vel) / 55, 0, 2.4).toFixed(2) + 'px';
      reels.forEach(function (r2) {
        r2.style.setProperty('--lean', lean);
        r2.style.setProperty('--smear', smear);
      });
    }
    if (!REDUCED) {
      // Direction the reader is travelling — the strip driver below uses it.
      if (vel > 1.2) dir = 1;
      else if (vel < -1.2) dir = -1;
    }

    // Marquee items lean into the scroll. Two deliberate choices here:
    //  - not animation-duration: rewriting it mid-run remaps elapsed time and
    //    the marquee visibly jumps every frame;
    //  - not an inline transform on the track: a running CSS animation outranks
    //    inline style for transform, so it would be silently ignored. The skew
    //    goes on the container as a custom property and the items consume it.
    if (RICH) {
      var skew = clamp(vel / 14, -7, 7).toFixed(2) + 'deg';
      marquees.forEach(function (m) { m.style.setProperty('--skew', skew); });
      if (kick) kick(Math.abs(vel) / 900);
    }
    vel *= 0.86;
    if (Math.abs(vel) > 0.4 && !ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }

  addEventListener('scroll', function () {
    vel = scrollY - last; last = scrollY;
    if (!ticking) { ticking = true; requestAnimationFrame(onFrame); }
  }, { passive: true });
  onFrame();

  /* ── 6b. strip driver: marquees + creative reels run from JS ──────────── */
  // A CSS animation outranks inline transform, so the stylesheet keeps its
  // animation as a no-JS fallback and we switch it off here once we take over.
  // Driving them by hand is what lets the direction FLIP with the reader —
  // toggling `animation-direction` remaps elapsed time and jumps the strip.
  /* ── 6a. enough copies to tile ─────────────────────────────────────────────
     REPORTED: "the bottom infinite loop of pictures isn't working as well as
     the band". Two of these were true at once.

     This is the second and worse one. A seamless loop is the same track laid
     end to end and wrapped at one track width — and TWO copies are only enough
     when a single copy is wider than the frame. If it is narrower, the pair
     spans 2w while the loop travels w, so once the strip has moved more than
     (2w − frame) a hole opens at the trailing edge and stays open until the
     wrap snaps it back.

     It showed up in Arabic first because the Arabic capability words are short
     — that band's track is 1240px against a 1440px frame — but it is not an
     Arabic bug. The English band is 1544px, so it breaks on any screen wider
     than about 1600px, which is most desktops.

     So: clone until the copies span the frame plus one whole loop. Done for
     every tier, not just inside the JS driver, because the lite tier and the
     no-JS fallback run the same strips off a CSS animation that translates by
     one track width and has exactly the same requirement. */
  function tileStrips() {
    $$('.bv-marquee, .bv-reel, .bv-gal__view').forEach(function (el) {
      var sel = el.classList.contains('bv-marquee') ? '.bv-marquee__track'
        : el.classList.contains('bv-reel') ? '.bv-reel__track' : '.bv-gal__track';
      var tracks = $$(sel, el);
      if (tracks.length < 1) return;
      var w = tracks[0].scrollWidth;
      var frame = el.clientWidth;
      if (!w || !frame) return;
      var need = Math.ceil(frame / w) + 1;
      if (need < 2) need = 2;
      // Clone the LAST one: on a case shelf that is the ghost copy, and cloning
      // it carries its aria-hidden and its --ghost class, which is what the
      // spread-to-grid rule keys off.
      while (tracks.length < need && tracks.length < 12) {
        var clone = tracks[tracks.length - 1].cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        el.appendChild(clone);
        tracks.push(clone);
      }
    });
  }
  tileStrips();
  var reTile = null;
  addEventListener('resize', function () {
    clearTimeout(reTile);
    reTile = setTimeout(tileStrips, 200);
  });

  (function driveStrips() {
    /* Lite tier hands the strips back to the CSS animation that is already in
       the stylesheet as the no-JS fallback. It runs on the compositor and costs
       the main thread nothing; what it gives up is scroll-direction reversal and
       drag-to-throw, which are the right things to lose on a device that cannot
       hold sixty frames. `js-strips` is not set, so the CSS stays live. */
    if (REDUCED || LITE) return;
    var strips = [];

    /* WHICH WAY IS FORWARD.
       The driver owns the transform, and a flex row in an RTL document is laid
       out from the right edge leftwards — so the duplicate track that makes the
       loop seamless sits to the LEFT of the first one, not the right. Writing
       translateX(-off) then walks the strip AWAY from its own duplicate, and
       after one track-width the shelf is simply empty. Measured: the first tile
       of an Arabic case gallery sitting at x = -2117 in a window starting at
       x = 130. Every offset below is therefore a distance, and SIGN turns it
       into a direction exactly once, at the point it becomes a transform. */
    var SIGN = document.documentElement.dir === 'rtl' ? 1 : -1;

    function register(el, trackSel) {
      if (el.__bvStrip) return el.__bvStrip;
      var s = {
        el: el,
        sel: trackSel,
        tracks: $$(trackSel, el),
        rev: el.classList.contains('bv-marquee--rev') || el.classList.contains('bv-reel--rev'),
        dur: parseFloat(getComputedStyle(el).getPropertyValue('--dur')) || 40,
        off: 0, w: 0, speed: 0, hot: false, hold: false, drag: null, fling: 0,
      };
      if (!s.tracks.length) return null;
      s.seen = true;
      el.__bvStrip = s;
      strips.push(s);
      sizeOne(s);
      wireDrag(s);
      /* Four strips kept advancing and writing transforms while the reader was
         three sections further down the page and could not see any of them.
         Marking each one on/off screen is one observer callback per crossing
         instead of eight style writes per frame, forever. */
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { s.seen = e.isIntersecting; });
        }, { rootMargin: '120px 0px' });
        io.observe(el);
      }
      return s;
    }

    function sizeOne(s) {
      // Re-collect: tileStrips() clones more copies in when the window widens,
      // and a stale list means the new ones never get a transform written to
      // them — they sit still while the rest of the strip travels past.
      s.tracks = $$(s.sel, s.el);
      s.w = s.tracks[0] ? s.tracks[0].scrollWidth || 0 : 0;
      s.speed = s.w / s.dur;                   // keep the authored pace
    }
    function measure() { tileStrips(); strips.forEach(sizeOne); }

    // Grab and throw the strip. Movement past a few pixels suppresses the click
    // so a drag never opens a lightbox by accident.
    var THRESH = 6;
    function wireDrag(s) {
      var startX = 0, startOff = 0, moved = 0, id = null, armed = false;

      s.el.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        id = e.pointerId; startX = e.clientX; startOff = s.off; moved = 0;
        armed = true;                    // watching, but not yet dragging
        s.drag = false; s.fling = 0;
        // Freeze on press. If the strip keeps travelling between press and
        // release the click resolves to the container instead of the tile,
        // and the picture never opens.
        s.hot = true;
      });

      s.el.addEventListener('pointermove', function (e) {
        if (!armed || e.pointerId !== id) return;
        var dx = e.clientX - startX;
        moved = Math.max(moved, Math.abs(dx));
        // Only take the pointer once this is genuinely a drag. Capturing on
        // pointerdown retargets the following click to THIS element, so a
        // plain click never reaches the tile and nothing opens.
        if (!s.drag) {
          if (moved <= THRESH) return;
          s.drag = true;
          s.el.classList.add('is-dragging');
          try { s.el.setPointerCapture(id); } catch (err) {}
        }
        // dx is screen-space; off is a distance along the strip. One SIGN.
        s.fling = dx * 0.35 * SIGN;
        s.off = startOff + dx * SIGN;
        if (s.w) { while (s.off > s.w) s.off -= s.w; while (s.off < 0) s.off += s.w; }
      });

      var end = function () {
        if (!armed) return;
        armed = false;
        if (s.drag) {
          s.drag = false;
          s.el.classList.remove('is-dragging');
          try { s.el.releasePointerCapture(id); } catch (err) {}
          // a real drag must not also count as a click on the tile underneath
          s.swallow = true;
          setTimeout(function () { s.swallow = false; }, 80);
        }
        id = null;
      };
      s.el.addEventListener('pointerup', end);
      s.el.addEventListener('pointercancel', end);
      addEventListener('pointerup', end);        // release outside the strip

      s.el.addEventListener('click', function (e) {
        if (s.swallow) { e.stopPropagation(); e.preventDefault(); }
      }, true);
      s.el.addEventListener('pointerenter', function () { s.hot = true; });
      s.el.addEventListener('pointerleave', function () { s.hot = false; });
    }

    $$('.bv-marquee').forEach(function (el) { register(el, '.bv-marquee__track'); });
    $$('.bv-reel').forEach(function (el) { register(el, '.bv-reel__track'); });
    if (!strips.length) return;

    document.documentElement.classList.add('js-strips');
    addEventListener('resize', measure);
    setTimeout(measure, 1200);
    setTimeout(measure, 4000);

    // Case shelves are built on demand, so they enrol themselves.
    window.BV_STRIPS = {
      add: function (el) {
        // A case shelf is built on demand, long after the load-time tiling ran,
        // and a client with four pieces has a track far narrower than the frame.
        tileStrips();
        var s = register(el, '.bv-gal__track');
        /* Marks this strip as living INSIDE the overlay, not behind it. Without
           it, freezing the page behind a dossier would freeze the dossier's own
           work shelf — the one strip the reader can actually see. */
        if (s) s.overlay = true;
        // measured twice: once the images have decided their widths, and again
        // once the slow ones have landed
        if (s) { setTimeout(measure, 400); setTimeout(measure, 1600); }
        return s;
      },
      drop: function (el) {
        var i = strips.indexOf(el.__bvStrip);
        if (i >= 0) strips.splice(i, 1);
        delete el.__bvStrip;
      },
      measure: measure,
    };

    var prev = performance.now();
    (function step(now) {
      var dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      // A runtime downgrade has to actually stop the loop, not just stop new
      // work being added to it. Park the strips where they are and let CSS
      // take them back over.
      if (window.BV_PERF && window.BV_PERF.lite) {
        document.documentElement.classList.remove('js-strips');
        return;
      }
      /* TWO different freezes, and collapsing them into one is a bug either way.
         A picture being enlarged holds EVERYTHING still, the case shelf
         included — that is the documented behaviour and the shelf is behind the
         lightbox like everything else.
         A dossier only covers the PAGE: the four home strips have been writing
         transforms every frame behind a full-screen overlay, but the shelf
         inside that dossier is the thing the reader is looking at and must keep
         running. `s.overlay` is set when a shelf enrols, so this costs nothing
         per frame. */
      var lbFrozen = document.body.classList.contains('bv-lb-open');
      var behind = COVERED;
      var boost = 1 + clamp(Math.abs(vel) / 90, 0, 1.3);
      strips.forEach(function (s) {
        if (!s.w) return;
        // Off screen: hold position and write nothing. It resumes where it was.
        if (!s.seen && !s.drag) return;
        // A gallery that has been spread open is a GRID, not a strip — it must
        // not drift. The old CSS `animation: none` used to stop this, but the
        // strip is JS-driven now, so the driver has to know about the mode.
        if (s.el.getAttribute && s.el.getAttribute('data-mode') === 'grid') {
          if (s.off !== 0 || s.fling !== 0) {
            s.off = 0; s.fling = 0;
            for (var g = 0; g < s.tracks.length; g++) {
              s.tracks[g].style.transform = 'translateX(0px)';
            }
          }
          return;
        }
        var frozen = lbFrozen || (behind && !s.overlay);
        if (!s.drag && !s.hot && !s.hold && !frozen) {
          s.off += (s.rev ? -1 : 1) * (dir >= 0 ? 1 : -1) * s.speed * dt * boost + s.fling;
          s.fling *= 0.9;                       // let a throw run out
          if (Math.abs(s.fling) < 0.02) s.fling = 0;
          while (s.off > s.w) s.off -= s.w;
          while (s.off < 0) s.off += s.w;
        }
        var x = (SIGN * s.off).toFixed(2);
        for (var i = 0; i < s.tracks.length; i++) s.tracks[i].style.transform = 'translateX(' + x + 'px)';
      });
      requestAnimationFrame(step);
    })(prev);
  })();

  /* ── 7. generic reveal, with direction ────────────────────────────────── */
  var rio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  $$('.bv-rise, .bv-slide').forEach(function (n) { rio.observe(n); });
})();
