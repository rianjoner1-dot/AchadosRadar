import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const baseUrl = process.argv.find((arg) => arg.startsWith('http')) ?? 'https://achadosradar.vercel.app';
const summaryOnly = process.argv.includes('--summary');
const saveScreenshots = process.argv.includes('--shots');
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'achados-radar-perf-'));
let chrome;
let socket;
let nextId = 0;
const pending = new Map();
const requests = new Map();
const vitalsObserver = `(() => {
  const state = { lcp: 0, cls: 0, clsSessionValue: 0, clsSessionStart: 0, clsSessionLast: 0, shifts: [], interactions: new Map(), blockedImageReportCalls: 0 };
  window.__achadosPerf = state;
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) state.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) {
    if (!state.clsSessionStart || e.startTime - state.clsSessionLast > 1000 || e.startTime - state.clsSessionStart > 5000) {
      state.clsSessionStart = e.startTime;
      state.clsSessionValue = 0;
    }
    state.clsSessionLast = e.startTime;
    state.clsSessionValue += e.value;
    state.cls = Math.max(state.cls, state.clsSessionValue);
    if (state.shifts.length < 12) state.shifts.push({ value: Number(e.value.toFixed(4)), startTime: Math.round(e.startTime), sources: (e.sources || []).slice(0, 3).map(s => {
      const n = s.node;
      let node = n?.tagName?.toLowerCase() || '';
      if (n?.id) node += '#' + n.id;
      if (typeof n?.className === 'string' && n.className.trim()) node += '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.');
      return { node: n ? node : null,
        previousRect: s.previousRect && { x: Math.round(s.previousRect.x), y: Math.round(s.previousRect.y), width: Math.round(s.previousRect.width), height: Math.round(s.previousRect.height) },
        currentRect: s.currentRect && { x: Math.round(s.currentRect.x), y: Math.round(s.currentRect.y), width: Math.round(s.currentRect.width), height: Math.round(s.currentRect.height) } };
    }) });
  } }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) state.interactions.set(e.interactionId, Math.max(state.interactions.get(e.interactionId) || 0, e.duration)); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch {}
})();`;
const imageReportGuard = `(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (String(url).includes('/rpc/report_product_image_failure')) {
      window.__achadosPerf.blockedImageReportCalls += 1;
      return Promise.resolve(new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return originalFetch(input, init);
  };
})();`;

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome DevTools timed out: ${method}`)); }, 45_000);
    pending.set(id, { resolve, reject, timeout, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function waitForDebugEndpoint() {
  const portFile = path.join(profilePath, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
      return `http://127.0.0.1:${port}`;
    } catch {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}`);
      await delay(100);
    }
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

function onMessage(event) {
  const message = JSON.parse(event.data);
  if (!message.id) {
    const id = message.params?.requestId;
    if (!id) return;
    if (message.method === 'Network.requestWillBeSent') {
      requests.set(id, { url: message.params.request.url, type: message.params.type, status: null, encodedBytes: 0, failed: null });
    } else if (message.method === 'Network.responseReceived') {
      const row = requests.get(id);
      if (row) row.status = message.params.response.status;
    } else if (message.method === 'Network.loadingFinished') {
      const row = requests.get(id);
      if (row) row.encodedBytes = message.params.encodedDataLength ?? 0;
    } else if (message.method === 'Network.loadingFailed') {
      const row = requests.get(id);
      if (row) row.failed = message.params.errorText;
    }
    return;
  }
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
  const endpoint = await waitForDebugEndpoint();
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
  // Benchmarks may load broken marketplace images, but must not write metrics or
  // enqueue product image reports as a side effect of measuring performance.
  await command('Network.setBlockedURLs', { urls: ['*rest/v1/rpc/record_product_metric*'] });
  await command('Network.setCacheDisabled', { cacheDisabled: true });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `${vitalsObserver}\n${imageReportGuard}` });

  const results = [];
  for (const viewport of [{ width: 390, height: 844, mobile: true }, { width: 1440, height: 900, mobile: false }]) {
    requests.clear();
    await command('Network.clearBrowserCache');
    await command('Network.clearBrowserCookies');
    await command('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 });
    await command('Emulation.setCPUThrottlingRate', { rate: viewport.mobile ? 4 : 1 });
    await command('Network.emulateNetworkConditions', {
      offline: false, latency: 150, downloadThroughput: 209715, uploadThroughput: 98304, connectionType: 'cellular4g'
    });

    const navigation = await command('Page.navigate', { url: new URL('/', baseUrl).href });
    if (navigation.errorText) throw new Error(`Could not load production home: ${navigation.errorText}`);
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const state = await command('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (state.result.value === 'complete') { ready = true; break; }
      await delay(100);
    }
    if (!ready) throw new Error('Page load timed out.');
    let catalogReady = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        expression: `(() => { const s = document.querySelector('#catalogStatus')?.textContent || ''; return !/Carregando|Buscando/.test(s) && (document.querySelectorAll('.catalog-card').length > 0 || /falha|erro/i.test(s)); })()`,
        returnByValue: true
      });
      if (state.result.value) { catalogReady = true; break; }
      await delay(100);
    }
    if (!catalogReady) throw new Error('Catalog did not settle before the performance timeout.');
    const visibleImages = await command('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `new Promise(resolve => {
        const images = [...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
        const summarize = () => ({ total: images.length, loaded: images.filter(image => image.complete && image.naturalWidth > 0).length,
          failed: images.filter(image => image.complete && image.naturalWidth === 0).length,
          pending: images.filter(image => !image.complete).length,
          failedUrls: images.filter(image => image.complete && image.naturalWidth === 0).map(image => ({
            alt: image.alt, originalUrl: image.dataset.originalImageUrl || null, currentUrl: image.currentSrc || image.src
          })) });
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(summarize()); };
        const timer = setTimeout(finish, 8000);
        Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolveImage => {
          image.addEventListener('load', resolveImage, { once: true }); image.addEventListener('error', resolveImage, { once: true });
        }))).then(finish);
        if (!images.length || images.every(image => image.complete)) finish();
      })`
    });
    await delay(250);
    const loadVitals = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const p = window.__achadosPerf || {}; const rect = selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null; }; return { lcpMs: Math.round(p.lcp || 0), cls: Number((p.cls || 0).toFixed(4)), layoutShiftSources: p.shifts || [], visibleImages: ${JSON.stringify(visibleImages.result.value)}, cardsAtSettledLoad: document.querySelectorAll('.catalog-card').length, footerRect: rect('.site-footer'), mainRect: rect('#main-content'), viewport: { width: innerWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight } }; })()`
    });
    if (saveScreenshots) {
      const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const imagePath = path.join(process.cwd(), 'docs', 'evidencias', `performance-${viewport.width}px.png`);
      await writeFile(imagePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Screenshot performance: ${imagePath}`);
    }

    const rect = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const e = document.querySelector('#catalogSearch'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`
    });
    if (rect.result.value) {
      const { x, y } = rect.result.value;
      await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await command('Input.insertText', { text: 'fone' });
      await delay(1500);
    }
    await delay(1000);
    const metricRequests = [...requests.values()].filter((row) => row.url.includes('/rpc/record_product_metric'));
    const measured = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const p = window.__achadosPerf || {};
        const groups = [...(p.interactions?.values?.() || [])].sort((a, b) => a - b);
        return { lcpMs: Math.round(p.lcp || 0), cls: Number((p.cls || 0).toFixed(4)), layoutShiftSources: p.shifts || [],
          interactionCount: groups.length, inpApproxMs: groups.length ? Math.round(groups[groups.length - 1]) : null,
          blockedImageFailureReportRequests: p.blockedImageReportCalls || 0,
          cardsAfterSearch: document.querySelectorAll('.catalog-card').length,
          catalogStatus: document.querySelector('#catalogStatus')?.textContent?.trim() || null,
          searchPlaceholder: document.querySelector('#catalogSearch')?.getAttribute('placeholder') || null };
      })()`
    });
    const rows = [...requests.values()];
    const topResources = rows.slice().sort((a, b) => b.encodedBytes - a.encodedBytes).slice(0, 5).map(({ url, type, status, encodedBytes, failed }) => ({
      host: new URL(url).host, type, status, encodedBytes, failed
    }));
    results.push({
      viewport: `${viewport.width}x${viewport.height}`, network: '150ms RTT / 1.6Mbps down / 768Kbps up',
      requestCount: rows.length, encodedResponseBytes: rows.reduce((sum, row) => sum + row.encodedBytes, 0),
      localAndRemoteImages: rows.filter((row) => row.type === 'Image').length,
      blockedSyntheticMetricRequests: metricRequests.length,
      blockedImageFailureReportRequests: measured.result.value.blockedImageFailureReportRequests,
      failedRequests: rows.filter((row) => row.failed).map(({ url, type, failed }) => ({ host: new URL(url).host, path: new URL(url).pathname, type, failed })),
      ...measured.result.value, topResources
    });
    results.at(-1).pageLoadVitals = loadVitals.result.value;
  }
  const report = { url: baseUrl, measuredAt: new Date().toISOString(), results };
  if (summaryOnly) report.results = results.map((result) => ({
    viewport: result.viewport, network: result.network, requestCount: result.requestCount,
    encodedResponseBytes: result.encodedResponseBytes, imageRequestCount: result.localAndRemoteImages,
    cardsAtSettledLoad: result.pageLoadVitals.cardsAtSettledLoad,
    footerRect: result.pageLoadVitals.footerRect, mainRect: result.pageLoadVitals.mainRect,
    documentScrollHeight: result.pageLoadVitals.viewport.scrollHeight,
    visibleImages: result.pageLoadVitals.visibleImages,
    lcpMs: result.pageLoadVitals.lcpMs, cls: result.pageLoadVitals.cls,
    layoutShiftSources: result.pageLoadVitals.layoutShiftSources,
    interactionCount: result.interactionCount, inpApproxMs: result.inpApproxMs,
    cardsAfterSearch: result.cardsAfterSearch, catalogStatus: result.catalogStatus,
    blockedSyntheticMetricRequests: result.blockedSyntheticMetricRequests,
    blockedImageFailureReportRequests: result.blockedImageFailureReportRequests,
    failedRequests: result.failedRequests
  }));
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const item of pending.values()) clearTimeout(item.timeout);
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else chrome.kill();
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(3000)]);
  }
  try { await rm(profilePath, { recursive: true, force: true }); }
  catch { console.warn(`Temporary Chrome profile cleanup deferred: ${profilePath}`); }
}
