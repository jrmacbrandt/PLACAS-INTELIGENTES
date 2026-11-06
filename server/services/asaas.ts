import crypto from 'node:crypto';
import type { Order, Profile } from '../types.js';

export type AsaasEnvironment = 'sandbox' | 'production';

export const ASAAS_BASE_URLS: Record<AsaasEnvironment, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
};

export const DEFAULT_ASAAS_USER_AGENT = 'AtelierDasPlacas (contato@atelierdasplacas.com.br)';

export interface AsaasCustomerData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasPaymentResult {
  id: string;
  order_id: string;
  asaas_payment_id: string;
  valor: number;
  forma_pagamento: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED';
  pix_qrcode_url?: string;
  pix_copia_cola?: string;
  boleto_url?: string;
  invoice_url?: string;
  checkout_url?: string;
  is_mock?: boolean;
}

export interface AsaasCheckoutSessionResult {
  id: string;
  order_id: string;
  checkout_id: string;
  checkout_url: string;
  status: string;
  is_mock?: boolean;
}

export interface AsaasWebhookMappedResult {
  event_id: string;
  event: string;
  order_id: string | null;
  payment_id: string | null;
  status: 'pago' | 'pendente' | 'vencido' | 'cancelado' | 'em_analise' | 'unchanged';
  asaas_status: string;
  value?: number;
  duplicate: boolean;
  ignored: boolean;
  error?: string;
}

/**
 * Sanitiza segredos, CPFs e dados sensíveis para logs seguros
 */
export function sanitizeAsaasLog(data: any): string {
  if (!data) return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text
    .replace(/(\$aact_[a-zA-Z0-9_-]{7})[a-zA-Z0-9_-]+/g, (_m, p1) => `${p1}***`)
    .replace(/(access_token["']?\s*:\s*["'])([^"']{4})[^"']+(["'])/gi, '$1$2***$3')
    .replace(/(cpfCnpj["']?\s*:\s*["']\d{3})\d{5}(\d{2}["'])/gi, '$1*****$2')
    .replace(/(creditCardNumber["']?\s*:\s*["'])\d{12}(\d{4}["'])/gi, '$1************$2')
    .replace(/(creditCardCvv["']?\s*:\s*["'])\d+(["'])/gi, '$1***$2');
}

/**
 * Normaliza e valida CPF/CNPJ removendo pontuações
 */
export function normalizeCpfCnpj(doc?: string | null): string | undefined {
  if (!doc) return undefined;
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11 || clean.length === 14) {
    return clean;
  }
  return undefined;
}

/**
 * Normaliza número de telefone
 */
export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10 && clean.length <= 11) {
    return clean;
  }
  return undefined;
}

/**
 * Validação de isolamento de chave entre Sandbox e Produção
 */
export function validateAsaasKeyEnvironment(apiKey: string, environment: AsaasEnvironment): void {
  const key = apiKey.trim();
  if (!key) return;

  // Chaves Asaas possuem identificador de ambiente no hash
  if (environment === 'sandbox' && (key.includes('prod_') || key.startsWith('$aact_prod_'))) {
    throw new Error('Chave de Produção detectada em ambiente Sandbox. Operação bloqueada para segurança financeira.');
  }
  if (environment === 'production' && (key.includes('hml_') || key.startsWith('$aact_hml_') || key.includes('sandbox'))) {
    throw new Error('Chave de Sandbox detectada em ambiente de Produção. Operação bloqueada.');
  }
}

export class AsaasService {
  public static getApiKey(customKey?: string): string | undefined {
    const key = customKey || process.env.ASAAS_API_KEY;
    return key?.trim();
  }

  public static getWebhookToken(customToken?: string): string | undefined {
    const token = customToken || process.env.ASAAS_WEBHOOK_TOKEN;
    return token?.trim();
  }

  public static getEnvironment(customEnv?: string): AsaasEnvironment {
    const env = (customEnv || process.env.ASAAS_ENVIRONMENT || 'sandbox').toLowerCase();
    return env === 'production' ? 'production' : 'sandbox';
  }

  public static getBaseUrl(env?: AsaasEnvironment): string {
    const environment = env || this.getEnvironment();
    return ASAAS_BASE_URLS[environment];
  }

  public static isConfigured(customKey?: string): boolean {
    const key = this.getApiKey(customKey);
    return Boolean(key && key.length > 8 && !key.includes('MY_') && key !== '');
  }

  /**
   * Validação estrita do token do Webhook (cabeçalho asaas-access-token)
   */
  public static validateWebhookAuth(headerToken?: string, configuredToken?: string): boolean {
    const expected = this.getWebhookToken(configuredToken);
    if (!expected) {
      // Se não há token configurado, recusa em produção por segurança
      return false;
    }
    if (!headerToken) return false;
    // Comparação de tempo constante contra timing attacks
    const bufExpected = Buffer.from(expected);
    const bufHeader = Buffer.from(headerToken);
    if (bufExpected.length !== bufHeader.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufHeader);
  }

  /**
   * Executa requisição HTTP autenticada à API oficial do Asaas com retries seguros
   */
  public static async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      apiKey?: string;
      environment?: AsaasEnvironment;
      userAgent?: string;
      fetchImpl?: typeof fetch;
    } = {}
  ): Promise<T> {
    const env = options.environment || this.getEnvironment();
    const apiKey = this.getApiKey(options.apiKey);
    if (!apiKey) {
      throw new Error('Chave de API do Asaas não configurada.');
    }

    validateAsaasKeyEnvironment(apiKey, env);

    const baseUrl = this.getBaseUrl(env);
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const fetchFn = options.fetchImpl || fetch;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': options.userAgent || DEFAULT_ASAAS_USER_AGENT,
    };

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetchFn(url, {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (response.status === 429) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }
          throw new Error('Limite de requisições excedido na API Asaas (Rate limit 429).');
        }

        if (!response.ok) {
          const errText = await response.text();
          let parsedDesc = errText;
          try {
            const errObj = JSON.parse(errText);
            parsedDesc = errObj?.errors?.[0]?.description || errObj?.message || errText;
          } catch {}

          // Retenta apenas para erros transitórios 5xx
          if (response.status >= 500 && attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 800 * Math.pow(2, attempt)));
            continue;
          }

          throw new Error(`Asaas API (${response.status}): ${parsedDesc}`);
        }

        return (await response.json()) as T;
      } catch (err: any) {
        lastError = err;
        if (attempt >= maxRetries || !err.message?.includes('500')) {
          break;
        }
      }
    }

    throw lastError || new Error('Falha ao comunicar com a API do Asaas.');
  }

  /**
   * Localiza cliente existente por CPF/CNPJ ou e-mail, ou cria um novo para evitar duplicidade
   */
  public static async findOrCreateCustomer(
    params: {
      profile?: Partial<Profile> | null;
      order: Order;
      apiKey?: string;
      environment?: AsaasEnvironment;
      fetchImpl?: typeof fetch;
    }
  ): Promise<string> {
    const profile = params.profile || {};
    const name = profile.nome || params.order.revendedor_nome || 'Revendedor Atelier das Placas';
    const email = profile.email || params.order.revendedor_email || 'contato@atelierdasplacas.com.br';
    const rawCpfCnpj = profile.cpf_cnpj;
    const cpfCnpj = normalizeCpfCnpj(rawCpfCnpj);
    const phone = normalizePhone(profile.telefone || params.order.revendedor_telefone);
    const externalRef = profile.id || params.order.revendedor_id || `rev_${params.order.id}`;

    // 1. Busca cliente existente por CPF/CNPJ se disponível
    if (cpfCnpj) {
      try {
        const search = await this.request<{ data: Array<{ id: string }> }>(
          `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
          { apiKey: params.apiKey, environment: params.environment, fetchImpl: params.fetchImpl }
        );
        if (search?.data && search.data.length > 0 && search.data[0].id) {
          return search.data[0].id;
        }
      } catch (e) {
        console.warn('[Asaas] Consulta de cliente por CPF/CNPJ falhou, tentando por email:', e);
      }
    }

    // 2. Busca cliente existente por e-mail
    if (email && email.includes('@')) {
      try {
        const search = await this.request<{ data: Array<{ id: string }> }>(
          `/customers?email=${encodeURIComponent(email)}`,
          { apiKey: params.apiKey, environment: params.environment, fetchImpl: params.fetchImpl }
        );
        if (search?.data && search.data.length > 0 && search.data[0].id) {
          return search.data[0].id;
        }
      } catch (e) {
        console.warn('[Asaas] Consulta de cliente por email falhou:', e);
      }
    }

    // 3. Cria novo cliente caso não exista
    const payload: AsaasCustomerData = {
      name,
      email,
      phone,
      mobilePhone: phone,
      cpfCnpj,
      externalReference: externalRef,
      notificationDisabled: false,
    };

    const created = await this.request<{ id: string }>('/customers', {
      method: 'POST',
      body: payload,
      apiKey: params.apiKey,
      environment: params.environment,
      fetchImpl: params.fetchImpl,
    });

    return created.id;
  }

  /**
   * Cria sessão oficial de Asaas Checkout Hospedado (POST /v3/checkouts)
   * Garante conformidade PCI-DSS total (zero dados de cartão passam pelo servidor da loja)
   */
  public static async createCheckoutSession(params: {
    order: Order;
    profile?: Partial<Profile> | null;
    appUrl: string;
    apiKey?: string;
    environment?: AsaasEnvironment;
    fetchImpl?: typeof fetch;
  }): Promise<AsaasCheckoutSessionResult> {
    const isReal = this.isConfigured(params.apiKey);

    if (isReal) {
      try {
        const customerId = await this.findOrCreateCustomer(params);
        const appUrlClean = params.appUrl.replace(/\/+$/, '');

        const payload = {
          customer: customerId,
          billingTypes: ['PIX', 'CREDIT_CARD', 'BOLETO'],
          chargeTypes: ['DETACHED'],
          minutesToExpire: 4320, // 3 dias de validade
          externalReference: params.order.id,
          callback: {
            successUrl: `${appUrlClean}/admin?payment=success&order_id=${params.order.id}`,
            cancelUrl: `${appUrlClean}/admin?payment=cancelled&order_id=${params.order.id}`,
            expiredUrl: `${appUrlClean}/admin?payment=expired&order_id=${params.order.id}`,
          },
          items: [
            {
              name: `Pedido Atelier das Placas #${params.order.numero_pedido}`,
              description: `${params.order.quantidade_total} placas inteligentes QR Code/NFC`,
              quantity: 1,
              value: Number(Number(params.order.valor_total).toFixed(2)),
            },
          ],
        };

        const res = await this.request<{ id: string; status: string; link?: string; url?: string }>('/checkouts', {
          method: 'POST',
          body: payload,
          apiKey: params.apiKey,
          environment: params.environment,
          fetchImpl: params.fetchImpl,
        });

        const baseUrl = this.getBaseUrl(params.environment);
        const hostUrl = baseUrl.includes('sandbox') ? 'https://sandbox.asaas.com' : 'https://asaas.com';
        const checkoutUrl = res.link || res.url || `${hostUrl}/checkoutSession/show?id=${res.id}`;

        return {
          id: `chk_${crypto.randomUUID().slice(0, 8)}`,
          order_id: params.order.id,
          checkout_id: res.id,
          checkout_url: checkoutUrl,
          status: res.status || 'ACTIVE',
          is_mock: false,
        };
      } catch (err: any) {
        console.warn('[Asaas Checkout] Falha ao criar checkout hospedado oficial, utilizando fallback:', err);
      }
    }

    // Fallback Mock Seguro para testes
    const mockId = `chk_mock_${params.order.id.slice(-6)}`;
    return {
      id: `chk_${crypto.randomUUID().slice(0, 8)}`,
      order_id: params.order.id,
      checkout_id: mockId,
      checkout_url: `https://sandbox.asaas.com/checkoutSession/show?id=${mockId}`,
      status: 'ACTIVE',
      is_mock: true,
    };
  }

  /**
   * Cria cobrança direta (PIX / Boleto / Cartão) com consulta oficial de QR Code Pix e link de Fatura
   */
  public static async createOrGetPayment(
    order: Order,
    customerProfile?: Partial<Profile> | null,
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED' = 'PIX',
    options: {
      apiKey?: string;
      environment?: AsaasEnvironment;
      diasVencimento?: number;
      fetchImpl?: typeof fetch;
    } = {}
  ): Promise<AsaasPaymentResult> {
    const isReal = this.isConfigured(options.apiKey);

    if (isReal) {
      try {
        const customerId = await this.findOrCreateCustomer({
          order,
          profile: customerProfile,
          apiKey: options.apiKey,
          environment: options.environment,
          fetchImpl: options.fetchImpl,
        });

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (options.diasVencimento || 3));
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const paymentPayload = {
          customer: customerId,
          billingType: billingType === 'UNDEFINED' ? undefined : billingType,
          value: Number(Number(order.valor_total).toFixed(2)),
          dueDate: dueDateStr,
          description: `Pedido Atelier das Placas #${order.numero_pedido} (${order.quantidade_total} placas)`,
          externalReference: order.id,
          postalService: false,
        };

        const paymentData = await this.request<any>('/payments', {
          method: 'POST',
          body: paymentPayload,
          apiKey: options.apiKey,
          environment: options.environment,
          fetchImpl: options.fetchImpl,
        });

        const asaasPaymentId = paymentData.id;
        let pixCopiaCola = '';
        let pixQrCodeUrl = '';

        // Se for PIX ou UNDEFINED, busca o QR Code e o Copia e Cola
        if (billingType === 'PIX' || billingType === 'UNDEFINED' || paymentData.billingType === 'PIX') {
          try {
            const pixData = await this.request<any>(`/payments/${asaasPaymentId}/pixQrCode`, {
              method: 'GET',
              apiKey: options.apiKey,
              environment: options.environment,
              fetchImpl: options.fetchImpl,
            });
            pixCopiaCola = pixData.payload || '';
            pixQrCodeUrl = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : '';
          } catch (pixErr) {
            console.warn('[Asaas] Aviso ao obter pixQrCode:', pixErr);
          }
        }

        return {
          id: `pay_${crypto.randomUUID().slice(0, 8)}`,
          order_id: order.id,
          asaas_payment_id: asaasPaymentId,
          valor: order.valor_total,
          forma_pagamento: billingType,
          status: paymentData.status || 'PENDING',
          pix_qrcode_url: pixQrCodeUrl,
          pix_copia_cola: pixCopiaCola,
          boleto_url: paymentData.bankSlipUrl,
          invoice_url: paymentData.invoiceUrl,
          checkout_url: paymentData.invoiceUrl,
          is_mock: false,
        };
      } catch (realApiError) {
        console.warn('[Asaas] Erro ao criar cobrança oficial, ativando fallback sandbox:', realApiError);
      }
    }

    // MODO SANDBOX RESILIENTE (Quando a chave ainda não foi inserida ou offline)
    const asaasPaymentId = `pay_asaas_${crypto.randomUUID().slice(0, 10)}`;
    const pixCopiaCola = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865405${Number(order.valor_total).toFixed(2)}5802BR5925ATELIER DAS PLACAS LTDA6009RIOJANEIRO62070503***6304`;
    const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaCola)}`;
    const invoiceUrl = `https://sandbox.asaas.com/i/${asaasPaymentId}`;

    return {
      id: `pay_${crypto.randomUUID().slice(0, 8)}`,
      order_id: order.id,
      asaas_payment_id: asaasPaymentId,
      valor: order.valor_total,
      forma_pagamento: billingType,
      status: order.status === 'pago' ? 'CONFIRMED' : 'PENDING',
      pix_qrcode_url: pixQrCodeUrl,
      pix_copia_cola: pixCopiaCola,
      boleto_url: `https://sandbox.asaas.com/b/pdf/${asaasPaymentId}`,
      invoice_url: invoiceUrl,
      checkout_url: invoiceUrl,
      is_mock: true,
    };
  }

  /**
   * Mapeamento idempotente e seguro de eventos de webhook do Asaas
   * Trata PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_REFUNDED e CHECKOUT_COMPLETED
   */
  public static mapAsaasWebhookEvent(
    payload: any,
    processedEventIds: Set<string> = new Set()
  ): AsaasWebhookMappedResult {
    const eventId = String(payload?.id || '').trim();
    const event = String(payload?.event || '').trim();
    const payment = payload?.payment || {};
    const checkout = payload?.checkout || {};

    if (!eventId || !event) {
      return {
        event_id: eventId,
        event,
        order_id: null,
        payment_id: null,
        status: 'unchanged',
        asaas_status: 'UNKNOWN',
        duplicate: false,
        ignored: true,
        error: 'Payload de webhook sem id ou event.',
      };
    }

    // Deduplicação estrita de eventos
    if (processedEventIds.has(eventId)) {
      return {
        event_id: eventId,
        event,
        order_id: payment?.externalReference || checkout?.externalReference || null,
        payment_id: payment?.id || checkout?.id || null,
        status: 'unchanged',
        asaas_status: payment?.status || checkout?.status || 'DUPLICATE',
        duplicate: true,
        ignored: true,
      };
    }

    const orderId = payment?.externalReference || checkout?.externalReference || null;
    const paymentId = payment?.id || checkout?.id || null;
    const asaasStatus = String(payment?.status || checkout?.status || '').toUpperCase();
    const value = payment?.value ? Number(payment.value) : undefined;

    let targetOrderStatus: AsaasWebhookMappedResult['status'] = 'unchanged';

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        targetOrderStatus = 'pago';
        break;
      case 'PAYMENT_OVERDUE':
        targetOrderStatus = 'vencido';
        break;
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
        targetOrderStatus = 'cancelado';
        break;
      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        targetOrderStatus = 'em_analise';
        break;
      case 'CHECKOUT_COMPLETED':
        // No checkout completado, a confirmação financeira final vem pelo PAYMENT_CONFIRMED
        targetOrderStatus = 'unchanged';
        break;
      default:
        targetOrderStatus = 'unchanged';
        break;
    }

    return {
      event_id: eventId,
      event,
      order_id: orderId,
      payment_id: paymentId,
      status: targetOrderStatus,
      asaas_status: asaasStatus,
      value,
      duplicate: false,
      ignored: targetOrderStatus === 'unchanged' && event !== 'CHECKOUT_COMPLETED',
    };
  }

  /**
   * Gera payload oficial de webhook simulado para testes automatizados
   */
  public static createMockWebhookPayload(
    order: Order,
    asaasPaymentId: string,
    event: 'PAYMENT_RECEIVED' | 'PAYMENT_CONFIRMED' | 'PAYMENT_OVERDUE' | 'PAYMENT_REFUNDED' = 'PAYMENT_RECEIVED'
  ) {
    const statusMap = {
      PAYMENT_RECEIVED: 'RECEIVED',
      PAYMENT_CONFIRMED: 'CONFIRMED',
      PAYMENT_OVERDUE: 'OVERDUE',
      PAYMENT_REFUNDED: 'REFUNDED',
    };

    return {
      id: `evt_test_${crypto.randomUUID().replace(/-/g, '')}`,
      event,
      dateCreated: new Date().toISOString(),
      payment: {
        id: asaasPaymentId,
        customer: 'cus_000005234567',
        dateCreated: new Date().toISOString(),
        value: Number(Number(order.valor_total).toFixed(2)),
        netValue: Number((order.valor_total * 0.98).toFixed(2)),
        description: `Pedido Atelier das Placas #${order.numero_pedido}`,
        billingType: 'PIX',
        status: statusMap[event],
        externalReference: order.id,
        confirmedDate: event === 'PAYMENT_CONFIRMED' ? new Date().toISOString() : undefined,
        paymentDate: event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' ? new Date().toISOString() : undefined,
      },
    };
  }
}
