import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const baseUrl = process.argv.find((argument) => argument.startsWith('http')) ?? 'http://127.0.0.1:4324';
const productIdArg = process.argv.find((argument) => argument.startsWith('--product-id='))?.slice('--product-id='.length) ?? '';
const platformArg = process.argv.find((argument) => argument.startsWith('--platform='))?.slice('--platform='.length) ?? 'magalu';
const liveProduct = Boolean(productIdArg);
if (liveProduct && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(productIdArg)) throw new Error('--product-id must be a UUID from the public catalog.');
if (!['magalu', 'mercadolivre'].includes(platformArg)) throw new Error('--platform must be magalu or mercadolivre.');
const healthResponse = await fetch(new URL('/', baseUrl), { signal: AbortSignal.timeout(3000) })
  .catch(() => null);
if (!healthResponse?.ok) throw new Error(`Site is unavailable at ${baseUrl}; start Astro and pass its URL.`);
const testId = productIdArg || randomUUID();
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'achados-archived-cart-'));
const chrome = spawn(resolveChromeExecutable(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--remote-allow-origins=*',
  `--user-data-dir=${profilePath}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });

let socket;
let nextId = 0;
const pending = new Map();
const trackedRequests = new Map();
const requestFailures = [];

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools timed out: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function onMessage(event) {
  const message = JSON.parse(event.data);
  if (!message.id) {
    const requestId = message.params?.requestId;
    if (message.method === 'Network.requestWillBeSent' && requestId) {
      const url = new URL(message.params.request.url);
      if (url.pathname.includes('/src/modules/') || url.pathname.includes('/node_modules/')) {
        trackedRequests.set(requestId, { path: url.pathname, status: null });
      }
    } else if (message.method === 'Network.responseReceived' && requestId) {
      const request = trackedRequests.get(requestId);
      if (request) request.status = message.params.response.status;
    } else if (message.method === 'Network.loadingFailed' && requestId) {
      const request = trackedRequests.get(requestId);
      if (request) requestFailures.push({ ...request, error: message.params.errorText });
    }
    return;
  }
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timeout);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Browser script failed.');
  return result.result.value;
}

async function waitForPage() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(path.join(profilePath, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome is still starting. */ }
    if (chrome.exitCode !== null) throw new Error(`Chrome exited with code ${chrome.exitCode}.`);
    await delay(100);
  }
  throw new Error('Chrome DevTools did not start.');
}

try {
  socket = new WebSocket(await waitForPage());
  socket.addEventListener('message', onMessage);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: [
    '*rest/v1/rpc/record_product_metric*',
    '*rest/v1/rpc/report_product_image_failure*'
  ] });

  if (liveProduct) {
    const productNavigation = await command('Page.navigate', { url: new URL(`/produto?id=${encodeURIComponent(testId)}`, baseUrl).href });
    if (productNavigation.errorText) throw new Error(`Could not load the live product page: ${productNavigation.errorText}`);
    let productReady = false;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      productReady = await evaluate("Boolean(document.querySelector('#productContent') && !document.querySelector('#productContent').hidden)");
      if (productReady) break;
      await delay(100);
    }
    if (!productReady) throw new Error('The real product did not load in the isolated browser.');
    await evaluate("document.querySelector('#saveProduct')?.click()");
    let savedFromProductPage = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      savedFromProductPage = await evaluate(`JSON.parse(localStorage.getItem('achados_radar_cart') || '[]').some((item) => item.id === ${JSON.stringify(testId)})`);
      if (savedFromProductPage) break;
      await delay(100);
    }
    if (!savedFromProductPage) throw new Error('The product page did not save the real item to the guest cart.');
  } else {
    await command('Page.navigate', { url: new URL('/', baseUrl).href });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('document.readyState') === 'complete') break;
      await delay(100);
    }
    const cartItem = {
      id: testId, platform: platformArg, title: 'Produto de teste arquivado',
      priceFormatted: 'R$ 10,00', savedAt: new Date().toISOString()
    };
    await evaluate(`localStorage.setItem('achados_radar_cart', ${JSON.stringify(JSON.stringify([cartItem]))})`);
  }
  const cartNavigation = await command('Page.navigate', { url: new URL('/carrinho', baseUrl).href });
  if (cartNavigation.errorText) throw new Error(`Could not load the cart page: ${cartNavigation.errorText}`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const pageReady = await evaluate(`document.readyState === 'complete' && location.pathname === ${JSON.stringify(new URL('/carrinho', baseUrl).pathname)}`);
    if (pageReady) break;
    await delay(100);
  }

  let result = null;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    result = await evaluate(`(() => {
      const row = [...document.querySelectorAll('.saved-item')].find((item) => item.dataset.id === ${JSON.stringify(testId)});
      if (!row) return null;
      const state = row.querySelector('[data-state]')?.textContent || '';
      const buy = row.querySelector('[data-buy]');
      const productLinks = [...row.querySelectorAll('a.saved-image, .saved-info h2 a, a.saved-details')];
      return {
        state,
        cartStatus: document.querySelector('#cartStatus')?.textContent || '',
        saved: JSON.parse(localStorage.getItem('achados_radar_cart') || '[]').some((item) => item.id === ${JSON.stringify(testId)}),
        buyHasHref: buy?.hasAttribute('href') ?? false,
        buyHref: buy?.getAttribute('href') ?? '',
        buyDisabled: buy?.getAttribute('aria-disabled') === 'true',
        priceText: row.querySelector('[data-price]')?.textContent || '',
        offerFacts: row.querySelector('[data-offer-facts]')?.textContent || '',
        productLinks: productLinks.length,
        productLinksWithHref: productLinks.filter((link) => link.hasAttribute('href')).length
      };
    })()`);
    if (liveProduct ? (result && !result.state.includes('Verificando preço')) : result?.state.includes('não está mais no catálogo')) break;
    await delay(150);
  }

  if (!liveProduct && result?.saved && result?.productLinksWithHref === 0) {
    await evaluate("document.querySelector('.saved-item [data-remove]')?.click()");
  }
  let removedAfterClick = false;
  if (!liveProduct) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      removedAfterClick = await evaluate(`!JSON.parse(localStorage.getItem('achados_radar_cart') || '[]').some((item) => item.id === ${JSON.stringify(testId)})`);
      if (removedAfterClick) break;
      await delay(100);
    }
  }

  const accountNavigation = await command('Page.navigate', { url: new URL('/conta', baseUrl).href });
  if (accountNavigation.errorText) throw new Error(`Could not load the account page: ${accountNavigation.errorText}`);
  let anonymousAccount = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    anonymousAccount = await evaluate(`(() => ({
      loginVisible: document.querySelector('#loginPanel')?.hidden === false,
      profileHidden: document.querySelector('#profilePanel')?.hidden === true,
      status: document.querySelector('#authStatus')?.textContent?.trim() || ''
    }))()`);
    if (anonymousAccount?.loginVisible && anonymousAccount?.profileHidden && !anonymousAccount?.status) break;
    await delay(100);
  }

  const liveCheckoutStateSafe = Boolean(result && (result.buyHasHref
    ? result.buyHref === `/api/out/${testId}` && !result.buyDisabled
    : result.buyDisabled));
  const cartStatePassed = liveProduct
    ? Boolean(result
      && result.saved
      && !result.state.includes('Verificando preço')
      && liveCheckoutStateSafe
      && result.priceText.toLocaleLowerCase('pt-BR').includes('preço'))
    : Boolean(result
      && result.saved
      && result.state.includes('não está mais no catálogo')
      && !result.buyHasHref
      && result.buyDisabled
      && result.productLinks > 0
      && result.productLinksWithHref === 0
      && removedAfterClick);
  const passed = Boolean(cartStatePassed
    && anonymousAccount?.loginVisible
    && anonymousAccount?.profileHidden
    && !anonymousAccount?.status);
  console.log(JSON.stringify({
    passed,
    mode: liveProduct ? 'live-catalog-read-only' : 'archived-product-guest-cart',
    catalogConfigured: liveProduct ? Boolean(result && !result.state.includes('não está mais no catálogo')) : (result?.state.includes('não está mais no catálogo') ?? false),
    cartItemPreserved: result?.saved ?? false,
    checkoutStateSafe: liveProduct ? liveCheckoutStateSafe : Boolean(result && !result.buyHasHref && result.buyDisabled),
    checkoutRoute: result?.buyHref ?? '',
    currentPrice: result?.priceText ?? '',
    currentOfferFacts: result?.offerFacts ?? '',
    productPageLinksRemoved: liveProduct ? null : Boolean(result && result.productLinks > 0 && result.productLinksWithHref === 0),
    anonymousRemovalWorks: liveProduct ? null : removedAfterClick,
    anonymousAccountReady: Boolean(anonymousAccount?.loginVisible && anonymousAccount?.profileHidden && !anonymousAccount?.status),
    accountStatus: anonymousAccount?.status ?? '',
    observedState: result?.state ?? 'cart item did not render',
    cartStatus: result?.cartStatus ?? '',
    requestFailures,
    writes: 0
  }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome.exitCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill();
    await Promise.race([exited, delay(3000)]);
  }
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
