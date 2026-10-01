const test = require('node:test');
const assert = require('node:assert/strict');
const { formatLinkTiming, hasElapsedLinkDeadline } = require('../src/modules/outbound/readiness.mjs');

const now = Date.parse('2026-10-01T00:00:00.000Z');

test('link timer distinguishes official expiry from the internal refresh deadline', () => {
  assert.equal(formatLinkTiming({ expires_at: '2026-10-02T02:03:00.000Z' }, now), 'Link expira em 1d 2h 3min');
  assert.match(formatLinkTiming({ refresh_due_at: '2026-10-01T03:05:00.000Z' }, now), /^Próxima revisão interna em 0d 3h 5min; isso não representa expiração oficial\./);
});

test('expired and invalid deadlines are explicit without claiming a link expiry that was not provided', () => {
  assert.equal(formatLinkTiming({ expires_at: '2026-09-30T23:59:00.000Z' }, now), 'Prazo oficial do link encerrado.');
  assert.equal(formatLinkTiming({ expires_at: 'not-a-date' }, now), 'Expiração oficial inválida; link em verificação.');
  assert.match(formatLinkTiming({ refresh_due_at: '2026-09-30T23:00:00.000Z' }, now), /Revisão interna vencida.*não representa expiração oficial/);
});

test('purchase deadline gate recognizes official expiry and internal review separately from missing dates', () => {
  assert.equal(hasElapsedLinkDeadline({ expires_at: '2026-10-02T00:00:00.000Z' }, now), false);
  assert.equal(hasElapsedLinkDeadline({ expires_at: '2026-09-30T23:59:00.000Z' }, now), true);
  assert.equal(hasElapsedLinkDeadline({ refresh_due_at: '2026-09-30T23:59:00.000Z' }, now), true);
  assert.equal(hasElapsedLinkDeadline({ refresh_due_at: 'not-a-date' }, now), false);
  assert.equal(hasElapsedLinkDeadline({}, now), false);
});
