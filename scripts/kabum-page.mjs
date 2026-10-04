import { isAllowedMarketplaceImageUrl } from '../src/modules/shared/marketplace-image-url.mjs';
import { isAllowedAffiliateUrl } from '../src/modules/outbound/allowlist.mjs';

export function extractKabumPage(html, source, observedAt = new Date().toISOString()) {
  const next = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!next) throw new Error('Página sem dados estruturados; sessão/bloqueio ou layout alterado.');
  const p = JSON.parse(next[1]).props?.pageProps?.product;
  if (!p || String(p.id) !== String(source.id) || !p.title) throw new Error('Identidade do produto divergente.');
  const prices = p.prices;
  const price = Number(prices?.priceWithDiscount ?? prices?.price);
  const images = [...new Set((p.medias || []).filter(media => media.type === 'image')
    .map(media => media.images?.gg || media.images?.g || media.images?.m)
    .filter(url => isAllowedMarketplaceImageUrl('kabum',url)))];
  if (!Number.isFinite(price) || price <= 0 || !images.length) throw new Error('Preço/fotos ausentes; coleta pendente, sem presumir esgotamento.');
  const affiliateUrl = new URL('https://www.awin1.com/cread.php');
  affiliateUrl.search = new URLSearchParams({ awinmid:'17729', awinaffid:'3105840', ued:source.originalUrl });
  if (!isAllowedAffiliateUrl('kabum',affiliateUrl.href)) throw new Error('Destino afiliado inválido.');
  return { ...source, title:p.title, description:typeof p.description === 'string' ? p.description : source.description,
    price, oldPrice:Number(prices.oldPrice) > price ? Number(prices.oldPrice) : null,
    cardPrice:Number(prices.price) > 0 ? Number(prices.price) : null,
    images, stockStatus:p.available === true ? 'in_stock' : p.available === false ? 'out_of_stock' : 'unknown',
    sellerName:p.sellerName || source.sellerName, sellerId:p.sellerId ? String(p.sellerId) : '',
    affiliateUrl:affiliateUrl.href, linkStatus:'ready', lastCheckedAt:observedAt,
    isOfficialShortLink:true, offerObservedAt:observedAt, collectedAt:observedAt, source:'kabum_product_page',
    installments:null, shipping:null, coupon:null
  };
}
