/* Drive the ported site in headless Chrome over CDP and assert on what a text
 * diff cannot see: that a feature moved from beeviro-embed.html into site/
 * still actually WORKS in a browser, not just that its markers are present in
 * the HTML. See tools/embed-diff.mjs for that structural half; this is the
 * behavioural half.
 *
 * Shape follows tools/flow.mjs: spawn Chrome, connect over CDP, navigate
 * once, run checks against the loaded page, report, exit non-zero on any
 * failure. requireChrome() (tools/chrome.mjs) finds the binary; this file
 * does not.
 *
 *   node tools/verify-port.mjs                  run every registered check
 *   node tools/verify-port.mjs --only some-name  run just that one
 *   node tools/verify-port.mjs --lang ar         load the Arabic build
 *   node tools/verify-port.mjs --url http://localhost:4173/
 *
 * Exit 0  every check that ran passed (0 registered checks counts as this —
 *         Task 1 ships the harness empty; see the registry below).
 * Exit 1  at least one check failed.
 * Exit 2  bad invocation: --only named a check that is not registered.
 *
 * ===========================================================================
 * REGISTERING A CHECK — the only reason to come back to this file later.
 *
 * Add one property to the CHECKS object below:
 *
 *   'my-check-name': async (cdp) => {
 *     const n = await cdp.eval('document.querySelectorAll(".bv-thing").length');
 *     if (n !== 6) throw new Error('expected 6, saw ' + n);
 *   },
 *
 * A check PASSES by resolving normally and FAILS by throwing — the thrown
 * message is what gets printed, so make it say what was actually seen.
 * Nothing else in this file needs to change: the runner discovers checks by
 * walking CHECKS' own keys, and --only matches one by name.
 *
 * `cdp` is the same connection flow.mjs drives with:
 *   cdp.eval(expr)            Runtime.evaluate in the page, awaited, by value
 *   cdp.send(method, params)  any raw CDP command
 *   cdp.errors                console.error / uncaught-exception text seen so far
 *   cdp.network               every request seen so far: {url, method, status,
 *                             failed} — status is null until the response (or
 *                             failure) arrives; failed is true only on a
 *                             network-level failure (DNS, connection refused —
 *                             not an HTTP error status, which lands in
 *                             `status` instead). Grows for the life of the CDP
 *                             session, across every Page.navigate a check
 *                             sends, so slice from its current .length before
 *                             an action to see only what that action caused.
 *   cdp.close()                close the socket early, if a check needs to
 *   cdp.base, cdp.lang         the --url / --lang this run started with
 *
 * You do not need to close anything yourself: the runner closes the socket
 * after the last check, and kills the whole Chrome process in a `finally`
 * regardless of how a check ends, so a thrown error cannot leak it either.
 *
 * The page is navigated ONCE — to the --url with ?lang=<--lang> appended —
 * before any check runs, and checks run in registration order against that
 * same loaded page. A check that needs a clean load of its own (or the other
 * language) is free to send another Page.navigate — just leave the page in a
 * state the next check can still make sense of, since checks are not
 * isolated from each other.
 *
 * A check that only means anything under one language — Arabic-only markup,
 * or an assertion that would just see the English fallback otherwise — can
 * declare that instead of registering a bare function:
 *
 *   'my-ar-only-check': {
 *     lang: 'ar',
 *     run: async (cdp) => { ...throw on failure... },
 *   },
 *
 * Run under any other --lang, the runner reports it SKIP without calling
 * `run` at all, and a skip never counts against the pass/fail total — it is
 * not a silent no-op standing in for a pass, it is simply not evidence of
 * anything under a language the check was never written to exercise. Every
 * check registered as a plain function (the form used above this one) runs
 * exactly as before, regardless of --lang.
 * ===========================================================================
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

const LANG = arg('lang', 'en');
const BASE = arg('url', 'http://localhost:4173/');
const ONLY = arg('only', null);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===========================================================================
 * REGISTER CHECKS HERE. name -> async (cdp) => { ...throw on failure... }
 * Task 1 ships this empty on purpose — see the header above. Nothing else in
 * this file should need to change to add one.
 * ======================================================================= */
const CHECKS = {
  /* Task 3 registers the first real check — see the header comment above for
     what this proves about the CDP driver itself. Confirms three things a
     text diff cannot: the section actually renders right-to-left, the rail's
     numbering survived the port, and Arabic mode carries no stray Latin
     text — the testimonial durations are digits-and-colon by construction, so
     any run of 4+ Latin letters here is English leaking through a missing
     translation. */
  'testimonials-arabic': {
    /* Arabic-only by construction — the assertions below (direction:rtl, an
       Arabic aria-label, zero Latin-script leakage) can never hold under the
       English build, so running this against --lang en was never catching a
       regression; it was just a permanent red that trained everyone to
       ignore the suite. See the lang-gate mechanism documented at the top of
       this file. */
    lang: 'ar',
    run: async (cdp) => {
      const r = await cdp.eval(`(() => {
        const sec = document.getElementById('testimonials');
        if (!sec) return { error: 'no #testimonials section in the DOM' };
        const dir = getComputedStyle(sec).direction;
        const labels = [...sec.querySelectorAll('.bv-testi__meta b')].map((b) => b.textContent);
        const firstPick = sec.querySelector('.bv-testi__pick');
        const playLabel = firstPick ? firstPick.getAttribute('aria-label') : null;
        const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
        const leaks = [];
        let n;
        while ((n = walker.nextNode())) {
          if (/[A-Za-z]{4,}/.test(n.nodeValue)) leaks.push(n.nodeValue.trim());
        }
        return { dir, labels, playLabel, leaks };
      })()`);

      if (r.error) throw new Error(r.error);
      if (r.dir !== 'rtl') {
        throw new Error('expected #testimonials to compute direction:rtl, saw ' + JSON.stringify(r.dir));
      }
      /* Reference data has grown a fourth pushed testimonial since this brief was
         written (see task-3-report.md) — checked as a prefix, not an exact
         length, so a real 04th tab does not make this check lie. */
      const want = ['01', '02', '03'];
      for (let i = 0; i < want.length; i++) {
        if (r.labels[i] !== want[i]) {
          throw new Error('expected rail label ' + i + ' to read ' + JSON.stringify(want[i]) +
            ', saw ' + JSON.stringify(r.labels));
        }
      }
      if (r.playLabel !== 'تشغيل الشهادة 1') {
        throw new Error('expected the first pick aria-label to read ' +
          JSON.stringify('تشغيل الشهادة 1') + ', saw ' + JSON.stringify(r.playLabel));
      }
      if (r.leaks.length) {
        throw new Error('Latin-script leakage (4+ letters) in the Arabic testimonials section: ' +
          JSON.stringify(r.leaks));
      }
    },
  },

  /* Task 4 registers the second check. revenuelab360 and tamahwour have no
     BV_CARD_LOGOS entry, so the new lead-art branch that check looks up
     should never touch either of their cards — they should fall straight
     through to their existing gallery-shot fallback exactly as before this
     port. Confirms three things a text diff cannot: the new branch does not
     accidentally fire for a slug with nothing to look up, the card is not
     left carrying bv-card--wide (which only means anything alongside
     bv-card--logo), and the fallback <img> it renders instead actually
     decodes — probed with an independent Image() rather than trusting
     img.complete, since loading="lazy" may not have fired this image yet at
     verify-port's fixed viewport and the card can sit off-screen. An empty
     plate and a broken image both look like a deliberate styling choice in a
     screenshot, which is exactly why this needs a check rather than a look. */
  'logo-fallback': async (cdp) => {
    const r = await cdp.eval(`(async () => {
      var slugs = ['revenuelab360', 'tamahwour'];
      var out = {};
      for (var i = 0; i < slugs.length; i++) {
        var slug = slugs[i];
        var card = document.querySelector(".bv-card[data-slug='" + slug + "']");
        if (!card) { out[slug] = { error: 'no .bv-card[data-slug=' + slug + '] in the DOM' }; continue; }
        var img = card.querySelector('.bv-card__img img');
        var naturalWidth = 0;
        if (img) {
          naturalWidth = await new Promise(function (resolve) {
            var probe = new Image();
            probe.onload = function () { resolve(probe.naturalWidth); };
            probe.onerror = function () { resolve(0); };
            probe.src = img.src;
          });
        }
        out[slug] = {
          hasLogo: card.classList.contains('bv-card--logo'),
          hasWide: card.classList.contains('bv-card--wide'),
          hasImg: !!img,
          src: img ? img.src : null,
          naturalWidth: naturalWidth,
        };
      }
      return out;
    })()`);

    ['revenuelab360', 'tamahwour'].forEach(function (slug) {
      var r0 = r[slug];
      if (!r0) throw new Error('no result returned for ' + slug);
      if (r0.error) throw new Error(r0.error);
      if (r0.hasLogo) {
        throw new Error(slug + ' unexpectedly carries bv-card--logo (it has no BV_CARD_LOGOS entry)');
      }
      if (r0.hasWide) {
        throw new Error(slug + ' unexpectedly carries bv-card--wide (that class only means anything on a logo card)');
      }
      if (!r0.hasImg) {
        throw new Error(slug + ' renders no <img> in its lead art — an empty plate reads as a styling choice, not a bug');
      }
      if (!r0.naturalWidth) {
        throw new Error(slug + '\'s fallback image (' + r0.src + ') reports naturalWidth 0 — a broken image reads as a styling choice, not a bug');
      }
    });
  },

  /* Task 5 registers the third check. #searchFilter narrows the SAME grid
   * beeviro.js's applyOrder() already sorted to BV_ORDER — it must never
   * re-sort it, only hide/show in place. A brand query no client name can
   * match proves the "hide" half (zero cards, #workStatus says so, not
   * silently); clearing that query back to '' and reading the grid's DOM
   * order straight off BV_ORDER proves the "never re-sorts" half, which is
   * the one a filter implementation most plausibly gets wrong by rebuilding
   * or re-appending cards instead of toggling `hidden` on the existing ones.
   * cdp.errors is sampled before and after so a thrown exception inside the
   * filter (e.g. a null #workStatus) fails this check instead of passing
   * silently. */
  'filter-empty-result': async (cdp) => {
    const errorsBefore = cdp.errors.length;
    const r = await cdp.eval(`(() => {
      var select = document.getElementById('industryFilter');
      var search = document.getElementById('searchFilter');
      var grid = document.getElementById('grid');
      var status = document.getElementById('workStatus');
      if (!select || !search || !grid || !status) {
        return { error: 'missing #industryFilter, #searchFilter, #grid or #workStatus in the DOM' };
      }
      var rtl = !!(window.BV_I18N && window.BV_I18N.rtl);

      function visibleSlugs() {
        return Array.prototype.filter.call(grid.querySelectorAll('.bv-card'), function (c) {
          return !c.hidden;
        }).map(function (c) { return c.dataset.slug; });
      }

      select.value = '';
      search.value = 'zzz-no-such-brand-zzz';
      search.dispatchEvent(new Event('input'));
      var visibleAfterQuery = visibleSlugs();
      var statusAfterQuery = status.textContent;

      search.value = '';
      search.dispatchEvent(new Event('input'));
      var slugsAfterClear = visibleSlugs();

      return {
        rtl: rtl,
        visibleAfterQuery: visibleAfterQuery,
        statusAfterQuery: statusAfterQuery,
        slugsAfterClear: slugsAfterClear,
        order: window.BV_ORDER || [],
        liveCount: (window.BV_CLIENTS || []).length,
      };
    })()`);

    if (r.error) throw new Error(r.error);

    if (r.visibleAfterQuery.length !== 0) {
      throw new Error('a brand query matching no client should render 0 cards, saw ' +
        r.visibleAfterQuery.length + ' (' + JSON.stringify(r.visibleAfterQuery) + ')');
    }

    const wantEmptyStatus = r.rtl
      ? 'لا توجد نتائج. جرّب بحثًا آخر.'
      : 'No matching brands. Try another search or category.';
    if (!r.statusAfterQuery) {
      throw new Error('#workStatus went silent instead of announcing zero results');
    }
    if (r.statusAfterQuery !== wantEmptyStatus) {
      throw new Error('expected #workStatus to read ' + JSON.stringify(wantEmptyStatus) +
        ', saw ' + JSON.stringify(r.statusAfterQuery));
    }

    if (cdp.errors.length > errorsBefore) {
      throw new Error('console error raised while filtering: ' +
        JSON.stringify(cdp.errors.slice(errorsBefore)));
    }

    if (r.slugsAfterClear.length !== r.liveCount) {
      throw new Error('clearing the query should restore all ' + r.liveCount +
        ' cards (the live record count), saw ' + r.slugsAfterClear.length);
    }

    /* NOT DOM equality with BV_ORDER. A record BV_ORDER does not name is
     * documented, correct behaviour — applyOrder() in beeviro.js sorts it
     * after everything named, keeping its relative position (see the
     * order-unknown-slug check) — not a bug this filter check should catch.
     * Task 6 shipped exactly that shape for one release (shalaby-labs live,
     * unnamed), which is what made the old DOM-equality version of this
     * assertion fail on correct output. What the clear-filter handler is
     * actually required to preserve is narrower and survives that shape:
     * every BV_ORDER-named slug keeps BV_ORDER's relative order, and no
     * unnamed slug is ever sorted ahead of a named one. Checked structurally
     * rather than by comparing two full arrays, so it holds whether or not
     * "named" and "live" happen to be the same set today. */
    const named = [];
    let sawUnnamed = false;
    for (const slug of r.slugsAfterClear) {
      if (r.order.includes(slug)) {
        if (sawUnnamed) {
          throw new Error('clearing the query sorted a BV_ORDER-named slug (' + slug +
            ') after an unnamed one — unnamed records must sort last, saw ' +
            JSON.stringify(r.slugsAfterClear));
        }
        named.push(slug);
      } else {
        sawUnnamed = true;
      }
    }
    const wantNamed = r.order.filter((slug) => named.includes(slug));
    for (let i = 0; i < named.length; i++) {
      if (named[i] !== wantNamed[i]) {
        throw new Error('clearing the query did not preserve BV_ORDER\'s relative order — expected ' +
          'named slot ' + i + ' to read ' + JSON.stringify(wantNamed[i]) + ', saw ' + JSON.stringify(named[i]) +
          ' (full order seen: ' + JSON.stringify(r.slugsAfterClear) + ')');
      }
    }
  },

  /* Task 7 registers the fourth check. The toggle used to call
   * location.replace() at a URL that, in every shape below except the plain
   * ?lang= query, differed from the current one only after the '#' — which
   * HTML defines as a same-document navigation: the browser scrolls (or does
   * nothing) and no script re-runs, so document.documentElement.lang never
   * actually flips even though localStorage was updated correctly. A text
   * diff cannot see this; it can only see that *a* handler is registered.
   * This drives six real clicks, each from a different starting URL, and
   * asserts the one thing a same-document navigation cannot fake: that `lang`
   * on <html> reads differently after the click than before it. Three of the
   * six also assert what the resulting address bar has to look like (a stale
   * lang= surviving the reload would silently re-win on the very next load),
   * and the last pair isolates the "keep #work vs drop it" branch, which
   * turns on nothing but scroll position at click time. A seventh, non-click
   * case guards fromUrl() itself: a fresh #lang=ar share-link load, with
   * storage empty, still has to resolve to Arabic, or the fragment-stripping
   * half of this same fix would have broken the feature it was ported
   * alongside. */
  'lang-toggle-shapes': async (cdp) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function evalRetry(expr, tries, gap) {
      let lastErr;
      for (let i = 0; i < (tries || 5); i++) {
        try { return await cdp.eval(expr); }
        catch (e) { lastErr = e; await sleep(gap || 300); }
      }
      throw lastErr;
    }

    async function goto(suffix) {
      // Bounce through about:blank first. Page.navigate straight from one
      // case's ending URL to the next is exactly the hazard this whole check
      // exists to catch: when the two differ only after the '#' (e.g. ending
      // bare and starting the next case at #lang=ar), that is a same-document
      // navigation — lang.js never re-runs and this harness would read the
      // PREVIOUS case's stale <html lang> instead of a fresh resolution of
      // this one. about:blank shares nothing with the target URL, so the
      // navigation after it is never fragment-only.
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await sleep(150);
      await cdp.send('Page.navigate', { url: cdp.base + suffix });
      await sleep(2200);
    }

    async function readState() {
      return evalRetry(`({
        lang: document.documentElement.lang,
        hash: location.hash,
        search: location.search,
        scrollY: window.scrollY,
      })`);
    }

    async function clickToggle() {
      await evalRetry(`(function () {
        var b = document.querySelector('[data-lang-toggle]');
        if (!b) throw new Error('no [data-lang-toggle] button in the DOM');
        b.click();
        return true;
      })()`, 2, 200);
      // The click forces a real reload (that is the fix) — give it as long
      // as the harness's own initial Page.navigate gets, not less.
      await sleep(2600);
    }

    const scrollTop = `window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); true`;
    const scrollToWork = `(function () {
      var el = document.getElementById('work');
      if (!el) throw new Error('no #work section in the DOM');
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      return true;
    })()`;

    const CASES = [
      {
        name: 'clean URL',
        suffix: '',
        check: (before, after) => {
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.hash || after.search) {
            throw new Error('a clean start should reload to a clean URL, saw search=' +
              JSON.stringify(after.search) + ' hash=' + JSON.stringify(after.hash));
          }
        },
      },
      {
        name: '#work',
        suffix: '#work',
        check: (before, after) => {
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.hash !== '#work') throw new Error('expected #work to survive, saw ' + JSON.stringify(after.hash));
        },
      },
      {
        name: '?lang=ar',
        suffix: '?lang=ar',
        check: (before, after) => {
          if (before.lang !== 'ar') throw new Error('the ?lang=ar load itself should start Arabic, saw lang=' + JSON.stringify(before.lang));
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.search) throw new Error('expected the ?lang= query to be stripped, saw ' + JSON.stringify(after.search));
        },
      },
      {
        name: '#lang=ar',
        suffix: '#lang=ar',
        check: (before, after) => {
          if (before.lang !== 'ar') throw new Error('the #lang=ar load itself should start Arabic, saw lang=' + JSON.stringify(before.lang));
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.hash) throw new Error('expected the #lang= fragment to be stripped, saw ' + JSON.stringify(after.hash));
        },
      },
      {
        name: '#work, scrolled to top',
        suffix: '#work',
        prep: scrollTop,
        check: (before, after) => {
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.hash) throw new Error('expected #work to be dropped (off screen at click time), saw ' + JSON.stringify(after.hash));
          if (after.scrollY > 40) throw new Error('expected the reload to stay at the top, saw scrollY=' + after.scrollY);
        },
      },
      {
        name: '#work, scrolled to the work section',
        suffix: '#work',
        prep: scrollToWork,
        check: (before, after) => {
          if (after.lang === before.lang) throw new Error('lang stayed ' + before.lang + ' — the click did not flip it');
          if (after.hash !== '#work') throw new Error('expected #work to survive (on screen at click time), saw ' + JSON.stringify(after.hash));
        },
      },
    ];

    for (const c of CASES) {
      await goto(c.suffix);
      if (c.prep) { await evalRetry(c.prep); await sleep(400); }
      const before = await readState();
      await clickToggle();
      const after = await readState();
      try {
        c.check(before, after);
      } catch (e) {
        throw new Error('[' + c.name + '] ' + e.message);
      }
    }

    // The non-toggle case: fromUrl() alone, no click. A share link carrying
    // #lang=ar has to win on a completely fresh load — proving the fragment
    // now gets *stripped after the toggle* without also breaking the
    // *reading* of that same fragment on the load this fix does not touch.
    // Storage is cleared here, on the real origin left by the last case,
    // before bouncing through about:blank — "empty storage" is the point of
    // this case, not an accident of whatever the six clicks above left behind.
    await evalRetry('localStorage.clear(); true');
    await goto('#lang=ar');
    const shared = await readState();
    if (shared.lang !== 'ar') {
      throw new Error('a fresh #lang=ar load with empty storage should resolve to Arabic, saw lang=' +
        JSON.stringify(shared.lang));
    }

    // Leave the page the way the harness found it, in case a future check
    // ever runs after this one.
    await cdp.send('Page.navigate', { url: cdp.base + '?lang=' + cdp.lang });
    await sleep(2200);
  },

  /* Task 8 registers the fifth check. This task's own roster trim touches
   * BV_ORDER and BV_CLIENTS in two separate edits — delete six records here,
   * drop the matching six names there — which is exactly the kind of change
   * where it is easy to update one and forget the other. A record with no
   * BV_ORDER entry (the OTHER mismatch direction) is documented, correct
   * behaviour and already covered by filter-empty-result's rewritten
   * assertion: it sorts after everything named, keeping its relative
   * position. This check exercises the direction that one does not: a
   * BV_ORDER entry with no backing record, as would be left behind by
   * trimming BV_CLIENTS without also trimming BV_ORDER. applyOrder()
   * (beeviro.js) only ever walks BV_CLIENTS and looks up each record's own
   * rank — it never iterates BV_ORDER itself — so a name in BV_ORDER that no
   * record carries should be completely inert: not a crash, not a phantom
   * card, not a dropped one.
   *
   * Proven by intercepting the assignment TO `window.BV_ORDER` before
   * clients.js runs, rather than setting window.BV_ORDER directly — clients.js
   * reassigns the global outright on load, so anything set before it would
   * just be overwritten — then reloading and counting cards fresh. */
  'order-unknown-slug': async (cdp) => {
    const PHANTOM = 'zzz-order-unknown-slug-has-no-record';
    const errorsBefore = cdp.errors.length;

    const added = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: '(function () {' +
        'var real;' +
        'Object.defineProperty(window, "BV_ORDER", {' +
        'configurable: true,' +
        'get: function () { return real; },' +
        'set: function (v) { real = v.concat(["' + PHANTOM + '"]); }' +
        '});' +
        '})();',
    });

    try {
      await cdp.send('Page.navigate', { url: cdp.base + '?lang=' + cdp.lang });
      await sleep(2800);

      const r = await cdp.eval(`(() => {
        var grid = document.getElementById('grid');
        if (!grid) return { error: 'no #grid in the DOM' };
        return {
          count: grid.querySelectorAll('.bv-card').length,
          hasPhantomCard: !!grid.querySelector('.bv-card[data-slug="${PHANTOM}"]'),
          order: window.BV_ORDER || [],
        };
      })()`);

      if (r.error) throw new Error(r.error);
      if (!r.order.includes(PHANTOM)) {
        throw new Error('the BV_ORDER interceptor did not take (saw ' + JSON.stringify(r.order) +
          ') — the harness is broken, not necessarily the page');
      }
      if (r.hasPhantomCard) {
        throw new Error('a BV_ORDER entry with no backing record rendered a card for it — card ' +
          'building must iterate BV_CLIENTS, never BV_ORDER');
      }
      if (r.count !== 20) {
        throw new Error('expected 20 cards with an extra unknown slug sitting in BV_ORDER, saw ' + r.count);
      }
      if (cdp.errors.length > errorsBefore) {
        throw new Error('console error raised while an unknown slug sat in BV_ORDER: ' +
          JSON.stringify(cdp.errors.slice(errorsBefore)));
      }
    } finally {
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: added.identifier });
      // Leave the page the way the harness found it, same courtesy
      // lang-toggle-shapes pays whatever runs after it.
      await cdp.send('Page.navigate', { url: cdp.base + '?lang=' + cdp.lang });
      await sleep(2200);
    }
  },

  /* Task 8 registers the sixth check. volt-ems.webm and dar-al-hadith.webm
   * stay on disk — deleting files, not just records, is out of scope — but
   * both clients leave the roster this task ships. Three things a text diff
   * of clients.js cannot see: that neither reel is ever requested once its
   * record is gone (hive.js's REELS constant at hive.js:54 is hardcoded
   * independently of BV_CLIENTS, so nothing guarantees that by construction,
   * only by review, and a careless future edit could re-add either slug
   * there without touching clients.js at all); that the hero lattice — 19
   * cells, ROWS = [3, 4, 5, 4, 3] in hive.js, a fixed geometry constant never
   * tied to the client count — still fills completely with no cell left
   * blank now that the pool it draws stills from has six fewer clients in
   * it; and that nothing in a fresh load's network trace came back failing. */
  'no-orphan-reels': async (cdp) => {
    const ORPHANS = [/volt-ems\.webm/, /dar-al-hadith\.webm/];
    const netBefore = cdp.network.length;

    // A clean reload isolates this check's own network trace from whatever
    // earlier checks (lang-toggle-shapes alone reloads six times) already
    // fetched.
    await cdp.send('Page.navigate', { url: cdp.base + '?lang=' + cdp.lang });
    await sleep(2800);

    const r = await cdp.eval(`(async () => {
      function state() {
        var cells = Array.prototype.slice.call(document.querySelectorAll('#lattice .bv-cellx'));
        return cells.map(function (btn) {
          var face = btn.querySelector('.bv-cellx__a');
          var media = face ? face.firstElementChild : null;
          var kind = media ? media.tagName.toLowerCase() : null;
          var src = null;
          if (media) src = kind === 'video' ? (media.currentSrc || media.src) : media.getAttribute('src');
          return { slug: btn.getAttribute('data-slug'), kind: kind, src: src || '' };
        });
      }
      if (!document.getElementById('lattice')) return { error: 'no #lattice in the DOM' };
      var cells = state();
      // A reel cell's <video>.src is filled asynchronously — hive.js queues a
      // blob fetch behind an is-booted gate — so poll rather than trust the
      // very first read already caught up.
      for (var tries = 0; tries < 20 && cells.some(function (c) { return c.kind === 'video' && !c.src; }); tries++) {
        await new Promise(function (res) { setTimeout(res, 300); });
        cells = state();
      }
      return { cells: cells };
    })()`);

    if (r.error) throw new Error(r.error);
    if (r.cells.length !== 19) {
      throw new Error('expected the 19-cell hero lattice (ROWS = [3,4,5,4,3] in hive.js), saw ' +
        r.cells.length);
    }
    const empty = r.cells.filter((c) => !c.kind || !c.src);
    if (empty.length) {
      throw new Error('cell(s) rendered with no media (an empty hexagon): ' + JSON.stringify(empty));
    }

    const seen = cdp.network.slice(netBefore);
    const orphanHits = seen.filter((n) => ORPHANS.some((re) => re.test(n.url)));
    if (orphanHits.length) {
      throw new Error('a removed client\'s reel was still requested: ' +
        JSON.stringify(orphanHits.map((n) => n.url)));
    }
    const failing = seen.filter((n) => n.failed || (n.status != null && n.status >= 400));
    if (failing.length) {
      throw new Error('a request in the trace came back failing: ' +
        JSON.stringify(failing.map((n) => n.url + ' -> ' + (n.failed ? 'network error' : n.status))));
    }
  },
};
/* ======================================================================= */

function usage(msg) {
  if (msg) console.error('verify-port: ' + msg);
  console.error('usage: node tools/verify-port.mjs [--only <name>] [--lang ar] [--url http://localhost:4173/]');
  process.exit(2);
}

const names = Object.keys(CHECKS);
let selected = names;
if (ONLY !== null) {
  if (!names.includes(ONLY)) {
    usage('no such check ' + JSON.stringify(ONLY) + (names.length
      ? '\navailable: ' + names.join(', ')
      : '\n(the registry is empty — nothing is registered yet)'));
  }
  selected = [ONLY];
}

if (selected.length === 0) {
  console.log('0 checks registered — nothing to run.');
  console.log('PASS  0 checks, 0 failed');
  process.exit(0);
}

/* ---- everything below only runs once we know there is a browser check to
   actually drive, so an empty (or --only-narrowed-to-nothing, handled above)
   registry never has to spawn Chrome at all. */

const CHROME = requireChrome();
const PORT = 9700 + (process.pid % 300);
let chromeProc = null;

function killChrome() {
  if (chromeProc && !chromeProc.killed) {
    try { chromeProc.kill(); } catch { /* already gone */ }
  }
}
/* Chromium here re-execs under snap confinement: the PID spawn() hands back
   is not the PID that ends up running, so a signal sent later in the normal
   flow can miss it entirely and leave ~1GB parked until reboot. requireChrome
   already prefers the inner binary for exactly this reason; this still keeps
   a kill wired to every way the process can end, including ^C mid-check. */
process.on('SIGINT', () => { killChrome(); process.exit(130); });
process.on('SIGTERM', () => { killChrome(); process.exit(143); });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = tabs.find((t) => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('devtools never came up');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const waiting = new Map();
    const errors = [];
    // Keyed by CDP requestId so a response/failure updates the SAME entry
    // `network` already holds, rather than guessing by URL — two reloads of
    // the same page request the same URLs, and requestId is the only thing
    // CDP guarantees is unique per request.
    const network = [];
    const byRequestId = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push(m.params.entry.text);
        return;
      }
      /* Log.entryAdded alone is not enough: in this Chrome/headless build it
       * does not fire for a page's own console.error() calls or for an
       * uncaught exception — verified empirically while building the
       * order-unknown-slug check below, which needs genuine console-error
       * detection to discriminate at all. Runtime.enable (already on, see
       * main()) is what actually reports both, over two different events,
       * so both are listened for here and folded into the same `errors`
       * array every check already reads — no check written against
       * `cdp.errors` before this needs to change. */
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        const text = (m.params.args || [])
          .map((a) => (a.value !== undefined ? String(a.value) : (a.description || a.type)))
          .join(' ');
        errors.push(text);
        return;
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails || {};
        errors.push(d.text + ' ' + ((d.exception || {}).description || ''));
        return;
      }
      if (m.method === 'Network.requestWillBeSent') {
        const entry = { url: m.params.request.url, method: m.params.request.method, status: null, failed: false };
        byRequestId.set(m.params.requestId, entry);
        network.push(entry);
        return;
      }
      if (m.method === 'Network.responseReceived') {
        const entry = byRequestId.get(m.params.requestId);
        if (entry) entry.status = m.params.response.status;
        return;
      }
      if (m.method === 'Network.loadingFailed') {
        const entry = byRequestId.get(m.params.requestId);
        if (entry) entry.failed = true;
        return;
      }
      if (m.method) return;
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      errors,
      network,
      base: BASE,
      lang: LANG,
      send(method, params) {
        return new Promise((res, rej) => {
          const n = ++id;
          waiting.set(n, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: n, method, params: params || {} }));
        });
      },
      async eval(expr) {
        const r = await this.send('Runtime.evaluate', {
          expression: expr, awaitPromise: true, returnByValue: true,
        });
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.text + ' ' +
            ((r.exceptionDetails.exception || {}).description || ''));
        }
        return r.result.value;
      },
      close: () => ws.close(),
    }));
  });
}

// A registered check is either a bare async function, or { lang, run } when
// it only applies under one --lang (see the header comment for why). Either
// shape lives at CHECKS[name]; these two helpers are the only places that
// need to know there are two shapes.
function langGateOf(entry) {
  return (entry && typeof entry === 'object' && typeof entry.run === 'function') ? entry.lang : null;
}
function runnerOf(entry) {
  return (entry && typeof entry === 'object' && typeof entry.run === 'function') ? entry.run : entry;
}

async function runCheck(cdp, name, entry) {
  const wantLang = langGateOf(entry);
  if (wantLang && wantLang !== LANG) {
    console.log('  SKIP  ' + name + '  — only runs under --lang ' + wantLang + ' (this run is --lang ' + LANG + ')');
    return { name, pass: true, skip: true };
  }
  try {
    await runnerOf(entry)(cdp);
    console.log('  PASS  ' + name);
    return { name, pass: true };
  } catch (e) {
    const detail = (e && e.message) ? e.message : String(e);
    console.log('  FAIL  ' + name + '  — ' + detail);
    return { name, pass: false, detail };
  }
}

async function main() {
  chromeProc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1440,900',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(ROOT, '.chrome-verify-port'),
    'about:blank',
  ], { stdio: 'ignore' });

  let exitCode = 0;
  try {
    const cdp = await connect(await wsUrl());
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    /* --user-data-dir above is a FIXED, reused profile (necessarily — see the
     * snap-confinement comment on killChrome), so its on-disk HTTP cache
     * persists across separate invocations of this script even though each
     * one spawns a brand-new Chrome process. A check can then be served a
     * cached pre-edit site/ response instead of the one just written to
     * disk, and PASS on bytes that no longer exist — a false pass indistin-
     * guishable from a real one until someone happens to `rm -rf
     * .chrome-verify-port` and watches the result change. Task 4's report
     * hit exactly this while proving logo-fallback discriminates. Disabling
     * the cache for the life of this CDP session (rather than, say, wiping
     * the profile directory here) is the least invasive fix: no extra flags,
     * no profile churn between runs, and it cannot mask a stale response
     * with a fresh one the way a half-applied fix could. */
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: BASE + '?lang=' + LANG });
    await sleep(2800);

    console.log('verify-port: ' + selected.length + ' check' + (selected.length === 1 ? '' : 's') +
      ' against ' + BASE + '  (lang=' + LANG + ')');
    const results = [];
    for (const name of selected) results.push(await runCheck(cdp, name, CHECKS[name]));

    const skipped = results.filter((r) => r.skip);
    const ran = results.filter((r) => !r.skip);
    const failed = ran.filter((r) => !r.pass);
    console.log('\n' + (ran.length - failed.length) + '/' + ran.length + ' passed' +
      (skipped.length ? '  (' + skipped.length + ' skipped)' : ''));
    exitCode = failed.length ? 1 : 0;
    cdp.close();
  } catch (e) {
    console.error(e);
    exitCode = 1;
  } finally {
    killChrome();
  }
  process.exit(exitCode);
}

main();
