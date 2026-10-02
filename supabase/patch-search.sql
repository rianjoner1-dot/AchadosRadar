-- Patch para corrigir a busca do catálogo e fazer os botões de Setores funcionarem perfeitamente!
-- Este patch altera a função de busca para também pesquisar a categoria e aceitar "Múltiplas Palavras" de forma inteligente.

CREATE OR REPLACE FUNCTION public.search_catalog(
  search_query TEXT DEFAULT '',
  target_platform TEXT DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL,
  sort_by TEXT DEFAULT 'recent',
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_id UUID DEFAULT NULL,
  cursor_price NUMERIC DEFAULT NULL,
  page_size INTEGER DEFAULT 20,
  cursor_score REAL DEFAULT NULL
)
RETURNS TABLE (
  id UUID, platform TEXT, external_id TEXT, title TEXT, description TEXT,
  created_at TIMESTAMPTZ, images JSONB, offer JSONB, affiliate_link JSONB,
  search_score REAL
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH normalized_query AS (
    SELECT public.normalize_catalog_query(search_query) AS value
  ), ranked_products AS (
    SELECT
      p.id, p.platform, p.external_id, p.title, p.description, p.created_at,
      (SELECT o.price FROM public.offers o
        WHERE o.product_id = p.id ORDER BY o.observed_at DESC LIMIT 1) AS current_price,
      CASE WHEN q.value = '' THEN 1::real
        ELSE GREATEST(
          similarity(regexp_replace(public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, '')), ' ', '', 'g'), q.value),
          word_similarity(q.value, public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, '')))
        )
      END AS search_score
    FROM public.products p
    CROSS JOIN normalized_query q
    WHERE p.status = 'published'
      AND (target_platform IS NULL OR p.platform = target_platform)
      AND (min_price IS NULL OR EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.product_id = p.id
          AND o.observed_at = (SELECT max(o2.observed_at) FROM public.offers o2 WHERE o2.product_id = p.id)
          AND o.price >= min_price
      ))
      AND (max_price IS NULL OR EXISTS (
        SELECT 1 FROM public.offers o
        WHERE o.product_id = p.id
          AND o.observed_at = (SELECT max(o2.observed_at) FROM public.offers o2 WHERE o2.product_id = p.id)
          AND o.price <= max_price
      ))
      AND (q.value = '' OR
        regexp_replace(public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, '')), ' ', '', 'g') LIKE '%' || q.value || '%'
        OR word_similarity(q.value, public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, ''))) >= 0.15
      )
  )
  SELECT
    r.id, r.platform, r.external_id, r.title, r.description, r.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('url', i.url, 'display_order', i.display_order) ORDER BY i.display_order)
      FROM (
        SELECT url, display_order FROM public.product_images
        WHERE product_id = r.id ORDER BY display_order LIMIT 1
      ) i
    ), '[]'::jsonb) AS images,
    (SELECT jsonb_build_object(
      'price', o.price, 'old_price', o.old_price, 'discount_percent', o.discount_percent,
      'installments_text', o.installments_text, 'shipping_text', o.shipping_text,
      'coupon_code', o.coupon_code, 'stock_quantity', o.stock_quantity, 'stock_status', o.stock_status,
      'seller_name', o.seller_name, 'store_name', o.store_name, 'observed_at', o.observed_at
    ) FROM public.offers o WHERE o.product_id = r.id ORDER BY o.observed_at DESC LIMIT 1) AS offer,
    (SELECT jsonb_build_object('status', a.status, 'verified_at', a.verified_at,
      'expires_at', a.expires_at, 'refresh_due_at', a.refresh_due_at)
      FROM public.affiliate_links a
      WHERE a.product_id = r.id AND a.status = 'active'
      ORDER BY a.verified_at DESC LIMIT 1) AS affiliate_link,
    r.search_score
  FROM ranked_products r
  CROSS JOIN normalized_query q
  WHERE cursor_created_at IS NULL OR CASE
    WHEN sort_by = 'price_asc' THEN
      (r.current_price IS NULL AND cursor_price IS NOT NULL)
      OR (r.current_price IS NOT DISTINCT FROM cursor_price
        AND (r.search_score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id))
      OR (r.current_price IS NOT NULL AND cursor_price IS NOT NULL AND r.current_price > cursor_price)
    WHEN sort_by = 'price_desc' THEN
      (r.current_price IS NULL AND cursor_price IS NOT NULL)
      OR (r.current_price IS NOT DISTINCT FROM cursor_price
        AND (r.search_score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id))
      OR (r.current_price IS NOT NULL AND cursor_price IS NOT NULL AND r.current_price < cursor_price)
    ELSE (r.search_score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id)
  END
  ORDER BY
    CASE WHEN sort_by = 'price_asc' THEN r.current_price END ASC NULLS LAST,
    CASE WHEN sort_by = 'price_desc' THEN r.current_price END DESC NULLS LAST,
    CASE WHEN q.value <> '' THEN r.search_score END DESC NULLS LAST,
    r.created_at DESC, r.id DESC
  LIMIT LEAST(GREATEST(page_size, 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.search_catalog(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID, NUMERIC, INTEGER, REAL) TO anon, authenticated;
