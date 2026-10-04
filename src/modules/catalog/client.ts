export { normalizeSearch } from './search-utils.js';

export interface CatalogOffer {
  price: number;
  pix_price?: number | null;
  card_price?: number | null;
  old_price?: number | null;
  installments_text?: string | null;
  shipping_text?: string | null;
  coupon_code?: string | null;
  stock_quantity?: number | null;
  stock_status?: 'in_stock' | 'out_of_stock' | 'unknown';
  seller_name?: string;
  store_name?: string;
  observed_at?: string;
}

export interface CatalogProduct {
  id: string;
  platform: 'mercadolivre' | 'magalu' | 'amazon' | 'shopee' | 'benoit' | 'kabum';
  external_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  specifications?: { name: string; value: string }[];
  created_at: string;
  images: { url: string; display_order: number; original_url?: string }[];
  videos?: { url: string; poster_url?: string | null; display_order: number }[];
  offer: CatalogOffer | null;
  affiliate_link: { status: string; expires_at?: string | null; refresh_due_at?: string | null; verified_at?: string } | null;
  sectors?: string[];
  search_score?: number;
}

async function loadOfferPriceExtras(productIds: string[], signal?: AbortSignal) {
  const extras = new Map<string, { pix_price?: number | null; card_price?: number | null }>();
  if (!productIds.length) return extras;
  const params = new URLSearchParams({ select: 'product_id,pix_price,card_price', product_id: `in.(${productIds.join(',')})`, order: 'observed_at.desc' });
  try {
    const response = await fetch(`${config.url}/rest/v1/offers?${params}`, { headers: headers(), signal });
    if (!response.ok) return extras; // Mantém o catálogo funcional durante a aplicação da migration.
    for (const offer of await response.json()) if (!extras.has(offer.product_id)) extras.set(offer.product_id, offer);
  } catch { /* os campos complementares são opcionais até a migration remota */ }
  return extras;
}

import { getPublicSupabaseConfig } from '../shared/config';
import { canReportCatalogImageFailure, markCatalogImageFailureReport } from './image-health.js';
import { sanitizeCatalogProductImages } from './image-identity.mjs';
import { buildCatalogSearchRequest } from './search-request.js';

const supabaseConfig = getPublicSupabaseConfig();
const config = {
  url: supabaseConfig.url,
  key: supabaseConfig.key
};

export const catalogReady = supabaseConfig.isReady;
const imageFailureReports = new Map<string, number>();

function sanitizeProductImages<T extends CatalogProduct>(product: T): T {
  return sanitizeCatalogProductImages(product, (productId, imageUrl) => {
    void reportCatalogImageFailure(productId, imageUrl);
  }) as T;
}

function headers(token?: string): HeadersInit {
  return {
    apikey: config.key ?? '',
    authorization: `Bearer ${token ?? config.key ?? ''}`,
    'content-type': 'application/json'
  };
}

export async function searchCatalog(input: {
  q?: string; platform?: string; min?: number; max?: number; sort?: string; sector?: string;
  cursor?: { created_at: string; id: string; price?: number | null; score?: number | null } | null; limit?: number; signal?: AbortSignal;
}): Promise<CatalogProduct[]> {
  if (!catalogReady) throw new Error('Catálogo remoto ainda não configurado.');
  const response = await fetch(`${config.url}/rest/v1/rpc/search_catalog_v2`, {
    method: 'POST', headers: headers(), signal: input.signal,
    body: JSON.stringify(buildCatalogSearchRequest(input))
  });
  if (!response.ok) throw new Error(`Falha ao buscar catálogo (${response.status}).`);
  const products = await response.json();
  if (!Array.isArray(products)) throw new Error('Resposta invÃ¡lida ao buscar catÃ¡logo.');
  const extras = await loadOfferPriceExtras(products.map((product) => product.id), input.signal);
  const sanitized = products.map((product) => sanitizeProductImages({
    ...product,
    offer: product.offer ? { ...product.offer, ...(extras.get(product.id) ?? {}) } : product.offer
  }));
  return sanitized.filter((product) => {
    if (!product.images || !Array.isArray(product.images) || product.images.length === 0) return false;
    return product.images.some((img: { url: string }) => typeof img?.url === 'string' && img.url.trim() !== '' && !img.url.includes('placeholder'));
  });
}

export async function getCatalogProduct(id: string, signal?: AbortSignal): Promise<CatalogProduct | null> {
  if (!catalogReady) return null;
  const params = new URLSearchParams({ select: 'id,platform,external_id,title,description,created_at' , id: `eq.${id}`, status: 'eq.published', limit: '1' });
  const response = await fetch(`${config.url}/rest/v1/products?${params}`, { headers: headers(), signal });
  if (!response.ok) throw new Error(`Falha ao carregar produto (${response.status}).`);
  const [product] = await response.json();
  if (!product) return null;
  const relation = new URLSearchParams({ select: 'price,old_price,installments_text,shipping_text,coupon_code,stock_quantity,stock_status,seller_name,store_name,observed_at', product_id: `eq.${id}`, order: 'observed_at.desc', limit: '1' });
  const metadataQuery = new URLSearchParams({ select: 'rating,reviews_count,specifications', id: `eq.${id}`, status: 'eq.published', limit: '1' });
  const [imagesResponse, offersResponse, linkResponse, videosResponse, metadataResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/product_images?${new URLSearchParams({ select: 'url,display_order', product_id: `eq.${id}`, order: 'display_order.asc' })}`, { headers: headers(), signal }),
    fetch(`${config.url}/rest/v1/offers?${relation}`, { headers: headers(), signal }),
    fetch(`${config.url}/rest/v1/rpc/get_public_link_state`, { method: 'POST', headers: headers(), body: JSON.stringify({ target_product_id: id }), signal }),
    fetch(`${config.url}/rest/v1/product_videos?${new URLSearchParams({ select: 'url,poster_url,display_order', product_id: `eq.${id}`, order: 'display_order.asc', limit: '1' })}`, { headers: headers(), signal }).catch(() => null),
    fetch(`${config.url}/rest/v1/products?${metadataQuery}`, { headers: headers(), signal }).catch(() => null)
  ]);
  if (![imagesResponse, offersResponse, linkResponse].every((result) => result.ok)) throw new Error('Não foi possível carregar todos os dados da oferta.');
  const [images, offers, link, videos, extras, metadataRows] = await Promise.all([
    imagesResponse.json(), offersResponse.json(), linkResponse.json(),
    videosResponse?.ok ? videosResponse.json() : Promise.resolve([]),
    loadOfferPriceExtras([id], signal),
    metadataResponse?.ok ? metadataResponse.json() : Promise.resolve([])
  ]);
  const offer = offers[0] ? { ...offers[0], ...(extras.get(id) ?? {}) } : null;
  const [metadata] = Array.isArray(metadataRows) ? metadataRows : [];
  const sanitized = sanitizeProductImages({ ...product, ...(metadata ?? {}), images, videos, offer, affiliate_link: link ?? null });
  if (!sanitized.images || !sanitized.images.length || sanitized.images.every((img: { url: string }) => !img?.url || img.url.includes('placeholder'))) {
    return null;
  }
  return sanitized;
}

export async function reportCatalogImageFailure(productId: string, imageUrl: string): Promise<void> {
  if (!catalogReady || !productId || !imageUrl) return;
  const key = `${productId}:${imageUrl}`;
  if (!canReportCatalogImageFailure(imageFailureReports, key)) return;
  imageFailureReports.set(key, Number.POSITIVE_INFINITY);
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/report_product_image_failure`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ target_product_id: productId, target_image_url: imageUrl }),
      signal: AbortSignal.timeout(4000)
    });
    const accepted = response.ok && await response.json().then((value) => value === true).catch(() => false);
    markCatalogImageFailureReport(imageFailureReports, key, accepted);
  } catch {
    markCatalogImageFailureReport(imageFailureReports, key, false);
  }
}

export function formatPrice(value?: number | null): string {
  return typeof value === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'Consulte na loja';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function logSearchTermAsync(query?: string, sector?: string) {
  const term = query?.trim().replace(/\s+/g, ' ').slice(0, 100) ?? '';
  if (!catalogReady || term.length < 2 || /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|https?:\/\/|\d{8,}|(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}/i.test(term)) return;
  fetch(`${config.url}/rest/v1/rpc/log_search_term`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query: term, sector: sector || null }),
    signal: AbortSignal.timeout(2500)
  }).catch(() => { /* falha silenciosa, apenas log */ });
}
