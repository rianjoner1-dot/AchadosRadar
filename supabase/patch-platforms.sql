-- Remove a constraint antiga que barrava tudo menos magalu/mercadolivre
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_platform_check;

-- Adiciona a nova constraint suportando Amazon e Shopee
ALTER TABLE public.products ADD CONSTRAINT products_platform_check CHECK (platform IN ('mercadolivre', 'magalu', 'amazon', 'shopee'));

-- Atualiza a função import_catalog_item para aceitar as novas plataformas
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
  
  -- UPDATE AQUI: Adicionado amazon e shopee na verificação
  IF imported_platform NOT IN ('mercadolivre', 'magalu', 'amazon', 'shopee') OR coalesce(p_item ->> 'external_id', '') = '' OR coalesce(p_item ->> 'title', '') = '' THEN
    RAISE EXCEPTION 'invalid_catalog_identity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.products (platform, external_id, title, description, category, brand, status)
  VALUES (imported_platform, p_item ->> 'external_id', p_item ->> 'title', p_item ->> 'description', p_item ->> 'category', p_item ->> 'brand', p_item ->> 'status')
  ON CONFLICT (platform, external_id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category,
    brand = EXCLUDED.brand, status = EXCLUDED.status
  RETURNING id INTO imported_product_id;

  IF jsonb_typeof(p_item -> 'images') = 'array' AND jsonb_array_length(p_item -> 'images') > 0 THEN
    DELETE FROM public.product_images AS pi WHERE pi.product_id = imported_product_id;
    FOR image_item IN SELECT value FROM jsonb_array_elements(p_item -> 'images') LOOP
      INSERT INTO public.product_images (product_id, url, display_order, is_primary)
      VALUES (imported_product_id, image_item ->> 'url', (image_item ->> 'display_order')::INT, (image_item ->> 'is_primary')::BOOLEAN);
    END LOOP;
  END IF;

  IF p_item ? 'price' THEN
    INSERT INTO public.offers (product_id, price, old_price, installments_text, shipping_text, coupon_code, stock_quantity, stock_status, observed_at, stock_evidence, seller_name, seller_id, store_name, store_affiliate_id)
    VALUES (
      imported_product_id,
      (p_item ->> 'price')::NUMERIC,
      CASE WHEN p_item ->> 'old_price' IS NOT NULL THEN (p_item ->> 'old_price')::NUMERIC ELSE NULL END,
      p_item ->> 'installments_text',
      p_item ->> 'shipping_text',
      p_item ->> 'coupon_code',
      CASE WHEN p_item ->> 'stock_quantity' IS NOT NULL THEN (p_item ->> 'stock_quantity')::INT ELSE NULL END,
      stock_status_value,
      (p_item ->> 'observed_at')::TIMESTAMPTZ,
      p_item ->> 'stock_evidence',
      p_item ->> 'seller_name',
      p_item ->> 'seller_id',
      p_item ->> 'store_name',
      p_item ->> 'store_affiliate_id'
    );
  END IF;

  INSERT INTO public.affiliate_links (product_id, original_url, affiliate_url, is_official, link_status, verified_at, refresh_due_at, expires_at)
  VALUES (
    imported_product_id, p_item ->> 'original_url', p_item ->> 'affiliate_url',
    (p_item ->> 'link_is_official')::BOOLEAN, link_status_value,
    CASE WHEN p_item ->> 'verified_at' IS NOT NULL THEN (p_item ->> 'verified_at')::TIMESTAMPTZ ELSE NULL END,
    CASE WHEN p_item ->> 'refresh_due_at' IS NOT NULL THEN (p_item ->> 'refresh_due_at')::TIMESTAMPTZ ELSE NULL END,
    CASE WHEN p_item ->> 'expires_at' IS NOT NULL THEN (p_item ->> 'expires_at')::TIMESTAMPTZ ELSE NULL END
  )
  ON CONFLICT (product_id) DO UPDATE SET
    original_url = EXCLUDED.original_url, affiliate_url = EXCLUDED.affiliate_url,
    is_official = EXCLUDED.is_official, link_status = EXCLUDED.link_status,
    verified_at = EXCLUDED.verified_at, refresh_due_at = EXCLUDED.refresh_due_at,
    expires_at = EXCLUDED.expires_at, updated_at = now();

  RETURN imported_product_id;
END;
$$;

-- Atualiza a função archive_unavailable_catalog_item
CREATE OR REPLACE FUNCTION public.archive_unavailable_catalog_item(p_platform TEXT, p_external_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  archived_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  
  -- UPDATE AQUI: Adicionado amazon e shopee na verificação
  IF p_platform NOT IN ('mercadolivre', 'magalu', 'amazon', 'shopee') OR COALESCE(p_external_id, '') = '' THEN
    RAISE EXCEPTION 'invalid_catalog_identity' USING ERRCODE = '22023';
  END IF;

  UPDATE public.products
  SET status = 'archived', updated_at = now()
  WHERE platform = p_platform AND external_id = p_external_id AND status = 'published'
  RETURNING id INTO archived_id;
  
  RETURN archived_id IS NOT NULL;
END;
$$;
