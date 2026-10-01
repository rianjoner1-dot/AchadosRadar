import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';
import { isAllowedMarketplaceImageUrl } from '../src/modules/shared/marketplace-image-url.mjs';
import { classifyProductImageIdentity } from '../src/modules/catalog/image-identity.mjs';

export function isAllowedMarketplaceImage(image) {
  return Boolean(image && isAllowedMarketplaceImageUrl(image.platform, image.url));
}

export function classifyImageIdentity(image) {
  return classifyProductImageIdentity(image?.platform, image?.externalId, image?.url);
}

export function describeImageResult(imageResult, response, networkFailure) {
  const url = new URL(imageResult.url);
  return {
    host: url.host,
    path: url.pathname,
    ...(response ? { status: response.status, contentType: response.contentType } : {}),
    ...(networkFailure ? {
      networkError: networkFailure.errorText,
      blockedReason: networkFailure.blockedReason ?? null,
      canceled: Boolean(networkFailure.canceled)
    } : {}),
    naturalWidth: imageResult.naturalWidth,
    naturalHeight: imageResult.naturalHeight,
    timedOut: Boolean(imageResult.timedOut),
    ok: imageResult.naturalWidth > 1 && imageResult.naturalHeight > 1
  };
}

export async function checkImagesInChrome(images) {
  if (!Array.isArray(images) || images.some((image) => !isAllowedMarketplaceImage(image))) {
    throw new TypeError('Chrome image check accepts only HTTPS image URLs from the configured marketplace CDN hosts.');
  }
  const profilePath = await mkdtemp(path.join(os.tmpdir(), 'achados-image-check-'));
  let chrome;
  let socket;
  let nextId = 0;
  const pending = new Map();
  const responses = new Map();
  const requestUrls = new Map();
  const networkFailures = new Map();

  function command(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chrome DevTools timed out: ${method}`));
      }, 20000);
      pending.set(id, { resolve, reject, timeout, method });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.requestWillBeSent') {
      requestUrls.set(message.params.requestId, message.params.request.url);
    }
    if (message.method === 'Network.responseReceived') {
      const response = message.params.response;
      const value = { status: response.status, contentType: response.mimeType || '' };
      responses.set(response.url, value);
      const requestedUrl = requestUrls.get(message.params.requestId);
      if (requestedUrl) responses.set(requestedUrl, value);
    }
    if (message.method === 'Network.loadingFailed') {
      const failedUrl = requestUrls.get(message.params.requestId);
      if (failedUrl) networkFailures.set(failedUrl, {
        errorText: message.params.errorText,
        blockedReason: message.params.blockedReason,
        canceled: message.params.canceled
      });
    }
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(`${item.method}: ${message.error.message}`));
    else item.resolve(message.result);
  }

  try {
    chrome = spawn(resolveChromeExecutable(), [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profilePath}`, 'about:blank'
    ], { stdio: 'ignore', windowsHide: true });

    const portFile = path.join(profilePath, 'DevToolsActivePort');
    let endpoint;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
        endpoint = `http://127.0.0.1:${port}`;
        break;
      } catch {
        if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
        await delay(100);
      }
    }
    if (!endpoint) throw new Error('Chrome DevTools endpoint did not start.');

    let tabs = [];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      tabs = await (await fetch(`${endpoint}/json/list`)).json();
      if (tabs.some((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl)) break;
      await delay(100);
    }
    const page = tabs.find((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl);
    if (!page) throw new Error('Chrome did not expose a page target.');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    socket.addEventListener('message', onMessage);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    await command('Page.enable');
    await command('Runtime.enable');
    await command('Network.enable');
    await command('Network.setCacheDisabled', { cacheDisabled: true });
    await command('Network.setBlockedURLs', { urls: [
      '*rest/v1/rpc/record_product_metric*',
      '*rest/v1/rpc/report_product_image_failure*'
    ] });

    const results = [];
    const groups = new Map();
    for (const image of images) {
      const key = image.platform === 'magalu' ? 'https://www.magazinevoce.com.br/'
        : image.platform === 'mercadolivre' ? 'https://www.mercadolivre.com.br/'
          : 'https://achadosradar.vercel.app/';
      (groups.get(key) ?? groups.set(key, []).get(key)).push(image);
    }

    for (const [referer, group] of groups) {
      responses.clear();
      networkFailures.clear();
      await command('Network.setExtraHTTPHeaders', { headers: { Referer: referer } });
      const urls = group.map((image) => image.url);
      const expression = `Promise.all(${JSON.stringify(urls)}.map(url => new Promise(resolve => {
        const image = new Image();
        let timer;
        const finish = (timedOut = false) => {
          clearTimeout(timer);
          resolve({ url, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, timedOut });
        };
        image.onload = () => finish();
        image.onerror = () => finish();
        image.src = url;
        document.body.append(image);
        timer = setTimeout(() => finish(true), 15000);
      })))`;
      const evaluated = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (evaluated.exceptionDetails) throw new Error('Chrome could not inspect the image elements.');
      // Allow final DevTools loadingFinished/loadingFailed events to arrive after
      // the page-side image load/error promise settles.
      await delay(100);
      for (const imageResult of evaluated.result?.value ?? []) {
        const response = responses.get(imageResult.url);
        const matchingSources = group.filter((item) => item.url === imageResult.url);
        const source = matchingSources.length === 1 ? matchingSources[0] : null;
        results.push({
          ...describeImageResult(imageResult, response, networkFailures.get(imageResult.url)),
          identity: classifyImageIdentity(source)
        });
      }
      await command('Page.navigate', { url: 'about:blank' });
    }
    return results;
  } finally {
    for (const item of pending.values()) clearTimeout(item.timeout);
    socket?.close();
    if (chrome && chrome.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else chrome.kill();
      await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(3000)]);
    }
    const temporaryRoot = path.resolve(os.tmpdir());
    if (path.dirname(path.resolve(profilePath)) === temporaryRoot) {
      await rm(profilePath, { recursive: true, force: true }).catch(() => {});
    }
  }
}
