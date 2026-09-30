const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(projectRoot, 'tests/fixtures/sample_20_cards.json');
const vercelFunctionsPath = path.join(projectRoot, '.vercel/output/functions');
const staticOutputPath = path.join(projectRoot, '.vercel/output/static');
const MAX_LOCAL_TRANSFER_BYTES = 5 * 1024 * 1024;
const GZIP_EXTENSIONS = /\.(?:html|css|js|json|svg|txt|xml)$/i;

test('C4: 20-card catalog response fixture must be <= 100 KB JSON', () => {
  assert.ok(fs.existsSync(fixturePath), 'Fixture de 20 cards deve existir');
  const cards = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(cards.length, 20, 'Fixture deve ter exatamente 20 cards');

  const jsonBytes = Buffer.byteLength(JSON.stringify(cards), 'utf8');
  assert.ok(jsonBytes <= 100 * 1024, `Payload deve ser <= 100 KB (atual: ${(jsonBytes / 1024).toFixed(2)} KB)`);
});

test('C4a: Published JS/CSS assets must fit the 5 MiB compressed local-asset budget', () => {
  const assetsDir = path.join(staticOutputPath, '_astro');
  assert.ok(fs.existsSync(assetsDir), 'Assets compilados devem existir após build');
  const files = collectFiles(assetsDir).filter((file) => /\.(?:js|css)$/i.test(file));
  assert.ok(files.length > 0, 'Build deve conter arquivos JS/CSS');
  const gzipBytes = files.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0);
  assert.ok(gzipBytes <= 5 * 1024 * 1024, `Assets JS/CSS comprimidos devem ficar <= 5 MiB (atual: ${gzipBytes} bytes)`);
});

test('C4b: Entire local Vercel static artifact must fit the 5 MiB transfer budget', () => {
  assert.ok(fs.existsSync(staticOutputPath), 'Artefato estático Vercel deve existir após build');
  const files = collectFiles(staticOutputPath);
  assert.ok(files.length > 0, 'Build deve conter arquivos estáticos');
  const transferBytes = files.reduce((sum, file) => {
    const content = fs.readFileSync(file);
    return sum + (GZIP_EXTENSIONS.test(file) ? zlib.gzipSync(content, { level: 9 }).length : content.length);
  }, 0);
  assert.ok(transferBytes <= MAX_LOCAL_TRANSFER_BYTES, `Artefato estático cumulativo deve ficar <= 5 MiB (atual: ${transferBytes} bytes)`);
});

test('C2: All fixture cards must contain sellerName, sellerId, storeName, storeAffiliateId and valid prices', () => {
  const cards = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  for (const card of cards) {
    assert.ok(card.id, 'Card deve ter ID');
    assert.ok(card.title, 'Card deve ter título');
    assert.ok(card.price > 0, 'Preço deve ser positivo');
    assert.ok(card.sellerName, 'sellerName deve estar preservado');
    assert.ok(typeof card.sellerId === 'string', 'sellerId deve ser string (mesmo que vazia)');
    assert.ok(card.storeName, 'storeName deve estar preservado');
    assert.ok(card.storeAffiliateId, 'storeAffiliateId deve estar preservado');
    assert.ok(['mercadolivre', 'magalu'].includes(card.platform), 'Platform deve ser mercadolivre ou magalu');
  }
});

test('C3: Serverless function count must be <= 4 (hard limit < 12)', () => {
  let count = 0;
  if (fs.existsSync(vercelFunctionsPath)) count = fs.readdirSync(vercelFunctionsPath, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name.endsWith('.func')).length;
  else if (fs.existsSync(path.join(projectRoot, 'src/pages/api'))) count = countFiles(path.join(projectRoot, 'src/pages/api'));
  assert.ok(count <= 4, `Contagem de funções deve ser <= 4 (atual: ${count})`);
  assert.ok(count < 12, `Contagem de funções não pode atingir o teto de 12`);
});

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => sum + (entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1), 0);
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

test('C1: Vercel artifact must contain static product pages, dynamic runtime and no secrets', () => {
  assert.ok(fs.existsSync(staticOutputPath), 'Artefato estático da Vercel deve existir após build');
  assert.ok(fs.existsSync(path.join(staticOutputPath, 'produto/MLB3299039091/index.html')), 'Página estática de demonstração deve existir');
  assert.ok(fs.existsSync(path.join(staticOutputPath, 'robots.txt')), 'robots.txt deve existir no artefato');
  assert.ok(fs.existsSync(vercelFunctionsPath), 'Runtime SSR da Vercel deve existir');

  // Varredura de segredos em arquivos gerados
  function scanForSecrets(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanForSecrets(fullPath);
      } else if (entry.isFile() && /\.(html|js|css)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!content.includes('service_role'), `Arquivo ${entry.name} não pode conter service_role`);
        assert.ok(!content.includes('SUPABASE_SECRET_KEY'), `Arquivo ${entry.name} não pode conter SUPABASE_SECRET_KEY`);
      }
    }
  }
  scanForSecrets(staticOutputPath);
  assert.ok(fs.existsSync(path.join(vercelFunctionsPath, '_render.func/.vc-config.json')), 'Rotações SSR devem estar agrupadas no runtime Vercel');
});
