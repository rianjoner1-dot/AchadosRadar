const test = require('node:test');
const assert = require('node:assert/strict');

test('only Mercado Livre images with an explicit different listing ID are filtered and sent for review', async () => {
  const { classifyProductImageIdentity, filterMismatchedProductImages, sanitizeCatalogProductImages } = await import('../src/modules/catalog/image-identity.mjs');
  const matching = { url: 'https://http2.mlstatic.com/D_Q_NP_832434-MLB3299039091-O.webp', display_order: 0 };
  const mismatched = { url: 'https://http2.mlstatic.com/D_Q_NP_832434-MLB98472312945-O.webp', display_order: 1 };
  const unverifiable = { url: 'https://http2.mlstatic.com/images/item.webp', display_order: 2 };

  assert.equal(classifyProductImageIdentity('mercadolivre', 'MLB3299039091', matching.url), 'match');
  assert.equal(classifyProductImageIdentity('mercadolivre', 'MLB3299039091', mismatched.url), 'mismatch');
  assert.equal(classifyProductImageIdentity('mercadolivre', 'MLB3299039091', unverifiable.url), 'unverifiable');
  assert.equal(classifyProductImageIdentity('magalu', 'cghe07c3d6', mismatched.url), 'unverifiable');

  const result = filterMismatchedProductImages('mercadolivre', 'MLB3299039091', [matching, mismatched, unverifiable]);
  assert.deepEqual(result.accepted, [matching, unverifiable], 'unknown CDN formats stay visible for ordinary load checks');
  assert.deepEqual(result.mismatched, [mismatched], 'only the explicit cross-listing image is sent to the review path');

  const reports = [];
  const product = sanitizeCatalogProductImages({
    id: 'product-1', platform: 'mercadolivre', external_id: 'MLB3299039091',
    images: [matching, mismatched, unverifiable]
  }, (...args) => reports.push(args));
  assert.deepEqual(product.images, [matching, unverifiable]);
  assert.deepEqual(reports, [['product-1', mismatched.url]], 'the image review receives only the confirmed ID mismatch');
});
