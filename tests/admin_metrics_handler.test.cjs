const test = require('node:test');
const assert = require('node:assert/strict');
const { handleAdminMetrics } = require('../src/modules/analytics/admin-metrics-handler.mjs');

const url = 'https://database.example';
const key = 'public-anon-key';
const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const metricPayload = { days: 7, totals: { views: 0, outboundClicks: 0 }, mostViewedProducts: [], mostClickedProducts: [] };

function makeRequest(path = '/api/admin/metrics?days=7', headers = {}) {
  return new Request(`https://site.example${path}`, { headers });
}

function makeFetch({ authStatus = 200, user = { id: userId }, metricsStatus = 200, metrics = metricPayload } = {}) {
  const calls = [];
  const fetchImpl = async (input, options) => {
    calls.push({ input: String(input), options });
    if (String(input).endsWith('/auth/v1/user')) return Response.json(user, { status: authStatus });
    return Response.json(metrics, { status: metricsStatus });
  };
  return { fetchImpl, calls };
}

test('admin metrics rejects a visitor before calling Supabase and never caches the response', async () => {
  const { fetchImpl, calls } = makeFetch();
  const response = await handleAdminMetrics({ request: makeRequest(), url, key, isDemo: false, fetchImpl });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('admin metrics verifies the session, forwards only allowed periods and delegates role authorization to the RPC', async () => {
  const { fetchImpl, calls } = makeFetch({ metricsStatus: 403 });
  const response = await handleAdminMetrics({
    request: makeRequest('/api/admin/metrics?days=90', { authorization: 'Bearer opaque-access-token' }), url, key, isDemo: false, fetchImpl
  });
  assert.equal(response.status, 403);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.authorization, 'Bearer opaque-access-token');
  assert.equal(calls[1].options.headers.authorization, 'Bearer opaque-access-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), { days_back: 90 });
  assert.equal(calls[1].options.cache, 'no-store');
});

test('admin metrics defaults unsupported periods and returns aggregate RPC data', async () => {
  const { fetchImpl, calls } = makeFetch();
  const response = await handleAdminMetrics({
    request: makeRequest('/api/admin/metrics?days=365', { authorization: 'Bearer valid-session' }), url, key, isDemo: false, fetchImpl
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), metricPayload);
  assert.deepEqual(JSON.parse(calls[1].options.body), { days_back: 30 });
});

test('admin metrics rejects malformed session identities and fails closed on auth or RPC outages', async () => {
  for (const { options, status } of [
    { options: { user: { id: 'aaaaaaaa-aaaa-g000-0000-000000000000' } }, status: 401 },
    { options: { authStatus: 401 }, status: 401 },
    { options: { metricsStatus: 500 }, status: 503 }
  ]) {
    const { fetchImpl } = makeFetch(options);
    const response = await handleAdminMetrics({
      request: makeRequest('/api/admin/metrics', { authorization: 'Bearer session' }), url, key, isDemo: false, fetchImpl
    });
    assert.equal(response.status, status);
  }
});
