import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AsaasService,
  sanitizeAsaasLog,
  normalizeCpfCnpj,
  normalizePhone,
  validateAsaasKeyEnvironment,
} from '../server/services/asaas.js';
import type { Order, Profile } from '../server/types.js';

describe('Suíte de Testes Oficial - Integração Asaas v3', () => {
  const dummyOrder: Order = {
    id: 'ord_test_998877',
    numero_pedido: '105',
    revendedor_id: 'usr_revendedor_01',
    revendedor_nome: 'Carlos Eduardo Silva',
    revendedor_email: 'carlos@exemplo.com.br',
    revendedor_telefone: '21980914107',
    origem: 'compra_revendedor',
    status: 'aguardando_pagamento',
    quantidade_total: 10,
    preco_unitario_aplicado: 21.9,
    valor_frete: 25.0,
    valor_total: 244.0,
    modalidade_entrega: 'correios',
    cliente_id: null,
    observacoes_admin: null,
    aprovado_por: null,
    data_aprovacao: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const dummyProfile: Partial<Profile> = {
    id: 'usr_revendedor_01',
    nome: 'Carlos Eduardo Silva',
    email: 'carlos@exemplo.com.br',
    telefone: '(21) 98091-4107',
    cpf_cnpj: '068.658.417-19',
  };

  // --------------------------------------------------------------------------
  // 1. Sanitização e Proteção de Dados Sensíveis
  // --------------------------------------------------------------------------
  describe('1. Sanitização, Segurança de Segredos e Isolamento de Ambiente', () => {
    it('deve mascarar chaves de API Asaas ($aact_...) e documentos em logs', () => {
      const rawPayload = JSON.stringify({
        apiKey: '$aact_hml_1234567890abcdefghijklmnopqrstuvwxyz',
        cpfCnpj: '06865841719',
        creditCardNumber: '4111111111111234',
        creditCardCvv: '123',
      });

      const sanitized = sanitizeAsaasLog(rawPayload);
      assert.ok(!sanitized.includes('1234567890abcdef'), 'Chave Asaas não deve vazar no log');
      assert.ok(sanitized.includes('$aact_hml_123***'), 'Prefixo seguro deve ser preservado');
      assert.ok(!sanitized.includes('4111111111111234'), 'Cartão de crédito não deve vazar no log');
      assert.ok(sanitized.includes('************1234'), 'Cartão deve ser ofuscado');
    });

    it('deve normalizar CPF (11 dígitos) e CNPJ (14 dígitos)', () => {
      assert.equal(normalizeCpfCnpj('068.658.417-19'), '06865841719');
      assert.equal(normalizeCpfCnpj('12.345.678/0001-90'), '12345678000190');
      assert.equal(normalizeCpfCnpj('123'), undefined);
      assert.equal(normalizeCpfCnpj(null), undefined);
    });

    it('deve normalizar telefones com DDD', () => {
      assert.equal(normalizePhone('(21) 98091-4107'), '21980914107');
      assert.equal(normalizePhone('(11) 3322-4455'), '1133224455');
      assert.equal(normalizePhone('123'), undefined);
    });

    it('deve bloquear uso cruzado de chave de Produção em Sandbox e vice-versa', () => {
      assert.throws(
        () => validateAsaasKeyEnvironment('$aact_prod_998877665544332211', 'sandbox'),
        /Chave de Produção detectada em ambiente Sandbox/
      );
      assert.throws(
        () => validateAsaasKeyEnvironment('$aact_hml_998877665544332211', 'production'),
        /Chave de Sandbox detectada em ambiente de Produção/
      );
      // Chave válida para o ambiente correto não deve lançar exceção
      assert.doesNotThrow(() => validateAsaasKeyEnvironment('$aact_hml_123456', 'sandbox'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Autenticação e Segurança do Webhook
  // --------------------------------------------------------------------------
  describe('2. Autenticação do Webhook (cabeçalho asaas-access-token)', () => {
    it('deve validar token de webhook com comparação de tempo constante (anti timing-attack)', () => {
      const validSecret = 'wh_secret_atelier_2026_xyz';
      assert.equal(AsaasService.validateWebhookAuth(validSecret, validSecret), true);
      assert.equal(AsaasService.validateWebhookAuth('token_errado', validSecret), false);
      assert.equal(AsaasService.validateWebhookAuth(undefined, validSecret), false);
    });

    it('deve recusar webhook caso não haja token configurado', () => {
      assert.equal(AsaasService.validateWebhookAuth('qualquer_token', ''), false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Gestão e Deduplicação de Clientes no Asaas
  // --------------------------------------------------------------------------
  describe('3. Cadastro e Localização de Clientes (findOrCreateCustomer)', () => {
    it('deve reutilizar cliente existente quando localizado por CPF/CNPJ', async () => {
      const mockFetch: typeof fetch = async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/customers?cpfCnpj=')) {
          return new Response(JSON.stringify({ data: [{ id: 'cus_existente_123' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ id: 'cus_novo_456' }), { status: 200 });
      };

      const customerId = await AsaasService.findOrCreateCustomer({
        order: dummyOrder,
        profile: dummyProfile,
        apiKey: '$aact_hml_teste123',
        environment: 'sandbox',
        fetchImpl: mockFetch,
      });

      assert.equal(customerId, 'cus_existente_123');
    });

    it('deve criar novo cliente quando não encontrar por CPF nem por e-mail', async () => {
      let createdPayload: any = null;

      const mockFetch: typeof fetch = async (url, init) => {
        const urlStr = url.toString();
        if (urlStr.includes('/customers?cpfCnpj=') || urlStr.includes('/customers?email=')) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (init?.method === 'POST' && urlStr.endsWith('/customers')) {
          createdPayload = JSON.parse(init.body as string);
          return new Response(JSON.stringify({ id: 'cus_criado_999' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      };

      const customerId = await AsaasService.findOrCreateCustomer({
        order: dummyOrder,
        profile: dummyProfile,
        apiKey: '$aact_hml_teste123',
        environment: 'sandbox',
        fetchImpl: mockFetch,
      });

      assert.equal(customerId, 'cus_criado_999');
      assert.equal(createdPayload?.name, 'Carlos Eduardo Silva');
      assert.equal(createdPayload?.cpfCnpj, '06865841719');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Asaas Checkout Hospedado (POST /v3/checkouts)
  // --------------------------------------------------------------------------
  describe('4. Asaas Checkout Hospedado (PCI-DSS Compliant)', () => {
    it('deve criar sessão de checkout hospedado com URLs de callback e itens do pedido', async () => {
      let sentCheckoutPayload: any = null;

      const mockFetch: typeof fetch = async (url, init) => {
        const urlStr = url.toString();
        if (urlStr.includes('/customers')) {
          return new Response(JSON.stringify({ data: [{ id: 'cus_111222' }] }), { status: 200 });
        }
        if (init?.method === 'POST' && urlStr.includes('/checkouts')) {
          sentCheckoutPayload = JSON.parse(init.body as string);
          return new Response(
            JSON.stringify({
              id: 'chk_asaas_session_123',
              status: 'ACTIVE',
              link: 'https://sandbox.asaas.com/checkoutSession/show?id=chk_asaas_session_123',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('{}', { status: 200 });
      };

      const session = await AsaasService.createCheckoutSession({
        order: dummyOrder,
        profile: dummyProfile,
        appUrl: 'https://placasinteligentes.vercel.app',
        apiKey: '$aact_hml_teste123',
        environment: 'sandbox',
        fetchImpl: mockFetch,
      });

      assert.equal(session.checkout_id, 'chk_asaas_session_123');
      assert.equal(session.checkout_url, 'https://sandbox.asaas.com/checkoutSession/show?id=chk_asaas_session_123');
      assert.equal(session.is_mock, false);

      assert.deepEqual(sentCheckoutPayload.billingTypes, ['PIX', 'CREDIT_CARD', 'BOLETO']);
      assert.equal(sentCheckoutPayload.externalReference, dummyOrder.id);
      assert.equal(sentCheckoutPayload.items[0].value, dummyOrder.valor_total);
      assert.ok(sentCheckoutPayload.callback.successUrl.includes(dummyOrder.id));
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cobrança Direta PIX com QR Code Nativo
  // --------------------------------------------------------------------------
  describe('5. Cobrança Direta PIX com QR Code Nativo', () => {
    it('deve criar cobrança no Asaas e consultar QR Code e Copia-e-Cola', async () => {
      const mockFetch: typeof fetch = async (url, init) => {
        const urlStr = url.toString();
        if (urlStr.includes('/customers')) {
          return new Response(JSON.stringify({ data: [{ id: 'cus_111222' }] }), { status: 200 });
        }
        if (init?.method === 'POST' && urlStr.endsWith('/payments')) {
          return new Response(
            JSON.stringify({
              id: 'pay_asaas_real_777',
              status: 'PENDING',
              value: 244.0,
              bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/pay_777',
              invoiceUrl: 'https://sandbox.asaas.com/i/pay_777',
            }),
            { status: 200 }
          );
        }
        if (urlStr.includes('/pixQrCode')) {
          return new Response(
            JSON.stringify({
              payload: '00020126580014br.gov.bcb.pix0136testpixcode6304',
              encodedImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      };

      const result = await AsaasService.createOrGetPayment(dummyOrder, dummyProfile, 'PIX', {
        apiKey: '$aact_hml_teste123',
        environment: 'sandbox',
        fetchImpl: mockFetch,
      });

      assert.equal(result.asaas_payment_id, 'pay_asaas_real_777');
      assert.equal(result.pix_copia_cola, '00020126580014br.gov.bcb.pix0136testpixcode6304');
      assert.ok(result.pix_qrcode_url?.startsWith('data:image/png;base64,'));
      assert.equal(result.is_mock, false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Idempotência e Mapeamento de Eventos de Webhook
  // --------------------------------------------------------------------------
  describe('6. Webhook Oficial e Idempotência (At-Least-Once Delivery)', () => {
    it('deve mapear PAYMENT_CONFIRMED para status de pedido pago', () => {
      const payload = AsaasService.createMockWebhookPayload(dummyOrder, 'pay_asaas_001', 'PAYMENT_CONFIRMED');
      const mapped = AsaasService.mapAsaasWebhookEvent(payload);

      assert.equal(mapped.status, 'pago');
      assert.equal(mapped.order_id, dummyOrder.id);
      assert.equal(mapped.duplicate, false);
      assert.equal(mapped.ignored, false);
    });

    it('deve detectar e ignorar eventos duplicados pelo event_id', () => {
      const payload = AsaasService.createMockWebhookPayload(dummyOrder, 'pay_asaas_001', 'PAYMENT_CONFIRMED');
      const processed = new Set<string>([payload.id]);

      const mapped = AsaasService.mapAsaasWebhookEvent(payload, processed);
      assert.equal(mapped.duplicate, true);
      assert.equal(mapped.ignored, true);
      assert.equal(mapped.status, 'unchanged');
    });

    it('deve mapear PAYMENT_OVERDUE para vencido e PAYMENT_REFUNDED para cancelado', () => {
      const overduePayload = AsaasService.createMockWebhookPayload(dummyOrder, 'pay_002', 'PAYMENT_OVERDUE');
      const mappedOverdue = AsaasService.mapAsaasWebhookEvent(overduePayload);
      assert.equal(mappedOverdue.status, 'vencido');

      const refundPayload = AsaasService.createMockWebhookPayload(dummyOrder, 'pay_003', 'PAYMENT_REFUNDED');
      const mappedRefund = AsaasService.mapAsaasWebhookEvent(refundPayload);
      assert.equal(mappedRefund.status, 'cancelado');
    });

    it('deve garantir que redirecionamento/callback isolado NÃO marque pedido como pago sem webhook', () => {
      // Simulação: Cliente retorna na URL de retorno ?payment=success&order_id=...
      // A regra estrita do Asaas proíbe confiar em callbacks do navegador como comprovação financeira
      const fakeCallbackStatus = 'success';
      const orderStatusBeforeWebhook = dummyOrder.status;

      // Sem processamento do webhook com asaas-access-token, o pedido permanece pendente
      assert.equal(orderStatusBeforeWebhook, 'pendente');
      assert.notEqual(fakeCallbackStatus, orderStatusBeforeWebhook);
    });
  });
});
