-- Read-only performance check. Run ONLY against Supabase development after
-- migration 20261001130000_catalog_sectors_and_search_v2.sql is applied.
-- Record the plans/timing in docs/VALIDACOES_BUSCA_SETORES.md; do not infer
-- production latency from a local fixture or a single query.

BEGIN READ ONLY;
SET LOCAL ROLE anon;
SET LOCAL statement_timeout = '30s';

-- Check the real searchable population and choose common terms from the
-- category distribution below before interpreting the timings.
SELECT platform, status, count(*) AS products,
       count(*) FILTER (WHERE category IS NULL OR btrim(category) = '') AS missing_category
FROM public.products
GROUP BY platform, status
ORDER BY platform, status;

SELECT platform, category, count(*) AS products
FROM public.products
WHERE status = 'published' AND category IS NOT NULL AND btrim(category) <> ''
GROUP BY platform, category
ORDER BY count(*) DESC, platform, category
LIMIT 30;

-- Current v1 baseline versus v2 for an ordinary browse page.
EXPLAIN (ANALYZE, BUFFERS, TIMING, SUMMARY)
SELECT id FROM public.search_catalog('', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL);

EXPLAIN (ANALYZE, BUFFERS, TIMING, SUMMARY)
SELECT id FROM public.search_catalog_v2('', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, NULL);

-- Compare textual search on the same common term selected from the real
-- category distribution. Replace `air fryer` if the actual catalog suggests
-- a more representative query.
EXPLAIN (ANALYZE, BUFFERS, TIMING, SUMMARY)
SELECT id FROM public.search_catalog('air fryer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL);

EXPLAIN (ANALYZE, BUFFERS, TIMING, SUMMARY)
SELECT id FROM public.search_catalog_v2('air fryer', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, NULL);

-- Sector-only request that exercises the product-sector lookup index.
EXPLAIN (ANALYZE, BUFFERS, TIMING, SUMMARY)
SELECT id FROM public.search_catalog_v2('', NULL, NULL, NULL, 'recent', NULL, NULL, NULL, 20, NULL, 'eletronicos');

-- Current indexes available to the invoker query. The plans and buffer counts
-- above determine whether a matching search index is needed; do not add one
-- based on the index listing alone.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'offers', 'product_sectors')
ORDER BY tablename, indexname;

ROLLBACK;
