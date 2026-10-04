-- Keep only anonymous, daily aggregates of useful search terms.
CREATE TABLE IF NOT EXISTS public.search_term_stats (
  search_day DATE NOT NULL DEFAULT CURRENT_DATE,
  normalized_term TEXT NOT NULL,
  target_sector TEXT NOT NULL DEFAULT '',
  search_count BIGINT NOT NULL DEFAULT 1 CHECK (search_count > 0),
  PRIMARY KEY (search_day, normalized_term, target_sector)
);

ALTER TABLE public.search_term_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_term_stats FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_term_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.search_term_stats TO service_role;

-- Migrate only valid aggregate terms, then remove the raw per-search records.
INSERT INTO public.search_term_stats (search_day, normalized_term, target_sector, search_count)
SELECT created_at::date, public.normalize_catalog_text(search_query),
       CASE WHEN EXISTS (SELECT 1 FROM public.catalog_sectors s WHERE s.slug = search_logs.target_sector)
            THEN search_logs.target_sector ELSE '' END,
       count(*)
FROM public.search_logs
WHERE length(btrim(search_query)) BETWEEN 2 AND 100
  AND search_query !~* '(^|[^[:alnum:]])[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|https?://|[0-9]{8,}|(\+?55[[:space:].-]*)?(\([0-9]{2}\)[[:space:].-]*|[0-9]{2}[[:space:].-]*)?9?[0-9]{4}[[:space:].-]?[0-9]{4}'
  AND public.normalize_catalog_text(search_query) <> ''
GROUP BY created_at::date, public.normalize_catalog_text(search_query),
         CASE WHEN EXISTS (SELECT 1 FROM public.catalog_sectors s WHERE s.slug = search_logs.target_sector)
              THEN search_logs.target_sector ELSE '' END
ON CONFLICT (search_day, normalized_term, target_sector)
DO UPDATE SET search_count = public.search_term_stats.search_count + EXCLUDED.search_count;

DROP FUNCTION IF EXISTS public.log_search_term(TEXT, TEXT);

CREATE FUNCTION public.log_search_term(query TEXT, sector TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_term TEXT := public.normalize_catalog_text(btrim(coalesce(query, '')));
  clean_sector TEXT := '';
BEGIN
  IF length(btrim(coalesce(query, ''))) NOT BETWEEN 2 AND 100
     OR query ~* '(^|[^[:alnum:]])[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+|https?://|[0-9]{8,}|(\+?55[[:space:].-]*)?(\([0-9]{2}\)[[:space:].-]*|[0-9]{2}[[:space:].-]*)?9?[0-9]{4}[[:space:].-]?[0-9]{4}'
     OR clean_term = ''
     OR array_length(regexp_split_to_array(clean_term, '\s+'), 1) > 8 THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.catalog_sectors s WHERE s.slug = sector) THEN
    clean_sector := sector;
  END IF;

  INSERT INTO public.search_term_stats (search_day, normalized_term, target_sector, search_count)
  VALUES (CURRENT_DATE, clean_term, clean_sector, 1)
  ON CONFLICT (search_day, normalized_term, target_sector)
  DO UPDATE SET search_count = public.search_term_stats.search_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.log_search_term(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_search_term(TEXT, TEXT) TO anon, authenticated;

DROP TABLE public.search_logs;
