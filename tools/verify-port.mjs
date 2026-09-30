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
  'testimonials-arabic': async (cdp) => {
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
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push(m.params.entry.text);
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

async function runCheck(cdp, name, fn) {
  try {
    await fn(cdp);
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

    const failed = results.filter((r) => !r.pass);
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
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
