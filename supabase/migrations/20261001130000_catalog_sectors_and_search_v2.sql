-- Separate stable product sectors from free-text queries. Product source
-- categories are preserved; sector assignments are derived and refresh when
-- the importer changes a product title or marketplace category.

CREATE TABLE IF NOT EXISTS public.catalog_sectors (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

INSERT INTO public.catalog_sectors (slug, label) VALUES
  ('eletronicos', 'Eletrônicos'),
  ('moda', 'Moda'),
  ('moveis', 'Móveis'),
  ('pc-gamer', 'PC Gamer'),
  ('eletro', 'Eletro'),
  ('jardim', 'Jardim'),
  ('bebes', 'Bebês'),
  ('beleza', 'Beleza'),
  ('pet', 'Pet'),
  ('casa', 'Casa')
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label;

CREATE TABLE IF NOT EXISTS public.product_sectors (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sector_slug TEXT NOT NULL REFERENCES public.catalog_sectors(slug) ON DELETE CASCADE,
  assignment_source TEXT NOT NULL CHECK (assignment_source IN ('category', 'title', 'manual')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, sector_slug)
);

CREATE INDEX IF NOT EXISTS idx_product_sectors_slug_product
  ON public.product_sectors (sector_slug, product_id);

ALTER TABLE public.catalog_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_sectors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sectors FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.catalog_sectors, public.product_sectors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_sectors TO authenticated;
GRANT ALL ON public.catalog_sectors, public.product_sectors TO service_role;
-- The opaque offer UUID is used only as a stable tie-break for equally timed
-- observations; no seller, account, or affiliate identifier is exposed here.
GRANT SELECT (id) ON public.offers TO anon, authenticated;

CREATE POLICY "public_reads_catalog_sectors"
  ON public.catalog_sectors FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_reads_published_product_sectors"
  ON public.product_sectors FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id AND p.status = 'published'
  ));

CREATE POLICY "importers_manage_product_sectors"
  ON public.product_sectors FOR ALL TO authenticated
  USING (public.is_importer_or_admin())
  WITH CHECK (public.is_importer_or_admin());

CREATE OR REPLACE FUNCTION public.classify_catalog_sectors(p_title TEXT, p_category TEXT)
RETURNS TABLE (sector_slug TEXT, assignment_source TEXT)
LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER
SET search_path = public
AS $$
  WITH input AS (
    SELECT public.normalize_catalog_text(p_title) AS title_text,
           public.normalize_catalog_text(p_category) AS category_text
  ), rules(sector_slug, pattern) AS (VALUES
    ('eletronicos', '\m(eletron|smartphone|celular|fone|bluetooth|televis|notebook|laptop|computador|tablet|monitor|teclado|mouse|camera|impressora|roteador|webcam|headset|hardware|placa de video|gpu|caixa de som)\M'),
    ('moda', '\m(roupa|vestido|blusa|camisa|camiseta|calca|shorts|short|saia|moda|bolsa|tenis|sapato|sandalia|jaqueta|blazer|lingerie|meia)\M'),
    ('moveis', '\m(moveis|sofa|rack|cama|mesa|guarda roupa|estante|cadeira|escrivaninha|armario|poltrona)\M'),
    ('pc-gamer', '\m(gamer|gaming|pc gamer|placa de video|gpu|gabinete gamer|teclado gamer|mouse gamer)\M'),
    ('eletro', '\m(eletrodomestico|eletroportatil|air fryer|airfryer|fritadeira|geladeira|fogao|microondas|liquidificador|cafeteira|batedeira|sanduicheira|mixer|ventilador|ar condicionado|lava louca|lavadora|maquina de lavar|ferro de passar)\M'),
    ('jardim', '\m(jardim|jardinagem|planta|vaso|mangueira|piscina|churrasqueira|ferramenta de jardim|gramado)\M'),
    ('bebes', '\m(bebe|bebes|infantil|carrinho de bebe|cadeirinha|berco|fralda|mamadeira|chupeta|banheira infantil)\M'),
    ('beleza', '\m(beleza|perfume|secador|chapinha|skincare|maquiagem|hidratante|cosmetico|shampoo|modelador de cabelo)\M'),
    ('pet', '\m(pet|racao|gato|cachorro|arranhador|tapete higienico|coleira|brinquedo pet|areia sanitaria)\M'),
    ('casa', '\m(casa|cozinha|limpeza|organizador|aspirador|decoracao|utensilio|panela|toalha|travesseiro|tapete|roupa de cama|lampada|utilidades domesticas)\M')
  )
  SELECT r.sector_slug,
         CASE WHEN i.category_text ~ r.pattern THEN 'category' ELSE 'title' END
  FROM rules r CROSS JOIN input i
  WHERE i.category_text ~ r.pattern OR i.title_text ~ r.pattern;
$$;

CREATE OR REPLACE FUNCTION public.refresh_product_sector_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.product_sectors
  WHERE product_id = NEW.id AND assignment_source <> 'manual';

  INSERT INTO public.product_sectors (product_id, sector_slug, assignment_source)
  SELECT NEW.id, classification.sector_slug, classification.assignment_source
  FROM public.classify_catalog_sectors(NEW.title, NEW.category) AS classification
  ON CONFLICT (product_id, sector_slug) DO UPDATE
    SET assignment_source = EXCLUDED.assignment_source,
        assigned_at = now()
    WHERE public.product_sectors.assignment_source <> 'manual';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_refresh_sectors ON public.products;
CREATE TRIGGER trg_products_refresh_sectors
  AFTER INSERT OR UPDATE OF title, category ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.refresh_product_sector_assignments();

-- Backfill without touching product update timestamps or triggering importer-side effects.
INSERT INTO public.product_sectors (product_id, sector_slug, assignment_source)
SELECT p.id, classification.sector_slug, classification.assignment_source
FROM public.products p
CROSS JOIN LATERAL public.classify_catalog_sectors(p.title, p.category) AS classification
ON CONFLICT (product_id, sector_slug) DO UPDATE
  SET assignment_source = EXCLUDED.assignment_source,
      assigned_at = now()
  WHERE public.product_sectors.assignment_source <> 'manual';

CREATE OR REPLACE FUNCTION public.search_catalog_v2(
  search_query TEXT DEFAULT '',
  target_platform TEXT DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL,
  sort_by TEXT DEFAULT 'recent',
  cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  cursor_id UUID DEFAULT NULL,
  cursor_price NUMERIC DEFAULT NULL,
  page_size INTEGER DEFAULT 20,
  cursor_score REAL DEFAULT NULL,
  target_sector TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, platform TEXT, external_id TEXT, title TEXT, description TEXT,
  category TEXT, created_at TIMESTAMPTZ, images JSONB, offer JSONB,
  affiliate_link JSONB, sectors JSONB, search_score REAL
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH query AS (
    SELECT public.normalize_catalog_text(search_query) AS normalized,
      regexp_replace(public.normalize_catalog_text(search_query), ' ', '', 'g') AS compact,
      ARRAY(
        SELECT token FROM regexp_split_to_table(public.normalize_catalog_text(search_query), ' ') token
        WHERE length(token) > 2
      ) AS terms,
      ARRAY(
        SELECT token FROM regexp_split_to_table(public.normalize_catalog_text(search_query), ' ') token
        WHERE length(token) BETWEEN 1 AND 2
      ) AS short_terms
  ), latest_offers AS (
    SELECT DISTINCT ON (o.product_id)
      o.id, o.product_id, o.price, o.old_price, o.discount_percent,
      o.installments_text, o.shipping_text, o.coupon_code, o.stock_quantity,
      o.stock_status, o.seller_name, o.store_name, o.observed_at
    FROM public.offers o
    ORDER BY o.product_id, o.observed_at DESC, o.id DESC
  ), products AS (
    SELECT p.id, p.platform, p.external_id, p.title, p.description, p.category, p.created_at,
      offer.price AS current_price,
      CASE
        WHEN q.compact = '' THEN 1::REAL
        WHEN cardinality(q.terms) = 0 AND matches.short_terms_match THEN 0.90::REAL
        WHEN matches.compound_alias_match THEN 0.98::REAL
        WHEN matches.title_exact THEN 0.98::REAL
        WHEN matches.combined_exact AND NOT matches.category_all THEN 0.90::REAL
        WHEN matches.category_exact THEN 0.75::REAL
        WHEN matches.title_all THEN (0.65 + matches.title_score / 3 * 0.2)::REAL
        WHEN matches.combined_all THEN (0.55 + matches.combined_score / 3 * 0.15)::REAL
        WHEN matches.category_all THEN (0.35 + matches.category_score / 3 * 0.15)::REAL
        ELSE 0::REAL
      END AS score,
      offer.price, offer.old_price, offer.discount_percent, offer.installments_text,
      offer.shipping_text, offer.coupon_code, offer.stock_quantity, offer.stock_status,
      offer.seller_name, offer.store_name, offer.observed_at,
      q.compact AS compact_query
    FROM public.products p
    CROSS JOIN query q
    LEFT JOIN latest_offers offer ON offer.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT
        bool_and(best.title_rank = 3) AS title_exact,
        bool_and(best.title_rank > 0) AS title_all,
        avg(best.title_rank)::REAL AS title_score,
        bool_and(GREATEST(best.title_rank, best.category_rank) = 3) AS combined_exact,
        bool_and(GREATEST(best.title_rank, best.category_rank) > 0) AS combined_all,
        avg(GREATEST(best.title_rank, best.category_rank))::REAL AS combined_score,
        bool_and(best.category_rank = 3) AS category_exact,
        bool_and(best.category_rank > 0) AS category_all,
        avg(best.category_rank)::REAL AS category_score,
        COALESCE((
          SELECT bool_and(
            EXISTS (
              SELECT 1 FROM regexp_split_to_table(public.normalize_catalog_text(p.title), ' ') AS title_word
              WHERE title_word = short_term.token
            ) OR EXISTS (
              SELECT 1 FROM regexp_split_to_table(public.normalize_catalog_text(p.category), ' ') AS category_word
              WHERE category_word = short_term.token
            )
          )
          FROM unnest(q.short_terms) AS short_term(token)
        ), true) AS short_terms_match
        , (q.normalized IN ('air fryer', 'airfryer', 'fritadeira') AND (
          regexp_replace(public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, '')), ' ', '', 'g') LIKE '%airfryer%'
          OR EXISTS (
            SELECT 1 FROM regexp_split_to_table(public.normalize_catalog_text(p.title || ' ' || COALESCE(p.category, '')), ' ') AS compound_word
            WHERE compound_word = 'fritadeira'
          )
        )) AS compound_alias_match
      FROM unnest(q.terms) AS term
      CROSS JOIN LATERAL (
        SELECT CASE term
          WHEN 'celular' THEN ARRAY['celular', 'smartphone']
          WHEN 'smartphone' THEN ARRAY['smartphone', 'celular']
          WHEN 'fone' THEN ARRAY['fone', 'headphone', 'headset', 'earbud']
          WHEN 'headphone' THEN ARRAY['headphone', 'headphones', 'fone', 'headset', 'earbud']
          WHEN 'headphones' THEN ARRAY['headphones', 'headphone', 'fone', 'headset', 'earbud']
          WHEN 'headset' THEN ARRAY['headset', 'headphone', 'fone', 'earbud']
          WHEN 'geladeira' THEN ARRAY['geladeira', 'refrigerador']
          WHEN 'refrigerador' THEN ARRAY['refrigerador', 'geladeira']
          WHEN 'airfryer' THEN ARRAY['airfryer', 'fritadeira']
          WHEN 'fritadeira' THEN ARRAY['fritadeira', 'airfryer']
          ELSE ARRAY[term]
        END AS variants
      ) AS aliases
      CROSS JOIN LATERAL (
        SELECT
          COALESCE((SELECT max(CASE
          WHEN word = variant THEN 3
          WHEN word LIKE variant || '%' THEN 2
          WHEN variant = term AND length(term) >= 5 AND word_similarity(term, word) >= 0.4 THEN 1
          ELSE 0
          END)
          FROM unnest(aliases.variants) AS variant
          CROSS JOIN regexp_split_to_table(public.normalize_catalog_text(p.title), ' ') AS word), 0) AS title_rank,
          COALESCE((SELECT max(CASE
          WHEN word = variant THEN 3
          WHEN word LIKE variant || '%' THEN 2
          WHEN variant = term AND length(term) >= 5 AND word_similarity(term, word) >= 0.4 THEN 1
          ELSE 0
          END)
          FROM unnest(aliases.variants) AS variant
          CROSS JOIN regexp_split_to_table(public.normalize_catalog_text(p.category), ' ') AS word), 0) AS category_rank
      ) AS best
    ) AS matches ON true
    WHERE p.status = 'published'
      AND (target_platform IS NULL OR p.platform = target_platform)
      AND (target_sector IS NULL OR EXISTS (
        SELECT 1 FROM public.product_sectors ps
        WHERE ps.product_id = p.id AND ps.sector_slug = target_sector
      ))
      AND (min_price IS NULL OR offer.price >= min_price)
      AND (max_price IS NULL OR offer.price <= max_price)
      AND (q.compact = '' OR
        matches.compound_alias_match OR
        ((cardinality(q.terms) = 0 OR matches.combined_all) AND matches.short_terms_match)
      )
  ), rows_with_sectors AS (
    SELECT p.*,
      COALESCE((
        SELECT jsonb_agg(ps.sector_slug ORDER BY ps.sector_slug)
        FROM public.product_sectors ps
        WHERE ps.product_id = p.id
      ), '[]'::JSONB) AS sector_slugs
    FROM products p
  ), paged AS (
    SELECT r.*
    FROM rows_with_sectors r
    WHERE cursor_created_at IS NULL OR CASE
      WHEN sort_by = 'price_asc' THEN
        (cursor_price IS NOT NULL AND r.current_price IS NULL)
        OR (cursor_price IS NOT NULL AND r.current_price > cursor_price)
        OR (r.current_price IS NOT DISTINCT FROM cursor_price AND
            (r.score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id))
      WHEN sort_by = 'price_desc' THEN
        (cursor_price IS NOT NULL AND r.current_price IS NULL)
        OR (cursor_price IS NOT NULL AND r.current_price < cursor_price)
        OR (r.current_price IS NOT DISTINCT FROM cursor_price AND
            (r.score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id))
      ELSE (r.score, r.created_at, r.id) < (COALESCE(cursor_score, 1), cursor_created_at, cursor_id)
    END
    ORDER BY
      CASE WHEN sort_by = 'price_asc' THEN r.current_price END ASC NULLS LAST,
      CASE WHEN sort_by = 'price_desc' THEN r.current_price END DESC NULLS LAST,
      r.score DESC, r.created_at DESC, r.id DESC
    LIMIT LEAST(GREATEST(page_size, 1), 20)
  )
  SELECT r.id, r.platform, r.external_id, r.title, r.description, r.category, r.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('url', i.url, 'display_order', i.display_order) ORDER BY i.display_order)
      FROM (SELECT url, display_order FROM public.product_images WHERE product_id = r.id ORDER BY display_order LIMIT 1) i
    ), '[]'::JSONB) AS images,
    CASE WHEN r.id IS NULL OR r.current_price IS NULL THEN NULL ELSE jsonb_build_object(
      'price', r.price, 'old_price', r.old_price, 'discount_percent', r.discount_percent,
      'installments_text', r.installments_text, 'shipping_text', r.shipping_text,
      'coupon_code', r.coupon_code, 'stock_quantity', r.stock_quantity, 'stock_status', r.stock_status,
      'seller_name', r.seller_name, 'store_name', r.store_name, 'observed_at', r.observed_at
    ) END AS offer,
    (SELECT jsonb_build_object('status', a.status, 'verified_at', a.verified_at,
      'expires_at', a.expires_at, 'refresh_due_at', a.refresh_due_at)
      FROM public.affiliate_links a
      WHERE a.product_id = r.id AND a.status = 'active'
      ORDER BY a.verified_at DESC, a.id DESC LIMIT 1) AS affiliate_link,
    r.sector_slugs AS sectors,
    r.score AS search_score
  FROM paged r;
$$;

REVOKE ALL ON FUNCTION public.classify_catalog_sectors(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classify_catalog_sectors(TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_catalog_v2(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID, NUMERIC, INTEGER, REAL, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog_v2(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TIMESTAMPTZ, UUID, NUMERIC, INTEGER, REAL, TEXT) TO anon, authenticated;
