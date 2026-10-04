const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('observed product ratings and specifications migration constrains and stores source facts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
      CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), platform text NOT NULL, external_id text NOT NULL, title text NOT NULL, description text, category text, brand text, status text NOT NULL DEFAULT 'draft', UNIQUE(platform, external_id));
      CREATE TABLE public.product_images (product_id uuid NOT NULL, url text NOT NULL, display_order integer NOT NULL, is_primary boolean NOT NULL DEFAULT false);
      CREATE TABLE public.offers (product_id uuid NOT NULL, price numeric NOT NULL, pix_price numeric, card_price numeric, old_price numeric, discount_percent numeric, installments_text text, shipping_text text, coupon_code text, stock_quantity integer, stock_status text, seller_name text, seller_id text, store_name text, store_affiliate_id text, observed_at timestamptz);
      CREATE TABLE public.affiliate_links (product_id uuid PRIMARY KEY, original_url text, affiliate_url text, status text, verified_at timestamptz, refresh_due_at timestamptz, expires_at timestamptz);
    `);
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261003100000_product_observed_ratings_and_specs.sql'), 'utf8');
    await db.exec(migration);
    await db.query("INSERT INTO public.products(id, platform, external_id, title, rating, reviews_count, specifications) VALUES (gen_random_uuid(), 'magalu', 'SKU-1', 'Product', 4.75, 12, '[{\"name\":\"Potência\",\"value\":\"1500 W\"}]'::jsonb)");
    const { rows } = await db.query('SELECT rating, reviews_count, specifications FROM public.products');
    assert.equal(rows[0].rating, '4.75');
    assert.equal(rows[0].reviews_count, 12);
    assert.deepEqual(rows[0].specifications, [{ name: 'Potência', value: '1500 W' }]);
    const imported = await db.query(`SELECT public.import_catalog_item($json$
      {"platform":"magalu","external_id":"SKU-IMPORT","title":"Produto importado","description":"Descrição observada","rating":4.6,"reviews_count":27,"specifications":[{"name":"Material","value":"Aço"}],"price":19.9,"pix_price":18.9,"card_price":19.9,"stock_status":"unknown","images":[{"url":"https://a-static.mlcdn.com.br/item.jpg","display_order":0,"is_primary":true}],"videos":[],"link_status":"broken","original_url":"https://www.magazineluiza.com.br/p/SKU-IMPORT/produto","affiliate_url":"","status":"draft"}
    $json$::jsonb) AS id`);
    const savedId = imported.rows[0].id;
    const persisted = await db.query('SELECT rating, reviews_count, specifications, description FROM public.products WHERE id = $1', [savedId]);
    assert.equal(persisted.rows[0].rating, '4.60');
    assert.equal(persisted.rows[0].reviews_count, 27);
    assert.deepEqual(persisted.rows[0].specifications, [{ name: 'Material', value: 'Aço' }]);
    assert.equal(persisted.rows[0].description, 'Descrição observada');
    await db.query(`SELECT public.import_catalog_item($json${'$'}{"platform":"magalu","external_id":"SKU-IMPORT","title":"Produto importado","rating":null,"reviews_count":null,"specifications":[],"price":19.9,"stock_status":"unknown","videos":[],"link_status":"broken","original_url":"https://www.magazineluiza.com.br/p/SKU-IMPORT/produto","affiliate_url":"","status":"draft"}${'$'}json${'$'}::jsonb)`);
    const preserved = await db.query('SELECT rating, reviews_count, specifications FROM public.products WHERE id = $1', [savedId]);
    assert.deepEqual(preserved.rows[0].specifications, [{ name: 'Material', value: 'Aço' }], 'partial imports retain previously captured product attributes');
    await assert.rejects(db.query("INSERT INTO public.products(id, platform, external_id, title, rating) VALUES (gen_random_uuid(), 'magalu', 'SKU-2', 'Bad rating', 5.1)"));
    await assert.rejects(db.query("INSERT INTO public.products(id, platform, external_id, title, specifications) VALUES (gen_random_uuid(), 'magalu', 'SKU-3', 'Bad specs', '{}'::jsonb)"));
  } finally {
    await db.close();
  }
});
