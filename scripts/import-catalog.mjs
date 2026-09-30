import fs from 'node:fs/promises';

const baseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!inputPath) {
  console.error('Uso: node scripts/import-catalog.mjs <catalogo.json> [--dry-run]');
  process.exit(2);
}

const allowedHosts = {
  mercadolivre: ['mercadolivre.com.br', 'produto.mercadolivre.com.br', 'mercadolivre.com', 'meli.la'],
  magalu: ['magazinevoce.com.br', 'magazineluiza.com.br', 'magalu.com.br', 'a-static.mlcdn.com.br', 'm.magazineluiza.com.br']
};
const imageHosts = {
  mercadolivre: ['mlstatic.com', 'mlstatic.com.br'],
  magalu: ['mlcdn.com.br', 'magazineluiza.com.br']
};
const get = (o, ...keys) => keys.map((key) => o?.[key]).find((value) => value !== undefined && value !== null);
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const toPrice = (value) => typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
function normalize(item) {
  const platform = get(item, 'platform', 'marketplace', 'store');
  const externalId = text(get(item, 'external_id', 'externalId', 'id', 'productId'));
  const title = text(get(item, 'title', 'name', 'nome'));
  const price = toPrice(get(item, 'price', 'currentPrice', 'preco'));
  const originalUrl = text(get(item, 'originalUrl', 'original_url', 'url', 'productUrl'));
  const affiliateUrl = text(get(item, 'affiliateUrl', 'affiliate_url', 'shortLink', 'linkAfiliado'));
  const safeUrl = (candidate) => {
    if (!candidate) return null;
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' && allowedHosts[platform]?.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)) ? parsed.href : null;
    } catch { return null; }
  };
  const errors = [];
  if (!allowedHosts[platform]) errors.push('plataforma_nao_suportada');
  if (!externalId) errors.push('id_externo_ausente');
  if (!title) errors.push('titulo_ausente');
  if (!Number.isFinite(price) || price <= 0) errors.push('preco_invalido');
  const original = safeUrl(originalUrl);
  const affiliate = safeUrl(affiliateUrl);
  if (!original) errors.push('url_original_fora_da_allowlist');
  if (!affiliate) errors.push('link_afiliado_ausente_ou_fora_da_allowlist');
  const imagesRaw = get(item, 'images', 'photos', 'pictures', 'fotos') ?? [get(item, 'image', 'thumbnail', 'imagem')];
  const images = (Array.isArray(imagesRaw) ? imagesRaw : []).map((img) => typeof img === 'string' ? img : get(img, 'url', 'src')).filter((url) => {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' && imageHosts[platform]?.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)); } catch { return false; }
  }).map((url, index) => ({ url, display_order: index, is_primary: index === 0 }));
  if (!images.length) errors.push('foto_https_ausente');
  const macroStatus = get(item, 'linkStatus', 'link_status');
  const macroVerifiedAt = get(item, 'lastCheckedAt', 'linkVerifiedAt', 'verified_at');
  const officialFlag = get(item, 'isOfficialShortLink', 'linkReady', 'affiliateLinkVerified') === true;
  const magaluOfficialUrl = platform === 'magalu' && Boolean(get(item, 'storeAffiliateId', 'store_affiliate_id')) && Boolean(affiliate) && new URL(affiliate).hostname.endsWith('magazinevoce.com.br');
  const mercadolivreOfficialUrl = Boolean(affiliate) && new URL(affiliate).hostname.endsWith('meli.la');
  const verifiedDate = macroVerifiedAt ? new Date(macroVerifiedAt) : null;
  const linkIsReady = macroStatus === 'ready' && verifiedDate instanceof Date && !Number.isNaN(verifiedDate.getTime()) && (platform === 'magalu' ? magaluOfficialUrl : officialFlag && mercadolivreOfficialUrl);
  return { errors, row: {
    platform, external_id: externalId, title, description: text(get(item, 'description', 'descriptionText', 'descricao')),
    category: text(get(item, 'category', 'categoria')), brand: text(get(item, 'brand', 'marca')),
    price, old_price: toPrice(get(item, 'oldPrice', 'old_price', 'precoAnterior')) || null,
    installments_text: text(get(item, 'installments', 'installmentsText', 'parcelamento')),
    shipping_text: text(get(item, 'shipping', 'shippingText', 'frete')),
    coupon_code: text(get(item, 'coupon', 'couponText', 'cupom')),
    stock_quantity: Number.isInteger(get(item, 'stockQuantity', 'stock_quantity')) ? get(item, 'stockQuantity', 'stock_quantity') : null,
    stock_status: ['in_stock', 'out_of_stock', 'unknown'].includes(get(item, 'stockStatus', 'stock_status')) ? get(item, 'stockStatus', 'stock_status') : 'unknown',
    seller_name: text(get(item, 'sellerName', 'seller_name', 'seller')) ?? 'Loja Parceira',
    seller_id: text(get(item, 'sellerId', 'seller_id')) ?? '', store_name: text(get(item, 'storeName', 'store_name')) ?? (platform === 'magalu' ? 'Magalu' : 'Mercado Livre'),
    store_affiliate_id: text(get(item, 'storeAffiliateId', 'store_affiliate_id')) ?? '', original_url: original,
    affiliate_url: affiliate, link_is_official: linkIsReady, link_status: linkIsReady ? 'active' : 'broken',
    verified_at: linkIsReady ? verifiedDate.toISOString() : null,
    refresh_due_at: get(item, 'refreshDueAt', 'refresh_due_at') ?? null,
    expires_at: get(item, 'linkExpiresAt', 'expires_at') ?? null,
    images
  }};
}

const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const products = Array.isArray(payload) ? payload : Array.isArray(payload.products) ? payload.products : Array.isArray(payload.items) ? payload.items : null;
if (!products) throw new Error('JSON deve ser um array ou ter a propriedade products/items.');
const platformFilters = new Set(
  process.argv
    .filter((arg) => arg.startsWith('--platform='))
    .flatMap((arg) => arg.slice('--platform='.length).split(',').map((value) => value.trim()).filter(Boolean))
);
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : Infinity;
if (limitArg && (!Number.isSafeInteger(limit) || limit <= 0)) throw new Error('--limit deve ser um inteiro positivo.');
const selectedProducts = products
  .filter((item) => !platformFilters.size || platformFilters.has(normalize(item).row.platform))
  .slice(0, limit);
if (dryRun) {
  const summaryOnly = process.argv.includes('--summary');
  const report = selectedProducts.map((item, index) => {
    const { errors, row } = normalize(item);
    const notPublishableReasons = [];
    if (!errors.length) {
      if (!row.link_is_official) notPublishableReasons.push('link_afiliado_nao_verificado');
      if (row.stock_status !== 'in_stock') notPublishableReasons.push(`estoque_${row.stock_status}`);
    }
    return { index, id: row.external_id, platform: row.platform, valid: errors.length === 0, publishable: errors.length === 0 && notPublishableReasons.length === 0, errors, notPublishableReasons };
  });
  const summaryByPlatform = Object.groupBy ? Object.groupBy(report, (item) => String(item.platform ?? 'ausente')) : report.reduce((groups, item) => { (groups[item.platform ?? 'ausente'] ??= []).push(item); return groups; }, {});
  const platformSummary = Object.fromEntries(Object.entries(summaryByPlatform).map(([platform, rows]) => [platform, { total: rows.length, valid: rows.filter((item) => item.valid).length, publishable: rows.filter((item) => item.publishable).length }]));
  const notPublishableReasons = report.flatMap((item) => item.notPublishableReasons).reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});
  const output = { mode: 'dry-run', inputTotal: products.length, total: selectedProducts.length, valid: report.filter((item) => item.valid).length, publishable: report.filter((item) => item.publishable).length, platformSummary, notPublishableReasons };
  if (process.argv.includes('--verbose')) {
    output.details = selectedProducts.map((item, index) => {
      const { row } = normalize(item);
      return { index, id: row.external_id, platform: row.platform, valid: report[index].valid, publishable: report[index].publishable, imageUrls: row.images.map((image) => image.url), installments: row.installments_text, shipping: row.shipping_text, coupon: row.coupon_code, stockQuantity: row.stock_quantity, stockStatus: row.stock_status, linkStatus: row.link_status, expiresAt: row.expires_at, refreshDueAt: row.refresh_due_at };
    });
  }
  if (!summaryOnly) output.rejected = report.filter((item) => !item.valid);
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = report.some((item) => !item.valid) ? 1 : 0;
} else if (!baseUrl || !serviceKey) {
  console.error('Defina PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY apenas no ambiente local confiável.');
  process.exit(2);
}

if (dryRun) {
  // Validation-only mode deliberately makes no network requests or database writes.
} else {
const rejected = [];
let imported = 0;
const requestImport = async (body) => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/rpc/import_catalog_item`, {
    method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_item: body })
  });
  if (!response.ok) throw new Error(`import_catalog_item: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

for (const [index, item] of selectedProducts.entries()) {
  const { errors, row } = normalize(item);
  if (errors.length) { rejected.push({ index, id: get(item, 'id', 'external_id'), errors }); continue; }
  try {
    const isAvailable = row.stock_status === 'in_stock';
    await requestImport({ ...row, status: row.link_is_official && isAvailable ? 'published' : 'draft', link_status: row.link_is_official ? 'active' : 'broken', observed_at: item.offerObservedAt ?? item.offer_observed_at ?? item.observedAt ?? item.observed_at ?? new Date().toISOString() });
    imported++;
  } catch (error) { rejected.push({ index, id: row.external_id, errors: [String(error.message)] }); }
}
console.log(JSON.stringify({ input_total: products.length, selected_total: selectedProducts.length, imported, rejected_count: rejected.length, rejected }, null, 2));
if (rejected.length) process.exitCode = 1;
}
