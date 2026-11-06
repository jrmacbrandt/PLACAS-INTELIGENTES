import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import { AsaasService } from '../services/asaas.js';
import type { Order, Payment, Profile } from '../types.js';

export const paymentsRouter = Router();

/**
 * Consulta status da integração Asaas (para interface administrativa)
 */
paymentsRouter.get('/integration-status', (_req, res) => {
  res.json({
    sucesso: true,
    configurado: AsaasService.isConfigured(),
    ambiente: process.env.ASAAS_ENVIRONMENT || 'sandbox',
    webhook_token_configurado: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
    base_url: AsaasService.getBaseUrl(),
  });
});

/**
 * Consulta cobrança do pedido ou gera cobrança Asaas (Real ou Sandbox Resiliente)
 */
paymentsRouter.get('/order/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(order.revendedor_id) as Profile | undefined;
  let payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId) as Payment | undefined;

  // Se ainda não existir cobrança criada no Asaas, gera registro associado via serviço
  if (!payment) {
    try {
      const asaasResult = await AsaasService.createOrGetPayment(order, profile, 'PIX');

      db.prepare(`
        INSERT INTO payments (
          id, order_id, asaas_payment_id, valor, forma_pagamento, status,
          pix_qrcode_url, pix_copia_cola, boleto_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        asaasResult.id,
        orderId,
        asaasResult.asaas_payment_id,
        order.valor_total,
        asaasResult.forma_pagamento,
        order.status === 'pago' ? 'CONFIRMED' : 'PENDING',
        asaasResult.pix_qrcode_url || null,
        asaasResult.pix_copia_cola || null,
        asaasResult.boleto_url || null
      );

      payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(asaasResult.id) as unknown as Payment;
    } catch (err: any) {
      console.error('[Payments] Erro ao instanciar cobrança Asaas:', err);
    }
  }

  res.json({ sucesso: true, pagamento: payment, pedido: order });
});

/**
 * Cria sessão de Asaas Checkout Hospedado (Cartão / Boleto / Pix - PCI-DSS Compliant)
 */
paymentsRouter.post('/checkout/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(order.revendedor_id) as Profile | undefined;
  const appUrl = process.env.APP_URL || 'https://placasinteligentes.vercel.app';

  try {
    const checkout = await AsaasService.createCheckoutSession({
      order,
      profile,
      appUrl,
    });

    res.json({ sucesso: true, checkout, pedido: order });
  } catch (err: any) {
    console.error('[Payments] Erro ao criar Checkout Asaas:', err);
    res.status(500).json({ sucesso: false, mensagem: err?.message || 'Erro ao gerar sessão do Checkout Asaas.' });
  }
});

/**
 * Endpoint de Consulta Rápida de Status (para Auto-Refresh e Polling da UI)
 */
paymentsRouter.get('/status/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT id, status, updated_at FROM orders WHERE id = ?').get(orderId) as { id: string; status: string; updated_at: string } | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const isPaid = order.status === 'pago' || order.status === 'concluido' || order.status === 'em_producao';
  res.json({
    sucesso: true,
    order_id: order.id,
    status: order.status,
    is_paid: isPaid,
  });
});

/**
 * Simulação Segura de Pagamento (Ambiente Homologação / Sandbox)
 * Dispara a transição interna com as mesmas regras do Webhook
 */
paymentsRouter.post('/simulate-pay', (req, res) => {
  const { order_id } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  if (order.status === 'pago' || order.status === 'concluido') {
    return res.json({ sucesso: true, mensagem: 'Pedido já se encontra pago.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders SET status = 'pago', updated_at = ? WHERE id = ?
  `).run(now, order_id);

  db.prepare(`
    UPDATE payments SET status = 'CONFIRMED', data_confirmacao = ? WHERE order_id = ?
  `).run(now, order_id);

  // REGRA INEGOCIÁVEL: Pedido pago autoriza fabricação sob demanda
  const existingMfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(order_id);
  if (!existingMfg) {
    const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO manufacturing_orders (
        id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
    `).run(mfgId, order_id, order.origem, order.quantidade_total);
  }

  logAudit({
    usuario_id: order.revendedor_id,
    acao: 'CONFIRMACAO_PAGAMENTO_SIMULADO',
    entidade: 'orders',
    entidade_id: order_id,
    dados_novos: { status: 'pago', valor: order.valor_total },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: 'Pagamento confirmado com sucesso! Pedido autorizado para a fila de fabricação.',
  });
});

/**
 * Simulação de Disparo de Webhook Asaas (para testes de ponta a ponta sem dinheiro real)
 */
paymentsRouter.post('/simulate-webhook/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Order | undefined;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  let payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId) as Payment | undefined;
  const asaasPaymentId = payment?.asaas_payment_id || `pay_asaas_${crypto.randomUUID().slice(0, 10)}`;

  const mockWebhook = AsaasService.createMockWebhookPayload(order, asaasPaymentId, 'PAYMENT_RECEIVED');

  // Encaminha internamente para o processador de webhook
  const eventId = mockWebhook.id;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO webhook_events (id, event_id, evento, payload, processado, sucesso)
    VALUES (?, ?, ?, ?, 1, 1)
  `).run(`wh_${crypto.randomUUID().slice(0, 8)}`, eventId, mockWebhook.event, JSON.stringify(mockWebhook));

  db.prepare("UPDATE orders SET status = 'pago', updated_at = ? WHERE id = ?").run(now, orderId);
  db.prepare("UPDATE payments SET status = 'CONFIRMED', data_confirmacao = ? WHERE order_id = ?").run(now, orderId);

  // Insere na fila de fabricação
  const existingMfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(orderId);
  if (!existingMfg) {
    const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO manufacturing_orders (
        id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
      ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
    `).run(mfgId, orderId, order.origem, order.quantidade_total);
  }

  logAudit({
    usuario_id: null,
    acao: 'WEBHOOK_ASAAS_TESTE_PROCESSADO',
    entidade: 'orders',
    entidade_id: orderId,
    dados_novos: { eventType: 'PAYMENT_RECEIVED', asaasPaymentId },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Webhook Asaas simulado com sucesso! O pedido #${order.numero_pedido} foi marcado como Pago automaticamente.`,
  });
});

/**
 * Endpoint Oficial de Webhook do Asaas (Suporta Pix, Cartão de Crédito e Cartão de Débito)
 * Valida cabeçalho 'asaas-access-token', idempotência com event_id e transições atômicas
 */
paymentsRouter.post('/webhook', (req, res) => {
  const tokenHeader = (req.headers['asaas-access-token'] as string) || '';

  // 1. Validação do Token de Segurança do Webhook
  if (!AsaasService.validateWebhookAuth(tokenHeader)) {
    console.warn('[Asaas Webhook] Tentativa não autorizada: Token inválido.');
    return res.status(401).json({ status: 'unauthorized', mensagem: 'Token de webhook inválido.' });
  }

  const event = req.body;
  const eventId = event?.id || `evt_${crypto.randomUUID()}`;
  const eventType = event?.event;
  const paymentData = event?.payment;

  // 2. Verificação de Idempotência
  const existingEvent = db.prepare('SELECT id, processado FROM webhook_events WHERE event_id = ?').get(eventId) as { id: string; processado: number } | undefined;
  
  if (existingEvent && existingEvent.processado === 1) {
    return res.status(200).json({ status: 'ignored', motivo: 'Evento já processado anteriormente.' });
  }

  // Registra recebimento do evento
  const dbEventId = `wh_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO webhook_events (id, event_id, evento, payload, processado, sucesso)
    VALUES (?, ?, ?, ?, 0, 0)
  `).run(dbEventId, eventId, eventType || 'UNKNOWN', JSON.stringify(event));

  try {
    // 3. Processa eventos de confirmação ou recebimento (Pix, Cartão de Crédito ou Débito)
    const isApprovalEvent = 
      eventType === 'PAYMENT_RECEIVED' ||
      eventType === 'PAYMENT_CONFIRMED' ||
      eventType === 'PAYMENT_AUTHORIZED';

    if (isApprovalEvent) {
      const asaasPaymentId = paymentData?.id;
      const externalRef = paymentData?.externalReference;
      
      // Busca pelo ID do pagamento Asaas OU pelo externalReference (ID do pedido)
      let orderId: string | null = null;

      if (asaasPaymentId) {
        const payment = db.prepare('SELECT order_id FROM payments WHERE asaas_payment_id = ?').get(asaasPaymentId) as { order_id: string } | undefined;
        if (payment) orderId = payment.order_id;
      }

      if (!orderId && externalRef) {
        const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(externalRef) as { id: string } | undefined;
        if (order) orderId = order.id;
      }

      if (orderId) {
        const now = new Date().toISOString();

        db.prepare("UPDATE orders SET status = 'pago', updated_at = ? WHERE id = ?").run(now, orderId);
        
        if (asaasPaymentId) {
          db.prepare("UPDATE payments SET status = 'CONFIRMED', data_confirmacao = ? WHERE asaas_payment_id = ? OR order_id = ?").run(now, asaasPaymentId, orderId);
        } else {
          db.prepare("UPDATE payments SET status = 'CONFIRMED', data_confirmacao = ? WHERE order_id = ?").run(now, orderId);
        }

        // Insere na fila de fabricação
        const existingMfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(orderId);
        if (!existingMfg) {
          const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as unknown as Order;
          const mfgId = `mfg_${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(`
            INSERT INTO manufacturing_orders (
              id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
            ) VALUES (?, ?, ?, ?, 0, 0, 0, 'aguardando_producao')
          `).run(mfgId, orderId, order.origem, order.quantidade_total);
        }

        logAudit({
          usuario_id: null,
          acao: 'WEBHOOK_ASAAS_PROCESSADO',
          entidade: 'orders',
          entidade_id: orderId,
          dados_novos: { eventType, asaasPaymentId, billingType: paymentData?.billingType },
          ip_origem: req.ip,
        });

        console.log(`[Asaas Webhook] Pedido ${orderId} aprovado com sucesso via ${paymentData?.billingType || 'Asaas'} (${eventType})!`);
      }
    }

    db.prepare('UPDATE webhook_events SET processado = 1, sucesso = 1 WHERE id = ?').run(dbEventId);
    res.status(200).json({ status: 'ok', recebido: true });
  } catch (err: any) {
    console.error('[Asaas Webhook] Erro ao processar:', err);
    db.prepare('UPDATE webhook_events SET processado = 1, sucesso = 0, mensagem_erro = ? WHERE id = ?').run(err?.message, dbEventId);
    res.status(500).json({ status: 'error', mensagem: err?.message });
  }
});
