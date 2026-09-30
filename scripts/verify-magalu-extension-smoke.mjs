import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const extensionDir = path.resolve(process.argv[2] ?? '../robo-afiliados-autonomo');
const productUrl = process.argv[3];
if (!productUrl || new URL(productUrl).hostname !== 'www.magazinevoce.com.br') {
  throw new Error('Pass a public Magalu product URL on www.magazinevoce.com.br.');
}

const browserExe = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9226;
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'codex-magalu-smoke-'));
const child = spawn(browserExe, [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-mode',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  'about:blank',
], { windowsHide: true, stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = `http://127.0.0.1:${port}`;
let worker;
let socket;
let timeout;
let tabId;

try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Edge exited with code ${child.exitCode}`);
    try {
      const targets = await (await fetch(`${base}/json/list`)).json();
      worker = targets.find((target) => target.type === 'service_worker' && target.url.endsWith('/background/service_worker.js'));
      if (worker) break;
    } catch {}
    await sleep(500);
  }
  if (!worker?.webSocketDebuggerUrl) throw new Error('Project service worker did not load in the isolated Edge profile.');

  socket = new WebSocket(worker.webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter(message);
    }
  });
  await new Promise((resolve, reject) => {
    const openTimer = setTimeout(() => reject(new Error('Service worker debugger connection timed out.')), 5000);
    socket.addEventListener('open', () => { clearTimeout(openTimer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(openTimer); reject(new Error('Could not connect to the extension service worker.')); }, { once: true });
  });

  const evaluate = (expression, limitMs = 30000) => new Promise((resolve, reject) => {
    const id = ++commandId;
    timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Service worker command ${id} timed out.`)); }, limitMs);
    pending.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error.message));
      else if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text || 'Service worker command failed.'));
      else resolve(message.result?.result?.value);
    });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });

  const urlLiteral = JSON.stringify(productUrl);
  const created = await evaluate(`(async()=>{const tab=await chrome.tabs.create({url:${urlLiteral},active:false});return {id:tab.id,url:tab.url}})()`, 10000);
  tabId = created?.id;
  if (!Number.isInteger(tabId)) throw new Error('Could not create a temporary product tab.');
  console.log(JSON.stringify({ stage: 'product_tab_opened', tabId }));

  const ping = await evaluate(`(async()=>{await waitForTabComplete(${tabId},20000);await ensureTabScriptReady(${tabId},'magalu');return await chrome.tabs.sendMessage(${tabId},{type:'PING'})})()`, 25000);
  if (!ping?.ok) throw new Error('The Magalu content script did not answer PING.');
  console.log(JSON.stringify({ stage: 'content_script_ready', platform: ping.platform }));

  const extracted = await evaluate(`(async()=>{const response=await chrome.tabs.sendMessage(${tabId},{type:'CRAWL_MAGALU_PRODUCT',options:await getConfig()});if(!response?.ok||!response.item)throw new Error(response?.error||'No product data returned');await syncWithLocalServer(response.item);return {id:response.item.id,title:response.item.title,price:response.item.price,stockStatus:response.item.stockStatus,stockQuantity:response.item.stockQuantity,installments:response.item.installments,shipping:response.item.shipping,coupon:response.item.coupon,imageCount:Array.isArray(response.item.images)?response.item.images.length:0}})()`, 45000);
  console.log(JSON.stringify({ stage: 'product_extracted_and_sent_to_local_bridge', ...extracted }));
} catch (error) {
  console.error(JSON.stringify({ result: 'failed', reason: error.message }));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.close();
  }
  if (child.exitCode === null && child.signalCode === null) {
    try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      sleep(5000),
    ]);
  }
  const temp = path.resolve(os.tmpdir());
  const profile = path.resolve(profileDir);
  if (profile.startsWith(temp + path.sep)) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await sleep(1000);
      }
    }
  }
}
