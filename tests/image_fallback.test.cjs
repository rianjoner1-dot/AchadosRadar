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

test('Mercado Livre 200 redirect to its official unavailable-image GIF is detected', async () => {
  const { isKnownUnavailableMercadoLivreImage } = await import('../src/modules/catalog/image-health.js');
  let options;
  let cancelled = false;
  const unavailable = await isKnownUnavailableMercadoLivreImage(
    'https://http2.mlstatic.com/D_Q_NP_2X_555666-MLB5448954284-O.webp',
    async (_url, init) => {
      options = init;
      return { url: 'https://http2.mlstatic.com/resources/frontend/statics/img-not-available/1.1.0/O@2x.gif', body: { cancel: async () => { cancelled = true; } } };
    }
  );
  assert.equal(unavailable, true);
  assert.equal(options.mode, 'cors');
  assert.equal(options.method, 'GET');
  assert.equal(cancelled, true);
});

test('Mercado Livre photo check keeps the product when availability is unknown or CDN is outside its allowlist', async () => {
  const { isKnownUnavailableMercadoLivreImage } = await import('../src/modules/catalog/image-health.js');
  let calls = 0;
  const unavailableForUrl = async (url) => isKnownUnavailableMercadoLivreImage(url, async () => {
    calls += 1;
    return { url: 'https://http2.mlstatic.com/item-photo.webp', body: { cancel: async () => {} } };
  });
  assert.equal(await unavailableForUrl('https://http2.mlstatic.com/item-photo.webp'), false);
  assert.equal(await unavailableForUrl('https://images.attacker.invalid/resources/frontend/statics/img-not-available/item.gif'), false);
  assert.equal(await unavailableForUrl('https://a-static.mlcdn.com.br/item-photo.webp'), false);
  assert.equal(await isKnownUnavailableMercadoLivreImage('https://http2.mlstatic.com/item-photo.webp', async () => { throw new Error('CORS/network'); }), false);
  assert.equal(calls, 1);
});

test('spotlight image preflight distinguishes failed, loaded and timed-out images', async () => {
  const { preloadProductImage } = await import('../src/modules/catalog/image-health.js');
  class LoadedImage {
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(_value) {
      this.complete = true;
      this.naturalWidth = 640;
      this.naturalHeight = 480;
      queueMicrotask(() => this.onload?.());
    }
  }
  class FailedImage {
    set src(_value) { queueMicrotask(() => this.onerror?.()); }
  }
  class PendingImage {}
  assert.equal(await preloadProductImage('https://images.example/ok.jpg', { ImageConstructor: LoadedImage }), true);
  assert.equal(await preloadProductImage('https://images.example/missing.jpg', { ImageConstructor: FailedImage }), false);
  assert.equal(await preloadProductImage('https://images.example/slow.jpg', { ImageConstructor: PendingImage, timeoutMs: 1 }), null);
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

test('demo product related images replace broken-image icons with an accessible placeholder', async () => {
  const { bindImageFailureReporting } = await loadModule();
  const image = makeImage({ originalUrl: 'https://images.example/demo-related.jpg' });
  const reports = [];
  withDocument(() => {
    bindImageFailureReporting({ querySelectorAll: () => [image] }, {
      selector: '.demo-related-card img', productSelector: '[data-demo-related-card]',
      placeholderClass: 'demo-related-image-placeholder', reportFailure: (...args) => reports.push(args),
    });
    image.emit('error');
    assert.equal(image.replacedWith.className, 'demo-related-image-placeholder');
    assert.equal(image.replacedWith.role, 'img');
    assert.equal(image.replacedWith['aria-label'], 'Foto indisponível');
    assert.equal(image.replacedWith.textContent, 'Foto indisponível');
    assert.deepEqual(reports, []);
  });
});
