export { normalizeSearch } from './search-utils.js';

export interface CatalogOffer {
  price: number;
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
  platform: 'mercadolivre' | 'magalu';
  external_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  created_at: string;
  images: { url: string; display_order: number; original_url?: string }[];
  offer: CatalogOffer | null;
  affiliate_link: { status: string; expires_at?: string | null; refresh_due_at?: string | null; verified_at?: string } | null;
  sectors?: string[];
  search_score?: number;
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
  return products.map((product) => sanitizeProductImages(product));
}

export async function getCatalogProduct(id: string, signal?: AbortSignal): Promise<CatalogProduct | null> {
  if (!catalogReady) return null;
  const params = new URLSearchParams({ select: 'id,platform,external_id,title,description,created_at' , id: `eq.${id}`, status: 'eq.published', limit: '1' });
  const response = await fetch(`${config.url}/rest/v1/products?${params}`, { headers: headers(), signal });
  if (!response.ok) throw new Error(`Falha ao carregar produto (${response.status}).`);
  const [product] = await response.json();
  if (!product) return null;
  const relation = new URLSearchParams({ select: 'price,old_price,installments_text,shipping_text,coupon_code,stock_quantity,stock_status,seller_name,store_name,observed_at', product_id: `eq.${id}`, order: 'observed_at.desc', limit: '1' });
  const [imagesResponse, offersResponse, linkResponse] = await Promise.all([
    fetch(`${config.url}/rest/v1/product_images?${new URLSearchParams({ select: 'url,display_order', product_id: `eq.${id}`, order: 'display_order.asc' })}`, { headers: headers(), signal }),
    fetch(`${config.url}/rest/v1/offers?${relation}`, { headers: headers(), signal }),
    fetch(`${config.url}/rest/v1/rpc/get_public_link_state`, { method: 'POST', headers: headers(), body: JSON.stringify({ target_product_id: id }), signal })
  ]);
  if (![imagesResponse, offersResponse, linkResponse].every((result) => result.ok)) throw new Error('Não foi possível carregar todos os dados da oferta.');
  const [images, offers, link] = await Promise.all([imagesResponse.json(), offersResponse.json(), linkResponse.json()]);
  return sanitizeProductImages({ ...product, images, offer: offers[0] ?? null, affiliate_link: link ?? null });
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
  if (!catalogReady || !query?.trim()) return;
  fetch(`${config.url}/rest/v1/rpc/log_search_term`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ query: query.trim(), sector: sector || null })
  }).catch(() => { /* falha silenciosa, apenas log */ });
}
