import { isAllowedMarketplaceImageUrl } from '../shared/marketplace-image-url.mjs';

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
  return { ...product, images: accepted };
}
