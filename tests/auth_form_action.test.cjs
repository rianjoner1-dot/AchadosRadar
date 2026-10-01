const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '../src/pages/conta.astro'), 'utf8');

test('auth action wrapper resolves success, returned errors and rejected network requests', async () => {
  const { runAuthAction } = await import('../src/modules/auth/run-action.mjs');
  assert.equal(await runAuthAction(async () => ({ error: null })), true);
  assert.equal(await runAuthAction(async () => ({ error: new Error('invalid credentials') })), false);
  assert.equal(await runAuthAction(async () => { throw new TypeError('network offline'); }), false);
});

test('account login and OTP flows use the wrapper so network errors reach a final status', () => {
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.signInWithOtp/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.signInWithPassword/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.verifyOtp/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.resetPasswordForEmail/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.updateUser/);
});

test('account deletion preserves local data when session lookup or network confirmation fails', () => {
  assert.match(page, /const result = await client\.auth\.getSession\(\);\s*if \(result\.error\) throw result\.error/);
  assert.match(page, /catch \{ profileStatus\.textContent = 'Não foi possível confirmar a sessão/);
  assert.match(page, /catch \{ profileStatus\.textContent = 'Não foi possível confirmar a exclusão por falha de conexão/);
  assert.match(page, /if \(!response\.ok\)[\s\S]*?return;\s*\}\s*deleteLocalCartForUser\(session\.user\.id\)/);
});
