-- Criação da tabela de registro de buscas
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  target_sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Segurança (RLS)
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Permitir inserção pública (anon)
CREATE POLICY "Anon can insert search logs" ON public.search_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Leitura apenas para administradores/autenticados
CREATE POLICY "Auth users can read search logs" ON public.search_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Função segura (SECURITY DEFINER) para facilitar o log
CREATE OR REPLACE FUNCTION public.log_search_term(
  query TEXT,
  sector TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Não logar buscas vazias
  IF query IS NOT NULL AND trim(query) <> '' THEN
    INSERT INTO public.search_logs (search_query, target_sector)
    VALUES (trim(query), sector);
  END IF;
END;
$$;
