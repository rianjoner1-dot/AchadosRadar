const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const script = path.join(projectRoot, 'scripts/import-catalog.mjs');

test('E1: importer rejects credentials embedded in original and affiliate URLs', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-url-credentials-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const common = {
    platform: 'magalu', title: 'Produto com URL autenticada', price: 10, stockStatus: 'in_stock',
    images: ['https://a-static.mlcdn.com.br/item.jpg'], storeAffiliateId: 'loja',
    linkStatus: 'ready', lastCheckedAt: new Date().toISOString(), offerObservedAt: new Date().toISOString()
  };
  fs.writeFileSync(sourcePath, JSON.stringify([
    { ...common, id: 'original-credentials', originalUrl: 'https://usuario:senha@www.magazineluiza.com.br/p/original-credentials', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/original-credentials' },
    { ...common, id: 'affiliate-credentials', originalUrl: 'https://www.magazineluiza.com.br/p/affiliate-credentials', affiliateUrl: 'https://usuario:senha@www.magazinevoce.com.br/loja/p/affiliate-credentials' }
  ]));

  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, 0);
  assert.ok(report.rejected.find(({ id }) => id === 'original-credentials').errors.includes('url_original_fora_da_allowlist'));
  assert.ok(report.rejected.find(({ id }) => id === 'affiliate-credentials').errors.includes('link_afiliado_ausente_ou_fora_da_allowlist'));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Magalu: importer carries Pix/card prices, caps gallery and keeps one safe video with poster', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-pix-video-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const now = new Date().toISOString();
  fs.writeFileSync(sourcePath, JSON.stringify([{
    platform: 'magalu', id: 'sku-pix-video', title: 'Produto com preço Pix e vídeo', price: 129,
    pixPrice: 129, cardPrice: 135.79, oldPrice: 153.8, installments: '2x de R$ 67,90 sem juros',
    rating: 4.7, reviewsCount: 321, specifications: [{ name: 'Potência', value: '1.500 W' }, { name: 'Voltagem', value: '220 V' }],
    stockStatus: 'in_stock', images: [1, 2, 3, 4].map((id) => `https://a-static.mlcdn.com.br/img/${id}.jpg`),
    videos: [
      { url: 'blob:https://ugc-magalu-videos.magazineluiza.com.br/session', poster_url: 'https://ugc-content-prd.magalu.com/video/thumbnails/sku-pix-video.jpg' },
      { url: 'https://ugc-content-prd.magalu.com/video/sku-pix-video.mp4', poster_url: 'https://ugc-content-prd.magalu.com/video/thumbnails/sku-pix-video.jpg' },
      { url: 'https://attacker.invalid/video.mp4' }
    ],
    originalUrl: 'https://www.magazineluiza.com.br/p/sku-pix-video/produto',
    affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/sku-pix-video/produto', storeAffiliateId: 'loja',
    linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now
  }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const item = JSON.parse(result.stdout).details[0];
  assert.equal(item.pixPrice, 129);
  assert.equal(item.cardPrice, 135.79);
  assert.equal(item.installments, '2x de R$ 67,90 sem juros');
  assert.equal(item.rating, 4.7);
  assert.equal(item.reviewsCount, 321);
  assert.deepEqual(item.specifications, [{ name: 'Potência', value: '1.500 W' }, { name: 'Voltagem', value: '220 V' }]);
  assert.equal(item.imageUrls.length, 3);
  assert.deepEqual(item.videos, [{ url: 'https://ugc-content-prd.magalu.com/video/sku-pix-video.mp4', poster_url: 'https://ugc-content-prd.magalu.com/video/thumbnails/sku-pix-video.jpg', display_order: 0 }]);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1: importer accepts macro fields, preserves image order and only publishes proven, in-stock links', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-import-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const now = new Date().toISOString();
  fs.writeFileSync(sourcePath, JSON.stringify([
    { platform: 'magalu', id: 'sku-1', title: 'Brinco prata', price: 45.9, stockStatus: 'in_stock', stockQuantity: null, images: ['https://a-static.mlcdn.com.br/img/1.jpg', 'https://a-static.mlcdn.com.br/img/2.jpg'], installments: '3x sem juros', shipping: 'Frete grátis', coupon: 'CUPOM10', originalUrl: 'https://www.magazineluiza.com.br/p/sku-1/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/sku-1/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now, refreshDueAt: new Date(Date.now() + 86400000).toISOString() },
    { platform: 'mercadolivre', id: 'MLB123', title: 'Fone bluetooth', price: 100, stockStatus: 'unknown', images: ['https://http2.mlstatic.com/img/1.jpg'], originalUrl: 'https://produto.mercadolivre.com.br/MLB-123', affiliateUrl: 'https://meli.la/aBc123', isOfficialShortLink: true, linkStatus: 'ready', lastCheckedAt: now },
    { platform: 'magalu', id: 'sku-2', title: 'Produto com imagem invasiva', price: 1, stockStatus: 'in_stock', images: ['https://example.com/track.png'], originalUrl: 'https://magazineluiza.com.br/p/sku-2', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/sku-2', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now }
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
  ], originalUrl: 'https://www.magazineluiza.com.br/p/sku-image-guard/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/sku-image-guard/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now }]));
  const unsafeImages = spawnSync(process.execPath, [script, unsafeImagesPath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(unsafeImages.status, 0, unsafeImages.stderr);
  assert.deepEqual(JSON.parse(unsafeImages.stdout).details[0].imageUrls, ['https://a-static.mlcdn.com.br/safe.jpg']);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1: Magalu affiliate links must match the configured store slug', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-magalu-store-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const now = new Date().toISOString();
  fs.writeFileSync(sourcePath, JSON.stringify([{
    platform: 'magalu', id: 'sku-wrong-store', title: 'Oferta de outra vitrine', price: 10,
    stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'],
    originalUrl: 'https://www.magazineluiza.com.br/p/sku-wrong-store/produto',
    affiliateUrl: 'https://www.magazinevoce.com.br/outra-vitrine/p/sku-wrong-store',
    storeAffiliateId: 'minha-vitrine', linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now
  }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, 1);
  assert.equal(report.publishable, 0, 'a valid Magalu URL for a different store cannot be published');
  assert.equal(report.notPublishableReasons.link_afiliado_nao_verificado, 1);
  assert.equal(report.details[0].linkStatus, 'broken');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1a: importer preserves stock evidence and downgrades contradictory in-stock zero quantity', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-stock-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'magalu', id: 'stock-1', title: 'Produto', price: 10, stockStatus: 'in_stock', stockQuantity: 0, stockEvidence: '0 unidades', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/stock-1/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/stock-1/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: new Date().toISOString() }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const normalized = JSON.parse(result.stdout).details[0];
  assert.equal(normalized.stockQuantity, 0);
  assert.equal(normalized.stockStatus, 'unknown');
  assert.equal(normalized.stockEvidence, '0 unidades');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1a: importer never assumes stock when the crawler did not observe availability', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-stock-unknown-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'magalu', id: 'stock-unknown', title: 'Produto sem estoque observado', price: 10, images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/stock-unknown/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/stock-unknown/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: new Date().toISOString(), offerObservedAt: new Date().toISOString() }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const normalized = JSON.parse(result.stdout).details[0];
  assert.equal(normalized.stockQuantity, null);
  assert.equal(normalized.stockStatus, 'unknown');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1c: missing or future offer observation time cannot make stock publishable or look fresh', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-observed-at-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const linkCheckedAt = new Date().toISOString();
  const base = { platform: 'magalu', title: 'Produto sem horário', price: 10, stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/time-guard/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/time-guard/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: linkCheckedAt, linkVerifiedAt: linkCheckedAt, verified_at: linkCheckedAt };
  fs.writeFileSync(sourcePath, JSON.stringify([
    { ...base, id: 'missing-time', originalUrl: 'https://www.magazineluiza.com.br/p/missing-time/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/missing-time/produto' },
    { ...base, id: 'future-time', originalUrl: 'https://www.magazineluiza.com.br/p/future-time/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/future-time/produto', collectedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }
  ]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.publishable, 0, `link checks are not offer observations: ${JSON.stringify(report)}`);
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
  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'magalu', id: 'collected-time', title: 'Produto coletado', price: 10, stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], originalUrl: 'https://www.magazineluiza.com.br/p/collected-time/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/collected-time/produto', storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: new Date().toISOString(), collectedAt }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--summary', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.publishable, 1);
  assert.equal(report.details[0].offerObservedAt, collectedAt);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1e: normal product imports require matching IDs in original and Magalu affiliate URLs', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-identity-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  const now = new Date().toISOString();
  const base = { platform: 'magalu', title: 'Produto com identidade', price: 10, stockStatus: 'in_stock', images: ['https://a-static.mlcdn.com.br/img/1.jpg'], storeAffiliateId: 'loja', linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now };
  fs.writeFileSync(sourcePath, JSON.stringify([{ ...base, id: 'wrong-original', originalUrl: 'https://www.magazineluiza.com.br/p/another-product/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/wrong-original/produto' }]));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--verbose'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const mismatchedOriginal = JSON.parse(result.stdout);
  assert.equal(mismatchedOriginal.valid, 0, 'the mismatched official product URL is rejected as an invalid row');
  assert.ok(mismatchedOriginal.rejected[0].errors.includes('id_externo_nao_corresponde_url_original'));

  fs.writeFileSync(sourcePath, JSON.stringify([{ platform: 'mercadolivre', id: 'MLB123456', title: 'Produto ML com ID divergente', price: 10, stockStatus: 'in_stock', images: ['https://http2.mlstatic.com/D_Q_NP_2X_123456-MLB123456-O.webp'], originalUrl: 'https://produto.mercadolivre.com.br/MLB-654321-produto', affiliateUrl: 'https://meli.la/short', isOfficialShortLink: true, linkStatus: 'ready', lastCheckedAt: now, offerObservedAt: now }]));
  const meliResult = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--verbose'], { encoding: 'utf8' });
  assert.equal(meliResult.status, 1, meliResult.stderr);
  const mismatchedMeli = JSON.parse(meliResult.stdout);
  assert.equal(mismatchedMeli.valid, 0, 'Mercado Livre imports reject an external ID different from the official product URL');
  assert.ok(mismatchedMeli.rejected[0].errors.includes('id_externo_nao_corresponde_url_original'));

  fs.writeFileSync(sourcePath, JSON.stringify([{ ...base, id: 'wrong-affiliate', originalUrl: 'https://www.magazineluiza.com.br/p/wrong-affiliate/produto', affiliateUrl: 'https://www.magazinevoce.com.br/loja/p/another-product/produto' }]));
  const affiliateResult = spawnSync(process.execPath, [script, sourcePath, '--dry-run', '--verbose'], { encoding: 'utf8' });
  assert.equal(affiliateResult.status, 0, affiliateResult.stderr);
  const report = JSON.parse(affiliateResult.stdout);
  assert.equal(report.valid, 1);
  assert.equal(report.publishable, 0, 'the affiliate link cannot be marked ready when it points to another SKU');
  assert.equal(report.details[0].linkStatus, 'broken');
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('E1b: only explicit marketplace-unavailable evidence can archive a product', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-image-recheck-'));
  const sourcePath = path.join(tempDir, 'catalog.json');
  fs.writeFileSync(sourcePath, JSON.stringify({ products: [], confirmedUnavailable: [
    { platform: 'magalu', externalId: 'sku-gone', originalUrl: 'https://www.magazineluiza.com.br/p/sku-gone', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'explicit_not_found_without_title_or_price', evidence: 'explicit_not_found_without_title_or_price' },
    { platform: 'mercadolivre', externalId: 'MLB-uncertain', originalUrl: 'https://produto.mercadolivre.com.br/MLB-uncertain', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'search_returned_no_results', evidence: 'search_returned_no_results' },
    { platform: 'magalu', externalId: 'sku-other', originalUrl: 'https://www.magazineluiza.com.br/p/sku-gone', marketplaceUnavailable: true, marketplaceUnavailableEvidence: 'explicit_not_found_without_title_or_price', evidence: 'explicit_not_found_without_title_or_price' }
  ] }));
  const result = spawnSync(process.execPath, [script, sourcePath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.archiveCandidates, 1);
  assert.equal(report.valid, 0, 'pending archival evidence is counted separately from publishable catalog products');
  assert.equal(report.rejected[0].errors[0], 'evidencia_de_indisponibilidade_ausente_ou_invalida');
  assert.ok(report.rejected.some((entry) => entry.id === 'sku-other'), 'a valid not-found claim cannot archive an external ID that differs from its product URL');
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
