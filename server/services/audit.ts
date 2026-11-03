import crypto from 'node:crypto';
import { db } from '../db.js';
import { triggerAutoSupabaseSync } from './supabase.js';

export function logAudit(params: {
  usuario_id: string | null;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  dados_anteriores?: any;
  dados_novos?: any;
  ip_origem?: string | null;
}) {
  try {
    const id = `aud_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO audit_logs (id, usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip_origem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.usuario_id,
      params.acao,
      params.entidade,
      params.entidade_id || null,
      params.dados_anteriores ? JSON.stringify(params.dados_anteriores) : null,
      params.dados_novos ? JSON.stringify(params.dados_novos) : null,
      params.ip_origem || null
    );

    if (params.acao !== 'SINCRONIZACAO_SUPABASE') {
      triggerAutoSupabaseSync();
    }
  } catch (err) {
    console.error('[AUDIT_ERROR] Falha ao registrar log de auditoria:', err);
  }
}
