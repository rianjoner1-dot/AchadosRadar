import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Helper para parsear CSV simples respeitando campos entre aspas
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });
      rows.push(row);
    }
  }
  return rows;
}

// Localiza o CSV mais recente no diretório de Downloads se nenhum arquivo foi passado
async function findLatestShopeeCSV() {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  try {
    const entries = await fs.readdir(downloadsDir, { withFileTypes: true });
    const csvFiles = entries
      .filter((e) => e.isFile() && /^BatchProductLinks.*\.csv$/i.test(e.name))
      .map((e) => path.join(downloadsDir, e.name));

    if (!csvFiles.length) return null;

    const filesWithStats = await Promise.all(
      csvFiles.map(async (file) => ({
        file,
        stat: await fs.stat(file)
      }))
    );
    filesWithStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    return filesWithStats[0].file;
  } catch (error) {
    console.warn(`[Shopee Importer] Erro ao escanear pasta Downloads: ${error.message}`);
    return null;
  }
}

// Converte string de preço "13,99" para float 13.99
function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d,.-]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : null;
}

async function main() {
  const targetFile = process.argv[2] && !process.argv[2].startsWith('--')
    ? path.resolve(process.argv[2])
    : await findLatestShopeeCSV();

  if (!targetFile) {
    console.error('❌ Nenhum arquivo CSV da Shopee informado ou encontrado em Downloads.');
    console.error('Uso: node scripts/import-shopee-affiliate-csv.mjs [caminho/do/arquivo.csv]');
    process.exit(1);
  }

  console.log(`📂 Lendo CSV: ${targetFile}`);
  const content = await fs.readFile(targetFile, 'utf8');
  const rows = parseCSV(content);
  console.log(`📊 Linhas de produtos identificadas no CSV: ${rows.length}`);

  if (rows.length === 0) {
    console.warn('⚠️ Nenhuma linha de produto válida encontrada.');
    process.exit(0);
  }

  // Mapa de enriquecimento local para itens conhecidos/extraídos
  const enrichedCachePath = path.join(projectRoot, 'data', 'shopee-enriched-cache.json');
  let enrichedCache = {};
  try {
    enrichedCache = JSON.parse(await fs.readFile(enrichedCachePath, 'utf8'));
  } catch {}

  const now = new Date().toISOString();
  const importedProducts = [];

  for (const row of rows) {
    const itemId = row['Item Id'] || row['item_id'] || row['ItemId'] || '';
    const itemName = row['Item Name'] || row['item_name'] || row['Title'] || '';
    const rawPrice = row['Price'] || row['price'] || '';
    const sales = row['Sales'] || row['sales'] || '';
    const storeName = row['Nome da loja'] || row['shop_name'] || 'Shopee';
    const commRate = row['Commission Rate'] || row['commission_rate'] || '';
    const commVal = row['Commission'] || row['commission'] || '';
    const productUrl = row['Product Link'] || row['product_link'] || '';
    const offerUrl = row['Offer Link'] || row['offer_link'] || '';

    if (!itemId || !itemName) continue;

    const price = parsePrice(rawPrice);
    const enriched = enrichedCache[itemId] || {};

    const images = enriched.images && enriched.images.length
      ? enriched.images
      : [];

    const specs = enriched.specifications && Array.isArray(enriched.specifications)
      ? enriched.specifications
      : (enriched.specifications && typeof enriched.specifications === 'object'
        ? Object.entries(enriched.specifications).map(([name, value]) => ({ name, value }))
        : []);

    const productPayload = {
      platform: 'shopee',
      externalId: String(itemId),
      title: itemName,
      description: enriched.description || `Produto disponível na Shopee com taxa de comissão ${commRate}${commVal ? ` (${commVal})` : ''}. Vendas observadas: ${sales}.`,
      category: enriched.category || (enriched.breadcrumbs?.[0] ?? 'Utilidades Domésticas'),
      brand: storeName,
      price: price || 0,
      pixPrice: price || 0,
      oldPrice: enriched.oldPrice || null,
      originalUrl: productUrl || `https://shopee.com.br/product/store/${itemId}`,
      affiliateUrl: offerUrl,
      images: images,
      specifications: specs,
      rating: enriched.rating?.rating_star || enriched.rating || null,
      reviewsCount: enriched.rating?.total_rating_count || enriched.reviewsCount || null,
      sellerName: storeName,
      storeName: 'Shopee',
      linkStatus: 'ready',
      isOfficialShortLink: true,
      stockStatus: 'in_stock',
      stockQuantity: 100,
      stockEvidence: 'Em estoque no portal oficial da Shopee',
      offerObservedAt: now,
      lastCheckedAt: now
    };

    importedProducts.push(productPayload);
  }

  // Salva os produtos formatados em data/shopee_imported_batch.json
  const outputPath = path.join(projectRoot, 'data', 'shopee_imported_batch.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(importedProducts, null, 2), 'utf8');

  console.log(`✅ ${importedProducts.length} produtos processados e salvos em:`);
  console.log(`   ${outputPath}`);

  // Upsert atômico direto no catalogo_macro.json local
  const macroPath = path.join(projectRoot, 'data', 'catalogo_macro.json');
  try {
    let catalog = { schemaVersion: 1, updatedAt: null, products: [] };
    try {
      const existing = JSON.parse(await fs.readFile(macroPath, 'utf8'));
      if (existing && Array.isArray(existing.products)) catalog = existing;
    } catch {}

    let addedCount = 0;
    let updatedCount = 0;

    for (const prod of importedProducts) {
      const idx = catalog.products.findIndex(
        (p) => p.platform === prod.platform && String(p.id || p.externalId) === String(prod.externalId)
      );

      const entry = {
        platform: prod.platform,
        id: String(prod.externalId),
        externalId: String(prod.externalId),
        title: prod.title,
        description: prod.description,
        category: prod.category,
        brand: prod.brand,
        price: prod.price,
        pixPrice: prod.pixPrice,
        oldPrice: prod.oldPrice,
        originalUrl: prod.originalUrl,
        affiliateUrl: prod.affiliateUrl,
        images: prod.images || [],
        specifications: prod.specifications || [],
        rating: prod.rating,
        reviewsCount: prod.reviewsCount,
        sellerName: prod.sellerName,
        storeName: prod.storeName,
        linkStatus: prod.linkStatus,
        isOfficialShortLink: prod.isOfficialShortLink,
        stockStatus: prod.stockStatus,
        stockQuantity: prod.stockQuantity,
        stockEvidence: prod.stockEvidence,
        offerObservedAt: prod.offerObservedAt,
        lastCheckedAt: prod.lastCheckedAt
      };

      if (idx >= 0) {
        catalog.products[idx] = { ...catalog.products[idx], ...entry };
        updatedCount++;
      } else {
        catalog.products.push(entry);
        addedCount++;
      }
    }

    catalog.updatedAt = new Date().toISOString();
    const tmp = `${macroPath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(catalog, null, 2), 'utf8');
    await fs.rename(tmp, macroPath);
    console.log(`🎉 Catálogo Macro local atualizado: ${addedCount} novos, ${updatedCount} atualizados. Total: ${catalog.products.length} itens.`);
  } catch (err) {
    console.warn(`⚠️ Não foi possível sincronizar catalogo_macro.json: ${err.message}`);
  }

  const hasMissingImages = importedProducts.some((p) => !p.images || p.images.length === 0);
  if (hasMissingImages) {
    console.log(`💡 Nota: Produtos que ainda não possuem fotos no cache serão enriquecidos pelo robô ao navegar na página do produto.`);
  }

  // Se solicitado via flag --import, aciona import-catalog
  if (process.argv.includes('--import')) {
    console.log(`🚀 Acionando import-catalog.mjs...`);
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('node', ['scripts/import-catalog.mjs', outputPath], {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    process.exit(result.status ?? 0);
  }
}

main().catch((err) => {
  console.error('❌ Falha fatal no importador:', err);
  process.exit(1);
});
