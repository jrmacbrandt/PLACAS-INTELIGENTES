import { getSupabaseClient } from './supabase.js';
import { generateLabeledQrPngBuffer } from '../../src/utils/qrLabeledPngNode.js';

export const DEFAULT_APP_URL = process.env.APP_URL || 'https://placasinteligentes.vercel.app';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Gera PNG em memória (400x456) contendo o QR Code e o número sequencial `PLK-XXXXXX`
 * na parte inferior da própria imagem, faz upload para o bucket público `qrcodes` no
 * Supabase Storage (`QRCode_${codigo_sequencial}.png`), salva `qrcode_url` na tabela `plates`
 * do Supabase (sem Base64) e retorna { qrcode_url, qrcode_data_url }.
 */
export async function generateAndUploadPlateQrCode(plate: {
  id?: string;
  codigo_sequencial: string;
  url_permanente: string;
}): Promise<{ qrcode_url: string | null; qrcode_data_url: string }> {
  const pngBuffer = generateLabeledQrPngBuffer(plate.url_permanente, plate.codigo_sequencial);

  const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { qrcode_url: null, qrcode_data_url: dataUrl };
  }

  const fileName = `QRCode_${plate.codigo_sequencial}.png`;
  let publicUrl: string | null = null;

  try {
    await supabase.storage.from('qrcodes').upload(fileName, pngBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
    const { data: pubData } = supabase.storage.from('qrcodes').getPublicUrl(fileName);
    publicUrl = pubData?.publicUrl || null;

    if (publicUrl) {
      try {
        if (plate.id) {
          await supabase.from('plates').update({ qrcode_url: publicUrl }).eq('id', plate.id);
        } else {
          await supabase
            .from('plates')
            .update({ qrcode_url: publicUrl })
            .eq('codigo_sequencial', plate.codigo_sequencial);
        }
      } catch {
        // Ignora caso a coluna qrcode_url ainda não exista
      }
    }
  } catch {
    // Fallback para DataURL local caso o Storage esteja offline
  }

  return {
    qrcode_url: publicUrl,
    qrcode_data_url: dataUrl,
  };
}

/**
 * Rotina de Limpeza Automática de 30 Dias (Expiração apenas dos arquivos PNG do bucket `qrcodes`).
 * REGRA DE OURO: JAMAIS exclui registros da tabela `plates` ou invalida tokens de redirecionamento.
 */
export async function cleanupExpiredQrCodesFromStorage() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      sucesso: false,
      mensagem: 'Cliente Supabase não configurado.',
      arquivos_removidos: 0,
    };
  }

  const { data: files, error: listError } = await supabase.storage
    .from('qrcodes')
    .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });

  if (listError) {
    throw new Error(`Erro ao listar bucket qrcodes: ${listError.message}`);
  }

  const cutoffTime = Date.now() - THIRTY_DAYS_MS;
  const expiredFiles = (files || []).filter((f) => {
    if (!f.name || !f.name.endsWith('.png') || !f.created_at) return false;
    const createdMs = new Date(f.created_at).getTime();
    return Number.isFinite(createdMs) && createdMs < cutoffTime;
  });

  if (expiredFiles.length === 0) {
    return {
      sucesso: true,
      mensagem: 'Nenhum arquivo PNG com mais de 30 dias encontrado para limpeza.',
      arquivos_verificados: (files || []).length,
      arquivos_removidos: 0,
      placas_preservadas_vitaliciamente: true,
    };
  }

  const pathsToRemove = expiredFiles.map((f) => f.name);
  const { error: removeError } = await supabase.storage.from('qrcodes').remove(pathsToRemove);
  if (removeError) {
    throw new Error(`Erro ao remover arquivos do Storage: ${removeError.message}`);
  }

  const expiredCodes = pathsToRemove
    .map((name) => name.replace(/^QRCode_/, '').replace(/\.png$/i, ''))
    .filter(Boolean);

  if (expiredCodes.length > 0) {
    try {
      await supabase
        .from('plates')
        .update({ qrcode_url: null, updated_at: new Date().toISOString() })
        .in('codigo_sequencial', expiredCodes);
    } catch {}
  }

  return {
    sucesso: true,
    mensagem: `${pathsToRemove.length} arquivos PNG com mais de 30 dias expurgados do Storage. Redirecionamento vitalício (/r/:token) intacto.`,
    arquivos_verificados: (files || []).length,
    arquivos_removidos: pathsToRemove.length,
    codigos_expurgados: expiredCodes,
    placas_preservadas_vitaliciamente: true,
  };
}
