import { isUsableProductImage } from './image-health.js';

export function nextGalleryIndex(currentIndex, key, itemCount) {
  if (itemCount < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowRight') return (currentIndex + 1) % itemCount;
  if (key === 'ArrowLeft') return (currentIndex - 1 + itemCount) % itemCount;
  return null;
}

/** @param {HTMLElement | null} [announcement] @param {(imageUrl: string) => void} [onImageFailure] */
export function initProductGallery(imageHost, thumbnails, productTitle, announcement = null, onImageFailure = null) {
  const selectImage = (index, focus = false) => {
    const button = thumbnails[index];
    if (!button) return;
    const image = document.createElement('img');
    image.alt = productTitle;
    image.dataset.originalImageUrl = button.dataset.originalImageUrl || button.dataset.image;
    image.width = 640;
    image.height = 640;
    image.decoding = 'async';
    if (index === 0) image.fetchPriority = 'high';
    const showFallback = () => {
      if (imageHost.firstChild !== image || isUsableProductImage(image)) return;
      if (typeof onImageFailure === 'function') onImageFailure(button.dataset.originalImageUrl || button.dataset.image);
      imageHost.textContent = 'Foto indisponível';
      if (announcement) announcement.textContent = `Foto ${index + 1} de ${thumbnails.length} indisponível: ${productTitle}`;
    };
    image.addEventListener('error', showFallback, { once: true });
    image.addEventListener('load', showFallback, { once: true });
    imageHost.replaceChildren(image);
    image.src = button.dataset.image;
    if (announcement) announcement.textContent = `Foto ${index + 1} de ${thumbnails.length}: ${productTitle}`;
    thumbnails.forEach((thumbnail, thumbnailIndex) => {
      const selected = thumbnailIndex === index;
      thumbnail.setAttribute('aria-pressed', String(selected));
      thumbnail.tabIndex = selected ? 0 : -1;
    });
    if (focus) button.focus();
  };

  thumbnails.forEach((button, index) => {
    button.addEventListener('click', () => selectImage(index));
    button.addEventListener('keydown', (event) => {
      const nextIndex = nextGalleryIndex(index, event.key, thumbnails.length);
      if (nextIndex === null) return;
      event.preventDefault();
      selectImage(nextIndex, true);
    });
  });

  if (thumbnails.length) selectImage(0);
}
