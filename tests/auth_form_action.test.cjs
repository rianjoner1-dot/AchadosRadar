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

test('initial profile name is stored only after OTP send and recovered by matching email', () => {
  const otpSent = page.indexOf('const sent = await runAuthAction(() => client.auth.signInWithOtp');
  const pendingNameStored = page.indexOf('if (sent && accountName)');
  assert.ok(otpSent >= 0 && pendingNameStored > otpSent, 'the pending name must be stored only after the OTP request succeeds');
  assert.match(page, /storePendingAccountName\(lastEmail, accountName, sessionStorage\)/);
  assert.match(page, /readPendingAccountName\(accountEmail, sessionStorage\)/);
  assert.match(page, /clearPendingAccountName\(accountEmail, sessionStorage\)/);
  assert.match(page, /await persistInitialProfileName\([\s\S]*?profileClient\.from\('profiles'\)\.update\(\{ full_name: name \}\)[\s\S]*?\.select\('id'\)\.maybeSingle\(\)/);
});

test('profile save confirms that Supabase updated a profile row before showing success', () => {
  assert.match(page, /const \{ data: updatedProfile, error \} = await supabase\.from\('profiles'\)\.update\(patch\)\.eq\('id', user\.id\)\.select\('id'\)\.maybeSingle\(\)/);
  assert.match(page, /if \(!updatedProfile\?\.id\) throw new Error\('O perfil não foi encontrado para atualização\./);
  assert.match(page, /if \(avatarUrl\) \{[\s\S]*?clearSelectedAvatarPreview\(\)[\s\S]*?avatarPreview\.src = avatarUrl[\s\S]*?profileStatus\.textContent = 'Perfil atualizado\.'/);
});

test('avatar input gives immediate validation feedback on selection', () => {
  assert.match(page, /URL\.createObjectURL\(file\)/);
  assert.match(page, /Prévia da foto carregada\. Salve as alterações para atualizar seu perfil\./);
  assert.match(page, /URL\.revokeObjectURL\(selectedAvatarPreviewUrl\)/);
  assert.match(page, /Não foi possível abrir essa imagem\. Escolha outra foto\./);
  assert.match(page, /avatarFileName\.textContent = file\?\.name \?\? 'Nenhum arquivo selecionado'/);
  assert.match(page, /Escolha uma foto JPEG, PNG ou WebP com até 5 MB\./);
});
