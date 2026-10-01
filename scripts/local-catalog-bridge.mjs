import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isAllowedMarketplaceImageUrl } from '../src/modules/shared/marketplace-image-url.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dataPath = path.resolve(process.env.LOCAL_CATALOG_BRIDGE_DATA || path.join(projectRoot, 'data', 'catalogo_macro.json'));
const requestedPort = Number(process.env.LOCAL_CATALOG_BRIDGE_PORT || 6875);
const maxBodyBytes = 1024 * 1024;
const supportedPlatforms = new Set(['magalu', 'mercadolivre', 'amazon', 'shopee']);
const supabaseUrl = String(process.env.PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const canArchiveRemotely = Boolean(supabaseUrl && serviceRoleKey);
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
  stockEvidence: ['stockEvidence', 'stock_evidence'],
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
let archiveQueueInFlight = false;

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
  result.images = (Array.isArray(imageValues) ? imageValues : [])
    .map((image) => typeof image === 'string' ? image : image?.url || image?.src)
    .filter((url) => typeof url === 'string' && url.length <= 4000 && (['magalu', 'mercadolivre'].includes(platform)
      ? isAllowedMarketplaceImageUrl(platform, url)
      : url.startsWith('https://')))
    .filter((url, index, all) => all.indexOf(url) === index);
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

function normalizeUnavailableReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_report');
  const platform = String(input.platform || '').trim().toLowerCase();
  const id = String(input.externalId || '').trim();
  const allowedHosts = platform === 'magalu' ? ['magazineluiza.com.br', 'magazinevoce.com.br'] : platform === 'mercadolivre' ? ['mercadolivre.com.br', 'mercadolivre.com'] : [];
  let url;
  try { url = new URL(String(input.originalUrl || '')); } catch { throw new Error('invalid_marketplace_url'); }
  if (!id || id.length > 200 || url.protocol !== 'https:' || !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new Error('invalid_catalog_identity');
  if (input.evidence !== 'explicit_not_found_without_title_or_price') throw new Error('missing_explicit_unavailable_evidence');
  return { platform, externalId: id, originalUrl: url.href, marketplaceUnavailable: true, marketplaceUnavailableEvidence: input.evidence, evidence: input.evidence, confirmedAt: String(input.confirmedAt || new Date().toISOString()).slice(0, 40) };
}

async function recordUnavailableReport(input) {
  const report = normalizeUnavailableReport(input);
  const catalog = await readCatalog();
  const product = catalog.products.find((item) => item.platform === report.platform && String(item.id) === report.externalId);
  if (!product || product.originalUrl !== report.originalUrl) throw new Error('catalog_identity_mismatch');
  const pending = Array.isArray(catalog.confirmedUnavailable) ? catalog.confirmedUnavailable : [];
  catalog.confirmedUnavailable = [...pending.filter((item) => !(item.platform === report.platform && item.externalId === report.externalId)), report].slice(-1000);
  catalog.updatedAt = new Date().toISOString();
  const temporaryPath = `${dataPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, dataPath);
  return { ok: true, pending: true, id: report.externalId, total: catalog.confirmedUnavailable.length };
}

async function clearUnavailableReport(input) {
  const report = normalizeUnavailableReport(input);
  const catalog = await readCatalog();
  const before = catalog.confirmedUnavailable?.length || 0;
  catalog.confirmedUnavailable = (catalog.confirmedUnavailable || []).filter((item) => !(item.platform === report.platform && item.externalId === report.externalId));
  if (catalog.confirmedUnavailable.length !== before) {
    catalog.updatedAt = new Date().toISOString();
    const temporaryPath = `${dataPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, dataPath);
  }
  return { ok: true, cleared: before !== catalog.confirmedUnavailable.length };
}

async function isProductArchived(platform, externalId) {
  const params = new URLSearchParams({ select: 'status', platform: `eq.${platform}`, external_id: `eq.${externalId}`, limit: '1' });
  const response = await fetch(`${supabaseUrl}/rest/v1/products?${params}`, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`verify_archived_product_http_${response.status}`);
  const rows = await response.json();
  return rows?.[0]?.status === 'archived';
}

async function archiveUnavailableReport(report) {
  const safeReport = normalizeUnavailableReport(report);
  const catalog = await readCatalog();
  const product = catalog.products.find((item) => item.platform === safeReport.platform && String(item.id) === safeReport.externalId);
  if (!product || product.originalUrl !== safeReport.originalUrl) throw new Error('catalog_identity_mismatch');

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/archive_unavailable_catalog_item`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_platform: safeReport.platform, p_external_id: safeReport.externalId }),
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error(`archive_unavailable_http_${response.status}`);
  const archived = await response.json().catch(() => false);
  if (archived !== true && !(await isProductArchived(safeReport.platform, safeReport.externalId))) {
    throw new Error('product_not_archived');
  }

  const clearTask = writeQueue.then(() => clearUnavailableReport(safeReport));
  writeQueue = clearTask.catch(() => {});
  await clearTask;
  return safeReport.externalId;
}

async function processUnavailableReports() {
  if (!canArchiveRemotely || archiveQueueInFlight) {
    const catalog = await readCatalog();
    return { archivedIds: [], pending: Array.isArray(catalog.confirmedUnavailable) ? catalog.confirmedUnavailable.length : 0 };
  }
  archiveQueueInFlight = true;
  const archivedIds = [];
  try {
    const catalog = await readCatalog();
    for (const report of Array.isArray(catalog.confirmedUnavailable) ? catalog.confirmedUnavailable : []) {
      try {
        archivedIds.push(await archiveUnavailableReport(report));
      } catch (error) {
        console.warn(`[catalog-bridge] Arquivamento pendente para ${report?.platform}/${report?.externalId}: ${String(error.message || error).slice(0, 100)}`);
      }
    }
    const refreshed = await readCatalog();
    return { archivedIds, pending: Array.isArray(refreshed.confirmedUnavailable) ? refreshed.confirmedUnavailable.length : 0 };
  } finally {
    archiveQueueInFlight = false;
  }
}

const server = http.createServer(async (req, res) => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(String(req.headers.host || ''))) return respond(res, 403, { ok: false, error: 'Somente host local é aceito.' });
  if (!allowOrigin(req, res)) return respond(res, 403, { ok: false, error: 'Origem não permitida.' });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const route = new URL(req.url || '/', `http://${req.headers.host}`).pathname;
  if (req.method === 'GET' && (route === '/api/health' || route === '/api/status')) {
    try {
      const catalog = await readCatalog();
      return respond(res, 200, {
        ok: true, status: 'online', products: catalog.products.length,
        total_products_stored: catalog.products.length, updatedAt: catalog.updatedAt
      });
    }
    catch { return respond(res, 500, { ok: false, error: 'Não foi possível ler o catálogo local.' }); }
  }
  if (req.method === 'GET' && route === '/api/catalog/unavailable') {
    try {
      const catalog = await readCatalog();
      return respond(res, 200, { ok: true, reports: Array.isArray(catalog.confirmedUnavailable) ? catalog.confirmedUnavailable : [] });
    } catch { return respond(res, 500, { ok: false, error: 'Não foi possível ler as pendências locais.' }); }
  }
  if (req.method === 'POST' && route === '/api/catalog/unavailable/clear') {
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return respond(res, 415, { ok: false, error: 'Envie application/json.' });
    const chunks = [];
    try {
      for await (const chunk of req) chunks.push(chunk);
      const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const clearTask = writeQueue.then(() => clearUnavailableReport(report));
      writeQueue = clearTask.catch(() => {});
      return respond(res, 200, await clearTask);
    } catch { return respond(res, 400, { ok: false, error: 'Relatório inválido ou não foi possível removê-lo.' }); }
  }
  if (req.method !== 'POST' || !['/api/save_product', '/api/catalog/unavailable'].includes(route)) return respond(res, 404, { ok: false, error: 'Rota não encontrada.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return respond(res, 415, { ok: false, error: 'Envie application/json.' });

  const chunks = [];
  let received = 0;
  try {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > maxBodyBytes) return respond(res, 413, { ok: false, error: 'Produto excede 1 MiB.' });
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (route === '/api/catalog/unavailable') {
      const saveTask = writeQueue.then(() => recordUnavailableReport(body));
      writeQueue = saveTask.catch(() => {});
      const saved = await saveTask;
      processUnavailableReports().catch((error) => console.warn(`[catalog-bridge] Fila de arquivamento pendente: ${String(error.message || error).slice(0, 100)}`));
      return respond(res, 202, { ...saved, archiveQueued: canArchiveRemotely });
    }
    const product = normalizeIncoming(body);
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
    if (canArchiveRemotely) {
      processUnavailableReports().catch((error) => console.warn(`[catalog-bridge] Fila de arquivamento pendente: ${String(error.message || error).slice(0, 100)}`));
      const retryTimer = setInterval(() => {
        processUnavailableReports().catch((error) => console.warn(`[catalog-bridge] Fila de arquivamento pendente: ${String(error.message || error).slice(0, 100)}`));
      }, 60_000);
      retryTimer.unref();
    }
  });
}
