import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import {
  DEFAULT_INTEGRATION_SETTINGS,
  calculateDynamicPackage,
  calculateSimulatedShippingOptions,
  markCheapestAndFastestOptions,
} from '../src/utils/shippingCalculator.js';
import {
  calculateShippingRates,
  generateShippingLabel,
  trackShipments,
  checkAndCancelShipmentOrder,
  createOAuthState,
  verifyOAuthState,
  buildOAuthAuthorizeUrl,
  exchangeAuthorizationCode,
  verifyMelhorEnvioWebhookSignature,
  mapWebhookEventToLogisticsStatus,
  maskSecret,
  isMaskedSecretValue,
} from '../server/services/melhor-envio.js';
import type { IntegrationSettings, ShippingOption } from '../src/types.js';

const processedServerlessWebhookIds = new Set<string>();

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

const CONFIG_ROW_ID = 'cfg_integrations_v1';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadSettings(supabase: any): Promise<IntegrationSettings> {
  let saved: Partial<IntegrationSettings> = {};
  try {
    const { data } = await supabase
      .from('audit_logs')
      .select('dados_novos, created_at')
      .eq('id', CONFIG_ROW_ID)
      .maybeSingle();

    if (data?.dados_novos) {
      saved =
        typeof data.dados_novos === 'string'
          ? JSON.parse(data.dados_novos)
          : data.dados_novos;
    }
  } catch {}

  const merged: IntegrationSettings = {
    ...DEFAULT_INTEGRATION_SETTINGS,
    ...saved,
  };

  // Fallback para variáveis de ambiente se os campos ainda estiverem em branco no banco
  if (!merged.asaas_api_key && process.env.ASAAS_API_KEY) {
    merged.asaas_api_key = process.env.ASAAS_API_KEY;
  }
  if (!merged.asaas_webhook_token && process.env.ASAAS_WEBHOOK_TOKEN) {
    merged.asaas_webhook_token = process.env.ASAAS_WEBHOOK_TOKEN;
  }
  if (!merged.melhor_envio_token && process.env.MELHOR_ENVIO_TOKEN) {
    merged.melhor_envio_token = process.env.MELHOR_ENVIO_TOKEN;
  }
  if (!merged.melhor_envio_client_id && process.env.MELHOR_ENVIO_CLIENT_ID) {
    merged.melhor_envio_client_id = process.env.MELHOR_ENVIO_CLIENT_ID;
  }
  if (!merged.melhor_envio_client_secret && process.env.MELHOR_ENVIO_CLIENT_SECRET) {
    merged.melhor_envio_client_secret = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  }
  if (!merged.melhor_envio_redirect_uri && process.env.MELHOR_ENVIO_REDIRECT_URI) {
    merged.melhor_envio_redirect_uri = process.env.MELHOR_ENVIO_REDIRECT_URI;
  }
  if (!merged.melhor_envio_webhook_secret && process.env.MELHOR_ENVIO_WEBHOOK_SECRET) {
    merged.melhor_envio_webhook_secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET;
  }
  if (
    !merged.gemini_api_key &&
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  ) {
    merged.gemini_api_key = process.env.GEMINI_API_KEY;
  }

  return merged;
}

function getIntegrationStatus(s: IntegrationSettings) {
  const asaasReady = Boolean(
    s.asaas_api_key && s.asaas_api_key.trim().length > 8 && !s.asaas_api_key.includes('MY_')
  );
  const melhorEnvioReady = Boolean(
    s.melhor_envio_token &&
      s.melhor_envio_token.trim().length > 15 &&
      !s.melhor_envio_token.includes('seu_token')
  );
  const geminiReady = Boolean(
    s.gemini_api_key &&
      s.gemini_api_key.trim().length > 10 &&
      !s.gemini_api_key.includes('MY_GEMINI_API_KEY')
  );

  return {
    asaas_configured: asaasReady,
    melhor_envio_configured: melhorEnvioReady,
    gemini_configured: geminiReady,
  };
}

function maskSettingsSecretsForBrowser(s: IntegrationSettings): IntegrationSettings {
  return {
    ...s,
    asaas_api_key: maskSecret(s.asaas_api_key),
    asaas_webhook_token: maskSecret(s.asaas_webhook_token),
    melhor_envio_token: maskSecret(s.melhor_envio_token),
    melhor_envio_refresh_token: maskSecret(s.melhor_envio_refresh_token),
    melhor_envio_client_secret: maskSecret(s.melhor_envio_client_secret),
    melhor_envio_webhook_secret: maskSecret(s.melhor_envio_webhook_secret),
    gemini_api_key: maskSecret(s.gemini_api_key),
  };
}

export default async function handler(req: any, res: any) {
  const supabase = getSupabaseAdmin();
  const action = String(req.query?.action || '').trim();

  try {
    const settings = await loadSettings(supabase);

    // 1. GET CONFIGURAÇÕES E STATUS DAS INTEGRAÇÕES (COM CHAVES MASCARADAS PARA O BROWSER)
    if (req.method === 'GET' && (!action || action === 'get-settings')) {
      return res.status(200).json({
        sucesso: true,
        settings: maskSettingsSecretsForBrowser(settings),
        status: getIntegrationStatus(settings),
      });
    }

    // 1.1 OAUTH2 MELHOR ENVIO: GERAR URL DE AUTORIZAÇÃO COM STATE ANTI-CSRF
    if (req.method === 'GET' && action === 'melhor-envio-oauth-url') {
      const clientId = String(req.query?.client_id || settings.melhor_envio_client_id || '').trim();
      const redirectUri = String(
        req.query?.redirect_uri ||
          settings.melhor_envio_redirect_uri ||
          `${process.env.APP_URL || 'https://placasinteligentes.vercel.app'}/api/integrations?action=melhor-envio-oauth-callback`
      ).trim();
      const env = (req.query?.env as any) || settings.melhor_envio_env || 'sandbox';
      const secret = settings.melhor_envio_client_secret || 'atelier_oauth_state_secret';

      const state = createOAuthState(secret, env);
      const authorizeUrl = buildOAuthAuthorizeUrl({
        clientId,
        redirectUri,
        environment: env,
        scopes: settings.melhor_envio_scopes,
        state,
      });

      return res.status(200).json({
        sucesso: true,
        authorize_url: authorizeUrl,
        state,
        environment: env,
      });
    }

    // 1.2 OAUTH2 MELHOR ENVIO: CALLBACK DE RETORNO E TROCA DE CODE POR TOKEN NO SERVIDOR
    if (req.method === 'GET' && action === 'melhor-envio-oauth-callback') {
      const code = String(req.query?.code || '').trim();
      const state = String(req.query?.state || '').trim();
      if (!code) {
        return res.status(400).json({ sucesso: false, mensagem: 'Código OAuth2 (code) não informado.' });
      }

      const secret = settings.melhor_envio_client_secret || 'atelier_oauth_state_secret';
      const verification = verifyOAuthState(state, secret);
      if (!verification.valid) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `State OAuth2 inválido ou expirado: ${verification.reason}`,
        });
      }

      const env = verification.environment || settings.melhor_envio_env;
      const bundle = await exchangeAuthorizationCode({
        code,
        clientId: settings.melhor_envio_client_id || '',
        clientSecret: settings.melhor_envio_client_secret || '',
        redirectUri:
          settings.melhor_envio_redirect_uri ||
          `${process.env.APP_URL || 'https://placasinteligentes.vercel.app'}/api/integrations?action=melhor-envio-oauth-callback`,
        environment: env,
        userAgent: settings.melhor_envio_user_agent,
      });

      const updated: IntegrationSettings = {
        ...settings,
        melhor_envio_env: bundle.environment,
        melhor_envio_token: bundle.access_token,
        melhor_envio_refresh_token: bundle.refresh_token,
        melhor_envio_token_expires_at: bundle.expires_at,
        updated_at: new Date().toISOString(),
      };

      await supabase.from('audit_logs').upsert({
        id: CONFIG_ROW_ID,
        usuario_id: 'prof_jose_brandt',
        acao: 'SYSTEM_INTEGRATIONS_CONFIG',
        entidade: 'system_settings',
        entidade_id: 'integrations',
        dados_novos: updated,
        created_at: updated.updated_at,
      });

      res.setHeader('Location', '/admin?oauth_melhor_envio=success');
      return res.status(302).end();
    }

    const rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // 2. SALVAR CONFIGURAÇÕES DE INTEGRAÇÕES E PARÂMETROS DE FRETE/PLACAS/CAIXAS
    if (req.method === 'POST' && action === 'save-settings') {
      const resolveSecretField = (incoming: string | undefined, current: string | undefined) => {
        if (incoming === undefined || isMaskedSecretValue(incoming)) {
          return current || '';
        }
        return incoming.trim();
      };

      const updated: IntegrationSettings = {
        ...settings,
        ...body,
        asaas_api_key: resolveSecretField(body.asaas_api_key, settings.asaas_api_key),
        asaas_webhook_token: resolveSecretField(body.asaas_webhook_token, settings.asaas_webhook_token),
        melhor_envio_token: resolveSecretField(body.melhor_envio_token, settings.melhor_envio_token),
        melhor_envio_refresh_token: resolveSecretField(body.melhor_envio_refresh_token, settings.melhor_envio_refresh_token),
        melhor_envio_client_secret: resolveSecretField(body.melhor_envio_client_secret, settings.melhor_envio_client_secret),
        melhor_envio_webhook_secret: resolveSecretField(body.melhor_envio_webhook_secret, settings.melhor_envio_webhook_secret),
        gemini_api_key: resolveSecretField(body.gemini_api_key, settings.gemini_api_key),
        placa_peso_kg: Number(body.placa_peso_kg ?? settings.placa_peso_kg),
        placa_largura_cm: Number(body.placa_largura_cm ?? settings.placa_largura_cm),
        placa_comprimento_cm: Number(body.placa_comprimento_cm ?? settings.placa_comprimento_cm),
        placa_espessura_cm: Number(body.placa_espessura_cm ?? settings.placa_espessura_cm),
        embalagem_tara_kg: Number(body.embalagem_tara_kg ?? settings.embalagem_tara_kg),
        caixa_padrao_max_placas: Number(body.caixa_padrao_max_placas ?? settings.caixa_padrao_max_placas),
        caixa_padrao_largura_cm: Number(body.caixa_padrao_largura_cm ?? settings.caixa_padrao_largura_cm),
        caixa_padrao_comprimento_cm: Number(body.caixa_padrao_comprimento_cm ?? settings.caixa_padrao_comprimento_cm),
        caixa_padrao_altura_min_cm: Number(body.caixa_padrao_altura_min_cm ?? settings.caixa_padrao_altura_min_cm),
        caixa_padrao_folga_altura_cm: Number(body.caixa_padrao_folga_altura_cm ?? settings.caixa_padrao_folga_altura_cm),
        caixa_grande_largura_cm: Number(body.caixa_grande_largura_cm ?? settings.caixa_grande_largura_cm),
        caixa_grande_comprimento_cm: Number(body.caixa_grande_comprimento_cm ?? settings.caixa_grande_comprimento_cm),
        caixa_grande_altura_min_cm: Number(body.caixa_grande_altura_min_cm ?? settings.caixa_grande_altura_min_cm),
        caixa_altura_max_cm: Number(body.caixa_altura_max_cm ?? settings.caixa_altura_max_cm),
        asaas_dias_vencimento: Number(body.asaas_dias_vencimento ?? settings.asaas_dias_vencimento),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('audit_logs').upsert({
        id: CONFIG_ROW_ID,
        usuario_id: 'prof_jose_brandt',
        acao: 'SYSTEM_INTEGRATIONS_CONFIG',
        entidade: 'system_settings',
        entidade_id: 'integrations',
        dados_novos: updated,
        created_at: updated.updated_at,
      });

      if (error) {
        return res.status(500).json({
          sucesso: false,
          mensagem: `Erro ao gravar configurações no Supabase: ${error.message}`,
        });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: 'Configurações de integrações, chaves e medidas de frete salvas com sucesso!',
        settings: maskSettingsSecretsForBrowser(updated),
        status: getIntegrationStatus(updated),
      });
    }

    // 3. TESTAR CONEXÃO DE CADA INTEGRAÇÃO EM TEMPO REAL
    if (req.method === 'POST' && action === 'test-integration') {
      const provider = body.provider;
      const incoming = body.settings || {};
      const merged: IntegrationSettings = {
        ...settings,
        ...incoming,
        asaas_api_key: isMaskedSecretValue(incoming.asaas_api_key) ? settings.asaas_api_key : (incoming.asaas_api_key ?? settings.asaas_api_key),
        melhor_envio_token: isMaskedSecretValue(incoming.melhor_envio_token) ? settings.melhor_envio_token : (incoming.melhor_envio_token ?? settings.melhor_envio_token),
        melhor_envio_client_secret: isMaskedSecretValue(incoming.melhor_envio_client_secret) ? settings.melhor_envio_client_secret : (incoming.melhor_envio_client_secret ?? settings.melhor_envio_client_secret),
        gemini_api_key: isMaskedSecretValue(incoming.gemini_api_key) ? settings.gemini_api_key : (incoming.gemini_api_key ?? settings.gemini_api_key),
      };

      if (provider === 'gemini') {
        const key = (merged.gemini_api_key || '').trim();
        if (!key || key === 'MY_GEMINI_API_KEY') {
          return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe a GEMINI_API_KEY antes de testar a conexão.',
          });
        }
        try {
          const ai = new GoogleGenAI({ apiKey: key });
          const response = await ai.models.generateContent({
            model: merged.gemini_model || 'gemini-2.5-flash',
            contents: 'Responda apenas: OK',
          });
          return res.status(200).json({
            sucesso: true,
            mensagem: `Conexão com Google Gemini (${merged.gemini_model || 'gemini-2.5-flash'}) validada com sucesso! Resposta: ${(response.text || 'OK').trim()}`,
          });
        } catch (err: any) {
          return res.status(400).json({
            sucesso: false,
            mensagem: `Falha ao validar chave no Google Gemini: ${err?.message || 'Chave inválida'}`,
          });
        }
      }

      if (provider === 'melhor_envio') {
        const token = (merged.melhor_envio_token || '').trim();
        if (!token) {
          return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe o Bearer Token (ou conecte via OAuth2) do Melhor Envio antes de testar a conexão oficial (o Simulador Calibrado já está ativo como fallback).',
          });
        }
        try {
          const opcoes = await calculateShippingRates({
            cep_destino: '01310100',
            quantidade_placas: 5,
            settings: merged,
            allowSimulationFallback: false,
          });
          return res.status(200).json({
            sucesso: true,
            mensagem: `Conexão oficial com Melhor Envio (${merged.melhor_envio_env.toUpperCase()}) autenticada e cotando ${opcoes.length} serviços reais!`,
          });
        } catch (err: any) {
          return res.status(400).json({
            sucesso: false,
            mensagem: err?.message || 'Erro ao validar conexão com o Melhor Envio.',
          });
        }
      }

      if (provider === 'asaas') {
        const key = (merged.asaas_api_key || '').trim();
        if (!key) {
          return res.status(400).json({
            sucesso: false,
            mensagem: 'Informe a Chave de API do Asaas ($aact_...) antes de testar a conexão oficial (o Modo Sandbox Simulado já está ativo como fallback).',
          });
        }
        const baseUrl =
          merged.asaas_env === 'production'
            ? 'https://api.asaas.com/v3'
            : 'https://sandbox.asaas.com/api/v3';

        try {
          const response = await fetch(`${baseUrl}/customers?limit=1`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              access_token: key,
            },
          });

          if (!response.ok) {
            const errText = await response.text();
            return res.status(400).json({
              sucesso: false,
              mensagem: `Asaas (${merged.asaas_env}) recusou a chave (HTTP ${response.status}): ${errText.slice(0, 140)}`,
            });
          }

          return res.status(200).json({
            sucesso: true,
            mensagem: `Conexão oficial com Asaas (${merged.asaas_env.toUpperCase()}) validada com sucesso! Cobranças PIX e Boleto prontas.`,
          });
        } catch (err: any) {
          return res.status(400).json({
            sucesso: false,
            mensagem: `Erro ao conectar ao Asaas: ${err?.message}`,
          });
        }
      }

      return res.status(400).json({ sucesso: false, mensagem: 'Provedor desconhecido.' });
    }

    // 4. CALCULAR FRETE (MELHOR ENVIO OFICIAL OU SIMULADOR CALIBRADO COM PESOS/CAIXAS DO ADMIN)
    if (req.method === 'POST' && action === 'calculate-shipping') {
      const cepDestino = String(body.cep_destino || '').replace(/\D/g, '');
      const quantidade = Math.max(1, Number(body.quantidade_placas) || 1);
      const incomingCustom = body.custom_settings || {};
      const customConfig: IntegrationSettings = {
        ...settings,
        ...incomingCustom,
        melhor_envio_token: isMaskedSecretValue(incomingCustom.melhor_envio_token)
          ? settings.melhor_envio_token
          : (incomingCustom.melhor_envio_token ?? settings.melhor_envio_token),
      };

      if (cepDestino.length !== 8) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Informe um CEP de destino válido com 8 dígitos.',
        });
      }

      const pkg = calculateDynamicPackage(quantidade, customConfig);
      const cepOrigem = (customConfig.origem_cep || '22745271').replace(/\D/g, '');
      const hasRealToken = Boolean(
        customConfig.melhor_envio_token &&
          customConfig.melhor_envio_token.trim().length > 15 &&
          !customConfig.melhor_envio_token.includes('seu_token')
      );

      if (hasRealToken) {
        try {
          const opcoes = await calculateShippingRates({
            cep_destino: cepDestino,
            quantidade_placas: quantidade,
            cep_origem: cepOrigem,
            settings: customConfig,
            allowSimulationFallback: false,
          });
          return res.status(200).json({
            sucesso: true,
            modo: 'oficial_melhor_envio',
            origem_cep: cepOrigem,
            destino_cep: cepDestino,
            pacote: pkg,
            opcoes,
          });
        } catch {}
      }

      const opcoes = calculateSimulatedShippingOptions(cepDestino, pkg);
      return res.status(200).json({
        sucesso: true,
        modo: 'simulador_calibrado',
        origem_cep: cepOrigem,
        destino_cep: cepDestino,
        pacote: pkg,
        opcoes,
      });
    }

    // 5. GERAR / ADICIONAR ETIQUETA DE ENVIO NO MELHOR ENVIO E GRAVAR NO SUPABASE
    if (req.method === 'POST' && action === 'generate-label') {
      const orderId = body.order_id;
      const confirmCheckout = Boolean(body.confirm_checkout);
      const invoiceKey = body.invoice_key || null;

      if (!orderId) {
        return res.status(400).json({ sucesso: false, mensagem: 'order_id é obrigatório.' });
      }

      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      const { data: logistics } = await supabase
        .from('order_logistics')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      const { data: profile } = order?.revendedor_id
        ? await supabase.from('profiles').select('*').eq('id', order.revendedor_id).maybeSingle()
        : { data: null };

      const enrichedOrder = {
        ...order,
        revendedor_nome: profile?.nome || order?.revendedor_nome,
        revendedor_email: profile?.email || order?.revendedor_email,
        revendedor_cpf_cnpj: profile?.cpf_cnpj || '06865841719',
        revendedor_telefone: profile?.telefone || logistics?.responsavel_retirada_telefone || '21980914107',
      };

      const result = await generateShippingLabel(enrichedOrder, logistics || {}, {
        settings,
        explicitCheckoutConfirmation: confirmCheckout,
        invoiceKey,
      });

      if (logistics?.id) {
        await supabase
          .from('order_logistics')
          .update({
            codigo_rastreamento: result.codigo_rastreamento,
            updated_at: new Date().toISOString(),
          })
          .eq('id', logistics.id);
      }

      return res.status(200).json(result);
    }

    // 5.1 RASTREAMENTO ATIVO DE ETIQUETA NO MELHOR ENVIO
    if (req.method === 'POST' && action === 'track-shipment') {
      const meOrderId = String(body.melhor_envio_order_id || body.order_id || '').trim();
      const track = await trackShipments({ orderIds: [meOrderId], settings });
      return res.status(200).json(track);
    }

    // 5.2 CANCELAMENTO DE ETIQUETA NO MELHOR ENVIO
    if (req.method === 'POST' && action === 'cancel-label') {
      const meOrderId = String(body.melhor_envio_order_id || body.order_id || '').trim();
      const cancelRes = await checkAndCancelShipmentOrder({
        orderId: meOrderId,
        description: body.description,
        settings,
      });
      return res.status(200).json(cancelRes);
    }

    // 5.3 WEBHOOK OFICIAL DO MELHOR ENVIO (VALIDAÇÃO HMAC-SHA256 X-ME-Signature + IDEMPOTÊNCIA)
    if (action === 'melhor-envio-webhook') {
      // O Melhor Envio pode enviar GET ou POST vazio durante o teste inicial de validação cadastral
      if (req.method === 'GET' || !req.body || Object.keys(body).length === 0) {
        return res.status(200).json({ sucesso: true, mensagem: 'Endpoint de webhook Melhor Envio ativo e verificado.' });
      }

      const secret =
        settings.melhor_envio_webhook_secret ||
        settings.melhor_envio_client_secret ||
        process.env.MELHOR_ENVIO_WEBHOOK_SECRET ||
        process.env.MELHOR_ENVIO_CLIENT_SECRET ||
        '';
      const signature = req.headers?.['x-me-signature'] || req.headers?.['X-ME-Signature'];

      // Se houver secret cadastrado e vier assinatura na requisição, valida criptograficamente
      if (secret && signature && !verifyMelhorEnvioWebhookSignature(rawBodyString, signature, secret)) {
        return res.status(401).json({
          sucesso: false,
          mensagem: 'Assinatura X-ME-Signature inválida.',
        });
      }

      const mapped = mapWebhookEventToLogisticsStatus(body, processedServerlessWebhookIds);
      if (mapped.duplicate || mapped.ignored) {
        return res.status(200).json({
          sucesso: true,
          duplicate: mapped.duplicate,
          ignored: mapped.ignored,
        });
      }

      if (mapped.tracking_code || mapped.correios_status) {
        try {
          if (mapped.tracking_code) {
            await supabase
              .from('order_logistics')
              .update({
                correios_status: mapped.correios_status,
                codigo_rastreamento: mapped.tracking_code,
                updated_at: new Date().toISOString(),
              })
              .eq('codigo_rastreamento', mapped.tracking_code);
          }
        } catch {}
      }

      return res.status(200).json({
        sucesso: true,
        processed: mapped,
      });
    }

    // 6. OCR DE COMPROVANTE DE POSTAGEM COM GOOGLE GEMINI AI
    if (req.method === 'POST' && action === 'ocr-receipt') {
      const { imagem_base64, mime_type } = body;
      if (!imagem_base64) {
        return res.status(400).json({ sucesso: false, mensagem: 'Imagem do comprovante é obrigatória.' });
      }

      const apiKey = (settings.gemini_api_key || '').trim();
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(200).json({
          sucesso: true,
          aviso: 'Chave GEMINI_API_KEY ainda não configurada em Integrações -> Configurações. Configure-a para leitura automática por IA.',
          resultado_ocr: {
            sucesso: false,
            codigo_rastreamento: null,
            data_postagem: new Date().toISOString().split('T')[0],
            transportadora: 'Correios',
            confianca: 'baixa',
            texto_completo: 'Configure sua GEMINI_API_KEY em Integrações -> Configurações para ativar o OCR automático.',
            requer_revisao_manual: true,
          },
        });
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Você é um assistente de OCR especializado em comprovantes de postagem de encomendas dos Correios e transportadoras do Brasil (Jadlog, Loggi, Melhor Envio).
Analise a imagem deste comprovante e extraia as seguintes informações no formato JSON rigoroso:
{
  "codigo_rastreamento": "string com o código de rastreamento (ex: AA123456789BR ou numérico) ou null se não encontrar",
  "data_postagem": "string com a data no formato AAAA-MM-DD ou null",
  "transportadora": "nome da transportadora (ex: Correios, Jadlog, Loggi) ou null",
  "confianca": "alta" se legível, "media" se parcial, "baixa" se ilegível,
  "resumo_texto": "resumo curto dos dados lidos no comprovante"
}
Retorne estritamente o JSON.`;

        const cleanBase64 = String(imagem_base64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const response = await ai.models.generateContent({
          model: settings.gemini_model || 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mime_type || 'image/jpeg',
                  },
                },
              ],
            },
          ],
        });

        const textOutput = response.text || '';
        let parsed: any = {};
        try {
          const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } catch {}

        return res.status(200).json({
          sucesso: true,
          aviso: 'Leitura realizada via Google Gemini AI. Confira o código antes de confirmar o envio.',
          resultado_ocr: {
            sucesso: true,
            codigo_rastreamento: parsed.codigo_rastreamento || null,
            data_postagem: parsed.data_postagem || new Date().toISOString().split('T')[0],
            transportadora: parsed.transportadora || 'Correios',
            confianca: parsed.confianca || 'alta',
            texto_completo: parsed.resumo_texto || textOutput,
            requer_revisao_manual: true,
          },
        });
      } catch (err: any) {
        return res.status(500).json({
          sucesso: false,
          mensagem: `Falha ao processar comprovante no Gemini AI: ${err?.message}`,
        });
      }
    }

    // 7. CRIAR OU OBTER COBRANÇA PIX/BOLETO NO ASAAS
    if (action === 'create-payment' || action === 'get-payment') {
      const orderId = req.query?.order_id || body.order_id;
      if (!orderId) {
        return res.status(400).json({ sucesso: false, mensagem: 'order_id é obrigatório.' });
      }

      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (!order) {
        return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', order.revendedor_id)
        .maybeSingle();

      const apiKey = (settings.asaas_api_key || '').trim();
      const isReal = Boolean(apiKey && apiKey.length > 8 && !apiKey.includes('MY_'));
      const baseUrl =
        settings.asaas_env === 'production'
          ? 'https://api.asaas.com/v3'
          : 'https://sandbox.asaas.com/api/v3';

      if (isReal) {
        try {
          let asaasCustomerId = 'cus_000000000000';
          const customerRes = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              access_token: apiKey,
            },
            body: JSON.stringify({
              name: profile?.nome || 'Revendedor Atelier das Placas',
              email: profile?.email || 'contato@atelierdasplacas.com.br',
              phone: profile?.telefone ? String(profile.telefone).replace(/\D/g, '') : undefined,
              cpfCnpj: profile?.cpf_cnpj ? String(profile.cpf_cnpj).replace(/\D/g, '') : undefined,
              externalReference: profile?.id || order.revendedor_id,
            }),
          });
          if (customerRes.ok) {
            const cData = await customerRes.json();
            asaasCustomerId = cData.id;
          }

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (Number(settings.asaas_dias_vencimento) || 3));
          const dueDateStr = dueDate.toISOString().split('T')[0];

          const paymentRes = await fetch(`${baseUrl}/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              access_token: apiKey,
            },
            body: JSON.stringify({
              customer: asaasCustomerId,
              billingType: 'PIX',
              value: Number(Number(order.valor_total || 0).toFixed(2)),
              dueDate: dueDateStr,
              description: `Pedido Atelier das Placas #${order.numero_pedido} (${order.quantidade_total} placas)`,
              externalReference: order.id,
            }),
          });

          if (paymentRes.ok) {
            const pData = await paymentRes.json();
            let pixCopiaCola = '';
            let pixQrCodeUrl = '';

            const pixRes = await fetch(`${baseUrl}/payments/${pData.id}/pixQrCode`, {
              method: 'GET',
              headers: { access_token: apiKey },
            });
            if (pixRes.ok) {
              const pixData = await pixRes.json();
              pixCopiaCola = pixData.payload || '';
              pixQrCodeUrl = pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : '';
            }

            const paymentResult = {
              id: `pay_${crypto.randomUUID().slice(0, 8)}`,
              order_id: order.id,
              asaas_payment_id: pData.id,
              valor: order.valor_total,
              forma_pagamento: 'PIX',
              status: pData.status || 'PENDING',
              pix_qrcode_url: pixQrCodeUrl,
              pix_copia_cola: pixCopiaCola,
              boleto_url: pData.bankSlipUrl || pData.invoiceUrl,
              invoice_url: pData.invoiceUrl,
              is_mock: false,
            };

            return res.status(200).json({
              sucesso: true,
              pagamento: paymentResult,
              pedido: order,
            });
          }
        } catch {}
      }

      // Fallback Sandbox Resiliente
      const asaasPaymentId = `pay_asaas_${order.id.slice(-6)}`;
      const valorFmt = Number(order.valor_total || 0).toFixed(2);
      const pixCopiaCola = `00020126580014br.gov.bcb.pix0136${order.id}5204000053039865405${valorFmt}5802BR5925ATELIER DAS PLACAS LTDA6009RIOJANEIRO62070503***6304`;
      const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaCola)}`;

      return res.status(200).json({
        sucesso: true,
        pagamento: {
          id: `pay_${order.id.slice(-6)}`,
          order_id: order.id,
          asaas_payment_id: asaasPaymentId,
          valor: order.valor_total,
          forma_pagamento: 'PIX',
          status: order.status === 'pago' ? 'CONFIRMED' : 'PENDING',
          pix_qrcode_url: pixQrCodeUrl,
          pix_copia_cola: pixCopiaCola,
          boleto_url: `https://sandbox.asaas.com/b/pdf/${asaasPaymentId}`,
          invoice_url: `https://sandbox.asaas.com/i/${asaasPaymentId}`,
          is_mock: true,
        },
        pedido: order,
      });
    }

    // 8. WEBHOOK OFICIAL DO ASAAS (RECEBIMENTO AUTOMÁTICO DE PAGAMENTO)
    if (req.method === 'POST' && action === 'asaas-webhook') {
      const configuredToken = (settings.asaas_webhook_token || '').trim();
      const headerToken = req.headers?.['asaas-access-token'];
      if (configuredToken && headerToken && headerToken !== configuredToken) {
        return res.status(401).json({ sucesso: false, mensagem: 'Webhook token inválido.' });
      }

      const event = body.event;
      const payment = body.payment;
      if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && payment?.externalReference) {
        const orderId = payment.externalReference;
        const now = new Date().toISOString();
        await supabase
          .from('orders')
          .update({
            status: 'pago',
            data_aprovacao: now,
            updated_at: now,
          })
          .eq('id', orderId);

        return res.status(200).json({
          sucesso: true,
          mensagem: `Pedido ${orderId} aprovado via Webhook Asaas!`,
        });
      }

      return res.status(200).json({ sucesso: true, mensagem: 'Evento recebido.' });
    }

    // 9. IMPRESSÃO DE ETIQUETA TÉRMICA / A4 (COM REMETENTE E CAIXA CONFIGURADOS)
    if (req.method === 'GET' && action === 'print-label') {
      const orderId = String(req.query?.order_id || '').trim();
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      const { data: logistics } = await supabase
        .from('order_logistics')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      const { data: profile } = order?.revendedor_id
        ? await supabase.from('profiles').select('*').eq('id', order.revendedor_id).maybeSingle()
        : { data: null };

      const qty = order?.quantidade_total || 1;
      const pkg = calculateDynamicPackage(qty, settings);
      const tracking = logistics?.codigo_rastreamento || `BR-ME-${orderId.slice(-6).toUpperCase()}`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta de Postagem - Pedido #${order?.numero_pedido || orderId}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f1f5f9; padding: 24px; color: #0f172a; }
    .label { max-width: 420px; margin: 0 auto; background: #fff; border: 2px solid #0f172a; border-radius: 8px; padding: 18px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .carrier { font-size: 18px; font-weight: 900; text-transform: uppercase; }
    .tracking { text-align: center; font-family: monospace; font-size: 20px; font-weight: bold; background: #f8fafc; border: 1px dashed #334155; padding: 10px; margin: 12px 0; letter-spacing: 2px; }
    .section { border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 10px; font-size: 12px; line-height: 1.5; }
    .tag { font-size: 10px; font-weight: bold; text-transform: uppercase; background: #0f172a; color: #fff; padding: 2px 6px; display: inline-block; margin-bottom: 4px; }
    .pkg { display: flex; justify-content: space-between; background: #f1f5f9; padding: 8px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-top: 10px; }
    .btn-print { display: block; width: 100%; max-width: 420px; margin: 0 auto 16px; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
    @media print { body { background: #fff; padding: 0; } .btn-print { display: none; } }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">Imprimir Etiqueta de Postagem</button>
  <div class="label">
    <div class="header">
      <div>
        <div class="carrier">${logistics?.transportadora || 'MELHOR ENVIO / CORREIOS'}</div>
        <div style="font-size:11px;color:#475569;">Pedido #${order?.numero_pedido || orderId} • ${qty} placas</div>
      </div>
      <div style="font-size:11px;font-weight:bold;text-align:right;">
        PESO: ${pkg.weight} kg<br/>
        ${pkg.width}x${pkg.length}x${pkg.height} cm
      </div>
    </div>
    <div class="tracking">${tracking}</div>
    <div class="section">
      <div class="tag">Destinatário</div><br/>
      <strong>${logistics?.destinatario_nome || profile?.nome || 'Revendedor'}</strong><br/>
      ${logistics?.logradouro || profile?.logradouro || ''}, ${logistics?.numero || profile?.numero || 'S/N'} ${logistics?.complemento || profile?.complemento || ''}<br/>
      ${logistics?.bairro || profile?.bairro || ''} — ${logistics?.cidade || profile?.cidade || ''} / ${logistics?.uf || profile?.estado || ''}<br/>
      <strong>CEP: ${logistics?.cep || profile?.cep || 'Não informado'}</strong>
    </div>
    <div class="section">
      <div class="tag" style="background:#475569;">Remetente</div><br/>
      <strong>${settings.origem_nome}</strong> (${settings.origem_cpf_cnpj})<br/>
      ${settings.origem_logradouro}, ${settings.origem_numero} ${settings.origem_complemento}<br/>
      ${settings.origem_bairro} — ${settings.origem_cidade} / ${settings.origem_uf}<br/>
      <strong>CEP: ${settings.origem_cep}</strong> • Tel: ${settings.origem_telefone}
    </div>
    <div class="pkg">
      <span>Embalagem: ${pkg.box_label}</span>
      <span>Placas: ${qty} un. (${pkg.plates_weight_kg}kg)</span>
    </div>
  </div>
</body>
</html>`);
    }

    return res.status(400).json({ sucesso: false, mensagem: 'Ação inválida em /api/integrations.' });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err?.message || 'Erro interno na central de integrações.',
    });
  }
}
