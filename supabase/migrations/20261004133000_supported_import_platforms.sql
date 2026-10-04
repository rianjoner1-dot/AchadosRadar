BEGIN;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_platform_check;
ALTER TABLE public.products ADD CONSTRAINT products_platform_check
  CHECK (platform IN ('mercadolivre','magalu','amazon','shopee','kabum'));
DO $migration$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.import_catalog_item(jsonb)'::regprocedure) INTO definition;
  IF position('imported_platform NOT IN (''mercadolivre'', ''magalu'')' IN definition) > 0 THEN
    definition := replace(definition,
      'imported_platform NOT IN (''mercadolivre'', ''magalu'')',
      'imported_platform NOT IN (''mercadolivre'', ''magalu'', ''amazon'', ''shopee'', ''kabum'')');
    EXECUTE definition;
  ELSIF position('''kabum''' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected import_catalog_item definition; manual review required';
  END IF;
END;
$migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
