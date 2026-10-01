-- Aggregate public catalog activity without retaining visitor identifiers.
CREATE TABLE IF NOT EXISTS public.product_daily_metrics (
  metric_date DATE NOT NULL DEFAULT (timezone('UTC', now()))::date,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  outbound_click_count BIGINT NOT NULL DEFAULT 0 CHECK (outbound_click_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_date, product_id)
);

ALTER TABLE public.product_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_daily_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_daily_metrics FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_daily_metrics TO service_role;

CREATE OR REPLACE FUNCTION public.record_product_metric(
  target_product_id UUID,
  metric_kind TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_product_id IS NULL OR metric_kind IS NULL OR metric_kind NOT IN ('view', 'outbound_click') THEN
    RAISE EXCEPTION 'Invalid product metric';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = target_product_id AND status = 'published'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.product_daily_metrics (metric_date, product_id, view_count, outbound_click_count)
  VALUES (
    (timezone('UTC', now()))::date,
    target_product_id,
    CASE WHEN metric_kind = 'view' THEN 1 ELSE 0 END,
    CASE WHEN metric_kind = 'outbound_click' THEN 1 ELSE 0 END
  )
  ON CONFLICT (metric_date, product_id) DO UPDATE SET
    view_count = product_daily_metrics.view_count + EXCLUDED.view_count,
    outbound_click_count = product_daily_metrics.outbound_click_count + EXCLUDED.outbound_click_count,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_metric(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_metric(UUID, TEXT) TO anon, authenticated;
