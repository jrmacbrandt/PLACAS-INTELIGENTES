import { Router } from 'express';
import { db } from '../db.js';
import { calculateShippingRates, generateShippingLabel } from '../services/melhor-envio.js';
import { logAudit } from '../services/audit.js';

export const shippingRouter = Router();

/**
 * Cotação em tempo real de fretes com o Melhor Envio (Jadlog, Correios, Loggi)
 */
shippingRouter.post('/calculate', async (req, res) => {
  try {
    const { cep_destino, quantidade_placas } = req.body || {};
    const qty = parseInt(quantidade_placas, 10) || 1;

    if (!cep_destino) {
      return res.status(400).json({ sucesso: false, mensagem: 'CEP de destino é obrigatório.' });
    }

    const opcoes = await calculateShippingRates({
      cep_destino,
      quantidade_placas: qty,
    });

    res.json({
      sucesso: true,
      origem_cep: process.env.ATELIER_ORIGIN_CEP || '22745271',
      destino_cep: cep_destino.replace(/\D/g, ''),
      quantidade: qty,
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
 * Emissão de Etiqueta de Envio no Melhor Envio
 * (Ação Administrativa na Esteira de Despacho)
 */
shippingRouter.post('/generate-label', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;

  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem emitir etiquetas de envio.' });
  }

  const { order_id } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido é obrigatório.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as any;
  if (!order) {
    return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
  }

  const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(order_id) as any;
  if (!logistics) {
    return res.status(404).json({ sucesso: false, mensagem: 'Dados de logística não encontrados para o pedido.' });
  }

  try {
    const result = await generateShippingLabel(order, logistics);

    if (result.sucesso) {
      db.prepare(`
        UPDATE order_logistics
        SET codigo_rastreamento = ?,
            etiqueta_url = ?,
            melhor_envio_cart_id = ?,
            correios_status = 'etiqueta_gerada',
            updated_at = datetime('now')
        WHERE order_id = ?
      `).run(result.codigo_rastreamento, result.etiqueta_url, result.cart_id, order_id);

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
        },
        ip_origem: req.ip,
      });

      return res.json({
        sucesso: true,
        codigo_rastreamento: result.codigo_rastreamento,
        etiqueta_url: result.etiqueta_url,
        modo: result.modo,
        mensagem: result.mensagem,
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Não foi possível gerar a etiqueta.' });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, mensagem: err?.message || 'Erro ao emitir etiqueta.' });
  }
});

/**
 * Visualização e Impressão da Etiqueta de Envio (HTML / PDF Print)
 */
shippingRouter.get('/labels/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  const logistics = db.prepare('SELECT * FROM order_logistics WHERE order_id = ?').get(orderId) as any;
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
        <div style="font-size: 10px; color: #666;">INTEGRAÇÃO MELHOR ENVIO</div>
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
      <div style="font-size: 9px; color: #666; margin-top: 4px;">Doc: ${order.revendedor_cpf_cnpj || '***'} · Tel: ${logistics?.responsavel_retirada_telefone || '***'}</div>
    </div>

    <div class="section-title">REMETENTE</div>
    <div class="sender-box">
      <strong>ATELIER DAS PLACAS</strong><br>
      Rua Araguaia, 1111 - Apto 403 · Freguesia (Jacarepaguá)<br>
      Rio de Janeiro - RJ · CEP: 22745-271<br>
      CNPJ: 06.865.841/719-00 · Contato: (21) 98091-4107
    </div>

    <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px; font-size: 9px; display: flex; justify-content: space-between;">
      <span><strong>Pedido:</strong> #${order.numero_pedido} (${order.quantidade_total} un.)</span>
      <span><strong>Prazo Est.:</strong> ${logistics?.prazo_dias || 4} dias úteis</span>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
