export function isUsableProductImage(image) {
  return Boolean(image?.complete && image.naturalWidth > 1 && image.naturalHeight > 1);
}

/**
 * Load an image without inserting a broken-photo flash into the spotlight.
 * `null` means the request timed out and availability is unknown.
 * @param {string} imageUrl
 * @param {{ ImageConstructor?: typeof Image, timeoutMs?: number }} options
 * @returns {Promise<boolean | null>}
 */
export function preloadProductImage(imageUrl, { ImageConstructor = globalThis.Image, timeoutMs = 4000 } = {}) {
  if (typeof ImageConstructor !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let image;
    try { image = new ImageConstructor(); } catch { resolve(null); return; }
    let finished = false;
    const finish = (usable) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(usable);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(isUsableProductImage({ complete: true, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }));
    image.onerror = () => finish(false);
    image.src = imageUrl;
    if (image.complete) queueMicrotask(() => finish(isUsableProductImage(image)));
  });
}

/**
 * Mercado Livre can answer an unavailable listing image with HTTP 200 and a
 * large generic GIF. Dimensions alone therefore do not prove that the image
 * belongs to the product. A CORS-readable redirect to its official
 * "img-not-available" asset is positive evidence that the photo is missing.
 * Network/CORS errors remain unknown and do not hide the product.
 * @param {string} imageUrl
 * @param {(url: string, init: RequestInit) => Promise<Response>} fetchImage
 */
export async function isKnownUnavailableMercadoLivreImage(imageUrl, fetchImage = globalThis.fetch) {
  let source;
  try { source = new URL(imageUrl); } catch { return false; }
  if (source.protocol !== 'https:' || source.hostname !== 'http2.mlstatic.com') return false;

  let response;
  try {
    response = await fetchImage(source.href, { method: 'GET', mode: 'cors', cache: 'force-cache' });
  } catch {
    return false;
  }

  const unavailablePath = /\/resources\/frontend\/statics\/img-not-available\//i;
  let unavailable = response.status === 404;
  try {
    const finalUrl = new URL(response.url || source.href);
    unavailable ||= finalUrl.hostname === 'http2.mlstatic.com' && unavailablePath.test(finalUrl.pathname);
  } catch { /* An unreadable or malformed destination is not proof. */ }

  try { await response.body?.cancel(); } catch { /* The image itself may already have completed. */ }
  return unavailable;
}

export function shouldUseGlobalImageFallback(image) {
return Boolean(image?.getAttribute?.('src'))
  && !image?.closest?.('#catalogGrid, #productMainImage, #spotlightGrid, #demoRelatedGrid');
}

export function getGlobalImageFallbackAlt(image, fallbackAlt = 'Imagem indisponível') {
  return image?.hasAttribute?.('alt') ? image.alt : fallbackAlt;
}

export function getCatalogImageFailureUrl(image) {
  return image?.dataset?.originalImageUrl || image?.currentSrc || image?.src || '';
}

export const IMAGE_FAILURE_RETRY_DELAY_MS = 5 * 60 * 1000;

export function canReportCatalogImageFailure(reports, key, now = Date.now()) {
  const retryAt = reports.get(key);
  return retryAt === undefined || now >= retryAt;
}

export function markCatalogImageFailureReport(reports, key, succeeded, now = Date.now()) {
  reports.set(key, succeeded ? Number.POSITIVE_INFINITY : now + IMAGE_FAILURE_RETRY_DELAY_MS);
}
