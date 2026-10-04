import { getCatalogImageFailureUrl, isUsableProductImage, isKnownUnavailableMercadoLivreImage } from './image-health.js';

/** @param {ParentNode} root @param {{ selector: string, productSelector?: string, placeholderClass: string, hideProduct?: boolean, reportFailure: (productId: string, imageUrl: string) => void }} options */
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

      if (options.hideProduct) {
        image.closest(productSelector)?.remove();
        return;
      }

      const placeholder = document.createElement('span');
      placeholder.className = options.placeholderClass;
      placeholder.setAttribute('role', 'img');
      placeholder.setAttribute('aria-label', 'Foto indisponível');
      placeholder.textContent = 'Foto indisponível';
      image.replaceWith(placeholder);
    };

    image.addEventListener('error', replaceWithPlaceholder, { once: true });
    const checkLoadedImage = async () => {
      if (!isUsableProductImage(image)) { replaceWithPlaceholder(); return; }
      if (options.hideProduct && await isKnownUnavailableMercadoLivreImage(getCatalogImageFailureUrl(image))) replaceWithPlaceholder();
    };
    image.addEventListener('load', () => { void checkLoadedImage(); }, { once: true });
    if (image.complete) void checkLoadedImage();
  }
}
