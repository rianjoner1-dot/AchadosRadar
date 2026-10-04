import { isAllowedMarketplaceImageUrl, isAllowedMarketplaceVideoUrl } from '../src/modules/shared/marketplace-image-url.mjs';
import { isAllowedAffiliateUrl } from '../src/modules/outbound/allowlist.mjs';

function extractKabumSpecs(technicalInformation) {
  const specs = [];
  if (!technicalInformation) return specs;
  const rawText = typeof technicalInformation === 'string' ? technicalInformation : technicalInformation.text || '';
  const clean = rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
    .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç').replace(/&ocirc;/gi, 'ô')
    .replace(/&ecirc;/gi, 'ê').replace(/&quot;/gi, '"').replace(/&acirc;/gi, 'â')
    .replace(/&#8203;/g, '');
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
  return specs.slice(0, 18);
}

function formatKabumInstallments(installment) {
  if (!installment || !Number.isSafeInteger(installment.installment) || installment.installment < 1 || !installment.amount) {
    return null;
  }
  const count = installment.installment;
  const amount = Number(installment.amount).toFixed(2).replace('.', ',');
  const fee = installment.hasFee ? '' : ' sem juros';
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

  const images = [...new Set((p.medias || []).filter(media => media.type === 'image')
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

  const rawRating = Number(p.rating?.average ?? p.rating?.score);
  const rating = Number.isFinite(rawRating) && rawRating >= 0 && rawRating <= 5 ? Number(rawRating.toFixed(1)) : null;
  const rawCount = Number(p.rating?.count ?? p.ratingCount);
  const reviewsCount = Number.isSafeInteger(rawCount) && rawCount >= 0 ? rawCount : null;

  const brand = String(p.manufacturer?.name || p.brands?.[0]?.name || source.brand || '').trim() || null;
  const specifications = extractKabumSpecs(p.technicalInformation);
  const installments = formatKabumInstallments(p.installment);

  const videos = (p.medias || [])
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

