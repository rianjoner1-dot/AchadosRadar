-- Keep a saved item reconstructable for its owner after a listing is archived.
-- Anonymous users and other authenticated users still see published products only.
DROP POLICY IF EXISTS "cart_owners_read_saved_archived_products" ON public.products;
CREATE POLICY "cart_owners_read_saved_archived_products"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    status = 'archived'
    AND EXISTS (
      SELECT 1
      FROM public.cart_items AS saved
      WHERE saved.product_id = products.id
        AND saved.user_id = auth.uid()
    )
  );
