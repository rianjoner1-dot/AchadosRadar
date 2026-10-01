const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const storeSource = fs.readFileSync(path.join(__dirname, '../src/modules/cart/store.ts'), 'utf8');
const storeJavaScript = ts.transpileModule(storeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createCartStore(initialEntries = []) {
  const values = new Map(initialEntries);
  const events = [];
  const module = { exports: {} };
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const context = {
    module,
    exports: module.exports,
    localStorage: storage,
    document: {
      dispatchEvent(event) { events.push(event); },
      getElementById() { return null; }
    },
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    Date,
    JSON,
    String
  };
  vm.runInNewContext(storeJavaScript, context, { filename: 'cart-store.js' });
  return { store: module.exports, storage, values, events };
}

function item(id, title = `Produto ${id}`) {
  return { id, platform: 'magalu', title, price: 99.9, priceFormatted: 'R$ 99,90', image: '' };
}

test('G1.5: local cart survives reload and does not duplicate the same product', () => {
  const firstPage = createCartStore();
  assert.equal(firstPage.store.saveCartItem(item('product-1')), true);
  assert.equal(firstPage.store.saveCartItem(item('product-2')), true);
  assert.equal(firstPage.store.saveCartItem({ ...item('product-1', 'Título atualizado'), price: 159.9 }), false);

  const afterReload = createCartStore([...firstPage.values]);
  const saved = afterReload.store.readLocalCart();
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, 'product-1');
  assert.equal(saved[0].title, 'Produto product-1');
  assert.equal(saved[0].price, 99.9);
  assert.equal(saved[1].id, 'product-2');
  assert.equal(Number.isFinite(Date.parse(saved[0].savedAt)), true);
});

test('G1.7: guest cart and separate account carts stay isolated when owner changes', () => {
  const app = createCartStore();
  assert.equal(app.store.saveCartItem(item('guest-item')), true);

  app.storage.setItem('achados_radar_cart_owner', 'user-a');
  assert.deepEqual(app.store.readLocalCart(), []);
  assert.equal(app.store.saveCartItem(item('user-a-item')), true);

  app.storage.setItem('achados_radar_cart_owner', 'user-b');
  assert.deepEqual(app.store.readLocalCart(), []);
  assert.equal(app.store.saveCartItem(item('user-b-item')), true);

  app.storage.setItem('achados_radar_cart_owner', 'user-a');
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['user-a-item']);
  assert.deepEqual(JSON.parse(app.values.get('achados_radar_cart')).map(({ id }) => id), ['guest-item']);
});

test('G1.7: a view can read only the cart for the authenticated owner during account changes', () => {
  const app = createCartStore();
  app.storage.setItem('achados_radar_cart', JSON.stringify([item('guest-item')]));
  app.storage.setItem('achados_radar_cart:user-a', JSON.stringify([item('user-a-item')]));
  app.storage.setItem('achados_radar_cart:user-b', JSON.stringify([item('user-b-item')]));
  app.storage.setItem('achados_radar_cart_owner', 'user-a');

  assert.deepEqual(app.store.readLocalCart('user-b').map(({ id }) => id), ['user-b-item']);
  assert.deepEqual(app.store.readLocalCart(null).map(({ id }) => id), ['guest-item']);
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['user-a-item']);
});

test('G1.7: signing in merges guest items without mixing another account cart', () => {
  const app = createCartStore();
  app.storage.setItem('achados_radar_cart', JSON.stringify([item('guest-item')]));
  app.storage.setItem('achados_radar_cart:user-a', JSON.stringify([item('user-a-item')]));
  app.storage.setItem('achados_radar_cart:user-b', JSON.stringify([item('user-b-item')]));
  app.storage.setItem('achados_radar_cart_owner', 'user-a');

  app.store.setCartOwner('user-b');
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['user-b-item']);
  app.store.setCartOwner(null);
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['guest-item']);
  app.store.setCartOwner('user-a');
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['user-a-item', 'guest-item']);
});

test('G1.7: first sign-in merges guest items into account cart and clears guest storage', () => {
  const app = createCartStore();
  app.storage.setItem('achados_radar_cart', JSON.stringify([item('shared'), item('guest-only')]));
  app.storage.setItem('achados_radar_cart:user-a', JSON.stringify([item('shared', 'Existing account title'), item('account-only')]));

  app.store.setCartOwner('user-a');
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['shared', 'account-only', 'guest-only']);
  assert.equal(app.store.readLocalCart()[0].title, 'Produto shared');
  assert.equal(app.values.has('achados_radar_cart'), false);
  assert.equal(app.events.filter(({ type }) => type === 'cart:changed').length, 1);
});

test('G1.8: removing and clearing items persist changes and dispatch cart updates', () => {
  const app = createCartStore();
  app.store.saveCartItem(item('keep'));
  app.store.saveCartItem(item('remove'));
  app.store.removeCartItem('remove');
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['keep']);
  app.store.clearLocalCart();
  assert.deepEqual(app.store.readLocalCart(), []);
  assert.equal(app.events.filter(({ type }) => type === 'cart:changed').length, 4);
});

test('G1.8: delayed removal cannot delete a newer save of the same product', () => {
  const oldSave = { ...item('re-saved'), savedAt: '2026-10-01T10:00:00.000Z' };
  const app = createCartStore([['achados_radar_cart', JSON.stringify([oldSave])]]);
  const removalSnapshot = { id: oldSave.id, savedAt: oldSave.savedAt };
  app.store.writeLocalCart([{ ...item('re-saved', 'Salvo novamente'), savedAt: '2026-10-01T10:00:01.000Z' }]);

  assert.equal(app.store.removeCartItemSnapshot(removalSnapshot), false);
  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['re-saved']);
  assert.equal(app.store.readLocalCart()[0].title, 'Salvo novamente');
});

test('G1.8: clear operation removes only the snapshot and preserves items saved while it was pending', () => {
  const app = createCartStore([['achados_radar_cart', JSON.stringify([
    { ...item('replace-during-clear'), savedAt: '2026-10-01T10:00:00.000Z' },
    { ...item('clear-me'), savedAt: '2026-10-01T10:00:00.000Z' }
  ])]]);
  const snapshot = app.store.readLocalCart().map(({ id, savedAt }) => ({ id, savedAt }));

  app.store.writeLocalCart([
    { ...item('replace-during-clear', 'Salvo novamente'), savedAt: '2026-10-01T10:00:01.000Z' },
    { ...item('added-during-clear'), savedAt: '2026-10-01T10:00:01.000Z' }
  ]);
  app.store.removeCartItems(snapshot);

  assert.deepEqual(app.store.readLocalCart().map(({ id }) => id), ['replace-during-clear', 'added-during-clear']);
  assert.equal(app.store.readLocalCart()[0].title, 'Salvo novamente');
});

test('G1.8: an action from a stale cart view changes only the owner it rendered', () => {
  const app = createCartStore([
    ['achados_radar_cart', JSON.stringify([item('guest')])],
    ['achados_radar_cart:user-a', JSON.stringify([item('shared'), item('user-a-only')])],
    ['achados_radar_cart:user-b', JSON.stringify([item('shared'), item('user-b-only')])],
    ['achados_radar_cart_owner', 'user-b']
  ]);

  app.store.removeCartItem('shared', 'user-a');
  assert.deepEqual(app.store.readLocalCart('user-a').map(({ id }) => id), ['user-a-only']);
  assert.deepEqual(app.store.readLocalCart('user-b').map(({ id }) => id), ['shared', 'user-b-only']);
  app.store.clearLocalCart('user-a');
  assert.deepEqual(app.store.readLocalCart('user-a'), []);
  assert.deepEqual(app.store.readLocalCart('user-b').map(({ id }) => id), ['shared', 'user-b-only']);
  assert.deepEqual(app.store.readLocalCart(null).map(({ id }) => id), ['guest']);
});

test('G1.10: confirmed account deletion clears only that user cart and preserves other local carts', () => {
  const app = createCartStore([
    ['achados_radar_cart', JSON.stringify([item('guest')])],
    ['achados_radar_cart:user-a', JSON.stringify([item('user-a')])],
    ['achados_radar_cart:user-b', JSON.stringify([item('user-b')])]
  ]);

  app.store.deleteLocalCartForUser('user-a');
  assert.equal(app.values.has('achados_radar_cart:user-a'), false);
  assert.equal(app.values.has('achados_radar_cart:user-b'), true);
  assert.equal(app.values.has('achados_radar_cart'), true);
  assert.equal(app.events.filter(({ type }) => type === 'cart:changed').length, 1);

  app.store.deleteLocalCartForUser('');
  assert.equal(app.values.has('achados_radar_cart:user-b'), true, 'empty identities cannot clear another account cart');
});

test('E1.8: stale link and unavailable stock block purchase without deleting saved items', async () => {
  const { evaluateOfferReadiness } = await import('../src/modules/outbound/readiness.mjs');
  const app = createCartStore();
  assert.equal(app.store.saveCartItem(item('preserve-on-invalid-offer')), true);
  const cartBefore = app.store.readLocalCart();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cases = [
    { link: { status: 'active', verified_at: yesterday, expires_at: yesterday }, offer: { stock_status: 'in_stock', observed_at: yesterday } },
    { link: { status: 'active', verified_at: yesterday }, offer: { stock_status: 'out_of_stock', observed_at: yesterday } },
    { link: { status: 'broken', verified_at: yesterday }, offer: { stock_status: 'in_stock', observed_at: yesterday } }
  ];

  for (const state of cases) {
    assert.equal(evaluateOfferReadiness({ ...state, now: Date.now() }).ready, false);
    assert.deepEqual(app.store.readLocalCart(), cartBefore);
  }
});

test('malformed cart storage is treated as an empty list', () => {
  const app = createCartStore([['achados_radar_cart', '{invalid']]);
  assert.equal(app.store.readLocalCart().length, 0);
});
