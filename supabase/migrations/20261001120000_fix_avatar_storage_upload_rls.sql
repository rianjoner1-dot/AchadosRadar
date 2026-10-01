-- The avatars bucket already enforces MIME and size restrictions.
-- Keep object RLS focused on ownership and explicitly allow the owner to
-- read the metadata returned by Storage after an upload/upsert.
DROP POLICY IF EXISTS "users_insert_own_avatar" ON storage.objects;
CREATE POLICY "users_insert_own_avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_select_own_avatar" ON storage.objects;
CREATE POLICY "users_select_own_avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
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
);
