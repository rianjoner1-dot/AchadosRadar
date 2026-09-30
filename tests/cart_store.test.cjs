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
