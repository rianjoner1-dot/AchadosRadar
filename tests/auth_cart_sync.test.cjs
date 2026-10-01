const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const productShared = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const productGuest = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const productAccount = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const productRemote = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const source = fs.readFileSync(path.join(__dirname, '../src/modules/auth/client.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createAuthClient({ activeUserId = userA, remoteByUser = {}, remoteResponse, localEntries = [], queryError = null, insertError = null, deleteError = null, deleteRows = null, userOnCall = null, onRemoteRead = null } = {}) {
  const values = new Map(localEntries);
  const insertedByUser = new Map();
  const deletedRows = [];
  const events = [];
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const authCalls = { count: 0 };
  const supabase = {
    auth: {
      async getSession() {
        return { data: { session: activeUserId ? { user: { id: activeUserId }, access_token: 'test-token' } : null }, error: null };
      },
      async getUser() {
        authCalls.count += 1;
        const id = userOnCall?.(authCalls.count) ?? activeUserId;
        return { data: { user: id ? { id } : null }, error: null };
      }
    },
    from(table) {
      assert.equal(table, 'cart_items');
      return {
        select() {
          return { async eq(column, ownerId) {
            assert.equal(column, 'user_id');
            onRemoteRead?.(values, ownerId);
            return { data: remoteResponse === undefined ? remoteByUser[ownerId] ?? [] : remoteResponse, error: queryError };
          } };
        },
        async upsert(rows, options) {
          assert.equal(JSON.stringify(options), JSON.stringify({ onConflict: 'user_id,product_id', ignoreDuplicates: true }));
          const ownerId = rows[0]?.user_id;
          insertedByUser.set(ownerId, [...(insertedByUser.get(ownerId) ?? []), ...rows]);
          return { error: typeof insertError === 'function' ? insertError(rows, ownerId) : insertError };
        },
        delete() {
          const filters = [];
          const builder = {
            eq(column, value) { filters.push([column, value]); return builder; },
            select() { return builder; },
            then(resolve, reject) {
              if (deleteError) return Promise.reject(deleteError).then(resolve, reject);
              deletedRows.push(filters);
              const data = deleteRows ? deleteRows(filters) : (filters.some(([column]) => column === 'product_id') ? [{ product_id: filters.find(([column]) => column === 'product_id')?.[1] }] : []);
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            }
          };
          return builder;
        }
      };
    }
  };
  const actualCart = {
    cartStorageKey: (ownerId) => ownerId ? `achados_radar_cart:${ownerId}` : 'achados_radar_cart',
    readLocalCart(ownerId) {
      const owner = ownerId === undefined ? values.get('achados_radar_cart_owner') ?? null : ownerId;
      try {
        const parsed = JSON.parse(values.get(owner ? `achados_radar_cart:${owner}` : 'achados_radar_cart') || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    }
  };
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, localStorage, JSON, Map, Date, Intl,
    require(name) {
      if (name === '@supabase/supabase-js') return { createClient: () => supabase };
      if (name === '../cart/store') return actualCart;
      if (name === './avatar.mjs') return { prepareAvatarBlob: async () => ({ size: 0, type: 'image/webp' }) };
      if (name === '../shared/config') return { getPublicSupabaseConfig: () => ({ url: 'https://db.example', key: 'anon-test-key', isReady: true }) };
      throw new Error(`Unexpected import: ${name}`);
    }
  };
  vm.runInNewContext(compiled, context, { filename: 'auth-client.js' });
  return { client: module.exports, values, insertedByUser, deletedRows, events };
}

function localItem(id, title = `Item ${id}`) {
  return { id, platform: 'magalu', title, price: 10, priceFormatted: 'R$ 10,00', image: '' };
}

function remoteRow(productId, title = 'Oferta remota') {
  return {
    product_id: productId,
    products: {
      id: productId, platform: 'magalu', title,
      product_images: [{ url: 'https://images.example/item.jpg', display_order: 0 }],
      offers: [{ price: 25, seller_name: 'Loja', installments_text: '2x', observed_at: '2026-09-30T10:00:00.000Z' }]
    }
  };
}

test('G1.6: authenticated sync merges guest, account and remote items once and persists missing remote IDs', async () => {
  const app = createAuthClient({
    localEntries: [
      ['achados_radar_cart', JSON.stringify([localItem(productShared, 'Visitante'), localItem(productGuest)])],
      [`achados_radar_cart:${userA}`, JSON.stringify([localItem(productShared, 'Conta'), localItem(productAccount)])]
    ],
    remoteByUser: { [userA]: [remoteRow(productShared), remoteRow(productRemote)] }
  });

  await app.client.syncCartForUser(userA);
  const merged = JSON.parse(app.values.get(`achados_radar_cart:${userA}`));
  assert.deepEqual(merged.map(({ id }) => id), [productShared, productAccount, productGuest, productRemote]);
  assert.equal(merged[0].title, 'Visitante', 'the latest guest snapshot wins for an already-saved item');
  assert.equal(app.values.has('achados_radar_cart'), false, 'guest storage is cleared after successful eligible merge');
  assert.equal(app.values.get('achados_radar_cart_owner'), userA);
  assert.deepEqual(app.insertedByUser.get(userA).map(({ product_id }) => product_id), [productAccount, productGuest]);
});

test('G1.6: archived remote products remain in the owner cart without offer data', async () => {
  const archived = remoteRow(productGuest, 'Produto arquivado');
  archived.products = {
    ...archived.products,
    status: 'archived',
    product_images: [],
    offers: []
  };
  const app = createAuthClient({ remoteByUser: { [userA]: [archived] } });

  await app.client.syncCartForUser(userA);

  const saved = JSON.parse(app.values.get(`achados_radar_cart:${userA}`));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, productGuest);
  assert.equal(saved[0].title, 'Produto arquivado');
  assert.equal(saved[0].platform, 'magalu');
  assert.equal(saved[0].price, null);
  assert.equal(saved[0].image, '');
  assert.equal(app.values.get('achados_radar_cart_owner'), userA);
});

test('G1.8: anonymous cart actions treat a missing Supabase session as normal and skip remote writes', async () => {
  const app = createAuthClient({
    activeUserId: null,
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]]
  });

  assert.equal(await app.client.currentUser(), null);
  await app.client.removeRemoteCartItem(productGuest);
  await app.client.clearRemoteCart();
  assert.deepEqual(JSON.parse(app.values.get('achados_radar_cart')).map(({ id }) => id), [productGuest]);
  assert.equal(app.insertedByUser.size, 0, 'anonymous operations do not write cart rows remotely');

  const signedIn = createAuthClient({ activeUserId: userA });
  assert.deepEqual(await signedIn.client.currentUser(), { id: userA }, 'a session is still validated through getUser');
});

test('G1.8: remote cart removal and clear are bound to the account shown in the cart', async () => {
  const app = createAuthClient({ activeUserId: userB });
  await assert.rejects(app.client.removeRemoteCartItem(productShared, userA), /sess[aã]o da conta mudou/i);
  await assert.rejects(app.client.clearRemoteCart(userA), /sess[aã]o da conta mudou/i);
  assert.equal(app.deletedRows.length, 0, 'a stale cart view cannot delete another account items');

  await app.client.removeRemoteCartItem(productShared, userB);
  await app.client.clearRemoteCart(userB);
  assert.deepEqual(app.deletedRows, [
    [['user_id', userB], ['product_id', productShared]],
    [['user_id', userB]]
  ]);

  await app.client.removeRemoteCartItem(productShared, null);
  await app.client.clearRemoteCart(null);
  assert.equal(app.deletedRows.length, 2, 'anonymous actions never target the signed-in account cart');
});

test('G1.8: a session switch during a remote delete preserves the local cart for retry', async () => {
  const app = createAuthClient({
    activeUserId: userA,
    deleteRows: () => [],
    userOnCall: (call) => call === 1 ? userA : userB
  });
  await assert.rejects(app.client.removeRemoteCartItem(productShared, userA), /sess[aã]o da conta mudou/i);
  assert.deepEqual(app.deletedRows, [[['user_id', userA], ['product_id', productShared]]]);
});

test('G1.7: switching accounts neither imports nor deletes a guest cart owned by another session', async () => {
  const app = createAuthClient({
    activeUserId: userB,
    localEntries: [
      ['achados_radar_cart_owner', userA],
      ['achados_radar_cart', JSON.stringify([localItem(productGuest)])],
      [`achados_radar_cart:${userA}`, JSON.stringify([localItem(productAccount)])],
      [`achados_radar_cart:${userB}`, JSON.stringify([localItem(productRemote)])]
    ],
    remoteByUser: { [userB]: [] }
  });

  await app.client.syncCartForUser(userB);
  assert.deepEqual(JSON.parse(app.values.get(`achados_radar_cart:${userB}`)).map(({ id }) => id), [productRemote]);
  assert.equal(app.values.get('achados_radar_cart_owner'), userB);
  assert.deepEqual(JSON.parse(app.values.get('achados_radar_cart')).map(({ id }) => id), [productGuest]);
  assert.equal(app.insertedByUser.get(userB).some(({ product_id }) => product_id === productAccount || product_id === productGuest), false);
});

test('G1.6: remote read failure preserves the guest cart for a later retry', async () => {
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    queryError: new Error('network unavailable')
  });
  await assert.rejects(app.client.syncCartForUser(userA), /network unavailable/);
  assert.equal(app.values.has('achados_radar_cart'), true);
  assert.equal(app.values.has('achados_radar_cart_owner'), false, 'failed sync does not switch the active cart owner');
  assert.equal(app.values.has(`achados_radar_cart:${userA}`), false, 'failed sync never commits an incomplete account snapshot');
});

test('G1.6: remote upsert failure keeps the merged local cart and retries safely', async () => {
  let attempts = 0;
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    remoteByUser: { [userA]: [] },
    insertError() { attempts += 1; return attempts === 1 ? new Error('temporary write failure') : null; }
  });

  await assert.rejects(app.client.syncCartForUser(userA), /temporary write failure/);
  assert.deepEqual(JSON.parse(app.values.get(`achados_radar_cart:${userA}`)).map(({ id }) => id), [productGuest]);
  assert.equal(app.values.has('achados_radar_cart'), false, 'the visitor copy is removed only after its full local snapshot is committed');
  assert.equal(app.values.get('achados_radar_cart_owner'), userA);

  await app.client.syncCartForUser(userA);
  assert.equal(attempts, 2, 'the next sync retries the same missing remote product');
  assert.deepEqual(JSON.parse(app.values.get(`achados_radar_cart:${userA}`)).map(({ id }) => id), [productGuest]);
});

test('G1.6: guest cart changes during remote read are picked up by a bounded retry', async () => {
  const changedGuestCart = [localItem(productGuest), localItem(productAccount, 'Adicionado em outra aba')];
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    onRemoteRead(values) { values.set('achados_radar_cart', JSON.stringify(changedGuestCart)); }
  });

  await app.client.syncCartForUser(userA);
  assert.deepEqual(JSON.parse(app.values.get(`achados_radar_cart:${userA}`)).map(({ id }) => id), [productGuest, productAccount]);
  assert.equal(app.values.has('achados_radar_cart'), false, 'guest cart is cleared only after the fresh snapshot is committed');
  assert.equal(app.values.get('achados_radar_cart_owner'), userA);
  assert.deepEqual(app.insertedByUser.get(userA).map(({ product_id }) => product_id), [productGuest, productAccount]);
});

test('G1.7: a session change during remote read stops the old user sync without consuming guest items', async () => {
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    userOnCall: (call) => call === 1 ? userA : userB
  });
  await app.client.syncCartForUser(userA);
  assert.equal(app.values.has('achados_radar_cart'), true);
  assert.equal(app.values.has('achados_radar_cart_owner'), false, 'stale session response cannot claim the active cart');
  assert.deepEqual(app.insertedByUser.get(userA), undefined);
});

test('G1.6: malformed remote response leaves local and guest carts available for retry', async () => {
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    remoteResponse: { product_id: productRemote }
  });
  await assert.rejects(app.client.syncCartForUser(userA), /Resposta inválida ao sincronizar o carrinho/);
  assert.equal(app.values.has('achados_radar_cart'), true);
  assert.equal(app.values.has('achados_radar_cart_owner'), false);
  assert.equal(app.values.has(`achados_radar_cart:${userA}`), false, 'malformed sync never commits an incomplete account snapshot');
  assert.equal(app.insertedByUser.size, 0);
});

test('G1.6: mismatched nested product cannot be attached to a different cart item', async () => {
  const app = createAuthClient({
    localEntries: [['achados_radar_cart', JSON.stringify([localItem(productGuest)])]],
    remoteResponse: [{ ...remoteRow(productRemote), products: { ...remoteRow(productAccount).products } }]
  });
  await assert.rejects(app.client.syncCartForUser(userA), /Resposta inválida ao sincronizar o carrinho/);
  assert.equal(app.values.has('achados_radar_cart'), true);
  assert.equal(app.values.has('achados_radar_cart_owner'), false);
  assert.equal(app.insertedByUser.size, 0);
});
