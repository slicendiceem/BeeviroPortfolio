/* Beeviro — performance tiering.
 *
 * WHY THIS FILE EXISTS. The first round of feedback on this site was, in
 * substance, one sentence: it is beautiful and it is too heavy. A hero canvas
 * repainting a few hundred hexagons a frame, nineteen 3D cells, six looping
 * videos, four running strips, a pointer companion, per-card tilt and a
 * scroll-scrubbed pinned section are individually cheap and collectively a
 * slideshow on a mid-range phone.
 *
 * So the page now decides, before a single effect starts, how much motion this
 * device can actually afford — and the reader can overrule it either way. There
 * are two tiers:
 *
 *   full  — everything as designed.
 *   lite  — no hero canvas, no 3D lattice videos, no pointer companion, no
 *           per-card tilt, no magnetic buttons, no decode scramble, no cell
 *           turnover, shorter boot, fewer carousel tiles. The page keeps its
 *           layout, its colour and its scroll reveals; it stops burning frames.
 *
 * This script must run BEFORE the rest, so everything downstream can simply
 * ask `BV_PERF.lite` and never build the expensive thing in the first place.
 * Tearing an effect down after the fact is how you end up with half a canvas.
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var KEY = 'bv:motion';                 // 'full' | 'lite' | absent = automatic
  var nav = navigator;

  /* ---- viewport-fit, for the build that has no <head> of its own ----------
     The stylesheet keeps every piece of fixed chrome out of the notch with
     env(safe-area-inset-*), and all of that is inert unless the viewport meta
     says `viewport-fit=cover`. The standalone build says so in its markup —
     but build-embed.mjs DROPS <head>, because GoHighLevel owns the title and
     the meta tags, so the hosted build arrived with no viewport meta at all:
     the insets resolved to 0 and iOS letterboxed the page beside the notch.

     So it is asserted here instead, in the first script in the document,
     before anything has been laid out. Appended rather than replaced — GHL may
     have written its own scale settings into that tag and they are not ours to
     throw away — and idempotent, so the standalone build, which already has
     it, is untouched. */
  (function coverTheScreen() {
    try {
      var m = document.querySelector('meta[name="viewport"]');
      if (!m) {
        m = document.createElement('meta');
        m.name = 'viewport';
        m.content = 'width=device-width, initial-scale=1';
        (document.head || document.documentElement).appendChild(m);
      }
      if (!/viewport-fit\s*=\s*cover/i.test(m.content)) {
        m.content = m.content.replace(/\s*,\s*$/, '') + ', viewport-fit=cover';
      }
    } catch (e) { /* no head yet, or a locked-down embed: the page still works */ }
  }());

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ---- what this device looks like ---------------------------------------
     Every signal here is a hint and several are absent on Safari, so they vote
     rather than decide. Two weak signals is enough to go lite: being wrong
     towards "smooth" costs a few effects, being wrong towards "heavy" costs the
     whole page. */
  function auto() {
    var votes = 0;
    var conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (conn && conn.saveData) return true;                       // explicit ask
    if (conn && /(^|-)2g$/.test(conn.effectiveType || '')) return true;

    var mem = nav.deviceMemory;                 // Chromium only, in GB, capped 8
    if (mem && mem <= 4) votes += mem <= 2 ? 2 : 1;

    var cpu = nav.hardwareConcurrency;
    if (cpu && cpu <= 4) votes += cpu <= 2 ? 2 : 1;

    // A coarse pointer on a small screen is a phone, and a phone is where every
    // one of these effects is most expensive and least visible.
    var coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse && innerWidth < 1000) votes += 2;
    else if (coarse) votes += 1;

    if (conn && /(^|-)3g$/.test(conn.effectiveType || '')) votes += 1;

    // A very high pixel ratio multiplies every fill this page does.
    if ((window.devicePixelRatio || 1) >= 3 && coarse) votes += 1;

    return votes >= 2;
  }

  var choice = stored();
  var lite = choice === 'lite' ? true : choice === 'full' ? false : auto();

  var API = {
    lite: lite,
    auto: !choice,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    /* Anything holding a rAF loop should call this each frame and bail when it
       returns true, so a runtime downgrade actually stops the work. */
    stopped: function () { return API.lite; },
    listeners: [],
    on: function (fn) { API.listeners.push(fn); },
    set: function (on, sticky) {
      if (API.lite === !!on) { if (sticky) remember(on ? 'lite' : 'full'); return; }
      API.lite = !!on;
      if (sticky) { API.auto = false; remember(on ? 'lite' : 'full'); }
      paint();
      API.listeners.forEach(function (fn) { try { fn(API.lite); } catch (e) {} });
    },
  };

  /* Set once, at load, and never changed. Anything that alters LAYOUT or removes
     an element the reader may already be looking at is scoped to this class in
     the stylesheet, so a mid-session demotion can only ever switch off per-frame
     work — it cannot un-pin a section under somebody's scroll position, and it
     cannot take away the pointer they are using. */
  if (lite) html.classList.add('bv-lite-boot');

  function paint() {
    html.classList.toggle('bv-lite', API.lite);
    html.classList.toggle('bv-full', !API.lite);
    var btns = document.querySelectorAll('[data-perf-toggle]');
    Array.prototype.forEach.call(btns, function (b) {
      b.setAttribute('aria-pressed', String(!API.lite));
      b.classList.toggle('is-lite', API.lite);
    });
  }
  paint();
  window.BV_PERF = API;

  /* ---- the watchdog -------------------------------------------------------
     Device hints miss plenty — a four-year-old laptop reports 8 cores and 8 GB
     and still cannot paint this. So measure the real thing: once the boot
     screen is out of the way, count frames for three seconds. Under ~42fps the
     page demotes itself. Only ever downgrades, never promotes, and never writes
     to storage — an automatic decision must not become a permanent one the
     reader cannot see or undo. */
  if (!API.lite && !API.reduced) {
    /* CONSERVATIVE ON PURPOSE. The first version sampled one 3-second window
       starting 2.6s in, and demoted under 42fps — which is precisely the window
       where the page is worst and least representative: the boot screen has just
       lifted, nineteen cell images are decoding, six videos are being fetched
       and the first reveals are running. It fired on machines that were fine,
       and a demotion is not a free action — it visibly changes the page under
       someone who is reading it.
       So: start after that burst has passed, and require TWO consecutive bad
       windows. A single stutter is a stutter; two in a row is a slow device. */
    var START = 6000, WINDOW = 2500, FLOOR = 36, NEEDED = 2;
    setTimeout(function () {
      var bad = 0;

      function sample() {
        var frames = 0, t0 = 0;
        requestAnimationFrame(function first(t) {
          t0 = t;
          requestAnimationFrame(function tick(now) {
            frames++;
            if (now - t0 < WINDOW) { requestAnimationFrame(tick); return; }
            // A backgrounded tab throttles rAF to a crawl. That is the browser
            // being sensible, not the device being slow — do not count it.
            if (document.hidden) { bad = 0; sample(); return; }
            var fps = frames / ((now - t0) / 1000);
            bad = fps < FLOOR ? bad + 1 : 0;
            if (bad < NEEDED) { sample(); return; }
            if (!API.auto) return;
            API.set(true, false);
            html.classList.add('bv-lite-auto');
          });
        });
      }
      sample();
    }, START);
  }

  /* ---- the control --------------------------------------------------------
     Wired here rather than in the motion layer because it has to work even if
     everything downstream failed to load. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-perf-toggle]');
    if (!b) return;
    e.preventDefault();
    API.set(!API.lite, true);
    // Effects are built at load, so the honest thing is to rebuild the page
    // rather than pretend a half-torn-down canvas is the same experience.
    location.reload();
  });
})();
