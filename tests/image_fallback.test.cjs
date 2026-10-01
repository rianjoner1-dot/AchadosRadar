const test = require('node:test');
const assert = require('node:assert/strict');

async function loadModule() {
  return import('../src/modules/catalog/image-fallback.js');
}

function makeImage({ productId, originalUrl, currentSrc = originalUrl, complete = false, naturalWidth = 0, naturalHeight = 0 } = {}) {
  const listeners = new Map();
  return {
    dataset: { productId, originalImageUrl: originalUrl },
    currentSrc,
    src: currentSrc,
    complete,
    naturalWidth,
    naturalHeight,
    isConnected: true,
    replacedWith: /** @type {any} */ (null),
    addEventListener(type, listener, options) { listeners.set(type, { listener, once: options?.once }); },
    closest() { return { dataset: { productId } }; },
    replaceWith(node) { this.replacedWith = node; this.isConnected = false; },
    emit(type) {
      const entry = listeners.get(type);
      if (!entry) return;
      if (entry.once) listeners.delete(type);
      entry.listener();
    }
  };
}

function withDocument(callback) {
  const previous = global.document;
  global.document = { createElement: () => ({ setAttribute(name, value) { this[name] = value; } }) };
  try { callback(); }
  finally { if (previous === undefined) delete global.document; else global.document = previous; }
}

test('broken related image reports its original URL and leaves a visible placeholder', async () => {
  const { bindImageFailureReporting } = await loadModule();
  const image = makeImage({ productId: 'product-related-1', originalUrl: 'https://a-static.mlcdn.com.br/item.jpg', currentSrc: 'https://site.test/product-placeholder.svg' });
  const reports = [];
  withDocument(() => {
    bindImageFailureReporting({ querySelectorAll: () => [image] }, {
      selector: '.related-card img', placeholderClass: 'related-image-placeholder',
      reportFailure: (...args) => reports.push(args)
    });
    image.emit('error');
    image.emit('load');
    assert.deepEqual(reports, [['product-related-1', 'https://a-static.mlcdn.com.br/item.jpg']]);
    assert.equal(image.replacedWith.className, 'related-image-placeholder');
    assert.equal(image.replacedWith.role, 'img');
    assert.equal(image.replacedWith.textContent, 'Foto indisponível');
  });
});

test('a completed one-pixel response is treated as unavailable and reported once', async () => {
  const { bindImageFailureReporting } = await loadModule();
  const image = makeImage({ productId: 'product-related-2', originalUrl: 'https://images.example/transparent.gif', complete: true, naturalWidth: 1, naturalHeight: 1 });
  const reports = [];
  withDocument(() => {
    bindImageFailureReporting({ querySelectorAll: () => [image] }, {
      selector: '.related-card img', placeholderClass: 'related-image-placeholder',
      reportFailure: (...args) => reports.push(args)
    });
    image.emit('error');
    assert.deepEqual(reports, [['product-related-2', 'https://images.example/transparent.gif']]);
  });
});

test('demo images still receive a visible fallback without reporting a synthetic product failure', async () => {
  const { bindImageFailureReporting } = await loadModule();
  const image = makeImage({ originalUrl: 'https://images.example/demo.jpg' });
  const reports = [];
  withDocument(() => {
    bindImageFailureReporting({ querySelectorAll: () => [image] }, {
      selector: '.catalog-image img', placeholderClass: 'image-placeholder',
      reportFailure: (...args) => reports.push(args)
    });
    image.emit('error');
    assert.equal(image.replacedWith.className, 'image-placeholder');
    assert.equal(image.replacedWith.role, 'img');
    assert.equal(image.replacedWith.textContent, 'Foto indispon\u00edvel');
    assert.deepEqual(reports, []);
  });
});
