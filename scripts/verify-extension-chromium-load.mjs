import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(import.meta.dirname, '..');
const extensionPath = path.resolve(process.argv[2] || path.join(projectRoot, '..', 'robo-afiliados-autonomo'));
const manifestPath = path.join(extensionPath, 'manifest.json');
const expectedWorker = 'background/service_worker.js';
const temporaryRoot = path.resolve(os.tmpdir());

async function findChromium() {
  const playwrightRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  const entries = await readdir(playwrightRoot, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)))
    .map((entry) => path.join(playwrightRoot, entry.name, 'chrome-win64', 'chrome.exe'));
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* Try the next installed test browser. */ }
  }
  throw new Error(`Chromium for Testing was not found under ${playwrightRoot}.`);
}

await access(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.manifest_version !== 3 || manifest.background?.service_worker !== expectedWorker) {
  throw new Error(`Extension manifest must declare MV3 worker ${expectedWorker}.`);
}

const chromiumPath = await findChromium();
const profilePath = await mkdtemp(path.join(temporaryRoot, 'achados-extension-load-'));
if (path.dirname(path.resolve(profilePath)) !== temporaryRoot) throw new Error('Temporary browser profile escaped the system temp directory.');

const browser = spawn(chromiumPath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${profilePath}`,
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let stderr = '';
browser.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-5000); });

async function readWorkerTarget() {
  const portFile = path.join(profilePath, 'DevToolsActivePort');
  const portInfo = (await readFile(portFile, 'utf8').catch(() => '')).trim().split(/\r?\n/);
  if (!portInfo[0]) return null;
  const targets = await fetch(`http://127.0.0.1:${portInfo[0]}/json/list`, { signal: AbortSignal.timeout(1000) }).then((response) => response.json()).catch(() => []);
  return targets.find((target) => target.type === 'service_worker' && target.url.startsWith('chrome-extension://') && target.url.endsWith(`/${expectedWorker}`)) || null;
}

let workerTarget;
try {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline && browser.exitCode === null) {
    workerTarget = await readWorkerTarget();
    if (workerTarget) break;
    await delay(100);
  }
  if (!workerTarget) throw new Error(`Extension service worker did not start. Chromium stderr: ${stderr || '(empty)'}`);
  const extensionId = new URL(workerTarget.url).hostname;
  console.log(JSON.stringify({
    passed: true,
    browser: 'Chromium for Testing',
    extensionLoaded: true,
    extensionId,
    serviceWorker: expectedWorker,
    sideEffects: 'No marketplace pages opened; no radar or catalog sync triggered.'
  }, null, 2));
} finally {
  if (browser.exitCode === null) {
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      browser.kill('SIGTERM');
    }
    if (browser.exitCode === null) await Promise.race([once(browser, 'exit').then(() => {}), delay(5000)]);
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rm(profilePath, { recursive: true, force: true });
      break;
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt >= 10) throw error;
      await delay(100 * (attempt + 1));
    }
  }
}
