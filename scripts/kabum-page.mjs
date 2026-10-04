import { isAllowedMarketplaceImageUrl, isAllowedMarketplaceVideoUrl } from '../src/modules/shared/marketplace-image-url.mjs';
import { isAllowedAffiliateUrl } from '../src/modules/outbound/allowlist.mjs';

function extractKabumSpecs(technicalInformation) {
  const specs = [];
  if (!technicalInformation) return specs;
  const rawText = typeof technicalInformation === 'string' ? technicalInformation : typeof technicalInformation.text === 'string' ? technicalInformation.text : '';
  const clean = rawText
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(?:td|th)>\s*<(?:td|th)\b[^>]*>/gi, ': ')
    .replace(/<\/(?:tr|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&ocirc;/gi, 'ô')
    .replace(/&ecirc;/gi, 'ê').replace(/&quot;/gi, '"').replace(/&acirc;/gi, 'â')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const code = parseInt(hex || decimal, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    })
    .replace(/&amp;/gi, '&').replace(/[\u200b\u200c\u200d]/g, '');
  for (const line of clean.split(/\r?\n/).map(l => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)) {
    const idx = line.indexOf(':');
    if (idx > 1 && idx < 80) {
      const name = line.slice(0, idx).trim().slice(0, 100);
      const value = line.slice(idx + 1).trim().slice(0, 300);
      const lower = name.toLowerCase();
      if (name && value && lower !== value.toLowerCase()
        && !lower.includes('especificaç') && !lower.includes('característic') && !lower.includes('conteúdo da embalagem')) {
        specs.push({ name, value });
      }
    }
  }
  if (typeof technicalInformation === 'object' && technicalInformation !== null) {
    if (typeof technicalInformation.warranty === 'string' && technicalInformation.warranty.trim()) {
      specs.push({ name: 'Garantia', value: technicalInformation.warranty.trim().slice(0, 300) });
    }
    if (typeof technicalInformation.weight === 'string' && technicalInformation.weight.trim()) {
      specs.push({ name: 'Peso Bruto', value: technicalInformation.weight.trim().slice(0, 300) });
    }
  }
  return [...new Map(specs.map(spec => [spec.name.toLowerCase(), spec])).values()].slice(0, 18);
}

function formatKabumInstallments(installment) {
  if (!installment || !Number.isSafeInteger(installment.installment) || installment.installment < 1
    || installment.installment > 60 || !Number.isFinite(Number(installment.amount)) || Number(installment.amount) <= 0) {
    return null;
  }
  const count = installment.installment;
  const amount = Number(installment.amount).toFixed(2).replace('.', ',');
  const fee = installment.hasFee === false ? ' sem juros' : installment.hasFee === true ? ' com juros' : '';
  return `Em até ${count}x de R$ ${amount}${fee}`;
}

export function extractKabumPage(html, source, observedAt = new Date().toISOString(), canonicalUrl = null) {
  const next = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!next) throw new Error('Página sem dados estruturados; sessão/bloqueio ou layout alterado.');
  const p = JSON.parse(next[1]).props?.pageProps?.product;
  if (!p || String(p.id) !== String(source.id) || !p.title) throw new Error('Identidade do produto divergente.');

  const prices = p.prices || {};
  const rawPriceWithDiscount = Number(prices.priceWithDiscount);
  const rawPrice = Number(prices.price);
  const rawOldPrice = Number(prices.oldPrice);
  const pixPrice = Number.isFinite(rawPriceWithDiscount) && rawPriceWithDiscount > 0 ? rawPriceWithDiscount : null;
  const cardPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null;
  const price = pixPrice ?? cardPrice ?? Number(p.price);

  const medias = Array.isArray(p.medias) ? p.medias.filter(media => media && typeof media === 'object') : [];
  const images = [...new Set(medias.filter(media => media.type === 'image')
    .map(media => media.images?.gg || media.images?.g || media.images?.m)
    .filter(url => isAllowedMarketplaceImageUrl('kabum', url)))];
  if (!Number.isFinite(price) || price <= 0 || !images.length) throw new Error('Preço/fotos ausentes; coleta pendente, sem presumir esgotamento.');

  let targetOriginalUrl = source.originalUrl;
  if (canonicalUrl && typeof canonicalUrl === 'string' && canonicalUrl.startsWith('https://')) {
    try {
      const parsedCanonical = new URL(canonicalUrl);
      if (['www.kabum.com.br', 'kabum.com.br'].includes(parsedCanonical.hostname)
        && parsedCanonical.pathname.match(/^\/produto\/(\d+)(?:\/|$)/)?.[1] === String(source.id)) {
        targetOriginalUrl = parsedCanonical.href;
      }
    } catch { }
  }

  const affiliateUrl = new URL('https://www.awin1.com/cread.php');
  affiliateUrl.search = new URLSearchParams({ awinmid: '17729', awinaffid: '3105840', ued: targetOriginalUrl });
  if (!isAllowedAffiliateUrl('kabum', affiliateUrl.href)) throw new Error('Destino afiliado inválido.');

  const numeric = value => value === null || value === undefined || String(value).trim() === '' ? NaN : Number(value);
  const rawRating = numeric(p.rating?.average ?? p.rating?.score);
  const rating = Number.isFinite(rawRating) && rawRating >= 0 && rawRating <= 5 ? Number(rawRating.toFixed(2)) : null;
  const rawCount = numeric(p.rating?.count ?? p.ratingCount);
  const reviewsCount = Number.isSafeInteger(rawCount) && rawCount >= 0 ? rawCount : null;

  const brand = [p.manufacturer?.name, p.brands?.[0]?.name, source.brand].find(value => typeof value === 'string' && value.trim())?.trim() || null;
  const specifications = extractKabumSpecs(p.technicalInformation);
  const installments = formatKabumInstallments(p.installment);

  const videos = medias
    .filter(media => media.type === 'video' && isAllowedMarketplaceVideoUrl('kabum', media.url))
    .slice(0, 1)
    .map(media => {
      const poster = media.images?.gg || media.images?.g || null;
      return {
        url: media.url,
        posterUrl: isAllowedMarketplaceImageUrl('kabum', poster) ? poster : null
      };
    });

  return {
    ...source,
    title: p.title,
    description: typeof p.description === 'string' ? p.description : source.description,
    brand,
    price,
    pixPrice,
    cardPrice,
    oldPrice: Number.isFinite(rawOldPrice) && rawOldPrice > price ? rawOldPrice : null,
    installments,
    shipping: null,
    coupon: null,
    rating,
    reviewsCount,
    specifications,
    images,
    videos: videos.length ? videos : undefined,
    stockStatus: p.available === true ? 'in_stock' : p.available === false ? 'out_of_stock' : 'unknown',
    sellerName: p.sellerName || source.sellerName,
    sellerId: p.sellerId ? String(p.sellerId) : '',
    originalUrl: targetOriginalUrl,
    affiliateUrl: affiliateUrl.href,
    linkStatus: 'ready',
    lastCheckedAt: observedAt,
    isOfficialShortLink: true,
    offerObservedAt: observedAt,
    collectedAt: observedAt,
    source: 'kabum_product_page'
  };
}

