const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('gaming classification merges into electronics without missing-sector foreign keys', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE FUNCTION public.normalize_catalog_text(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(coalesce(value,'')) $$;
      CREATE TABLE catalog_sectors(slug text PRIMARY KEY);
      INSERT INTO catalog_sectors VALUES ('pc-gamer'),('eletronicos');
      CREATE TABLE product_sectors(product_id uuid,sector_slug text REFERENCES catalog_sectors(slug),assignment_source text,PRIMARY KEY(product_id,sector_slug));
      INSERT INTO product_sectors VALUES ('00000000-0000-0000-0000-000000000001','pc-gamer','title');`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261004134500_merge_gaming_sector.sql'),'utf8'));
    assert.deepEqual((await db.query('SELECT sector_slug FROM product_sectors')).rows,[{sector_slug:'eletronicos'}]);
    for (const title of ['Gabinete gamer','Memoria DDR5','Processador CPU','SSD NVMe']) {
      const rows=(await db.query('SELECT * FROM classify_catalog_sectors($1,NULL)',[title])).rows;
      assert.ok(rows.some(row=>row.sector_slug==='eletronicos'));
      assert.ok(rows.every(row=>row.sector_slug!=='pc-gamer'));
    }
  } finally { await db.close(); }
});

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
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261004133000_supported_import_platforms.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261004135000_idempotent_offer_import.sql'), 'utf8'));
    await db.exec('ALTER TABLE offers ADD COLUMN id uuid DEFAULT gen_random_uuid()');
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261004135500_restore_offer_cursor_grant.sql'), 'utf8'));
    assert.equal((await db.query("SELECT has_column_privilege('anon','offers','id','SELECT') AS allowed")).rows[0].allowed,true);
    assert.equal((await db.query("SELECT has_column_privilege('anon','offers','seller_id','SELECT') AS allowed")).rows[0].allowed,false);
    for (const platform of ['kabum', 'amazon', 'shopee']) {
      const item=JSON.stringify({ platform, external_id:`test-${platform}`, title:'Produto real de teste', price:10, observed_at:'2026-10-04T10:00:00Z', images:[], videos:[], stock_status:'unknown', link_status:'broken', original_url:'https://example.test', affiliate_url:'', status:'draft' });
      const result = await db.query('SELECT public.import_catalog_item($1::jsonb) AS id', [item]);
      assert.ok(result.rows[0].id, `${platform} supported by import RPC`);
      await db.query('SELECT public.import_catalog_item($1::jsonb)',[item]);
      assert.equal((await db.query('SELECT count(*)::int AS count FROM offers WHERE product_id=$1',[result.rows[0].id])).rows[0].count,1,'retry does not duplicate the same observation');
    }
    await db.query("INSERT INTO public.products(id, platform, external_id, title, rating, reviews_count, specifications) VALUES (gen_random_uuid(), 'magalu', 'SKU-1', 'Product', 4.75, 12, '[{\"name\":\"Potência\",\"value\":\"1500 W\"}]'::jsonb)");
    const { rows } = await db.query("SELECT rating, reviews_count, specifications FROM public.products WHERE external_id = 'SKU-1'");
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
