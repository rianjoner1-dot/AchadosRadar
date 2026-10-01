import { readFileSync } from 'node:fs';
import { checkImagesInChrome } from './check-images-in-chrome.mjs';

function readEnv(name) {
  const processValue = process.env[name]?.trim();
  if (processValue) return processValue.replace(/^['"]|['"]$/g, '');
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((entry) => entry.trim().startsWith(`${name}=`));
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

const url = readEnv('PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const key = readEnv('PUBLIC_SUPABASE_ANON_KEY') || readEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) throw new Error('Missing public Supabase URL or public API key in .env.');

const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
let cursor = null;
const products = [];
for (let page = 0; page < 5; page += 1) {
  const response = await fetch(`${url}/rest/v1/rpc/search_catalog`, {
    method: 'POST', headers,
    body: JSON.stringify({
      search_query: '', target_platform: null, min_price: null, max_price: null, sort_by: 'recent',
      cursor_created_at: cursor?.created_at ?? null, cursor_id: cursor?.id ?? null,
      cursor_price: cursor?.price ?? null, cursor_score: cursor?.score ?? null, page_size: 12
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Public catalog RPC returned HTTP ${response.status}.`);
  const rows = await response.json();
  products.push(...rows.map(({ id, platform, external_id }) => ({ id, platform, external_id })));
  if (rows.length < 12) break;
  const last = rows.at(-1);
  cursor = { created_at: last.created_at, id: last.id, price: last.offer?.price ?? null, score: last.search_score ?? null };
}

if (!products.length) throw new Error('No published catalog products were returned.');
const productIds = products.map(({ id }) => id);
const imageResponse = await fetch(`${url}/rest/v1/product_images?select=product_id,url,display_order&product_id=in.(${productIds.join(',')})&order=product_id.asc,display_order.asc`, {
  headers, signal: AbortSignal.timeout(15000)
});
if (!imageResponse.ok) throw new Error(`Public product images query returned HTTP ${imageResponse.status}.`);
const images = await imageResponse.json();
if (!images.length) throw new Error('No public product images were returned for published products.');
const imageProducts = new Map(products.map((product) => [product.id, product]));
const platformOrder = new Map([...new Set(images.map((image) => imageProducts.get(image.product_id)?.platform))].map((platform, index) => [platform, index]));
const orderedImages = [...images].sort((a, b) => platformOrder.get(imageProducts.get(a.product_id)?.platform) - platformOrder.get(imageProducts.get(b.product_id)?.platform));
const checked = await checkImagesInChrome(orderedImages.map((image) => ({
  platform: imageProducts.get(image.product_id)?.platform,
  productId: image.product_id,
  externalId: imageProducts.get(image.product_id)?.external_id,
  url: image.url
})));
const annotated = checked.map((result, index) => ({
  ...result,
  platform: imageProducts.get(orderedImages[index].product_id)?.platform,
  externalId: imageProducts.get(orderedImages[index].product_id)?.external_id,
  displayOrder: orderedImages[index].display_order
}));
const failures = annotated.filter((image) => !image.ok);
const identityMismatches = annotated.filter((image) => image.identity === 'mismatch');
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  publishedProducts: products.length,
  imagesFound: images.length,
  imagesLoaded: annotated.length - failures.length,
  unavailableImages: failures.length,
  imageIdentityMismatches: identityMismatches.length,
  identityReviewRequired: identityMismatches.map(({ platform, externalId, displayOrder }) => ({ platform, externalId, displayOrder })),
  failures: failures.map(({ platform, externalId, displayOrder, status, contentType, naturalWidth, naturalHeight, timedOut }) => ({
    platform, externalId, displayOrder, status: status ?? null, contentType: contentType ?? null, naturalWidth, naturalHeight, timedOut
  })),
  writes: 0
}, null, 2));
