const test = require('node:test');
const assert = require('node:assert/strict');
const { describeOfferObservation, getOfferObservationState, describeObservedStock } = require('../src/modules/catalog/offer-observation.mjs');

const now = Date.parse('2026-10-03T12:00:00.000Z');

test('offer observation distinguishes recent, missing, stale, invalid and future timestamps', () => {
  assert.equal(getOfferObservationState('2026-10-02T12:00:00.000Z', now), 'observed');
  assert.equal(getOfferObservationState(null, now), 'unknown');
  assert.equal(getOfferObservationState('2026-09-30T11:59:59.000Z', now), 'needs_recheck');
  assert.equal(getOfferObservationState('not-a-date', now), 'needs_recheck');
  assert.equal(getOfferObservationState('2026-10-04T12:00:00.000Z', now), 'needs_recheck');
});

test('offer observation labels state that observations may change and never promise validity', () => {
  assert.match(describeOfferObservation('2026-10-02T12:00:00.000Z', now).label, /Dados observados em .* podem mudar na loja/);
  assert.equal(describeOfferObservation(null, now).label, 'Data da consulta não informada');
  assert.match(describeOfferObservation('2026-09-30T11:59:59.000Z', now).label, /Precisa de nova verificação/);
});

test('stock labels are only current-looking when the offer observation is recent', () => {
  assert.equal(describeObservedStock('in_stock', 'observed'), 'Disponível na última consulta');
  assert.equal(describeObservedStock('out_of_stock', 'observed'), 'Sem estoque na última consulta');
  assert.equal(describeObservedStock('in_stock', 'unknown'), 'Disponibilidade não informada');
  assert.equal(describeObservedStock('in_stock', 'needs_recheck'), 'Precisa de nova verificação');
  assert.equal(describeObservedStock('unknown', 'observed'), 'Estoque não informado');
});
