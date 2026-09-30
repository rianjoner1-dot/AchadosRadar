const test = require('node:test');
const assert = require('node:assert/strict');
const { shareProductLink } = require('../src/modules/catalog/share.js');

function createDocument(copyResult = true) {
  const activeElement = { restored: false, focus() { this.restored = true; } };
  const field = {
    style: {},
    removed: false,
    selected: false,
    setAttribute(name, value) { this[name] = value; },
    select() { this.selected = true; },
    remove() { this.removed = true; }
  };
  const body = { appendChild(element) { this.child = element; } };
  return {
    activeElement,
    body,
    field,
    createElement(tag) { assert.equal(tag, 'textarea'); return field; },
    execCommand(command) { assert.equal(command, 'copy'); return copyResult; }
  };
}

test('uses native share when available', async () => {
  let payload;
  const result = await shareProductLink({
    title: 'Produto', url: 'https://shop.example/p/1',
    navigatorApi: { share: async (value) => { payload = value; } }, documentApi: {}
  });
  assert.equal(result, 'shared');
  assert.deepEqual(payload, { title: 'Produto', url: 'https://shop.example/p/1' });
});

test('copies through Clipboard API when native share is unavailable', async () => {
  let copied;
  const result = await shareProductLink({
    title: 'Produto', url: 'https://shop.example/p/2',
    navigatorApi: { clipboard: { writeText: async (value) => { copied = value; } } }, documentApi: {}
  });
  assert.equal(result, 'copied');
  assert.equal(copied, 'https://shop.example/p/2');
});

test('falls back to Clipboard API if native sharing fails', async () => {
  let copied;
  const result = await shareProductLink({
    title: 'Produto', url: 'https://shop.example/p/native-failed',
    navigatorApi: {
      share: async () => { throw new Error('native share unavailable'); },
      clipboard: { writeText: async (value) => { copied = value; } }
    },
    documentApi: {}
  });
  assert.equal(result, 'copied');
  assert.equal(copied, 'https://shop.example/p/native-failed');
});

test('falls back to selected textarea copy and restores the previous focus', async () => {
  const documentApi = createDocument();
  const result = await shareProductLink({
    title: 'Produto', url: 'https://shop.example/p/3',
    navigatorApi: { clipboard: { writeText: async () => { throw new Error('permission denied'); } } }, documentApi
  });
  assert.equal(result, 'copied');
  assert.equal(documentApi.field.value, 'https://shop.example/p/3');
  assert.equal(documentApi.field.selected, true);
  assert.equal(documentApi.field.removed, true);
  assert.equal(documentApi.activeElement.restored, true);
});

test('returns a manual-copy instruction when platform copy paths are unavailable', async () => {
  const result = await shareProductLink({ title: 'Produto', url: 'https://shop.example/p/4', navigatorApi: {}, documentApi: {} });
  assert.equal(result, 'manual');
});

test('does not copy when the user cancels native sharing', async () => {
  let copied = false;
  const result = await shareProductLink({
    title: 'Produto', url: 'https://shop.example/p/5',
    navigatorApi: {
      share: async () => { const error = new Error('cancelled'); error.name = 'AbortError'; throw error; },
      clipboard: { writeText: async () => { copied = true; } }
    },
    documentApi: createDocument()
  });
  assert.equal(result, 'cancelled');
  assert.equal(copied, false);
});
