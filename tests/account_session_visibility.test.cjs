const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '../src/pages/conta.astro'), 'utf8');

test('G1: profile stays hidden until the server validates a session', () => {
  assert.match(page, /<section id="profilePanel" class="account-panel" hidden>/);
  assert.match(page, /currentUser\(\)/);
  assert.match(page, /login\.hidden = true; profile\.hidden = true;[\s\S]*?Confirmando sessão/);
  assert.match(page, /catch \{\s*if \(version !== sessionRenderVersion\) return;\s*renderedUserId = null;\s*login\.hidden = false;\s*profile\.hidden = true;\s*clearPrivateProfile\(\);\s*status\.textContent = 'Não foi possível confirmar a sessão/);
});

test('G1.7/G1.9: stale auth failures cannot hide a newer profile and current failures clear private fields', () => {
  assert.match(page, /catch \{\s*if \(version !== sessionRenderVersion\) return;\s*renderedUserId = null;[\s\S]*?clearPrivateProfile\(\);/);
  assert.match(page, /function clearPrivateProfile\(\)[\s\S]*?#displayName[\s\S]*?#phoneNumber[\s\S]*?#avatarPreview[\s\S]*?#adminPanelLink[\s\S]*?#accountEmail/);
});

test('G1.10: local account cart is deleted only after the server confirms account deletion', () => {
  assert.match(page, /import \{ deleteLocalCartForUser, setCartOwner \} from '\.\.\/modules\/cart\/store'/);
  assert.match(page, /if \(!response\.ok\)[\s\S]*?return;\s*\}\s*deleteLocalCartForUser\(session\.user\.id\);\s*await runAuthAction\(\(\) => client\.auth\.signOut/);
});
