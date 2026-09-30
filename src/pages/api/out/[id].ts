import type { APIRoute } from 'astro';
import { evaluateAffiliateRedirect } from '../../../modules/outbound/redirect-policy.mjs';

export const prerender = false;
const json = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const GET: APIRoute = async ({ params }) => {
  if (import.meta.env.PUBLIC_CATALOG_DEMO === 'true') return json(503, 'Modo de demonstração: compras estão desativadas.');
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
    const decision = evaluateAffiliateRedirect({ product, link, offer });
    if (!decision.ready) return json(decision.status, decision.message);
    return new Response(null, { status: decision.status, headers: { location: decision.location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  } catch {
    return json(503, 'Não foi possível validar esta oferta agora. O item continua salvo na sua lista.');
  }
};
