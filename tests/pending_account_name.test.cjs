const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test('pending signup names are scoped to the normalized email address', async () => {
  const { storePendingAccountName, readPendingAccountName } = await import('../src/modules/auth/pending-account-name.mjs');
  const storage = createStorage();

  assert.equal(storePendingAccountName(' First@Example.com ', ' Nome da Primeira ', storage), true);
  assert.equal(readPendingAccountName('first@example.com', storage), 'Nome da Primeira');
  assert.equal(readPendingAccountName('second@example.com', storage), '');
});

test('pending signup requests for two accounts coexist without name crossover', async () => {
  const { storePendingAccountName, readPendingAccountName } = await import('../src/modules/auth/pending-account-name.mjs');
  const storage = createStorage();

  storePendingAccountName('a@example.com', 'Conta A', storage);
  storePendingAccountName('b@example.com', 'Conta B', storage);

  assert.equal(readPendingAccountName('a@example.com', storage), 'Conta A');
  assert.equal(readPendingAccountName('b@example.com', storage), 'Conta B');
});

test('clearing one confirmed account keeps other pending names intact', async () => {
  const { storePendingAccountName, readPendingAccountName, clearPendingAccountName } = await import('../src/modules/auth/pending-account-name.mjs');
  const storage = createStorage();

  storePendingAccountName('a@example.com', 'Conta A', storage);
  storePendingAccountName('b@example.com', 'Conta B', storage);
  assert.equal(clearPendingAccountName('a@example.com', storage), true);

  assert.equal(readPendingAccountName('a@example.com', storage), '');
  assert.equal(readPendingAccountName('b@example.com', storage), 'Conta B');
});

test('pending account name rejects invalid inputs and safely ignores malformed storage', async () => {
  const { storePendingAccountName, readPendingAccountName, clearPendingAccountName } = await import('../src/modules/auth/pending-account-name.mjs');
  const storage = createStorage();

  assert.equal(storePendingAccountName('invalid-email', 'Nome Válido', storage), false);
  assert.equal(storePendingAccountName('a@example.com', 'A', storage), false);
  assert.equal(storePendingAccountName('a@example.com', 'x'.repeat(81), storage), false);
  storage.setItem('pending_account_names', '{malformed');
  assert.equal(readPendingAccountName('a@example.com', storage), '');
  assert.equal(clearPendingAccountName('a@example.com', storage), true);
});
