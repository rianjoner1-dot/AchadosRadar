const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const card = fs.readFileSync(path.join(__dirname, '../src/components/ProductCard.astro'), 'utf8');
const cartPage = fs.readFileSync(path.join(__dirname, '../src/pages/carrinho.astro'), 'utf8');
const productPage = fs.readFileSync(path.join(__dirname, '../src/pages/produto.astro'), 'utf8');

test('H1: product cards route to validated product details instead of bypassing outbound checks', () => {
  assert.match(card, /href=\{`\/produto\?id=\$\{encodeURIComponent\(product\.id\)\}`\}/);
  assert.match(card, /aria-label=\{`Ver detalhes e disponibilidade de \$\{product\.title\}`\}/);
  assert.doesNotMatch(card, /product\.url|target="_blank"|https:\/\//);
  assert.match(card, /<span>Ver oferta<\/span>/);
});

test('H1.4: each saved cart item uses its own product ID and current offer readiness for marketplace exit', () => {
  assert.match(cartPage, /evaluateOfferReadiness\(\{ link, offer \}\)/);
  assert.match(cartPage, /buy\.href = `\/api\/out\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(cartPage, /buy\.target = '_blank'/);
  assert.match(cartPage, /buy\.removeAttribute\('aria-disabled'\)/);
  assert.match(cartPage, /buy\.setAttribute\('aria-disabled', 'true'\)/);
  assert.doesNotMatch(cartPage, /href="https?:\/\//);
});

test('G1.8: cart mutations carry the rendered owner through local and remote deletion', () => {
  assert.match(cartPage, /const ownerId = list\.dataset\.cartOwner \|\| null/);
  assert.match(cartPage, /removeRemoteCartItem\(id, ownerId\)/);
  assert.match(cartPage, /removeCartItem\(id, ownerId\)/);
  assert.match(cartPage, /clearRemoteCart\(ownerId\)/);
  assert.match(cartPage, /clearLocalCart\(ownerId\)/);
});

test('H1.3: an open product or cart page disables marketplace exit when a deadline passes', () => {
  assert.match(productPage, /const currentReadiness = evaluateOfferReadiness\(\{ link, offer \}\)/);
  assert.match(productPage, /buy\.removeAttribute\('href'\)/);
  assert.match(productPage, /window\.setInterval\(updateTimer, 60_000\)/);
  assert.match(cartPage, /hasElapsedLinkDeadline\(link\)/);
  assert.match(cartPage, /buy\?\.removeAttribute\('href'\)/);
  assert.match(cartPage, /window\.setInterval\(updateCartLinkTimes, 60_000\)/);
});
