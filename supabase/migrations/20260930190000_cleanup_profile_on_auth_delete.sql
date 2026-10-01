CREATE OR REPLACE FUNCTION public.delete_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted_profile ON auth.users;
CREATE TRIGGER on_auth_user_deleted_profile
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.delete_profile_for_auth_user();
