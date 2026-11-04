import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/cleanup-qrcodes
 * Rotina de Limpeza Automática de 30 Dias (Expiração apenas dos arquivos PNG no Storage).
 * REGRA DE OURO: JAMAIS exclui linhas da tabela `plates` ou invalida tokens de redirecionamento.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  }

  // Validação do header Authorization: Bearer ${process.env.CRON_SECRET}
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Não autorizado: CRON_SECRET inválido ou ausente.',
      });
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Lista os arquivos do bucket `qrcodes` no Supabase Storage
    const { data: files, error: listError } = await supabase.storage
      .from('qrcodes')
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });

    if (listError) {
      return res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao listar arquivos do bucket qrcodes: ${listError.message}`,
      });
    }

    const cutoffTime = Date.now() - THIRTY_DAYS_MS;

    // 2. Filtra os arquivos cujo created_at seja superior a 30 dias
    const expiredFiles = (files || []).filter((file) => {
      if (!file.name || !file.name.endsWith('.png')) return false;
      if (!file.created_at) return false;
      const createdAtMs = new Date(file.created_at).getTime();
      return Number.isFinite(createdAtMs) && createdAtMs < cutoffTime;
    });

    if (expiredFiles.length === 0) {
      return res.status(200).json({
        sucesso: true,
        mensagem: 'Nenhum arquivo PNG com mais de 30 dias encontrado para limpeza.',
        arquivos_verificados: (files || []).length,
        arquivos_removidos: 0,
        placas_preservadas_vitaliciamente: true,
      });
    }

    const pathsToRemove = expiredFiles.map((f) => f.name);

    // 3. Exclui EXCLUSIVAMENTE os arquivos PNG do Storage
    const { error: removeError } = await supabase.storage.from('qrcodes').remove(pathsToRemove);
    if (removeError) {
      return res.status(500).json({
        sucesso: false,
        mensagem: `Erro ao remover arquivos expirados do Storage: ${removeError.message}`,
      });
    }

    // 4. Atualiza a coluna `qrcode_url` na tabela `plates` para NULL (NUNCA apaga linhas de plates!)
    const expiredCodes = pathsToRemove
      .map((name) => name.replace(/^QRCode_/, '').replace(/\.png$/i, ''))
      .filter(Boolean);

    if (expiredCodes.length > 0) {
      try {
        await supabase
          .from('plates')
          .update({ qrcode_url: null, updated_at: new Date().toISOString() })
          .in('codigo_sequencial', expiredCodes);
      } catch {
        // Ignora silenciosamente caso a coluna qrcode_url ainda não tenha sido criada
      }
    }

    return res.status(200).json({
      sucesso: true,
      mensagem: `${pathsToRemove.length} arquivos PNG com mais de 30 dias expurgados do Storage. Redirecionamento vitalício (/r/:token) intacto.`,
      arquivos_verificados: (files || []).length,
      arquivos_removidos: pathsToRemove.length,
      codigos_expurgados: expiredCodes,
      placas_preservadas_vitaliciamente: true,
    });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err?.message || 'Erro interno na rotina de limpeza de QR Codes.',
    });
  }
}
