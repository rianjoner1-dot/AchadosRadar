-- Read-only preflight for Supabase development, before applying the v2 search
-- migration. It reports schema shape and aggregate category coverage only.

BEGIN READ ONLY;

SELECT current_database() AS database_name,
       current_setting('server_version') AS server_version,
       to_regclass('public.products') IS NOT NULL AS products_exists,
       to_regprocedure('public.search_catalog(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real)') IS NOT NULL AS current_search_rpc_exists,
       to_regprocedure('public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)') IS NOT NULL AS v2_rpc_already_exists,
       to_regclass('public.catalog_sectors') IS NOT NULL AS catalog_sectors_already_exists,
       to_regclass('public.product_sectors') IS NOT NULL AS product_sectors_already_exists,
       EXISTS (
         SELECT 1 FROM supabase_migrations.schema_migrations
         WHERE version = '20261001130000'
       ) AS v2_migration_already_recorded;

-- Compare the deployed source schema with this checkout before applying DDL.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'offers', 'product_images', 'affiliate_links', 'catalog_sectors', 'product_sectors')
ORDER BY table_name, ordinal_position;

-- Aggregate coverage for category rules; no titles, seller data or account data.
SELECT platform, status, count(*) AS products,
       count(*) FILTER (WHERE category IS NULL OR btrim(category) = '') AS missing_category,
       count(DISTINCT category) FILTER (WHERE category IS NOT NULL AND btrim(category) <> '') AS distinct_categories
FROM public.products
GROUP BY platform, status
ORDER BY platform, status;

SELECT platform, category, count(*) AS products
FROM public.products
WHERE status = 'published' AND category IS NOT NULL AND btrim(category) <> ''
GROUP BY platform, category
ORDER BY platform, count(*) DESC, category
LIMIT 40;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'offers', 'product_images', 'affiliate_links')
ORDER BY tablename, indexname;

ROLLBACK;
