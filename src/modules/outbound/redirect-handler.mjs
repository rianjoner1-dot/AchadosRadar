import { evaluateAffiliateRedirect } from './redirect-policy.mjs';

const json = (status, message) => new Response(JSON.stringify({ message }), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export async function handleAffiliateRedirect({ id, url, key, fetchImpl = fetch, now = Date.now() }) {
  if (!id || !url || !key) return json(503, 'A loja ainda não está conectada ao catálogo.');
  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const read = async (table, query) => {
    const response = await fetchImpl(`${url}/rest/v1/${table}?${query}`, {
      headers,
      signal: AbortSignal.timeout(4500),
      cache: 'no-store'
    });
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
    const decision = evaluateAffiliateRedirect({ product, link: links[0], offer: offers[0], now });
    if (!decision.ready) return json(decision.status, decision.message);

    try {
      await fetchImpl(`${url}/rest/v1/rpc/record_product_metric`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ target_product_id: product.id, metric_kind: 'outbound_click' }),
        signal: AbortSignal.timeout(900)
      });
    } catch { /* Metrics must not block an otherwise valid marketplace redirect. */ }

    return new Response(null, {
      status: decision.status,
      headers: { location: decision.location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }
    });
  } catch {
    return json(503, 'Não foi possível validar esta oferta agora. O item continua salvo na sua lista.');
  }
}
