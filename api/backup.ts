import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const BUCKET = 'backups';
const SENSITIVE_AUDIT_ID = 'cfg_integrations_v1';
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
  'payments',
  'qrcodes',
];

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(supabase: any, req: any): Promise<string> {
  const userId = String(req.headers?.['x-user-id'] || '').trim();
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
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) await supabase.storage.createBucket(BUCKET, { public: false });
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
    (r) => r.id !== SENSITIVE_AUDIT_ID && r.acao !== 'BACKUP_CREATED' && r.acao !== 'BACKUP_DRIVE_UPLOADED'
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
        size_bytes: size,
        checksum: payload.metadados.checksum,
        estatisticas: payload.metadados.estatisticas,
        origem,
        storage: `${BUCKET}/${filename}`,
        drive_file_id: null as string | null,
      };
      const { error: logErr } = await supabase.from('audit_logs').insert({
        id: `bkp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'BACKUP_CREATED',
        entidade: 'backup',
        entidade_id: filename,
        dados_novos: registro,
        created_at: createdAt,
      });
      if (logErr) throw new Error(`Backup salvo, mas o registro falhou: ${logErr.message}`);

      return res.status(200).json({ sucesso: true, mensagem: 'Backup criado e registrado no Supabase.', backup: registro, payload });
    }

    if (action === 'list' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('entidade_id, dados_novos, created_at, usuario_id')
        .eq('acao', 'BACKUP_CREATED')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      const backups = (data || []).map((r: any) => ({
        ...(typeof r.dados_novos === 'string' ? JSON.parse(r.dados_novos) : r.dados_novos),
        created_at: r.created_at,
        usuario_id: r.usuario_id,
      }));
      return res.status(200).json({ sucesso: true, backups });
    }

    if (action === 'download' && req.method === 'GET') {
      const filename = String(req.query?.filename || '');
      if (!isSafeFilename(filename)) return res.status(400).json({ sucesso: false, mensagem: 'Nome de arquivo inválido.' });
      const { data, error } = await supabase.storage.from(BUCKET).download(filename);
      if (error || !data) return res.status(404).json({ sucesso: false, mensagem: 'Backup não encontrado no Supabase.' });
      return res.status(200).json({ sucesso: true, payload: JSON.parse(await data.text()) });
    }

    if (action === 'mark-drive' && req.method === 'POST') {
      const { filename, drive_file_id, drive_folder_name } = req.body || {};
      if (!isSafeFilename(String(filename || ''))) return res.status(400).json({ sucesso: false, mensagem: 'Nome de arquivo inválido.' });
      const { error } = await supabase.from('audit_logs').insert({
        id: `bkpdrv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        usuario_id: userId,
        acao: 'BACKUP_DRIVE_UPLOADED',
        entidade: 'backup',
        entidade_id: filename,
        dados_novos: { filename, drive_file_id: drive_file_id || null, drive_folder_name: drive_folder_name || null },
        created_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return res.status(200).json({ sucesso: true });
    }

    return res.status(404).json({ sucesso: false, mensagem: 'Ação de backup desconhecida.' });
  } catch (err: any) {
    return res.status(err?.status || 500).json({ sucesso: false, mensagem: err?.message || 'Erro no backup.' });
  }
}

