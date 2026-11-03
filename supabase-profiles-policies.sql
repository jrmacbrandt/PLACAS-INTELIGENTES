-- Politicas da tabela profiles (somente usuarios logados via Supabase Auth)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS faixas_preco_individual JSONB DEFAULT NULL;

DROP POLICY IF EXISTS "Permitir acesso total profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_all" ON public.profiles;
CREATE POLICY "profiles_authenticated_all" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
