-- supabase/migrations/20260929180000_create_products.sql
-- Passo D1: Tabela products com UUID imutável e unicidade (platform, external_id)

-- Habilita extensão pgcrypto se disponível (Postgres 13+ já possui gen_random_uuid nativo)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Tabela principal de produtos do catálogo
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('mercadolivre', 'magalu')),
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    brand TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Invariante D1: Par (platform, external_id) deve ser estritamente único
    CONSTRAINT uq_products_platform_external_id UNIQUE (platform, external_id)
);

-- Comentários descritivos para documentação do schema
COMMENT ON TABLE public.products IS 'Produtos coletados e normalizados dos marketplaces parceiros com UUID imutável.';
COMMENT ON COLUMN public.products.id IS 'Identificador canônico imutável do produto no Achados Radar.';
COMMENT ON COLUMN public.products.platform IS 'Marketplace de origem (mercadolivre ou magalu).';
COMMENT ON COLUMN public.products.external_id IS 'Identificador do produto no marketplace (ex: MLB123456 ou sku Magalu).';
COMMENT ON COLUMN public.products.status IS 'Estado de moderação/publicação (apenas published é visível ao público).';

-- Função e gatilho para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
