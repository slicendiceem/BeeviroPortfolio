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

/* NOT /json/version. That hands back the browser-level target, which carries
   no Page or Runtime domain: every call against it returns "'Page.enable'
   wasn't found", every evaluate() resolves to undefined, and the check then
   passes forever because the probe never ran. The page target is the one that
   can be driven — the same lookup every other CDP tool here uses. */
async function wsUrl() {
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

/* The probe, as a string, because it runs in the page rather than here. It is
   built per sweep so the caller can point it at one part of the document.

   TECHNICAL RUN: a maximal stretch with no Arabic letters that holds at least
   one digit or Latin letter. Those are the runs the bidi algorithm reorders —
   but most of them have nothing that CAN reorder, and measuring those reports
   the writing system rather than a defect. Three things narrow it:

   · TRIMMED to the first and last alphanumeric, then re-absorbing only a
     leading ~ or + and a trailing % × +. A run's outer whitespace and its ·
     separators sit on the bidi boundary and move there legitimately; including
     them measures the boundary, not the reading order.
   · RISKY only: a direction-neutral modifier touching an alphanumeric, or a
     dash between two digits. "Meta" and "31" cannot come out backwards.
   · WITHIN ONE LINE BOX. A wrapped run starts again at the margin, so x drops
     at every line break for reasons that have nothing to do with bidi. */
const PROBE = (roots) => `(() => {
  const ARABIC = /[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/;
  const ALNUM = /[0-9A-Za-z]/;
  const RISKY = (s) => /[~+%×→](?=[0-9A-Za-z])|(?<=[0-9A-Za-z])[~+%×→]|(?<=\\d)\\s*[-–—]\\s*(?=\\d)/u.test(s);
  const findings = [];

  /* Per character: where it is, and which line it landed on. */
  function boxesOf(node) {
    const xs = [], tops = [];
    for (let i = 0; i < node.data.length; i++) {
      const r = document.createRange();
      r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      const drawn = b.width || b.height;
      xs.push(drawn ? b.left : null);
      tops.push(drawn ? Math.round(b.top) : null);
    }
    return { xs: xs, tops: tops };
  }

  function scanTextNode(node) {
    const s = node.data;
    if (!ALNUM.test(s)) return;
    const box = boxesOf(node);
    const x = box.xs, tops = box.tops;
    let run = null;
    const flush = () => {
      if (!run) return;
      const r = run;
      run = null;

      let a = -1, b = -1;
      for (let i = r.a; i < r.b; i++) if (ALNUM.test(s[i])) { if (a < 0) a = i; b = i; }
      if (a < 0) return;
      if (a > r.a && (s[a - 1] === '~' || s[a - 1] === '+')) a--;
      if (b + 1 < r.b && (s[b + 1] === '%' || s[b + 1] === '×' || s[b + 1] === '+')) b++;

      const seg = s.slice(a, b + 1);
      if (seg.trim().length < 2) return;
      if (!RISKY(seg)) return;

      let ok = true, prev = null, line = null;
      for (let i = a; i <= b; i++) {
        if (x[i] == null) continue;
        if (tops[i] !== line) { line = tops[i]; prev = null; }
        if (prev != null && x[i] < prev) { ok = false; break; }
        prev = x[i];
      }
      if (!ok) findings.push({
        text: seg.trim(),
        context: s.trim().slice(0, 90),
        where: (node.parentElement && node.parentElement.className) || '',
      });
    };
    for (let i = 0; i < s.length; i++) {
      if (ARABIC.test(s[i])) flush();
      else if (run) run.b = i + 1;
      else run = { a: i, b: i + 1 };
    }
    flush();
  }

  for (const sel of ${JSON.stringify(roots)}) {
    const root = document.querySelector(sel);
    if (!root) continue;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!n.parentElement) continue;
      if (n.parentElement.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
      scanTextNode(n);
    }
  }
  return JSON.stringify(findings);
})()`;

/* EVERYTHING BELOW RUNS INSIDE main(), and the file ends by catching whatever
   it throws, because a browser spawned here and then abandoned cannot be
   cleaned up afterwards by anyone. The snap build re-execs under confinement,
   so a stranded copy ignores signals from this tool, from the shell, and from
   the person reading this — it holds its ~1 GB until the machine reboots. The
   port poll can time out, the socket can refuse, and sock.send() throws
   InvalidStateError if the far end closed mid-sweep; each of those is a throw
   on a path that would otherwise skip chrome.kill(). */
async function main() {
  const ws = await wsUrl();
  const sock = new WebSocket(ws);
  let seq = 0;
  const pending = new Map();
  sock.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });

  /* Waiting only on 'open' is the one failure the catch below cannot save us
     from: a promise that never settles never rejects, so a target that refuses
     the connection would hang here forever with the browser still up. Race the
     three outcomes and let a rejection fall through to main().catch. */
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('websocket never opened')), 15000);
    sock.addEventListener('open', () => { clearTimeout(timer); resolve(); });
    sock.addEventListener('error', () => { clearTimeout(timer); reject(new Error('websocket refused')); });
  });

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
  const collect = async (label, roots) => {
    const raw = await evaluate(PROBE(roots));
    for (const f of JSON.parse(raw || '[]')) {
      const key = label + '|' + f.text + '|' + f.context;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push(Object.assign({ at: label }, f));
    }
  };

  /* The home page first, with every card revealed — once, and while no dossier
     is open. Sweeping the whole document per dossier instead would re-measure
     the page sitting behind the open panel twenty-five times over, mid-
     animation, and file every line of it under whichever client was open. */
  await evaluate('(() => { const b = document.getElementById("moreBtn"); '
    + 'for (let i = 0; i < 5; i++) if (b && !b.classList.contains("is-open")) b.click(); '
    + 'return 1; })()');
  await sleep(600);
  await collect('home', ['main', 'footer']);

  /* Then every dossier, because that is where the numbers live.
     Called through BV_OPEN_CASE rather than by setting location.hash: the deep
     link is read exactly once, at the bottom of beeviro.js, and there is no
     hashchange listener — so a hash set after load opens nothing and this would
     have measured twenty-five copies of the home page. */
  const slugs = await evaluate('JSON.stringify((window.BV_CLIENTS||[]).map(c=>c.slug))');
  for (const slug of JSON.parse(slugs || '[]')) {
    await evaluate('(() => { window.BV_OPEN_CASE(' + JSON.stringify(slug) + '); return 1; })()');
    /* Long enough for the open transition to finish. Measuring a panel that is
       still growing reads positions nobody will ever see. */
    await sleep(600);
    await collect(slug, ['#case']);
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
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
