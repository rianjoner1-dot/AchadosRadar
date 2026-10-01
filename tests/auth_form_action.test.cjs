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
  assert.match(page, /id="newAccountName" type="text" autocomplete="name" maxlength="80"/);
  assert.match(page, /buildOtpOptions\(location\.origin, accountName\)/);
  assert.match(page, /data\?\.full_name\s*\? `Olá, \$\{data\.full_name\}!`/);
  assert.match(page, /#profileGreeting/);
  assert.match(page, /Clique para adicionar uma foto/);
  assert.match(page, /<svg class="upload-icon"[^>]+aria-hidden="true"/);
  assert.match(page, /<input id="avatarFile" class="avatar-file-input" type="file"/);
  assert.match(page, /avatarFileInput\.addEventListener\('change'/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.signInWithOtp/);
  assert.match(page, /Enviar link de acesso/);
  assert.match(page, /Abra o link recebido por email neste navegador/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.signInWithPassword/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.verifyOtp/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.resetPasswordForEmail/);
  assert.match(page, /resetPasswordForEmail\(email, \{ redirectTo: `\$\{location\.origin\}\/conta` \}\)/);
  assert.match(page, /event === 'PASSWORD_RECOVERY'[\s\S]*?recoveryForm\.hidden = false/);
  assert.match(page, /runAuthAction\(\(\) => client\.auth\.updateUser/);
});

test('new passwordless accounts receive the optional profile name as auth metadata', async () => {
  const { buildOtpOptions } = await import('../src/modules/auth/otp-options.mjs');
  assert.deepEqual(buildOtpOptions('https://achadosradar.vercel.app', '  Rian Joner  '), {
    shouldCreateUser: true,
    emailRedirectTo: 'https://achadosradar.vercel.app/conta',
    data: { full_name: 'Rian Joner' }
  });
  assert.equal(buildOtpOptions('http://localhost:4324', '').emailRedirectTo, 'http://localhost:4324/conta');
  assert.deepEqual(buildOtpOptions('https://achadosradar.vercel.app', ''), {
    shouldCreateUser: true,
    emailRedirectTo: 'https://achadosradar.vercel.app/conta'
  });
});

test('account deletion preserves local data when session lookup or network confirmation fails', () => {
  assert.match(page, /const result = await client\.auth\.getSession\(\);\s*if \(result\.error\) throw result\.error/);
  assert.match(page, /catch \{ profileStatus\.textContent = 'Não foi possível confirmar a sessão/);
  assert.match(page, /catch \{ profileStatus\.textContent = 'Não foi possível confirmar a exclusão por falha de conexão/);
  assert.match(page, /if \(!response\.ok\)[\s\S]*?return;\s*\}\s*deleteLocalCartForUser\(session\.user\.id\)/);
});

test('confirmed account session clears tokens and callback parameters from the address bar', () => {
  assert.match(page, /window\.location\.search \|\| window\.location\.hash/);
  assert.match(page, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/);
});
