import { getCatalogImageFailureUrl, isUsableProductImage } from './image-health.js';

/** @param {ParentNode} root @param {{ selector: string, productSelector?: string, placeholderClass: string, reportFailure: (productId: string, imageUrl: string) => void }} options */
export function bindImageFailureReporting(root, options) {
  const productSelector = options.productSelector || '[data-product-id]';
  for (const image of root.querySelectorAll(options.selector)) {
    if (image.dataset.fallbackBound === 'true') continue;
    image.dataset.fallbackBound = 'true';

    const replaceWithPlaceholder = () => {
      if (!image.isConnected || image.dataset.failureHandled === 'true') return;
      image.dataset.failureHandled = 'true';
      const productId = image.closest(productSelector)?.dataset.productId;
      const imageUrl = getCatalogImageFailureUrl(image);
      if (productId && imageUrl) options.reportFailure(productId, imageUrl);

      const placeholder = document.createElement('span');
      placeholder.className = options.placeholderClass;
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-label', 'Foto indisponível');
      placeholder.textContent = 'Foto indisponível';
      image.replaceWith(placeholder);
    };

    image.addEventListener('error', replaceWithPlaceholder, { once: true });
    image.addEventListener('load', () => {
      if (!isUsableProductImage(image)) replaceWithPlaceholder();
    }, { once: true });
    if (image.complete && !isUsableProductImage(image)) replaceWithPlaceholder();
  }
}
