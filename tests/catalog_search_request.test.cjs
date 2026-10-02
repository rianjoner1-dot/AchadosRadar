const test = require('node:test');
const assert = require('node:assert/strict');

test('catalog AJAX request maps text, sector, filters and stable cursor to the v2 RPC contract', async () => {
  const { buildCatalogSearchRequest } = await import('../src/modules/catalog/search-request.js');
  const request = buildCatalogSearchRequest({
    q: 'tv samsung', platform: 'magalu', min: 100, max: 900, sort: 'price_asc', sector: 'eletronicos', limit: 20,
    cursor: { created_at: '2026-10-01T00:00:00Z', id: 'product-id', price: 299.9, score: 0.9 }
  });
  assert.deepEqual(request, {
    search_query: 'tv samsung', target_platform: 'magalu', min_price: 100, max_price: 900, sort_by: 'price_asc',
    cursor_created_at: '2026-10-01T00:00:00Z', cursor_id: 'product-id', cursor_price: 299.9,
    page_size: 20, cursor_score: 0.9, target_sector: 'eletronicos'
  });
});

test('catalog AJAX request uses safe defaults and represents the all-sectors state as null', async () => {
  const { buildCatalogSearchRequest } = await import('../src/modules/catalog/search-request.js');
  assert.deepEqual(buildCatalogSearchRequest({ platform: 'all', sector: '' }), {
    search_query: '', target_platform: null, min_price: null, max_price: null, sort_by: 'recent',
    cursor_created_at: null, cursor_id: null, cursor_price: null, page_size: 20, cursor_score: null, target_sector: null
  });
});
