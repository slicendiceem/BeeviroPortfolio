/* No video on this site may be taken fullscreen.
 *
 *   node tools/video.mjs [--lang ar]
 *
 * Two kinds of video play here and both are framed deliberately: the hero comb
 * plays six reels inside hexagons, and a case file plays the client's film in a
 * 420px square. Fullscreen throws away the frame, the crop and the page around
 * it, and hands the reader a bare 420px file scaled up on a black screen — the
 * worst possible view of the work. It is also a route back to the raw media
 * that the blob-url defence exists to close.
 *
 * The interesting assertion is the LAST one. controlsList is a hint: Chrome
 * honours it, iOS Safari ignores it entirely, and nothing stops script calling
 * requestFullscreen() directly. So this asks the browser to go fullscreen WITH
 * a real user gesture (Runtime.evaluate userGesture) and requires that it did
 * not — the attribute is the polish, the guard is the guarantee.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireChrome } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const LANG = arg('lang', 'en');
const BASE = arg('url', 'http://localhost:4173/');

const CHROME = requireChrome();
const PORT = 9740 + (process.pid % 140);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(ROOT, '.chrome-video'), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = t.find((x) => x.type === 'page');
    if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch { /* not up */ }
  await sleep(250);
}
if (!wsUrl) { console.error('devtools never came up'); chrome.kill(); process.exit(1); }
const ws = new WebSocket(wsUrl);
let id = 0; const waiting = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data); const k = waiting.get(m.id);
  if (k) { waiting.delete(m.id); k(m); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (m, p) => new Promise((r) => {
  const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p || {} }));
});
/* userGesture matters here: fullscreen is gated on user activation, so without
   it every requestFullscreen() rejects on its own and the test passes while
   proving nothing. */
async function ev(expr, userGesture = false) {
  const r = await send('Runtime.evaluate',
    { expression: expr, awaitPromise: true, returnByValue: true, userGesture: userGesture });
  if (r.result && r.result.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text + ' ' +
      ((r.result.exceptionDetails.exception || {}).description || '').slice(0, 160));
  }
  return r.result.result.value;
}

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  — ' + detail : ''));
};

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument',
  { source: "try{localStorage.setItem('bv:motion','full')}catch(e){}" });
await send('Page.navigate', { url: BASE + '?lang=' + LANG });
await sleep(4500);

console.log('\nno video goes fullscreen · ' + LANG + '\n');

/* ── the hero comb reels ──────────────────────────────────────────────────── */
const hero = JSON.parse(await ev(`(() => {
  const v = [...document.querySelectorAll('.bv-cellx video')];
  return JSON.stringify({
    count: v.length,
    controls: v.filter((n) => n.controls).length,
    noFs: v.filter((n) => (n.getAttribute('controlslist') || '').includes('nofullscreen')).length,
    inline: v.filter((n) => n.hasAttribute('playsinline')).length,
    noPip: v.filter((n) => n.disablePictureInPicture).length,
  });
})()`));
check('the hero comb has reels playing', hero.count > 0, hero.count + ' videos');
check('none of them show controls', hero.controls === 0, hero.controls + ' with controls');
check('every hero reel refuses fullscreen', hero.noFs === hero.count,
  hero.noFs + '/' + hero.count);
check('every hero reel stays inline', hero.inline === hero.count,
  hero.inline + '/' + hero.count);
check('every hero reel refuses picture-in-picture', hero.noPip === hero.count,
  hero.noPip + '/' + hero.count);

/* ── the dossier film ─────────────────────────────────────────────────────── */
const subject = await ev(
  '(window.BV_CLIENTS.filter(function (c) { return c.film; })[0] || {}).slug || ""');
if (!subject) {
  console.log('  FAIL  no client has a film — nothing to test');
  ws.close(); chrome.kill(); process.exit(1);
}
await ev('window.BV_OPEN_CASE(' + JSON.stringify(subject) + ')');
await sleep(1600);
await ev(`(() => { const f = document.querySelector('.bv-film'); if (f) f.click(); })()`);
await sleep(3000);

const film = JSON.parse(await ev(`(() => {
  const v = document.querySelector('.bv-film video');
  if (!v) return JSON.stringify({ missing: true });
  return JSON.stringify({
    playing: v.readyState >= 3,
    controls: v.controls,
    list: v.getAttribute('controlslist') || '',
    inline: v.hasAttribute('playsinline'),
    noPip: v.disablePictureInPicture === true,
  });
})()`));
check('the film is playing with its own controls',
  film.playing === true && film.controls === true,
  'readyState ' + (film.playing ? 'ok' : 'NOT ready — the reel url did not load'));
check('the control bar has no fullscreen button',
  /nofullscreen/.test(film.list), 'controlslist: ' + film.list);
check('the film stays inline', film.inline === true);
check('the film refuses picture-in-picture', film.noPip === true);

/* THE ONE THAT MATTERS. controlsList only hides a button; iOS ignores it
   outright and script can always ask directly. Ask with a real user gesture
   and require that nothing went fullscreen. */
const forced = JSON.parse(await ev(`(async () => {
  const v = document.querySelector('.bv-film video');
  let threw = '';
  try {
    const p = v.requestFullscreen ? v.requestFullscreen()
      : (v.webkitRequestFullscreen ? v.webkitRequestFullscreen() : null);
    if (p && p.then) await p.catch((e) => { threw = e.name || 'rejected'; });
  } catch (e) { threw = e.name || 'threw'; }
  await new Promise((r) => setTimeout(r, 600));
  const el = document.fullscreenElement || document.webkitFullscreenElement || null;
  return JSON.stringify({
    inFullscreen: !!el,
    isTheVideo: el === v,
    threw: threw,
  });
})()`, true));
check('asking for fullscreen with a real user gesture does not get it',
  forced.inFullscreen === false,
  forced.inFullscreen ? 'the video went fullscreen' : (forced.threw || 'refused'));

/* And the same for the hero comb, which has no controls to click but is still
   a <video> any script or gesture can address. */
await ev(`(() => { const b = document.getElementById('caseX'); if (b) b.click(); })()`);
await sleep(1000);
const heroForced = JSON.parse(await ev(`(async () => {
  const v = document.querySelector('.bv-cellx video');
  if (!v) return JSON.stringify({ skip: true });
  try { const p = v.requestFullscreen && v.requestFullscreen(); if (p && p.then) await p.catch(() => {}); }
  catch (e) { /* refused */ }
  await new Promise((r) => setTimeout(r, 600));
  return JSON.stringify({ inFullscreen: !!document.fullscreenElement });
})()`, true));
check('nor can a hero comb reel be forced fullscreen',
  heroForced.skip === true || heroForced.inFullscreen === false,
  heroForced.skip ? '(no reel on this tier)' : '');

/* iOS Safari has its own fullscreen gesture on a <video> and ignores both
   controlsList and the Fullscreen API this test just exercised — it fires
   `webkitbeginfullscreen` and takes over the screen. Headless Chrome has no
   such path, so this is the one thing here that can only be checked in the
   source. It is the platform the request was actually about, so it is checked
   rather than assumed. */
const beeviroSrc = readFileSync(path.join(ROOT, 'site/js/beeviro.js'), 'utf8');

/* The wiring, not a copied string. This first demanded the literal event name
   in both files, which would have failed a correct implementation and passed a
   duplicated one — the guard belongs in a single helper. What has to be true is
   that the helper handles the iOS event and that EVERY place building a video
   routes through it. */
const guardsIos = /webkitbeginfullscreen/i.test(beeviroSrc);
const callers = ['site/js/beeviro.js', 'site/js/hive.js']
  .filter((f) => !/BV_NO_FULLSCREEN\s*\(/.test(readFileSync(path.join(ROOT, f), 'utf8')));
check('the guard handles iOS’s own fullscreen gesture', guardsIos,
  'SOURCE CHECK — headless Chrome cannot fire the iOS path');
check('and every file that builds a video routes through it',
  callers.length === 0, callers.length ? callers.join(", ") + " does not call it" : "");

const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
