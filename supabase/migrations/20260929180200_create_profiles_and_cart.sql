-- supabase/migrations/20260929180200_create_profiles_and_cart.sql
-- Passo D3: Criar profiles e cart_items com FK ON DELETE RESTRICT para produto

-- 1. Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'importer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfis de usuários, importadores e administradores da plataforma.';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tabela de Itens Salvos no Carrinho / Lista de Interesse do Usuário
-- IMPORTANTE: O carrinho é apenas lista de interesse; não há pagamentos nem checkout no site.
CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Invariante D3 Obrigatória: ON DELETE RESTRICT impede que produto favoritado seja apagado fisicamente
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    
    saved_price NUMERIC(12,2) CHECK (saved_price IS NULL OR saved_price > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Garante que o mesmo produto só possa estar salvo uma vez por usuário
    CONSTRAINT uq_cart_items_user_product UNIQUE (user_id, product_id)
);

COMMENT ON TABLE public.cart_items IS 'Lista de interesses salva por usuário cadastrado. Referência estável com ON DELETE RESTRICT.';
