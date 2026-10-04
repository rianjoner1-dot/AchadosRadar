const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const script = path.join(projectRoot, 'scripts/local-catalog-bridge.mjs');

test('site catalog bridge uses dedicated port 6876', async () => {
  const bridgeSource = await fs.readFile(script, 'utf8');
  assert.match(bridgeSource, /LOCAL_CATALOG_BRIDGE_PORT \|\| 6876/);
});

test('E1: local bridge accepts extension posts, upserts safely, and rejects web origins', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-bridge-'));
  const dataPath = path.join(tempDir, 'catalog.json');
  const bridgeEnv = { ...process.env, LOCAL_CATALOG_BRIDGE_PORT: '0', LOCAL_CATALOG_BRIDGE_DATA: dataPath };
  delete bridgeEnv.PUBLIC_SUPABASE_URL;
  delete bridgeEnv.SUPABASE_SERVICE_ROLE_KEY;
  const child = spawn(process.execPath, [script], {
    cwd: projectRoot,
    env: bridgeEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  let output = '';
  try {
    const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Bridge startup timed out: ${stderr}`)), 5000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const line = output.split(/\r?\n/).find((value) => value.startsWith('{"event":"ready",'));
      if (!line) return;
      clearTimeout(timeout);
      resolve(`http://127.0.0.1:${JSON.parse(line).port}`);
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Bridge exited (${code}): ${stderr}`)); });
    });
    const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;
    const first = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'magalu', id: 'SKU-1', title: 'Produto exemplo', originalUrl: 'https://www.magazineluiza.com.br/p/SKU-1/produto', affiliateUrl: 'https://www.magazinevoce.com.br/minhaloja/p/SKU-1', linkStatus: 'ready', price: 19.9, pixPrice: 18.9, cardPrice: 19.9, rating: 4.8, reviewsCount: 23, specifications: [{ name: 'Potência', value: '1.500 W' }, { name: 'Voltagem', value: '220 V' }], stockStatus: 'unknown', stockEvidence: 'Quantidade não exibida', images: [
        'https://a-static.mlcdn.com.br/1.jpg', 'https://a-static.mlcdn.com.br/2.jpg',
        'https://user:pass@a-static.mlcdn.com.br/private.jpg', 'https://a-static.mlcdn.com.br:8443/custom-port.jpg',
        'http://a-static.mlcdn.com.br/insecure.jpg', 'https://a-static.mlcdn.com.br.attacker.invalid/lookalike.jpg'
      ], videos: [
        { url: 'https://ugc-content-prd.magalu.com/video/product.mp4', posterUrl: 'https://ugc-content-prd.magalu.com/video/poster.jpg' },
        { url: 'https://attacker.invalid/video.mp4' }
      ], installments: '3x sem juros', shipping: 'Frete grátis', coupon: 'CUPOM10' })
    });
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('access-control-allow-origin'), extensionOrigin);

    const update = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'magalu', id: 'SKU-1', title: 'Produto exemplo atualizado', price: 18.9 })
    });
    assert.equal(update.status, 200);
    const catalog = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    assert.equal(catalog.products.length, 1);
    assert.equal(catalog.products[0].title, 'Produto exemplo atualizado');
    assert.deepEqual(catalog.products[0].images, ['https://a-static.mlcdn.com.br/1.jpg', 'https://a-static.mlcdn.com.br/2.jpg']);
    assert.equal(catalog.products[0].coupon, 'CUPOM10');
    assert.equal(catalog.products[0].pixPrice, 18.9, 'the bridge keeps the observed Pix price for catalog import');
    assert.equal(catalog.products[0].cardPrice, 19.9, 'the bridge keeps the observed card price separately');
    assert.equal(catalog.products[0].rating, 4.8);
    assert.equal(catalog.products[0].reviewsCount, 23);
    assert.deepEqual(catalog.products[0].specifications, [{ name: 'Potência', value: '1.500 W' }, { name: 'Voltagem', value: '220 V' }]);
    assert.deepEqual(catalog.products[0].videos, [{ url: 'https://ugc-content-prd.magalu.com/video/product.mp4', posterUrl: 'https://ugc-content-prd.magalu.com/video/poster.jpg' }], 'the bridge keeps one safe marketplace video and its approved poster');
    assert.equal(catalog.products[0].installments, '3x sem juros', 'a partial refresh retains installment facts it did not replace');
    assert.equal(catalog.products[0].shipping, 'Frete grátis', 'a partial refresh retains shipping facts it did not replace');
    assert.equal(catalog.products[0].affiliateUrl, 'https://www.magazinevoce.com.br/minhaloja/p/SKU-1', 'a partial refresh retains the saved affiliate destination');
    assert.equal(catalog.products[0].stockStatus, 'unknown', 'omitted stock status is not fabricated during upsert');

    const clearPixPrice = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'magalu', id: 'SKU-1', title: 'Produto exemplo atualizado', pixPrice: null })
    });
    assert.equal(clearPixPrice.status, 200);
    const withoutStalePix = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    assert.equal(withoutStalePix.products[0].pixPrice, null, 'an explicit missing Pix price clears a stale value after re-observation');
    assert.equal(withoutStalePix.products[0].cardPrice, 19.9, 'a Pix-only update preserves the separate card price');
    assert.equal(withoutStalePix.products[0].videos.length, 1, 'a partial refresh preserves the previously captured product video');

    for (const mismatchedIdentity of [
      { id: 'SKU-ORIGINAL-MISMATCH', originalUrl: 'https://www.magazineluiza.com.br/p/OTHER-SKU/produto', affiliateUrl: 'https://www.magazinevoce.com.br/minhaloja/p/SKU-ORIGINAL-MISMATCH' },
      { id: 'SKU-AFFILIATE-MISMATCH', originalUrl: 'https://www.magazineluiza.com.br/p/SKU-AFFILIATE-MISMATCH/produto', affiliateUrl: 'https://www.magazinevoce.com.br/minhaloja/p/OTHER-SKU' }
    ]) {
      const invalidIdentity = await fetch(`${baseUrl}/api/save_product`, {
        method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'magalu', title: 'Produto com URL incompatível', ...mismatchedIdentity })
      });
      assert.equal(invalidIdentity.status, 422, 'normal product upserts reject an ID that does not match its marketplace URL');
    }
    assert.equal(JSON.parse(await fs.readFile(dataPath, 'utf8')).products.length, 1, 'mismatched products never enter the local catalog');

    const mismatchedMeli = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'mercadolivre', id: 'MLB123456', title: 'Produto ML incorreto', originalUrl: 'https://produto.mercadolivre.com.br/MLB-654321-produto', affiliateUrl: 'https://meli.la/short' })
    });
    assert.equal(mismatchedMeli.status, 422, 'Mercado Livre imports also reject product IDs that do not match the official URL');

    const quantityProduct = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'magalu', id: 'SKU-QUANTITY', title: 'Produto com estoque observado', stockQuantity: '7', stockStatus: 'in_stock' })
    });
    assert.equal(quantityProduct.status, 201);
    const withQuantity = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    assert.equal(withQuantity.products.find((product) => product.id === 'SKU-QUANTITY').stockQuantity, 7, 'numeric stock quantities are normalized before storing');

    for (const invalidStock of [
      { stockStatus: 'available' },
      { stockQuantity: -1 },
      { stockQuantity: 1.5 },
      { stockQuantity: 'not observed' }
    ]) {
      const invalid = await fetch(`${baseUrl}/api/save_product`, {
        method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'magalu', id: 'SKU-INVALID', title: 'Invalid inventory data', ...invalidStock })
      });
      assert.equal(invalid.status, 422);
    }
    assert.equal(JSON.parse(await fs.readFile(dataPath, 'utf8')).products.length, 2, 'invalid stock observations never enter the catalog');
    assert.equal(catalog.products[0].stockEvidence, 'Quantidade não exibida');

    const amazonProduct = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'amazon', id: 'B0ABC12345', title: 'Amazon product', originalUrl: 'https://www.amazon.com.br/dp/B0ABC12345' })
    });
    assert.equal(amazonProduct.status, 201, 'Magalu and Mercado Livre identity checks do not break other supported crawler stores');

    const report = { platform: 'magalu', externalId: 'SKU-1', originalUrl: 'https://www.magazineluiza.com.br/p/SKU-1/produto', evidence: 'explicit_not_found_without_title_or_price', confirmedAt: new Date().toISOString() };
    const mismatchedIdentity = await fetch(`${baseUrl}/api/catalog/unavailable`, { method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ ...report, externalId: 'SKU-OTHER' }) });
    assert.equal(mismatchedIdentity.status, 422, 'a report cannot archive an ID that differs from its exact product URL');
    assert.equal(JSON.parse(await fs.readFile(dataPath, 'utf8')).confirmedUnavailable?.length ?? 0, 0, 'a mismatched report is never queued');
    const unavailable = await fetch(`${baseUrl}/api/catalog/unavailable`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify(report)
    });
    assert.equal(unavailable.status, 202);
    let pending = await fetch(`${baseUrl}/api/catalog/unavailable`).then((response) => response.json());
    assert.equal(pending.reports.length, 1);
    assert.equal(pending.reports[0].marketplaceUnavailableEvidence, report.evidence);

    const mismatchedUrl = await fetch(`${baseUrl}/api/catalog/unavailable`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ ...report, originalUrl: 'https://produto.mercadolivre.com.br/MLB-1' })
    });
    assert.equal(mismatchedUrl.status, 422, 'bridge rejects a report whose URL does not identify the saved product');
    const invalidEvidence = await fetch(`${baseUrl}/api/catalog/unavailable`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify({ ...report, evidence: 'out_of_stock' })
    });
    assert.equal(invalidEvidence.status, 422, 'stock and transient failures are not archival evidence');

    const cleared = await fetch(`${baseUrl}/api/catalog/unavailable/clear`, {
      method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify(report)
    });
    assert.equal(cleared.status, 200);
    pending = await fetch(`${baseUrl}/api/catalog/unavailable`).then((response) => response.json());
    assert.equal(pending.reports.length, 0, 'successful archival can clear the pending report');

    const statusResponse = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json();
    assert.equal(status.total_products_stored, 3, 'old extension dashboards receive the current product count');
    assert.equal(status.status, 'online');

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.products, 3, 'existing health clients keep their product count');
    assert.equal(health.ok, true);

    const blockedOrigin = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: 'https://example.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'mercadolivre', id: 'MLB-2', title: 'Não deve gravar' })
    });
    assert.equal(blockedOrigin.status, 403);
    const blockedArchive = await fetch(`${baseUrl}/api/catalog/unavailable/clear`, {
      method: 'POST', headers: { origin: 'https://example.invalid', 'content-type': 'application/json' }, body: JSON.stringify(report)
    });
    assert.equal(blockedArchive.status, 403, 'untrusted web pages cannot clear pending evidence');
    assert.equal(JSON.parse(await fs.readFile(dataPath, 'utf8')).products.length, 3);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('confirmed missing products archive through the local service-role bridge and retry safely', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-archive-bridge-'));
  const dataPath = path.join(tempDir, 'catalog.json');
  const archiveCalls = [];
  let firstArchiveStarted;
  const firstArchiveRequest = new Promise((resolve) => { firstArchiveStarted = resolve; });
  let releaseFirstArchive;
  const supabase = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/rest/v1/rpc/archive_unavailable_catalog_item') {
      let body = '';
      for await (const chunk of req) body += chunk;
      archiveCalls.push({ body: JSON.parse(body), apikey: req.headers.apikey, authorization: req.headers.authorization });
      if (archiveCalls.length === 1) {
        firstArchiveStarted();
        await new Promise((resolve) => { releaseFirstArchive = resolve; });
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('{"message":"temporarily unavailable"}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('true');
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/rest/v1/products?')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('[]');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => supabase.listen(0, '127.0.0.1', resolve));
  const childEnv = { ...process.env, LOCAL_CATALOG_BRIDGE_PORT: '0', LOCAL_CATALOG_BRIDGE_DATA: dataPath,
    PUBLIC_SUPABASE_URL: `http://127.0.0.1:${supabase.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'test-service-role' };
  const child = spawn(process.execPath, [script], { cwd: projectRoot, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  let output = '';
  try {
    const baseUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Bridge startup timed out: ${stderr}`)), 5000);
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        const line = output.split(/\r?\n/).find((value) => value.startsWith('{"event":"ready",'));
        if (!line) return;
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${JSON.parse(line).port}`);
      });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Bridge exited (${code}): ${stderr}`)); });
    });
    const extensionOrigin = `chrome-extension://${'b'.repeat(32)}`;
    const product = { platform: 'magalu', id: 'SKU-ARCHIVE', title: 'Produto que sumiu', originalUrl: 'https://www.magazineluiza.com.br/p/SKU-ARCHIVE/produto', price: 19.9 };
    const save = await fetch(`${baseUrl}/api/save_product`, { method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify(product) });
    assert.equal(save.status, 201);
    const report = { platform: product.platform, externalId: product.id, originalUrl: product.originalUrl, evidence: 'explicit_not_found_without_title_or_price' };

    const pendingResponse = await fetch(`${baseUrl}/api/catalog/unavailable`, { method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify(report) });
    const pendingBody = await pendingResponse.json();
    assert.equal(pendingResponse.status, 202, JSON.stringify(pendingBody));
    assert.deepEqual(pendingBody, { ok: true, pending: true, id: product.id, total: 1, archiveQueued: true });
    await firstArchiveRequest;
    let catalog = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    assert.equal(catalog.confirmedUnavailable.length, 1, 'temporary Supabase failure keeps the confirmed report durable');

    // Request a retry while the first RPC is still in flight; it must run immediately afterward.
    const retryResponse = await fetch(`${baseUrl}/api/catalog/unavailable`, { method: 'POST', headers: { origin: extensionOrigin, 'content-type': 'application/json' }, body: JSON.stringify(report) });
    const retry = await retryResponse.json();
    assert.equal(retryResponse.status, 202, JSON.stringify(retry));
    assert.equal(retry.archiveQueued, true);
    releaseFirstArchive();
    await waitFor(async () => {
      const current = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      return current.confirmedUnavailable.length === 0;
    });
    catalog = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    assert.equal(catalog.confirmedUnavailable.length, 0, 'report clears only after the remote RPC confirms archival');
    assert.equal(archiveCalls.length, 2);
    assert.deepEqual(archiveCalls[1].body, { p_platform: 'magalu', p_external_id: 'SKU-ARCHIVE' });
    assert.equal(archiveCalls[1].apikey, 'test-service-role');
    assert.equal(archiveCalls[1].authorization, 'Bearer test-service-role');
    assert.equal(JSON.stringify(retry).includes('test-service-role'), false, 'service role never returns to the extension');
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await new Promise((resolve) => supabase.close(resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

async function waitFor(check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('timed out waiting for asynchronous archive processing');
}
