-- Connect passwordless Supabase Auth users to profiles and expose a compact,
-- RLS-respecting catalog RPC for dynamic pages.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE public.affiliate_links
  ADD COLUMN IF NOT EXISTS refresh_due_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

CREATE OR REPLACE FUNCTION public.normalize_catalog_text(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public
AS $$ SELECT btrim(regexp_replace(regexp_replace(lower(public.unaccent(coalesce(value, ''))), '[^[:alnum:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g')) $$;

CREATE OR REPLACE FUNCTION public.normalize_catalog_query(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public
AS $$ SELECT regexp_replace(lower(public.unaccent(coalesce(value, ''))), '[^[:alnum:]]', '', 'g') $$;

CREATE INDEX IF NOT EXISTS idx_products_normalized_title_trgm
  ON public.products USING gin (public.normalize_catalog_text(title) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_catalog(
  search_query TEXT DEFAULT '',
  target_platform TEXT DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL,
  sort_by TEXT DEFAULT 'recent',
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_id UUID DEFAULT NULL,
  cursor_price NUMERIC DEFAULT NULL,
  page_size INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID, platform TEXT, external_id TEXT, title TEXT, description TEXT,
  created_at TIMESTAMPTZ, images JSONB, offer JSONB, affiliate_link JSONB,
  search_score REAL
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public SET pg_trgm.word_similarity_threshold = '0.4'
AS $$
  WITH query AS (
    SELECT public.normalize_catalog_query(search_query) AS value
  )
  SELECT p.id, p.platform, p.external_id, p.title, p.description, p.created_at,
    -- Search cards need one thumbnail; product detail loads the full gallery on demand.
    COALESCE((SELECT jsonb_agg(jsonb_build_object('url', i.url, 'display_order', i.display_order)
      ORDER BY i.display_order) FROM (
        SELECT url, display_order FROM public.product_images
        WHERE product_id = p.id ORDER BY display_order LIMIT 1
      ) i), '[]'::jsonb) AS images,
    (SELECT to_jsonb(o) - 'product_id' FROM public.offers o
      WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) AS offer,
    (SELECT jsonb_build_object('status', a.status, 'verified_at', a.verified_at,
      'expires_at', a.expires_at, 'refresh_due_at', a.refresh_due_at) FROM public.affiliate_links a
      WHERE a.product_id = p.id AND a.status = 'active' ORDER BY a.verified_at DESC LIMIT 1) AS affiliate_link,
    CASE WHEN query.value = '' THEN 1::real
      ELSE GREATEST(similarity(regexp_replace(public.normalize_catalog_text(p.title), ' ', '', 'g'), query.value), word_similarity(query.value, public.normalize_catalog_text(p.title))) END AS search_score
  FROM public.products p CROSS JOIN query
  WHERE p.status = 'published'
    AND (target_platform IS NULL OR p.platform = target_platform)
    AND (min_price IS NULL OR EXISTS (SELECT 1 FROM public.offers o
      WHERE o.product_id = p.id AND o.observed_at = (SELECT max(o2.observed_at) FROM public.offers o2 WHERE o2.product_id = p.id) AND o.price >= min_price))
    AND (max_price IS NULL OR EXISTS (SELECT 1 FROM public.offers o
      WHERE o.product_id = p.id AND o.observed_at = (SELECT max(o2.observed_at) FROM public.offers o2 WHERE o2.product_id = p.id) AND o.price <= max_price))
    AND (query.value = '' OR regexp_replace(public.normalize_catalog_text(p.title), ' ', '', 'g') LIKE '%' || query.value || '%'
      OR query.value <% public.normalize_catalog_text(p.title))
    AND (cursor_created_at IS NULL OR
      (sort_by = 'recent' AND (p.created_at, p.id) < (cursor_created_at, cursor_id)) OR
      (sort_by = 'price_asc' AND (
        (SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) > cursor_price OR
        ((SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) = cursor_price AND (p.created_at, p.id) < (cursor_created_at, cursor_id)))) OR
      (sort_by = 'price_desc' AND (
        (SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) < cursor_price OR
        ((SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) = cursor_price AND (p.created_at, p.id) < (cursor_created_at, cursor_id)))))
  ORDER BY
    CASE WHEN sort_by = 'price_asc' THEN (SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN (SELECT o.price FROM public.offers o WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) END DESC NULLS LAST,
    CASE WHEN query.value <> '' THEN GREATEST(similarity(regexp_replace(public.normalize_catalog_text(p.title), ' ', '', 'g'), query.value), word_similarity(query.value, public.normalize_catalog_text(p.title))) END DESC NULLS LAST,
    p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(page_size, 1), 30);
$$;

GRANT EXECUTE ON FUNCTION public.search_catalog(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID, NUMERIC, INTEGER) TO anon, authenticated;

-- Atomic, idempotent product import. The service key stays in a trusted local
-- importer; this RPC never deletes product/cart identity and preserves offers.
CREATE OR REPLACE FUNCTION public.import_catalog_item(p_item JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  imported_product_id UUID;
  image_item JSONB;
  imported_platform TEXT := p_item ->> 'platform';
  stock_status_value TEXT := coalesce(p_item ->> 'stock_status', 'unknown');
  link_status_value TEXT := coalesce(p_item ->> 'link_status', 'broken');
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF imported_platform NOT IN ('mercadolivre', 'magalu') OR coalesce(p_item ->> 'external_id', '') = '' OR coalesce(p_item ->> 'title', '') = '' THEN
    RAISE EXCEPTION 'invalid_catalog_identity' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.products (platform, external_id, title, description, category, brand, status)
  VALUES (imported_platform, p_item ->> 'external_id', p_item ->> 'title', p_item ->> 'description', p_item ->> 'category', p_item ->> 'brand', p_item ->> 'status')
  ON CONFLICT (platform, external_id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    brand = EXCLUDED.brand, status = EXCLUDED.status
  RETURNING id INTO imported_product_id;

  -- A failed or partial gallery scrape must not erase photos already indexed.
  -- Replace the gallery only when this observation contains at least one image.
  IF jsonb_typeof(p_item -> 'images') = 'array' AND jsonb_array_length(p_item -> 'images') > 0 THEN
    DELETE FROM public.product_images AS pi WHERE pi.product_id = imported_product_id;
    FOR image_item IN SELECT value FROM jsonb_array_elements(p_item -> 'images') LOOP
      INSERT INTO public.product_images (product_id, url, display_order, is_primary)
      VALUES (imported_product_id, image_item ->> 'url', coalesce((image_item ->> 'display_order')::integer, 0), coalesce((image_item ->> 'is_primary')::boolean, false));
    END LOOP;
  END IF;

  INSERT INTO public.offers (product_id, price, old_price, installments_text, shipping_text, coupon_code,
    stock_quantity, stock_status, seller_name, seller_id, store_name, store_affiliate_id, observed_at)
  VALUES (imported_product_id, (p_item ->> 'price')::numeric, nullif(p_item ->> 'old_price', '')::numeric,
    p_item ->> 'installments_text', p_item ->> 'shipping_text', p_item ->> 'coupon_code',
    nullif(p_item ->> 'stock_quantity', '')::integer, stock_status_value,
    coalesce(p_item ->> 'seller_name', 'Loja Parceira'), coalesce(p_item ->> 'seller_id', ''),
    coalesce(p_item ->> 'store_name', imported_platform), coalesce(p_item ->> 'store_affiliate_id', ''),
    coalesce(nullif(p_item ->> 'observed_at', '')::timestamptz, now()));

  INSERT INTO public.affiliate_links (product_id, original_url, affiliate_url, status, verified_at, refresh_due_at, expires_at)
  VALUES (imported_product_id, p_item ->> 'original_url', p_item ->> 'affiliate_url', link_status_value,
    coalesce(nullif(p_item ->> 'verified_at', '')::timestamptz, 'epoch'::timestamptz),
    nullif(p_item ->> 'refresh_due_at', '')::timestamptz, nullif(p_item ->> 'expires_at', '')::timestamptz)
  ON CONFLICT (product_id) DO UPDATE SET original_url = EXCLUDED.original_url,
    affiliate_url = EXCLUDED.affiliate_url, status = EXCLUDED.status, verified_at = EXCLUDED.verified_at,
    refresh_due_at = EXCLUDED.refresh_due_at, expires_at = EXCLUDED.expires_at;
  RETURN imported_product_id;
END;
$$;
REVOKE ALL ON FUNCTION public.import_catalog_item(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_catalog_item(JSONB) TO service_role;

-- Limit account editing to user-facing fields. The existing ID == auth.uid()
-- invariant is preserved so cart ownership policies remain effective.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, phone_e164) ON public.profiles TO authenticated;
