const test = require('node:test');
const assert = require('node:assert/strict');
const { handleAffiliateRedirect } = require('../src/modules/outbound/redirect-handler.mjs');

const now = Date.parse('2026-09-30T12:00:00.000Z');
const product = { id: 'product-1', platform: 'mercadolivre', status: 'published' };
const link = {
  affiliate_url: 'https://meli.la/AbC123', status: 'active',
  verified_at: '2026-09-29T12:00:00.000Z', refresh_due_at: '2026-10-01T12:00:00.000Z',
  expires_at: '2026-10-03T12:00:00.000Z'
};
const offer = { stock_status: 'in_stock', observed_at: '2026-09-30T11:00:00.000Z' };

function makeFetch({ productRow = product, linkRow = link, offerRow = offer, metric = () => new Response('true'), readFailure = false } = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    calls.push({ input: String(input), options });
    if (String(input).includes('/rpc/record_product_metric')) return metric();
    if (readFailure) return new Response('failure', { status: 503 });
    if (String(input).includes('/products?')) return Response.json(productRow ? [productRow] : []);
    if (String(input).includes('/affiliate_links?')) return Response.json(linkRow ? [linkRow] : []);
    if (String(input).includes('/offers?')) return Response.json(offerRow ? [offerRow] : []);
    throw new Error(`Unexpected request: ${input}`);
  };
  return { fetchImpl, calls };
}

test('H1: successful item redirect is no-store, hides referrer, and records an outbound click', async () => {
  const { fetchImpl, calls } = makeFetch();
  const response = await handleAffiliateRedirect({ id: product.id, url: 'https://db.example', key: 'anon', fetchImpl, now });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), link.affiliate_url);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const metricCall = calls.find(({ input }) => input.includes('/rpc/record_product_metric'));
  assert.ok(metricCall);
  assert.deepEqual(JSON.parse(metricCall.options.body), { target_product_id: product.id, metric_kind: 'outbound_click' });
  assert.equal(calls.some(({ input }) => input.includes('/cart_items')), false, 'leaving for the marketplace must not remove or mutate saved cart items');
});

test('H1.4: each marketplace product redirects to its own affiliate URL and records its own product ID', async () => {
  const cases = [
    {
      productRow: { id: 'ml-item-1', platform: 'mercadolivre', status: 'published' },
      linkRow: { ...link, affiliate_url: 'https://meli.la/MlOne' }
    },
    {
      productRow: { id: 'magalu-item-2', platform: 'magalu', status: 'published' },
      linkRow: { ...link, affiliate_url: 'https://www.magazinevoce.com.br/loja/p/MgTwo' }
    }
  ];
  for (const { productRow, linkRow } of cases) {
    const { fetchImpl, calls } = makeFetch({ productRow, linkRow });
    const response = await handleAffiliateRedirect({ id: productRow.id, url: 'https://db.example', key: 'anon', fetchImpl, now });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), linkRow.affiliate_url);
    const productRead = calls.find(({ input }) => input.includes('/products?'));
    assert.equal(new URL(productRead.input).searchParams.get('id'), `eq.${productRow.id}`);
    const metricCall = calls.find(({ input }) => input.includes('/rpc/record_product_metric'));
    assert.deepEqual(JSON.parse(metricCall.options.body), { target_product_id: productRow.id, metric_kind: 'outbound_click' });
  }
});

test('H1: metric failure does not block a valid purchase redirect', async () => {
  const { fetchImpl } = makeFetch({ metric: () => new Response('denied', { status: 403 }) });
  const response = await handleAffiliateRedirect({ id: product.id, url: 'https://db.example', key: 'anon', fetchImpl, now });
  assert.equal(response.status, 302);
});

test('H1: invalid product or stale inventory is blocked without recording a click', async () => {
  for (const setup of [
    { productRow: { ...product, status: 'archived' } },
    { offerRow: { ...offer, stock_status: 'unknown' } }
  ]) {
    const { fetchImpl, calls } = makeFetch(setup);
    const response = await handleAffiliateRedirect({ id: product.id, url: 'https://db.example', key: 'anon', fetchImpl, now });
    assert.notEqual(response.status, 302);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls.some(({ input }) => input.includes('/rpc/record_product_metric')), false);
  }
});

test('H1: catalog read failures return a private 503 without redirecting', async () => {
  const { fetchImpl } = makeFetch({ readFailure: true });
  const response = await handleAffiliateRedirect({ id: product.id, url: 'https://db.example', key: 'anon', fetchImpl, now });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
