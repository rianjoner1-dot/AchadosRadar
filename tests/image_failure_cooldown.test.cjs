const test = require('node:test');
const assert = require('node:assert/strict');
const {
  IMAGE_FAILURE_RETRY_DELAY_MS,
  canReportCatalogImageFailure,
  markCatalogImageFailureReport
} = require('../src/modules/catalog/image-health.js');

test('failed image reports suppress duplicate calls until the retry cooldown expires', () => {
  const reports = new Map();
  const key = 'product-1:https://images.example/photo.jpg';
  const now = 1_000_000;

  assert.equal(canReportCatalogImageFailure(reports, key, now), true);
  reports.set(key, Number.POSITIVE_INFINITY); // An in-flight call also blocks duplicate cards.
  assert.equal(canReportCatalogImageFailure(reports, key, now + 1), false);
  markCatalogImageFailureReport(reports, key, false, now);
  assert.equal(canReportCatalogImageFailure(reports, key, now + IMAGE_FAILURE_RETRY_DELAY_MS - 1), false);
  assert.equal(canReportCatalogImageFailure(reports, key, now + IMAGE_FAILURE_RETRY_DELAY_MS), true);
});

test('successful image reports stay deduplicated for the current page session', () => {
  const reports = new Map();
  const key = 'product-2:https://images.example/other.jpg';
  markCatalogImageFailureReport(reports, key, true, 1_000_000);
  assert.equal(canReportCatalogImageFailure(reports, key, 2_000_000), false);
});
