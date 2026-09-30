const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const script = path.join(projectRoot, 'scripts/local-catalog-bridge.mjs');

test('E1: local bridge accepts extension posts, upserts safely, and rejects web origins', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-bridge-'));
  const dataPath = path.join(tempDir, 'catalog.json');
  const child = spawn(process.execPath, [script], {
    cwd: projectRoot,
    env: { ...process.env, LOCAL_CATALOG_BRIDGE_PORT: '0', LOCAL_CATALOG_BRIDGE_DATA: dataPath },
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
      body: JSON.stringify({ platform: 'magalu', id: 'SKU-1', title: 'Produto exemplo', price: 19.9, stockStatus: 'unknown', images: ['https://a-static.mlcdn.com.br/1.jpg', 'https://a-static.mlcdn.com.br/2.jpg'], installments: '3x sem juros', shipping: 'Frete grátis', coupon: 'CUPOM10' })
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

    const blockedOrigin = await fetch(`${baseUrl}/api/save_product`, {
      method: 'POST', headers: { origin: 'https://example.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'mercadolivre', id: 'MLB-2', title: 'Não deve gravar' })
    });
    assert.equal(blockedOrigin.status, 403);
    assert.equal(JSON.parse(await fs.readFile(dataPath, 'utf8')).products.length, 1);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
