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

-- Criação do schema storage e tabelas auxiliares caso não existam (compatibilidade para ambientes de teste locais)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
        CREATE SCHEMA storage;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        CREATE TABLE storage.buckets (
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
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        CREATE TABLE storage.objects (
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
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'storage' AND pg_proc.proname = 'foldername') THEN
        CREATE FUNCTION storage.foldername(name TEXT)
        RETURNS TEXT[] AS $func$
        BEGIN
            RETURN string_to_array(name, '/');
        END;
        $func$ LANGUAGE plpgsql IMMUTABLE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'storage' AND pg_proc.proname = 'extension') THEN
        CREATE FUNCTION storage.extension(name TEXT)
        RETURNS TEXT AS $func$
        BEGIN
            RETURN split_part(name, '.', -1);
        END;
        $func$ LANGUAGE plpgsql IMMUTABLE;
    END IF;
END $$;

-- 1. Inserção / Configuração do Bucket avatars com limite rígido de 2 MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,                                -- Leitura pública para exibição de avatares na interface
    2097152,                              -- Limite rígido: 2 MB (2.097.152 bytes)
    ARRAY['image/webp', 'image/jpeg', 'image/png'] -- Apenas formatos raster otimizados; SVG estritamente proibido
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Habilitação de RLS em storage.objects e grants defensivos
DO $$
BEGIN
    BEGIN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
        GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
        GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 3. Políticas de Acesso ao Storage de Avatares

-- Leitura pública para quem acessa avatares do bucket
DROP POLICY IF EXISTS "public_reads_avatars" ON storage.objects;
CREATE POLICY "public_reads_avatars"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'avatars');

-- Usuário autenticado só envia avatar para a sua própria pasta: avatars/{auth_uid}/...
-- com validação estrita de pasta, tamanho (<= 2 MB) e formato permitido
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
            (metadata->>'size')::bigint <= 2097152
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
            (metadata->>'size')::bigint <= 2097152
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
