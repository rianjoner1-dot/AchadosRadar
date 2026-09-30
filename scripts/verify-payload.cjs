// Confere o payload da vitrine e o orçamento cumulativo do artefato estático local.
// Imagens servidas diretamente por marketplaces são de terceiros e não entram no total da Vercel.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(projectRoot, 'tests/fixtures/sample_20_cards.json');
const assetsRoot = path.join(projectRoot, '.vercel/output/static/_astro');
const staticRoot = path.join(projectRoot, '.vercel/output/static');
const MAX_CATALOG_JSON_BYTES = 100 * 1024;
const MAX_LOCAL_TRANSFER_BYTES = 5 * 1024 * 1024;
const GZIP_EXTENSIONS = /\.(?:html|css|js|json|svg|txt|xml)$/i;

function collectLocalAssets(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectLocalAssets(fullPath);
    return /\.(?:js|css)$/i.test(entry.name) ? [fullPath] : [];
  });
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

if (!fs.existsSync(fixturePath)) throw new Error(`Fixture ausente: ${fixturePath}`);
const cards = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
if (!Array.isArray(cards) || cards.length !== 20) throw new Error(`A fixture deve conter 20 cards; recebeu ${cards?.length ?? 'formato inválido'}.`);

const catalogBytes = Buffer.byteLength(JSON.stringify(cards), 'utf8');
console.log(`[Vitrine] JSON inicial de 20 cards: ${catalogBytes} bytes (${(catalogBytes / 1024).toFixed(2)} KB).`);
if (catalogBytes > MAX_CATALOG_JSON_BYTES) throw new Error('O JSON inicial da vitrine excede 100 KB.');

const assetFiles = collectLocalAssets(assetsRoot);
if (!assetFiles.length) throw new Error('Assets compilados ausentes; rode o build Vercel antes da auditoria.');
const rawAssetBytes = assetFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const gzipAssetBytes = assetFiles.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0);
console.log(`[Assets locais] ${assetFiles.length} arquivos JS/CSS: ${rawAssetBytes} bytes sem compressão; ${gzipAssetBytes} bytes com gzip estimado.`);
if (gzipAssetBytes > MAX_LOCAL_TRANSFER_BYTES) {
  throw new Error(`Assets JS/CSS excedem o orçamento comprimido de 5 MiB (${gzipAssetBytes} bytes).`);
}
if (!fs.existsSync(staticRoot)) throw new Error(`Artefato estático ausente: ${staticRoot}`);
const staticFiles = collectFiles(staticRoot);
const estimatedTransferBytes = staticFiles.reduce((sum, file) => {
  const content = fs.readFileSync(file);
  return sum + (GZIP_EXTENSIONS.test(file) ? zlib.gzipSync(content, { level: 9 }).length : content.length);
}, 0);
console.log(`[Transferência estática cumulativa] ${staticFiles.length} arquivos locais: ${estimatedTransferBytes} bytes estimados na rede (texto gzip; binários sem compressão).`);
if (estimatedTransferBytes > MAX_LOCAL_TRANSFER_BYTES) throw new Error(`Artefato estático excede o orçamento cumulativo de 5 MiB (${estimatedTransferBytes} bytes).`);
console.log('[Orçamento aprovado] JSON demonstrativo <= 100 KB; JS/CSS e artefato estático cumulativo abaixo de 5 MiB. Imagens externas não estão incluídas.');
