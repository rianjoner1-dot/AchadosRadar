-- Read-only verification for the linked Supabase project. Returns metadata/counts only.
-- Keep the migration inventory synchronized with supabase/migrations; tests enforce parity.
SELECT
  current_database() AS database_name,
  current_setting('server_version') AS server_version,
  (
    SELECT count(*) = 24
    FROM supabase_migrations.schema_migrations
    WHERE version IN (
      '20260929180000', '20260929180100', '20260929180200', '20260929180300',
      '20260929180400', '20260929180500', '20260929180600', '20260929180700',
      '20260930100000', '20260930110000', '20260930120000', '20260930130000',
      '20260930140000', '20260930150000', '20260930160000', '20260930170000',
      '20260930180000', '20260930190000', '20260930200000', '20260930210000',
      '20260930220000', '20260930230000', '20261001090000', '20261001120000'
    )
  ) AS all_site_migrations_applied,
  to_regclass('public.products') IS NOT NULL AS products_table_exists,
  to_regclass('public.product_images') IS NOT NULL AS product_images_table_exists,
  to_regclass('public.offers') IS NOT NULL AS offers_table_exists,
  to_regclass('public.affiliate_links') IS NOT NULL AS affiliate_links_table_exists,
  to_regclass('public.profiles') IS NOT NULL AS profiles_table_exists,
  to_regclass('public.cart_items') IS NOT NULL AS cart_items_table_exists,
  (
    SELECT count(*) = 6
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('products', 'product_images', 'offers', 'affiliate_links', 'profiles', 'cart_items')
      AND c.relrowsecurity
  ) AS all_user_tables_have_rls,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') AS avatars_bucket_exists,
  has_column_privilege('anon', 'public.offers', 'price', 'SELECT') AS anon_can_read_offer_price,
  NOT has_column_privilege('anon', 'public.offers', 'seller_id', 'SELECT') AS anon_cannot_read_seller_id,
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
