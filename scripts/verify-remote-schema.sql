-- Read-only verification for the linked Supabase project. Returns metadata/counts only.
-- Keep the migration inventory synchronized with supabase/migrations; tests enforce parity.
SELECT
  current_database() AS database_name,
  current_setting('server_version') AS server_version,
  (
    SELECT count(*) = 25
    FROM supabase_migrations.schema_migrations
    WHERE version IN (
      '20260929180000', '20260929180100', '20260929180200', '20260929180300',
      '20260929180400', '20260929180500', '20260929180600', '20260929180700',
      '20260930100000', '20260930110000', '20260930120000', '20260930130000',
      '20260930140000', '20260930150000', '20260930160000', '20260930170000',
      '20260930180000', '20260930190000', '20260930200000', '20260930210000',
      '20260930220000', '20260930230000', '20261001090000', '20261001120000',
      '20261001130000'
    )
  ) AS all_site_migrations_applied,
  to_regclass('public.products') IS NOT NULL AS products_table_exists,
  to_regclass('public.product_images') IS NOT NULL AS product_images_table_exists,
  to_regclass('public.offers') IS NOT NULL AS offers_table_exists,
  to_regclass('public.affiliate_links') IS NOT NULL AS affiliate_links_table_exists,
  to_regclass('public.profiles') IS NOT NULL AS profiles_table_exists,
  to_regclass('public.cart_items') IS NOT NULL AS cart_items_table_exists,
  to_regclass('public.catalog_sectors') IS NOT NULL AS catalog_sectors_table_exists,
  to_regclass('public.product_sectors') IS NOT NULL AS product_sectors_table_exists,
  (SELECT count(*) = 10 FROM public.catalog_sectors) AS all_catalog_sectors_seeded,
  (
    SELECT count(*) = 8
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('products', 'product_images', 'offers', 'affiliate_links', 'profiles', 'cart_items', 'catalog_sectors', 'product_sectors')
      AND c.relrowsecurity
  ) AS all_user_tables_have_rls,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') AS avatars_bucket_exists,
  has_column_privilege('anon', 'public.offers', 'price', 'SELECT') AS anon_can_read_offer_price,
  has_column_privilege('anon', 'public.offers', 'id', 'SELECT') AS anon_can_read_offer_tiebreak_id,
  NOT has_column_privilege('anon', 'public.offers', 'seller_id', 'SELECT') AS anon_cannot_read_seller_id,
  has_table_privilege('anon', 'public.product_sectors', 'SELECT') AS anon_can_read_visible_sector_assignments,
  NOT has_table_privilege('anon', 'public.product_sectors', 'INSERT') AS anon_cannot_write_sector_assignments,
  has_table_privilege('authenticated', 'public.product_sectors', 'INSERT') AS importer_role_has_sector_insert_grant,
  to_regprocedure('public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)') IS NOT NULL AS catalog_search_v2_exists,
  COALESCE(has_function_privilege('anon', to_regprocedure('public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)'), 'EXECUTE'), false) AS anon_can_execute_catalog_search_v2,
  EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.search_catalog_v2(text,text,numeric,numeric,text,timestamp with time zone,uuid,numeric,integer,real,text)')
      AND NOT p.prosecdef
  ) AS catalog_search_v2_is_security_invoker,
  NOT has_table_privilege('anon', 'public.cart_items', 'SELECT') AS anon_cannot_read_cart,
  NOT has_table_privilege('anon', 'public.profiles', 'SELECT') AS anon_cannot_read_profiles,
  (
    SELECT count(*)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND grantee = 'anon' AND privilege_type = 'SELECT'
  ) AS explicit_anon_cart_select_grants,
  (
    SELECT count(*)
    FROM pg_auth_members m
    JOIN pg_roles granted ON granted.oid = m.roleid
    JOIN pg_roles member ON member.oid = m.member
    WHERE member.rolname = 'anon' AND granted.rolname = 'authenticated'
  ) AS anon_inherits_authenticated_role,
  has_function_privilege('anon', 'public.get_public_link_state(uuid)', 'EXECUTE') AS anon_can_read_safe_link_state,
  (SELECT count(*) FROM public.profiles) AS profile_row_count,
  (SELECT count(*) FROM public.cart_items) AS cart_row_count;

-- Confirm row visibility using the real public role. A zero count is expected;
-- this transaction changes no data and reads no product names or identifiers.
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT count(*) AS anonymous_visible_nonpublished_sector_assignments
FROM public.product_sectors ps
JOIN public.products p ON p.id = ps.product_id
WHERE p.status <> 'published';
ROLLBACK;
