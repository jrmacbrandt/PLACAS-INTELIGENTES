import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import type { Plate, Inspection } from '../types.js';

export const inspectionsRouter = Router();

/**
 * Lista de placas aguardando inspeção física
 */
inspectionsRouter.get('/pending', (req, res) => {
  const pendingPlates = db.prepare(`
    SELECT p.*, o.numero_pedido, o.modalidade_entrega, pr.nome as revendedor_nome
    FROM plates p
    JOIN orders o ON p.order_id = o.id
    JOIN profiles pr ON p.revendedor_id = pr.id
    WHERE p.status_fisico = 'produzida'
    ORDER BY p.created_at ASC
  `).all();

  res.json({ sucesso: true, placas: pendingPlates });
});

/**
 * Registro de Inspeção Física Unitária de Qualidade (Seção 10 e 13)
 * Checklist: leitura física do QR Code, acabamento e chip NFC
 */
inspectionsRouter.post('/submit', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { plate_id, qr_code_legivel, acrilico_conforme, nfc_gravado_correto, motivo_reprovacao, observacoes } = req.body;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(plate_id) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  // Se qualquer item falhar, o resultado é reprovada
  const aprovado = Boolean(qr_code_legivel && acrilico_conforme && nfc_gravado_correto);
  const resultado = aprovado ? 'aprovada' : 'reprovada';

  if (!aprovado && !motivo_reprovacao) {
    return res.status(400).json({ sucesso: false, mensagem: 'Para placas reprovadas, o motivo de reprovação é obrigatório.' });
  }

  const inspectionId = `insp_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO inspections (
      id, plate_id, resultado, inspetor_id, qr_code_legivel, acrilico_conforme,
      nfc_gravado_correto, motivo_reprovacao, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inspectionId,
    plate_id,
    resultado,
    adminId,
    qr_code_legivel ? 1 : 0,
    acrilico_conforme ? 1 : 0,
    nfc_gravado_correto ? 1 : 0,
    aprovado ? null : motivo_reprovacao,
    observacoes || null
  );

  // Atualiza status físico da placa
  db.prepare(`
    UPDATE plates 
    SET status_fisico = ?, status_nfc = ?, updated_at = ?
    WHERE id = ?
  `).run(resultado, nfc_gravado_correto ? 'testado' : 'com_problema', now, plate_id);

  // Atualiza contadores na ordem de fabricação se vinculada
  if (plate.manufacturing_order_id) {
    if (aprovado) {
      db.prepare(`
        UPDATE manufacturing_orders 
        SET quantidade_aprovada = quantidade_aprovada + 1, updated_at = ?
        WHERE id = ?
      `).run(now, plate.manufacturing_order_id);
    } else {
      db.prepare(`
        UPDATE manufacturing_orders 
        SET quantidade_reprovada = quantidade_reprovada + 1, updated_at = ?
        WHERE id = ?
      `).run(now, plate.manufacturing_order_id);
    }
  }

  logAudit({
    usuario_id: adminId,
    acao: 'INSPECAO_QUALIDADE_PLACA',
    entidade: 'plates',
    entidade_id: plate_id,
    dados_novos: { resultado, codigo_sequencial: plate.codigo_sequencial, motivo_reprovacao },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Inspeção concluída: Placa ${plate.codigo_sequencial} marcada como ${resultado.toUpperCase()}.`,
    resultado,
  });
});

/**
 * Liberação Administrativa da Placa para o Revendedor (Seção 11 e Adendo v5.0)
 * Placas reprovadas são categoricamente bloqueadas contra liberação.
 */
inspectionsRouter.post('/:plateId/release', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { plateId } = req.params;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(plateId) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  if (plate.status_fisico === 'reprovada') {
    return res.status(400).json({ sucesso: false, mensagem: 'PROIBIDO: Placas reprovadas na inspeção não podem ser liberadas.' });
  }

  if (plate.status_fisico !== 'aprovada') {
    return res.status(400).json({ sucesso: false, mensagem: 'Apenas placas devidamente aprovadas na inspeção física podem ser liberadas.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE plates 
    SET status_fisico = 'liberada', data_liberacao = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, plateId);

  logAudit({
    usuario_id: adminId,
    acao: 'LIBERACAO_PLACA',
    entidade: 'plates',
    entidade_id: plateId,
    dados_novos: { codigo_sequencial: plate.codigo_sequencial, revendedor_id: plate.revendedor_id },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Placa ${plate.codigo_sequencial} liberada com sucesso para o revendedor.`,
  });
});
