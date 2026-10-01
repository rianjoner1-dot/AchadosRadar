const test = require('node:test');
const assert = require('node:assert/strict');

test('initial profile name waits for successful persistence before clearing its recovery hint', async () => {
  const { persistInitialProfileName } = await import('../src/modules/auth/persist-initial-profile-name.mjs');
  let resolveUpdate;
  let recoveryHintCleared = false;
  const updatePromise = new Promise((resolve) => { resolveUpdate = resolve; });

  const resultPromise = persistInitialProfileName(
    '  Rian Joner  ',
    async (name) => {
      assert.equal(name, 'Rian Joner');
      return updatePromise;
    },
    () => { recoveryHintCleared = true; }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(recoveryHintCleared, false);
  resolveUpdate({ data: { id: 'user-1' }, error: null });
  assert.deepEqual(await resultPromise, { saved: true, skipped: false });
  assert.equal(recoveryHintCleared, true);
});

test('initial profile name remains recoverable when persistence fails', async () => {
  const { persistInitialProfileName } = await import('../src/modules/auth/persist-initial-profile-name.mjs');
  let recoveryHintCleared = false;
  const error = new Error('temporary profile write failure');

  const result = await persistInitialProfileName(
    'Rian Joner',
    async () => ({ error }),
    () => { recoveryHintCleared = true; }
  );

  assert.deepEqual(result, { saved: false, error });
  assert.equal(recoveryHintCleared, false);
});

test('initial profile name remains recoverable when the profile request rejects', async () => {
  const { persistInitialProfileName } = await import('../src/modules/auth/persist-initial-profile-name.mjs');
  let recoveryHintCleared = false;
  const error = new Error('network unavailable');

  const result = await persistInitialProfileName(
    'Rian Joner',
    async () => { throw error; },
    () => { recoveryHintCleared = true; }
  );

  assert.deepEqual(result, { saved: false, error });
  assert.equal(recoveryHintCleared, false);
});

test('initial profile name remains recoverable when UPDATE matches no profile row', async () => {
  const { persistInitialProfileName } = await import('../src/modules/auth/persist-initial-profile-name.mjs');
  let recoveryHintCleared = false;

  const result = await persistInitialProfileName(
    'Rian Joner',
    async () => ({ data: null, error: null }),
    () => { recoveryHintCleared = true; }
  );

  assert.equal(result.saved, false);
  assert.match(result.error.message, /linha atualizável/);
  assert.equal(recoveryHintCleared, false);
});
