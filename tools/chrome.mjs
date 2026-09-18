/* Where is Chrome?
 *
 * Every browser-driven tool here used to carry its own two-entry list of Windows
 * install paths. The repository moved to Linux and all fifteen died at once with
 * `chrome not found`. One lookup, imported everywhere, so the next move costs one
 * edit instead of fifteen.
 *
 *   node tools/chrome.mjs          print the resolved binary, or how to get one
 *
 * CHROME_PATH in the environment always wins.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CANDIDATES = [
  process.env.CHROME_PATH,
  // Windows — where this repository was built
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  // The wrapper below re-execs under confinement, so the PID we spawn is not
  // the PID that runs — kill() on it throws EACCES and the real browser leaks.
  // Prefer the inner binary the wrapper would have launched; it takes and
  // honors signals normally.
  '/snap/chromium/current/usr/lib/chromium-browser/chrome',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
];

/* A distro can put it anywhere; ask the shell before giving up. `which` writes
   to stderr and exits non-zero when it misses, so both are swallowed. */
function fromPath() {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const name of names) {
    try {
      const out = execFileSync(probe, [name], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
      const first = out.split(/\r?\n/)[0].trim();
      if (first && existsSync(first)) return first;
    } catch (e) { /* not on PATH — try the next name */ }
  }
  return null;
}

export function findChrome() {
  for (const p of CANDIDATES) if (p && existsSync(p)) return p;
  return fromPath();
}

/* What the tools actually want: a path, or a clear death. */
export function requireChrome() {
  const found = findChrome();
  if (found) return found;
  console.error('chrome not found.');
  console.error('Install one, or set CHROME_PATH to an existing binary:');
  console.error('  Debian/Ubuntu   sudo apt install chromium-browser');
  console.error('  Fedora          sudo dnf install chromium');
  console.error('  macOS           brew install --cask google-chrome');
  process.exit(1);
}

/* Run directly: report, and exit non-zero when there is nothing to drive. */
if (import.meta.url === 'file://' + process.argv[1]) {
  const found = findChrome();
  if (found) {
    console.log('PASS  chrome: ' + found);
  } else {
    console.log('FAIL  no chrome-family browser found');
    process.exit(1);
  }
}
