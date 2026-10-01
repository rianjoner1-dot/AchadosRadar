import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(import.meta.dirname, '..');
const extensionPath = path.resolve(projectRoot, '..', 'robo-afiliados-autonomo');
const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
const productSpecs = process.argv.slice(2)
  .filter((argument) => argument.startsWith('--product='))
  .map((argument) => argument.slice('--product='.length))
  .map((value) => {
    const [platform, expectedId, url] = value.split('|');
    if (!['magalu', 'mercadolivre'].includes(platform) || !expectedId || !url) throw new Error('Use --product=platform|ID|HTTPS_URL.');
    const parsedUrl = new URL(url);
    const allowedHost = platform === 'magalu'
      ? ['magazineluiza.com.br', 'magazinevoce.com.br'].some((host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`))
      : ['mercadolivre.com.br', 'mercadolivre.com'].some((host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`));
    if (parsedUrl.protocol !== 'https:' || !allowedHost) throw new Error(`Expected an official HTTPS ${platform} product page.`);
    return { platform, expectedId, url: parsedUrl.href };
  });
if (!productSpecs.length) throw new Error('Provide at least one --product=platform|ID|HTTPS_URL argument.');
if (manifest.manifest_version !== 3 || manifest.background?.service_worker !== 'background/service_worker.js') throw new Error('The extension MV3 service worker is missing.');

async function findBrowser() {
  const configuredBrowser = process.env.ACHADOS_CHROME_EXECUTABLE?.trim();
  if (configuredBrowser) {
    const resolvedPath = path.resolve(configuredBrowser);
    await access(resolvedPath);
    return { path: resolvedPath, name: 'Google Chrome stable with a temporary profile' };
  }
  const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)))
    .map((entry) => path.join(root, entry.name, 'chrome-win64', 'chrome.exe'));
  for (const candidate of candidates) {
    try { await access(candidate); return { path: candidate, name: 'Chromium for Testing' }; } catch { /* Try the next installed test browser. */ }
  }
  throw new Error(`Chromium for Testing was not found under ${root}.`);
}

const selectedBrowser = await findBrowser();
const temporaryRoot = path.resolve(os.tmpdir());
const profilePath = await mkdtemp(path.join(temporaryRoot, 'achados-product-capture-'));
if (path.dirname(path.resolve(profilePath)) !== temporaryRoot) throw new Error('Temporary browser profile escaped the system temp directory.');
const browser = spawn(selectedBrowser.path, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0',
  `--user-data-dir=${profilePath}`,
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let stderr = '';
browser.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-5000); });
const pendingCommands = new Map();
let commandId = 0;
let socket;

async function getTargets() {
  const portFile = path.join(profilePath, 'DevToolsActivePort');
  const port = (await readFile(portFile, 'utf8').catch(() => '')).trim().split(/\r?\n/)[0];
  if (!port) return [];
  return fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
    .then((response) => response.json()).catch(() => []);
}

async function waitForWorker() {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline && browser.exitCode === null) {
    const targets = await getTargets();
    const worker = targets.find((target) => target.type === 'service_worker'
      && target.url.startsWith('chrome-extension://')
      && target.url.endsWith('/background/service_worker.js'));
    if (worker) return worker;
    await delay(100);
  }
  throw new Error(`Extension service worker did not start. Chromium stderr: ${stderr || '(empty)'}`);
}

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`DevTools command timed out: ${method}`));
    }, 15_000);
    pendingCommands.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.exception?.value;
    const location = response.exceptionDetails.lineNumber === undefined
      ? ''
      : ` at ${response.exceptionDetails.lineNumber + 1}:${(response.exceptionDetails.columnNumber || 0) + 1}`;
    throw new Error(`${response.exceptionDetails.text || 'Extension evaluation failed.'}${detail ? `: ${detail}` : ''}${location}`);
  }
  return response.result?.value;
}

async function sendTabMessage(tabId, message) {
  const expression = `chrome.tabs.sendMessage(${tabId}, ${JSON.stringify(message)}).then(value => ({ ok: true, value }), error => ({ ok: false, error: String(error.message || error) }))`;
  return evaluate(expression);
}

const capturedProducts = [];
try {
  const worker = await waitForWorker();
  socket = new WebSocket(worker.webSocketDebuggerUrl);
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const pending = pendingCommands.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingCommands.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await send('Runtime.enable');

  for (const spec of productSpecs) {
    const tabId = await evaluate(`chrome.tabs.create({ url: ${JSON.stringify(spec.url)}, active: false }).then(tab => tab.id)`);
    const deadline = Date.now() + 30_000;
    let ping;
    while (Date.now() < deadline && browser.exitCode === null) {
      const tab = await evaluate(`chrome.tabs.get(${tabId}).then(value => ({ status: value.status, url: value.url }))`);
      if (tab?.status === 'complete') {
        const response = await sendTabMessage(tabId, { type: 'PING' });
        if (response?.ok && response.value?.platform === spec.platform) { ping = response.value; break; }
      }
      await delay(300);
    }
    if (!ping) {
      capturedProducts.push({ platform: spec.platform, expectedId: spec.expectedId, passed: false, error: 'Page or extension content script did not become ready.' });
      continue;
    }

    const messageType = spec.platform === 'magalu' ? 'CRAWL_MAGALU_PRODUCT' : 'CRAWL_MERCADOLIVRE_PRODUCT';
    const response = await sendTabMessage(tabId, { type: messageType, options: { topicName: 'Validação local' } });
    const item = response?.value?.item;
    const pageDiagnostic = await evaluate(`chrome.scripting.executeScript({ target: { tabId: ${tabId} }, func: () => ({
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      heading: document.querySelector('h1')?.innerText?.trim().slice(0, 180) || null,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
      ogPrice: document.querySelector('meta[property="product:price:amount"]')?.content || null,
      textStart: document.body?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 320) || null
    }) }).then(results => results[0]?.result || null)`);
    const images = Array.isArray(item?.images) ? item.images : [];
    const passed = Boolean(response?.ok && response.value?.ok && item?.id === spec.expectedId && item.title && Number(item.price) > 0 && images.length > 0);
    capturedProducts.push({
      platform: spec.platform,
      expectedId: spec.expectedId,
      passed,
      capturedId: item?.id || null,
      title: item?.title || null,
      price: Number.isFinite(Number(item?.price)) ? Number(item.price) : null,
      stockStatus: item?.stockStatus ?? null,
      stockQuantity: item?.stockQuantity ?? null,
      shipping: item?.shipping || null,
      installments: item?.installments || null,
      coupon: item?.coupon || null,
      imageCount: images.length,
      pageDiagnostic,
      error: response?.error || response?.value?.error || null
    });
  }

  console.log(JSON.stringify({
    browser: selectedBrowser.name,
    extensionWorkerStarted: true,
    productPagesOpened: productSpecs.length,
    mode: 'read-only extraction; no save, bridge, Supabase, radar or affiliate navigation',
    passed: capturedProducts.every((product) => product.passed),
    products: capturedProducts
  }, null, 2));
  if (capturedProducts.some((product) => !product.passed)) process.exitCode = 1;
} finally {
  for (const command of pendingCommands.values()) clearTimeout(command.timeout);
  socket?.close();
  if (browser.exitCode === null) {
    if (process.platform === 'win32' && browser.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else browser.kill('SIGTERM');
    if (browser.exitCode === null) await Promise.race([once(browser, 'exit').then(() => {}), delay(5000)]);
  }
  for (let attempt = 0; ; attempt += 1) {
    try { await rm(profilePath, { recursive: true, force: true }); break; }
    catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code) || attempt >= 10) throw error;
      await delay(100 * (attempt + 1));
    }
  }
}
