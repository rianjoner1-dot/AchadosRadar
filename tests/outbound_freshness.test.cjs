const test = require('node:test');
const assert = require('node:assert/strict');
const { isFutureTimestamp, isRecentTimestamp } = require('../src/modules/outbound/freshness.mjs');

test('H1: outbound redirect proof rejects invalid, stale and implausibly future timestamps', () => {
  const now = Date.parse('2026-09-29T12:00:00.000Z');
  assert.equal(isRecentTimestamp('2026-09-28T12:00:00.000Z', 48 * 60 * 60 * 1000, now), true);
  assert.equal(isRecentTimestamp('not-a-date', 48 * 60 * 60 * 1000, now), false);
  assert.equal(isRecentTimestamp('2026-09-26T11:59:00.000Z', 48 * 60 * 60 * 1000, now), false);
  assert.equal(isRecentTimestamp('2026-09-29T12:03:00.000Z', 48 * 60 * 60 * 1000, now), true, 'small clock skew is tolerated');
  assert.equal(isRecentTimestamp('2026-09-29T13:00:00.000Z', 48 * 60 * 60 * 1000, now), false);
  assert.equal(isFutureTimestamp('2026-09-30T12:00:00.000Z', now), true);
  assert.equal(isFutureTimestamp('not-a-date', now), false);
  assert.equal(isFutureTimestamp('2026-09-29T12:00:00.000Z', now), false);
});
