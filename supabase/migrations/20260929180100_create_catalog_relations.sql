-- supabase/migrations/20260929180100_create_catalog_relations.sql
-- Passo D2: Criar product_images, offers e affiliate_links com timestamps e estados explícitos

-- 1. Tabela de Imagens do Produto (Zero binários no banco - apenas URLs leves e metadados)
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Invariante D2: Foto mantém ordem e unicidade sequencial por produto
    CONSTRAINT uq_product_images_order UNIQUE (product_id, display_order)
);

COMMENT ON TABLE public.product_images IS 'Galeria de imagens dos produtos. Apenas URLs remotas otimizadas; zero binários no Postgres.';

-- 2. Tabela de Ofertas Comerciais Observadas
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    price NUMERIC(12,2) NOT NULL CHECK (price > 0),
    old_price NUMERIC(12,2) CHECK (old_price IS NULL OR old_price > 0),
    discount_percent INTEGER CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
    installments_text TEXT,
    shipping_text TEXT,
    coupon_code TEXT,
    -- Invariante D2: Estoque desconhecido vira NULL explicitamente (sem inventar números)
    stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
    stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'out_of_stock', 'unknown')),
    -- Invariante do Usuário: Preservação estrita de Vendedor e Loja
    seller_name TEXT NOT NULL DEFAULT 'Loja Parceira',
    seller_id TEXT NOT NULL DEFAULT '',
    store_name TEXT NOT NULL,
    store_affiliate_id TEXT NOT NULL DEFAULT '',
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offers IS 'Condições comerciais e estoque observados no marketplace com preservação de vendedor e loja.';

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Tabela de Links Oficiais de Afiliado
CREATE TABLE IF NOT EXISTS public.affiliate_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    affiliate_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'broken')),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Invariante D2: Expiração factual pode ser NULL caso o programa não tenha prazo fixo
    expires_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_affiliate_links_product UNIQUE (product_id)
);

COMMENT ON TABLE public.affiliate_links IS 'Links de afiliado conferidos por onde o usuário é encaminhado para finalizar a compra no marketplace.';

DROP TRIGGER IF EXISTS trg_affiliate_links_updated_at ON public.affiliate_links;
CREATE TRIGGER trg_affiliate_links_updated_at
    BEFORE UPDATE ON public.affiliate_links
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
