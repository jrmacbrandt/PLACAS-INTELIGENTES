import { Router } from 'express';
import { db } from '../db.js';
import { analyzeReceiptWithGemini } from '../services/ocr.js';
import { logAudit } from '../services/audit.js';
import type { OrderLogistics } from '../types.js';

export const logisticsRouter = Router();

const WHATSAPP_COMPANY_PHONE = '5511988880001';

/**
 * Listagem Operacional de Logística (Separada por Retirada e Correios)
 */
logisticsRouter.get('/orders', (req, res) => {
  const { modalidade } = req.query;

  let query = `
    SELECT l.*, o.numero_pedido, o.quantidade_total, o.status as order_status, o.valor_total,
           p.nome as revendedor_nome, p.telefone as revendedor_telefone, p.email as revendedor_email, p.tipo_parceiro,
           m.status as mfg_status
    FROM order_logistics l
    JOIN orders o ON l.order_id = o.id
    JOIN profiles p ON o.revendedor_id = p.id
    LEFT JOIN manufacturing_orders m ON m.order_id = o.id
    WHERE (
      m.status = 'producao_concluida'
      OR l.correios_status IN ('aguardando_postagem', 'postado', 'em_transito', 'saiu_para_entrega', 'entregue')
      OR l.retirada_status IN ('pronta_para_retirada', 'retirada_agendada', 'retirada_realizada')
      OR o.status = 'concluido'
    )
  `;

  const params: any[] = [];
  if (modalidade === 'retirada' || modalidade === 'correios') {
    query += ' AND l.modalidade = ?';
    params.push(modalidade);
  }

  query += ' ORDER BY l.created_at DESC';
  const list = db.prepare(query).all(...params);

  res.json({ sucesso: true, registros: list });
});

/**
 * Gera Link Oficial do WhatsApp para Retirada (ADR 003)
 */
logisticsRouter.get('/whatsapp-link/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT o.*, p.nome as revendedor_nome FROM orders o JOIN profiles p ON o.revendedor_id = p.id WHERE o.id = ?').get(orderId) as any;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const texto = `Olá! Sou ${order.revendedor_nome} e meu pedido ${order.numero_pedido} (${order.quantidade_total} placas) está pronto para retirada. Gostaria de combinar o dia e horário para pegar as placas.`;
  const url = `https://wa.me/${WHATSAPP_COMPANY_PHONE}?text=${encodeURIComponent(texto)}`;

  res.json({
    sucesso: true,
    whatsapp_url: url,
    telefone_empresa: WHATSAPP_COMPANY_PHONE,
    mensagem_predefinida: texto,
  });
});

/**
 * Atualização Manual de Rastreamento dos Correios
 */
logisticsRouter.post('/update-tracking', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { order_id, codigo_rastreamento, transportadora = 'Correios' } = req.body;

  if (!order_id || !codigo_rastreamento) {
    return res.status(400).json({ sucesso: false, mensagem: 'Pedido e código de rastreamento são obrigatórios.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE order_logistics 
    SET codigo_rastreamento = ?, correios_status = 'postado', data_postagem = ?, updated_at = ?
    WHERE order_id = ?
  `).run(codigo_rastreamento.trim(), now, now, order_id);

  logAudit({
    usuario_id: adminId,
    acao: 'REGISTRO_RASTREAMENTO_POSTAGEM',
    entidade: 'order_logistics',
    entidade_id: order_id,
    dados_novos: { codigo_rastreamento, transportadora, data_postagem: now },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: 'Código de rastreamento salvo e status atualizado para "Postado".',
  });
});

/**
 * Análise de Imagem do Comprovante de Postagem via Gemini OCR (Seção 17 e 26)
 */
logisticsRouter.post('/ocr-receipt', async (req, res) => {
  const { order_id, image_base64, mime_type = 'image/jpeg' } = req.body;

  if (!order_id || !image_base64) {
    return res.status(400).json({ sucesso: false, mensagem: 'order_id e imagem são obrigatórios.' });
  }

  const ocrResult = await analyzeReceiptWithGemini(image_base64, mime_type);

  // Armazena a miniatura/URL do comprovante no registro de logística
  db.prepare('UPDATE order_logistics SET comprovante_url = ? WHERE order_id = ?').run(image_base64.slice(0, 5000), order_id);

  res.json({
    sucesso: true,
    resultado_ocr: ocrResult,
    aviso: 'Conforme as regras de segurança, os dados extraídos pelo Gemini devem ser conferidos e validados manualmente pelo operador antes da confirmação final.',
  });
});
