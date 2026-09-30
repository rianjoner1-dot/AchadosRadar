-- Read-only verification for the linked Supabase project. Returns metadata/counts only.
SELECT
  current_database() AS database_name,
  current_setting('server_version') AS server_version,
  (
    SELECT count(*) = 10
    FROM supabase_migrations.schema_migrations
    WHERE version IN (
      '20260929180000', '20260929180100', '20260929180200', '20260929180300',
      '20260929180400', '20260929180500', '20260929180600', '20260929180700',
      '20260930100000', '20260930110000'
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
  has_function_privilege('anon', 'public.get_public_link_state(uuid)', 'EXECUTE') AS anon_can_read_safe_link_state,
  (SELECT count(*) FROM public.profiles) AS profile_row_count,
  (SELECT count(*) FROM public.cart_items) AS cart_row_count;
