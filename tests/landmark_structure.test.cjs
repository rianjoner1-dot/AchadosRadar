const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagesRoot = path.join(__dirname, '../src/pages');
const layout = fs.readFileSync(path.join(__dirname, '../src/layouts/Layout.astro'), 'utf8');
const routes = [
  'index.astro',
  'conta.astro',
  'carrinho.astro',
  'privacidade.astro',
  'termos.astro',
  'produto.astro',
  path.join('produto', '[id].astro')
];

test('H1.7: layout owns the only main landmark; route content does not nest another main', () => {
  assert.equal((layout.match(/<main\b/g) ?? []).length, 1);
  for (const route of routes) {
    const source = fs.readFileSync(path.join(pagesRoot, route), 'utf8');
    assert.doesNotMatch(source, /<main\b/, `${route} must use the single main landmark from Layout`);
  }
});
