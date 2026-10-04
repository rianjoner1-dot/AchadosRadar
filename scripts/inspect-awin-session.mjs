import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(projectRoot, 'data', 'chrome-profile');
const port = Number((await readFile(path.join(profilePath, 'DevToolsActivePort'), 'utf8').catch(() => '')).trim().split(/\r?\n/)[0]);
if (!Number.isSafeInteger(port) || port <= 0) throw new Error('Perfil persistente sem porta CDP ativa.');

const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
if (!response.ok) throw new Error(`CDP respondeu HTTP ${response.status}.`);
const targets = await response.json();
const target = targets.find((item) => item.type === 'page' && new URL(item.url).hostname === 'ui.awin.com');
if (!target) throw new Error('Nenhuma aba ui.awin.com encontrada no perfil persistente.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('Nao foi possivel inspecionar a aba Awin via CDP.')), { once: true });
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

const evaluate = (expression) => new Promise((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
});

try {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const result = await evaluate(`(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    };
    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(visible);
    const body = (document.body?.innerText || '').toLowerCase();
    const main = document.querySelector('main,[role="main"]');
    const hasPlaceholder = (pattern) => inputs.some((element) => pattern.test((element.placeholder || '') + ' ' + (element.getAttribute('aria-label') || '')));
    const hasButton = (pattern) => buttons.some((element) => pattern.test((element.innerText || element.getAttribute('aria-label') || '').trim()));
    return {
      title: document.title,
      host: location.hostname,
      path: location.pathname,
      visiblePasswordInput: inputs.some((element) => element.type === 'password'),
      visibleEmailInput: inputs.some((element) => /email/i.test(element.type + ' ' + (element.placeholder || '') + ' ' + (element.getAttribute('aria-label') || ''))),
      loginTextVisible: /sign in|log in|login|iniciar sessao|faca login/.test(body),
      verificationTextVisible: /verification|verify your identity|captcha|two.factor|verificacao adicional/.test(body),
      advertiserInputVisible: hasPlaceholder(/advertiser|anunciante|search by name|pesquisar por nome/i),
      destinationInputVisible: hasPlaceholder(/destination url|which page|pagina de destino/i),
      campaignInputVisible: hasPlaceholder(/campaign parameter|select a campaign|campanha/i),
      clickReferenceInputVisible: hasPlaceholder(/click references|click reference|referencia de clique/i),
      generateLinkButtonVisible: hasButton(/generate link|gerar link/i),
      mainText: (main?.innerText || '').trim().slice(0, 600),
      visibleInputs: inputs.map((element) => ({ type: element.type, placeholder: element.placeholder || '', label: element.getAttribute('aria-label') || '' })).slice(0, 12),
      visibleHeadings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((element) => element.innerText.trim()).filter(Boolean).slice(0, 8),
      visibleActionLabels: buttons.map((element) => (element.innerText || element.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 12)
    };
  })()`);
  if (result.exceptionDetails) throw new Error('A leitura de estado da pagina falhou.');
  console.log(JSON.stringify(result.result.value, null, 2));
} finally {
  socket.close();
}
