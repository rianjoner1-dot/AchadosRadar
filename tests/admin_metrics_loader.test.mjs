import test from 'node:test';
import assert from 'node:assert/strict';
const { createAdminMetricsLoader } = await import('../src/modules/analytics/admin-metrics-loader.mjs');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('only the latest period request may render metrics', async () => {
  const firstResponse = deferred();
  const rendered = [];
  const loader = createAdminMetricsLoader({
    getSession: async () => ({ access_token: 'token' }),
    fetchMetrics: (_session, days) => days === '7' ? firstResponse.promise : Promise.resolve({ days: 30 }),
    onSuccess: (result) => rendered.push(result),
    onError: (error) => { throw error; }
  });

  const oldRequest = loader('7');
  await loader('30');
  firstResponse.resolve({ days: 7 });
  await oldRequest;

  assert.deepEqual(rendered, [{ days: 30 }]);
});

test('session lookup failures reach the error state instead of leaving the panel loading', async () => {
  const errors = [];
  const loader = createAdminMetricsLoader({
    getSession: async () => { throw new Error('Falha de rede'); },
    fetchMetrics: async () => assert.fail('metrics must not be fetched after a session failure'),
    onError: (error) => errors.push(error.message)
  });

  await loader('30');
  assert.deepEqual(errors, ['Falha de rede']);
});

test('missing session shows unauthenticated state and skips metrics request', async () => {
  let unauthenticated = 0;
  const loader = createAdminMetricsLoader({
    getSession: async () => null,
    fetchMetrics: async () => assert.fail('metrics must not be fetched without a session'),
    onUnauthenticated: () => { unauthenticated += 1; }
  });

  await loader('30');
  assert.equal(unauthenticated, 1);
});
