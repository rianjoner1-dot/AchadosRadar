import { readFileSync } from 'node:fs';
import sampleCards from '../tests/fixtures/sample_20_cards.json' with { type: 'json' };

function readEnv(name) {
  const line = readFileSync('.env', 'utf8').split(String.fromCharCode(10))
    .map((value) => value.replace(/\r$/, '').trim())
    .find((value) => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '') || '';
}

const url = readEnv('PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const key = readEnv('PUBLIC_SUPABASE_ANON_KEY') || readEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) throw new Error('Missing public Supabase URL or public API key in .env.');

async function searchCatalog(params) {
  const response = await fetch(`${url}/rest/v1/rpc/search_catalog`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Public catalog RPC returned HTTP ${response.status}.`);
  return response.json();
}

const base = {
  search_query: '', target_platform: null, min_price: null, max_price: null,
  sort_by: 'recent', cursor_created_at: null, cursor_id: null, cursor_price: null, cursor_score: null
};
const firstPage = await searchCatalog({ ...base, page_size: 10 });
const last = firstPage.at(-1);
const secondPage = last ? await searchCatalog({
  ...base, page_size: 10, cursor_created_at: last.created_at, cursor_id: last.id, cursor_score: last.search_score
}) : [];
const searchFirstPage = await searchCatalog({ ...base, search_query: 'fone', page_size: 2 });
const searchLast = searchFirstPage.at(-1);
const searchSecondPage = searchLast ? await searchCatalog({
  ...base, search_query: 'fone', page_size: 2,
  cursor_created_at: searchLast.created_at, cursor_id: searchLast.id, cursor_score: searchLast.search_score
}) : [];
const searchOverlap = searchSecondPage.filter((row) => searchFirstPage.some((first) => first.id === row.id)).length;
const firstIds = new Set(firstPage.map((row) => row.id));
const overlap = secondPage.filter((row) => firstIds.has(row.id)).length;
const combined = [...firstPage, ...secondPage];
const sampleIds = new Set(sampleCards.map((product) => product.id));
const publicFieldsSafe = combined.every((row) => {
  const json = JSON.stringify(row);
  return !/affiliate_url|seller_id|store_affiliate_id/i.test(json);
});
const imageUrlsHttps = combined.every((row) => (row.images ?? []).every((image) => /^https:\/\//i.test(image.url)));
const oneImagePerCard = combined.every((row) => (row.images ?? []).length <= 1);
const linkReady = combined.filter((row) => row.affiliate_link?.status === 'active').length;
const inStock = combined.filter((row) => row.offer?.stock_status === 'in_stock').length;
const detailsHaveStaticPage = combined.filter((row) => sampleIds.has(row.id)).length;

console.log(JSON.stringify({
  pageOneCount: firstPage.length,
  pageTwoCount: secondPage.length,
  pageOverlap: overlap,
  relevancePageOneCount: searchFirstPage.length,
  relevancePageTwoCount: searchSecondPage.length,
  relevancePageOverlap: searchOverlap,
  uniqueProducts: new Set(combined.map((row) => row.id)).size,
  publicFieldsSafe,
  imageUrlsHttps,
  oneImagePerCard,
  activeAffiliateLinks: linkReady,
  inStockProducts: inStock,
  productsWithPrerenderedDetailPages: detailsHaveStaticPage,
  currentDetailRoute: '/produto/[id]'
}, null, 2));

if (firstPage.length > 20 || overlap > 0 || searchOverlap > 0 || !publicFieldsSafe || !imageUrlsHttps || !oneImagePerCard) {
  process.exitCode = 1;
}
