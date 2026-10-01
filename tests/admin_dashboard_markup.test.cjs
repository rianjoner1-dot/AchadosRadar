const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '../src/pages/painel-admin.astro'), 'utf8');

test('admin dashboard has valid semantic metric tables and readable Portuguese labels', () => {
  assert.match(page, /<main class="container admin-page">/);
  assert.match(page, /<button id="refreshMetrics" class="btn-secondary" type="button">Atualizar<\/button>/);
  assert.match(page, /<th scope="col">Visualizações<\/th>/);
  assert.match(page, /<th scope="col">Cliques<\/th>/);
  assert.match(page, /aria-live="polite"/);
  assert.doesNotMatch(page, /\?\?|<div class=\s|<th scope=col/);
});
