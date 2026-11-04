import { Router } from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { db } from '../db.js';
import { calculateOrderPrice } from '../services/pricing.js';
import {
  generateOrderNumber,
  generateCryptographicToken,
  generateNextPlateSequence,
  parsePlateSequence,
  formatPlateSequence,
} from '../services/token.js';
import { logAudit } from '../services/audit.js';
import type { Order, OrderLogistics, DeliveryPreference, OrderOrigin } from '../types.js';

export const ordersRouter = Router();

// Garantia defensiva: pedidos de equipe interna são isentos e pertencem exclusivamente à esteira de aprovados
try {
  db.prepare(`
    UPDATE orders 
    SET status = 'aprovado' 
    WHERE status = 'aguardando_pagamento' 
      AND (origem = 'solicitacao_interna' OR revendedor_id IN (SELECT id FROM profiles WHERE tipo_parceiro = 'equipe_interna'))
  `).run();
} catch (e) {
  console.error('[DB_INTERNAL_ORDERS_SYNC_ERROR]', e);
}

/**
 * Prévia de Cálculo de Preço (baseado nas faixas oficiais ou preço individual)
 */
ordersRouter.post('/calculate', (req, res) => {
  const { revendedor_id, quantidade } = req.body;
  const qty = parseInt(quantidade, 10);

  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ sucesso: false, mensagem: 'Quantidade inválida. Mínimo 1 unidade.' });
  }

  try {
    const calc = calculateOrderPrice(revendedor_id, qty);
    res.json({ sucesso: true, calculo: calc });
  } catch (error: any) {
    res.status(400).json({ sucesso: false, mensagem: error?.message });
  }
});

/**
 * Listagem de Pedidos
 * Admins visualizam todos; Revendedores visualizam exclusivamente seus próprios pedidos.
 */
ordersRouter.get('/', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const user = db.prepare('SELECT role FROM profiles WHERE id = ?').get(userId) as { role: string } | undefined;

  let orders: any[];
  if (user?.role === 'admin') {
    orders = db.prepare(`
      SELECT o.*, p.nome as revendedor_nome, p.telefone as revendedor_telefone, p.email as revendedor_email, p.tipo_parceiro as revendedor_tipo, c.nome_estabelecimento as cliente_nome
      FROM orders o
      JOIN profiles p ON o.revendedor_id = p.id
      LEFT JOIN clients c ON o.cliente_id = c.id
      ORDER BY o.created_at DESC
    `).all();
  } else {
    orders = db.prepare(`
      SELECT o.*, p.nome as revendedor_nome, p.telefone as revendedor_telefone, p.email as revendedor_email, p.tipo_parceiro as revendedor_tipo, c.nome_estabelecimento as cliente_nome
      FROM orders o
      JOIN profiles p ON o.revendedor_id = p.id
      LEFT JOIN clients c ON o.cliente_id = c.id
      WHERE o.revendedor_id = ?
      ORDER BY o.created_at DESC
    `).all(userId);
  }

  // Anexa logística e numeração de placas a cada pedido
  const ordersWithLogistics = orders.map((order: any) => {
    const logistica = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(order.id) as OrderLogistics | undefined;

    const countRow = db.prepare('SELECT COUNT(*) as c FROM plates WHERE order_id = ?').get(order.id) as { c: number } | undefined;
    const platesCount = countRow?.c || 0;

    let inicial = order.placa_codigo_inicial;
    let final = order.placa_codigo_final;
    if (!inicial || !final) {
      const minMax = db.prepare(`
        SELECT MIN(codigo_sequencial) as min_code, MAX(codigo_sequencial) as max_code 
        FROM plates 
        WHERE order_id = ?
      `).get(order.id) as { min_code: string | null; max_code: string | null };
      if (minMax.min_code && minMax.max_code) {
        inicial = minMax.min_code;
        final = minMax.max_code;
      }
    }

    const qrcodes_gerados = platesCount >= order.quantidade_total || (Boolean(inicial) && Boolean(final));
    const mfg = db.prepare('SELECT status FROM manufacturing_orders WHERE order_id = ?').get(order.id) as { status: string } | undefined;

    return {
      ...order,
      placa_codigo_inicial: inicial,
      placa_codigo_final: final,
      qrcodes_gerados,
      total_placas_geradas: platesCount,
      mfg_status: mfg?.status || null,
      logistica,
    };
  });

  res.json({ sucesso: true, pedidos: ordersWithLogistics });
});

/**
 * Criação de Pedido (Compra Direta ou Solicitação Interna)
 */
ordersRouter.post('/create', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || req.body.revendedor_id;
  const user = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId) as any;

  if (!user) {
    return res.status(404).json({ sucesso: false, mensagem: 'Perfil de usuário não encontrado.' });
  }

  const {
    origem = 'compra_revendedor',
    quantidade,
    modalidade_entrega,
    cliente_id,
    endereco_correios,
    dados_retirada,
    opcao_frete,
  } = req.body;

  const qty = parseInt(quantidade, 10);
  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ sucesso: false, mensagem: 'Quantidade inválida. Mínimo 1 unidade.' });
  }

  const modalidade: DeliveryPreference = modalidade_entrega === 'correios' ? 'correios' : 'retirada';

  // Validação de endereço se for Correios
  if (modalidade === 'correios' && (!endereco_correios?.cep || !endereco_correios?.logradouro)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Para envio via Correios, CEP e Logradouro são obrigatórios.' });
  }

  // Cálculo imutável de precificação
  const pricing = calculateOrderPrice(userId, qty);
  const valorFrete = modalidade === 'correios' && (opcao_frete?.price !== undefined || opcao_frete?.valor !== undefined)
    ? Number(opcao_frete?.price ?? opcao_frete?.valor)
    : 0;
  const valorTotalFinal = pricing.valor_total + valorFrete;

  const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
  const numeroPedido = generateOrderNumber();

  // Define status inicial baseado na origem:
  // - Compra revendedor externo: aguardando_pagamento (aguarda Asaas e NÃO autoriza fabricação)
  // - Pedido de equipe interna: aprovado (ISENTO de pagamento - autoriza fabricação e NÃO vai para pendentes)
  const isInternal = origem === 'solicitacao_interna' || user.tipo_parceiro === 'equipe_interna';
  const initialStatus = isInternal ? 'aprovado' : 'aguardando_pagamento';
  const finalTotal = isInternal ? 0.00 : valorTotalFinal;

  db.prepare(`
    INSERT INTO orders (
      id, numero_pedido, revendedor_id, origem, cliente_id, status,
      quantidade_total, preco_unitario_aplicado, valor_frete, valor_total, modalidade_entrega
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    numeroPedido,
    userId,
    isInternal ? 'solicitacao_interna' : 'compra_revendedor',
    cliente_id || null,
    initialStatus,
    qty,
    pricing.preco_unitario,
    isInternal ? 0.00 : valorFrete,
    finalTotal,
    modalidade
  );

  // Criação dos dados desacoplados de logística (ADR 003 e ADR 010 Melhor Envio)
  const logisticsId = `log_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO order_logistics (
      id, order_id, modalidade,
      responsavel_retirada_nome, responsavel_retirada_telefone, retirada_status,
      destinatario_nome, cep, logradouro, numero, complemento, bairro, cidade, uf,
      transportadora, servico_frete, servico_frete_id, valor_frete, prazo_dias, correios_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logisticsId,
    orderId,
    modalidade,
    modalidade === 'retirada' ? (dados_retirada?.nome || user.nome) : null,
    modalidade === 'retirada' ? (dados_retirada?.telefone || user.telefone) : null,
    modalidade === 'retirada' ? 'retirada_selecionada' : null,
    modalidade === 'correios' ? (endereco_correios?.destinatario || user.nome) : null,
    modalidade === 'correios' ? endereco_correios?.cep : null,
    modalidade === 'correios' ? endereco_correios?.logradouro : null,
    modalidade === 'correios' ? endereco_correios?.numero : null,
    modalidade === 'correios' ? endereco_correios?.complemento : null,
    modalidade === 'correios' ? endereco_correios?.bairro : null,
    modalidade === 'correios' ? endereco_correios?.cidade : null,
    modalidade === 'correios' ? endereco_correios?.uf : null,
    modalidade === 'correios' ? (opcao_frete?.carrier_name || opcao_frete?.transportadora || 'Melhor Envio') : null,
    modalidade === 'correios' ? (opcao_frete?.service_name || opcao_frete?.servico || '.Package') : null,
    modalidade === 'correios' ? (opcao_frete?.service_id || opcao_frete?.servico_id || null) : null,
    valorFrete,
    modalidade === 'correios' ? (opcao_frete?.delivery_time || opcao_frete?.prazo_dias || null) : null,
    modalidade === 'correios' ? 'aguardando_producao' : null
  );

  logAudit({
    usuario_id: userId,
    acao: 'CRIACAO_PEDIDO',
    entidade: 'orders',
    entidade_id: orderId,
    dados_novos: { numeroPedido, quantidade: qty, total: pricing.valor_total, modalidade, origem },
    ip_origem: req.ip,
  });

  const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const createdLogistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(orderId);

  res.status(201).json({
    sucesso: true,
    mensagem: 'Pedido criado com sucesso.',
    pedido: { ...createdOrder, logistica: createdLogistics },
  });
});

/**
 * Criação de Pedido de Vendedor Interno pelo Administrador
 * - Sem necessidade de pagamento prévio (isento de Asaas/checkout)
 * - Modalidade de entrega: estritamente Retirada no Balcão
 * - Entra diretamente com autorização para a esteira de fabricação
 */
ordersRouter.post('/create-internal', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem gerar pedidos internos.' });
  }

  const { vendedor_id, quantidade, observacoes } = req.body;
  const qty = parseInt(quantidade, 10);

  if (!vendedor_id) {
    return res.status(400).json({ sucesso: false, mensagem: 'Selecione um vendedor interno.' });
  }

  if (isNaN(qty) || qty < 1) {
    return res.status(400).json({ sucesso: false, mensagem: 'Quantidade inválida. Mínimo 1 unidade.' });
  }

  const vendedor = db.prepare('SELECT * FROM profiles WHERE id = ?').get(vendedor_id) as any;
  if (!vendedor) {
    return res.status(404).json({ sucesso: false, mensagem: 'Vendedor interno não encontrado.' });
  }

  const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
  const numeroPedido = generateOrderNumber();
  const now = new Date().toISOString();

  // Pedido interno: aprovado diretamente para fabricação, sem necessidade de pagamento via Asaas
  db.prepare(`
    INSERT INTO orders (
      id, numero_pedido, revendedor_id, origem, status,
      quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega,
      aprovado_por, data_aprovacao, observacoes_admin
    ) VALUES (?, ?, ?, 'solicitacao_interna', 'aprovado', ?, 0.00, 0.00, 'retirada', ?, ?, ?)
  `).run(
    orderId,
    numeroPedido,
    vendedor_id,
    qty,
    adminId,
    now,
    observacoes || 'Pedido interno da equipe de vendas (sem cobrança - retirada balcão)'
  );

  // Logística configurada como retirada no balcão
  const logisticsId = `log_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO order_logistics (
      id, order_id, modalidade,
      responsavel_retirada_nome, responsavel_retirada_telefone, retirada_status
    ) VALUES (?, ?, 'retirada', ?, ?, 'retirada_selecionada')
  `).run(
    logisticsId,
    orderId,
    vendedor.nome,
    vendedor.telefone
  );

  // Insere na fila de fabricação imediatamente
  const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO manufacturing_orders (
      id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
    ) VALUES (?, ?, 'solicitacao_interna', ?, 0, 0, 0, 'aguardando_producao')
  `).run(mfgId, orderId, qty);

  logAudit({
    usuario_id: adminId,
    acao: 'CRIACAO_PEDIDO_INTERNO',
    entidade: 'orders',
    entidade_id: orderId,
    dados_novos: { numeroPedido, vendedor: vendedor.nome, quantidade: qty, modalidade: 'retirada' },
    ip_origem: req.ip,
  });

  const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const createdLogistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(orderId);

  res.status(201).json({
    sucesso: true,
    mensagem: `Pedido interno #${numeroPedido} criado com sucesso para ${vendedor.nome}. Pronto para atribuição de QR Codes e início de produção.`,
    pedido: { ...createdOrder, logistica: createdLogistics },
  });
});

/**
 * Aprovação Administrativa de Solicitação Interna (Seção 4.4 e 8.2)
 * A aprovação autoriza a fabricação física SEM exigir pagamento prévio do vendedor.
 */
ordersRouter.post('/:id/approve', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem aprovar reservas.' });
  }

  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  if (order.origem !== 'solicitacao_interna') {
    return res.status(400).json({ sucesso: false, mensagem: 'Apenas solicitações internas passam por este fluxo de aprovação.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders 
    SET status = 'aprovado', aprovado_por = ?, data_aprovacao = ?, updated_at = ?
    WHERE id = ?
  `).run(adminId, now, now, id);

  // Insere na fila de fabricação sob demanda autorizada
  const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO manufacturing_orders (
      id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
    ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
  `).run(mfgId, id, 'solicitacao_interna', order.quantidade_total);

  logAudit({
    usuario_id: adminId,
    acao: 'APROVACAO_RESERVA_INTERNA',
    entidade: 'orders',
    entidade_id: id,
    dados_anteriores: { status: order.status },
    dados_novos: { status: 'aprovado', mfgId, aprovado_por: admin.nome },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: 'Reserva interna aprovada com sucesso. Ordem de fabricação encaminhada para produção.',
  });
});

/**
 * Alteração de Modalidade de Entrega pelo Administrador (ADR 003 e Seção 14.5)
 * Exige justificativa e gera log de auditoria.
 */
ordersRouter.post('/:id/change-delivery', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem alterar a modalidade de entrega do pedido.' });
  }

  const { id } = req.params;
  const { nova_modalidade, motivo, endereco_correios, dados_retirada } = req.body;

  if (!nova_modalidade || !motivo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nova modalidade e motivo são obrigatórios.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const modalidadeAntiga = order.modalidade_entrega;
  const now = new Date().toISOString();

  // Atualiza pedido
  db.prepare('UPDATE orders SET modalidade_entrega = ?, updated_at = ? WHERE id = ?').run(nova_modalidade, now, id);

  // Atualiza logística do pedido
  if (nova_modalidade === 'retirada') {
    db.prepare(`
      UPDATE order_logistics 
      SET modalidade = 'retirada',
          retirada_status = 'retirada_selecionada',
          responsavel_retirada_nome = COALESCE(?, responsavel_retirada_nome),
          responsavel_retirada_telefone = COALESCE(?, responsavel_retirada_telefone),
          updated_at = ?
      WHERE order_id = ?
    `).run(dados_retirada?.nome || null, dados_retirada?.telefone || null, now, id);
  } else {
    db.prepare(`
      UPDATE order_logistics 
      SET modalidade = 'correios',
          correios_status = 'aguardando_producao',
          destinatario_nome = COALESCE(?, destinatario_nome),
          cep = COALESCE(?, cep),
          logradouro = COALESCE(?, logradouro),
          numero = COALESCE(?, numero),
          complemento = COALESCE(?, complemento),
          bairro = COALESCE(?, bairro),
          cidade = COALESCE(?, cidade),
          uf = COALESCE(?, uf),
          updated_at = ?
      WHERE order_id = ?
    `).run(
      endereco_correios?.destinatario || null,
      endereco_correios?.cep || null,
      endereco_correios?.logradouro || null,
      endereco_correios?.numero || null,
      endereco_correios?.complemento || null,
      endereco_correios?.bairro || null,
      endereco_correios?.cidade || null,
      endereco_correios?.uf || null,
      now,
      id
    );
  }

  logAudit({
    usuario_id: adminId,
    acao: 'ALTERACAO_MODALIDADE_ENTREGA',
    entidade: 'orders',
    entidade_id: id,
    dados_anteriores: { modalidade: modalidadeAntiga },
    dados_novos: { modalidade: nova_modalidade, motivo },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Modalidade alterada com sucesso de ${modalidadeAntiga} para ${nova_modalidade}.`,
  });
});

/**
 * Atualização de Observações do Pedido pelo Administrador
 */
ordersRouter.post('/:id/update-notes', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem atualizar observações do pedido.' });
  }

  const { id } = req.params;
  const { observacoes } = req.body;
  const now = new Date().toISOString();

  db.prepare('UPDATE orders SET observacoes_admin = ?, updated_at = ? WHERE id = ?').run(observacoes || null, now, id);

  res.json({
    sucesso: true,
    mensagem: 'Observações do pedido atualizadas com sucesso.',
  });
});

/**
 * Confirmação Manual de Retirada Presencial (ADR 003 e Seção 14.2)
 */
ordersRouter.post('/:id/confirm-withdrawal', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas operadores autorizados podem confirmar a retirada física.' });
  }

  const { id } = req.params;
  const { quem_retirou } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE order_logistics 
    SET retirada_status = 'retirada_realizada',
        data_retirada_efetiva = ?,
        liberado_por = ?,
        responsavel_retirada_nome = COALESCE(?, responsavel_retirada_nome),
        updated_at = ?
    WHERE order_id = ?
  `).run(now, adminId, quem_retirou || null, now, id);

  db.prepare(`
    UPDATE orders SET status = 'concluido', updated_at = ? WHERE id = ?
  `).run(now, id);

  // Libera placas físicas vinculadas ao pedido para o revendedor
  db.prepare(`
    UPDATE plates 
    SET status_fisico = 'liberada', data_liberacao = ?, updated_at = ?
    WHERE order_id = ? AND status_fisico = 'aprovada'
  `).run(now, now, id);

  logAudit({
    usuario_id: adminId,
    acao: 'CONFIRMACAO_RETIRADA_EFETIVA',
    entidade: 'order_logistics',
    entidade_id: id,
    dados_novos: { data: now, quem_retirou, liberado_por: admin.nome },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: 'Retirada presencial confirmada com sucesso. Placas liberadas para ativação pelo revendedor.',
  });
});

/**
 * Geração de QR Codes do Pedido Recebido (Adendo Operacional Gestão)
 * Pré-gera as placas com código sequencial estritamente único e URL permanente criptografada,
 * retornando a imagem base64 do QR Code para download imediato.
 */
ordersRouter.post('/:id/generate-qrcodes', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  // REGRA DO USUÁRIO: Placas/pedidos aguardando pagamento não podem ter QR Codes gerados
  const isInternal = order.origem === 'solicitacao_interna';
  const isPaidOrApproved = order.status === 'pago' || order.status === 'aprovado' || order.status === 'em_analise' || isInternal;
  if (order.status === 'aguardando_pagamento' && !isPaidOrApproved) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Não é permitido gerar QR Codes para pedidos aguardando confirmação de pagamento. Confirme o pagamento via Asaas ou realize a aprovação manual antes.',
    });
  }

  const appUrl = process.env.APP_URL || 'https://placasinteligentes.vercel.app';
  const now = new Date().toISOString();

  // Verifica se já existem placas geradas para este pedido
  let existingPlates = db.prepare('SELECT * FROM plates WHERE order_id = ? ORDER BY codigo_sequencial ASC').all(id) as any[];

  // Se faltam placas para a quantidade total do pedido, gera as restantes
  if (existingPlates.length < order.quantidade_total) {
    // Garante que existe ordem de fabricação
    let mfg = db.prepare('SELECT * FROM manufacturing_orders WHERE order_id = ?').get(id) as any;
    if (!mfg) {
      const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO manufacturing_orders (
          id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
      `).run(mfgId, id, order.origem, order.quantidade_total);
      mfg = { id: mfgId };
    }

    const qtyToCreate = order.quantidade_total - existingPlates.length;
    for (let i = 0; i < qtyToCreate; i++) {
      const plateId = `plt_${crypto.randomUUID().slice(0, 8)}`;
      const codigoSeq = generateNextPlateSequence();
      const token = generateCryptographicToken(12);
      const urlPermanente = `${appUrl.replace(/\/$/, '')}/r/${token}`;

      db.prepare(`
        INSERT INTO plates (
          id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
          token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'planejada', 'inativa', 'instalado', ?)
      `).run(plateId, mfg.id, id, order.revendedor_id, codigoSeq, token, urlPermanente, now);
    }

    existingPlates = db.prepare('SELECT * FROM plates WHERE order_id = ? ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) ASC').all(id) as any[];
  }

  // Gera Data URL QR Code para cada placa
  const platesWithQRCodes = await Promise.all(
    existingPlates.map(async (p) => {
      const { qrcode_url, qrcode_data_url } = await generateAndUploadPlateQrCode({ id: p.id, codigo_sequencial: p.codigo_sequencial, url_permanente: p.url_permanente });
      return { ...p, qrcode_url, qrcode_data_url };
    })
  );

  // Determina e grava o intervalo sequencial no pedido
  const codigoInicial = existingPlates[0]?.codigo_sequencial || null;
  const codigoFinal = existingPlates[existingPlates.length - 1]?.codigo_sequencial || null;
  if (codigoInicial && codigoFinal) {
    db.prepare(`
      UPDATE orders 
      SET placa_codigo_inicial = ?, placa_codigo_final = ?, updated_at = ?
      WHERE id = ?
    `).run(codigoInicial, codigoFinal, now, id);
  }

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as Order;

  logAudit({
    usuario_id: adminId,
    acao: 'GERACAO_QRCODES_PEDIDO',
    entidade: 'orders',
    entidade_id: id,
    dados_novos: {
      total_geradas: platesWithQRCodes.length,
      numero_pedido: order.numero_pedido,
      codigo_inicial: codigoInicial,
      codigo_final: codigoFinal,
    },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `${platesWithQRCodes.length} QR Codes gerados com sucesso!`,
    placas: platesWithQRCodes,
    placa_codigo_inicial: codigoInicial,
    placa_codigo_final: codigoFinal,
    pedido: updatedOrder,
  });
});

/**
 * Atribuição Manual de Intervalo de Placas Pré-Fabricadas a um Pedido
 * Permite ao operador selecionar placas já fabricadas antecipadamente para estoque
 * e vinculá-las ao revendedor e pedido específico.
 */
ordersRouter.post('/:id/assign-range', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;
  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem atribuir numeração de placas a pedidos.' });
  }

  const { id } = req.params;
  const { codigo_inicial, codigo_final } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  // REGRA DO USUÁRIO: Placas/pedidos aguardando pagamento não podem ter intervalo atribuído
  const isInternal = order.origem === 'solicitacao_interna';
  const isPaidOrApproved = order.status === 'pago' || order.status === 'aprovado' || order.status === 'em_analise' || isInternal;
  if (order.status === 'aguardando_pagamento' && !isPaidOrApproved) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Não é permitido atribuir numeração de placas a pedidos aguardando confirmação de pagamento. Confirme o pagamento via Asaas ou realize a aprovação manual antes.',
    });
  }

  const numInicial = parsePlateSequence(codigo_inicial);
  const numFinal = parsePlateSequence(codigo_final);

  if (!numInicial || !numFinal) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Informe códigos válidos para o intervalo inicial e final (ex: PLK-000010 e PLK-000019).',
    });
  }

  if (numFinal < numInicial) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `O código final (${formatPlateSequence(numFinal)}) não pode ser menor que o inicial (${formatPlateSequence(numInicial)}).`,
    });
  }

  const rangeQty = numFinal - numInicial + 1;
  if (rangeQty !== order.quantidade_total) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `O intervalo informado possui ${rangeQty} placas (${formatPlateSequence(numInicial)} até ${formatPlateSequence(numFinal)}), mas o pedido #${order.numero_pedido} exige exatamente ${order.quantidade_total} placas.`,
    });
  }

  // Busca placas nesse intervalo numérico
  const platesInRange = db.prepare(`
    SELECT * FROM plates 
    WHERE CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) BETWEEN ? AND ?
    ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) ASC
  `).all(numInicial, numFinal) as any[];

  // Se faltam placas no banco para esse intervalo
  if (platesInRange.length < rangeQty) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Apenas ${platesInRange.length} das ${rangeQty} placas do intervalo existem no sistema. Gere as placas antecipadamente no menu "Gerar QR Codes" antes de atribuí-las.`,
    });
  }

  // Verifica se alguma placa já está atribuída a OUTRO pedido
  const conflito = platesInRange.find((p) => p.order_id && p.order_id !== id);
  if (conflito) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `A placa ${conflito.codigo_sequencial} já está vinculada ao pedido #${conflito.order_id}. Selecione um intervalo disponível em estoque.`,
    });
  }

  const now = new Date().toISOString();

  // Garante ou localiza ordem de fabricação para o pedido
  let mfg = db.prepare('SELECT * FROM manufacturing_orders WHERE order_id = ?').get(id) as any;
  if (!mfg) {
    const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO manufacturing_orders (
        id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 'em_producao')
    `).run(mfgId, id, order.origem, order.quantidade_total);
    mfg = { id: mfgId };
  }

  // Atribui cada placa ao pedido e revendedor
  const formattedInicial = formatPlateSequence(numInicial);
  const formattedFinal = formatPlateSequence(numFinal);

  for (const plate of platesInRange) {
    db.prepare(`
      UPDATE plates 
      SET order_id = ?, revendedor_id = ?, manufacturing_order_id = COALESCE(manufacturing_order_id, ?), updated_at = ?
      WHERE id = ?
    `).run(id, order.revendedor_id, mfg.id, now, plate.id);
  }

  // Atualiza os campos de intervalo no pedido
  db.prepare(`
    UPDATE orders 
    SET placa_codigo_inicial = ?, placa_codigo_final = ?, updated_at = ?
    WHERE id = ?
  `).run(formattedInicial, formattedFinal, now, id);

  // Recarrega pedido e placas atualizadas com QR Codes
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  const updatedPlates = db.prepare(`
    SELECT * FROM plates 
    WHERE order_id = ? 
    ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) ASC
  `).all(id) as any[];

  const platesWithQRCodes = await Promise.all(
    updatedPlates.map(async (p) => {
      const { qrcode_url, qrcode_data_url } = await generateAndUploadPlateQrCode({ id: p.id, codigo_sequencial: p.codigo_sequencial, url_permanente: p.url_permanente });
      return { ...p, qrcode_url, qrcode_data_url };
    })
  );

  logAudit({
    usuario_id: adminId,
    acao: 'ATRIBUICAO_INTERVALO_PLACAS_PEDIDO',
    entidade: 'orders',
    entidade_id: id,
    dados_novos: {
      codigo_inicial: formattedInicial,
      codigo_final: formattedFinal,
      quantidade: rangeQty,
      numero_pedido: order.numero_pedido,
    },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Intervalo ${formattedInicial} a ${formattedFinal} atribuído ao pedido #${order.numero_pedido} com sucesso!`,
    pedido: updatedOrder,
    placas: platesWithQRCodes,
  });
});

/**
 * Consulta de Placas e QR Codes de um Pedido
 */
ordersRouter.get('/:id/plates-and-qrcodes', async (req, res) => {
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  const plates = db.prepare('SELECT * FROM plates WHERE order_id = ? ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) ASC').all(id) as any[];

  const platesWithQRCodes = await Promise.all(
    plates.map(async (p) => {
      const { qrcode_url, qrcode_data_url } = await generateAndUploadPlateQrCode({ id: p.id, codigo_sequencial: p.codigo_sequencial, url_permanente: p.url_permanente });
      return { ...p, qrcode_url, qrcode_data_url };
    })
  );

  const codigoInicial = plates[0]?.codigo_sequencial || order?.placa_codigo_inicial || null;
  const codigoFinal = plates[plates.length - 1]?.codigo_sequencial || order?.placa_codigo_final || null;

  res.json({
    sucesso: true,
    placas: platesWithQRCodes,
    placa_codigo_inicial: codigoInicial,
    placa_codigo_final: codigoFinal,
    qrcodes_gerados: plates.length >= (order?.quantidade_total || 0) || (Boolean(codigoInicial) && Boolean(codigoFinal)),
  });
});

/**
 * Iniciar Produção de um Pedido Recebido
 * Altera status do pedido para 'em_producao', move placas para 'em_producao'
 */
ordersRouter.post('/:id/start-production', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const appUrl = process.env.APP_URL || 'https://placasinteligentes.vercel.app';
  const now = new Date().toISOString();

  // Verifica placas existentes (A geração de QR codes DEVE ser prévia e manual para revendedores e equipe interna)
  let plates = db.prepare('SELECT * FROM plates WHERE order_id = ?').all(id) as any[];

  const hasRangeAssigned = Boolean(order.placa_codigo_inicial && order.placa_codigo_final);
  const hasPlatesReady = plates.length >= order.quantidade_total;

  if (!hasPlatesReady && !hasRangeAssigned) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Não é possível iniciar a produção antes de gerar os QR Codes ou atribuir as placas manualmente ao pedido.',
    });
  }

  // Garante que existe ordem de fabricação
  let mfg = db.prepare('SELECT * FROM manufacturing_orders WHERE order_id = ?').get(id) as any;
  if (!mfg) {
    const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO manufacturing_orders (
        id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 'em_producao')
    `).run(mfgId, id, order.origem, order.quantidade_total);
    mfg = { id: mfgId };
  } else {
    db.prepare("UPDATE manufacturing_orders SET status = 'em_producao', updated_at = ? WHERE id = ?").run(now, mfg.id);
  }

  // Atualiza todas as placas do pedido para 'em_producao'
  db.prepare(`
    UPDATE plates 
    SET status_fisico = 'em_producao', data_fabricacao = COALESCE(data_fabricacao, ?), updated_at = ? 
    WHERE order_id = ? AND status_fisico IN ('planejada', 'produzida')
  `).run(now, now, id);

  // Atualiza pedido
  db.prepare("UPDATE orders SET status = 'em_producao', updated_at = ? WHERE id = ?").run(now, id);

  logAudit({
    usuario_id: adminId,
    acao: 'INICIO_PRODUCAO_PEDIDO',
    entidade: 'orders',
    entidade_id: id,
    dados_novos: { numero_pedido: order.numero_pedido, quantidade: order.quantidade_total },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Produção do pedido #${order.numero_pedido} iniciada com sucesso! Placas encaminhadas para fabricação.`,
  });
});

/**
 * Finalizar Produção de Todas as Placas do Pedido
 * Marca placas como 'aprovada', ordem como concluída e libera para despacho/retirada
 */
ordersRouter.post('/:id/finalize-production', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const now = new Date().toISOString();

  // Marca todas as placas como aprovadas (prontas para entrega/despacho)
  db.prepare(`
    UPDATE plates 
    SET status_fisico = 'aprovada', updated_at = ? 
    WHERE order_id = ? AND status_fisico != 'liberada'
  `).run(now, id);

  // Atualiza manufacturing_orders
  db.prepare(`
    UPDATE manufacturing_orders 
    SET status = 'producao_concluida', quantidade_produzida = quantidade_solicitada, quantidade_aprovada = quantidade_solicitada, updated_at = ?
    WHERE order_id = ?
  `).run(now, id);

  // Atualiza pedido
  db.prepare("UPDATE orders SET status = 'pago', updated_at = ? WHERE id = ?").run(now, id);

  // Atualiza status de logística correspondente
  if (order.modalidade_entrega === 'retirada') {
    db.prepare(`
      UPDATE order_logistics 
      SET retirada_status = 'pronta_para_retirada', updated_at = ? 
      WHERE order_id = ?
    `).run(now, id);
  } else {
    db.prepare(`
      UPDATE order_logistics 
      SET correios_status = 'aguardando_postagem', updated_at = ? 
      WHERE order_id = ?
    `).run(now, id);
  }

  logAudit({
    usuario_id: adminId,
    acao: 'FINALIZACAO_PRODUCAO_PEDIDO',
    entidade: 'orders',
    entidade_id: id,
    dados_novos: { numero_pedido: order.numero_pedido, status: 'pronto_para_logistica' },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Produção do pedido #${order.numero_pedido} finalizada! Placas prontas para ${order.modalidade_entrega === 'retirada' ? 'retirada no balcão' : 'despacho via Correios'}.`,
  });
});

/**
 * Confirmação Manual de Pagamento pelo Administrador (Recuperação de Carrinho / PIX Manual)
 */
ordersRouter.post('/:id/confirm-payment-manual', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;
  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem confirmar pagamentos manualmente.' });
  }

  const { id } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders 
    SET status = 'pago', updated_at = ?
    WHERE id = ?
  `).run(now, id);

  // Sincroniza tabela de pagamentos
  db.prepare(`
    UPDATE payments 
    SET status = 'CONFIRMED', data_confirmacao = ? 
    WHERE order_id = ?
  `).run(now, id);

  // REGRA: Pedido confirmado autoriza fabricação e inserção na esteira de produção
  const existingMfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(id);
  if (!existingMfg) {
    const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO manufacturing_orders (
        id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
    `).run(mfgId, id, order.origem, order.quantidade_total);
  }

  logAudit({
    usuario_id: adminId,
    acao: 'CONFIRMACAO_PAGAMENTO_MANUAL',
    entidade: 'orders',
    entidade_id: id,
    dados_novos: { numero_pedido: order.numero_pedido, confirmado_por: admin.nome },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Pagamento do pedido #${order.numero_pedido} confirmado com sucesso!`,
  });
});

/**
 * Exclusão Total do Pedido no Banco de Dados
 * Disponível para o Administrador em todas as fases da esteira.
 * Opção reaproveitar_placas: se true, desvincula as placas geradas tornando-as estoque livre.
 * Se false, apaga as placas definitivamente do banco.
 */
ordersRouter.delete('/:id', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;
  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem excluir pedidos.' });
  }

  const { id } = req.params;
  const { reaproveitar_placas = true } = req.body || {};

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const platesLinked = db.prepare('SELECT id, codigo_sequencial FROM plates WHERE order_id = ?').all(id) as any[];

  if (reaproveitar_placas && platesLinked.length > 0) {
    // Desvincula as placas do pedido para aproveitamento no estoque livre
    db.prepare(`
      UPDATE plates 
      SET order_id = NULL, manufacturing_order_id = NULL, revendedor_id = NULL,
          nome_estabelecimento = NULL, categoria_estabelecimento = NULL,
          contato_nome = NULL, contato_telefone = NULL, url_destino = NULL,
          status_digital = 'inativa', updated_at = datetime('now')
      WHERE order_id = ?
    `).run(id);
  } else if (platesLinked.length > 0) {
    // Exclui inspeções vinculadas e placas
    for (const plate of platesLinked) {
      db.prepare('DELETE FROM inspections WHERE plate_id = ?').run(plate.id);
    }
    db.prepare('DELETE FROM plates WHERE order_id = ?').run(id);
  }

  // Exclui pagamentos e eventos de webhook associados
  const payments = db.prepare('SELECT asaas_payment_id FROM payments WHERE order_id = ?').all(id) as any[];
  for (const pay of payments) {
    if (pay.asaas_payment_id) {
      db.prepare('DELETE FROM webhook_events WHERE event_id = ?').run(pay.asaas_payment_id);
    }
  }
  db.prepare('DELETE FROM payments WHERE order_id = ?').run(id);

  // Exclui ordem de fabricação, logística e o pedido
  db.prepare('DELETE FROM manufacturing_orders WHERE order_id = ?').run(id);
  db.prepare('DELETE FROM order_logistics WHERE order_id = ?').run(id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);

  logAudit({
    usuario_id: adminId,
    acao: 'EXCLUSAO_TOTAL_PEDIDO',
    entidade: 'orders',
    entidade_id: id,
    dados_anteriores: {
      numero_pedido: order.numero_pedido,
      quantidade_total: order.quantidade_total,
      valor_total: order.valor_total,
      origem: order.origem,
      status: order.status,
      placas_vinculadas: platesLinked.length,
      reaproveitou_placas: Boolean(reaproveitar_placas),
    },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Pedido #${order.numero_pedido} totalmente excluído do banco de dados com sucesso.${reaproveitar_placas && platesLinked.length > 0 ? ` As ${platesLinked.length} placas foram devolvidas ao estoque livre.` : ''}`,
  });
});

/**
 * Exclusão em Massa de Pedidos no Banco de Dados (Exclusivo Aba Todos os Pedidos)
 * Recebe lista de order_ids e opção reaproveitar_placas.
 */
ordersRouter.post('/bulk-delete', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(adminId) as any;
  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem excluir pedidos em lote.' });
  }

  const { order_ids, reaproveitar_placas = true } = req.body || {};

  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nenhum pedido selecionado para exclusão.' });
  }

  const deletedOrdersInfo: any[] = [];
  let totalPlacasDevolvidas = 0;
  let totalPlacasExcluidas = 0;

  for (const id of order_ids) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined;
    if (!order) continue;

    const platesLinked = db.prepare('SELECT id, codigo_sequencial FROM plates WHERE order_id = ?').all(id) as any[];

    if (reaproveitar_placas && platesLinked.length > 0) {
      db.prepare(`
        UPDATE plates 
        SET order_id = NULL, manufacturing_order_id = NULL, revendedor_id = NULL,
            nome_estabelecimento = NULL, categoria_estabelecimento = NULL,
            contato_nome = NULL, contato_telefone = NULL, url_destino = NULL,
            status_digital = 'inativa', updated_at = datetime('now')
        WHERE order_id = ?
      `).run(id);
      totalPlacasDevolvidas += platesLinked.length;
    } else if (platesLinked.length > 0) {
      for (const plate of platesLinked) {
        db.prepare('DELETE FROM inspections WHERE plate_id = ?').run(plate.id);
      }
      db.prepare('DELETE FROM plates WHERE order_id = ?').run(id);
      totalPlacasExcluidas += platesLinked.length;
    }

    const payments = db.prepare('SELECT asaas_payment_id FROM payments WHERE order_id = ?').all(id) as any[];
    for (const pay of payments) {
      if (pay.asaas_payment_id) {
        db.prepare('DELETE FROM webhook_events WHERE event_id = ?').run(pay.asaas_payment_id);
      }
    }
    db.prepare('DELETE FROM payments WHERE order_id = ?').run(id);

    db.prepare('DELETE FROM manufacturing_orders WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM order_logistics WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);

    deletedOrdersInfo.push({
      id: order.id,
      numero_pedido: order.numero_pedido,
      quantidade_total: order.quantidade_total,
    });
  }

  logAudit({
    usuario_id: adminId,
    acao: 'EXCLUSAO_EM_MASSA_PEDIDOS',
    entidade: 'orders',
    entidade_id: 'bulk',
    dados_novos: {
      total_excluidos: deletedOrdersInfo.length,
      pedidos: deletedOrdersInfo,
      reaproveitou_placas: Boolean(reaproveitar_placas),
      totalPlacasDevolvidas,
      totalPlacasExcluidas,
    },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    total_excluidos: deletedOrdersInfo.length,
    mensagem: `${deletedOrdersInfo.length} pedidos foram totalmente excluídos do banco de dados.${reaproveitar_placas && totalPlacasDevolvidas > 0 ? ` ${totalPlacasDevolvidas} placas foram devolvidas ao estoque livre.` : ''}`,
  });
});


