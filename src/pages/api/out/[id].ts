import type { APIRoute } from 'astro';
import { isAllowedAffiliateUrl } from '../../../modules/outbound/allowlist.mjs';
import { isFutureTimestamp, isRecentTimestamp } from '../../../modules/outbound/freshness.mjs';

export const prerender = false;
const json = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!id || !url || !key) return json(503, 'A loja ainda não está conectada ao catálogo.');
  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const read = async (table: string, query: URLSearchParams) => {
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers, signal: AbortSignal.timeout(4500), cache: 'no-store' });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return response.json();
  };
  try {
    const [products, links, offers] = await Promise.all([
      read('products', new URLSearchParams({ select: 'id,platform,status', id: `eq.${id}`, limit: '1' })),
      read('affiliate_links', new URLSearchParams({ select: 'affiliate_url,status,verified_at,expires_at,refresh_due_at', product_id: `eq.${id}`, limit: '1' })),
      read('offers', new URLSearchParams({ select: 'stock_status,observed_at', product_id: `eq.${id}`, order: 'observed_at.desc', limit: '1' }))
    ]);
    const product = products[0];
    const link = links[0];
    const offer = offers[0];
    if (!product || product.status !== 'published') return json(410, 'Produto indisponível. O item continua salvo na sua lista.');
    if (!link || link.status !== 'active') return json(410, 'Link em revisão. O item continua salvo na sua lista.');
    const now = Date.now();
    if (offer?.stock_status !== 'in_stock' || !isRecentTimestamp(offer?.observed_at, 48 * 60 * 60 * 1000, now)) {
      return json(409, 'O estoque precisa ser confirmado novamente. O item continua salvo na sua lista.');
    }
    if (!isAllowedAffiliateUrl(product.platform, link.affiliate_url) || !isRecentTimestamp(link.verified_at, 14 * 24 * 60 * 60 * 1000, now) || (link.refresh_due_at && !isFutureTimestamp(link.refresh_due_at, now))) {
      return json(410, 'Não foi possível confirmar o link afiliado atual. O item continua salvo na sua lista.');
    }
    const target = new URL(link.affiliate_url);
    if (link.expires_at && !isFutureTimestamp(link.expires_at, now)) return json(410, 'O link informado pela loja expirou. O item continua salvo na sua lista.');
    return new Response(null, { status: 302, headers: { location: target.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  } catch {
    return json(503, 'Não foi possível validar esta oferta agora. O item continua salvo na sua lista.');
  }
};
