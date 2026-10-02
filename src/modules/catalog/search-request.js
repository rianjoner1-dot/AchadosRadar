/**
 * Build the named PostgREST arguments for the public catalog search RPC.
 * @param {{q?: string, platform?: string, min?: number, max?: number, sort?: string, sector?: string, cursor?: {created_at: string, id: string, price?: number | null, score?: number | null} | null, limit?: number}} input
 */
export function buildCatalogSearchRequest(input) {
  return {
    search_query: input.q ?? '',
    target_platform: input.platform && input.platform !== 'all' ? input.platform : null,
    min_price: input.min ?? null,
    max_price: input.max ?? null,
    sort_by: input.sort ?? 'recent',
    cursor_created_at: input.cursor?.created_at ?? null,
    cursor_id: input.cursor?.id ?? null,
    cursor_price: input.cursor?.price ?? null,
    page_size: input.limit ?? 20,
    cursor_score: input.cursor?.score ?? null,
    target_sector: input.sector || null
  };
}
