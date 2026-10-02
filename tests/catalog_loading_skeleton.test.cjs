const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const home = fs.readFileSync(path.join(__dirname, '../src/pages/index.astro'), 'utf8');

test('F1.12: initial loading reserves the first 20-item page until its cards settle', () => {
  assert.match(home, /Array\.from\(\{ length: 20 \}/);
  assert.match(home, /searchCatalog\(\{ \.\.\.filters, cursor, limit: 20,/);
  assert.match(home, /const \{ products, fetched \} = await takeCatalogBatch\(version\)/);
  assert.match(home, /Promise\.all\(platformsToFetch\.map\(\(platform\) => fetchPlatformPage\(platform, filters, version\)\)\)/);
  assert.match(home, /const candidates = interleaveByPlatform\(catalogPlatforms\.flatMap/);
  assert.match(home, /data-catalog-skeleton aria-hidden="true"/);
  assert.match(home, /function reserveFirstPageHeight\(\)/);
  assert.match(home, /const rows = Math\.ceil\(20 \/ columns\)/);
  assert.match(home, /skeleton\?\.getBoundingClientRect\(\)\.height/);
  assert.match(home, /window\.getComputedStyle\(grid\)/);
  assert.match(home, /firstPageSettled = true;\s*grid\.style\.removeProperty\('min-height'\)/);
  assert.match(home, /window\.removeEventListener\('resize', reserveFirstPageHeight\)/);
});
