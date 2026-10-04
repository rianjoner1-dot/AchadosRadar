BEGIN;
DO $migration$
DECLARE definition TEXT; start_at INTEGER; end_at INTEGER; insertion TEXT;
BEGIN
 SELECT pg_get_functiondef('public.import_catalog_item(jsonb)'::regprocedure) INTO definition;
 IF position('-- offer_observation_retry_guard' IN definition)>0 THEN RETURN; END IF;
 start_at := position('  INSERT INTO public.offers' IN definition);
 end_at := position('  INSERT INTO public.affiliate_links' IN definition);
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'Unexpected offer import body'; END IF;
 insertion := substring(definition FROM start_at FOR end_at-start_at);
 definition := substring(definition FROM 1 FOR start_at-1)
  || E'  -- offer_observation_retry_guard\n  IF NOT EXISTS (SELECT 1 FROM public.offers WHERE product_id=imported_product_id AND observed_at=coalesce(nullif(p_item ->> ''observed_at'', '''')::timestamptz, now())) THEN\n'
  || insertion || E'  END IF;\n\n' || substring(definition FROM end_at);
 EXECUTE definition;
END;
$migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
