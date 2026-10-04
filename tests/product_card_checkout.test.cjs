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

test('H1.3: cart fail-closed path removes any stale checkout destination after readiness failure', () => {
  assert.match(cartPage, /const disableBuy = \(label = 'Oferta indisponível'\) => \{/);
  assert.match(cartPage, /buy\.removeAttribute\('href'\)/);
  assert.match(cartPage, /buy\.removeAttribute\('target'\)/);
  assert.match(cartPage, /buy\.removeAttribute\('rel'\)/);
  assert.match(cartPage, /else \{ disableBuy\(label\); \}/);
  assert.match(cartPage, /catch \{\s*if \(version === renderVersion\) \{\s*disableBuy\(\);/);
});

test('G1.8: cart mutations carry the rendered owner through local and remote deletion', () => {
  assert.match(cartPage, /const ownerId = list\.dataset\.cartOwner \|\| null/);
  assert.match(cartPage, /removeRemoteCartItem\(id, ownerId\)/);
  assert.match(cartPage, /const itemSnapshot = readLocalCart\(ownerId\)\.find\(\(saved\) => saved\.id === id\)/);
  assert.match(cartPage, /removeCartItemSnapshot\(removalSnapshot, ownerId\)/);
  assert.match(cartPage, /clearRemoteCart\(ownerId\)/);
  assert.match(cartPage, /const clearSnapshot = readLocalCart\(ownerId\)\.map\(\(\{ id, savedAt \}\) => \(\{ id, savedAt \}\)\)/);
  assert.match(cartPage, /removeCartItems\(clearSnapshot, ownerId\)/);
});

test('G1.8: a local cart remains usable and gets an accurate status when account loading fails', () => {
  assert.match(cartPage, /const localItems = renderLocalCart\(null\)/);
  assert.match(cartPage, /Os itens continuam salvos neste navegador\. A sincronização da conta não está disponível agora\./);
  assert.match(cartPage, /A conta não pôde ser carregada\. Você ainda pode salvar produtos neste navegador\./);
});

test('G1.7/G1.8: restoring the cart from BFCache rechecks auth and reads the latest cart', () => {
  assert.match(cartPage, /window\.addEventListener\('pageshow', \(event\) => \{\s*if \(event\.persisted\) void render\(\);\s*\}\);/);
});

test('G1.6/G1.7: a transient session recheck failure hides account items without starting a render loop', () => {
  assert.match(cartPage, /try \{ confirmedUser = await auth\.currentUser\(\); \}\s*catch \{\s*if \(version !== renderVersion\) return;\s*const guestItems = renderLocalCart\(null\);\s*status\.textContent = 'Não foi possível confirmar sua sessão\./);
  assert.match(cartPage, /Sua lista da conta permanece salva e oculta até a conexão voltar\./);
  assert.doesNotMatch(cartPage, /catch \{[^}]*void render\(\)/s);
});

test('H1.3: an open product or cart page disables marketplace exit when a deadline passes', () => {
  assert.match(productPage, /const currentReadiness = evaluateOfferReadiness\(\{ link, offer \}\)/);
  assert.match(productPage, /buy\.removeAttribute\('href'\)/);
  assert.match(productPage, /buy\.removeAttribute\('target'\)/);
  assert.match(productPage, /buy\.removeAttribute\('rel'\)/);
  assert.match(productPage, /window\.setInterval\(updateTimer, 60_000\)/);
  assert.match(cartPage, /hasElapsedLinkDeadline\(link\)/);
  assert.match(cartPage, /buy\?\.removeAttribute\('href'\)/);
  assert.match(cartPage, /buy\?\.removeAttribute\('target'\)/);
  assert.match(cartPage, /buy\?\.removeAttribute\('rel'\)/);
  assert.match(cartPage, /window\.setInterval\(updateCartLinkTimes, 60_000\)/);
});

test('product details render only observed ratings and bounded store specifications', () => {
  const client = fs.readFileSync(path.join(__dirname, '../src/modules/catalog/client.ts'), 'utf8');
  assert.match(productPage, /id="productRating"/);
  assert.match(productPage, /observada na loja/);
  assert.match(productPage, /id="productSpecifications"/);
  assert.match(productPage, /escapeHtml\(item\.name\).*escapeHtml\(item\.value\)/);
  assert.match(client, /select: 'rating,reviews_count,specifications'/);
  assert.match(client, /metadataResponse\?\.ok \? metadataResponse\.json\(\) : Promise\.resolve\(\[\]\)/);
});
