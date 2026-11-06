import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const BUCKET = 'backups';
const SENSITIVE_AUDIT_ID = 'cfg_integrations_v1';
const BACKUP_CONFIG_ID = 'cfg_backup_v1';
const PAGE_SIZE = 1000;

// Tabelas relacionais em ordem correta de restauração (respeitando foreign keys)
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(supabase: any, req: any): Promise<string> {
  const userId = String(req.headers?.['x-user-id'] || req.query?.user_id || '').trim();
  if (!userId) throw Object.assign(new Error('Usuário não identificado.'), { status: 401 });
  const { data } = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (!data || data.role !== 'admin') {
    throw Object.assign(new Error('Acesso restrito a administradores.'), { status: 403 });
  }
  return userId;
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

async function ensureBucket(supabase: any) {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (!data) await supabase.storage.createBucket(BUCKET, { public: false });
  } catch {}
}

function isSafeFilename(name: string) {
  return /^backup_atelier_das_placas_[\w.-]+\.json$/.test(name);
}

async function buildBackup(supabase: any, origem: string) {
  const now = new Date();
  const dados: Record<string, any[]> = {};
  const tabelasAusentes: string[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = await fetchAllRows(supabase, table);
    if (rows === null) tabelasAusentes.push(table);
    else dados[table] = rows;
  }

  dados.audit_logs = ((await fetchAllRows(supabase, 'audit_logs')) || []).filter(
    (r) => r.id !== SENSITIVE_AUDIT_ID && r.id !== BACKUP_CONFIG_ID
  );

  const estatisticas: Record<string, number> = {};
  let total = 0;
  for (const [t, rows] of Object.entries(dados)) {
    estatisticas[t] = rows.length;
    total += rows.length;
  }
  estatisticas.total_registros = total;

  return {
    filename: buildFilename(now),
    createdAt: now.toISOString(),
    payload: {
      metadados: {
        sistema: 'Atelier das Placas - Plataforma de Placas Inteligentes QR & NFC',
        versao_schema: '5.0.0',
        data_criacao: now.toISOString(),
        data_formatada: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        origem,
        fonte: 'supabase',
        tabelas_ausentes: tabelasAusentes,
        checksum: crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex'),
        estatisticas,
      },
      dados,
    },
  };
}

export default async function handler(req: any, res: any) {
  try {
    const supabase = getSupabaseAdmin();
    const userId = await requireAdmin(supabase, req);
    const action = String(req.query?.action || '').trim();

    // 1. CRIAR BACKUP (SALVAR NO SUPABASE STORAGE + AUDIT REGISTRY)
    if (action === 'create' && req.method === 'POST') {
      const origem = req.body?.origem === 'automatico' ? 'automatico' : 'manual';
      const { filename, createdAt, payload } = await buildBackup(supabase, origem);
      const content = JSON.stringify(payload);
      const size = Buffer.byteLength(content, 'utf-8');

      await ensureBucket(supabase);
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, Buffer.from(content, 'utf-8'), { contentType: 'application/json', upsert: false });
      if (upErr) throw new Error(`Falha ao gravar cópia no Supabase Storage: ${upErr.message}`);

      const registro = {
        filename,
        size,
        size_bytes: size,
        size_formatted: `${(size / 1024).toFixed(1)} KB`,
        formatted_date: payload.metadados.data_formatada,
        checksum: payload.metadados.checksum,
        estatisticas: payload.metadados.estatisticas,
        origem,
        storage: `${BUCKET}/${filename}`,
        created_at: createdAt,
        drive_file_id: null as string | null,
      };

      await supabase.from('audit_logs').insert({
        id: `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'BACKUP_CREATED',
        entidade: 'backup',
        entidade_id: filename,
        dados_novos: registro,
        created_at: createdAt,
      });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Backup criado e registrado no Supabase com sucesso!',
        backup: registro,
        payload,
      });
    }

    // 2. DOWNLOAD DIRETO / STREAMING DO BACKUP
    if (action === 'download-instant' && req.method === 'GET') {
      const { filename, payload } = await buildBackup(supabase, 'download_direto');
      const content = JSON.stringify(payload, null, 2);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(content);
    }

    // 3. LISTAR BACKUPS REGISTRADOS NO SUPABASE
    if (action === 'list' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('entidade_id, dados_novos, created_at, usuario_id')
        .eq('acao', 'BACKUP_CREATED')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      const backups = (data || []).map((r: any) => {
        const d = typeof r.dados_novos === 'string' ? JSON.parse(r.dados_novos) : r.dados_novos || {};
        const sizeBytes = d.size_bytes || d.size || 0;
        return {
          filename: r.entidade_id || d.filename,
          size: sizeBytes,
          size_formatted: d.size_formatted || `${(sizeBytes / 1024).toFixed(1)} KB`,
          created_at: r.created_at,
          formatted_date: d.formatted_date || new Date(r.created_at).toLocaleString('pt-BR'),
          origem: d.origem || 'manual',
          estatisticas: d.estatisticas || null,
          checksum: d.checksum || null,
          drive_file_id: d.drive_file_id || null,
          usuario_id: r.usuario_id,
        };
      });

      return res.status(200).json({ sucesso: true, backups });
    }

    // 4. DOWNLOAD DE UM ARQUIVO DO SUPABASE STORAGE
    if (action === 'download' && req.method === 'GET') {
      const filename = String(req.query?.filename || '');
      if (!isSafeFilename(filename)) return res.status(400).json({ sucesso: false, mensagem: 'Nome de arquivo inválido.' });
      const { data, error } = await supabase.storage.from(BUCKET).download(filename);
      if (error || !data) return res.status(404).json({ sucesso: false, mensagem: 'Backup não encontrado no Supabase.' });
      return res.status(200).json({ sucesso: true, payload: JSON.parse(await data.text()) });
    }

    // 5. EXCLUIR BACKUP DO SUPABASE STORAGE E REGISTRO
    if (action === 'delete' && req.method === 'DELETE') {
      const filename = String(req.query?.filename || '');
      if (!isSafeFilename(filename)) return res.status(400).json({ sucesso: false, mensagem: 'Nome de arquivo inválido.' });

      await supabase.storage.from(BUCKET).remove([filename]);
      await supabase.from('audit_logs').delete().eq('entidade_id', filename);

      await supabase.from('audit_logs').insert({
        id: `bkpdel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'EXCLUSAO_BACKUP',
        entidade: 'backup',
        entidade_id: filename,
        dados_novos: { filename },
        created_at: new Date().toISOString(),
      });

      return res.status(200).json({ sucesso: true, mensagem: `Backup "${filename}" excluído com sucesso do Supabase.` });
    }

    // 6. REGISTRAR ENVIO AO GOOGLE DRIVE NO SUPABASE
    if (action === 'mark-drive' && req.method === 'POST') {
      const { filename, drive_file_id, drive_folder_name } = req.body || {};
      if (!isSafeFilename(String(filename || ''))) return res.status(400).json({ sucesso: false, mensagem: 'Nome de arquivo inválido.' });

      // Atualiza o registro original se existir
      const { data: original } = await supabase
        .from('audit_logs')
        .select('id, dados_novos')
        .eq('entidade_id', filename)
        .eq('acao', 'BACKUP_CREATED')
        .maybeSingle();

      if (original) {
        const curData = typeof original.dados_novos === 'string' ? JSON.parse(original.dados_novos) : original.dados_novos || {};
        await supabase
          .from('audit_logs')
          .update({
            dados_novos: {
              ...curData,
              drive_file_id: drive_file_id || null,
              drive_folder_name: drive_folder_name || null,
            },
          })
          .eq('id', original.id);
      }

      await supabase.from('audit_logs').insert({
        id: `bkpdrv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'BACKUP_DRIVE_UPLOADED',
        entidade: 'backup',
        entidade_id: filename,
        dados_novos: { filename, drive_file_id: drive_file_id || null, drive_folder_name: drive_folder_name || null },
        created_at: new Date().toISOString(),
      });

      return res.status(200).json({ sucesso: true });
    }

    // 7. CONFIGURAÇÃO DE BACKUP ARMAZENADA NO SUPABASE
    if (action === 'config') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('audit_logs').select('dados_novos').eq('id', BACKUP_CONFIG_ID).maybeSingle();
        const saved = typeof data?.dados_novos === 'string' ? JSON.parse(data.dados_novos) : data?.dados_novos;
        const config = {
          enabled: true,
          horarios: ['12:00', '23:00'],
          max_arquivos: 10,
          destino_automatico: 'google_drive',
          drive_folder_id: null,
          drive_folder_name: null,
          ultimo_backup: null,
          ...saved,
        };
        return res.status(200).json({ sucesso: true, config });
      }

      if (req.method === 'POST') {
        const incoming = req.body || {};
        const { data: cur } = await supabase.from('audit_logs').select('dados_novos').eq('id', BACKUP_CONFIG_ID).maybeSingle();
        const currentSaved = typeof cur?.dados_novos === 'string' ? JSON.parse(cur.dados_novos) : cur?.dados_novos || {};

        const updated = {
          ...currentSaved,
          ...incoming,
          updated_at: new Date().toISOString(),
        };

        const { error: saveErr } = await supabase.from('audit_logs').upsert({
          id: BACKUP_CONFIG_ID,
          usuario_id: userId,
          acao: 'BACKUP_CONFIG_SAVED',
          entidade: 'system_settings',
          entidade_id: 'backup_config',
          dados_novos: updated,
          created_at: updated.updated_at,
        });

        if (saveErr) throw new Error(saveErr.message);
        return res.status(200).json({ sucesso: true, mensagem: 'Configurações de backup salvas no Supabase.', config: updated });
      }
    }

    // 8. RESTAURAÇÃO COMPLETA 100% SUPABASE POSTGRESQL
    if (action === 'restore' && req.method === 'POST') {
      let payload = req.body;
      if (payload.backup) {
        payload = typeof payload.backup === 'string' ? JSON.parse(payload.backup) : payload.backup;
      }

      // Se passou apenas o filename, recupera do Storage do Supabase
      if (payload.filename && !payload.dados) {
        const { data: fileData, error: fileErr } = await supabase.storage.from(BUCKET).download(payload.filename);
        if (fileErr || !fileData) throw new Error(`Backup "${payload.filename}" não localizado no Supabase Storage.`);
        payload = JSON.parse(await fileData.text());
      }

      if (!payload?.dados || !payload?.metadados) {
        throw new Error('Formato de backup inválido: dados ou metadados ausentes.');
      }

      // Validação de Checksum
      if (payload.metadados.checksum) {
        const check = crypto.createHash('sha256').update(JSON.stringify(payload.dados)).digest('hex');
        if (check !== payload.metadados.checksum) {
          throw new Error('Falha de integridade: O checksum do arquivo não confere com os dados.');
        }
      }

      const dados = payload.dados;
      const restauradas: Record<string, number> = {};

      // Restaura cada tabela em ordem estrita de dependência referencial
      for (const table of BACKUP_TABLES) {
        const rows = dados[table];
        if (Array.isArray(rows) && rows.length > 0) {
          // Faz upsert em blocos de 500 registros para alta performance
          for (let i = 0; i < rows.length; i += 500) {
            const chunk = rows.slice(i, i + 500);
            const { error: upErr } = await supabase.from(table).upsert(chunk);
            if (upErr) {
              console.warn(`[RESTORE_WARN] Falha parcial em ${table}:`, upErr.message);
            }
          }
          restauradas[table] = rows.length;
        }
      }

      // Restaura audit_logs (sem sobrescrever as credenciais de integração nem a config atual)
      if (Array.isArray(dados.audit_logs)) {
        const safeLogs = dados.audit_logs.filter((l: any) => l.id !== SENSITIVE_AUDIT_ID && l.id !== BACKUP_CONFIG_ID);
        if (safeLogs.length > 0) {
          for (let i = 0; i < safeLogs.length; i += 500) {
            const chunk = safeLogs.slice(i, i + 500);
            await supabase.from('audit_logs').upsert(chunk);
          }
          restauradas.audit_logs = safeLogs.length;
        }
      }

      // Registra a auditoria da restauração
      await supabase.from('audit_logs').insert({
        id: `bkpres_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'BACKUP_RESTORED',
        entidade: 'backup',
        entidade_id: payload.metadados.data_criacao || new Date().toISOString(),
        dados_novos: { restauradas, metadados: payload.metadados },
        created_at: new Date().toISOString(),
      });

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Banco de dados do Supabase restaurado com sucesso!',
        detalhes: restauradas,
      });
    }

    return res.status(404).json({ sucesso: false, mensagem: 'Ação de backup desconhecida.' });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ sucesso: false, mensagem: err?.message || 'Erro no backup.' });
  }
}
