-- Keep private seller/account identifiers in storage while exposing only fields used by the public catalog.
REVOKE SELECT ON TABLE public.offers FROM anon, authenticated;
GRANT SELECT (product_id, price, old_price, discount_percent, installments_text, shipping_text,
  coupon_code, stock_quantity, stock_status, seller_name, store_name, observed_at)
ON public.offers TO anon, authenticated;

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
    (SELECT jsonb_build_object(
      'price', o.price, 'old_price', o.old_price, 'discount_percent', o.discount_percent,
      'installments_text', o.installments_text, 'shipping_text', o.shipping_text,
      'coupon_code', o.coupon_code, 'stock_quantity', o.stock_quantity, 'stock_status', o.stock_status,
      'seller_name', o.seller_name, 'store_name', o.store_name, 'observed_at', o.observed_at
    ) FROM public.offers o
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
  LIMIT LEAST(GREATEST(page_size, 1), 20);
$$;
