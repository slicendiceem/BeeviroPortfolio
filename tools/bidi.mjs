/* Does the Arabic build render the numbers the way they were written?
 *
 *   node tools/bidi.mjs            against http://localhost:4173/?lang=ar
 *
 * Latin and numeric runs inside an Arabic paragraph are bidi-neutral at their
 * edges. An unisolated "~1.15" puts the tilde on the wrong side of the number,
 * and "9-13.2" reads as "13.2-9" — a range pointing backwards. The client
 * screenshotted both. Words are not the problem here; the digits between them
 * are, which is why this reads pixels rather than source.
 *
 * Every character's on-screen x is measured with a Range. Inside a run that was
 * authored left-to-right, x must increase monotonically. Where it does not, the
 * reader is seeing something nobody wrote.
 */
import { spawn } from 'node:child_process';
import { requireChrome } from './chrome.mjs';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = requireChrome();
const PORT = 9800 + (process.pid % 300);
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/bv-bidi-' + process.pid,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  // /json/version hands back the BROWSER-level socket, which this Chrome build
  // (--headless=new) does not attach Page/Runtime to — every call against it
  // fails with "'Page.enable' wasn't found". Every other CDP tool in tools/
  // (jank.mjs, mobile.mjs, pointer.mjs, profile.mjs, shoot.mjs, check.mjs)
  // fetches /json/list and drives the page-typed target instead; matched here.
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome did not open a debugging port');
}

/* The probe, as a string, because it runs in the page rather than here.
   TECHNICAL RUN: a maximal stretch with no Arabic letters that holds at least
   one digit or Latin letter. Those are the runs the bidi algorithm reorders. */
const PROBE = `(() => {
  const ARABIC = /[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;
  const findings = [];

  function xsOf(node) {
    const out = [];
    for (let i = 0; i < node.data.length; i++) {
      const r = document.createRange();
      r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      out.push(b.width || b.height ? b.left : null);
    }
    return out;
  }

  function scanTextNode(node) {
    const s = node.data;
    if (!/[0-9A-Za-z]/.test(s)) return;
    const x = xsOf(node);
    let run = null;
    const flush = () => {
      if (!run) return;
      const seg = s.slice(run.a, run.b);
      if (/[0-9A-Za-z]/.test(seg) && seg.trim().length > 1) {
        let ok = true, prev = null;
        for (let i = run.a; i < run.b; i++) {
          if (x[i] == null) continue;
          if (prev != null && x[i] < prev) { ok = false; break; }
          prev = x[i];
        }
        if (!ok) findings.push({
          text: seg.trim(),
          context: s.trim().slice(0, 90),
          where: (node.parentElement && node.parentElement.className) || '',
        });
      }
      run = null;
    };
    for (let i = 0; i < s.length; i++) {
      if (ARABIC.test(s[i])) flush();
      else if (run) run.b = i + 1;
      else run = { a: i, b: i + 1 };
    }
    flush();
  }

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (!n.parentElement) continue;
    if (n.parentElement.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
    scanTextNode(n);
  }
  return JSON.stringify(findings);
})()`;

const ws = await wsUrl();
const sock = new WebSocket(ws);
let seq = 0;
const pending = new Map();
sock.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise((r) => sock.addEventListener('open', r));
const send = (method, params) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  sock.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  });
  return r && r.result ? r.result.value : undefined;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE + '?lang=ar' });
await sleep(3500);

const findings = [];
const seen = new Set();
const collect = async (label) => {
  const raw = await evaluate(PROBE);
  for (const f of JSON.parse(raw || '[]')) {
    const key = label + '|' + f.text + '|' + f.context;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(Object.assign({ at: label }, f));
  }
};

/* The home page first, with every card revealed. */
await evaluate('(() => { const b = document.getElementById("moreBtn"); '
  + 'for (let i = 0; i < 5; i++) if (b && !b.classList.contains("is-open")) b.click(); '
  + 'return 1; })()');
await sleep(600);
await collect('home');

/* Then every dossier, because that is where the numbers live.
   Called through BV_OPEN_CASE rather than by setting location.hash: the deep
   link is read exactly once, at the bottom of beeviro.js, and there is no
   hashchange listener — so a hash set after load opens nothing and this would
   have measured twenty-five copies of the home page. */
const slugs = await evaluate('JSON.stringify((window.BV_CLIENTS||[]).map(c=>c.slug))');
for (const slug of JSON.parse(slugs || '[]')) {
  await evaluate('(() => { window.BV_OPEN_CASE(' + JSON.stringify(slug) + '); return 1; })()');
  await sleep(450);
  await collect(slug);
  await evaluate('(() => { const x = document.getElementById("caseX"); if (x) x.click(); return 1; })()');
  await sleep(250);
}

for (const f of findings) {
  console.log('FAIL  ' + f.at + '  ' + JSON.stringify(f.text) + '  in: ' + f.context);
}
console.log(findings.length === 0
  ? 'PASS  every technical run reads as authored'
  : findings.length + ' mis-ordered run(s)');

sock.close();
chrome.kill();
process.exit(findings.length ? 1 : 0);
