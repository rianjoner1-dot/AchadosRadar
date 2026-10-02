const test = require('node:test');
const assert = require('node:assert/strict');

test('F1: approximate catalog search tolerates accents, punctuation and close typos', async () => {
  const { matchesDemoProduct, matchesDemoSector, normalizeSearch } = await import('../src/modules/catalog/search-utils.js');

  assert.equal(normalizeSearch('Brinco—Prata Árvore'), 'brincoprataarvore');
  assert.equal(matchesDemoProduct('brimco', 'Brinco de prata'), true, 'one-character typo returns the expected product');
  assert.equal(matchesDemoProduct('Brínco!!!', 'Brinco de prata'), true, 'accents and punctuation do not change a match');
  assert.equal(matchesDemoProduct('air frye', 'Air Fryer Mondial'), true, 'each query term can tolerate a close typo');
  assert.equal(matchesDemoProduct('air fryer', 'Airfryer Mondial'), true, 'the compact spelling matches the spaced search');
  assert.equal(matchesDemoProduct('fritadeira', 'Air Fryer Mondial'), true, 'fritadeira is an explicit synonym for air fryer');
  assert.equal(matchesDemoProduct('air fryer', 'Fritadeira elétrica compacta'), true, 'air fryer also matches a product titled fritadeira');
  assert.equal(matchesDemoProduct('tv samsung', 'Smart TV Samsung 55'), true, 'short exact terms can accompany a longer term');
  assert.equal(matchesDemoProduct('tv samsung', 'Celular Samsung Galaxy'), false, 'all terms are required, including short ones');
  assert.equal(matchesDemoProduct('fone', 'Telefone Bluetooth'), false, 'a query must match a whole word or its prefix, not an arbitrary substring');
  assert.equal(matchesDemoProduct('a', 'Câmera digital'), false, 'a one-character search must match an exact token instead of any word containing it');
  assert.equal(matchesDemoProduct('blazer', 'Produto de campanha', 'Blazer feminino'), true, 'the demo searches product category just like the server');
  assert.equal(matchesDemoProduct('zzzxqv', 'Brinco de prata'), false, 'distant queries remain excluded');
  assert.equal(matchesDemoProduct('  ', 'Brinco de prata'), true, 'empty query leaves the catalog unfiltered');
  assert.equal(matchesDemoSector('moda', 'Blazer feminino'), true, 'demo sector filtering uses stable sector slugs');
  assert.equal(matchesDemoSector('pc-gamer', 'Teclado mecânico gamer'), true, 'gaming products match their specific sector');
  assert.equal(matchesDemoSector('eletronicos', 'Teclado mecânico gamer'), true, 'overlapping products also match electronics');
  assert.equal(matchesDemoSector('moveis', 'Painel solar fotovoltaico'), false, 'ambiguous standalone panel terms do not classify unrelated solar products as furniture');
  assert.equal(matchesDemoSector('bebes', 'Carrinho de bebê'), true, 'demo sector filtering normalizes accents');
  assert.equal(matchesDemoSector('pet', 'Carrinho de bebê'), false, 'unrelated sectors do not admit the product');
  assert.equal(matchesDemoSector('', 'Produto sem categoria'), true, 'Everything keeps unclassified products visible');
});
