/** Pagination follows source rows, including rows hidden by image validation. */
export function getCatalogPageProgress(items, limit) {
  if (items.catalogPagination) return items.catalogPagination;
  const last = items.at(-1);
  return { exhausted: items.length < limit, cursor: last ? {
    created_at: last.created_at, id: last.id,
    price: last.offer?.price ?? null, score: last.search_score ?? null
  } : null };
}

export function attachCatalogPageProgress(visible, source, limit) {
  Object.defineProperty(visible, 'catalogPagination', {
    value: getCatalogPageProgress(source, limit), enumerable: false
  });
  return visible;
}
