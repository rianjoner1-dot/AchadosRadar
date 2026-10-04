const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('anonymous search migration keeps only normalized daily aggregates', async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.catalog_sectors (slug text PRIMARY KEY);
    INSERT INTO public.catalog_sectors VALUES ('moda');
    CREATE FUNCTION public.normalize_catalog_text(text) RETURNS text LANGUAGE sql IMMUTABLE AS
      $$ SELECT regexp_replace(lower(btrim(coalesce($1, ''))), '\\s+', ' ', 'g') $$;
    CREATE TABLE public.search_logs (id uuid DEFAULT gen_random_uuid(), search_query text NOT NULL, target_sector text, created_at timestamptz DEFAULT now());
    INSERT INTO public.search_logs(search_query, target_sector) VALUES ('Vestido Midi', 'moda'), ('rian@email.test', 'moda');
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261002150000_aggregate_anonymous_searches.sql'), 'utf8'));
  await db.exec(`SELECT public.log_search_term('Rack painel', 'moveis'); SELECT public.log_search_term('meuemail@example.com', 'moda'); SELECT public.log_search_term('(11) 99999-9999', 'moda');`);
  const { rows } = await db.query('SELECT normalized_term, target_sector, search_count FROM public.search_term_stats ORDER BY normalized_term');
  assert.deepEqual(rows, [
    { normalized_term: 'rack painel', target_sector: '', search_count: 1 },
    { normalized_term: 'vestido midi', target_sector: 'moda', search_count: 1 }
  ]);
  assert.equal((await db.query("SELECT to_regclass('public.search_logs') IS NULL AS raw_table_removed")).rows[0].raw_table_removed, true);
  await db.close();
});
