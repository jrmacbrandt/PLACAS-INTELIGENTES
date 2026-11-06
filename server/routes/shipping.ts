import { Router } from 'express';
import { db } from '../db.js';
import {
  calculateShippingRates,
  generateShippingLabel,
  addShipmentToCart,
  checkoutShipmentOrders,
  generateShipmentLabels,
  printShipmentLabels,
  trackShipments,
  checkAndCancelShipmentOrder,
  createOAuthState,
  verifyOAuthState,
  buildOAuthAuthorizeUrl,
  exchangeAuthorizationCode,
  verifyMelhorEnvioWebhookSignature,
  mapWebhookEventToLogisticsStatus,
} from '../services/melhor-envio.js';
import { DEFAULT_INTEGRATION_SETTINGS, calculateDynamicPackage } from '../../src/utils/shippingCalculator.js';
import { logAudit } from '../services/audit.js';
import type { IntegrationSettings } from '../../src/types.js';

export const shippingRouter = Router();

const processedWebhookIds = new Set<string>();

function loadLocalSettings(): IntegrationSettings {
  let saved: Partial<IntegrationSettings> = {};
  try {
    const row = db
      .prepare('SELECT dados_novos FROM audit_logs WHERE id = ?')
      .get('cfg_integrations_v1') as { dados_novos?: string } | undefined;
    if (row?.dados_novos) {
      saved = JSON.parse(row.dados_novos);
    }
  } catch {}

  const merged: IntegrationSettings = {
    ...DEFAULT_INTEGRATION_SETTINGS,
    ...saved,
  };

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

  // Carrega token OAuth2 específico do ambiente se disponível
  try {
    const tokenRow = db
      .prepare('SELECT * FROM melhor_envio_tokens WHERE environment = ?')
      .get(merged.melhor_envio_env) as any;
    if (tokenRow?.access_token) {
      merged.melhor_envio_token = tokenRow.access_token;
      merged.melhor_envio_refresh_token = tokenRow.refresh_token || merged.melhor_envio_refresh_token;
      merged.melhor_envio_token_expires_at = tokenRow.expires_at || merged.melhor_envio_token_expires_at;
    }
  } catch {}

  return merged;
}

/**
 * 1. Cotação em tempo real de fretes com o Melhor Envio (Jadlog, Correios, Loggi)
 */
shippingRouter.post('/calculate', async (req, res) => {
  try {
    const { cep_destino, quantidade_placas, custom_settings } = req.body || {};
    const qty = Math.max(1, parseInt(quantidade_placas, 10) || 1);

    if (!cep_destino) {
      return res.status(400).json({ sucesso: false, mensagem: 'CEP de destino é obrigatório.' });
    }

    const settings = { ...loadLocalSettings(), ...(custom_settings || {}) };
    const pkg = calculateDynamicPackage(qty, settings);
    const opcoes = await calculateShippingRates({
      cep_destino,
      quantidade_placas: qty,
      settings,
    });

    res.json({
      sucesso: true,
      origem_cep: settings.origem_cep || process.env.ATELIER_ORIGIN_CEP || '22745271',
      destino_cep: String(cep_destino).replace(/\D/g, ''),
      quantidade: qty,
      pacote: pkg,
      opcoes,
    });
  } catch (error: any) {
    res.status(400).json({
      sucesso: false,
      mensagem: error?.message || 'Falha ao cotar frete com o Melhor Envio.',
    });
  }
});

/**
 * 2. OAuth2: Gerar URL de autorização com state anti-CSRF
 */
shippingRouter.get('/oauth/authorize-url', (req, res) => {
  try {
    const settings = loadLocalSettings();
    const clientId = String(req.query.client_id || settings.melhor_envio_client_id || '').trim();
    const redirectUri = String(req.query.redirect_uri || settings.melhor_envio_redirect_uri || '').trim();
    const env = (req.query.env as any) || settings.melhor_envio_env || 'sandbox';
    const secret = settings.melhor_envio_client_secret || 'atelier_oauth_state_secret';

    const state = createOAuthState(secret, env);
    const url = buildOAuthAuthorizeUrl({
      clientId,
      redirectUri,
      environment: env,
      scopes: settings.melhor_envio_scopes,
      state,
    });

    res.json({ sucesso: true, authorize_url: url, state, environment: env });
  } catch (err: any) {
    res.status(400).json({ sucesso: false, mensagem: err?.message || 'Erro ao gerar URL OAuth2.' });
  }
});

/**
 * 3. OAuth2: Callback de retorno do Melhor Envio para troca de code por access_token e refresh_token
 */
shippingRouter.get('/oauth/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    if (!code) {
      return res.status(400).json({ sucesso: false, mensagem: 'Código de autorização OAuth2 (code) ausente.' });
    }

    const settings = loadLocalSettings();
    const secret = settings.melhor_envio_client_secret || 'atelier_oauth_state_secret';
    const verification = verifyOAuthState(state, secret);
    if (!verification.valid) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Falha na validação CSRF do state OAuth2: ${verification.reason}`,
      });
    }

    const env = verification.environment || settings.melhor_envio_env;
    const bundle = await exchangeAuthorizationCode({
      code,
      clientId: settings.melhor_envio_client_id || '',
      clientSecret: settings.melhor_envio_client_secret || '',
      redirectUri: settings.melhor_envio_redirect_uri || '',
      environment: env,
      userAgent: settings.melhor_envio_user_agent,
    });

    db.prepare(`
      INSERT INTO melhor_envio_tokens (environment, access_token, refresh_token, expires_at, refresh_expires_at, scopes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(environment) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        refresh_expires_at = excluded.refresh_expires_at,
        scopes = excluded.scopes,
        updated_at = datetime('now')
    `).run(
      bundle.environment,
      bundle.access_token,
      bundle.refresh_token,
      bundle.expires_at,
      bundle.refresh_expires_at,
      bundle.scopes
    );

    res.redirect('/admin?oauth_melhor_envio=success');
  } catch (err: any) {
    res.status(400).json({ sucesso: false, mensagem: err?.message || 'Erro no callback OAuth2.' });
  }
});

/**
 * 4. Emissão / Inserção de Etiqueta de Envio no Melhor Envio
 * Respeita trava de confirmação explícita para compra financeira (confirm_checkout)
 */
shippingRouter.post('/generate-label', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem emitir etiquetas de envio.' });
  }

  const { order_id, confirm_checkout = false, invoice_key = null } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido é obrigatório.' });
  }

  const order = db.prepare(`
    SELECT o.*, p.email as revendedor_email, p.cpf_cnpj as revendedor_cpf_cnpj, p.telefone as revendedor_telefone, p.nome as revendedor_nome
    FROM orders o
    LEFT JOIN profiles p ON o.revendedor_id = p.id
    WHERE o.id = ?
  `).get(order_id) as any;

  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(order_id) as any;
  if (!logistics) {
    return res.status(404).json({ sucesso: false, mensagem: 'Dados de logística não encontrados para o pedido.' });
  }

  try {
    const settings = loadLocalSettings();
    const result = await generateShippingLabel(order, logistics, {
      settings,
      explicitCheckoutConfirmation: Boolean(confirm_checkout),
      invoiceKey: invoice_key,
    });

    if (result.sucesso) {
      db.prepare(`
        UPDATE order_logistics
        SET codigo_rastreamento = ?,
            etiqueta_url = ?,
            melhor_envio_cart_id = ?,
            melhor_envio_order_id = COALESCE(?, melhor_envio_order_id),
            melhor_envio_protocol = COALESCE(?, melhor_envio_protocol),
            melhor_envio_status = COALESCE(?, melhor_envio_status),
            correios_status = ?,
            updated_at = datetime('now')
        WHERE order_id = ?
      `).run(
        result.codigo_rastreamento,
        result.etiqueta_url,
        result.cart_id,
        result.melhor_envio_order_id || result.cart_id,
        result.protocol || null,
        result.status_etiqueta || 'gerada',
        result.status_etiqueta === 'no_carrinho' ? 'aguardando_postagem' : 'etiqueta_gerada',
        order_id
      );

      logAudit({
        usuario_id: adminId,
        acao: 'GERACAO_ETIQUETA_MELHOR_ENVIO',
        entidade: 'order_logistics',
        entidade_id: order_id,
        dados_novos: {
          transportadora: logistics.transportadora,
          servico: logistics.servico_frete,
          codigo_rastreamento: result.codigo_rastreamento,
          modo: result.modo,
          status_etiqueta: result.status_etiqueta,
        },
        ip_origem: req.ip,
      });

      return res.json(result);
    }

    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível gerar a etiqueta.' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, mensagem: err?.message || 'Erro ao emitir etiqueta.' });
  }
});

/**
 * 5. Rastreamento ativo de etiqueta no Melhor Envio
 */
shippingRouter.post('/tracking', async (req, res) => {
  try {
    const { order_id } = req.body || {};
    const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(order_id) as any;
    const meId = logistics?.melhor_envio_order_id || logistics?.melhor_envio_cart_id;
    if (!meId) {
      return res.status(400).json({ sucesso: false, mensagem: 'Pedido ainda não possui etiqueta vinculada no Melhor Envio.' });
    }
    const settings = loadLocalSettings();
    const track = await trackShipments({ orderIds: [meId], settings });
    return res.json(track);
  } catch (err: any) {
    return res.status(400).json({ sucesso: false, mensagem: err?.message || 'Erro ao consultar rastreamento.' });
  }
});

/**
 * 6. Cancelamento seguro de etiqueta no Melhor Envio
 */
shippingRouter.post('/cancel', async (req, res) => {
  try {
    const { order_id, description } = req.body || {};
    const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(order_id) as any;
    const meId = logistics?.melhor_envio_order_id || logistics?.melhor_envio_cart_id;
    if (!meId) {
      return res.status(400).json({ sucesso: false, mensagem: 'Etiqueta não encontrada para cancelamento.' });
    }
    const settings = loadLocalSettings();
    const cancelRes = await checkAndCancelShipmentOrder({
      orderId: meId,
      description,
      settings,
    });

    db.prepare(`
      UPDATE order_logistics
      SET melhor_envio_status = 'cancelada',
          correios_status = 'cancelado',
          updated_at = datetime('now')
      WHERE order_id = ?
    `).run(order_id);

    return res.json(cancelRes);
  } catch (err: any) {
    return res.status(400).json({ sucesso: false, mensagem: err?.message || 'Erro ao cancelar etiqueta.' });
  }
});

/**
 * 7. Webhook Oficial do Melhor Envio com validação HMAC-SHA256 (X-ME-Signature) e idempotência
 */
shippingRouter.all('/webhook', (req, res) => {
  try {
    // Handshake de validação cadastral do Melhor Envio
    if (req.method === 'GET' || !req.body || Object.keys(req.body).length === 0) {
      return res.status(200).json({ sucesso: true, mensagem: 'Endpoint de webhook Melhor Envio ativo.' });
    }

    const settings = loadLocalSettings();
    const secret =
      settings.melhor_envio_webhook_secret ||
      settings.melhor_envio_client_secret ||
      process.env.MELHOR_ENVIO_WEBHOOK_SECRET ||
      process.env.MELHOR_ENVIO_CLIENT_SECRET ||
      '';
    const signature = (req.headers['x-me-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

    if (secret && signature && !verifyMelhorEnvioWebhookSignature(rawBody, signature, secret)) {
      return res.status(401).json({ sucesso: false, mensagem: 'Assinatura X-ME-Signature inválida.' });
    }

    const mapped = mapWebhookEventToLogisticsStatus(req.body, processedWebhookIds);
    if (mapped.duplicate || mapped.ignored) {
      return res.status(200).json({ sucesso: true, duplicate: mapped.duplicate, ignored: mapped.ignored });
    }

    if (mapped.melhor_envio_order_id) {
      db.prepare(`
        UPDATE order_logistics
        SET melhor_envio_status = ?,
            correios_status = ?,
            codigo_rastreamento = COALESCE(?, codigo_rastreamento),
            melhor_envio_protocol = COALESCE(?, melhor_envio_protocol),
            webhook_last_event_id = ?,
            updated_at = datetime('now')
        WHERE melhor_envio_order_id = ? OR melhor_envio_cart_id = ?
      `).run(
        mapped.melhor_envio_status,
        mapped.correios_status,
        mapped.tracking_code,
        mapped.protocol,
        mapped.event_id,
        mapped.melhor_envio_order_id,
        mapped.melhor_envio_order_id
      );
    }

    return res.status(200).json({ sucesso: true, processed: mapped });
  } catch (err: any) {
    return res.status(500).json({ sucesso: false, mensagem: err?.message || 'Erro ao processar webhook.' });
  }
});

/**
 * 8. Visualização e Impressão da Etiqueta de Envio (HTML / PDF Print)
 */
shippingRouter.get('/labels/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(orderId) as any;
  const settings = loadLocalSettings();
  const pkg = calculateDynamicPackage(order.quantidade_total || 1, settings);
  const tracking = logistics?.codigo_rastreamento || `JAD-${order.numero_pedido}`;
  const carrier = logistics?.transportadora || 'Melhor Envio / Jadlog';
  const service = logistics?.servico_frete || '.Package';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta de Envio #${order.numero_pedido} - Atelier das Placas</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f1f5f9; display: flex; justify-content: center; }
    .label-box { width: 105mm; min-height: 148mm; background: #fff; border: 2px solid #000; padding: 12px; box-sizing: border-box; }
    .header { border-bottom: 2px solid #000; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .carrier { font-size: 16px; font-weight: 900; text-transform: uppercase; }
    .service-badge { background: #000; color: #fff; padding: 3px 8px; font-weight: bold; font-size: 11px; border-radius: 3px; }
    .barcode-area { text-align: center; margin: 12px 0; border: 1px dashed #999; padding: 8px; }
    .barcode-code { font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 2px; }
    .barcode-visual { height: 40px; background: repeating-linear-gradient(90deg, #000 0, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px); margin: 6px auto; width: 85%; }
    .section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #555; margin-bottom: 2px; }
    .address-box { border: 1px solid #000; padding: 8px; margin-bottom: 8px; border-radius: 4px; }
    .recipient-name { font-size: 13px; font-weight: bold; }
    .address-line { font-size: 11px; margin-top: 2px; }
    .cep-highlight { font-size: 15px; font-weight: 900; margin-top: 4px; }
    .sender-box { font-size: 10px; color: #333; border-top: 1px solid #ccc; padding-top: 6px; }
    .actions { position: fixed; top: 15px; right: 15px; }
    .btn-print { background: #0284c7; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    @media print {
      body { background: #fff; padding: 0; }
      .actions { display: none; }
      .label-box { border: 2px solid #000; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir Etiqueta</button>
  </div>

  <div class="label-box">
    <div class="header">
      <div>
        <div class="carrier">${carrier}</div>
        <div style="font-size: 10px; color: #666;">INTEGRAÇÃO MELHOR ENVIO • ${pkg.box_label}</div>
      </div>
      <div class="service-badge">${service}</div>
    </div>

    <div class="barcode-area">
      <div class="barcode-visual"></div>
      <div class="barcode-code">${tracking}</div>
    </div>

    <div class="section-title">DESTINATÁRIO</div>
    <div class="address-box">
      <div class="recipient-name">${logistics?.destinatario_nome || 'Revendedor Autorizado'}</div>
      <div class="address-line">${logistics?.logradouro || 'Rua Principal'}, ${logistics?.numero || 'S/N'} ${logistics?.complemento ? `- ${logistics.complemento}` : ''}</div>
      <div class="address-line">${logistics?.bairro || 'Bairro'} · ${logistics?.cidade || 'Cidade'} / ${logistics?.uf || 'UF'}</div>
      <div class="cep-highlight">CEP: ${logistics?.cep || '00000-000'}</div>
    </div>

    <div class="section-title">REMETENTE</div>
    <div class="sender-box">
      <strong>${settings.origem_nome || 'ATELIER DAS PLACAS'}</strong><br>
      ${settings.origem_logradouro}, ${settings.origem_numero} ${settings.origem_complemento ? `- ${settings.origem_complemento}` : ''} · ${settings.origem_bairro}<br>
      ${settings.origem_cidade} - ${settings.origem_uf} · CEP: ${settings.origem_cep}<br>
      Contato: ${settings.origem_telefone}
    </div>

    <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px; font-size: 9px; display: flex; justify-content: space-between;">
      <span><strong>Pedido:</strong> #${order.numero_pedido} (${order.quantidade_total} un. • ${pkg.weight}kg)</span>
      <span><strong>Prazo Est.:</strong> ${logistics?.prazo_dias || 4} dias úteis</span>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
