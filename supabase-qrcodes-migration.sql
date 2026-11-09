-- =============================================================================
-- MIGRAÇÃO: STORAGE DE QR CODES (BUCKET 'qrcodes') + REDIRECIONAMENTO VITALÍCIO
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- =============================================================================

-- 1. Adiciona a coluna qrcode_url na tabela plates (apenas URL do Storage, nunca Base64)
ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS qrcode_url TEXT DEFAULT NULL;

-- 2. Garante que o bucket público 'qrcodes' exista no Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('qrcodes', 'qrcodes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Políticas de Storage para o bucket 'qrcodes' (Leitura pública, Upload e Limpeza)
DROP POLICY IF EXISTS "qrcodes_public_read" ON storage.objects;
CREATE POLICY "qrcodes_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'qrcodes');

DROP POLICY IF EXISTS "qrcodes_authenticated_upload" ON storage.objects;
CREATE POLICY "qrcodes_authenticated_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'qrcodes');

DROP POLICY IF EXISTS "qrcodes_authenticated_update" ON storage.objects;
CREATE POLICY "qrcodes_authenticated_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'qrcodes')
WITH CHECK (bucket_id = 'qrcodes');

DROP POLICY IF EXISTS "qrcodes_authenticated_delete" ON storage.objects;
CREATE POLICY "qrcodes_authenticated_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'qrcodes');

-- 4. Garante leitura pública de plates por token_publico para o redirecionamento vitalício /r/:token
DROP POLICY IF EXISTS "plates_public_redirect_read" ON public.plates;
CREATE POLICY "plates_public_redirect_read"
ON public.plates FOR SELECT
TO anon, authenticated
USING (true);

-- 5. Preenche qrcode_url das placas já existentes que possuem PNG no bucket 'qrcodes'
UPDATE public.plates
SET qrcode_url = 'https://rsphrxkmeeudlqpotdzi.supabase.co/storage/v1/object/public/qrcodes/QRCode_' || codigo_sequencial || '.png'
WHERE qrcode_url IS NULL AND codigo_sequencial IS NOT NULL;

-- =============================================================================
-- 6. AGENDAMENTO AUTOMÁTICO 24/7 EM NUVEM (pg_cron + pg_net) PARA BACKUPS
-- Verifica a cada 5 minutos se chegou algum horário pré-definido no painel
-- e dispara o backup para o Supabase Storage + Google Drive mesmo com o PC desligado.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('atelier-scheduled-backup-check');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'atelier-scheduled-backup-check',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://placasinteligentes.vercel.app/api/cron/scheduled-backup?check_schedule=1',
    timeout_milliseconds := 25000
  );
  $$
);

NOTIFY pgrst, 'reload schema';

