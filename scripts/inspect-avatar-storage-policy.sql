-- Read-only diagnostic for the avatars Storage RLS policy in the linked dev project.
SELECT coalesce(json_agg(json_build_object(
  'policyname', policyname,
  'cmd', cmd,
  'roles', roles,
  'qual', qual,
  'with_check', with_check
) ORDER BY policyname), '[]'::json) AS storage_object_policies
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

SELECT
  has_table_privilege('authenticated', 'storage.objects', 'SELECT') AS authenticated_can_select_objects,
  has_table_privilege('authenticated', 'storage.objects', 'INSERT') AS authenticated_can_insert_objects,
  has_table_privilege('authenticated', 'storage.objects', 'UPDATE') AS authenticated_can_update_objects,
  has_table_privilege('authenticated', 'storage.objects', 'DELETE') AS authenticated_can_delete_objects;
