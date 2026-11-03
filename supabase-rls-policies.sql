-- =============================================================================
-- POLÍTICAS DE ACESSO (RLS) — ATELIER DAS PLACAS (SUPABASE)
-- Execute este script no SQL Editor do Supabase para liberar o acesso das tabelas
-- para o frontend na Vercel.
-- =============================================================================

DO $$
BEGIN
  -- 1. profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir acesso total profiles') THEN
    CREATE POLICY "Permitir acesso total profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 2. pricing_tiers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_tiers' AND policyname = 'Permitir acesso total pricing_tiers') THEN
    CREATE POLICY "Permitir acesso total pricing_tiers" ON public.pricing_tiers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 3. clients
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Permitir acesso total clients') THEN
    CREATE POLICY "Permitir acesso total clients" ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 4. orders
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Permitir acesso total orders') THEN
    CREATE POLICY "Permitir acesso total orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 5. order_logistics
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_logistics' AND policyname = 'Permitir acesso total order_logistics') THEN
    CREATE POLICY "Permitir acesso total order_logistics" ON public.order_logistics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 6. manufacturing_orders
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manufacturing_orders' AND policyname = 'Permitir acesso total manufacturing_orders') THEN
    CREATE POLICY "Permitir acesso total manufacturing_orders" ON public.manufacturing_orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 7. plates
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plates' AND policyname = 'Permitir acesso total plates') THEN
    CREATE POLICY "Permitir acesso total plates" ON public.plates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 8. inspections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inspections' AND policyname = 'Permitir acesso total inspections') THEN
    CREATE POLICY "Permitir acesso total inspections" ON public.inspections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 9. destination_history
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_history' AND policyname = 'Permitir acesso total destination_history') THEN
    CREATE POLICY "Permitir acesso total destination_history" ON public.destination_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 10. payments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Permitir acesso total payments') THEN
    CREATE POLICY "Permitir acesso total payments" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 11. webhook_events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'webhook_events' AND policyname = 'Permitir acesso total webhook_events') THEN
    CREATE POLICY "Permitir acesso total webhook_events" ON public.webhook_events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  -- 12. audit_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Permitir acesso total audit_logs') THEN
    CREATE POLICY "Permitir acesso total audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

