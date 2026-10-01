const test = require('node:test');
const assert = require('node:assert/strict');
const { initProductGallery, nextGalleryIndex } = require('../src/modules/catalog/gallery-utils.js');
const { getCatalogImageFailureUrl, isUsableProductImage, shouldUseGlobalImageFallback } = require('../src/modules/catalog/image-health.js');

test('product images reject empty and one-pixel placeholder responses', () => {
  assert.equal(isUsableProductImage({ complete: false, naturalWidth: 500, naturalHeight: 500 }), false);
  assert.equal(isUsableProductImage({ complete: true, naturalWidth: 1, naturalHeight: 1 }), false);
  assert.equal(isUsableProductImage({ complete: true, naturalWidth: 500, naturalHeight: 500 }), true);
});

test('catalog image reports retain the original store URL after a fallback source changes', () => {
  const image = {
    dataset: { originalImageUrl: 'https://a-static.mlcdn.com.br/item/photo.jpg' },
    currentSrc: 'https://site.test/product-placeholder.svg',
    src: 'https://site.test/product-placeholder.svg'
  };
  assert.equal(getCatalogImageFailureUrl(image), 'https://a-static.mlcdn.com.br/item/photo.jpg');
});

test('global image fallback defers to catalog, product-gallery and spotlight handlers', () => {
  assert.equal(shouldUseGlobalImageFallback({ closest: (selector) => selector === '#catalogGrid, #productMainImage, #spotlightGrid' ? {} : null }), false);
  assert.equal(shouldUseGlobalImageFallback({ closest: () => null }), true);
});

test('product gallery arrow keys wrap through all images', () => {
  assert.equal(nextGalleryIndex(0, 'ArrowLeft', 4), 3);
  assert.equal(nextGalleryIndex(3, 'ArrowRight', 4), 0);
  assert.equal(nextGalleryIndex(1, 'ArrowRight', 4), 2);
});

test('product gallery Home and End keys select the first and last image', () => {
  assert.equal(nextGalleryIndex(2, 'Home', 5), 0);
  assert.equal(nextGalleryIndex(2, 'End', 5), 4);
});

test('product gallery ignores unrelated keys and empty galleries', () => {
  assert.equal(nextGalleryIndex(1, 'Enter', 3), null);
  assert.equal(nextGalleryIndex(0, 'ArrowRight', 0), null);
});

test('product gallery changes the main photo and exposes one keyboard-selected thumbnail', () => {
  const previousDocument = global.document;
  global.document = { createElement: () => ({ addEventListener() {} }) };
  const imageHost = { image: null, replaceChildren(image) { this.image = image; } };
  const announcement = { textContent: '' };
  const makeButton = (url) => {
    const listeners = {};
    return {
      dataset: { image: url },
      attributes: {},
      tabIndex: -1,
      focused: false,
      addEventListener(type, listener) { listeners[type] = listener; },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; },
      emit(type, event = {}) { listeners[type]?.(event); }
    };
  };
  const thumbnails = [makeButton('https://images.example/one.jpg'), makeButton('https://images.example/two.jpg')];

  try {
    initProductGallery(imageHost, thumbnails, 'Produto de teste', announcement);
    assert.equal(imageHost.image.src, thumbnails[0].dataset.image);
    assert.equal(imageHost.image.fetchPriority, 'high');
    assert.equal(thumbnails[0].attributes['aria-pressed'], 'true');
    assert.equal(thumbnails[0].tabIndex, 0);
    assert.equal(announcement.textContent, 'Foto 1 de 2: Produto de teste');
    assert.equal(thumbnails[1].attributes['aria-pressed'], 'false');
    thumbnails[1].emit('click');
    assert.equal(imageHost.image.src, thumbnails[1].dataset.image);
    assert.equal(thumbnails[1].attributes['aria-pressed'], 'true');
    assert.equal(announcement.textContent, 'Foto 2 de 2: Produto de teste');
    let prevented = false;
    thumbnails[1].emit('keydown', { key: 'ArrowRight', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(thumbnails[0].focused, true);
    assert.equal(thumbnails[0].attributes['aria-pressed'], 'true');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test('a failed main product image reports its exact URL and displays a fallback', () => {
  const previousDocument = global.document;
  global.document = {
    createElement: () => {
      const listeners = {};
      return { addEventListener(type, listener) { listeners[type] = listener; }, emit(type) { listeners[type]?.(); } };
    }
  };
  const imageHost = {
    firstChild: null,
    textContent: '',
    replaceChildren(image) { this.firstChild = image; }
  };
  const thumbnail = {
    dataset: { image: 'https://images.example/product.webp' },
    setAttribute() {},
    addEventListener() {}
  };
  const reported = [];

  try {
    initProductGallery(imageHost, [thumbnail], 'Produto de teste', null, (url) => reported.push(url));
    imageHost.firstChild.emit('error');
    assert.deepEqual(reported, ['https://images.example/product.webp']);
    assert.equal(imageHost.textContent, 'Foto indisponível');
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});
