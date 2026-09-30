const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateOfferReadiness } = require('../src/modules/outbound/readiness.mjs');

const now = Date.parse('2026-09-29T12:00:00.000Z');
const goodLink = { status: 'active', verified_at: '2026-09-28T12:00:00.000Z', refresh_due_at: '2026-10-01T12:00:00.000Z' };
const goodOffer = { stock_status: 'in_stock', observed_at: '2026-09-29T11:00:00.000Z' };

test('H1.3: only published products with active, fresh links and stock are purchasable', () => {
  assert.equal(evaluateOfferReadiness({ link: goodLink, offer: goodOffer, now }).ready, true);
  assert.match(evaluateOfferReadiness({ productStatus: 'draft', link: goodLink, offer: goodOffer, now }).reason, /catálogo publicado/);
  assert.match(evaluateOfferReadiness({ link: { ...goodLink, status: 'expired' }, offer: goodOffer, now }).reason, /expirou/);
  assert.match(evaluateOfferReadiness({ link: { ...goodLink, status: 'broken' }, offer: goodOffer, now }).reason, /revisão/);
});

test('H1.3: overdue review, expired official date, stale link and stock block outbound access', () => {
  assert.match(evaluateOfferReadiness({ link: { ...goodLink, refresh_due_at: '2026-09-29T11:59:00.000Z' }, offer: goodOffer, now }).reason, /revisão interna/);
  assert.match(evaluateOfferReadiness({ link: { ...goodLink, expires_at: '2026-09-29T11:59:00.000Z' }, offer: goodOffer, now }).reason, /prazo informado/);
  assert.match(evaluateOfferReadiness({ link: { ...goodLink, verified_at: '2026-09-01T12:00:00.000Z' }, offer: goodOffer, now }).reason, /desatualizada/);
  assert.match(evaluateOfferReadiness({ link: goodLink, offer: { ...goodOffer, stock_status: 'out_of_stock' }, now }).reason, /Sem estoque/);
  assert.match(evaluateOfferReadiness({ link: goodLink, offer: { ...goodOffer, stock_status: 'unknown' }, now }).reason, /não confirmado/);
});

test('H1.3: a product with no link remains ineligible without throwing', () => {
  assert.deepEqual(evaluateOfferReadiness({ link: null, offer: goodOffer, now }), { ready: false, reason: 'Link afiliado aguardando verificação.' });
});
