const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAffiliateRedirect } = require('../src/modules/outbound/redirect-policy.mjs');

const now = Date.parse('2026-09-30T12:00:00.000Z');
const product = { platform: 'mercadolivre', status: 'published' };
const link = {
  affiliate_url: 'https://meli.la/AbC123',
  status: 'active',
  verified_at: '2026-09-29T12:00:00.000Z',
  refresh_due_at: '2026-10-01T12:00:00.000Z',
  expires_at: '2026-10-03T12:00:00.000Z'
};
const offer = { stock_status: 'in_stock', observed_at: '2026-09-30T11:00:00.000Z' };

test('H1.1: redirect decision accepts fresh offers on both supported marketplaces', () => {
  assert.deepEqual(evaluateAffiliateRedirect({ product, link, offer, now }), {
    ready: true, status: 302, location: 'https://meli.la/AbC123'
  });
  assert.deepEqual(evaluateAffiliateRedirect({
    product: { ...product, platform: 'magalu' },
    link: { ...link, affiliate_url: 'https://www.magazinevoce.com.br/loja/p/item' },
    offer,
    now
  }), {
    ready: true, status: 302, location: 'https://www.magazinevoce.com.br/loja/p/item'
  });
});

test('H1.3: redirect stays blocked for unpublished product, missing/inactive link and invalid destination', () => {
  assert.equal(evaluateAffiliateRedirect({ product: { ...product, status: 'draft' }, link, offer, now }).status, 410);
  assert.equal(evaluateAffiliateRedirect({ product, link: null, offer, now }).status, 410);
  assert.equal(evaluateAffiliateRedirect({ product, link: { ...link, status: 'broken' }, offer, now }).status, 410);
  assert.equal(evaluateAffiliateRedirect({ product, link: { ...link, affiliate_url: 'https://meli.la.attacker.invalid/x' }, offer, now }).status, 410);
});

test('H1.3: redirect stays blocked when stock is unknown, absent, out of stock or stale', () => {
  for (const stock_status of ['unknown', 'out_of_stock', undefined]) {
    assert.equal(evaluateAffiliateRedirect({ product, link, offer: { ...offer, stock_status }, now }).status, 409);
  }
  assert.equal(evaluateAffiliateRedirect({ product, link, offer: { ...offer, observed_at: '2026-09-27T11:59:00.000Z' }, now }).status, 409);
});

test('H1.3: redirect stays blocked for stale verification, overdue review and expired official link', () => {
  assert.equal(evaluateAffiliateRedirect({ product, link: { ...link, verified_at: '2026-09-01T12:00:00.000Z' }, offer, now }).status, 410);
  assert.equal(evaluateAffiliateRedirect({ product, link: { ...link, refresh_due_at: '2026-09-30T11:59:00.000Z' }, offer, now }).status, 410);
  assert.equal(evaluateAffiliateRedirect({ product, link: { ...link, expires_at: '2026-09-30T11:59:00.000Z' }, offer, now }).status, 410);
});
