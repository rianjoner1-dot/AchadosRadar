import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.resolve(projectRoot, '..', 'robo-afiliados-autonomo');
const profilePath = path.join(projectRoot, 'data', 'chrome-profile');
const awinUrl = 'https://ui.awin.com/link-builder/br/awin/publisher/3105840';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findChromium() {
  const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)))
    .map((entry) => path.join(root, entry.name, 'chrome-win64', 'chrome.exe'));
  return candidates.find(existsSync);
}

async function readDevToolsPort() {
  const content = await readFile(path.join(profilePath, 'DevToolsActivePort'), 'utf8').catch(() => '');
  const port = Number(content.trim().split(/\r?\n/)[0]);
  return Number.isSafeInteger(port) && port > 0 ? port : null;
}

async function attachVisibleAwinTab(port) {
  const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
  if (!versionResponse.ok) throw new Error('CDP do perfil não respondeu.');
  const { webSocketDebuggerUrl } = await versionResponse.json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Não conectou ao Chromium ativo.')), { once: true });
  });
  let commandId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  try {
    const { targetId } = await send('Target.createTarget', { url: awinUrl, newWindow: true, width: 1280, height: 900, left: 80, top: 60 });
    const { windowId } = await send('Browser.getWindowForTarget', { targetId });
    await send('Browser.setWindowBounds', { windowId, bounds: { left: 80, top: 60, width: 1280, height: 900, windowState: 'normal' } });
  } finally {
    socket.close();
  }
}

await mkdir(profilePath, { recursive: true });
const existingPort = await readDevToolsPort();
if (existingPort) {
  try {
    await attachVisibleAwinTab(existingPort);
    console.log('Awin aberto em uma janela visível do perfil persistente do robô. Faça login ou conclua a verificação nessa janela.');
    process.exit(0);
  } catch (error) {
    console.warn(`O arquivo de porta do perfil não respondeu (${error.message}); vou tentar iniciar o perfil persistente.`);
  }
}

const chromiumPath = await findChromium();
if (!chromiumPath) {
  console.error('Chromium do Playwright não encontrado. Instale-o pelo fluxo normal do projeto antes de abrir o perfil do robô.');
  process.exit(2);
}

const browser = spawn(chromiumPath, [
  '--new-window', '--window-position=80,60', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profilePath}`,
  `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, awinUrl
], { detached: true, stdio: 'ignore' });
browser.unref();

const deadline = Date.now() + 15000;
let port = null;
let endpointReady = false;
while (Date.now() < deadline) {
  port = await readDevToolsPort();
  if (port) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { endpointReady = true; break; }
    } catch { }
  }
  await delay(300);
}
if (!endpointReady) {
  console.error('Chromium foi iniciado, mas o endpoint local de controle não foi confirmado. Confira a janela visível e a página da Awin.');
  process.exitCode = 1;
} else {
  console.log('Janela visível da Awin aberta no perfil persistente do robô. A sessão pode continuar salva entre execuções; confirme isso após o login.');
}
