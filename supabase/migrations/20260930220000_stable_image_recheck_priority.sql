-- Preserve oldest broken-photo reports at the front of the autonomous radar queue.
-- Repeated reports within five minutes are acknowledged without moving queue age.
CREATE OR REPLACE FUNCTION public.report_product_image_failure(
  target_product_id UUID,
  target_image_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_report public.product_image_rechecks%ROWTYPE;
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

  SELECT * INTO existing_report
  FROM public.product_image_rechecks
  WHERE product_id = target_product_id
  FOR UPDATE;

  IF FOUND AND existing_report.failed_image_url = target_image_url
     AND existing_report.last_reported_at > now() - interval '5 minutes' THEN
    RETURN TRUE;
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
  ORDER BY q.first_reported_at ASC, p.id
  LIMIT LEAST(GREATEST(COALESCE(page_size, 20), 1), 20);
$$;

REVOKE ALL ON FUNCTION public.report_product_image_failure(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_product_image_failure(UUID, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_image_recheck_queue(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_image_recheck_queue(INTEGER) TO anon, authenticated;
