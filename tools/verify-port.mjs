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
