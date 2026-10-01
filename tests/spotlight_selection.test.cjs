const test = require('node:test');
const assert = require('node:assert/strict');

test('spotlights prioritize real observed discounts, then fill with in-stock offers', async () => {
  const { selectSpotlightOffers } = await import('../src/modules/catalog/spotlights.mjs');
  const products = [
    { id: 'regular', offer: { price: 50, old_price: null, stock_status: 'in_stock' } },
    { id: 'small-cut', offer: { price: 90, old_price: 100, stock_status: 'in_stock' } },
    { id: 'big-cut', offer: { price: 60, old_price: 100, stock_status: 'in_stock' } },
    { id: 'sold-out', offer: { price: 1, old_price: 100, stock_status: 'out_of_stock' } },
    { id: 'unknown-stock', offer: { price: 1, old_price: 100, stock_status: 'unknown' } },
    { id: 'invalid-old-price', offer: { price: 30, old_price: 20, stock_status: 'in_stock' } }
  ];
  assert.deepEqual(selectSpotlightOffers(products).map(({ product, discountPercent }) => [product.id, discountPercent]), [
    ['big-cut', 40], ['small-cut', 10], ['regular', null]
  ]);
});

test('spotlight selection handles missing data, limits and invalid discounts safely', async () => {
  const { selectSpotlightOffers } = await import('../src/modules/catalog/spotlights.mjs');
  assert.deepEqual(selectSpotlightOffers(null), []);
  assert.deepEqual(selectSpotlightOffers([], 0), []);
  assert.deepEqual(selectSpotlightOffers([
    { id: 'free', offer: { price: 0, old_price: 80, stock_status: 'in_stock' } },
    { id: 'no-offer', offer: null }
  ]), []);
});

test('failed spotlight photos fall through to another offer without deleting the product', async () => {
  const { selectSpotlightOffers } = await import('../src/modules/catalog/spotlights.mjs');
  const products = [
    { id: 'broken-photo', offer: { price: 40, old_price: 80, stock_status: 'in_stock' } },
    { id: 'good-photo', offer: { price: 30, old_price: 50, stock_status: 'in_stock' } }
  ];
  assert.deepEqual(selectSpotlightOffers(products, 1, ['broken-photo']).map(({ product, discountPercent }) => [product.id, discountPercent]), [['good-photo', 40]]);
  assert.equal(products[0].id, 'broken-photo', 'unavailable photo only removes a product from the visual spotlight selection');
});
