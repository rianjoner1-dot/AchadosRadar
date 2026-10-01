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
    { platform: 'magalu', id: 'sku-1', title: 'Brinco prata', price: 45.9, stockStatus: 'in_stock', stockQuantity: null, images: ['https://a-static.mlcdn.com.br/img/1.jpg', 'https://a-static.mlcdn.com.br/img/2.jpg'], installments: '3x sem juros', shipping: 'Frete grátis', coupon: 'CUPOM10', originalUrl: 'https://www.magazineluiza.com.br/p/produto/sku-1', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/sku-1', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now, refreshDueAt: new Date(Date.now() + 86400000).toISOString() },
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
  assert.equal(normalized.offerObservedAt, now, 'o importador preserva o horário real de coleta');

  const unsafeImagesPath = path.join(tempDir, 'unsafe-images.json');
  fs.writeFileSync(unsafeImagesPath, JSON.stringify([{ platform: 'magalu', id: 'sku-image-guard', title: 'Imagens com formato inseguro', price: 10, stockStatus: 'in_stock', images: [
    'https://a-static.mlcdn.com.br/safe.jpg',
    'https://user:pass@a-static.mlcdn.com.br/credentials.jpg',
    'https://a-static.mlcdn.com.br:8443/custom-port.jpg',
    'http://a-static.mlcdn.com.br/insecure.jpg',
    'https://a-static.mlcdn.com.br.attacker.invalid/lookalike.jpg'
  ], originalUrl: 'https://www.magazineluiza.com.br/p/produto/sku-image-guard', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/sku-image-guard', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now }]));
  const unsafeImages = spawnSync(process.execPath, [script, unsafeImagesPath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(unsafeImages.status, 0, unsafeImages.stderr);
  assert.deepEqual(JSON.parse(unsafeImages.stdout).details[0].imageUrls, ['https://a-static.mlcdn.com.br/safe.jpg']);
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

test('E1c: missing or future offer observation time cannot make stock publishable or look fresh', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-observed-at-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const base = { platform: 'magalu', title: 'Produto sem horário', price: 10, stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/produto/time-guard', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/time-guard', storeAffiliateId: 'loja', linkStatus: 'ready' };
  fs.writeFileSync(sourcePath, JSON.stringify([{ ...base, id: 'missing-time' }, { ...base, id: 'future-time', collectedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.publishable, 0, 'sem verificação do link e sem horário válido nenhum item pode ser publicado');
  assert.equal(report.notPublishableReasons.oferta_sem_horario_de_observacao, 2);
  assert.equal(report.details[0].stockStatus, 'unknown');
  assert.equal(report.details[0].offerObservedAt, '1970-01-01T00:00:00.000Z');
  assert.equal(report.details[1].stockStatus, 'unknown', 'data futura não pode validar o estoque observado');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1d: collectedAt is accepted as the actual offer observation timestamp', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-collected-at-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const collectedAt = new Date(Date.now() - 60 * 1000).toISOString();
  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'magalu', id: 'collected-time', title: 'Produto coletado', price: 10, stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/produto/collected-time', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/produto/collected-time', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: new Date().toISOString(), collectedAt }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.publishable, 1);
  assert.equal(report.details[0].offerObservedAt, collectedAt);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1b: only explicit marketplace-unavailable evidence can archive a product', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-image-recheck-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  fs.writeFileSync(sourcePath, JSON.stringify({ products: [], confirmedUnavailable: [
    { platform: 'magalu', externalId: 'sku-gone', originalUrl: 'https://www.magazineluiza.com.br/p/sku-gone', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'explicit_not_found_without_title_or_price', evidence: 'explicit_not_found_without_title_or_price' },
    { platform: 'mercadolivre', externalId: 'MLB-uncertain', originalUrl: 'https://produto.mercadolivre.com.br/MLB-uncertain', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'search_returned_no_results', evidence: 'search_returned_no_results' }
  ] }));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.archiveCandidates, 1);
  assert.equal(report.valid, 0, 'pending archival evidence is counted separately from publishable catalog products');
  assert.equal(report.rejected[0].errors[0], 'evidencia_de_indisponibilidade_ausente_ou_invalida');
  const pendingPath = path.join(tempDir, 'pending.json');
  fs.writeFileSync(pendingPath, JSON.stringify([
    { platform: 'magalu', externalId: 'sku-gone', originalUrl: 'https://www.magazineluiza.com.br/p/sku-gone', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'explicit_not_found_without_title_or_price' },
    { platform: 'mercadolivre', externalId: 'MLB-uncertain', originalUrl: 'https://produto.mercadolivre.com.br/MLB-uncertain', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'search_returned_no_results' }
  ]));
  const externalQueue = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary'], { encoding: 'utf8', env: { ...process.env, CONFIRMED_UNAVAILABLE_REPORTS: pendingPath } });
  assert.equal(externalQueue.status, 1, externalQueue.stderr);
  assert.equal(JSON.parse(externalQueue.stdout).archiveCandidates, 1, 'dry-run reads the separate local bridge queue without network writes');
  fs.rmSync(tempDir, { recursive: true, force: true });
});
