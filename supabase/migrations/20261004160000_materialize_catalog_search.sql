-- Evaluate expensive token ranks and product scores once, preserving the RPC/RLS contract.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.search_catalog_v2(text,text,numeric,numeric,text,timestamptz,uuid,numeric,integer,real,text)'::regprocedure) INTO definition;
 IF position('WITH query AS (' in definition)=0 OR position('), products AS (' in definition)=0
   OR position(') AS best' in definition)=0 THEN
   RAISE EXCEPTION 'Unexpected search definition; inspect before migration';
 END IF;
 definition := replace(definition, 'WITH query AS (', 'WITH query AS MATERIALIZED (');
 definition := replace(definition, '), products AS (', '), products AS MATERIALIZED (');
 definition := replace(definition, ') AS best', 'OFFSET 0) AS best');
 EXECUTE definition;
END;
$migration$;
NOTIFY pgrst, 'reload schema';
