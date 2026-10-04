import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';

const downloadPath = path.join(process.env.USERPROFILE, 'Downloads', 'datafeed_3105840.csv.gz');
const catalogPath = path.resolve('data', 'catalogo_macro.json');

if (!fs.existsSync(downloadPath)) {
  console.error(`❌ Arquivo datafeed não encontrado em: ${downloadPath}`);
  process.exit(1);
}

function parseCsvLine(text) {
  const cells = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

async function run() {
  console.log(`📦 Lendo datafeed de: ${downloadPath}...`);
  const gunzip = zlib.createGunzip();
  const stream = fs.createReadStream(downloadPath);
  const rl = readline.createInterface({ input: stream.pipe(gunzip) });

  let headers = [];
  let isHeader = true;
  const kabumProducts = [];

  for await (const line of rl) {
    if (isHeader) {
      headers = parseCsvLine(line).map(h => h.trim());
      isHeader = false;
      continue;
    }

    const row = parseCsvLine(line);
    const item = {};
    headers.forEach((h, idx) => {
      item[h] = row[idx] ? row[idx].trim() : '';
    });

    const merchantId = item.merchant_product_id || item.aw_product_id;
    const title = item.product_name || '';
    const affiliateUrl = item.aw_deep_link || '';
    const originalUrl = item.merchant_deep_link || (merchantId ? `https://www.kabum.com.br/produto/${merchantId}` : '');
    const priceNum = parseFloat((item.search_price || '0').replace(',', '.'));
    const imgUrl = item.merchant_image_url || item.aw_image_url;

    if (!title || !affiliateUrl || isNaN(priceNum) || priceNum <= 0) continue;

    const nowIso = new Date().toISOString();
    const productObj = {
      platform: 'kabum',
      id: String(merchantId),
      title: title.slice(0, 200),
      category: item.merchant_category || item.category_name || 'Eletrônicos',
      brand: item.brand_name || 'KaBuM!',
      price: priceNum,
      installments: 'Até 10x no cartão',
      shipping: 'Calcular frete e prazo',
      coupon: '',
      stockStatus: 'in_stock',
      sellerName: item.merchant_name || 'KaBuM!',
      sellerId: '',
      storeName: 'KaBuM!',
      storeAffiliateId: '3105840',
      originalUrl,
      affiliateUrl,
      offerObservedAt: nowIso,
      collectedAt: nowIso,
      images: imgUrl ? [imgUrl.replace('http://', 'https://')] : [],
      description: (item.description || '').slice(0, 500),
      bridgeReceivedAt: nowIso
    };

    kabumProducts.push(productObj);
  }

  console.log(`✅ ${kabumProducts.length} produtos KaBuM! extraídos com sucesso!`);

  // Carrega catalogo atual
  let catalog = { schemaVersion: '1.0', updatedAt: new Date().toISOString(), products: [] };
  if (fs.existsSync(catalogPath)) {
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    } catch {}
  }

  const existingMap = new Map();
  (catalog.products || []).forEach(p => {
    existingMap.set(`${p.platform}:${p.id}`, p);
  });

  let added = 0;
  let updated = 0;
  for (const kp of kabumProducts) {
    const key = `kabum:${kp.id}`;
    if (existingMap.has(key)) {
      existingMap.set(key, { ...existingMap.get(key), ...kp });
      updated++;
    } else {
      existingMap.set(key, kp);
      added++;
    }
  }

  catalog.products = Array.from(existingMap.values());
  catalog.updatedAt = new Date().toISOString();

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Catálogo Macro atualizado: ${catalog.products.length} produtos no total (+${added} novos, ${updated} atualizados)`);
}

run().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
