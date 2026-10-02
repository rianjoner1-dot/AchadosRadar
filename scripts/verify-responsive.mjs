import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
if (args.includes('--help')) {
  console.log('Optional flow: --smoke-admin-guest asserts anonymous visitors cannot see admin metrics.');
  console.log('Uso: node scripts/verify-responsive.mjs [URL] [--routes=/,/conta] [--viewports=390,1440]');
  console.log('Saida: --summary-only mostra somente o resultado por rota e o detalhe da galeria real.');
  console.log('Fluxos opcionais: --smoke-search valida busca, loja, precos minimo/maximo e ordenacao sem registrar eventos.');
  console.log('Fluxos opcionais: --smoke-sectors valida setor, busca, loja, preco e restauracao da URL no catalogo de demonstracao.');
  console.log('Fluxos opcionais: --smoke-related-feed percorre as paginas relacionadas disponiveis sem abrir ofertas.');
  console.log('Fluxos opcionais: --smoke-guest-cart valida salvar/remover um produto de demonstração sem sair para o marketplace.');
  console.log('Fluxos opcionais: --smoke-account-ui valida o nome da primeira conta e a seleção visual de foto sem enviar dados.');
  console.log('Rotas: caminhos separados por vírgula; use @first-live-product junto com /.');
  process.exit(0);
}
const baseUrl = args.find((argument) => !argument.startsWith('--')) ?? 'http://127.0.0.1:4323';
const defaultRoutes = ['/', '/produto/MLB3299039091', '@first-live-product', '/carrinho', '/conta', '/privacidade'];
const routes = option('routes')?.split(',').map((route) => route.trim()).filter(Boolean) ?? defaultRoutes;
const smokeAdminGuest = args.includes('--smoke-admin-guest');
if (smokeAdminGuest && !routes.includes('/painel-admin')) throw new Error('--smoke-admin-guest requires --routes=/painel-admin.');
const smokeAccountUi = args.includes('--smoke-account-ui');
if (smokeAccountUi && !routes.includes('/conta')) throw new Error('--smoke-account-ui requires --routes=/conta.');
const rawViewports = option('viewports')?.split(',').map((value) => Number(value.trim())) ?? [390, 1440];
const viewports = [...new Set(rawViewports)];
if (!routes.length) throw new Error('--routes deve conter ao menos uma rota.');
if (routes.includes('@first-live-product') && !routes.includes('/')) throw new Error('--routes=@first-live-product exige também a rota /.');
if (!viewports.length || viewports.some((width) => !Number.isSafeInteger(width) || width < 320 || width > 3840)) {
  throw new Error('--viewports deve conter larguras inteiras entre 320 e 3840 px.');
}
try {
  const parsedBaseUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) throw new Error();
} catch {
  throw new Error('A URL base deve usar HTTP ou HTTPS.');
}
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'achados-radar-responsive-'));
let chrome;
let socket;
let nextId = 0;
let currentCheck = 'startup';
const pending = new Map();

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools command timed out: ${method} while checking ${currentCheck}`));
      }, 30_000);
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

function onSocketMessage(event) {
  const message = JSON.parse(event.data);
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
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000',
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  chrome.unref();

  const debugEndpoint = await waitForDebugEndpoint();
  let tabs = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${debugEndpoint}/json/list`);
    tabs = await response.json();
    if (tabs.some((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl)) break;
    await delay(100);
  }
  const page = tabs.find((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl);
  if (!page) throw new Error('Chrome did not expose a page target.');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener('message', onSocketMessage);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Log.enable');
  await command('Accessibility.enable');
  await command('Network.enable');
  // Keep an accessibility audit from creating synthetic anonymous product-view metrics.
  await command('Network.setBlockedURLs', { urls: [
    '*rest/v1/rpc/record_product_metric*',
    '*rest/v1/rpc/report_product_image_failure*',
    '*/api/out/*'
  ] });

  const results = [];
  const browserDiagnostics = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') browserDiagnostics.push({ type: 'exception', details: message.params.exceptionDetails?.text });
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry?.level)) browserDiagnostics.push({ type: message.params.entry.level, text: message.params.entry.text });
  });
  const skipped = [];
  let guestCartSmoke = null;
  let adminGuestSmoke = null;
  let catalogSearchSmoke = null;
  let sectorFilterSmoke = null;
  let relatedFeedSmoke = null;
  let accountUiSmoke = null;
  let isStaticArtifact = false;
  try {
    const probe = await fetch(new URL('/_vercel/speed-insights/script.js', baseUrl), { signal: AbortSignal.timeout(3000) });
    isStaticArtifact = probe.status === 204 || probe.headers.get('x-achados-static-artifact') === 'true';
  } catch { /* A browser navigation below will report an unavailable server. */ }
  for (const width of viewports) {
    let firstLiveProductRoute = null;
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
    for (const route of routes) {
      currentCheck = `${width}px ${route}`;
      if (isStaticArtifact && route !== '/' && route !== '/produto/MLB3299039091') {
        skipped.push({ viewport: width, route, reason: 'Static artifact host does not serve this SSR route; validate it in Astro dev or Vercel preview.' });
        continue;
      }
      const targetRoute = route === '@first-live-product' ? firstLiveProductRoute : route;
      if (route === '@first-live-product' && isStaticArtifact) {
        skipped.push({ viewport: width, route: targetRoute ?? route, reason: 'Static artifact host does not run the SSR product-by-query route; validate this route in dev or Vercel preview.' });
        continue;
      }
      if (!targetRoute) throw new Error('The live catalog did not expose a product detail link for this viewport.');
      const navigation = await command('Page.navigate', { url: new URL(targetRoute, baseUrl).href });
      if (navigation.errorText) throw new Error(`Could not load ${targetRoute}: ${navigation.errorText}`);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const state = await command('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (state.result.value === 'complete') { ready = true; break; }
        await delay(100);
      }
      if (!ready) throw new Error(`Page load timed out: ${route}`);
      if (smokeAccountUi && route === '/conta' && width === viewports[0]) {
        const formState = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => { const name = document.querySelector('#newAccountName'); const file = document.querySelector('#avatarFile');
            const card = file?.closest('label.avatar-upload-card');
            return { nameField: Boolean(name && name.getAttribute('autocomplete') === 'name' && Number(name.maxLength) === 80),
              fileAccept: file?.accept || '', cardCopy: card?.textContent?.replace(/\\s+/g, ' ').trim() || '',
              labelOwnsInput: Boolean(card && card.contains(file)), filesOutput: Boolean(document.querySelector('#avatarFileName')) }; })()`
        });
        const state = formState.result.value;
        if (!state.nameField || !state.labelOwnsInput || !state.filesOutput || !state.cardCopy.includes('Clique para adicionar uma foto') ||
          !['image/jpeg', 'image/png', 'image/webp'].every((type) => state.fileAccept.includes(type))) {
          throw new Error(`Account form contract failed: ${JSON.stringify(state)}`);
        }
        const sampleFile = path.join(profilePath, 'avatar-smoke.png');
        await writeFile(sampleFile, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f9sAAAAASUVORK5CYII=', 'base64'));
        await command('DOM.enable');
        const documentRoot = await command('DOM.getDocument', { depth: 1 });
        const fileNode = await command('DOM.querySelector', { nodeId: documentRoot.root.nodeId, selector: '#avatarFile' });
        if (!fileNode.nodeId) throw new Error('Avatar file input was not present in the account form.');
        await command('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [sampleFile] });
        await command('Runtime.evaluate', { expression: `document.querySelector('#avatarFile')?.dispatchEvent(new Event('change', { bubbles: true }))` });
        const selectedFile = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `({value: document.querySelector('#avatarFileName')?.textContent?.trim() || '', fileCount: document.querySelector('#avatarFile')?.files?.length || 0})`
        });
        accountUiSmoke = { ...state, selectedFileNameShown: selectedFile.result.value.value === 'avatar-smoke.png', selectedFileCount: selectedFile.result.value.fileCount, remoteWrites: 0 };
        if (!accountUiSmoke.selectedFileNameShown || accountUiSmoke.selectedFileCount !== 1) {
          throw new Error(`Avatar selection did not update its visible filename: ${JSON.stringify({ ...accountUiSmoke, browserDiagnostics })}`);
        }
      }
      if (smokeAdminGuest && route === '/painel-admin') {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const gate = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `document.querySelector('#adminStatus')?.textContent?.includes('Entre na conta administrativa') === true`
          });
          if (gate.result.value) break;
          await delay(100);
        }
      }
      if (route === '/') {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const link = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `document.querySelector('#catalogGrid a[href^="/produto?id="]')?.getAttribute('href') || null`
          });
          if (link.result.value) { firstLiveProductRoute = link.result.value; break; }
          await delay(100);
        }
      }
      const liveProductRoute = targetRoute.startsWith('/produto?id=');
      if (liveProductRoute) {
        let productContentReady = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const state = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => { const content = document.querySelector('#productContent'); return Boolean(content && !content.hidden); })()`
          });
          if (state.result.value) { productContentReady = true; break; }
          await delay(100);
        }
        if (!productContentReady) throw new Error(`Live product details did not load: ${route}`);
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const state = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `Boolean(document.querySelector('#relatedGrid .related-card'))`
          });
          if (state.result.value) break;
          await delay(100);
        }
      }
      await delay(route === '/' ? 1_200 : 200);
      const evaluation = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const width = window.innerWidth;
          const overflow = [...document.querySelectorAll('body *')].flatMap((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (!element.getClientRects().length || style.visibility === 'hidden' || style.display === 'none') return [];
            return rect.left < -1 || rect.right > width + 1
              ? [{ tag: element.tagName, id: element.id, className: String(element.className || ''), left: Math.round(rect.left), right: Math.round(rect.right) }]
              : [];
          }).slice(0, 8);
          return { route: location.pathname, viewport: width, rootClient: document.documentElement.clientWidth,
            rootScroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth,
            overflowElements: overflow,
            liveProduct: location.pathname === '/produto' && Boolean(new URLSearchParams(location.search).get('id')),
            productContentVisible: Boolean(document.querySelector('#productContent') && !document.querySelector('#productContent').hidden),
            productTitlePresent: Boolean(document.querySelector('#productTitle')?.textContent?.trim()),
          productGalleryImageCount: document.querySelectorAll('#productThumbnails .gallery-thumb img').length,
          productGalleryShowsUnavailable: (document.querySelector('#productMainImage')?.textContent || '').includes('Foto indisponível'),
          purchaseAction: (() => {
            const button = document.querySelector('#buyProduct, .buy-now-btn');
            return button ? {
              text: button.textContent?.trim() ?? '',
              disabled: button instanceof HTMLButtonElement
                ? button.disabled || button.getAttribute('aria-disabled') === 'true'
                : button.getAttribute('aria-disabled') === 'true',
              href: button.getAttribute('href')
            } : null;
          })(),
            spotlightHidden: document.querySelector('#spotlightSection')?.hidden ?? null,
            spotlightCards: [...document.querySelectorAll('#spotlightGrid .spotlight-card')].map((card) => ({
              id: card.dataset.productId,
              title: card.querySelector('h3')?.textContent?.trim(),
              imageSrc: card.querySelector('img')?.currentSrc || null,
              imageWidth: card.querySelector('img')?.naturalWidth ?? null,
              imageFallback: card.querySelector('img')?.dataset.imageFallback === 'true',
              placeholder: Boolean(card.querySelector('.spotlight-image-placeholder'))
            })),
            relatedCardCount: document.querySelectorAll('#relatedGrid .related-card').length,
            firstRelatedCardDisplay: document.querySelector('#relatedGrid .related-card') ? getComputedStyle(document.querySelector('#relatedGrid .related-card')).display : null,
            firstRelatedCardBorder: document.querySelector('#relatedGrid .related-card') ? getComputedStyle(document.querySelector('#relatedGrid .related-card')).borderTopWidth : null,
            adminGuestAccess: location.pathname === '/painel-admin' ? {
              statusText: document.querySelector('#adminStatus')?.textContent?.trim() || '',
              metricsHidden: document.querySelector('#metricsPanel')?.hidden === true
            } : null };
        })()`
      });
      const accessibilityTree = await command('Accessibility.getFullAXTree');
      const axNodes = accessibilityTree.nodes ?? [];
      const accessibility = {
        mainLandmark: axNodes.some((node) => node.role?.value === 'main'),
        unnamedHeadings: axNodes.filter((node) => node.role?.value === 'heading' && !String(node.name?.value ?? '').trim()).length,
        unnamedControls: axNodes.filter((node) => ['button', 'link', 'textbox', 'searchbox', 'combobox', 'spinbutton'].includes(node.role?.value) && !String(node.name?.value ?? '').trim()).length
      };
      let productGalleryKeyboard = null;
      if (route === '@first-live-product' && evaluation.result.value.productContentVisible) {
        await command('Runtime.evaluate', { expression: 'document.body.setAttribute("tabindex", "-1"); document.body.focus()' });
        const galleryBefore = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => { const buttons = [...document.querySelectorAll('#productThumbnails .gallery-thumb')];
            const announcement = document.querySelector('#galleryAnnouncement');
            return { count: buttons.length, initialPressed: buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length,
              hasLiveRegion: announcement?.getAttribute('aria-live') === 'polite' && announcement?.getAttribute('aria-atomic') === 'true',
              labels: buttons.map(button => button.getAttribute('aria-label')) }; })()`
        });
        const galleryInitial = galleryBefore.result.value;
        if (galleryInitial.count > 0) {
          let reachedGalleryByKeyboard = false;
          for (let keypress = 0; keypress < 80; keypress += 1) {
            await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
            await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
            const isGalleryFocused = await command('Runtime.evaluate', {
              returnByValue: true,
              expression: `document.activeElement === document.querySelector('#productThumbnails .gallery-thumb')`
            });
            if (isGalleryFocused.result.value) { reachedGalleryByKeyboard = true; break; }
          }
          if (galleryInitial.count > 1) {
            await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
            await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
          }
          productGalleryKeyboard = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => { const buttons = [...document.querySelectorAll('#productThumbnails .gallery-thumb')];
              const selected = buttons.filter(button => button.getAttribute('aria-pressed') === 'true');
              const active = document.activeElement;
              const announcement = document.querySelector('#galleryAnnouncement');
              return { count: buttons.length, selectedCount: selected.length, selectedIndex: buttons.indexOf(selected[0]),
                announcement: announcement?.textContent?.trim() || '', liveRegion: announcement?.getAttribute('aria-live') || '',
                focusedThumbnail: buttons.includes(active), focusedLabel: active?.getAttribute('aria-label') || '',
                visibleFocus: active ? (getComputedStyle(active).outlineStyle !== 'none' && parseFloat(getComputedStyle(active).outlineWidth) > 0) || getComputedStyle(active).boxShadow !== 'none' : false,
                labels: buttons.map(button => button.getAttribute('aria-label')) }; })()`
          }).then((result) => result.result.value);
          productGalleryKeyboard.passed = productGalleryKeyboard.selectedCount === 1
            && productGalleryKeyboard.liveRegion === 'polite'
            && reachedGalleryByKeyboard
            && productGalleryKeyboard.focusedThumbnail
            && productGalleryKeyboard.visibleFocus
            && (galleryInitial.count > 1
              ? productGalleryKeyboard.selectedIndex === 1 && productGalleryKeyboard.announcement.startsWith(`Foto 2 de ${galleryInitial.count}:`)
              : productGalleryKeyboard.selectedIndex === 0 && productGalleryKeyboard.announcement.startsWith('Foto 1 de 1:'));
        } else productGalleryKeyboard = { count: 0, passed: false, reason: 'A galeria nao apresentou thumbnails para validar.' };
        await command('Runtime.evaluate', { expression: 'document.activeElement?.blur(); window.scrollTo(0, 0)' });
      }
      await command('Runtime.evaluate', { expression: 'document.body.setAttribute("tabindex", "-1"); document.body.focus(); window.scrollTo(0, 0)' });
      const focusableCount = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => [...document.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(el => el.tagName !== 'ASTRO-DEV-TOOLBAR' && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length).length)()`
      });
      const keyboard = [];
      const keyboardSteps = Math.min(32, Math.max(1, focusableCount.result.value));
      for (let step = 0; step < keyboardSteps; step += 1) {
          await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
          await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
          if (step === 0) await delay(250); // Let the skip link's focus transition become visible before measuring it.
          const focusResult = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `(() => { const el = document.activeElement; const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
              const ancestors = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean);
              const visible = ancestors.some(node => { const s = getComputedStyle(node); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== 'rgba(0, 0, 0, 0)') || s.boxShadow !== 'none'; });
              return { name: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.id || el.tagName).trim().slice(0, 80),
                className: String(el.className || ''), tag: el.tagName, outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth, top: Math.round(rect.top), positionTop: style.top, visible,
                inViewport: rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth }; })()`
          });
          const focused = focusResult.result.value;
          if (step > 0 && (focused.tag === 'BODY' || focused.tag === 'ASTRO-DEV-TOOLBAR' || focused.className.includes('skip-link'))) break;
          keyboard.push(focused);
      }
      results.push({ ...evaluation.result.value, accessibility, keyboard, productGalleryKeyboard });
      if (smokeAdminGuest && route === '/painel-admin') adminGuestSmoke = evaluation.result.value.adminGuestAccess;
      if (width === 390 && (route === '/' || route === '/produto/MLB3299039091')) {
        await delay(route === '/' ? 1_500 : 0);
        if (route === '/') {
          const settledSpotlights = await command('Runtime.evaluate', {
            returnByValue: true,
            expression: `({cards: [...document.querySelectorAll('#spotlightGrid .spotlight-card')].map((card) => ({id: card.dataset.productId, title: card.querySelector('h3')?.textContent?.trim(), imageSrc: card.querySelector('img')?.currentSrc || null, imageWidth: card.querySelector('img')?.naturalWidth ?? null, imageFallback: card.querySelector('img')?.dataset.imageFallback === 'true', placeholder: Boolean(card.querySelector('.spotlight-image-placeholder'))})), hidden: document.querySelector('#spotlightSection')?.hidden ?? null})`
          });
          results.at(-1).spotlightAfterImageSettle = settledSpotlights.result.value;
        }
        await command('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
        const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const name = route === '/' ? 'home' : 'produto';
        const screenshotPath = path.join(os.tmpdir(), `achados-responsive-${name}.png`);
        await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`Screenshot 390px: ${screenshotPath}`);
      }
    }
  }

  if (args.includes('--smoke-guest-cart')) {
    currentCheck = 'guest cart save/remove smoke';
    const demoRoute = '/produto/MLB3299039091';
    await command('Page.navigate', { url: new URL(demoRoute, baseUrl).href });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await command('Runtime.evaluate', { expression: 'document.readyState === "complete"', returnByValue: true });
      if (ready.result.value) break;
      if (attempt === 99) throw new Error('Demo product page did not finish loading for guest cart smoke.');
      await delay(100);
    }
    const productState = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const save = document.querySelector('[data-action="save-item"]');
        return { hasSaveButton: Boolean(save), purchaseDisabled: document.querySelector('.buy-now-btn')?.disabled === true,
          title: document.querySelector('#productTitle')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '' };
      })()`
    });
    if (!productState.result.value.hasSaveButton || !productState.result.value.purchaseDisabled) {
      throw new Error('Guest cart smoke requires the explicit demo product with purchase disabled.');
    }
    const saved = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const button = document.querySelector('[data-action="save-item"]'); button.click();
        return JSON.parse(localStorage.getItem('achados_radar_cart') || '[]').length; })()`
    });
    if (saved.result.value !== 1) throw new Error('Demo product was not saved exactly once to the guest cart.');
    await command('Page.navigate', { url: new URL('/carrinho', baseUrl).href });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const count = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: 'document.querySelectorAll("#cartItems .saved-item").length'
      });
      if (count.result.value === 1) break;
      if (attempt === 99) throw new Error('Saved demo product did not appear in the cart page.');
      await delay(100);
    }
    await command('Runtime.evaluate', { expression: 'document.querySelector("#cartItems [data-remove]")?.click()' });
    let remaining = 1;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `({ rows: document.querySelectorAll('#cartItems .saved-item').length,
          stored: JSON.parse(localStorage.getItem('achados_radar_cart') || '[]').length,
          emptyVisible: document.querySelector('#cartEmpty')?.hidden === false })`
      });
      remaining = state.result.value.rows;
      if (remaining === 0 && state.result.value.stored === 0 && state.result.value.emptyVisible) {
        guestCartSmoke = { productId: 'MLB3299039091', savedOnce: true, visibleInCart: true, removed: true, purchaseDisabled: true };
        break;
      }
      if (attempt === 99) throw new Error(`Guest cart removal did not settle; ${remaining} rendered item(s) remain.`);
      await delay(100);
    }
  }

  if (args.includes('--smoke-search')) {
    currentCheck = 'catalog search, store filter and sorting smoke';
    await command('Page.navigate', { url: new URL('/', baseUrl).href });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await command('Runtime.evaluate', { expression: 'document.readyState === "complete"', returnByValue: true });
      if (ready.result.value) break;
      if (attempt === 99) throw new Error('Catalog page did not finish loading for search smoke.');
      await delay(100);
    }
    const search = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => { const input = document.querySelector('#catalogSearch'); if (!input) return false;
        input.value = 'fone'; input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`
    });
    if (!search.result.value) throw new Error('Catalog search field was not found.');
    let searchState = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({ query: new URLSearchParams(location.search).get('q'), status: document.querySelector('#catalogStatus')?.textContent || '',
          cards: [...document.querySelectorAll('#catalogGrid .catalog-card:not([data-catalog-skeleton]):not([hidden])')].map(card => ({
            title: card.querySelector('h3')?.textContent?.trim() || '', store: card.querySelector('.store-label')?.textContent?.trim() || '',
            price: Number((card.querySelector('.catalog-price')?.textContent || '').match(/[0-9][0-9.]*,[0-9]{2}/)?.[0]?.replaceAll('.', '').replace(',', '.') || 0)
          })) }))()`
      });
      searchState = state.result.value;
      if (searchState.query === 'fone' && searchState.cards.length > 0 && searchState.cards.every((card) => /fone/i.test(card.title))) break;
      await delay(100);
    }
    if (searchState?.query !== 'fone' || !searchState.cards.length || searchState.cards.some((card) => !/fone/i.test(card.title))) {
      throw new Error(`Catalog search did not return matching offers: ${JSON.stringify(searchState)}`);
    }
    const selectedStore = /magalu/i.test(searchState.cards[0].store) ? 'magalu' : 'mercadolivre';
    await command('Runtime.evaluate', {
      expression: `(() => { const field = document.querySelector('#platformFilter'); field.value = '${selectedStore}'; field.dispatchEvent(new Event('change', { bubbles: true })); })()`
    });
    let filteredState = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({ store: new URLSearchParams(location.search).get('loja'), status: document.querySelector('#catalogStatus')?.textContent || '',
          cards: [...document.querySelectorAll('#catalogGrid .catalog-card:not([data-catalog-skeleton]):not([hidden])')].map(card => card.querySelector('.store-label')?.textContent?.trim() || '') }))()`
      });
      filteredState = state.result.value;
      if (filteredState.store === selectedStore && !filteredState.status.includes('Buscando')) break;
      await delay(100);
    }
    if (filteredState?.store !== selectedStore || !filteredState.cards.length || filteredState.cards.some((store) =>
      selectedStore === 'magalu' ? !/magalu/i.test(store) : !/mercado livre/i.test(store))) {
      throw new Error(`Store filter returned a mismatched result: ${JSON.stringify(filteredState)}`);
    }
    await command('Runtime.evaluate', {
      expression: `(() => { const field = document.querySelector('#sortFilter'); field.value = 'price_asc'; field.dispatchEvent(new Event('change', { bubbles: true })); })()`
    });
    let sortedState = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({ sort: new URLSearchParams(location.search).get('ordem'), status: document.querySelector('#catalogStatus')?.textContent || '',
          priceTexts: [...document.querySelectorAll('#catalogGrid .catalog-card:not([data-catalog-skeleton]):not([hidden]) .catalog-price')].map(el => el.textContent?.trim() || ''),
          prices: [...document.querySelectorAll('#catalogGrid .catalog-card:not([data-catalog-skeleton]):not([hidden]) .catalog-price')].map(el => Number((el.textContent || '').match(/[0-9][0-9.]*,[0-9]{2}/)?.[0]?.replaceAll('.', '').replace(',', '.') || 0)) }))()`
      });
      sortedState = state.result.value;
      if (sortedState.sort === 'price_asc' && !sortedState.status.includes('Buscando')) break;
      await delay(100);
    }
    if (sortedState?.sort !== 'price_asc' || !sortedState.prices.length ||
        sortedState.prices.some((price, index) => !Number.isFinite(price) || price <= 0 || (index > 0 && price < sortedState.prices[index - 1]))) {
      throw new Error(`Price sorting did not produce ascending results: ${JSON.stringify(sortedState)}`);
    }
    const readPriceFilterState = async (parameter, value) => {
      let state = null;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const response = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => ({ value: new URLSearchParams(location.search).get('${parameter}'), status: document.querySelector('#catalogStatus')?.textContent || '',
            count: document.querySelectorAll('#catalogGrid .catalog-card:not([data-catalog-skeleton]):not([hidden])').length }))()`
        });
        state = response.result.value;
        if (state.value === value && !state.status.includes('Buscando')) break;
        await delay(100);
      }
      return state;
    };
    const setPriceFilter = async (inputId, parameter, value) => {
      await command('Runtime.evaluate', {
        expression: `(() => { const field = document.querySelector('#${inputId}'); field.value = '${value}'; field.dispatchEvent(new Event('change', { bubbles: true })); })()`
      });
      return readPriceFilterState(parameter, value || null);
    };
    const lowestPrice = Math.min(...sortedState.prices);
    const highestPrice = Math.max(...sortedState.prices);
    const minimumAboveResults = (highestPrice + 0.01).toFixed(2);
    const minFilterState = await setPriceFilter('minPrice', 'min', minimumAboveResults);
    if (minFilterState?.count !== 0) throw new Error(`Minimum price filter retained offers below its threshold: ${JSON.stringify(minFilterState)}`);
    await setPriceFilter('minPrice', 'min', '');
    const maximumBelowResults = Math.max(0, lowestPrice - 0.01).toFixed(2);
    const maxFilterState = await setPriceFilter('maxPrice', 'max', maximumBelowResults);
    if (maxFilterState?.count !== 0) throw new Error(`Maximum price filter retained offers above its threshold: ${JSON.stringify(maxFilterState)}`);
    const resetPriceState = await setPriceFilter('maxPrice', 'max', '');
    if (resetPriceState?.count === 0) throw new Error(`Clearing price filters did not restore the matching offer: ${JSON.stringify(resetPriceState)}`);
    catalogSearchSmoke = { query: 'fone', matchingResults: searchState.cards.length, store: selectedStore,
      filteredResults: filteredState.cards.length, priceAscending: true, sortedResults: sortedState.prices.length,
      minPriceExcludesHigherOffers: minFilterState.count === 0, maxPriceExcludesLowerOffers: maxFilterState.count === 0,
      clearingPriceFiltersRestoresResults: resetPriceState.count > 0 };
  }

  if (args.includes('--smoke-sectors')) {
    currentCheck = 'catalog sector, query and URL restoration smoke';
    await command('Page.navigate', { url: new URL('/', baseUrl).href });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await command('Runtime.evaluate', { expression: 'document.readyState === "complete"', returnByValue: true });
      if (ready.result.value) break;
      if (attempt === 99) throw new Error('Catalog page did not finish loading for sector smoke.');
      await delay(100);
    }
    await command('Runtime.evaluate', {
      expression: `(() => { const field = document.querySelector('#catalogSearch'); field.value = 'air fryer'; field.dispatchEvent(new Event('input', { bubbles: true })); })()`
    });
    let initialSectorState = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({ query: document.querySelector('#catalogSearch')?.value || '', urlQuery: new URLSearchParams(location.search).get('q'), cards: [...document.querySelectorAll('#catalogGrid .catalog-card[data-demo-card]:not([hidden])')].map(card => ({ title: card.querySelector('h3')?.textContent?.trim() || '', platform: card.dataset.platform })) }))()`
      });
      initialSectorState = state.result.value;
      if (initialSectorState.urlQuery === 'air fryer' && initialSectorState.cards.length > 0 && initialSectorState.cards.every((card) => /air fryer/i.test(card.title))) break;
      await delay(50);
    }
    if (initialSectorState?.query !== 'air fryer' || !initialSectorState.cards.length || initialSectorState.cards.some((card) => !/air fryer/i.test(card.title))) {
      throw new Error(`Demo search did not find only matching air fryer fixtures: ${JSON.stringify(initialSectorState)}`);
    }
    const platform = initialSectorState.cards[0].platform;
    await command('Runtime.evaluate', {
      expression: `(() => { const store = document.querySelector('#platformFilter'); store.value = '${platform}'; store.dispatchEvent(new Event('change', { bubbles: true }));
        const minimum = document.querySelector('#minPrice'); minimum.value = '1'; minimum.dispatchEvent(new Event('change', { bubbles: true }));
        document.querySelector('.sector-btn[data-sector="eletro"]')?.click(); })()`
    });
    const selectedSector = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => ({ query: document.querySelector('#catalogSearch')?.value || '', sector: new URLSearchParams(location.search).get('setor'), store: new URLSearchParams(location.search).get('loja'), min: new URLSearchParams(location.search).get('min'),
        pressed: document.querySelector('.sector-btn[data-sector="eletro"]')?.getAttribute('aria-pressed'), cards: [...document.querySelectorAll('#catalogGrid .catalog-card[data-demo-card]:not([hidden])')].map(card => ({ title: card.querySelector('h3')?.textContent?.trim() || '', platform: card.dataset.platform })) }))()`
    });
    const selected = selectedSector.result.value;
    if (selected.query !== 'air fryer' || selected.sector !== 'eletro' || selected.store !== platform || selected.min !== '1' || selected.pressed !== 'true' ||
      !selected.cards.length || selected.cards.some((card) => !/air fryer/i.test(card.title) || card.platform !== platform)) {
      throw new Error(`Sector, query, store and price filters did not combine: ${JSON.stringify(selected)}`);
    }
    await command('Runtime.evaluate', { expression: `document.querySelector('.sector-btn[data-sector=""]')?.click()` });
    const clearedSector = await command('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => ({ query: document.querySelector('#catalogSearch')?.value || '', sector: new URLSearchParams(location.search).get('setor'), store: new URLSearchParams(location.search).get('loja'), min: new URLSearchParams(location.search).get('min'),
        allPressed: document.querySelector('.sector-btn[data-sector=""]')?.getAttribute('aria-pressed'), visibleCount: document.querySelectorAll('#catalogGrid .catalog-card[data-demo-card]:not([hidden])').length }))()`
    });
    const cleared = clearedSector.result.value;
    if (cleared.query !== 'air fryer' || cleared.sector || cleared.store !== platform || cleared.min !== '1' || cleared.allPressed !== 'true' || cleared.visibleCount === 0) {
      throw new Error(`Everything did not clear only the sector filter: ${JSON.stringify(cleared)}`);
    }
    const restoredUrl = new URL('/', baseUrl);
    restoredUrl.search = new URLSearchParams({ setor: 'eletro', q: 'air fryer', loja: platform, min: '1' }).toString();
    await command('Page.navigate', { url: restoredUrl.href });
    let restored = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => ({ query: document.querySelector('#catalogSearch')?.value || '', sector: document.querySelector('#sectorFilter')?.value || '', pressed: document.querySelector('.sector-btn[data-sector="eletro"]')?.getAttribute('aria-pressed'),
          store: document.querySelector('#platformFilter')?.value || '', min: document.querySelector('#minPrice')?.value || '', visibleCount: document.querySelectorAll('#catalogGrid .catalog-card[data-demo-card]:not([hidden])').length }))()`
      });
      restored = state.result.value;
      if (restored.query === 'air fryer' && restored.sector === 'eletro' && restored.pressed === 'true' && restored.store === platform && restored.min === '1' && restored.visibleCount) break;
      await delay(50);
    }
    if (restored.query !== 'air fryer' || restored.sector !== 'eletro' || restored.pressed !== 'true' || restored.store !== platform || restored.min !== '1' || !restored.visibleCount) {
      throw new Error(`Sector and other filters were not restored from the URL: ${JSON.stringify(restored)}`);
    }
    sectorFilterSmoke = { queryAndSectorIndependent: selected.query === 'air fryer' && selected.sector === 'eletro',
      storeAndPriceCombined: selected.store === platform && selected.min === '1',
      allClearsOnlySector: !cleared.sector && cleared.query === 'air fryer' && cleared.store === platform && cleared.min === '1',
      urlRestoresSelection: restored.pressed === 'true' && restored.visibleCount > 0 };
  }

  if (args.includes('--smoke-related-feed')) {
    currentCheck = 'live related feed pagination smoke';
    await command('Page.navigate', { url: new URL('/', baseUrl).href });
    let productRoute = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.querySelector('#catalogGrid a[href^="/produto?id="]')?.getAttribute('href') || null`
      });
      if (state.result.value) { productRoute = state.result.value; break; }
      await delay(100);
    }
    if (!productRoute) throw new Error('No live catalog product link was available for the related feed smoke.');
    await command('Page.navigate', { url: new URL(productRoute, baseUrl).href });
    let feedState = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const state = await command('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => { const grid = document.querySelector('#relatedGrid'); const button = document.querySelector('#relatedMore');
          return { ready: Boolean(document.querySelector('#productContent') && !document.querySelector('#productContent').hidden),
            currentId: new URLSearchParams(location.search).get('id'), ids: [...(grid?.querySelectorAll('.related-card') || [])].map(card => card.dataset.productId),
            hidden: button?.hidden ?? true, disabled: button?.disabled ?? true, label: button?.textContent?.trim() || '' }; })()`
      });
      feedState = state.result.value;
      if (feedState.ready && (feedState.ids.length || !feedState.hidden || feedState.label.includes('Falha'))) break;
      await delay(100);
    }
    if (!feedState?.ready) throw new Error('Live product details did not load for the related feed smoke.');
    let pageRequests = 1;
    while (!feedState.hidden && pageRequests < 5) {
      if (feedState.label.includes('Falha')) throw new Error('Related feed is waiting for a manual retry.');
      const previousCount = feedState.ids.length;
      await command('Runtime.evaluate', { expression: `document.querySelector('#relatedMore')?.click()` });
      let settled = false;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const state = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => { const grid = document.querySelector('#relatedGrid'); const button = document.querySelector('#relatedMore');
            return { ids: [...(grid?.querySelectorAll('.related-card') || [])].map(card => card.dataset.productId),
              hidden: button?.hidden ?? true, disabled: button?.disabled ?? true, label: button?.textContent?.trim() || '' }; })()`
        });
        feedState = { ...feedState, ...state.result.value };
        if (!feedState.disabled && (feedState.hidden || feedState.ids.length > previousCount || feedState.label.includes('Falha'))) { settled = true; break; }
        await delay(100);
      }
      if (!settled) throw new Error('Related feed page did not settle after requesting more offers.');
      if (feedState.label.includes('Falha')) throw new Error('Related feed request failed while loading another page.');
      pageRequests += 1;
    }
    const duplicates = feedState.ids.length - new Set(feedState.ids).size;
    if (!feedState.ids.length || duplicates || feedState.ids.includes(feedState.currentId) || (!feedState.hidden && pageRequests < 5)) {
      throw new Error(`Related feed integrity/end state failed: ${JSON.stringify({ ...feedState, duplicates })}`);
    }
    relatedFeedSmoke = { currentProductExcluded: true, duplicateCards: duplicates, uniqueRelatedCards: feedState.ids.length,
      pagesRequested: pageRequests, reachedCatalogEnd: feedState.hidden, pageLimitReached: pageRequests === 5 && !feedState.hidden };
  }

  const failures = results.filter((result) => result.overflowElements.length > 0 || result.bodyScroll > result.viewport + 1 ||
    result.rootScroll > result.rootClient + 1 || !result.accessibility.mainLandmark ||
    result.accessibility.unnamedHeadings > 0 || result.accessibility.unnamedControls > 0 ||
    (result.keyboard && (result.keyboard[0]?.visible !== true || !result.keyboard[0]?.className.includes('skip-link') ||
      result.keyboard.some((focus, index) => !focus.visible || (!focus.inViewport && !focus.className.includes('skip-link')) || (index > 0 && focus.className.includes('skip-link'))))) ||
    (smokeAdminGuest && result.route === '/painel-admin' &&
      (!result.adminGuestAccess?.metricsHidden || !result.adminGuestAccess.statusText.includes('Entre na conta administrativa'))) ||
    (result.liveProduct && (!result.productContentVisible || !result.productTitlePresent || !result.relatedCardCount ||
      result.firstRelatedCardDisplay !== 'flex' || result.firstRelatedCardBorder !== '1px' || !result.productGalleryKeyboard?.passed)));
  const failureDetails = failures.map((result) => {
    const issues = [];
    if (result.overflowElements.length || result.bodyScroll > result.viewport + 1 || result.rootScroll > result.rootClient + 1) issues.push('horizontal_overflow');
    if (!result.accessibility.mainLandmark) issues.push('main_landmark_missing');
    if (result.accessibility.unnamedHeadings) issues.push('unnamed_heading');
    if (result.accessibility.unnamedControls) issues.push('unnamed_control');
    if (smokeAdminGuest && result.route === '/painel-admin' &&
      (!result.adminGuestAccess?.metricsHidden || !result.adminGuestAccess.statusText.includes('Entre na conta administrativa'))) issues.push('anonymous_admin_metrics_visible_or_unexpected_status');
    if (result.keyboard && (result.keyboard[0]?.visible !== true || !result.keyboard[0]?.className.includes('skip-link') ||
      result.keyboard.some((focus, index) => !focus.visible || (!focus.inViewport && !focus.className.includes('skip-link')) || (index > 0 && focus.className.includes('skip-link'))))) issues.push('keyboard_focus_visibility');
    if (result.liveProduct && (!result.productContentVisible || !result.productTitlePresent || !result.relatedCardCount)) issues.push('product_detail_content_missing');
    if (result.liveProduct && (result.firstRelatedCardDisplay !== 'flex' || result.firstRelatedCardBorder !== '1px')) issues.push('related_cards_unstyled');
    if (result.liveProduct && !result.productGalleryKeyboard?.passed) issues.push('product_gallery_aria_keyboard');
    return { route: result.route, viewport: result.viewport, issues, relatedCardCount: result.relatedCardCount, firstRelatedCardDisplay: result.firstRelatedCardDisplay, firstRelatedCardBorder: result.firstRelatedCardBorder,
      firstFocus: result.keyboard?.[0] ?? null,
      badFocus: result.keyboard?.filter((focus) => !focus.visible || (!focus.inViewport && !focus.className.includes('skip-link'))).map((focus) => ({ name: focus.name, className: focus.className, tag: focus.tag, top: focus.top, outlineStyle: focus.outlineStyle, inViewport: focus.inViewport })),
      productGalleryKeyboard: result.productGalleryKeyboard };
  });
  const summary = { checked: results.length, skipped: skipped.length, skippedRoutes: skipped, failures: failureDetails.length, failureDetails, guestCartSmoke, adminGuestSmoke, catalogSearchSmoke, sectorFilterSmoke, relatedFeedSmoke, accountUiSmoke,
    productRoutes: results.filter((result) => result.liveProduct).map((result) => ({ route: result.route, viewport: result.viewport, productTitlePresent: result.productTitlePresent,
      productGalleryImageCount: result.productGalleryImageCount, productGalleryKeyboard: result.productGalleryKeyboard, relatedCardCount: result.relatedCardCount })) };
  console.log(JSON.stringify(args.includes('--summary-only') ? summary : { ...summary, results }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  for (const item of pending.values()) clearTimeout(item.timeout);
  if (chrome && chrome.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      chrome.kill();
    }
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2_000)]);
  }
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    const closed = new Promise((resolve) => socket.addEventListener('close', resolve, { once: true }));
    socket.close();
    await Promise.race([closed, delay(1_500)]);
  }
  const tempRoot = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(profilePath)) === tempRoot) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await rm(profilePath, { recursive: true, force: true });
        break;
      } catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === 29) {
          console.warn(`Temporary Chrome profile cleanup deferred: ${profilePath}`);
          break;
        }
        await delay(250);
      }
    }
  }
}
