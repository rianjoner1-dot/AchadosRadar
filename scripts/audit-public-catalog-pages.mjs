import { readFileSync } from 'node:fs';

const argumentsMap = new Map(process.argv.slice(2).map((argument) => {
  const [key, value] = argument.replace(/^--/, '').split('=');
  return [key, value];
}));
function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(maximum, parsed)) : fallback;
}
const pageSize = positiveInteger(argumentsMap.get('page-size'), 12, 100);
const pageLimit = positiveInteger(argumentsMap.get('pages'), 5, 20);

function readEnv(name) {
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((entry) => entry.trim().startsWith(`${name}=`));
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

const url = readEnv('PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const key = readEnv('PUBLIC_SUPABASE_ANON_KEY') || readEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) throw new Error('Missing public Supabase URL or public API key in .env.');

let cursor = null;
const seen = new Set();
const pages = [];
for (let page = 1; page <= pageLimit; page += 1) {
  const response = await fetch(`${url}/rest/v1/rpc/search_catalog`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      search_query: '', target_platform: null, min_price: null, max_price: null, sort_by: 'recent',
      cursor_created_at: cursor?.created_at ?? null, cursor_id: cursor?.id ?? null,
      cursor_price: cursor?.price ?? null, cursor_score: cursor?.score ?? null, page_size: pageSize
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Public catalog RPC returned HTTP ${response.status}.`);
  const rows = await response.json();
  const duplicates = rows.filter((row) => seen.has(row.id)).length;
  rows.forEach((row) => seen.add(row.id));
  pages.push({ page, count: rows.length, duplicates });
  if (rows.length < pageSize) break;
  const last = rows.at(-1);
  cursor = { created_at: last.created_at, id: last.id, price: last.offer?.price ?? null, score: last.search_score ?? null };
}

console.log(JSON.stringify({ pageSize, requestedPages: pageLimit, pages, uniqueProducts: seen.size, writes: 0 }, null, 2));
if (pages.some((page) => page.duplicates > 0)) process.exitCode = 1;
