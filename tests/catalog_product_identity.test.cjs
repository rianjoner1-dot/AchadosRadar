const test = require('node:test');
const assert = require('node:assert/strict');

test('product identity requires the exact Magalu SKU path on an official HTTPS host', async () => {
  const { matchesMarketplaceProductIdentity: matches } = await import('../src/modules/catalog/product-identity.mjs');
  assert.equal(matches('magalu', 'SKU-123', 'https://www.magazineluiza.com.br/p/SKU-123/produto'), true);
  assert.equal(matches('magalu', 'sku-123', 'https://www.magazinevoce.com.br/loja/p/SKU-123/produto'), true);
  assert.equal(matches('magalu', 'SKU-OTHER', 'https://www.magazineluiza.com.br/p/SKU-123/produto'), false);
  assert.equal(matches('magalu', 'SKU-123', 'https://magazineluiza.com.br.attacker.invalid/p/SKU-123'), false);
  assert.equal(matches('magalu', 'SKU-123', 'http://www.magazineluiza.com.br/p/SKU-123'), false);
});

test('product identity normalizes dashed Mercado Livre IDs but rejects other listings', async () => {
  const { matchesMarketplaceProductIdentity: matches } = await import('../src/modules/catalog/product-identity.mjs');
  assert.equal(matches('mercadolivre', 'MLB123456', 'https://produto.mercadolivre.com.br/MLB-123456-produto'), true);
  assert.equal(matches('mercadolivre', 'MLB-123456', 'https://www.mercadolivre.com.br/p/MLB123456'), true);
  assert.equal(matches('mercadolivre', 'MLB123457', 'https://produto.mercadolivre.com.br/MLB-123456-produto'), false);
  assert.equal(matches('mercadolivre', 'MLB-uncertain', 'https://produto.mercadolivre.com.br/MLB-uncertain'), false);
  assert.equal(matches('mercadolivre', 'MLB123456', 'https://meli.la/short'), false);
});
