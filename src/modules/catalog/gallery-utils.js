export function nextGalleryIndex(currentIndex, key, itemCount) {
  if (itemCount < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return itemCount - 1;
  if (key === 'ArrowRight') return (currentIndex + 1) % itemCount;
  if (key === 'ArrowLeft') return (currentIndex - 1 + itemCount) % itemCount;
  return null;
}

/** @param {HTMLElement | null} [announcement] */
export function initProductGallery(imageHost, thumbnails, productTitle, announcement = null) {
  const selectImage = (index, focus = false) => {
    const button = thumbnails[index];
    if (!button) return;
    const image = document.createElement('img');
    image.src = button.dataset.image;
    image.alt = productTitle;
    image.width = 640;
    image.height = 640;
    image.decoding = 'async';
    if (index === 0) image.fetchPriority = 'high';
    imageHost.replaceChildren(image);
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
