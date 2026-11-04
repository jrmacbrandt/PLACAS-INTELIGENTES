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

NOTIFY pgrst, 'reload schema';
