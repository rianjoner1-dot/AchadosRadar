import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const extensionDir = path.resolve(process.argv[2] ?? '../robo-afiliados-autonomo');
const browserExe = resolveChromeExecutable(process.argv[3]);
const debugPort = 9225;
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'codex-affiliate-chrome-'));
const browserLogFile = path.join(profileDir, 'chrome.log');

const child = spawn(browserExe, [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-mode',
  '--enable-logging',
  `--log-file=${browserLogFile}`,
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let launchError = null;
child.on('error', (error) => { launchError = error; });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = `http://127.0.0.1:${debugPort}`;
let worker = null;
let socket;

try {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (launchError) throw new Error(`Could not launch ${browserExe}: ${launchError.message}`);
    if (child.exitCode !== null) throw new Error(`${path.basename(browserExe)} exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        worker = targets.find((target) => target.type === 'service_worker' && target.url.endsWith('/background/service_worker.js'));
        if (worker) break;
      }
    } catch {}
    await sleep(500);
  }

  if (!worker) {
    const browserLog = await readFile(browserLogFile, 'utf8').catch(() => 'Chrome did not create a diagnostic log.');
    if (browserLog.includes('--disable-extensions-except is not allowed in Google Chrome')) {
      throw new Error('Google Chrome blocks command-line loading of local extensions. Reload the unpacked extension in chrome://extensions; this isolated test did not load it.');
    }
    console.error(browserLog.split(/\r?\n/).slice(-60).join('\n'));
    throw new Error('No project service worker appeared in Chrome DevTools targets.');
  }
  socket = new WebSocket(worker.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Could not connect to the service worker debugger.')), { once: true });
  });
  const probe = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Service worker debugger probe timed out.')), 5000);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      resolve(message.result?.result?.value);
    });
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 1', returnByValue: true } }));
  });
  if (probe !== 2) throw new Error('Service worker debugger probe returned an unexpected result.');
  console.log(JSON.stringify({
    result: 'loaded',
    browser: path.basename(path.dirname(path.dirname(browserExe))),
    extensionId: new URL(worker.url).hostname,
    serviceWorker: new URL(worker.url).pathname,
    debuggerProbe: probe,
  }));
} catch (error) {
  console.error(JSON.stringify({ result: 'failed', reason: error.message }));
  process.exitCode = 1;
} finally {
  socket?.close();
  if (child.exitCode === null && child.signalCode === null) {
    try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(5000),
    ]);
  }
  const resolvedTemp = path.resolve(os.tmpdir());
  const resolvedProfile = path.resolve(profileDir);
  if (resolvedProfile.startsWith(resolvedTemp + path.sep)) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await sleep(1000);
      }
    }
  }
}
