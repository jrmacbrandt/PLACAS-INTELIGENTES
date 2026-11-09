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

function getSaoPauloDateParts(date: Date): { dateKey: string; hhmm: string; minutesOfDay: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  const hour = Number(map.hour === '24' ? '0' : map.hour || '0');
  const minute = Number(map.minute || '0');
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hhmm,
    minutesOfDay: hour * 60 + minute,
  };
}

function getQueryParam(req: any, key: string): string {
  if (req.query && req.query[key] !== undefined && req.query[key] !== null) {
    return String(req.query[key]).trim();
  }
  try {
    const url = new URL(req.url || '', 'http://localhost');
    return String(url.searchParams.get(key) || '').trim();
  } catch {
    return '';
  }
}

/**
 * GET /api/cron/scheduled-backup
 * Executa o backup automático 100% em nuvem (Supabase Storage + Google Drive Vitalício)
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  }

  // Validação opcional de CRON_SECRET se configurado (apenas para chamadas externas sem check_schedule)
  const isScheduleCheck = getQueryParam(req, 'check_schedule') === '1' || req.body?.check_schedule === true;
  const isForced = getQueryParam(req, 'force') === '1' || req.body?.force === true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !isScheduleCheck) {
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

    if (backupCfg.enabled === false && !isForced) {
      return res.status(200).json({ sucesso: true, executed: false, mensagem: 'Backups automáticos desativados nas configurações.' });
    }

    const now = new Date();
    const spNow = getSaoPauloDateParts(now);
    const horarios: string[] = Array.isArray(backupCfg.horarios) && backupCfg.horarios.length > 0
      ? backupCfg.horarios
      : ['12:00', '23:00'];

    const executedSlots: Record<string, string> =
      backupCfg.horarios_executados && typeof backupCfg.horarios_executados === 'object'
        ? { ...backupCfg.horarios_executados }
        : {};

    // Identifica quais horários programados para hoje (America/Sao_Paulo) já chegaram e ainda não foram executados
    const dueSlots: string[] = [];
    for (const h of horarios) {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(h || '').trim());
      if (!m) continue;
      const slotMinutes = Number(m[1]) * 60 + Number(m[2]);
      const slotKey = `${spNow.dateKey}_${h}`;
      if (spNow.minutesOfDay >= slotMinutes && !executedSlots[slotKey]) {
        dueSlots.push(h);
      }
    }

    // Se for uma verificação de agendamento (check_schedule=1) e nenhum horário programado estiver pendente hoje, encerra sem duplicar
    if (isScheduleCheck && !isForced && dueSlots.length === 0) {
      return res.status(200).json({
        sucesso: true,
        executed: false,
        horario_atual_brt: spNow.hhmm,
        horarios_configurados: horarios,
        mensagem: 'Nenhum horário agendado pendente de execução neste momento.',
      });
    }
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
      horarios_disparados: dueSlots.length > 0 ? dueSlots : [spNow.hhmm],
      storage: `${BUCKET}/${filename}`,
      drive_file_id: driveFileId,
      drive_uploaded: driveUploaded,
      drive_error: driveError,
      created_at: now.toISOString(),
    };

    await supabase.from('audit_logs').insert({
      id: `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      usuario_id: 'prof_jose_brandt',
      acao: 'BACKUP_CREATED',
      entidade: 'backup',
      entidade_id: filename,
      dados_novos: registro,
      created_at: now.toISOString(),
    });

    // 5.1 Aplica retenção de quantidade máxima de backups no Supabase Storage e audit_logs
    const maxArquivos = Math.max(1, Number(backupCfg.max_arquivos || 10));
    try {
      const { data: allBackups } = await supabase
        .from('audit_logs')
        .select('id, entidade_id, created_at')
        .eq('acao', 'BACKUP_CREATED')
        .order('created_at', { ascending: false });

      if (allBackups && allBackups.length > maxArquivos) {
        const toDelete = allBackups.slice(maxArquivos);
        const filesToRemove = toDelete.map((b: any) => b.entidade_id).filter(Boolean);
        const idsToRemove = toDelete.map((b: any) => b.id).filter(Boolean);
        if (filesToRemove.length > 0) {
          await supabase.storage.from(BUCKET).remove(filesToRemove).catch(() => {});
        }
        if (idsToRemove.length > 0) {
          await supabase.from('audit_logs').delete().in('id', idsToRemove);
        }
      }
    } catch {}

    // Marca os horários de hoje como executados (mantendo apenas os registros de hoje para não crescer indefinidamente)
    const updatedExecutedSlots: Record<string, string> = {};
    for (const [k, v] of Object.entries(executedSlots)) {
      if (k.startsWith(spNow.dateKey)) {
        updatedExecutedSlots[k] = v;
      }
    }
    const slotsToMark = dueSlots.length > 0 ? dueSlots : horarios.filter((h) => {
      const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(h || '').trim());
      return m ? spNow.minutesOfDay >= Number(m[1]) * 60 + Number(m[2]) : false;
    });
    for (const h of slotsToMark) {
      updatedExecutedSlots[`${spNow.dateKey}_${h}`] = now.toISOString();
    }

    // Atualiza o último backup e os horários executados nas configurações
    await supabase.from('audit_logs').upsert({
      id: BACKUP_CONFIG_ID,
      usuario_id: 'prof_jose_brandt',
      acao: 'BACKUP_CONFIG_SAVED',
      entidade: 'system_settings',
      entidade_id: 'backup_config',
      dados_novos: {
        ...backupCfg,
        horarios_executados: updatedExecutedSlots,
        ultimo_backup: now.toISOString(),
        updated_at: now.toISOString(),
      },
      created_at: now.toISOString(),
    });

    return res.status(200).json({
      sucesso: true,
      executed: true,
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

