import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedMarketplaceImageUrl, isAllowedMarketplaceVideoUrl } from '../src/modules/shared/marketplace-image-url.mjs';
import { matchesMarketplaceProductIdentity } from '../src/modules/catalog/product-identity.mjs';
import { isAllowedAffiliateUrl } from '../src/modules/outbound/allowlist.mjs';
import { runCollectionPool } from './collection-pool.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const unavailableReportPath = process.env.CONFIRMED_UNAVAILABLE_REPORTS || path.resolve(process.env.LOCAL_CATALOG_BRIDGE_DATA || path.join(projectRoot, '..', 'produtos_coletados', 'confirmed_unavailable.json'));
if (!inputPath) {
  console.error('Uso: node scripts/import-catalog.mjs <catalogo.json> [--dry-run]');
  process.exit(2);
}

const allowedHosts = {
  mercadolivre: ['mercadolivre.com.br', 'produto.mercadolivre.com.br', 'mercadolivre.com', 'meli.la'],
  magalu: ['magazinevoce.com.br', 'magazineluiza.com.br', 'magalu.com.br', 'a-static.mlcdn.com.br', 'm.magazineluiza.com.br'],
  amazon: ['amazon.com.br', 'amazon.com', 'amzn.to'],
  shopee: ['shopee.com.br', 'shp.ee', 'shope.ee', 's.shopee.com.br'],
  kabum: ['kabum.com.br', 'awin1.com']
};
const exactAffiliateHosts = { mercadolivre: ['meli.la'], magalu: ['magazineluiza.onelink.me'] };
const unavailableEvidence = 'explicit_not_found_without_title_or_price';
const missingObservationTimestamp = '1970-01-01T00:00:00.000Z';
const get = (o, ...keys) => keys.map((key) => o?.[key]).find((value) => value !== undefined && value !== null);
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const toPrice = (value) => typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
const isUnavailableEvidence = (item) => {
  const platform = get(item, 'platform', 'marketplace', 'store');
  const externalId = text(get(item, 'external_id', 'externalId', 'id', 'productId'));
  const originalUrl = text(get(item, 'originalUrl', 'original_url', 'url', 'productUrl'));
  return item?.marketplaceUnavailable === true
    && (item.marketplaceUnavailableEvidence === unavailableEvidence || item.evidence === unavailableEvidence)
    && ['mercadolivre', 'magalu'].includes(platform)
    && Boolean(externalId)
    && matchesMarketplaceProductIdentity(platform, externalId, originalUrl);
};
function normalize(item) {
  const platform = get(item, 'platform', 'marketplace', 'store');
  const externalId = text(get(item, 'external_id', 'externalId', 'id', 'productId'));
  const title = text(get(item, 'title', 'name', 'nome'));
  const rawPixPrice = get(item, 'pixPrice', 'pix_price', 'precoPix');
  const price = toPrice(rawPixPrice ?? get(item, 'price', 'currentPrice', 'preco'));
  const rawRating = get(item, 'rating', 'ratingValue', 'rating_value');
  const rating = Number(rawRating);
  const rawReviewsCount = get(item, 'reviewsCount', 'reviews_count', 'reviewCount', 'review_count', 'ratingCount', 'rating_count');
  const reviewsCount = Number(rawReviewsCount);
  const originalUrl = text(get(item, 'originalUrl', 'original_url', 'url', 'productUrl'));
  const affiliateUrl = text(get(item, 'affiliateUrl', 'affiliate_url', 'shortLink', 'linkAfiliado'));
  const safeUrl = (candidate) => {
    if (!candidate) return null;
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.toLowerCase();
      const allowed = allowedHosts[platform]?.some((host) =>
        (exactAffiliateHosts[platform] ?? []).includes(host) ? hostname === host : hostname === host || hostname.endsWith(`.${host}`)
      );
      return parsed.protocol === 'https:' && !parsed.port && !parsed.username && !parsed.password && allowed ? parsed.href : null;
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
  if (original && externalId && ['magalu', 'mercadolivre'].includes(platform)
    && !matchesMarketplaceProductIdentity(platform, externalId, original)) {
    errors.push('id_externo_nao_corresponde_url_original');
  }
  const imagesRaw = get(item, 'images', 'photos', 'pictures', 'fotos') ?? [get(item, 'image', 'thumbnail', 'imagem')];
  const images = (Array.isArray(imagesRaw) ? imagesRaw : []).map((img) => typeof img === 'string' ? img : get(img, 'url', 'src'))
    .filter((url) => isAllowedMarketplaceImageUrl(platform, url))
    .slice(0, 3)
    .map((url, index) => ({ url, display_order: index, is_primary: index === 0 }));
  const videoUrls = get(item, 'videos', 'productVideos', 'product_videos');
  const videoPosters = get(item, 'videoPosters', 'video_posters') ?? [];
  const videos = (Array.isArray(videoUrls) ? videoUrls : []).map((video, index) => {
    const url = typeof video === 'string' ? video : get(video, 'url', 'src');
    const posterCandidate = typeof video === 'object' && video ? get(video, 'poster_url', 'posterUrl', 'poster') : videoPosters[index];
    const posterUrl = isAllowedMarketplaceImageUrl(platform, posterCandidate) ? posterCandidate : null;
    return isAllowedMarketplaceVideoUrl(platform, url) ? { url, poster_url: posterUrl } : null;
  }).filter(Boolean).slice(0, 1).map((video) => ({ ...video, display_order: 0 }));
  const rawSpecifications = get(item, 'specifications', 'specs', 'additionalProperty', 'additional_property');
  const specificationEntries = Array.isArray(rawSpecifications) ? rawSpecifications
    : rawSpecifications && typeof rawSpecifications === 'object'
      ? Object.entries(rawSpecifications).map(([name, value]) => ({ name, value })) : [];
  const specifications = specificationEntries.map((entry) => ({
    name: text(entry?.name ?? entry?.label)?.slice(0, 100) ?? null,
    value: text(entry?.value ?? entry?.valueText)?.slice(0, 300) ?? null
  })).filter((entry) => entry.name && entry.value && entry.name.toLowerCase() !== entry.value.toLowerCase()).slice(0, 18);
  if (!images.length) errors.push('foto_https_ausente');
  const macroStatus = get(item, 'linkStatus', 'link_status');
  const rawStockQuantity = get(item, 'stockQuantity', 'stock_quantity');
  const stockQuantity = Number.isSafeInteger(rawStockQuantity) && rawStockQuantity >= 0 ? rawStockQuantity : null;
  const rawStockStatus = get(item, 'stockStatus', 'stock_status');
  const stockStatus = ['in_stock', 'out_of_stock', 'unknown'].includes(rawStockStatus) ? rawStockStatus : 'unknown';
  // Link checks prove only the affiliate destination is reachable; only timestamps
  // from product/offer collection may freshness-gate price and stock.
  const rawObservedAt = get(item, 'offerObservedAt', 'offer_observed_at', 'observedAt', 'observed_at', 'collectedAt', 'collected_at');
  const parsedObservedAt = rawObservedAt ? new Date(rawObservedAt) : null;
  const hasTrustedObservationTime = parsedObservedAt instanceof Date
    && !Number.isNaN(parsedObservedAt.getTime())
    && parsedObservedAt.getTime() <= Date.now() + 5 * 60 * 1000;
  const observedAt = hasTrustedObservationTime ? parsedObservedAt.toISOString() : missingObservationTimestamp;
  const consistentStockStatus = stockStatus === 'in_stock' && (stockQuantity === 0 || !hasTrustedObservationTime) ? 'unknown' : stockStatus;
  const macroVerifiedAt = get(item, 'lastCheckedAt', 'linkVerifiedAt', 'verified_at');
  const officialFlag = get(item, 'isOfficialShortLink', 'linkReady', 'affiliateLinkVerified') === true;
  const storeAffiliateId = text(get(item, 'storeAffiliateId', 'store_affiliate_id'));
  const magaluOfficialUrl = platform === 'magalu' && Boolean(storeAffiliateId) && Boolean(affiliate) && (() => {
    const parsed = new URL(affiliate);
    const storeSlug = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return (parsed.hostname === 'magazinevoce.com.br' || parsed.hostname.endsWith('.magazinevoce.com.br'))
      && storeSlug === storeAffiliateId
      && matchesMarketplaceProductIdentity('magalu', externalId, affiliate);
  })();
  const mercadolivreOfficialUrl = Boolean(affiliate) && new URL(affiliate).hostname.endsWith('meli.la');
  const amazonOfficialUrl = Boolean(affiliate) && affiliate.includes('tag=');
  const shopeeOfficialUrl = Boolean(affiliate) && (affiliate.includes('shp.ee') || affiliate.includes('shope.ee') || affiliate.includes('s.shopee.com.br'));
  const verifiedDate = macroVerifiedAt ? new Date(macroVerifiedAt) : null;
  const isReadyStr = macroStatus === 'ready' || (platform === 'amazon' && macroStatus === 'pending_conversion');
  const linkIsReady = isReadyStr && verifiedDate instanceof Date && !Number.isNaN(verifiedDate.getTime()) && (
    platform === 'magalu' ? magaluOfficialUrl : 
    platform === 'amazon' ? amazonOfficialUrl :
    platform === 'shopee' ? shopeeOfficialUrl :
    platform === 'kabum' ? (officialFlag && isAllowedAffiliateUrl(platform, affiliate)) :
    (officialFlag && mercadolivreOfficialUrl)
  );
  return { errors, row: {
    platform, external_id: externalId, title, description: text(get(item, 'description', 'descriptionText', 'descricao')),
    category: text(get(item, 'category', 'categoria')), brand: text(get(item, 'brand', 'marca')),
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
    reviews_count: Number.isSafeInteger(reviewsCount) && reviewsCount >= 0 ? reviewsCount : null,
    specifications,
    price, pix_price: toPrice(rawPixPrice) || null,
    card_price: toPrice(get(item, 'cardPrice', 'card_price', 'precoCartao')) || null,
    old_price: toPrice(get(item, 'oldPrice', 'old_price', 'precoAnterior')) || null,
    installments_text: text(get(item, 'installments', 'installmentsText', 'parcelamento')),
    shipping_text: text(get(item, 'shipping', 'shippingText', 'frete')),
    coupon_code: text(get(item, 'coupon', 'couponText', 'cupom')),
    stock_quantity: stockQuantity,
    stock_status: consistentStockStatus,
    observed_at: observedAt,
    stock_evidence: text(get(item, 'stockEvidence', 'stock_evidence')) ?? '',
    seller_name: text(get(item, 'sellerName', 'seller_name', 'seller')) ?? 'Loja Parceira',
    seller_id: text(get(item, 'sellerId', 'seller_id')) ?? '', store_name: text(get(item, 'storeName', 'store_name')) ?? (platform === 'magalu' ? 'Magalu' : 'Mercado Livre'),
    store_affiliate_id: text(get(item, 'storeAffiliateId', 'store_affiliate_id')) ?? '', original_url: original,
    affiliate_url: affiliate, link_is_official: linkIsReady, link_status: linkIsReady ? 'active' : 'broken',
    verified_at: linkIsReady ? verifiedDate.toISOString() : null,
    refresh_due_at: get(item, 'refreshDueAt', 'refresh_due_at') ?? null,
    expires_at: get(item, 'linkExpiresAt', 'expires_at') ?? null,
    images, videos
  }};
}

const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const products = Array.isArray(payload) ? payload : Array.isArray(payload.products) ? payload.products : Array.isArray(payload.items) ? payload.items : null;
if (!products) throw new Error('JSON deve ser um array ou ter a propriedade products/items.');
let unavailableReports = Array.isArray(payload.confirmedUnavailable) ? payload.confirmedUnavailable : [];
if (unavailableReportPath !== inputPath) {
  try {
    const pending = JSON.parse(await fs.readFile(unavailableReportPath, 'utf8'));
    if (Array.isArray(pending)) {
      const merged = new Map(unavailableReports.map((report) => [`${get(report, 'platform', 'marketplace', 'store')}:${get(report, 'external_id', 'externalId', 'id', 'productId')}`, report]));
      for (const report of pending) merged.set(`${report.platform}:${report.externalId}`, report);
      unavailableReports = [...merged.values()];
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
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
  const rejectedReports = unavailableReports.filter((item) => !isUnavailableEvidence(item)).map((item) => ({ id: get(item, 'external_id', 'externalId', 'id', 'productId'), errors: ['evidencia_de_indisponibilidade_ausente_ou_invalida'] }));
  const report = selectedProducts.map((item, index) => {
    if (isUnavailableEvidence(item)) return { index, id: get(item, 'external_id', 'externalId', 'id', 'productId'), platform: get(item, 'platform', 'marketplace', 'store'), valid: true, publishable: false, archiveCandidate: true, errors: [], notPublishableReasons: ['indisponibilidade_confirmada_na_pagina_oficial'] };
    if (item?.marketplaceUnavailable === true) return { index, id: get(item, 'external_id', 'externalId', 'id', 'productId'), platform: get(item, 'platform', 'marketplace', 'store'), valid: false, publishable: false, errors: ['evidencia_de_indisponibilidade_ausente_ou_invalida'], notPublishableReasons: [] };
    const { errors, row } = normalize(item);
    const notPublishableReasons = [];
    if (!errors.length) {
      if (!row.link_is_official) notPublishableReasons.push('link_afiliado_nao_verificado');
      if (row.stock_status !== 'in_stock') notPublishableReasons.push(`estoque_${row.stock_status}`);
      if (row.observed_at === missingObservationTimestamp) notPublishableReasons.push('oferta_sem_horario_de_observacao');
    }
    return { index, id: row.external_id, platform: row.platform, valid: errors.length === 0, publishable: errors.length === 0 && notPublishableReasons.length === 0, errors, notPublishableReasons };
  });
  const summaryByPlatform = Object.groupBy ? Object.groupBy(report, (item) => String(item.platform ?? 'ausente')) : report.reduce((groups, item) => { (groups[item.platform ?? 'ausente'] ??= []).push(item); return groups; }, {});
  const platformSummary = Object.fromEntries(Object.entries(summaryByPlatform).map(([platform, rows]) => [platform, { total: rows.length, valid: rows.filter((item) => item.valid).length, publishable: rows.filter((item) => item.publishable).length }]));
  const notPublishableReasons = report.flatMap((item) => item.notPublishableReasons).reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});
  const output = { mode: 'dry-run', inputTotal: products.length, total: selectedProducts.length, valid: report.filter((item) => item.valid).length, publishable: report.filter((item) => item.publishable).length, archiveCandidates: report.filter((item) => item.archiveCandidate).length + unavailableReports.filter(isUnavailableEvidence).length, platformSummary, notPublishableReasons };
  if (process.argv.includes('--verbose')) {
    output.details = selectedProducts.map((item, index) => {
      if (isUnavailableEvidence(item)) return { index, id: get(item, 'external_id', 'externalId', 'id', 'productId'), platform: get(item, 'platform', 'marketplace', 'store'), archiveCandidate: true, evidence: unavailableEvidence };
      const { row } = normalize(item);
      return { index, id: row.external_id, platform: row.platform, valid: report[index].valid, publishable: report[index].publishable, imageUrls: row.images.map((image) => image.url), videos: row.videos, pixPrice: row.pix_price, cardPrice: row.card_price, installments: row.installments_text, shipping: row.shipping_text, coupon: row.coupon_code, stockQuantity: row.stock_quantity, stockStatus: row.stock_status, stockEvidence: row.stock_evidence, rating: row.rating, reviewsCount: row.reviews_count, specifications: row.specifications, offerObservedAt: row.observed_at, linkStatus: row.link_status, expiresAt: row.expires_at, refreshDueAt: row.refresh_due_at };
    });
  }
  if (!summaryOnly) output.rejected = [...report.filter((item) => !item.valid), ...rejectedReports];
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = report.some((item) => !item.valid) || rejectedReports.length > 0 ? 1 : 0;
} else if (!baseUrl || !serviceKey) {
  console.error('Defina PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY apenas no ambiente local confiável.');
  process.exit(2);
}

if (dryRun) {
  // Validation-only mode deliberately makes no network requests or database writes.
} else {
const rejected = [];
let imported = 0;
let archived = 0;
const requestImport = async (body) => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/rpc/import_catalog_item`, {
    method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_item: body }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`import_catalog_item: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};
const requestArchive = async (platform, externalId) => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/rpc/archive_unavailable_catalog_item`, {
    method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_platform: platform, p_external_id: externalId }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`archive_unavailable_catalog_item: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};
const isAlreadyArchived = async (platform, externalId) => {
  const params = new URLSearchParams({ select: 'status', platform: `eq.${platform}`, external_id: `eq.${externalId}`, limit: '1' });
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/products?${params}`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`verify_archived_product: HTTP ${response.status}`);
  const [product] = await response.json();
  return product?.status === 'archived';
};
const clearPendingReport = async (report) => {
  const key = `${get(report, 'platform', 'marketplace', 'store')}:${get(report, 'external_id', 'externalId', 'id', 'productId')}`;
  let pending = [];
  if (unavailableReportPath !== inputPath) {
    try { pending = JSON.parse(await fs.readFile(unavailableReportPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const filtered = (Array.isArray(pending) ? pending : []).filter((item) => `${item.platform}:${item.externalId}` !== key);
    await fs.writeFile(unavailableReportPath, `${JSON.stringify(filtered, null, 2)}\n`, 'utf8');
    return;
  }
  const catalogPayload = Array.isArray(payload) ? { products } : payload;
  catalogPayload.confirmedUnavailable = (catalogPayload.confirmedUnavailable || []).filter((item) => `${item.platform}:${item.externalId}` !== key);
  await fs.writeFile(inputPath, `${JSON.stringify(catalogPayload, null, 2)}\n`, 'utf8');
};

for (const report of dryRun ? [] : unavailableReports) {
  if (!isUnavailableEvidence(report)) {
    rejected.push({ id: get(report, 'external_id', 'externalId', 'id', 'productId'), errors: ['evidencia_de_indisponibilidade_ausente_ou_invalida'] });
    continue;
  }
  try {
    const archivedResult = await requestArchive(get(report, 'platform', 'marketplace', 'store'), text(get(report, 'external_id', 'externalId', 'id', 'productId')));
    if (archivedResult === false && !(await isAlreadyArchived(get(report, 'platform', 'marketplace', 'store'), text(get(report, 'external_id', 'externalId', 'id', 'productId'))))) {
      throw new Error('Produto não encontrado ou não arquivado no catálogo.');
    }
    archived++;
    await clearPendingReport(report);
    report.archivedAt = new Date().toISOString();
  } catch (error) { rejected.push({ id: get(report, 'external_id', 'externalId', 'id', 'productId'), errors: [String(error.message)] }); }
}

async function importItem(item, index) {
  if (item?.marketplaceUnavailable === true) {
    const platform = get(item, 'platform', 'marketplace', 'store');
    const externalId = text(get(item, 'external_id', 'externalId', 'id', 'productId'));
    if (!isUnavailableEvidence(item)) { rejected.push({ index, id: externalId, errors: ['evidencia_de_indisponibilidade_ausente_ou_invalida'] }); return; }
    try { await requestArchive(platform, externalId); archived++; }
    catch (error) { rejected.push({ index, id: externalId, errors: [String(error.message)] }); }
    return;
  }
  const { errors, row } = normalize(item);
  if (errors.length) { rejected.push({ index, id: get(item, 'id', 'external_id'), errors }); return; }
  try {
    const isAvailable = row.stock_status === 'in_stock';
    await requestImport({ ...row, status: row.link_is_official && isAvailable ? 'published' : 'draft', link_status: row.link_is_official ? 'active' : 'broken' });
    imported++;
  } catch (error) { rejected.push({ index, id: row.external_id, errors: [String(error.message)] }); }
}
const concurrencyArg = process.argv.find(arg => arg.startsWith('--concurrency='));
await runCollectionPool(selectedProducts, Number(concurrencyArg?.split('=')[1] ?? 4), importItem, result => {
  if (!result.ok) rejected.push({ index:result.index, errors:[result.error] });
});
console.log(JSON.stringify({ input_total: products.length, selected_total: selectedProducts.length, imported, archived, rejected_count: rejected.length, rejected }, null, 2));
if (rejected.length) process.exitCode = 1;
}
