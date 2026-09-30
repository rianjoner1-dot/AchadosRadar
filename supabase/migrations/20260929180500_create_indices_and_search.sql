-- supabase/migrations/20260929180500_create_indices_and_search.sql
-- Passo D6: Criar índices de filtro, cursor e busca normalizada/trigrama

-- Habilitação segura de extensões para busca textual
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 1. Índices para Vitrine, Filtros de Marketplace e Paginação Estável por Cursor
-- Permite queries como: WHERE platform = 'mercadolivre' AND status = 'published' ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_products_platform_status_created_id
    ON public.products (platform, status, created_at DESC, id DESC);

-- Permite queries de vitrine geral: WHERE status = 'published' ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_products_status_created_id
    ON public.products (status, created_at DESC, id DESC);

-- 2. Índice GIN com pg_trgm para Busca por Título de Alta Performance
-- Suporta buscas como: WHERE title ILIKE '%air fryer%' ou busca por similaridade trigram
CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON public.products USING gin (title gin_trgm_ops);

-- 3. Índices de Relacionamentos e Consultas Mais Recentes
-- Busca ultra-rápida da oferta mais recente de um produto
CREATE INDEX IF NOT EXISTS idx_offers_product_observed
    ON public.offers (product_id, observed_at DESC);

-- Carregamento ordenado da galeria de fotos de um produto
CREATE INDEX IF NOT EXISTS idx_product_images_product_order
    ON public.product_images (product_id, display_order ASC);

-- Carregamento da lista de interesses do usuário em ordem cronológica
CREATE INDEX IF NOT EXISTS idx_cart_items_user_created
    ON public.cart_items (user_id, created_at DESC);

-- Consulta de links ativos e verificação de saúde dos links
CREATE INDEX IF NOT EXISTS idx_affiliate_links_status_verified
    ON public.affiliate_links (status, verified_at DESC);

-- 4. Função auxiliar de busca normalizada para o catálogo
CREATE OR REPLACE FUNCTION public.search_products(
    search_query TEXT,
    target_platform TEXT DEFAULT NULL,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    platform TEXT,
    external_id TEXT,
    title TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.platform,
        p.external_id,
        p.title,
        similarity(p.title, search_query) AS similarity
    FROM public.products p
    WHERE
        p.status = 'published'
        AND (target_platform IS NULL OR p.platform = target_platform)
        AND (
            p.title ILIKE '%' || search_query || '%'
            OR similarity(p.title, search_query) > 0.2
        )
    ORDER BY similarity DESC, p.created_at DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
