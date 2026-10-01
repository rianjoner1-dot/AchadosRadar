CREATE OR REPLACE FUNCTION public.get_admin_product_metrics(days_back INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_days INTEGER := LEAST(GREATEST(COALESCE(days_back, 30), 1), 90);
  through_date DATE := (timezone('UTC', now()))::date;
  from_date DATE;
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  from_date := through_date - (requested_days - 1);

  WITH product_totals AS (
    SELECT p.id AS product_id, p.title, p.platform,
      SUM(m.view_count) AS views,
      SUM(m.outbound_click_count) AS outbound_clicks
    FROM public.product_daily_metrics m
    JOIN public.products p ON p.id = m.product_id
    WHERE m.metric_date BETWEEN from_date AND through_date
      AND p.status = 'published'
    GROUP BY p.id, p.title, p.platform
  )
  SELECT jsonb_build_object(
    'days', requested_days,
    'from', from_date,
    'through', through_date,
    'totals', jsonb_build_object(
      'views', COALESCE((SELECT SUM(views) FROM product_totals), 0),
      'outboundClicks', COALESCE((SELECT SUM(outbound_clicks) FROM product_totals), 0)
    ),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'productId', ranked.product_id,
        'title', ranked.title,
        'platform', ranked.platform,
        'views', ranked.views,
        'outboundClicks', ranked.outbound_clicks
      ) ORDER BY ranked.views DESC, ranked.outbound_clicks DESC, ranked.title)
      FROM (SELECT * FROM product_totals ORDER BY views DESC, outbound_clicks DESC, title LIMIT 100) ranked
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_product_metrics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_product_metrics(INTEGER) TO authenticated;
