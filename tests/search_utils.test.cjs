const test = require('node:test');
const assert = require('node:assert/strict');

test('F1: approximate catalog search tolerates accents, punctuation and close typos', async () => {
  const { matchesDemoProduct, normalizeSearch } = await import('../src/modules/catalog/search-utils.js');

  assert.equal(normalizeSearch('Brinco—Prata Árvore'), 'brincoprataarvore');
  assert.equal(matchesDemoProduct('brimco', 'Brinco de prata'), true, 'one-character typo returns the expected product');
  assert.equal(matchesDemoProduct('Brínco!!!', 'Brinco de prata'), true, 'accents and punctuation do not change a match');
  assert.equal(matchesDemoProduct('air frye', 'Air Fryer Mondial'), true, 'each query term can tolerate a close typo');
  assert.equal(matchesDemoProduct('zzzxqv', 'Brinco de prata'), false, 'distant queries remain excluded');
  assert.equal(matchesDemoProduct('  ', 'Brinco de prata'), true, 'empty query leaves the catalog unfiltered');
});
