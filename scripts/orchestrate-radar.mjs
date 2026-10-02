import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { readFile, mkdtemp, access, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const extensionPath = path.resolve(projectRoot, '..', 'robo-afiliados-autonomo');

// 1. Spawns the bridge server if not already running
console.log('🚀 Iniciando ponte local (local-catalog-bridge)...');
const bridge = spawn('node', ['--env-file-if-exists=.env', 'scripts/local-catalog-bridge.mjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
  windowsHide: true
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await delay(2000); // Wait for bridge to start

// 2. Spawn Chromium off-screen
console.log('🚀 Iniciando Chrome Autônomo em background...');

async function findBrowser() {
  const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)))
    .map((entry) => path.join(root, entry.name, 'chrome-win64', 'chrome.exe'));
  for (const candidate of candidates) {
    try { await access(candidate); return { path: candidate, name: 'Chromium' }; } catch { }
  }
  throw new Error(`Chromium não encontrado em ${root}. Instale com 'npx playwright install chromium'.`);
}

const selectedBrowser = await findBrowser();
const profilePath = path.join(projectRoot, 'data', 'chrome-profile');

const browser = spawn(selectedBrowser.path, [
  '--window-position=-32000,-32000', '--window-size=10,10', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0',
  `--user-data-dir=${profilePath}`,
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

browser.on('exit', (code, signal) => {
  console.error(`❌ [Falha Crítica] Navegador Chromium foi encerrado (Código: ${code}, Sinal: ${signal}).`);
  bridge.kill();
  process.exit(1);
});

let stderr = '';
browser.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-5000); });

// 3. Connect to CDP to start the robot
async function getTargets() {
  const portFile = path.join(profilePath, 'DevToolsActivePort');
  const port = (await readFile(portFile, 'utf8').catch(() => '')).trim().split(/\r?\n/)[0];
  if (!port) return [];
  return fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
    .then((response) => response.json()).catch(() => []);
}

console.log('⏳ Aguardando Service Worker da extensão...');
let worker;
const deadline = Date.now() + 15000;
while (Date.now() < deadline && browser.exitCode === null) {
  const targets = await getTargets();
  worker = targets.find((target) => target.type === 'service_worker'
    && target.url.startsWith('chrome-extension://')
    && target.url.endsWith('/background/service_worker.js'));
  if (worker) break;
  await delay(200);
}

if (!worker) {
  console.error('❌ Service worker não iniciou. Chrome stderr:', stderr || '(vazio)');
  browser.kill();
  bridge.kill();
  process.exit(1);
}

console.log('✅ Extensão carregada. Disparando radar em Loop Contínuo...');

// 4. Send Message to start Autopilot using a quick CDP socket
const wsUrl = worker.webSocketDebuggerUrl;
// Node 22+ tem WebSocket global
const socket = new WebSocket(wsUrl);

let commandId = 0;
const pendingCommands = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  if (message.method === 'Runtime.consoleAPICalled') {
    const args = message.params.args.map(a => a.value || a.description || '').join(' ');
    const isError = message.params.type === 'error';
    const isWarning = message.params.type === 'warning';

    if (isError) {
      console.error(`\x1b[31m[Robô] ${args}\x1b[0m`); // Vermelho
    } else if (isWarning) {
      console.warn(`\x1b[33m[Robô] ${args}\x1b[0m`); // Amarelo
    } else {
      console.log(`\x1b[36m[Robô]\x1b[0m ${args}`); // Ciano (apenas o prefixo)
    }
    return;
  }

  if (message.method === 'Runtime.exceptionThrown') {
    const exception = message.params.exceptionDetails;
    const text = exception.text || 'Exceção desconhecida';
    const value = exception.exception?.description || exception.exception?.value || '';
    console.error(`\x1b[41m\x1b[37m[Erro Fatal no Robô]\x1b[0m ${text} ${value}`);
    return;
  }

  if (message.method === 'Inspector.detached') {
    console.error('❌ [Falha Crítica] Conexão com o robô (DevTools) foi perdida!');
    process.exit(1);
  }

  if (!message.id) return;
  const pending = pendingCommands.get(message.id);
  if (!pending) return;
  pending(message.result || message.error);
});

async function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve) => {
    pendingCommands.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

socket.addEventListener('open', async () => {
  await send('Runtime.enable');
  const triggerScript = `runAutoPilot().catch(err => console.error(err))`;
  await send('Runtime.evaluate', { expression: triggerScript, awaitPromise: true });
  console.log('🟢 Orquestrador rodando! O robô agora está coletando e renovando produtos em background.');
  console.log('Pressione Ctrl+C para encerrar o radar e a ponte local.');
});

process.on('SIGINT', () => {
  console.log('Encerrando...');
  browser.kill();
  bridge.kill();
  process.exit(0);
});
