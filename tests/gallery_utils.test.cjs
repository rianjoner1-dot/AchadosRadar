const test = require('node:test');
const assert = require('node:assert/strict');
const { initProductGallery, nextGalleryIndex } = require('../src/modules/catalog/gallery-utils.js');

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
  global.document = { createElement: () => ({}) };
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
