import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const feedUrl = process.argv[2];
if (!feedUrl) throw new Error('Informe a URL feedList do Awin como argumento.');
const parsedFeedUrl = new URL(feedUrl);
if (parsedFeedUrl.hostname !== 'ui.awin.com'
  || !/^\/productdata-darwin-download\/publisher\/3105840\/[a-f0-9]+\/1\/feedList$/i.test(parsedFeedUrl.pathname)) {
  throw new Error('A URL precisa ser o feedList oficial do publisher 3105840.');
}

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
  socket.addEventListener('error', () => reject(new Error('Nao foi possivel consultar o feedList via sessao Awin.')), { once: true });
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
const expression = `fetch(${JSON.stringify(feedUrl)}, { credentials: 'include' }).then(async (response) => {
  const text = await response.text();
  const summary = { status: response.status, contentType: response.headers.get('content-type') || '', bytes: new TextEncoder().encode(text).length };
  let data;
  try { data = JSON.parse(text); } catch {
    const parseCsv = (source) => {
      const rows = [];
      let row = [], cell = '', quoted = false;
      for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (char === '"' && quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
        else if ((char === '\\n' || char === '\\r') && !quoted) {
          if (char === '\\r' && source[index + 1] === '\\n') index += 1;
          row.push(cell); cell = '';
          if (row.some((value) => value.length)) rows.push(row);
          row = [];
        } else cell += char;
      }
      if (cell.length || row.length) { row.push(cell); rows.push(row); }
      return rows;
    };
    const csvRows = parseCsv(text);
    const csvHeaders = csvRows[0]?.map((header) => header.trim());
    const csvAdvertiser = csvHeaders?.findIndex((header) => /^advertiser id$/i.test(header)) ?? -1;
    const csvFeed = csvHeaders?.findIndex((header) => /^feed id$/i.test(header)) ?? -1;
    if (csvAdvertiser >= 0 && csvFeed >= 0) {
      const safeFields = ['Advertiser ID', 'Advertiser Name', 'Primary Region', 'Membership Status', 'Datafeed Format', 'Feed ID', 'Feed Name', 'Language', 'Vertical', 'Last Imported', 'Last Checked', 'No of products'];
      const indexes = safeFields.map((name) => csvHeaders.findIndex((header) => header.toLowerCase() === name.toLowerCase()));
      const urlIndex = csvHeaders.findIndex((header) => /^url$/i.test(header));
      const feeds = csvRows.slice(1).map((cells) => Object.fromEntries(safeFields
        .map((name, index) => [name, indexes[index] >= 0 ? (cells[indexes[index]] || '').trim() : ''])
        .filter(([, value]) => value !== '')));
      const targetFeeds = feeds.filter((feed) => ['17729', '79974'].includes(feed['Advertiser ID'])).map((feed) => {
        const sourceRow = csvRows.find((cells) => (cells[indexes[0]] || '').trim() === feed['Advertiser ID']
          && (cells[indexes[5]] || '').trim() === feed['Feed ID']);
        let downloadHost = '';
        try { downloadHost = new URL(sourceRow?.[urlIndex] || '').hostname; } catch { }
        return { ...feed, downloadHost, downloadUrlAvailable: Boolean(sourceRow?.[urlIndex]) };
      });
      return { ...summary, format: 'csv', totalFeeds: feeds.length, targetFeedCount: targetFeeds.length, targetFeeds };
    }
    const html = new DOMParser().parseFromString(text, 'text/html');
    const tables = [...html.querySelectorAll('table')].map((table) => [...table.querySelectorAll('tr')]
      .map((row) => [...row.querySelectorAll('th,td')].map((cell) => (cell.innerText || '').replace(/\\s+/g, ' ').trim())));
    const table = tables.find((rows) => rows[0]?.some((cell) => /advertiser id/i.test(cell))
      && rows[0]?.some((cell) => /feed id/i.test(cell)));
    if (!table) {
      const safeText = (value) => String(value || '')
        .replace(/https?:\\/\\/\\S+/gi, '[url]')
        .replace(/[a-f0-9]{32,}/gi, '[token]')
        .replace(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi, '[email]')
        .replace(/\\s+/g, ' ').trim().slice(0, 500);
      const rowLikeNodes = [...html.querySelectorAll('tr, [role="row"], [class*="feed-row" i]')]
        .slice(0, 12).map((node) => safeText(node.innerText));
      return {
        ...summary,
        format: 'html',
        title: safeText(html.title),
        headings: [...html.querySelectorAll('h1,h2,h3')].slice(0, 12).map((node) => safeText(node.innerText)),
        bodyPreview: safeText(html.body?.innerText),
        tablesFound: tables.length,
        tableHeaders: tables.map((rows) => rows[0]?.slice(0, 20)),
        rowLikeNodes,
        scripts: [...html.scripts].slice(0, 12).map((script) => ({ type: script.type || 'text/javascript', id: script.id || '', chars: script.textContent.length }))
      };
    }
    const headers = table[0];
    const rows = table.slice(1).filter((cells) => cells.length >= headers.length);
    const column = (patterns) => headers.findIndex((header) => patterns.test(header));
    const indices = {
      advertiserId: column(/advertiser id/i), advertiserName: column(/advertiser name/i), region: column(/primary region/i),
      membership: column(/membership status/i), format: column(/datafeed format/i), feedId: column(/feed id/i),
      feedName: column(/feed name/i), language: column(/language/i), vertical: column(/vertical/i),
      lastImported: column(/last imported/i), productCount: column(/no of products/i)
    };
    const feeds = rows.map((cells) => Object.fromEntries(Object.entries(indices)
      .filter(([, index]) => index >= 0).map(([key, index]) => [key, cells[index]])));
    const targetFeeds = feeds.filter((feed) => ['17729', '79974'].includes(String(feed.advertiserId)));
    return { ...summary, format: 'html-table', totalFeeds: feeds.length, targetFeedCount: targetFeeds.length, targetFeeds: targetFeeds.slice(0, 80) };
  }
  const records = [];
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 6 || records.length >= 150) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    const entries = Object.entries(value);
    const relevant = entries.filter(([key, item]) => /advertiser(name|id)|feed(id|name|status|language|region|updated)/i.test(key)
      && !/url|link|token|secret/i.test(key) && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'));
    if (relevant.length) records.push(Object.fromEntries(relevant));
    else entries.forEach(([, item]) => visit(item, depth + 1));
  };
  visit(data);
  return { ...summary, format: 'json', topLevelKeys: Object.keys(data).slice(0, 30), recordCount: records.length, records: records.slice(0, 40) };
}).catch((error) => ({ fetchError: String(error?.message || error) }))`;
try {
  const result = await new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  if (result.exceptionDetails) throw new Error('Falha ao consultar feedList na sessao autenticada.');
  const summary = result.result.value;
  console.log(JSON.stringify(summary, null, 2));
  if (summary.status && summary.status >= 400) process.exitCode = 1;
} finally {
  socket.close();
}
