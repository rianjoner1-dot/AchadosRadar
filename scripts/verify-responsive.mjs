import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolveChromeExecutable } from './chrome-executable.mjs';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4323';
const routes = ['/', '/produto/MLB3299039091', '/carrinho', '/conta', '/privacidade'];
const viewports = [390, 1440];
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'achados-radar-responsive-'));
let chrome;
let socket;
let nextId = 0;
const pending = new Map();

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome DevTools command timed out: ${method}`));
    }, 10_000);
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
  await command('Accessibility.enable');

  const results = [];
  for (const width of viewports) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
    for (const route of routes) {
      const navigation = await command('Page.navigate', { url: new URL(route, baseUrl).href });
      if (navigation.errorText) throw new Error(`Could not load ${route}: ${navigation.errorText}`);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const state = await command('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (state.result.value === 'complete') { ready = true; break; }
        await delay(100);
      }
      if (!ready) throw new Error(`Page load timed out: ${route}`);
      await delay(200);
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
            overflowElements: overflow };
        })()`
      });
      const accessibilityTree = await command('Accessibility.getFullAXTree');
      const axNodes = accessibilityTree.nodes ?? [];
      const accessibility = {
        mainLandmark: axNodes.some((node) => node.role?.value === 'main'),
        unnamedHeadings: axNodes.filter((node) => node.role?.value === 'heading' && !String(node.name?.value ?? '').trim()).length,
        unnamedControls: axNodes.filter((node) => ['button', 'link', 'textbox', 'searchbox', 'combobox', 'spinbutton'].includes(node.role?.value) && !String(node.name?.value ?? '').trim()).length
      };
      let keyboard = null;
      if (width === 390) {
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        const focusResult = await command('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => { const el = document.activeElement; const style = getComputedStyle(el); return {
            className: String(el.className || ''), tag: el.tagName, outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth, visible: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
          }; })()`
        });
        keyboard = focusResult.result.value;
      }
      results.push({ ...evaluation.result.value, accessibility, keyboard });
      if (width === 390 && (route === '/' || route === '/produto/MLB3299039091')) {
        const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const name = route === '/' ? 'home' : 'produto';
        const screenshotPath = path.join(os.tmpdir(), `achados-responsive-${name}.png`);
        await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`Screenshot 390px: ${screenshotPath}`);
      }
    }
  }

  const failures = results.filter((result) => result.overflowElements.length > 0 || result.bodyScroll > result.viewport + 1 ||
    result.rootScroll > result.rootClient + 1 || !result.accessibility.mainLandmark ||
    result.accessibility.unnamedHeadings > 0 || result.accessibility.unnamedControls > 0 ||
    (result.keyboard && (!result.keyboard.visible || !result.keyboard.className.includes('skip-link'))));
  console.log(JSON.stringify({ checked: results.length, failures: failures.length, results }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  for (const item of pending.values()) clearTimeout(item.timeout);
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      chrome.kill();
    }
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2_000)]);
  }
  const tempRoot = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(profilePath)) === tempRoot) {
    let removed = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      try {
        await rm(profilePath, { recursive: true, force: true });
        removed = true;
        break;
      } catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === 14) {
          console.warn(`Temporary Chrome profile cleanup deferred: ${profilePath}`);
          break;
        }
        await delay(100);
      }
    }
  }
}
