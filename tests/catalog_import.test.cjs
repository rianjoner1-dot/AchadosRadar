const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const script = path.join(projectRoot, 'scripts/import-catalog.mjs');

test('E1: importer accepts macro fields, preserves image order and only publishes proven, in-stock links', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-import-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const now = new Date().toISOString();
  fs.writeFileSync(sourcePath, JSON.stringify([
    { platform: 'magalu', id: 'sku-1', title: 'Brinco prata', price: 45.9, stockStatus: 'in_stock', stockQuantity: null, images: ['https://a-static.mlcdn.com.br/img/1.jpg', 'https://a-static.mlcdn.com.br/img/2.jpg'], installments: '3x sem juros', shipping: 'Frete grátis', coupon: 'CUPOM10', originalUrl: 'https://www.magazineluiza.com.br/p/produto/sku-1', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/sku-1', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now, refreshDueAt: new Date(Date.now() + 86400000).toISOString() },
    { platform: 'mercadolivre', id: 'MLB123', title: 'Fone bluetooth', price: 100, stockStatus: 'unknown', images: ['https://http2.mlstatic.com/img/1.jpg'], originalUrl: 'https://produto.mercadolivre.com.br/MLB-123', affiliateUrl: 'https://meli.la/aBc123', isOfficialShortLink: true, linkStatus: 'ready', lastCheckedAt: now },
    { platform: 'magalu', id: 'sku-2', title: 'Produto com imagem invasiva', price: 1, stockStatus: 'in_stock', images: ['https://example.com/track.png'], originalUrl: 'https://magazineluiza.com.br/p/x', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/x', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now }
  ]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.total, 3);
  assert.equal(report.valid, 2);
  assert.equal(report.publishable, 1, 'link verificado sem estoque conhecido permanece não publicado');
  assert.equal(report.notPublishableReasons.estoque_unknown, 1, 'dry-run informa por que um item válido não pode ser publicado');
  assert.deepEqual(report.platformSummary.mercadolivre, { total: 1, valid: 1, publishable: 0 });
  assert.equal(report.rejected[0].errors[0], 'foto_https_ausente');

  const lookalikePath = path.join(tempDir, 'lookalike.json');
  fs.writeFileSync(lookalikePath, JSON.stringify([{ platform: 'mercadolivre', id: 'MLB124', title: 'Link curto suspeito', price: 100, stockStatus: 'in_stock', images: ['https://http2.mlstatic.com/img/1.jpg'], originalUrl: 'https://produto.mercadolivre.com.br/MLB-124', affiliateUrl: 'https://sub.meli.la/abc', isOfficialShortLink: true, linkStatus: 'ready', lastCheckedAt: now }]));
  const lookalike = spawnSync(process.execPath, [script, lookalikePath, '--dry-run', '--summary'], { encoding: 'utf8' });
  assert.equal(lookalike.status, 1, lookalike.stderr);
  assert.equal(JSON.parse(lookalike.stdout).valid, 0, 'a subdomain of the official shortener is not accepted as the exact official host');

  const bounded = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--platform=mercadolivre', '--limit=1'], { encoding: 'utf8' });
  assert.equal(bounded.status, 0, bounded.stderr);
  const boundedReport = JSON.parse(bounded.stdout);
  assert.equal(boundedReport.inputTotal, 3);
  assert.equal(boundedReport.total, 1);
  assert.deepEqual(Object.keys(boundedReport.platformSummary), ['mercadolivre']);

  const details = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose', '--platform=magalu', '--limit=1'], { encoding: 'utf8' });
  assert.equal(details.status, 0, details.stderr);
  const normalized = JSON.parse(details.stdout).details[0];
  assert.deepEqual(normalized.imageUrls, ['https://a-static.mlcdn.com.br/img/1.jpg', 'https://a-static.mlcdn.com.br/img/2.jpg']);
  assert.equal(normalized.installments, '3x sem juros');
  assert.equal(normalized.shipping, 'Frete grátis');
  assert.equal(normalized.coupon, 'CUPOM10');
  assert.equal(normalized.stockQuantity, null, 'quantidade não observada permanece nula');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1a: importer preserves stock evidence and downgrades contradictory in-stock zero quantity', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-stock-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'magalu', id: 'stock-1', title: 'Produto', price: 10, stockStatus: 'in_stock', stockQuantity: 0, stockEvidence: '0 unidades', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/produto/stock-1', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/stock-1', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: new Date().toISOString() }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const normalized = JSON.parse(result.stdout).details[0];
  assert.equal(normalized.stockQuantity, 0);
  assert.equal(normalized.stockStatus, 'unknown');
  assert.equal(normalized.stockEvidence, '0 unidades');
  fs.rmSync(tempDir, { recursive: true, force: true });
});
