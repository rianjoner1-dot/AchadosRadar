ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS reviews_count INTEGER CHECK (reviews_count IS NULL OR reviews_count >= 0),
  ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(specifications) = 'array' AND jsonb_array_length(specifications) <= 18);

CREATE OR REPLACE FUNCTION public.import_catalog_item(p_item JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  imported_product_id UUID;
  image_item JSONB;
  video_item JSONB;
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
  IF jsonb_typeof(coalesce(p_item -> 'specifications', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(coalesce(p_item -> 'specifications', '[]'::jsonb)) > 18 THEN
    RAISE EXCEPTION 'invalid_product_specifications' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.products (platform, external_id, title, description, category, brand, rating, reviews_count, specifications, status)
  VALUES (imported_platform, p_item ->> 'external_id', p_item ->> 'title', p_item ->> 'description', p_item ->> 'category', p_item ->> 'brand',
    nullif(p_item ->> 'rating', '')::numeric, nullif(p_item ->> 'reviews_count', '')::integer,
    coalesce(p_item -> 'specifications', '[]'::jsonb), coalesce(p_item ->> 'status', 'draft'))
  ON CONFLICT (platform, external_id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    brand = EXCLUDED.brand, rating = coalesce(EXCLUDED.rating, products.rating),
    reviews_count = coalesce(EXCLUDED.reviews_count, products.reviews_count),
    specifications = CASE WHEN jsonb_array_length(EXCLUDED.specifications) > 0 THEN EXCLUDED.specifications ELSE products.specifications END,
    status = EXCLUDED.status
  RETURNING id INTO imported_product_id;

  IF jsonb_typeof(p_item -> 'images') = 'array' AND jsonb_array_length(p_item -> 'images') > 0 THEN
    DELETE FROM public.product_images WHERE product_id = imported_product_id;
    FOR image_item IN SELECT value FROM jsonb_array_elements(p_item -> 'images') LIMIT 3 LOOP
      IF coalesce(image_item ->> 'url', '') LIKE 'https://%' THEN
        INSERT INTO public.product_images (product_id, url, display_order, is_primary)
        VALUES (imported_product_id, image_item ->> 'url', coalesce((image_item ->> 'display_order')::integer, 0), coalesce((image_item ->> 'is_primary')::boolean, false));
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_item -> 'videos') = 'array' AND jsonb_array_length(p_item -> 'videos') > 0 THEN
    DELETE FROM public.product_videos WHERE product_id = imported_product_id;
    FOR video_item IN SELECT value FROM jsonb_array_elements(p_item -> 'videos') LIMIT 1 LOOP
      IF coalesce(video_item ->> 'url', '') LIKE 'https://%' THEN
        INSERT INTO public.product_videos (product_id, url, poster_url, display_order)
        VALUES (imported_product_id, video_item ->> 'url', nullif(video_item ->> 'poster_url', ''), 0);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.offers (product_id, price, pix_price, card_price, old_price, installments_text, shipping_text, coupon_code,
    stock_quantity, stock_status, seller_name, seller_id, store_name, store_affiliate_id, observed_at)
  VALUES (imported_product_id, (p_item ->> 'price')::numeric, nullif(p_item ->> 'pix_price', '')::numeric,
    nullif(p_item ->> 'card_price', '')::numeric, nullif(p_item ->> 'old_price', '')::numeric,
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
