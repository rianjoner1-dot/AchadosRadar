import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dataPath = path.resolve(process.env.LOCAL_CATALOG_BRIDGE_DATA || path.join(projectRoot, 'data', 'catalogo_macro.json'));
const requestedPort = Number(process.env.LOCAL_CATALOG_BRIDGE_PORT || 6875);
const maxBodyBytes = 1024 * 1024;
const supportedPlatforms = new Set(['magalu', 'mercadolivre', 'amazon', 'shopee']);
const fieldAliases = {
  id: ['id', 'external_id', 'externalId', 'productId'],
  title: ['title', 'name', 'nome'],
  description: ['description', 'descriptionText', 'descricao'],
  category: ['category', 'categoria'],
  brand: ['brand', 'marca'],
  price: ['price', 'currentPrice', 'preco'],
  oldPrice: ['oldPrice', 'old_price', 'precoAnterior'],
  installments: ['installments', 'installmentsText', 'parcelamento'],
  shipping: ['shipping', 'shippingText', 'frete'],
  coupon: ['coupon', 'couponText', 'cupom'],
  stockQuantity: ['stockQuantity', 'stock_quantity'],
  stockStatus: ['stockStatus', 'stock_status'],
  sellerName: ['sellerName', 'seller_name', 'seller'],
  sellerId: ['sellerId', 'seller_id'],
  storeName: ['storeName', 'store_name'],
  storeAffiliateId: ['storeAffiliateId', 'store_affiliate_id'],
  originalUrl: ['originalUrl', 'original_url', 'url', 'productUrl'],
  affiliateUrl: ['affiliateUrl', 'affiliate_url', 'shortLink', 'linkAfiliado'],
  isOfficialShortLink: ['isOfficialShortLink', 'linkReady', 'affiliateLinkVerified'],
  linkStatus: ['linkStatus', 'link_status'],
  lastCheckedAt: ['lastCheckedAt', 'linkVerifiedAt', 'verified_at'],
  refreshDueAt: ['refreshDueAt', 'refresh_due_at'],
  linkExpiresAt: ['linkExpiresAt', 'link_expires_at'],
  offerObservedAt: ['offerObservedAt', 'offer_observed_at', 'observedAt', 'observed_at'],
  collectedAt: ['collectedAt', 'collected_at']
};
let writeQueue = Promise.resolve();

const respond = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

function allowOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return false;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('vary', 'Origin');
  return true;
}

function valueOf(source, aliases) {
  for (const key of aliases) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
}

function normalizeIncoming(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('O corpo deve ser um objeto de produto.');
  const platform = String(input.platform || input.marketplace || input.store || '').trim().toLowerCase();
  if (!supportedPlatforms.has(platform)) throw new Error('Plataforma não suportada pela extensão.');
  const id = String(valueOf(input, fieldAliases.id) ?? '').trim();
  const title = String(valueOf(input, fieldAliases.title) ?? '').trim();
  if (!id || id.length > 200 || !title || title.length > 500) throw new Error('Produto precisa de ID e título válidos.');

  const result = { platform, id, title };
  for (const [field, aliases] of Object.entries(fieldAliases)) {
    if (['id', 'title'].includes(field)) continue;
    const value = valueOf(input, aliases);
    if (value === undefined) continue;
    result[field] = typeof value === 'string' ? value.trim().slice(0, 2000) : value;
  }
  const imageValues = valueOf(input, ['images', 'photos', 'pictures', 'fotos']) ?? [valueOf(input, ['image', 'thumbnail', 'imagem'])].filter(Boolean);
  result.images = (Array.isArray(imageValues) ? imageValues : []).map((image) => typeof image === 'string' ? image : image?.url || image?.src).filter((url) => typeof url === 'string' && url.startsWith('https://')).map((url) => url.slice(0, 4000)).filter((url, index, all) => all.indexOf(url) === index);
  result.bridgeReceivedAt = new Date().toISOString();
  return result;
}

async function readCatalog() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    return parsed && Array.isArray(parsed.products) ? parsed : { schemaVersion: 1, updatedAt: null, products: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, updatedAt: null, products: [] };
    throw error;
  }
}

async function saveProduct(product) {
  const catalog = await readCatalog();
  const index = catalog.products.findIndex((item) => item.platform === product.platform && String(item.id) === product.id);
  let merged = product;
  if (index >= 0) {
    const previous = catalog.products[index];
    merged = { ...previous, ...product };
    if (!product.images.length && previous.images?.length) merged.images = previous.images;
    catalog.products[index] = merged;
  } else catalog.products.push(merged);
  catalog.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  await fs.rename(temporaryPath, dataPath);
  return { created: index < 0, total: catalog.products.length };
}

const server = http.createServer(async (req, res) => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(String(req.headers.host || ''))) return respond(res, 403, { ok: false, error: 'Somente host local é aceito.' });
  if (!allowOrigin(req, res)) return respond(res, 403, { ok: false, error: 'Origem não permitida.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const route = new URL(req.url || '/', `http://${req.headers.host}`).pathname;
  if (req.method === 'GET' && route === '/api/health') {
    try { const catalog = await readCatalog(); return respond(res, 200, { ok: true, products: catalog.products.length, updatedAt: catalog.updatedAt }); }
    catch { return respond(res, 500, { ok: false, error: 'Não foi possível ler o catálogo local.' }); }
  }
  if (req.method !== 'POST' || route !== '/api/save_product') return respond(res, 404, { ok: false, error: 'Rota não encontrada.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return respond(res, 415, { ok: false, error: 'Envie application/json.' });

  const chunks = [];
  let received = 0;
  try {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > maxBodyBytes) return respond(res, 413, { ok: false, error: 'Produto excede 1 MiB.' });
      chunks.push(chunk);
    }
    const product = normalizeIncoming(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const saveTask = writeQueue.then(() => saveProduct(product));
    writeQueue = saveTask.catch(() => {});
    const result = await saveTask;
    return respond(res, result.created ? 201 : 200, { ok: true, created: result.created, total: result.total, id: product.id, platform: product.platform });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error.message?.includes('ID e título') || error.message?.includes('Plataforma') || error.message?.includes('objeto') ? 422 : 500;
    return respond(res, status, { ok: false, error: status === 500 ? 'Falha ao salvar no catálogo local.' : error.message });
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error('Porta inválida.');
  server.listen(requestedPort, '127.0.0.1', () => {
    console.log(JSON.stringify({ event: 'ready', host: '127.0.0.1', port: server.address().port, dataPath }));
  });
}
