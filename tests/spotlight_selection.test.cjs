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

test('spotlight carousels keep one category per lane and cap each lane at five offers', async () => {
  const { selectSpotlightCarouselGroups } = await import('../src/modules/catalog/spotlights.mjs');
  const products = ['Category A', 'Category B', 'Category C', 'Category D'].flatMap((category, categoryIndex) =>
    Array.from({ length: 6 }, (_, index) => ({
      id: `${category}-${index}`,
      category,
      offer: { price: 20 + categoryIndex * 10 + index, stock_status: 'in_stock' }
    }))
  );
  const groups = selectSpotlightCarouselGroups(products, 3, 8);
  assert.deepEqual(groups.map((group) => group.length), [5, 5, 5]);
  assert.equal(new Set(groups.flat().map(({ product }) => product.id)).size, 15);
  assert.equal(new Set(groups.map((group) => group[0].categoryKey)).size, 3);
  assert.ok(groups.every((group) => new Set(group.map(({ categoryKey }) => categoryKey)).size === 1));
  assert.deepEqual(groups.map((group) => group[0].categoryLabel), ['Category A', 'Category B', 'Category C']);
});

test('spotlight carousel does not invent a category and honors exclusions', async () => {
  const { selectSpotlightCarouselGroups } = await import('../src/modules/catalog/spotlights.mjs');
  const groups = selectSpotlightCarouselGroups([
    { id: 'excluded', category: 'Moda', offer: { price: 2, stock_status: 'in_stock' } },
    { id: 'unknown', offer: { price: 1, stock_status: 'in_stock' } },
    { id: 'kept', category: 'Móveis', offer: { price: 3, stock_status: 'in_stock' } }
  ], 3, 5, ['excluded']);
  assert.deepEqual(groups.flat().map(({ product }) => product.id), ['kept']);
});

test('spotlights prefer product-title category over stale category keywords', async () => {
  const { selectSpotlightCarouselGroups } = await import('../src/modules/catalog/spotlights.mjs');
  const groups = selectSpotlightCarouselGroups([
    { id: 'dress', title: 'Vestido Midi Canelado', category: 'Móveis sofá rack painel cama', offer: { price: 47, stock_status: 'in_stock' } },
    { id: 'rack', title: 'Rack para TV com painel', category: 'Moda feminina', offer: { price: 350, stock_status: 'in_stock' } }
  ], 2, 5);
  assert.deepEqual(groups.flat().map(({ product, categoryKey }) => [product.id, categoryKey]), [
    ['dress', 'moda'], ['rack', 'moveis']
  ]);
});
