import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { generateLabeledQrPngBuffer } from '../src/utils/qrLabeledPngNode.js';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

const PUBLIC_APP_URL = 'https://placasinteligentes.vercel.app';

function getQueryParam(req: any, key: string): string | undefined {
  if (req?.query && req.query[key] !== undefined) {
    const val = req.query[key];
    return Array.isArray(val) ? val[0] : String(val);
  }
  try {
    const urlObj = new URL(req?.url || '/', 'https://placasinteligentes.vercel.app');
    const val = urlObj.searchParams.get(key);
    return val !== null ? val : undefined;
  } catch {
    return undefined;
  }
}

function generateShortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function generateRandomToken(length = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

function normalizePermanentUrl(tokenPublico: string, existingUrl?: string | null): string {
  if (existingUrl && existingUrl.startsWith('http') && !existingUrl.includes('localhost')) {
    return existingUrl;
  }
  return `${PUBLIC_APP_URL}/r/${tokenPublico}`;
}

async function getHighestSequentialPlateNumber(supabase: any): Promise<number> {
  let maxNum = 0;
  const extractNum = (code?: string | null) => {
    if (!code) return 0;
    const cleaned = String(code).trim().toUpperCase().replace('PLK-', '');
    const n = parseInt(cleaned, 10);
    return !isNaN(n) && n > 0 ? n : 0;
  };

  const [{ data: plates }, { data: orders }] = await Promise.all([
    supabase.from('plates').select('codigo_sequencial'),
    supabase.from('orders').select('placa_codigo_inicial, placa_codigo_final'),
  ]);

  if (plates) {
    for (const p of plates) {
      const n = extractNum(p.codigo_sequencial);
      if (n > maxNum) maxNum = n;
    }
  }
  if (orders) {
    for (const o of orders) {
      const n1 = extractNum(o.placa_codigo_inicial);
      const n2 = extractNum(o.placa_codigo_final);
      if (n1 > maxNum) maxNum = n1;
      if (n2 > maxNum) maxNum = n2;
    }
  }
  return maxNum;
}

async function uploadAndHydratePlates(supabase: any, plates: any[]): Promise<any[]> {
  const hydrated: any[] = [];
  for (const p of plates) {
    const urlPermanente = normalizePermanentUrl(p.token_publico, p.url_permanente);
    const pngBuffer = generateLabeledQrPngBuffer(urlPermanente, p.codigo_sequencial);
    const fileName = `QRCode_${p.codigo_sequencial}.png`;

    await supabase.storage.from('qrcodes').upload(fileName, pngBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

    const { data: pubData } = supabase.storage.from('qrcodes').getPublicUrl(fileName);
    const publicUrl = pubData.publicUrl;

    if (p.id && (!p.qrcode_url || p.url_permanente !== urlPermanente)) {
      try {
        await supabase
          .from('plates')
          .update({ qrcode_url: publicUrl, url_permanente: urlPermanente })
          .eq('id', p.id);
      } catch {}
    }

    hydrated.push({
      ...p,
      url_permanente: urlPermanente,
      qrcode_url: publicUrl,
      qrcode_data_url: `data:image/png;base64,${pngBuffer.toString('base64')}`,
    });
  }
  return hydrated;
}

export async function provisionOrderQrCodesServer(supabase: any, orderId: string) {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    throw new Error('Pedido não encontrado no banco de dados.');
  }

  const { data: existingPlates } = await supabase
    .from('plates')
    .select('*')
    .eq('order_id', orderId)
    .order('codigo_sequencial', { ascending: true });

  const now = new Date().toISOString();

  if (existingPlates && existingPlates.length >= order.quantidade_total) {
    const hydrated = await uploadAndHydratePlates(supabase, existingPlates);
    const codigoInicial = hydrated[0]?.codigo_sequencial || null;
    const codigoFinal = hydrated[hydrated.length - 1]?.codigo_sequencial || null;

    if (
      order.placa_codigo_inicial !== codigoInicial ||
      order.placa_codigo_final !== codigoFinal
    ) {
      await supabase
        .from('orders')
        .update({
          placa_codigo_inicial: codigoInicial,
          placa_codigo_final: codigoFinal,
          updated_at: now,
        })
        .eq('id', orderId);
    }

    return {
      sucesso: true,
      mensagem: 'QR Codes recuperados e sincronizados com o Supabase Storage.',
      ja_gerados: true,
      placa_codigo_inicial: codigoInicial,
      placa_codigo_final: codigoFinal,
      placas: hydrated,
    };
  }

  // Garante ordem de fabricação com schema compatível (origem e quantidade_solicitada)
  let { data: mfg } = await supabase
    .from('manufacturing_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (!mfg) {
    const mfgId = generateShortId('mfg');
    const newMfg = {
      id: mfgId,
      order_id: orderId,
      origem: order.origem === 'solicitacao_interna' ? 'solicitacao_interna' : 'compra_revendedor',
      quantidade_solicitada: order.quantidade_total,
      quantidade_produzida: order.quantidade_total,
      quantidade_aprovada: 0,
      quantidade_reprovada: 0,
      status: order.status === 'em_producao' ? 'em_producao' : 'aguardando_producao',
      created_at: now,
      updated_at: now,
    };
    const { error: mfgErr } = await supabase.from('manufacturing_orders').insert(newMfg);
    if (!mfgErr) {
      mfg = newMfg;
    }
  }

  const currentCount = existingPlates ? existingPlates.length : 0;
  const needed = Math.max(0, order.quantidade_total - currentCount);

  const parseSeqNum = (str?: string | null) => {
    if (!str) return null;
    const n = parseInt(String(str).trim().toUpperCase().replace('PLK-', ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
  };
  const preIni = parseSeqNum(order.placa_codigo_inicial);
  const preFim = parseSeqNum(order.placa_codigo_final);

  let usePresetRange =
    currentCount === 0 &&
    preIni !== null &&
    preFim !== null &&
    preFim - preIni + 1 === needed;

  if (usePresetRange) {
    const presetCodes: string[] = [];
    for (let s = preIni!; s <= preFim!; s++) {
      presetCodes.push(`PLK-${String(s).padStart(6, '0')}`);
    }
    const { data: conflictPlates } = await supabase
      .from('plates')
      .select('codigo_sequencial, order_id')
      .in('codigo_sequencial', presetCodes);

    if (conflictPlates && conflictPlates.length > 0) {
      const hasOtherOrder = conflictPlates.some((cp: any) => cp.order_id && cp.order_id !== orderId);
      if (hasOtherOrder) {
        usePresetRange = false;
      } else {
        // Vincula placas já existentes no estoque ao pedido
        for (const cp of conflictPlates) {
          await supabase
            .from('plates')
            .update({
              order_id: orderId,
              revendedor_id: order.revendedor_id,
              manufacturing_order_id: mfg?.id || null,
              updated_at: now,
            })
            .eq('codigo_sequencial', cp.codigo_sequencial);
        }
      }
    }
  }

  // Re-busca placas vinculadas após eventual aproveitamento de intervalo pré-definido
  const { data: refreshedPlates } = await supabase
    .from('plates')
    .select('*')
    .eq('order_id', orderId)
    .order('codigo_sequencial', { ascending: true });

  const actualExisting = refreshedPlates || [];
  const stillNeeded = Math.max(0, order.quantidade_total - actualExisting.length);
  const highestNum = await getHighestSequentialPlateNumber(supabase);

  const newPlatesToInsert: any[] = [];
  for (let i = 1; i <= stillNeeded; i++) {
    const seqNum =
      usePresetRange && actualExisting.length === 0 ? preIni! + (i - 1) : highestNum + i;
    const codigoSequencial = `PLK-${String(seqNum).padStart(6, '0')}`;
    const tokenPublico = generateRandomToken(12);
    const urlPermanente = `${PUBLIC_APP_URL}/r/${tokenPublico}`;

    newPlatesToInsert.push({
      id: generateShortId('plt'),
      manufacturing_order_id: mfg?.id || null,
      order_id: orderId,
      revendedor_id: order.revendedor_id,
      codigo_sequencial: codigoSequencial,
      token_publico: tokenPublico,
      url_permanente: urlPermanente,
      status_fisico: order.status === 'em_producao' ? 'em_producao' : 'planejada',
      status_digital: 'inativa',
      status_nfc: 'instalado',
      data_fabricacao: now,
      created_at: now,
      updated_at: now,
    });
  }

  if (newPlatesToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('plates').insert(newPlatesToInsert);
    if (insertErr) {
      throw new Error(`Erro ao salvar placas no Supabase: ${insertErr.message}`);
    }
  }

  const allOrderPlates = [...actualExisting, ...newPlatesToInsert].sort((a, b) =>
    String(a.codigo_sequencial).localeCompare(String(b.codigo_sequencial))
  );

  const hydrated = await uploadAndHydratePlates(supabase, allOrderPlates);
  const codigoInicial = hydrated[0]?.codigo_sequencial || null;
  const codigoFinal = hydrated[hydrated.length - 1]?.codigo_sequencial || null;

  await supabase
    .from('orders')
    .update({
      placa_codigo_inicial: codigoInicial,
      placa_codigo_final: codigoFinal,
      updated_at: now,
    })
    .eq('id', orderId);

  return {
    sucesso: true,
    mensagem: `${hydrated.length} QR Codes gerados e armazenados no bucket 'qrcodes' (${codigoInicial} a ${codigoFinal})!`,
    ja_gerados: false,
    placa_codigo_inicial: codigoInicial,
    placa_codigo_final: codigoFinal,
    placas: hydrated,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body =
      req.method === 'POST'
        ? typeof req.body === 'string'
          ? JSON.parse(req.body || '{}')
          : req.body || {}
        : {};
    const action = getQueryParam(req, 'action') || body.action;

    // 1. Geração de QR Codes de um Pedido (POST/GET ?action=generate-order)
    if (action === 'generate-order') {
      const orderId = getQueryParam(req, 'order_id') || body.order_id;
      if (!orderId) {
        return res.status(400).json({ sucesso: false, mensagem: 'order_id é obrigatório.' });
      }
      const result = await provisionOrderQrCodesServer(supabase, orderId);
      return res.status(200).json(result);
    }

    // 2. Consulta (com auto-provisão se aprovado/pago) das placas e QR Codes do Pedido
    if (action === 'get-order-plates') {
      const orderId = getQueryParam(req, 'order_id') || body.order_id;
      if (!orderId) {
        return res.status(400).json({ sucesso: false, mensagem: 'order_id é obrigatório.' });
      }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      const { data: plates } = await supabase
        .from('plates')
        .select('*')
        .eq('order_id', orderId)
        .order('codigo_sequencial', { ascending: true });

      const existingPlates = plates || [];
      const isApprovedOrPaid =
        order &&
        (order.status === 'aprovado' ||
          order.status === 'pago' ||
          order.status === 'em_producao' ||
          order.status === 'concluido' ||
          order.origem === 'solicitacao_interna');

      if (order && existingPlates.length < order.quantidade_total && isApprovedOrPaid) {
        const genRes = await provisionOrderQrCodesServer(supabase, orderId);
        return res.status(200).json({
          sucesso: true,
          total_placas: genRes.placas.length,
          placa_codigo_inicial: genRes.placa_codigo_inicial,
          placa_codigo_final: genRes.placa_codigo_final,
          placas: genRes.placas,
        });
      }

      const hydrated = await uploadAndHydratePlates(supabase, existingPlates);
      const codigoInicial = hydrated[0]?.codigo_sequencial || order?.placa_codigo_inicial || null;
      const codigoFinal =
        hydrated[hydrated.length - 1]?.codigo_sequencial || order?.placa_codigo_final || null;

      if (
        order &&
        codigoInicial &&
        codigoFinal &&
        (order.placa_codigo_inicial !== codigoInicial || order.placa_codigo_final !== codigoFinal)
      ) {
        await supabase
          .from('orders')
          .update({
            placa_codigo_inicial: codigoInicial,
            placa_codigo_final: codigoFinal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }

      return res.status(200).json({
        sucesso: true,
        total_placas: hydrated.length,
        placa_codigo_inicial: codigoInicial,
        placa_codigo_final: codigoFinal,
        placas: hydrated,
      });
    }

    // 3. Atribuição de intervalo de placas (de estoque ou novas) a um pedido
    if (action === 'assign-range') {
      const orderId = getQueryParam(req, 'order_id') || body.order_id;
      const codigoInicial = body.codigo_inicial;
      const codigoFinal = body.codigo_final;

      if (!orderId || !codigoInicial || !codigoFinal) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Informe o pedido, código inicial e código final.',
        });
      }

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) {
        return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
      }

      const parseNum = (str: string) => {
        const cleaned = String(str || '').trim().toUpperCase().replace('PLK-', '');
        const n = parseInt(cleaned, 10);
        return isNaN(n) || n <= 0 ? null : n;
      };

      const numIni = parseNum(codigoInicial);
      const numFim = parseNum(codigoFinal);
      if (!numIni || !numFim || numFim < numIni) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Intervalo inválido. Use o formato PLK-000001.',
        });
      }

      const expectedCount = numFim - numIni + 1;
      if (expectedCount !== order.quantidade_total) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `O intervalo selecionado possui ${expectedCount} placas, mas o pedido #${order.numero_pedido} exige exatamente ${order.quantidade_total} unidades.`,
        });
      }

      const formattedIni = `PLK-${String(numIni).padStart(6, '0')}`;
      const formattedFim = `PLK-${String(numFim).padStart(6, '0')}`;
      const now = new Date().toISOString();

      let { data: mfg } = await supabase
        .from('manufacturing_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!mfg) {
        const mfgId = generateShortId('mfg');
        const newMfg = {
          id: mfgId,
          order_id: orderId,
          origem: order.origem === 'solicitacao_interna' ? 'solicitacao_interna' : 'compra_revendedor',
          quantidade_solicitada: order.quantidade_total,
          quantidade_produzida: order.quantidade_total,
          quantidade_aprovada: 0,
          quantidade_reprovada: 0,
          status: 'aguardando_producao',
          created_at: now,
          updated_at: now,
        };
        const { error: mfgErr } = await supabase.from('manufacturing_orders').insert(newMfg);
        if (!mfgErr) {
          mfg = newMfg;
        }
      }

      // Verifica conflitos antes de desvincular
      for (let n = numIni; n <= numFim; n++) {
        const code = `PLK-${String(n).padStart(6, '0')}`;
        const { data: existing } = await supabase
          .from('plates')
          .select('id, order_id, codigo_sequencial')
          .eq('codigo_sequencial', code)
          .maybeSingle();

        if (existing && existing.order_id && existing.order_id !== orderId) {
          return res.status(400).json({
            sucesso: false,
            mensagem: `A placa ${code} já pertence a outro pedido.`,
          });
        }
      }

      // Libera placas anteriormente vinculadas a este pedido
      await supabase
        .from('plates')
        .update({ order_id: null, revendedor_id: null, manufacturing_order_id: null, updated_at: now })
        .eq('order_id', orderId);

      const assignedPlates: any[] = [];
      for (let n = numIni; n <= numFim; n++) {
        const code = `PLK-${String(n).padStart(6, '0')}`;
        const { data: existing } = await supabase
          .from('plates')
          .select('*')
          .eq('codigo_sequencial', code)
          .maybeSingle();

        if (existing) {
          const urlPermanente = normalizePermanentUrl(existing.token_publico, existing.url_permanente);
          const { data: updatedPlate } = await supabase
            .from('plates')
            .update({
              order_id: orderId,
              revendedor_id: order.revendedor_id,
              manufacturing_order_id: mfg?.id || null,
              url_permanente: urlPermanente,
              updated_at: now,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          assignedPlates.push(updatedPlate || { ...existing, order_id: orderId, url_permanente: urlPermanente });
        } else {
          const id = generateShortId('plt');
          const tokenPublico = generateRandomToken(12);
          const urlPermanente = `${PUBLIC_APP_URL}/r/${tokenPublico}`;
          const newPlate = {
            id,
            manufacturing_order_id: mfg?.id || null,
            order_id: orderId,
            revendedor_id: order.revendedor_id,
            codigo_sequencial: code,
            token_publico: tokenPublico,
            url_permanente: urlPermanente,
            status_fisico: 'planejada',
            status_digital: 'inativa',
            status_nfc: 'instalado',
            data_fabricacao: now,
            created_at: now,
            updated_at: now,
          };
          await supabase.from('plates').insert(newPlate);
          assignedPlates.push(newPlate);
        }
      }

      const hydrated = await uploadAndHydratePlates(supabase, assignedPlates);

      // Regra Item 9: Se TODAS as placas atribuídas já estavam marcadas como produzidas/aprovadas,
      // o pedido pula a etapa de produção e vai direto para expedição / retirada!
      const allPreProduced = assignedPlates.length > 0 && assignedPlates.every(
        (p: any) => p.status_fisico === 'produzida' || p.status_fisico === 'aprovada'
      );

      const nextOrderStatus = allPreProduced
        ? (order.origem === 'solicitacao_interna' || order.status === 'pago' || order.status === 'aprovado' ? 'aprovado' : order.status)
        : order.status;

      if (allPreProduced) {
        if (mfg) {
          await supabase
            .from('manufacturing_orders')
            .update({ status: 'producao_concluida', updated_at: now })
            .eq('id', mfg.id);
        }
        const modalidade = order.modalidade_entrega || 'correios';
        if (modalidade === 'retirada') {
          await supabase
            .from('order_logistics')
            .update({ retirada_status: 'pronta_para_retirada', updated_at: now })
            .eq('order_id', orderId);
        } else {
          await supabase
            .from('order_logistics')
            .update({ correios_status: 'aguardando_postagem', updated_at: now })
            .eq('order_id', orderId);
        }
      }

      await supabase
        .from('orders')
        .update({
          placa_codigo_inicial: formattedIni,
          placa_codigo_final: formattedFim,
          status: nextOrderStatus,
          updated_at: now,
        })
        .eq('id', orderId);

      return res.status(200).json({
        sucesso: true,
        mensagem: allPreProduced
          ? `Placas ${formattedIni} até ${formattedFim} (já prontas no estoque) atribuídas ao pedido #${order.numero_pedido}! Produção pulada com sucesso para expedição/retirada.`
          : `Placas ${formattedIni} até ${formattedFim} atribuídas com sucesso ao pedido #${order.numero_pedido}!`,
        placa_codigo_inicial: formattedIni,
        placa_codigo_final: formattedFim,
        total_atribuidas: expectedCount,
        placas_ja_produzidas: allPreProduced,
        placas: hydrated,
      });
    }

    // 4. Geração antecipada de lote para estoque livre (standby / aguardando atribuição)
    if (action === 'generate-advance') {
      const qty = Math.min(Math.max(1, Number(body.quantidade) || 1), 500);
      const statusInicial = body.status_fisico === 'produzida' ? 'produzida' : 'planejada';
      const highestNum = await getHighestSequentialPlateNumber(supabase);
      const now = new Date().toISOString();

      const newPlates: any[] = [];
      for (let i = 1; i <= qty; i++) {
        const seqNum = highestNum + i;
        const codigoSequencial = `PLK-${String(seqNum).padStart(6, '0')}`;
        const tokenPublico = generateRandomToken(12);
        const urlPermanente = `${PUBLIC_APP_URL}/r/${tokenPublico}`;

        newPlates.push({
          id: generateShortId('plt'),
          manufacturing_order_id: null,
          order_id: null,
          revendedor_id: null,
          codigo_sequencial: codigoSequencial,
          token_publico: tokenPublico,
          url_permanente: urlPermanente,
          status_fisico: statusInicial,
          status_digital: 'inativa',
          status_nfc: 'instalado',
          data_fabricacao: now,
          created_at: now,
          updated_at: now,
        });
      }

      const { error: insertErr } = await supabase.from('plates').insert(newPlates);
      if (insertErr) {
        return res.status(500).json({
          sucesso: false,
          mensagem: `Erro ao criar lote antecipado no Supabase: ${insertErr.message}`,
        });
      }

      const hydrated = await uploadAndHydratePlates(supabase, newPlates);
      const codigoInicial = hydrated[0]?.codigo_sequencial || '';
      const codigoFinal = hydrated[hydrated.length - 1]?.codigo_sequencial || '';

      return res.status(200).json({
        sucesso: true,
        mensagem: `${qty} placas geradas e salvas no bucket 'qrcodes' (${codigoInicial} até ${codigoFinal})!`,
        total_geradas: qty,
        codigo_inicial: codigoInicial,
        codigo_final: codigoFinal,
        placas: hydrated,
      });
    }

    // 5. Consulta pública de placa para Autoativação de Venda Direta (/ativar)
    if (action === 'check-plate') {
      const rawCode = String(body.codigo_sequencial || getQueryParam(req, 'codigo') || '').trim();
      const codeDigits = rawCode.replace(/\D/g, '');
      const codeFormatted = codeDigits ? `PLK-${String(parseInt(codeDigits, 10)).padStart(6, '0')}` : rawCode.toUpperCase();

      const { data: plate, error } = await supabase
        .from('plates')
        .select('id, codigo_sequencial, status_digital, nome_estabelecimento, contato_telefone, url_destino, tipo_destino, categoria_estabelecimento, data_ativacao, url_permanente')
        .eq('codigo_sequencial', codeFormatted)
        .maybeSingle();

      if (error || !plate) {
        return res.status(404).json({
          sucesso: false,
          mensagem: `A placa com o código "${codeFormatted}" não foi encontrada no sistema. Verifique a numeração impressa na sua placa.`,
        });
      }

      const cat = String(plate.categoria_estabelecimento || '');
      const hasPin = cat.includes('#pin:');

      return res.status(200).json({
        sucesso: true,
        placa: {
          id: plate.id,
          codigo_sequencial: plate.codigo_sequencial,
          status_digital: plate.status_digital,
          nome_estabelecimento: plate.nome_estabelecimento,
          contato_telefone: plate.contato_telefone,
          url_destino: plate.url_destino,
          tipo_destino: plate.tipo_destino,
          url_permanente: plate.url_permanente,
          data_ativacao: plate.data_ativacao,
          ja_ativada: plate.status_digital === 'ativa' && Boolean(plate.url_destino),
          tem_pin: hasPin,
        },
      });
    }

    // 6. Autoativação e Edição pelo Cliente Final Lojista (/ativar)
    if (action === 'self-activate') {
      const rawCode = String(body.codigo_sequencial || '').trim();
      const codeDigits = rawCode.replace(/\D/g, '');
      const codeFormatted = codeDigits ? `PLK-${String(parseInt(codeDigits, 10)).padStart(6, '0')}` : rawCode.toUpperCase();
      const nomeEstabelecimento = String(body.nome_estabelecimento || '').trim();
      const contatoWhatsapp = String(body.contato_whatsapp || '').trim();
      let urlDestino = String(body.url_destino || '').trim();
      const pin = String(body.pin || '').replace(/\D/g, '').slice(0, 4);

      if (!codeFormatted) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe o código da sua placa (ex: PLK-000008 ou apenas o número).' });
      }

      if (!urlDestino) {
        return res.status(400).json({ sucesso: false, mensagem: 'Informe o link de destino (Instagram, WhatsApp, Avaliação Google, Cardápio, etc.).' });
      }

      if (!/^https?:\/\//i.test(urlDestino)) {
        urlDestino = `https://${urlDestino}`;
      }

      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ sucesso: false, mensagem: 'O PIN de segurança deve conter obrigatoriamente 4 dígitos numéricos.' });
      }

      const { data: plate, error } = await supabase
        .from('plates')
        .select('*')
        .eq('codigo_sequencial', codeFormatted)
        .maybeSingle();

      if (error || !plate) {
        return res.status(404).json({ sucesso: false, mensagem: `Placa ${codeFormatted} não encontrada.` });
      }

      const cat = String(plate.categoria_estabelecimento || '');
      const isAlreadyActive = plate.status_digital === 'ativa' && Boolean(plate.url_destino);

      // Se já estava ativada com PIN anterior, valida o PIN informado
      if (isAlreadyActive && cat.includes('#pin:')) {
        const match = /#pin:(\d+)/.exec(cat);
        const existingPin = match ? match[1] : null;
        if (existingPin && existingPin !== pin) {
          return res.status(403).json({
            sucesso: false,
            mensagem: 'PIN de segurança incorreto. Digite o mesmo PIN de 4 dígitos cadastrado na ativação desta placa.',
          });
        }
      }

      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        status_digital: 'ativa',
        status_fisico: 'produzida',
        url_destino: urlDestino,
        tipo_destino: body.tipo_destino || 'personalizado',
        categoria_estabelecimento: `venda_direta#pin:${pin}`,
        updated_at: now,
      };

      if (!plate.data_ativacao) {
        updatePayload.data_ativacao = now;
      }
      if (nomeEstabelecimento) {
        updatePayload.nome_estabelecimento = nomeEstabelecimento;
        updatePayload.contato_nome = nomeEstabelecimento;
      }
      if (contatoWhatsapp) {
        updatePayload.contato_telefone = contatoWhatsapp;
      }

      const { data: updatedPlate, error: updateErr } = await supabase
        .from('plates')
        .update(updatePayload)
        .eq('id', plate.id)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ sucesso: false, mensagem: `Erro ao ativar placa: ${updateErr.message}` });
      }

      // Registra histórico de alteração de destino
      try {
        await supabase.from('destination_history').insert({
          id: generateShortId('hist'),
          plate_id: plate.id,
          tipo_destino: body.tipo_destino || 'personalizado',
          url_destino: urlDestino,
          alterado_por: 'lojista_autoativacao',
          created_at: now,
        });
      } catch {}

      return res.status(200).json({
        sucesso: true,
        mensagem: `Placa ${codeFormatted} ativada com sucesso! Seu link já está no ar para leitura via NFC e QR Code.`,
        placa: updatedPlate,
      });
    }

    // 7. Listagem de Placas de Venda Direta para o Painel Admin
    if (action === 'list-venda-direta') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const { data: plates, error } = await supabase
        .from('plates')
        .select('*')
        .ilike('categoria_estabelecimento', 'venda_direta%')
        .order('updated_at', { ascending: false });

      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(200).json({
        sucesso: true,
        placas: plates || [],
      });
    }

    // 8. Edição e Reset de PIN pelo Administrador na aba Venda Direta
    if (action === 'admin-update-venda-direta') {
      const plateId = String(body.plate_id || '').trim();
      const rawCode = String(body.codigo_sequencial || '').trim();
      if (!plateId && !rawCode) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID ou código da placa é obrigatório.' });
      }

      const query = supabase.from('plates').select('*');
      const { data: plate } = plateId
        ? await query.eq('id', plateId).single()
        : await query.eq('codigo_sequencial', rawCode).single();
      if (!plate) {
        return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
      }

      const now = new Date().toISOString();
      const updateData: Record<string, any> = { updated_at: now };

      if (body.url_destino !== undefined) {
        let url = String(body.url_destino).trim();
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        updateData.url_destino = url;
      }
      if (body.nome_estabelecimento !== undefined) {
        updateData.nome_estabelecimento = String(body.nome_estabelecimento).trim();
      }
      if (body.contato_telefone !== undefined) {
        updateData.contato_telefone = String(body.contato_telefone).trim();
      }
      if (body.status_digital !== undefined) {
        updateData.status_digital = body.status_digital;
      }
      const incomingPin = body.novo_pin !== undefined ? body.novo_pin : body.pin;
      if (incomingPin !== undefined && String(incomingPin).trim() !== '') {
        const pin = String(incomingPin).replace(/\D/g, '').slice(0, 4);
        if (!/^\d{4}$/.test(pin)) {
          return res.status(400).json({ sucesso: false, mensagem: 'O PIN de segurança deve conter exatamente 4 dígitos numéricos.' });
        }
        updateData.categoria_estabelecimento = `venda_direta#pin:${pin}`;
      }

      const { data: updated, error } = await supabase
        .from('plates')
        .update(updateData)
        .eq('id', plate.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: `Placa ${plate.codigo_sequencial} atualizada com sucesso pelo Administrador.`,
        placa: updated,
      });
    }

    // 5. Geração/Upload em lote de placas informadas no body.placas
    const items: Array<{ id?: string; codigo_sequencial: string; url_permanente: string }> =
      Array.isArray(body.placas) ? body.placas : [];

    if (items.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nenhuma placa informada para geração de QR Code.',
      });
    }

    const resultados: Array<{
      id?: string;
      codigo_sequencial: string;
      url_permanente: string;
      qrcode_url: string;
    }> = [];

    for (const item of items) {
      if (!item.codigo_sequencial || !item.url_permanente) continue;

      const pngBuffer = generateLabeledQrPngBuffer(item.url_permanente, item.codigo_sequencial);
      const fileName = `QRCode_${item.codigo_sequencial}.png`;

      await supabase.storage.from('qrcodes').upload(fileName, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

      const { data: pubData } = supabase.storage.from('qrcodes').getPublicUrl(fileName);
      const publicUrl = pubData.publicUrl;

      try {
        if (item.id) {
          await supabase.from('plates').update({ qrcode_url: publicUrl }).eq('id', item.id);
        } else {
          await supabase
            .from('plates')
            .update({ qrcode_url: publicUrl })
            .eq('codigo_sequencial', item.codigo_sequencial);
        }
      } catch {}

      resultados.push({
        id: item.id,
        codigo_sequencial: item.codigo_sequencial,
        url_permanente: item.url_permanente,
        qrcode_url: publicUrl,
      });
    }

    return res.status(200).json({
      sucesso: true,
      resultados,
    });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err?.message || 'Erro ao gerar e armazenar QR Codes no Supabase Storage.',
    });
  }
}
