import { gunzipSync } from 'node:zlib';

const feedListUrl = process.argv[2];
if (!feedListUrl) throw new Error('Informe a URL Feed List como argumento.');
const feedList = new URL(feedListUrl);
if (feedList.protocol !== 'https:' || feedList.hostname !== 'ui.awin.com'
  || !/^\/productdata-darwin-download\/publisher\/3105840\/[a-f0-9]+\/1\/feedList$/i.test(feedList.pathname)) {
  throw new Error('A URL deve ser o Feed List do publisher Awin 3105840.');
}

function parseCsv(source) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' && quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const sampleMode = process.argv.includes('--sample');

const response = await fetch(feedList, { redirect: 'error', signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Feed List retornou HTTP ${response.status}.`);
const rows = parseCsv(await response.text());
const headers = rows[0]?.map((value) => value.trim());
const indexOf = (name) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());
const column = {
  advertiserId: indexOf('Advertiser ID'), advertiserName: indexOf('Advertiser Name'), region: indexOf('Primary Region'),
  membership: indexOf('Membership Status'), feedId: indexOf('Feed ID'), feedName: indexOf('Feed Name'),
  imported: indexOf('Last Imported'), checked: indexOf('Last Checked'), products: indexOf('No of products'), url: indexOf('URL')
};
if (column.advertiserId < 0 || column.feedId < 0 || column.url < 0) throw new Error('Feed List nao trouxe o schema CSV esperado.');
const targetIds = new Set(['17729', '79974']);
const targets = rows.slice(1).filter((cells) => targetIds.has((cells[column.advertiserId] || '').trim()));
const allowedDownloadHosts = new Set(['datafeed.api.productserve.com', 'productdata.awin.com', 'datafeed.awin.com']);
const summaries = [];
for (const cells of targets) {
  const rawUrl = (cells[column.url] || '').trim();
  let status = 'no_download_url', host = '';
  if (rawUrl) {
    let download;
    try { download = new URL(rawUrl); } catch { status = 'invalid_download_url'; }
    if (download) {
      host = download.hostname;
      if (download.protocol !== 'https:' || download.username || download.password || download.port || !allowedDownloadHosts.has(host)) {
        status = 'download_host_not_allowlisted';
      } else {
        try {
          const head = await fetch(download, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
          const final = new URL(head.url);
          status = final.protocol === 'https:' && allowedDownloadHosts.has(final.hostname)
            ? `http_${head.status}` : 'redirect_host_not_allowlisted';
          host = final.hostname;
          const feedSummary = {
            advertiserId: cells[column.advertiserId], advertiserName: cells[column.advertiserName],
            primaryRegion: cells[column.region], membershipStatus: cells[column.membership],
            feedId: cells[column.feedId], feedName: cells[column.feedName],
            lastImported: cells[column.imported], lastChecked: cells[column.checked],
            productCount: Number(cells[column.products]) || null, downloadHost: host, downloadStatus: status,
            contentType: head.headers.get('content-type') || '', contentLength: head.headers.get('content-length') || null,
            contentEncoding: head.headers.get('content-encoding') || ''
          };
          if (sampleMode && head.ok) {
            const dataResponse = await fetch(download, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
            const dataFinal = new URL(dataResponse.url);
            if (!dataResponse.ok || dataFinal.protocol !== 'https:' || !allowedDownloadHosts.has(dataFinal.hostname)) {
              feedSummary.sampleError = 'feed_download_failed_or_redirect_not_allowlisted';
            } else {
              const compressed = Buffer.from(await dataResponse.arrayBuffer());
              if (compressed.byteLength > 60 * 1024 * 1024) throw new Error('Feed maior que o limite de leitura de amostra.');
              const csvText = gunzipSync(compressed, { maxOutputLength: 300 * 1024 * 1024 }).toString('utf8');
              const productRows = parseCsv(csvText);
              const productHeaders = productRows[0]?.map((value) => value.trim());
              const field = (cells, name) => {
                const index = productHeaders.findIndex((header) => header.toLowerCase() === name.toLowerCase());
                return index >= 0 ? (cells[index] || '').trim() : '';
              };
              const categories = {
                ram: /mem.ria.{0,50}(?:\b(?:ram|ddr[345])\b)|\bddr[345]\b/i,
                case: /gabinete|\bpc case\b/i,
                monitor: /\bmonitor\b/i,
                cpu: /processador(?! de alimentos)|\bcpu\b|\bryzen\s[3579]\b|\bintel core\b/i,
                gpu: /placa de v.deo|\bgeforce\b|\bradeon rx\b|\bgpu\b/i,
                ssd: /\bssd\b|\bnvme\b|unidade de estado s.lido/i,
                hdd: /\bhdd\b|\bhd externo\b|hard ?disk|disco r.gido/i,
                power: /\bfonte\b.{0,100}(?:\d{2,4}\s?w|80 ?plus|\batx\b)|power supply/i,
                keyboard: /teclado(?! eletr.nico)|teclado mec.nico|teclado gamer/i,
                mouse: /\bmouse\b(?![ -]?pad)/i,
                mousepad: /mouse[ -]?pad|desk ?mat/i
              };
              const samples = Object.fromEntries(Object.keys(categories).map((name) => [name, []]));
              const categoryHits = Object.fromEntries(Object.keys(categories).map((name) => [name, 0]));
              for (const [rowIndex, product] of productRows.slice(1).entries()) {
                const title = field(product, 'product_name');
                const category = field(product, 'merchant_category') || field(product, 'category_name');
                for (const [name, pattern] of Object.entries(categories)) {
                  if (!pattern.test(title)) continue;
                  categoryHits[name] += 1;
                  if (samples[name].length >= 3 || !title) continue;
                  const itemId = field(product, 'merchant_product_id') || field(product, 'aw_product_id');
                  const images = ['merchant_image_url', 'large_image', 'alternate_image', 'alternate_image_two', 'alternate_image_three']
                    .map((key) => field(product, key)).filter(Boolean);
                  let destinationHost = '', deepLinkHost = '';
                  try { destinationHost = new URL(field(product, 'merchant_deep_link')).hostname; } catch { }
                  try { deepLinkHost = new URL(field(product, 'aw_deep_link')).hostname; } catch { }
                  samples[name].push({
                    rankInFeed: rowIndex + 1, productId: itemId, title: title.slice(0, 180), category: category.slice(0, 100),
                    currency: field(product, 'currency'), price: field(product, 'search_price'), oldPrice: field(product, 'product_price_old') || field(product, 'rrp_price'),
                    stockStatus: field(product, 'in_stock') || field(product, 'stock_status'), averageRating: field(product, 'average_rating'),
                    reviews: field(product, 'reviews'), affiliateDeepLinkPresent: Boolean(field(product, 'aw_deep_link')),
                    affiliateDeepLinkHost: deepLinkHost, destinationHost, imageCount: new Set(images).size,
                    imageHosts: [...new Set(images.map((value) => { try { return new URL(value).hostname; } catch { return ''; } }).filter(Boolean))]
                  });
                }
              }
              feedSummary.feedData = { rows: Math.max(0, productRows.length - 1), columns: productHeaders, categoryHits, samples };
            }
          }
          summaries.push(feedSummary);
          continue;
        } catch (error) {
          status = error.name === 'TimeoutError' ? 'head_timeout' : 'head_failed';
        }
      }
    }
  }
  summaries.push({
    advertiserId: cells[column.advertiserId], advertiserName: cells[column.advertiserName],
    primaryRegion: cells[column.region], membershipStatus: cells[column.membership],
    feedId: cells[column.feedId], feedName: cells[column.feedName],
    lastImported: cells[column.imported], lastChecked: cells[column.checked],
    productCount: Number(cells[column.products]) || null, downloadHost: host, downloadStatus: status
  });
}
const outputFeeds = process.argv.includes('--compact') ? summaries.map((feed) => {
  const { feedData, ...metadata } = feed;
  if (!feedData) return metadata;
  return {
    ...metadata,
    feedData: {
      rows: feedData.rows,
      columns: feedData.columns,
      categoryHits: feedData.categoryHits,
      candidates: Object.fromEntries(Object.entries(feedData.samples).map(([category, products]) => [category,
        products.map(({ productId, title, category: sourceCategory, price, stockStatus, affiliateDeepLinkPresent, destinationHost, imageCount }) => ({
          productId, title, sourceCategory, price, stockStatus, affiliateDeepLinkPresent, destinationHost, imageCount
        }))]))
    }
  };
}) : summaries;
console.log(JSON.stringify({ status: response.status, feedListFormat: 'csv', totalFeeds: rows.length - 1, targetFeeds: outputFeeds }, null, 2));
