const test = require('node:test');
const assert = require('node:assert/strict');
const { createRelatedFeed, RELATED_PAGE_SIZE, RELATED_DOM_LIMIT } = require('../src/modules/catalog/related-feed.js');

function makeProduct(index) {
  const createdAt = new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString();
  return { id: `product-${String(index).padStart(3, '0')}`, created_at: createdAt, search_score: 1,
    offer: { price: 10 + index } };
}

function pageAfter(all, cursor, limit) {
  const start = cursor ? all.findIndex((item) => item.id === cursor.id) + 1 : 0;
  return all.slice(start, start + limit);
}

test('F1.10: related feed follows five cursor pages without duplicates or losing the current product', async () => {
  const all = Array.from({ length: 73 }, (_, index) => makeProduct(index));
  all[48] = { ...all[48], id: 'current-product' };
  const rendered = [];
  const removed = [];
  const hasMoreStates = [];
  let currentCalls = 0;
  const feed = createRelatedFeed({
    currentProductId: 'current-product',
    searchPage: async ({ cursor, limit }) => {
      assert.equal(limit, RELATED_PAGE_SIZE);
      currentCalls += 1;
      // Simulate approximate search returning the current detail page again.
      return pageAfter(all, cursor, limit).map((item) => item.id === 'product-000' ? { ...item } : item);
    },
    appendProducts: (items) => rendered.push(...items),
    trimOldest: (limit, onRemove) => {
      while (rendered.length > limit) {
        const item = rendered.shift();
        removed.push(item.id);
        onRemove(item.id);
      }
    },
    setHasMore: (value) => hasMoreStates.push(value),
    onError: (error) => { throw error; }
  });

  for (let page = 0; page < 7; page += 1) await feed.loadNext();

  assert.equal(currentCalls, 7);
  assert.equal(rendered.length, RELATED_DOM_LIMIT);
  assert.equal(new Set(rendered.map((item) => item.id)).size, RELATED_DOM_LIMIT);
  assert.equal(rendered.some((item) => item.id === 'current-product'), false);
  assert.equal(feed.renderedLimit, RELATED_DOM_LIMIT);
  assert.equal(removed.length, 12);
  assert.equal(new Set(removed).size, removed.length);
  assert.equal(rendered.some((item) => removed.includes(item.id)), false);
  assert.deepEqual(hasMoreStates, [true, true, true, true, true, true, false]);
  assert.equal(feed.hasMore, false);
  assert.equal(feed.isLoading, false);
});

test('F1.10: manual retry resumes after a page error without advancing cursor', async () => {
  const all = Array.from({ length: 37 }, (_, index) => makeProduct(index));
  const rendered = [];
  const cursors = [];
  let fail = true;
  const feed = createRelatedFeed({
    currentProductId: 'not-in-list',
    searchPage: async ({ cursor, limit }) => {
      cursors.push(cursor?.id ?? null);
      if (fail) { fail = false; throw new Error('temporary network error'); }
      return pageAfter(all, cursor, limit);
    },
    appendProducts: (items) => rendered.push(...items),
    trimOldest: () => {}, setHasMore() {}, onError() {}
  });

  await feed.loadNext();
  assert.equal(feed.autoLoadPaused, true);
  const retry = await feed.loadNext();
  assert.equal(retry.loaded, 12);
  assert.equal(cursors[0], null);
  assert.equal(cursors[1], null);
  assert.equal(feed.autoLoadPaused, false);
  assert.equal(rendered.length, 12);
});

test('F1.10: the final short page ends pagination and concurrent requests share one load', async () => {
  const all = Array.from({ length: 25 }, (_, index) => makeProduct(index));
  const rendered = [];
  let calls = 0;
  const feed = createRelatedFeed({
    currentProductId: 'not-in-list',
    searchPage: async ({ cursor, limit }) => { calls += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return pageAfter(all, cursor, limit); },
    appendProducts: (items) => rendered.push(...items), trimOldest() {}, setHasMore() {}, onError(error) { throw error; }
  });

  await Promise.all([feed.loadNext(), feed.loadNext()]);
  await feed.loadNext();
  await feed.loadNext();
  assert.equal(calls, 3);
  assert.equal(rendered.length, 25);
  assert.equal(feed.hasMore, false);
  assert.deepEqual(await feed.loadNext(), { loaded: 0, hasMore: false });
});
