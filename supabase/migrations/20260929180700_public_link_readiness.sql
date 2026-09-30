-- Public UI needs a useful blocked-state reason without exposing inactive URLs.
CREATE OR REPLACE FUNCTION public.get_public_link_state(target_product_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p.status = 'published' THEN (
    SELECT jsonb_build_object(
      'status', a.status,
      'verified_at', a.verified_at,
      'expires_at', a.expires_at,
      'refresh_due_at', a.refresh_due_at
    )
    FROM public.affiliate_links a
    WHERE a.product_id = p.id
    ORDER BY a.verified_at DESC
    LIMIT 1
  ) ELSE NULL END
  FROM public.products p
  WHERE p.id = target_product_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_link_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_link_state(UUID) TO anon, authenticated;
