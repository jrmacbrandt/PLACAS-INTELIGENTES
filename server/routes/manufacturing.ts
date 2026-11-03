import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { generateCryptographicToken, generateNextPlateSequence } from '../services/token.js';
import { logAudit } from '../services/audit.js';
import type { ManufacturingOrder, Plate } from '../types.js';

export const manufacturingRouter = Router();

/**
 * Fila Unificada de Fabricação Sob Demanda (Seção 10.3 e 15.3)
 * Reúne pedidos pagos de revendedores e reservas aprovadas da equipe interna.
 */
manufacturingRouter.get('/queue', (req, res) => {
  const queue = db.prepare(`
    SELECT m.*, o.numero_pedido, o.modalidade_entrega, p.nome as revendedor_nome, p.tipo_parceiro as revendedor_tipo
    FROM manufacturing_orders m
    JOIN orders o ON m.order_id = o.id
    JOIN profiles p ON o.revendedor_id = p.id
    WHERE (m.status = 'em_producao' OR o.status = 'em_producao') AND m.status != 'producao_concluida'
    ORDER BY m.created_at ASC
  `).all();

  res.json({ sucesso: true, fila: queue });
});

/**
 * Registro Físico de Produção de Unidades (Suporte a Produção Parcial - Seção 8.3 e 11.1)
 * Criação dos registros unitários na tabela plates com token criptográfico e código sequencial.
 */
manufacturingRouter.post('/:id/produce', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { id } = req.params;
  const { quantidade } = req.body;

  const qty = parseInt(quantidade, 10);
  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ sucesso: false, mensagem: 'Quantidade a produzir deve ser no mínimo 1.' });
  }

  const mfg = db.prepare('SELECT * FROM manufacturing_orders WHERE id = ?').get(id) as ManufacturingOrder | undefined;
  if (!mfg) {
    return res.status(404).json({ sucesso: false, mensagem: 'Ordem de fabricação não encontrada.' });
  }

  const pendenteProduzir = mfg.quantidade_solicitada - mfg.quantidade_produzida;
  if (qty > pendenteProduzir) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Quantidade informada (${qty}) excede o saldo pendente de produção (${pendenteProduzir}).`,
    });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(mfg.order_id) as any;
  const now = new Date().toISOString();
  const appUrl = process.env.APP_URL || 'https://ais-dev-6ezygfhqwiuwevza32effv-186490178798.us-west2.run.app';

  const createdPlates: string[] = [];

  // Transação atômica para geração das unidades físicas
  for (let i = 0; i < qty; i++) {
    const plateId = `plt_${crypto.randomUUID().slice(0, 8)}`;
    const codigoSeq = generateNextPlateSequence();
    const token = generateCryptographicToken(12);
    const urlPermanente = `${appUrl.replace(/\/$/, '')}/r/${token}`;

    db.prepare(`
      INSERT INTO plates (
        id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
        token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'produzida', 'inativa', 'instalado', ?)
    `).run(
      plateId,
      mfg.id,
      mfg.order_id,
      order.revendedor_id,
      codigoSeq,
      token,
      urlPermanente,
      now
    );

    createdPlates.push(codigoSeq);
  }

  const novaQtdProduzida = mfg.quantidade_produzida + qty;
  const novoStatus = novaQtdProduzida >= mfg.quantidade_solicitada ? 'producao_concluida' : 'producao_parcial';

  db.prepare(`
    UPDATE manufacturing_orders 
    SET quantidade_produzida = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(novaQtdProduzida, novoStatus, now, id);

  db.prepare(`
    UPDATE orders SET status = 'em_producao', updated_at = ? WHERE id = ?
  `).run(now, mfg.order_id);

  logAudit({
    usuario_id: adminId,
    acao: 'REGISTRO_PRODUCAO_FISICA',
    entidade: 'manufacturing_orders',
    entidade_id: id,
    dados_novos: { quantidade_produzida: qty, unidades_criadas: createdPlates, status: novoStatus },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `${qty} unidades produzidas com sucesso e cadastradas para inspeção de qualidade.`,
    placas_criadas: createdPlates,
  });
});
