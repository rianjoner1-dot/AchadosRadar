const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_AVATAR_INPUT_BYTES,
  MAX_AVATAR_OUTPUT_BYTES,
  MAX_AVATAR_PIXELS,
  prepareAvatarBlob
} = require('../src/modules/auth/avatar.mjs');

function fixture({ width = 640, height = 480, outputBytes = 32, context = true, output = true } = {}) {
  const bitmap = { width, height, closeCalls: 0, close() { this.closeCalls++; } };
  const calls = { decoded: 0, draw: null, canvas: null };
  const options = {
    async createImageBitmapImpl() { calls.decoded++; return bitmap; },
    createCanvas() {
      const canvas = {
        width: 0,
        height: 0,
        getContext() { return context ? { drawImage(...args) { calls.draw = args; } } : null; },
        toBlob(callback, mime, quality) {
          calls.canvas = { mime, quality, width: this.width, height: this.height };
          callback(output ? new Blob([new Uint8Array(outputBytes)], { type: mime }) : null);
        }
      };
      return canvas;
    }
  };
  return { bitmap, calls, options };
}

test('prepares JPEG, PNG and WebP avatars as a centered 320px WebP', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const state = fixture();
    const result = await prepareAvatarBlob(new Blob(['input'], { type }), state.options);
    assert.equal(result.type, 'image/webp');
    assert.deepEqual(state.calls.canvas, { mime: 'image/webp', quality: .8, width: 320, height: 320 });
    assert.deepEqual(state.calls.draw.slice(1), [80, 0, 480, 480, 0, 0, 320, 320]);
    assert.equal(state.bitmap.closeCalls, 1);
  }
});

test('rejects invalid input type and oversized file before decoding', async () => {
  const state = fixture();
  await assert.rejects(prepareAvatarBlob(new Blob(['x'], { type: 'image/svg+xml' }), state.options), /JPEG, PNG ou WebP/);
  await assert.rejects(prepareAvatarBlob({ type: 'image/jpeg', size: MAX_AVATAR_INPUT_BYTES + 1 }, state.options), /JPEG, PNG ou WebP/);
  assert.equal(state.calls.decoded, 0);
});

test('rejects images above pixel cap and closes decoded bitmap', async () => {
  const state = fixture({ width: MAX_AVATAR_PIXELS + 1, height: 1 });
  await assert.rejects(prepareAvatarBlob(new Blob(['x'], { type: 'image/jpeg' }), state.options), /20 megapixels/);
  assert.equal(state.bitmap.closeCalls, 1);
  assert.equal(state.calls.draw, null);
});

test('reports decoder, canvas and output-size failures while closing the bitmap', async () => {
  await assert.rejects(prepareAvatarBlob(new Blob(['x'], { type: 'image/jpeg' }), {
    async createImageBitmapImpl() { throw new Error('decode failure'); },
    createCanvas() { throw new Error('must not run'); }
  }), /Não foi possível abrir/);

  for (const state of [fixture({ context: false }), fixture({ output: false })]) {
    await assert.rejects(prepareAvatarBlob(new Blob(['x'], { type: 'image/jpeg' }), state.options), /Falha ao inicializar|Não foi possível processar/);
    assert.equal(state.bitmap.closeCalls, 1);
  }

  const large = fixture({ outputBytes: MAX_AVATAR_OUTPUT_BYTES + 1 });
  await assert.rejects(prepareAvatarBlob(new Blob(['x'], { type: 'image/jpeg' }), large.options), /abaixo de 2 MB/);
  assert.equal(large.bitmap.closeCalls, 1);
});
