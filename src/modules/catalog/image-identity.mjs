import { isAllowedMarketplaceImageUrl } from '../shared/marketplace-image-url.mjs';

export function upgradeProductImageUrl(platform, candidate) {
  if (!isAllowedMarketplaceImageUrl(platform, candidate)) return candidate;
  const url = new URL(candidate);
  if (platform === 'magalu') {
    if (url.hostname === 'mlcdn.com.br' || url.hostname.endsWith('.mlcdn.com.br')) {
      url.pathname = url.pathname.replace(/^\/\d+x\d+(?=\/)/i, '/1500x1500');
    } else if (url.hostname === 'magazineluiza.com.br' || url.hostname.endsWith('.magazineluiza.com.br')) {
      url.pathname = url.pathname.replace(/\/(?:\d{2,4}x\d{2,4})(?=\/)/i, '/1500x1500');
    }
  } else if (platform === 'mercadolivre') {
    url.pathname = url.pathname.replace(/-[A-Z]\.(webp|jpg|jpeg)$/i, '-O.$1');
  } else if (platform === 'amazon') {
    url.pathname = url.pathname.replace(/\._[A-Z0-9_,]+_\./i, '.');
  } else if (platform === 'shopee') {
    url.pathname = url.pathname.replace(/_tn(?=\.[a-z0-9]+$)/i, '');
  }
  return url.href;
}

export function classifyProductImageIdentity(platform, externalId, imageUrl) {
  if (platform !== 'mercadolivre' || typeof externalId !== 'string' || typeof imageUrl !== 'string'
      || !/^MLB-?\d+$/i.test(externalId) || !isAllowedMarketplaceImageUrl(platform, imageUrl)) return 'unverifiable';

  let path;
  try { path = new URL(imageUrl).pathname; } catch { return 'unverifiable'; }
  const imageId = path.match(/MLB-?(\d+)/i)?.[1];
  if (!imageId) return 'unverifiable';
  const productId = externalId.match(/^MLB-?(\d+)$/i)?.[1];
  return imageId === productId ? 'match' : 'mismatch';
}

export function filterMismatchedProductImages(platform, externalId, images) {
  const accepted = [];
  const mismatched = [];
  for (const image of Array.isArray(images) ? images : []) {
    if (classifyProductImageIdentity(platform, externalId, image?.url) === 'mismatch') mismatched.push(image);
    else accepted.push(image);
  }
  return { accepted, mismatched };
}

/** @param {{ id: string; platform: string; external_id: string; images?: { url: string; display_order: number }[] }} product @param {(productId: string, imageUrl: string) => void} [onMismatch] */
export function sanitizeCatalogProductImages(product, onMismatch = () => {}) {
  const { accepted, mismatched } = filterMismatchedProductImages(product.platform, product.external_id, product.images);
  for (const image of mismatched) onMismatch(product.id, image.url);
  const images = accepted.map((image) => {
    const originalUrl = image.original_url || image.url;
    const upgradedUrl = upgradeProductImageUrl(product.platform, image.url);
    return upgradedUrl === image.url ? image : { ...image, url: upgradedUrl, original_url: originalUrl };
  });
  return { ...product, images };
}
