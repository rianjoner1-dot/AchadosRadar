import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseCsv } from './awin-csv.mjs';
import { isAllowedAffiliateUrl } from '../src/modules/outbound/allowlist.mjs';
import { isAllowedMarketplaceImageUrl } from '../src/modules/shared/marketplace-image-url.mjs';

const positional = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const input = positional[0] || path.join(process.env.USERPROFILE, 'Downloads', 'datafeed_3105840.csv.gz');
// Separate output prevents races with the browser bridge's catalog writer.
const output = positional[1] || path.resolve('data/catalogo_awin_kabum.json');
const buffer = fs.readFileSync(input);
const source = buffer[0] === 0x1f && buffer[1] === 0x8b
  ? gunzipSync(buffer, { maxOutputLength: 300 * 1024 * 1024 }).toString('utf8') : buffer.toString('utf8');
const [header, ...rows] = parseCsv(source);
if (!header) throw new Error('Feed vazio.');
const headers = header.map(value => value.replace(/^\uFEFF/, '').trim());
for (const name of ['merchant_id','merchant_product_id','merchant_deep_link','aw_deep_link','product_name','search_price']) {
  if (!headers.includes(name)) throw new Error(`Feed sem coluna obrigatória: ${name}`);
}
const products = new Map(); let rejected = 0;
const collectedAt = new Date().toISOString();
const sourceModifiedAt = fs.statSync(input).mtime.toISOString();
for (const cells of rows) {
  if (cells.length !== headers.length) { rejected++; continue; }
  const item = Object.fromEntries(headers.map((key, i) => [key, cells[i].trim()]));
  if (item.merchant_id !== '17729') { rejected++; continue; }
  const id = item.merchant_product_id;
  let original;
  try { original = new URL(item.merchant_deep_link); } catch { rejected++; continue; }
  const priceText = item.search_price;
  const price = Number(priceText.includes(',') ? priceText.replace(/\./g, '').replace(',', '.') : priceText);
  const images = [...new Set([item.merchant_image_url,item.aw_image_url,item.aw_thumb_url].map(url => typeof url === 'string' ? url.replace(/^http:/, 'https:') : url).filter(url => isAllowedMarketplaceImageUrl('kabum', url)))];
  if (!/^\d+$/.test(id) || original.protocol !== 'https:' || original.port || original.username || original.password
    || !['www.kabum.com.br','kabum.com.br'].includes(original.hostname)
    || original.pathname.match(/^\/produto\/(\d+)(?:\/|$)/)?.[1] !== id
    || !item.product_name || !Number.isFinite(price) || price <= 0 || !images.length
    || !isAllowedAffiliateUrl('kabum', item.aw_deep_link)) { rejected++; continue; }
  products.set(id, {
    platform:'kabum', id, title:item.product_name, category:item.merchant_category || item.category_name || null,
    brand:item.brand_name || null, description:item.description || null, price,
    originalUrl:original.href, affiliateUrl:item.aw_deep_link, images,
    storeName:'KaBuM!', sellerName:item.merchant_name || 'KaBuM!', storeAffiliateId:'3105840',
    collectedAt, sourceModifiedAt, source:'awin_feed',
    stockStatus:'unknown', installments:null, shipping:null, coupon:null,
    linkStatus:'pending_verification', isOfficialShortLink:true
  });
}
const catalog = { schemaVersion:'1.0', updatedAt:collectedAt, products:[...products.values()] };
if (!process.argv.includes('--dry-run')) {
  fs.mkdirSync(path.dirname(output), { recursive:true });
  const temp = `${output}.${process.pid}.tmp`;
  try { fs.writeFileSync(temp, JSON.stringify(catalog), { flag:'wx' }); fs.renameSync(temp, output); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
console.log(JSON.stringify({ rows:rows.length, accepted:products.size, rejected, output, dryRun:process.argv.includes('--dry-run') }));
