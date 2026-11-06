import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import {
  refreshGoogleDriveAccessToken,
  uploadBackupToGoogleDriveFolder,
  cleanOldGoogleDriveBackups,
} from '../../server/services/googleDriveOAuth.js';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

const BUCKET = 'backups';
const CONFIG_ROW_ID = 'cfg_integrations_v1';
const BACKUP_CONFIG_ID = 'cfg_backup_v1';
const PAGE_SIZE = 1000;

const BACKUP_TABLES = [
  'profiles',
  'pricing_tiers',
  'clients',
  'orders',
  'order_logistics',
  'manufacturing_orders',
  'plates',
  'inspections',
  'destination_history',
  'payments',
  'webhook_events',
] as const;

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchAllRows(supabase: any, table: string): Promise<any[] | null> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) {
      if (error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message)) return null;
      throw new Error(`Falha ao ler "${table}": ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `backup_atelier_das_placas_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}h${p(now.getMinutes())}m${p(now.getSeconds())}s.json`;
}

/**
 * GET /api/cron/scheduled-backup
 * Executa o backup automático 100% em nuvem (Supabase Storage + Google Drive Vitalício)
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  }

  // Validação opcional de CRON_SECRET se configurado
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado: CRON_SECRET inválido.' });
    }
  }

  const supabase = getSupabaseAdmin();

  try {
    // 1. Carrega as configurações de agendamento do Supabase
    const { data: cfgRow } = await supabase.from('audit_logs').select('dados_novos').eq('id', BACKUP_CONFIG_ID).maybeSingle();
    const backupCfg = typeof cfgRow?.dados_novos === 'string' ? JSON.parse(cfgRow.dados_novos) : cfgRow?.dados_novos || {};

    if (backupCfg.enabled === false && !req.query?.force) {
      return res.status(200).json({ sucesso: true, mensagem: 'Backups automáticos desativados nas configurações.' });
    }

    // 2. Extrai dados das 12 tabelas relacionais do Supabase
    const now = new Date();
    const dados: Record<string, any[]> = {};
    const tabelasAusentes: string[] = [];

    for (const table of BACKUP_TABLES) {
      const rows = await fetchAllRows(supabase, table);
      if (rows === null) tabelasAusentes.push(table);
      else dados[table] = rows;
    }

    dados.audit_logs = ((await fetchAllRows(supabase, 'audit_logs')) || []).filter(
      (r) => r.id !== CONFIG_ROW_ID && r.id !== BACKUP_CONFIG_ID
    );

    const estatisticas: Record<string, number> = {};
    let total = 0;
    for (const [t, rows] of Object.entries(dados)) {
      estatisticas[t] = rows.length;
      total += rows.length;
    }
    estatisticas.total_registros = total;

    const filename = buildFilename(now);
    const payload = {
      metadados: {
        sistema: 'Atelier das Placas - Plataforma de Placas Inteligentes QR & NFC',
        versao_schema: '5.0.0',
        data_criacao: now.toISOString(),
        data_formatada: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        origem: 'cron_automatico',
        fonte: 'supabase',
        tabelas_ausentes: tabelasAusentes,
        checksum: crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex'),
        estatisticas,
      },
      dados,
    };

    const content = JSON.stringify(payload);
    const size = Buffer.byteLength(content, 'utf-8');

    // 3. Salva no Supabase Storage (bucket privado 'backups')
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    await supabase.storage.from(BUCKET).upload(filename, Buffer.from(content, 'utf-8'), {
      contentType: 'application/json',
      upsert: false,
    });

    // 4. Se o destino for Google Drive ou Ambos, faz o upload usando o Refresh Token Vitalício
    let driveUploaded = false;
    let driveFileId: string | null = null;
    let driveError: string | null = null;

    const destino = backupCfg.destino_automatico || 'google_drive';
    if (destino === 'google_drive' || destino === 'ambos') {
      try {
        const { data: intRow } = await supabase.from('audit_logs').select('dados_novos').eq('id', CONFIG_ROW_ID).maybeSingle();
        const intSettings = typeof intRow?.dados_novos === 'string' ? JSON.parse(intRow.dados_novos) : intRow?.dados_novos || {};

        const clientId = intSettings.google_drive_client_id;
        const clientSecret = intSettings.google_drive_client_secret;
        const refreshToken = intSettings.google_drive_refresh_token;
        const folderId = backupCfg.drive_folder_id || intSettings.google_drive_folder_id;

        if (clientId && clientSecret && refreshToken && folderId) {
          // Renova o token de acesso automaticamente (NUNCA EXPIRA)
          const { access_token } = await refreshGoogleDriveAccessToken({
            clientId,
            clientSecret,
            refreshToken,
          });

          const upRes = await uploadBackupToGoogleDriveFolder({
            accessToken: access_token,
            folderId,
            filename,
            payload,
          });

          driveFileId = upRes.id;
          driveUploaded = true;

          // Aplica retenção de backups no Drive
          await cleanOldGoogleDriveBackups({
            accessToken: access_token,
            folderId,
            maxFiles: backupCfg.max_arquivos || 10,
          }).catch(() => {});
        } else {
          driveError = 'Google Drive não configurado com refresh_token ou pasta de destino ausente.';
        }
      } catch (dErr: any) {
        driveError = dErr?.message || 'Falha ao sincronizar com Google Drive.';
      }
    }

    // 5. Registra o backup na auditoria do Supabase
    const registro = {
      filename,
      size,
      size_bytes: size,
      size_formatted: `${(size / 1024).toFixed(1)} KB`,
      formatted_date: payload.metadados.data_formatada,
      checksum: payload.metadados.checksum,
      estatisticas,
      origem: 'automatico',
      storage: `${BUCKET}/${filename}`,
      drive_file_id: driveFileId,
      drive_uploaded: driveUploaded,
      drive_error: driveError,
      created_at: now.toISOString(),
    };

    await supabase.from('audit_logs').insert({
      id: `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      usuario_id: 'cron_system',
      acao: 'BACKUP_CREATED',
      entidade: 'backup',
      entidade_id: filename,
      dados_novos: registro,
      created_at: now.toISOString(),
    });

    // Atualiza o último backup nas configurações
    await supabase.from('audit_logs').upsert({
      id: BACKUP_CONFIG_ID,
      usuario_id: 'cron_system',
      acao: 'BACKUP_CONFIG_SAVED',
      entidade: 'system_settings',
      entidade_id: 'backup_config',
      dados_novos: {
        ...backupCfg,
        ultimo_backup: now.toISOString(),
        updated_at: now.toISOString(),
      },
      created_at: now.toISOString(),
    });

    return res.status(200).json({
      sucesso: true,
      mensagem: `Backup automático concluído com sucesso (${filename}).`,
      registro,
    });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: `Falha no cron de backup: ${err?.message}`,
    });
  }
}
