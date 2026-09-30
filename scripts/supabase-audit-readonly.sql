-- Metadata-only audit. This file contains SELECT statements and returns no user rows.
SELECT jsonb_build_object(
  'buckets', (
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    ) ORDER BY id)
    FROM storage.buckets
    WHERE id IN ('avatars', 'produtos', 'InstagramTemporario')
  ),
  'tables', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', n.nspname || '.' || c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) ORDER BY n.nspname, c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('products', 'product_images', 'offers', 'affiliate_links', 'profiles', 'cart_items')
      AND c.relkind = 'r'
  ),
  'policies', (
    SELECT jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'with_check', with_check
    ) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies
    WHERE (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%')
       OR (schemaname = 'public' AND tablename IN ('profiles', 'cart_items'))
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'settings', p.proconfig,
      'grants', p.proacl
    ) ORDER BY p.proname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('search_catalog', 'get_public_link_state', 'import_catalog_item')
  )
) AS audit_metadata;
