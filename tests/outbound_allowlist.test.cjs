const test = require('node:test');
const assert = require('node:assert/strict');
test('H1: affiliate redirects accept only HTTPS hosts owned by the product marketplace', async () => {
  const { isAllowedAffiliateUrl } = await import('../src/modules/outbound/allowlist.mjs');
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'https://meli.la/AbC123'), true);
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'https://short.meli.la/AbC123'), false);
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'https://user:pass@meli.la/AbC123'), false);
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'https://produto.mercadolivre.com.br/MLB-1'), false, 'a marketplace product page is not proof of an affiliate link');
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://www.magazinevoce.com.br/loja/p/item'), true);
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://magazineluiza.com.br/item'), false, 'a marketplace product page is not an affiliate destination');
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://magalu.com.br/item'), false);
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://magazineluiza.onelink.me/abc123'), true);
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://short.magazineluiza.onelink.me/abc123'), false);
  assert.equal(isAllowedAffiliateUrl('magalu', 'http://magazinevoce.com.br/item'), false);
  assert.equal(isAllowedAffiliateUrl('magalu', 'https://magazinevoce.com.br.attacker.invalid/item'), false);
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'https://meli.la.attacker.invalid/item'), false);
  assert.equal(isAllowedAffiliateUrl('mercadolivre', 'javascript:alert(1)'), false);
});
