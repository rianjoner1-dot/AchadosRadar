-- Cria roles padrão do Supabase se não existirem (essencial para ambientes locais e CI)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END $$;

-- Cria schema e funções auxiliares auth se não existirem (compatibilidade Supabase e testes locais)
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE sql STABLE;

-- Função auxiliar segura para verificar se o usuário é importador ou admin
CREATE OR REPLACE FUNCTION public.is_importer_or_admin() RETURNS BOOLEAN AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('importer', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. Habilitação de RLS em todas as tabelas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images FORCE ROW LEVEL SECURITY;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items FORCE ROW LEVEL SECURITY;

-- 2. Grants de Privilégios (necessários para que o PostgreSQL avalie o RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Permissões para visitantes anônimos (apenas SELECT no catálogo)
GRANT SELECT ON public.products, public.product_images, public.offers, public.affiliate_links TO anon;

-- Permissões para usuários autenticados (RLS aplica WITH CHECK e USING específicos)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.product_images, public.offers, public.affiliate_links TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;

-- Permissões completas para service_role (backend confiável)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Políticas de Segurança (Row Level Security)

-- TABELA: products
-- Anônimo e autenticado só leem produtos publicados
DROP POLICY IF EXISTS "public_reads_published_products" ON public.products;
CREATE POLICY "public_reads_published_products"
    ON public.products FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

-- Importadores e admins podem gerenciar o catálogo
DROP POLICY IF EXISTS "importers_manage_products" ON public.products;
CREATE POLICY "importers_manage_products"
    ON public.products FOR ALL
    TO authenticated
    USING (public.is_importer_or_admin())
    WITH CHECK (public.is_importer_or_admin());

-- TABELA: product_images
-- Leitura pública de fotos de produtos publicados
DROP POLICY IF EXISTS "public_reads_published_images" ON public.product_images;
CREATE POLICY "public_reads_published_images"
    ON public.product_images FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_id AND p.status = 'published'
        )
    );

DROP POLICY IF EXISTS "importers_manage_images" ON public.product_images;
CREATE POLICY "importers_manage_images"
    ON public.product_images FOR ALL
    TO authenticated
    USING (public.is_importer_or_admin())
    WITH CHECK (public.is_importer_or_admin());

-- TABELA: offers
-- Leitura pública de ofertas de produtos publicados
DROP POLICY IF EXISTS "public_reads_published_offers" ON public.offers;
CREATE POLICY "public_reads_published_offers"
    ON public.offers FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_id AND p.status = 'published'
        )
    );

DROP POLICY IF EXISTS "importers_manage_offers" ON public.offers;
CREATE POLICY "importers_manage_offers"
    ON public.offers FOR ALL
    TO authenticated
    USING (public.is_importer_or_admin())
    WITH CHECK (public.is_importer_or_admin());

-- TABELA: affiliate_links
-- Leitura pública de links ativos de produtos publicados
DROP POLICY IF EXISTS "public_reads_active_links" ON public.affiliate_links;
CREATE POLICY "public_reads_active_links"
    ON public.affiliate_links FOR SELECT
    TO anon, authenticated
    USING (
        status = 'active' AND
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_id AND p.status = 'published'
        )
    );

DROP POLICY IF EXISTS "importers_manage_links" ON public.affiliate_links;
CREATE POLICY "importers_manage_links"
    ON public.affiliate_links FOR ALL
    TO authenticated
    USING (public.is_importer_or_admin())
    WITH CHECK (public.is_importer_or_admin());

-- Função trigger para impedir escalonamento de privilégios (usuário comum não pode alterar sua própria role)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_importer_or_admin() THEN
        RAISE EXCEPTION 'Não é permitido alterar seu próprio nível de permissão (role).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

-- TABELA: profiles
-- Usuário só lê seu próprio perfil (Usuário A não lê perfil de B)
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Usuário só atualiza seu próprio perfil (Usuário A não altera perfil de B)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- TABELA: cart_items (Minha Lista)
-- Usuário só lê seus próprios itens salvos (Usuário A não lê carrinho de B)
DROP POLICY IF EXISTS "users_read_own_cart" ON public.cart_items;
CREATE POLICY "users_read_own_cart"
    ON public.cart_items FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Usuário só insere itens para si mesmo
DROP POLICY IF EXISTS "users_insert_own_cart" ON public.cart_items;
CREATE POLICY "users_insert_own_cart"
    ON public.cart_items FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Usuário só atualiza seus próprios itens salvos
DROP POLICY IF EXISTS "users_update_own_cart" ON public.cart_items;
CREATE POLICY "users_update_own_cart"
    ON public.cart_items FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Usuário só deleta seus próprios itens salvos
DROP POLICY IF EXISTS "users_delete_own_cart" ON public.cart_items;
CREATE POLICY "users_delete_own_cart"
    ON public.cart_items FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
