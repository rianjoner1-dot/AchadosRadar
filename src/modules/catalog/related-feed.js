export const RELATED_PAGE_SIZE = 12;
export const RELATED_DOM_LIMIT = 60;

/** Keeps the related-products cursor independent from the bounded rendered DOM. */
export function createRelatedFeed({ currentProductId, searchPage, appendProducts, trimOldest, setHasMore, onError }) {
  let cursor = null;
  let loading = false;
  let hasMore = true;
  let autoLoadPaused = false;
  const seenIds = new Set([currentProductId]);

  async function loadNext() {
    if (loading || !hasMore) return { loaded: 0, hasMore };
    loading = true;
    try {
      const items = await searchPage({ cursor, limit: RELATED_PAGE_SIZE });
      if (items.length) {
        const last = items.at(-1);
        cursor = { created_at: last.created_at, id: last.id, price: last.offer?.price ?? null, score: last.search_score ?? null };
      }
      const fresh = items.filter((item) => !seenIds.has(item.id));
      fresh.forEach((item) => seenIds.add(item.id));
      appendProducts(fresh);
      trimOldest(RELATED_DOM_LIMIT, (removedId) => {
        if (removedId && removedId !== currentProductId) seenIds.delete(removedId);
      });
      hasMore = items.length === RELATED_PAGE_SIZE;
      setHasMore(hasMore);
      autoLoadPaused = false;
      return { loaded: fresh.length, hasMore, cursor };
    } catch (error) {
      autoLoadPaused = true;
      onError(error);
      return { loaded: 0, hasMore, error };
    } finally {
      loading = false;
    }
  }

  return {
    loadNext,
    get hasMore() { return hasMore; },
    get isLoading() { return loading; },
    get autoLoadPaused() { return autoLoadPaused; },
    get renderedLimit() { return RELATED_DOM_LIMIT; }
  };
}
