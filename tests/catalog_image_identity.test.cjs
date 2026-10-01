const test = require('node:test');
const assert = require('node:assert/strict');

test('only Mercado Livre images with an explicit different listing ID are filtered and sent for review', async () => {
  const { classifyProductImageIdentity, filterMismatchedProductImages, sanitizeCatalogProductImages, upgradeProductImageUrl } = await import('../src/modules/catalog/image-identity.mjs');
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

  assert.equal(upgradeProductImageUrl('magalu', 'https://a-static.mlcdn.com.br/280x210/item/photo.jpg'), 'https://a-static.mlcdn.com.br/1500x1500/item/photo.jpg');
  assert.equal(upgradeProductImageUrl('mercadolivre', 'https://http2.mlstatic.com/D_NQ_NP_123-MLB3299039091-I.webp'), 'https://http2.mlstatic.com/D_NQ_NP_123-MLB3299039091-O.webp');
  assert.equal(upgradeProductImageUrl('magalu', 'https://attacker.invalid/280x210/photo.jpg'), 'https://attacker.invalid/280x210/photo.jpg', 'unknown hosts must never be rewritten');
  assert.equal(upgradeProductImageUrl('amazon', 'https://m.media-amazon.com/images/I/61photo._AC_SX679_.jpg'), 'https://m.media-amazon.com/images/I/61photo.jpg');
  assert.equal(upgradeProductImageUrl('shopee', 'https://down-br.img.susercontent.com/file/photo_tn.webp'), 'https://down-br.img.susercontent.com/file/photo.webp');
  assert.equal(upgradeProductImageUrl('amazon', 'https://media-amazon.com.attacker.invalid/images/I/photo._AC_SX679_.jpg'), 'https://media-amazon.com.attacker.invalid/images/I/photo._AC_SX679_.jpg', 'lookalike hosts must never be rewritten');

  const legacyMagalu = sanitizeCatalogProductImages({
    id: 'product-2', platform: 'magalu', external_id: 'SKU-1',
    images: [{ url: 'https://a-static.mlcdn.com.br/280x210/item/photo.jpg', display_order: 0 }]
  }).images[0];
  assert.equal(legacyMagalu.url, 'https://a-static.mlcdn.com.br/1500x1500/item/photo.jpg');
  assert.equal(legacyMagalu.original_url, 'https://a-static.mlcdn.com.br/280x210/item/photo.jpg', 'failure reporting keeps the exact catalog URL');
});
