export function isUsableProductImage(image) {
  return Boolean(image?.complete && image.naturalWidth > 1 && image.naturalHeight > 1);
}

export function shouldUseGlobalImageFallback(image) {
  return !image?.closest?.('#catalogGrid, #productMainImage');
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
