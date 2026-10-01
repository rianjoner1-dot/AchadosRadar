-- Report broken product images to the autonomous radar without hiding a product
-- based on a transient browser/network failure.
CREATE TABLE IF NOT EXISTS public.product_image_rechecks (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  failed_image_url TEXT NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 1 CHECK (report_count > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed_missing')),
  first_reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_image_rechecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_image_rechecks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_image_rechecks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_image_rechecks TO service_role;

CREATE OR REPLACE FUNCTION public.report_product_image_failure(
  target_product_id UUID,
  target_image_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_image_url IS NULL OR length(target_image_url) > 2048
     OR target_image_url !~ '^https://' THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.product_images i ON i.product_id = p.id
    WHERE p.id = target_product_id AND p.status = 'published' AND i.url = target_image_url
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.product_image_rechecks (product_id, failed_image_url)
  VALUES (target_product_id, target_image_url)
  ON CONFLICT (product_id) DO UPDATE SET
    failed_image_url = EXCLUDED.failed_image_url,
    report_count = public.product_image_rechecks.report_count + 1,
    status = 'pending',
    last_reported_at = now();
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.report_product_image_failure(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_product_image_failure(UUID, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_image_recheck_queue(page_size INTEGER DEFAULT 20)
RETURNS TABLE (
  product_id UUID,
  platform TEXT,
  external_id TEXT,
  title TEXT,
  original_url TEXT,
  failed_image_url TEXT,
  report_count INTEGER,
  last_reported_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.platform, p.external_id, p.title, a.original_url,
         q.failed_image_url, q.report_count, q.last_reported_at
  FROM public.product_image_rechecks q
  JOIN public.products p ON p.id = q.product_id
  JOIN public.affiliate_links a ON a.product_id = p.id
  WHERE q.status = 'pending' AND p.status = 'published'
  ORDER BY q.last_reported_at ASC, p.id
  LIMIT LEAST(GREATEST(COALESCE(page_size, 20), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.get_public_image_recheck_queue(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_image_recheck_queue(INTEGER) TO anon, authenticated;

-- A successful catalog import replaces images and clears the pending recheck.
CREATE OR REPLACE FUNCTION public.clear_image_recheck_after_image_import()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.product_image_rechecks WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_image_recheck_after_image_import() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clear_image_recheck_after_image_import ON public.product_images;
CREATE TRIGGER trg_clear_image_recheck_after_image_import
  AFTER INSERT ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.clear_image_recheck_after_image_import();

-- Restore the standard importer; image failure alone never changes publication status.
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

CREATE OR REPLACE FUNCTION public.archive_unavailable_catalog_item(
  p_platform TEXT,
  p_external_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_id UUID;
BEGIN
  IF p_platform NOT IN ('mercadolivre', 'magalu') OR COALESCE(p_external_id, '') = '' THEN
    RAISE EXCEPTION 'invalid_catalog_identity' USING ERRCODE = '22023';
  END IF;
  UPDATE public.products
  SET status = 'archived'
  WHERE platform = p_platform AND external_id = p_external_id AND status = 'published'
  RETURNING id INTO archived_id;
  IF archived_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE public.product_image_rechecks
  SET status = 'confirmed_missing'
  WHERE product_id = archived_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_unavailable_catalog_item(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_unavailable_catalog_item(TEXT, TEXT) TO service_role;
