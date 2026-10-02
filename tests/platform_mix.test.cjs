const test = require('node:test');
const assert = require('node:assert/strict');

test('catalog alternates stores while keeping each store order and all products', async () => {
  const { interleaveByPlatform } = await import('../src/modules/catalog/platform-mix.js');
  const products = [
    { id: 'm1', platform: 'magalu' }, { id: 'm2', platform: 'magalu' }, { id: 'm3', platform: 'magalu' },
    { id: 'l1', platform: 'mercadolivre' }, { id: 'l2', platform: 'mercadolivre' }
  ];
  const mixed = interleaveByPlatform(products, () => 0);

  assert.deepEqual(mixed.map(({ id }) => id), ['m1', 'l1', 'm2', 'l2', 'm3']);
  assert.deepEqual(mixed.filter(({ platform }) => platform === 'magalu').map(({ id }) => id), ['m1', 'm2', 'm3']);
  assert.deepEqual(mixed.filter(({ platform }) => platform === 'mercadolivre').map(({ id }) => id), ['l1', 'l2']);
  assert.equal(new Set(mixed.map(({ id }) => id)).size, products.length);
  for (let index = 1; index < mixed.length; index++) assert.notEqual(mixed[index - 1].platform, mixed[index].platform);
});

test('catalog mix leaves single-store pages intact', async () => {
  const { interleaveByPlatform } = await import('../src/modules/catalog/platform-mix.js');
  const products = [{ id: 'a', platform: 'magalu' }, { id: 'b', platform: 'magalu' }];
  assert.deepEqual(interleaveByPlatform(products), products);
});
