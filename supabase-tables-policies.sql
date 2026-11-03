-- Leitura/escrita das tabelas do sistema para usuarios LOGADOS (Supabase Auth)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','pricing_tiers','clients','orders','order_logistics','manufacturing_orders','plates','inspections','destination_history','webhook_events','audit_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir acesso total %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- Faixas de preco continuam legiveis sem login (tela de compra)
DROP POLICY IF EXISTS "pricing_tiers_public_read" ON public.pricing_tiers;
CREATE POLICY "pricing_tiers_public_read" ON public.pricing_tiers FOR SELECT TO anon USING (true);

NOTIFY pgrst, 'reload schema';
