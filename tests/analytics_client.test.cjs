const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/modules/analytics/client.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createAnalytics({ fetchImpl, storage = new Map() }) {
  const module = { exports: {} };
  const timeouts = [];
  const sessionStorage = {
    getItem(key) { if (storage instanceof Error) throw storage; return storage.get(key) ?? null; },
    setItem(key, value) { if (storage instanceof Error) throw storage; storage.set(key, value); }
  };
  const context = {
    module,
    exports: module.exports,
    Set,
    Promise,
    AbortSignal: { timeout(milliseconds) { timeouts.push(milliseconds); return { timeoutMs: milliseconds }; } },
    sessionStorage,
    fetch: fetchImpl,
    require(name) {
      if (name === '../shared/config') return { getPublicSupabaseConfig: () => ({ isReady: true, url: 'https://db.example', key: 'anon-test-key' }) };
      throw new Error(`Unexpected import: ${name}`);
    }
  };
  vm.runInNewContext(compiled, context, { filename: 'analytics-client.js' });
  return { client: module.exports, storage, timeouts };
}

const productId = '11111111-1111-4111-8111-111111111111';

test('H: product view is deduplicated per tab only after the RPC succeeds', async () => {
  const calls = [];
  const app = createAnalytics({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: calls.length > 1 };
  } });

  await app.client.recordProductView(productId);
  assert.equal(app.storage.has(`achados_radar_product_view:${productId}`), false, 'A failed RPC must remain retryable in this tab');
  await app.client.recordProductView(productId);
  await app.client.recordProductView(productId);
  assert.equal(calls.length, 2, 'The first successful RPC is marked and later views in the same tab are suppressed');
  assert.deepEqual(JSON.parse(calls[1].options.body), { target_product_id: productId, metric_kind: 'view' });
  assert.deepEqual(app.timeouts, [4000, 4000], 'each request has a finite timeout so a stalled RPC cannot remain in flight forever');
  assert.equal(calls[0].options.signal.timeoutMs, 4000);
});

test('H: concurrent product renders send at most one view RPC', async () => {
  let resolveRequest;
  let callCount = 0;
  const app = createAnalytics({ fetchImpl: () => {
    callCount += 1;
    return new Promise((resolve) => { resolveRequest = () => resolve({ ok: true }); });
  } });

  const first = app.client.recordProductView(productId);
  const second = app.client.recordProductView(productId);
  assert.equal(callCount, 1);
  resolveRequest();
  await Promise.all([first, second]);
  assert.equal(app.storage.has(`achados_radar_product_view:${productId}`), true);
});

test('H: analytics failures and invalid IDs never interrupt browsing or create requests', async () => {
  let callCount = 0;
  const app = createAnalytics({ storage: new Error('storage unavailable'), fetchImpl: async () => {
    callCount += 1;
    throw new Error('network unavailable');
  } });
  await assert.doesNotReject(app.client.recordProductView(productId));
  await assert.doesNotReject(app.client.recordProductView(productId));
  await app.client.recordProductView('not-a-product-id');
  assert.equal(callCount, 2, 'Unavailable storage degrades to best-effort analytics; invalid IDs are ignored');
});
