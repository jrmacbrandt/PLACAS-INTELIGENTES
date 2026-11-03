import { Router } from 'express';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import {
  getSupabaseConfig,
  getLocalDatabaseStats,
  testSupabaseConnection,
  syncAllLocalDataToSupabase,
} from '../services/supabase.js';
import type { PricingTier, AuditLog } from '../types.js';

export const adminRouter = Router();

/**
 * Indicadores em Tempo Real para o Painel Administrativo (Seção 15 e 19.1)
 * Todos os números são calculados exclusivamente a partir de dados reais do banco.
 */
adminRouter.get('/stats', (req, res) => {
  const pedidosAguardandoPagamento = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'aguardando_pagamento'").get() as any).count;
  const pedidosPagos = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pago'").get() as any).count;
  const reservasAguardandoAprovacao = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE origem = 'solicitacao_interna' AND status = 'em_analise'").get() as any).count;
  
  const faturamentoTotal = (db.prepare("SELECT COALESCE(SUM(valor_total), 0) as total FROM orders WHERE status IN ('pago', 'concluido')").get() as any).total;
  
  const placasProduzidas = (db.prepare("SELECT COUNT(*) as count FROM plates WHERE status_fisico = 'produzida'").get() as any).count;
  const placasAprovadas = (db.prepare("SELECT COUNT(*) as count FROM plates WHERE status_fisico = 'aprovada'").get() as any).count;
  const placasReprovadas = (db.prepare("SELECT COUNT(*) as count FROM plates WHERE status_fisico = 'reprovada'").get() as any).count;
  const placasLiberadas = (db.prepare("SELECT COUNT(*) as count FROM plates WHERE status_fisico = 'liberada'").get() as any).count;
  const placasAtivas = (db.prepare("SELECT COUNT(*) as count FROM plates WHERE status_digital = 'ativa'").get() as any).count;
  
  const retiradasProntas = (db.prepare("SELECT COUNT(*) as count FROM order_logistics WHERE modalidade = 'retirada' AND retirada_status = 'pronta_para_retirada'").get() as any).count;
  const correiosAguardandoPostagem = (db.prepare("SELECT COUNT(*) as count FROM order_logistics WHERE modalidade = 'correios' AND correios_status = 'aguardando_postagem'").get() as any).count;
  const totalRevendedores = (db.prepare("SELECT COUNT(*) as count FROM profiles WHERE role = 'revendedor'").get() as any).count;

  res.json({
    sucesso: true,
    indicadores: {
      pedidos_aguardando_pagamento: pedidosAguardandoPagamento,
      pedidos_pagos: pedidosPagos,
      reservas_aguardando_aprovacao: reservasAguardandoAprovacao,
      faturamento_total: Number(faturamentoTotal.toFixed(2)),
      placas_produzidas: placasProduzidas,
      placas_aprovadas: placasAprovadas,
      placas_reprovadas: placasReprovadas,
      placas_liberadas: placasLiberadas,
      placas_ativas: placasAtivas,
      retiradas_prontas: retiradasProntas,
      correios_aguardando_postagem: correiosAguardandoPostagem,
      total_revendedores: totalRevendedores,
    },
  });
});

/**
 * Consulta e Atualização das Faixas de Precificação Global (ADR 002)
 */
adminRouter.get('/pricing-tiers', (req, res) => {
  const tiers = db.prepare('SELECT * FROM pricing_tiers ORDER BY quantidade_minima ASC').all() as unknown as PricingTier[];
  res.json({ sucesso: true, faixas: tiers });
});

adminRouter.put('/pricing-tiers', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { faixas } = req.body;

  if (!Array.isArray(faixas) || faixas.length === 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Array de faixas de preço é obrigatório.' });
  }

  const updateTier = db.prepare('UPDATE pricing_tiers SET preco_unitario = ? WHERE id = ?');
  for (const f of faixas) {
    if (f.id && f.preco_unitario > 0) {
      updateTier.run(Number(f.preco_unitario), f.id);
    }
  }

  logAudit({
    usuario_id: adminId,
    acao: 'ATUALIZACAO_TABELA_PRECOS_GLOBAL',
    entidade: 'pricing_tiers',
    dados_novos: faixas,
    ip_origem: req.ip,
  });

  const updatedTiers = db.prepare('SELECT * FROM pricing_tiers ORDER BY quantidade_minima ASC').all();
  res.json({ sucesso: true, mensagem: 'Tabela de preços atualizada com sucesso.', faixas: updatedTiers });
});

/**
 * Define ou Remove Preço Individual de um Revendedor (Seção 6 e 8.2)
 */
adminRouter.post('/profiles/:id/pricing', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { id } = req.params;
  const { preco_individual, faixas_preco_individual } = req.body;

  const preco = preco_individual !== null && preco_individual !== undefined && Number(preco_individual) > 0 ? Number(preco_individual) : null;
  const faixas = Array.isArray(faixas_preco_individual) && faixas_preco_individual.length > 0
    ? faixas_preco_individual.map((f: any) => ({
        quantidade_minima: Number(f.quantidade_minima),
        quantidade_maxima: f.quantidade_maxima === null || f.quantidade_maxima === '' || f.quantidade_maxima === undefined ? null : Number(f.quantidade_maxima),
        preco_unitario: Number(f.preco_unitario),
      }))
    : null;
  const now = new Date().toISOString();

  db.prepare('UPDATE profiles SET preco_individual = ?, faixas_preco_individual = ?, updated_at = ? WHERE id = ?').run(
    preco,
    faixas ? JSON.stringify(faixas) : null,
    now,
    id
  );

  logAudit({
    usuario_id: adminId,
    acao: 'CONFIGURACAO_PRECO_INDIVIDUAL',
    entidade: 'profiles',
    entidade_id: id,
    dados_novos: { preco_individual: preco, faixas_preco_individual: faixas },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: faixas
      ? `${faixas.length} faixas de preço personalizadas configuradas para o parceiro.`
      : preco
        ? `Preço individual de R$ ${preco.toFixed(2)} configurado para o parceiro.`
        : 'Preço individual removido. Parceiro retornou à tabela global.',
  });
});

/**
 * Consulta Logs de Auditoria
 */
adminRouter.get('/audit-logs', (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, p.nome as usuario_nome
    FROM audit_logs a
    LEFT JOIN profiles p ON a.usuario_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all();

  res.json({ sucesso: true, logs });
});

/**
 * Status da Integração com Supabase (PostgreSQL & Storage)
 */
adminRouter.get('/supabase-status', (req, res) => {
  const config = getSupabaseConfig();
  const localStats = getLocalDatabaseStats();

  res.json({
    sucesso: true,
    configurado: config.isConfigured,
    url: config.url || null,
    tem_chave: config.hasKey,
    regiao_recomendada: config.region,
    estatisticas_locais: localStats,
    mensagem: config.isConfigured
      ? 'Supabase configurado e pronto para operação em nuvem!'
      : 'Supabase em modo standby. Basta preencher as variáveis no arquivo .env.',
  });
});

/**
 * Teste de Conexão com Supabase
 */
adminRouter.post('/supabase-test', async (req, res) => {
  const resultado = await testSupabaseConnection();
  res.json(resultado);
});

/**
 * Sincronização Unificada do SQLite Local para o Supabase
 */
adminRouter.post('/supabase-sync', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const resultado = await syncAllLocalDataToSupabase();

  if (resultado.sucesso) {
    logAudit({
      usuario_id: adminId,
      acao: 'SINCRONIZACAO_SUPABASE',
      entidade: 'database',
      dados_novos: resultado.detalhes,
      ip_origem: req.ip,
    });
  }

  res.json(resultado);
});

