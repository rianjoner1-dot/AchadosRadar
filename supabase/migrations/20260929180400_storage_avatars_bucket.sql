-- Criação de roles se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

-- Criação do schema storage caso não exista (compatibilidade para ambientes de teste)
CREATE SCHEMA IF NOT EXISTS storage;

-- Tabela de buckets do Supabase Storage
CREATE TABLE IF NOT EXISTS storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    public BOOLEAN DEFAULT false,
    avif_autodetection BOOLEAN DEFAULT false,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);

-- Tabela de objetos do Supabase Storage
CREATE TABLE IF NOT EXISTS storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT REFERENCES storage.buckets(id),
    name TEXT NOT NULL,
    owner UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
);

-- Funções auxiliares de caminho do storage (padrão Supabase)
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] AS $$
BEGIN
    RETURN string_to_array(name, '/');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage.extension(name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN split_part(name, '.', -1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Inserção / Configuração do Bucket avatars com limite rígido de 100 KB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,                                -- Leitura pública para exibição de avatares na interface
    102400,                              -- Limite rígido: 100 KB (102.400 bytes)
    ARRAY['image/webp', 'image/jpeg', 'image/png'] -- Apenas formatos raster otimizados; SVG estritamente proibido
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Habilitação de RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Grants para que o RLS avalie as políticas dos papéis
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;

-- 3. Políticas de Acesso ao Storage de Avatares

-- Leitura pública para quem acessa avatares do bucket
DROP POLICY IF EXISTS "public_reads_avatars" ON storage.objects;
CREATE POLICY "public_reads_avatars"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'avatars');

-- Usuário autenticado só envia avatar para a sua própria pasta: avatars/{auth_uid}/...
-- com validação estrita de pasta, tamanho (< 100 KB) e formato permitido
DROP POLICY IF EXISTS "users_insert_own_avatar" ON storage.objects;
CREATE POLICY "users_insert_own_avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND (
            metadata->>'mimetype' = ANY(ARRAY['image/webp', 'image/jpeg', 'image/png'])
        )
        AND (
            (metadata->>'size')::bigint <= 102400
        )
    );

-- Usuário só atualiza seu próprio avatar
DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects;
CREATE POLICY "users_update_own_avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND (
            metadata->>'mimetype' = ANY(ARRAY['image/webp', 'image/jpeg', 'image/png'])
        )
        AND (
            (metadata->>'size')::bigint <= 102400
        )
    );

-- Usuário só deleta seu próprio avatar
DROP POLICY IF EXISTS "users_delete_own_avatar" ON storage.objects;
CREATE POLICY "users_delete_own_avatar"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
