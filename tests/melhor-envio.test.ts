import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizeCep,
  classifyAndValidateDocument,
  normalizePhone,
  validateVolumes,
  createOAuthState,
  verifyOAuthState,
  buildOAuthAuthorizeUrl,
  exchangeAuthorizationCode,
  refreshAccessTokenSingleFlight,
  checkAndRecordRateLimit,
  resetRateLimiterForTests,
  verifyMelhorEnvioWebhookSignature,
  mapWebhookEventToLogisticsStatus,
  maskSecret,
  isMaskedSecretValue,
  sanitizeForLog,
  buildCalculatePayload,
  parseMelhorEnvioCalculateResponse,
  buildCartPayload,
  addShipmentToCart,
  checkoutShipmentOrders,
  generateShipmentLabels,
  printShipmentLabels,
  trackShipments,
  checkAndCancelShipmentOrder,
  generateShippingLabel,
  MelhorEnvioError,
} from '../server/services/melhor-envio.js';
import { calculateDynamicPackage } from '../src/utils/shippingCalculator.js';

describe('Suíte de Testes Oficial - Integração Melhor Envio v2', () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  // --------------------------------------------------------------------------
  // 1. Sanitização, Segurança de Segredos e Isolamento de Ambiente
  // --------------------------------------------------------------------------
  describe('1. Segurança, Sanitização e Mascaramento', () => {
    it('deve mascarar segredos para exibição segura no frontend', () => {
      assert.equal(maskSecret(''), '');
      assert.equal(maskSecret('curto'), '••••••••');
      assert.equal(maskSecret('me_token_producao_1234567890'), '••••••••••••7890');
      assert.equal(isMaskedSecretValue('••••••••••••7890'), true);
      assert.equal(isMaskedSecretValue('me_novo_token_1234'), false);
    });

    it('deve sanitizar tokens, client_secret e documentos para registros em logs', () => {
      const payload = {
        melhor_envio_token: 'Bearer super_secret_token_123',
        client_secret: 'segredo_app_456',
        document: '06865841719',
        name: 'Cliente Teste',
      };
      const sanitized = sanitizeForLog(payload) as any;
      assert.equal(sanitized.melhor_envio_token, '[REDACTED_SECRET]');
      assert.equal(sanitized.client_secret, '[REDACTED_SECRET]');
      assert.equal(sanitized.document, '***19');
      assert.equal(sanitized.name, 'Cliente Teste');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Validação e Normalização de Entradas (CEP, CPF/CNPJ, Telefones, Volumes)
  // --------------------------------------------------------------------------
  describe('2. Validação e Normalização de Dados', () => {
    it('deve normalizar CEPs com 8 dígitos e rejeitar CEPs inválidos', () => {
      assert.equal(normalizeCep('22745-271'), '22745271');
      assert.equal(normalizeCep('01310 100'), '01310100');
      assert.throws(() => normalizeCep('123'), /CEP.*inválido/i);
      assert.throws(() => normalizeCep('00000-000'), /CEP.*inválido/i);
    });

    it('deve validar CPF (11 dígitos) e CNPJ (14 dígitos)', () => {
      // CPF válido (José Roberto): 068.658.417-19
      const cpfResult = classifyAndValidateDocument('06865841719', 'CPF');
      assert.equal(cpfResult.type, 'cpf');
      assert.equal(cpfResult.clean, '06865841719');

      // CPF com todos os dígitos iguais deve falhar
      assert.throws(() => classifyAndValidateDocument('11111111111'), (err: any) => err instanceof MelhorEnvioError && err.code === 'INVALID_CPF');
      assert.throws(() => classifyAndValidateDocument('12345'), (err: any) => err instanceof MelhorEnvioError && err.code === 'MISSING_DOCUMENT');
    });

    it('deve normalizar telefones no formato DDD + número', () => {
      assert.equal(normalizePhone('(21) 98091-4107'), '21980914107');
      assert.equal(normalizePhone('+55 21 98091-4107'), '21980914107');
      assert.throws(() => normalizePhone('123'), /Telefone.*inválido/i);
    });

    it('deve validar limites físicos de dimensões (cm) e peso (kg) dos volumes', () => {
      const valid = validateVolumes([{ height: 10, width: 15, length: 20, weight: 0.5 }]);
      assert.equal(valid.length, 1);
      assert.equal(valid[0].height, 10);
      assert.equal(valid[0].weight, 0.5);

      // Largura mínima no Melhor Envio é 8cm
      assert.throws(() => validateVolumes([{ height: 10, width: 5, length: 20, weight: 0.5 }]), /Largura inválida/i);
      // Comprimento mínimo no Melhor Envio é 13cm
      assert.throws(() => validateVolumes([{ height: 10, width: 15, length: 10, weight: 0.5 }]), /Comprimento inválido/i);
      // Peso deve ser > 0 kg
      assert.throws(() => validateVolumes([{ height: 10, width: 15, length: 20, weight: 0 }]), /Peso inválido/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. OAuth2 Authorization Code, Anti-CSRF State e Concorrência Single-Flight
  // --------------------------------------------------------------------------
  describe('3. OAuth2 e Mutex Lock de Renovação de Token', () => {
    it('deve gerar e verificar state anti-CSRF com expiração e ambiente', () => {
      const secret = 'chave_teste_oauth_secret';
      const state = createOAuthState(secret, 'sandbox');
      const validRes = verifyOAuthState(state, secret, 'sandbox');
      assert.equal(validRes.valid, true);
      assert.equal(validRes.environment, 'sandbox');

      // State adulterado deve ser rejeitado
      const tampered = state.slice(0, -3) + 'abc';
      const invalidRes = verifyOAuthState(tampered, secret);
      assert.equal(invalidRes.valid, false);

      // State para ambiente divergente deve falhar
      const mismatchRes = verifyOAuthState(state, secret, 'production');
      assert.equal(mismatchRes.valid, false);
    });

    it('deve construir URL oficial de autorização OAuth2 com escopos obrigatórios', () => {
      const url = buildOAuthAuthorizeUrl({
        clientId: '1234',
        redirectUri: 'https://exemplo.com/callback',
        environment: 'sandbox',
        state: 'state_123',
      });
      assert.match(url, /https:\/\/sandbox\.melhorenvio\.com\.br\/oauth\/authorize/);
      assert.match(url, /client_id=1234/);
      assert.match(url, /shipping-calculate/);
      assert.match(url, /shipping-checkout/);
      assert.match(url, /cart-write/);
    });

    it('deve sincronizar concorrência em chamadas simultâneas de refresh (apenas 1 requisição HTTP)', async () => {
      let httpCallsCount = 0;
      const fakeFetch: any = async () => {
        httpCallsCount++;
        await new Promise((r) => setTimeout(r, 40));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new_access_token_abc',
            refresh_token: 'new_refresh_token_def',
            expires_in: 2592000,
          }),
        };
      };

      // Dispara 3 renovações simultâneas para o mesmo refresh token
      const p1 = refreshAccessTokenSingleFlight(
        {
          refreshToken: 'old_refresh_token_xyz',
          clientId: 'client_123',
          clientSecret: 'secret_456',
          environment: 'sandbox',
        },
        fakeFetch
      );
      const p2 = refreshAccessTokenSingleFlight(
        {
          refreshToken: 'old_refresh_token_xyz',
          clientId: 'client_123',
          clientSecret: 'secret_456',
          environment: 'sandbox',
        },
        fakeFetch
      );
      const p3 = refreshAccessTokenSingleFlight(
        {
          refreshToken: 'old_refresh_token_xyz',
          clientId: 'client_123',
          clientSecret: 'secret_456',
          environment: 'sandbox',
        },
        fakeFetch
      );

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      assert.equal(r1.access_token, 'new_access_token_abc');
      assert.equal(r2.access_token, 'new_access_token_abc');
      assert.equal(r3.access_token, 'new_access_token_abc');
      // Verificação da garantia de single-flight mutex: exatamente 1 chamada HTTP ocorreu
      assert.equal(httpCallsCount, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Rate Limiter (250 req/min)
  // --------------------------------------------------------------------------
  describe('4. Rate Limiter e Proteção de Requisições', () => {
    it('deve disparar erro 429 caso o limite de 250 req/min seja ultrapassado', () => {
      const now = Date.now();
      for (let i = 0; i < 250; i++) {
        checkAndRecordRateLimit('test_account', now, 250);
      }
      assert.throws(
        () => checkAndRecordRateLimit('test_account', now, 250),
        (err: any) => err instanceof MelhorEnvioError && err.statusCode === 429
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Cotação de Frete (com preferência a custom_price e custom_delivery_time)
  // --------------------------------------------------------------------------
  describe('5. Cotação de Frete (/api/v2/me/shipment/calculate)', () => {
    it('deve construir payload correto com volumes, seguro e serviços', () => {
      const pkg = calculateDynamicPackage(5);
      const payload = buildCalculatePayload({
        cepOrigem: '22745271',
        cepDestino: '01310100',
        pkg,
        quantidade: 5,
        valorUnitario: 21.9,
      });

      assert.equal(payload.from.postal_code, '22745271');
      assert.equal(payload.to.postal_code, '01310100');
      assert.equal(payload.volumes.length, 1);
      assert.equal(payload.options.insurance_value, 109.5);
    });

    it('deve priorizar custom_price e custom_delivery_time na resposta oficial', () => {
      const rawApi = [
        {
          id: 3,
          name: '.Package',
          price: '28.50',
          custom_price: '14.20', // Preço corporativo com desconto
          delivery_time: 6,
          custom_delivery_time: 4, // Prazo customizado mais ágil
          company: { name: 'Jadlog' },
        },
        {
          id: 1,
          name: 'PAC',
          price: '24.00',
          custom_price: '20.00',
          delivery_time: 7,
          custom_delivery_time: 5,
          company: { name: 'Correios' },
        },
      ];

      const options = parseMelhorEnvioCalculateResponse(rawApi);
      assert.equal(options.length, 2);
      assert.equal(options[0].price, 14.2);
      assert.equal(options[0].original_price, 28.5);
      assert.equal(options[0].delivery_time, 4);
      assert.equal(options[0].is_cheapest, true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Inserção no Carrinho, Trava de Checkout Explícito e Emissão
  // --------------------------------------------------------------------------
  describe('6. Carrinho e Trava Financeira de Checkout', () => {
    it('deve montar payload de carrinho completo com CPF/CNPJ, produto e dimensões', () => {
      const order = {
        id: 'ord_teste_123',
        numero_pedido: 'PED-202611-0099',
        quantidade_total: 10,
        preco_unitario_aplicado: 19.9,
      };
      const logistics = {
        servico_frete_id: 3,
        destinatario_nome: 'Carlos Revendedor',
        destinatario_cpf_cnpj: '23456789012',
        responsavel_retirada_telefone: '11977771234',
        cep: '01310-100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
      };

      const payload = buildCartPayload({
        order,
        logistics,
        validateCheckDigits: false,
      });

      assert.equal(payload.service, 3);
      assert.equal(payload.from.postal_code, '22745271');
      assert.equal(payload.to.postal_code, '01310100');
      assert.equal(payload.to.document, '23456789012');
      assert.equal(payload.options.non_commercial, true);
      assert.equal(payload.products[0].quantity, '10');
    });

    it('deve exigir explicitConfirmation === true para efetuar checkout de compra de frete', async () => {
      await assert.rejects(
        async () => {
          await checkoutShipmentOrders({
            orderIds: ['me_cart_123'],
            explicitConfirmation: false, // Trava de segurança
            settings: {},
          });
        },
        (err: any) => err instanceof MelhorEnvioError && err.code === 'EXPLICIT_CONFIRMATION_REQUIRED'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 7. Webhook Oficial: Validação HMAC-SHA256 (X-ME-Signature) e Idempotência
  // --------------------------------------------------------------------------
  describe('7. Webhook Oficial e Assinatura Criptográfica X-ME-Signature', () => {
    it('deve validar assinatura HMAC-SHA256 gerada com o app secret (Base64 e Hex)', () => {
      const secret = 'webhook_secret_super_seguro_999';
      const rawBody = JSON.stringify({
        event: 'order.posted',
        data: { id: 'me_ord_777', tracking: 'BR123456789ME' },
      });

      const validB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
      const validHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      assert.equal(verifyMelhorEnvioWebhookSignature(rawBody, validB64, secret), true);
      assert.equal(verifyMelhorEnvioWebhookSignature(rawBody, `sha256=${validHex}`, secret), true);

      // Assinatura inválida ou corpo adulterado deve falhar
      assert.equal(verifyMelhorEnvioWebhookSignature(rawBody, 'assinatura_falsa', secret), false);
      assert.equal(verifyMelhorEnvioWebhookSignature(rawBody + ' ', validB64, secret), false);
    });

    it('deve processar eventos de webhook de forma idempotente sem duplicar atualizações', () => {
      const cache = new Set<string>();
      const payload = {
        event: 'order.delivered',
        data: {
          id: 'me_ord_888',
          protocol: 'PROTO-888',
          tracking: 'BR987654321ME',
          updated_at: '2026-11-05T12:00:00Z',
        },
      };

      const firstProcess = mapWebhookEventToLogisticsStatus(payload, cache);
      assert.equal(firstProcess.ignored, false);
      assert.equal(firstProcess.duplicate, false);
      assert.equal(firstProcess.correios_status, 'entregue');
      assert.equal(firstProcess.tracking_code, 'BR987654321ME');

      // Segunda entrega repetida do mesmo evento
      const secondProcess = mapWebhookEventToLogisticsStatus(payload, cache);
      assert.equal(secondProcess.ignored, true);
      assert.equal(secondProcess.duplicate, true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Fluxo Orquestrado End-to-End no Painel
  // --------------------------------------------------------------------------
  describe('8. Fluxo Orquestrado no Painel Administrativo', () => {
    it('deve adicionar ao carrinho sem debitar saldo se não houver confirmação de checkout', async () => {
      const fakeFetch: any = async (url: string, opts: any) => {
        if (url.includes('/api/v2/me/cart')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 'cart_item_999', protocol: 'PRT-999' }),
          };
        }
        throw new Error(`URL inesperada: ${url}`);
      };

      const order = { id: 'ord_1', quantidade_total: 2, revendedor_telefone: '11988887777', revendedor_cpf_cnpj: '06865841719' };
      const logistics = { servico_frete_id: 3, cep: '01310100', logradouro: 'Rua A', bairro: 'B', cidade: 'SP', uf: 'SP', responsavel_retirada_telefone: '11988887777' };

      const result = await generateShippingLabel(order, logistics, {
        settings: {
          melhor_envio_token: 'token_oficial_mock_valido_12345',
        },
        explicitCheckoutConfirmation: false,
        fetchImpl: fakeFetch,
      });

      assert.equal(result.sucesso, true);
      assert.equal(result.status_etiqueta, 'no_carrinho');
      assert.equal(result.requer_confirmacao_checkout, true);
      assert.equal(result.cart_id, 'cart_item_999');
    });

    it('deve executar fluxo completo (cart -> checkout -> generate -> print -> tracking) quando explicitCheckoutConfirmation === true', async () => {
      const calls: string[] = [];
      const fakeFetch: any = async (url: string) => {
        calls.push(url);
        if (url.includes('/api/v2/me/cart')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ id: 'cart_full_123', protocol: 'PROTO-XYZ' }),
          };
        }
        if (url.includes('/api/v2/me/shipment/checkout')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ purchase: { id: 'pur_1' } }),
          };
        }
        if (url.includes('/api/v2/me/shipment/generate')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ generate_key: 'gen_1' }),
          };
        }
        if (url.includes('/api/v2/me/shipment/print')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ url: 'https://sandbox.melhorenvio.com.br/etiqueta.pdf' }),
          };
        }
        if (url.includes('/api/v2/me/shipment/tracking')) {
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ cart_full_123: { tracking: 'BR999888777ME' } }),
          };
        }
        return { ok: true, status: 200, text: async () => '{}' };
      };

      const order = { id: 'ord_completo', quantidade_total: 5, revendedor_telefone: '11988887777', revendedor_cpf_cnpj: '06865841719' };
      const logistics = { servico_frete_id: 3, cep: '01310100', logradouro: 'Rua A', bairro: 'B', cidade: 'SP', uf: 'SP', responsavel_retirada_telefone: '11988887777' };

      const result = await generateShippingLabel(order, logistics, {
        settings: {
          melhor_envio_token: 'token_oficial_mock_valido_12345',
        },
        explicitCheckoutConfirmation: true, // Operador autorizou compra
        fetchImpl: fakeFetch,
      });

      assert.equal(result.sucesso, true);
      assert.equal(result.status_etiqueta, 'gerada');
      assert.equal(result.codigo_rastreamento, 'BR999888777ME');
      assert.equal(result.etiqueta_url, 'https://sandbox.melhorenvio.com.br/etiqueta.pdf');
      assert.equal(calls.some((u) => u.includes('/checkout')), true);
      assert.equal(calls.some((u) => u.includes('/generate')), true);
      assert.equal(calls.some((u) => u.includes('/print')), true);
    });
  });
});
