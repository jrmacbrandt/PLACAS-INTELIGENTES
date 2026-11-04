import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

/**
 * POST /api/qrcodes
 * Gera imagens PNG em memória via QRCode.toBuffer(urlPermanente, { width: 400, margin: 2 }),
 * faz upload para o bucket público `qrcodes` no Supabase Storage (`QRCode_${codigo_sequencial}.png`),
 * salva `qrcode_url` na tabela `plates` (sem Base64 no banco) e retorna as URLs públicas.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const items: Array<{ id?: string; codigo_sequencial: string; url_permanente: string }> =
      Array.isArray(body.placas) ? body.placas : [];

    if (items.length === 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhuma placa informada para geração de QR Code.' });
    }

    const resultados: Array<{
      id?: string;
      codigo_sequencial: string;
      url_permanente: string;
      qrcode_url: string;
    }> = [];

    for (const item of items) {
      if (!item.codigo_sequencial || !item.url_permanente) continue;

      // 1. Gera a imagem do QR Code em memória em formato buffer PNG (400px, margin 2)
      const pngBuffer = await QRCode.toBuffer(item.url_permanente, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      const fileName = `QRCode_${item.codigo_sequencial}.png`;

      // 2. Faz o upload do buffer diretamente para o bucket `qrcodes` no Supabase Storage
      await supabase.storage.from('qrcodes').upload(fileName, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

      // 3. Obtém a URL pública permanente gerada pelo Supabase
      const { data: pubData } = supabase.storage.from('qrcodes').getPublicUrl(fileName);
      const publicUrl = pubData.publicUrl;

      // 4. Salva na tabela `plates` apenas o link do storage (coluna `qrcode_url`)
      try {
        if (item.id) {
          await supabase.from('plates').update({ qrcode_url: publicUrl }).eq('id', item.id);
        } else {
          await supabase
            .from('plates')
            .update({ qrcode_url: publicUrl })
            .eq('codigo_sequencial', item.codigo_sequencial);
        }
      } catch {
        // Ignora caso a coluna qrcode_url ainda não tenha sido criada via SQL
      }

      resultados.push({
        id: item.id,
        codigo_sequencial: item.codigo_sequencial,
        url_permanente: item.url_permanente,
        qrcode_url: publicUrl,
      });
    }

    return res.status(200).json({
      sucesso: true,
      resultados,
    });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err?.message || 'Erro ao gerar e armazenar QR Codes no Supabase Storage.',
    });
  }
}
