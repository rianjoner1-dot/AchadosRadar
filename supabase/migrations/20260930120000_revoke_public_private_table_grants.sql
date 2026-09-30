-- RLS remains mandatory, but anonymous roles must not receive table-level access
-- to profiles or saved carts, even if a policy is later changed accidentally.
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.cart_items FROM anon, PUBLIC;

-- New public-schema tables require explicit grants in their own migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, PUBLIC;
