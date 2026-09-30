-- supabase/migrations/20260930130000_expand_avatars_bucket_size.sql
-- Expande o limite de upload de avatars para 2 MB (2097152 bytes)
-- permitindo fotos de celular com mega compressão no cliente sem risco de rejeição.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    UPDATE storage.buckets
    SET file_size_limit = 2097152
    WHERE id = 'avatars';
  END IF;
END $$;

-- Atualiza as políticas de RLS em storage.objects para aceitar até 2 MB (2.097.152 bytes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
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
  END IF;
END $$;
