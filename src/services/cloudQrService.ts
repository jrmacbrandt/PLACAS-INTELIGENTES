import { supabase, SUPABASE_URL } from './supabaseClient.js';
import { generateLabeledQrDataUrlInBrowser } from '../utils/qrLabeledPng.js';

export function getPublicAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('ais-dev-')) {
      return origin;
    }
  }
  return 'https://placasinteligentes.vercel.app';
}

export function normalizePermanentUrl(tokenPublico: string, currentUrl?: string | null): string {
  const baseUrl = getPublicAppUrl();
  if (!currentUrl || currentUrl.includes('ais-dev-') || currentUrl.includes('localhost')) {
    return `${baseUrl}/r/${tokenPublico}`;
  }
  return currentUrl;
}

export function getStoragePublicUrl(codigoSequencial: string): string {
  const fileName = `QRCode_${codigoSequencial}.png`;
  const { data } = supabase.storage.from('qrcodes').getPublicUrl(fileName);
  return (
    data?.publicUrl ||
    `${SUPABASE_URL}/storage/v1/object/public/qrcodes/${fileName}`
  );
}

function generateRandomToken(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const randomValues = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

function generateShortId(prefix: string): string {
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${prefix}_${hex}`;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Gera DataURL PNG 400x456 local em memória com o código sequencial `PLK-XXXXXX` gravado na própria imagem
 * (usado tanto no upload para o Storage quanto na Regeneração On-Demand após 30 dias).
 */
export async function generateQrCodeDataUrl(urlPermanente: string, codigoSequencial = ''): Promise<string> {
  return generateLabeledQrDataUrlInBrowser(urlPermanente, codigoSequencial);
}

/**
 * Faz upload de um lote de QR Codes em formato PNG para o bucket `qrcodes` no Supabase Storage
 * e atualiza a coluna `qrcode_url` na tabela `plates` (nunca salva Base64 no banco).
 */
export async function uploadPlatesQrCodesToStorage(
  plates: Array<{ id?: string; codigo_sequencial: string; url_permanente: string }>
): Promise<Record<string, string>> {
  const urlMap: Record<string, string> = {};
  if (!plates || plates.length === 0) return urlMap;

  // 1. Tenta via Serverless Function /api/qrcodes (usa SUPABASE_SERVICE_ROLE_KEY e QRCode.toBuffer)
  try {
    const resp = await fetch('/api/qrcodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placas: plates }),
    });
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      const json = await resp.json();
      if (json.sucesso && Array.isArray(json.resultados)) {
        for (const item of json.resultados) {
          if (item.codigo_sequencial && item.qrcode_url) {
            urlMap[item.codigo_sequencial] = item.qrcode_url;
          }
        }
        if (Object.keys(urlMap).length === plates.length) {
          return urlMap;
        }
      }
    }
  } catch {
    // Fallback direto para upload via cliente Supabase abaixo
  }

  // 2. Fallback direto para o bucket `qrcodes` via @supabase/supabase-js
  for (const plate of plates) {
    if (!plate.codigo_sequencial || !plate.url_permanente) continue;
    try {
      const dataUrl = await generateQrCodeDataUrl(plate.url_permanente, plate.codigo_sequencial);
      const pngBytes = dataUrlToUint8Array(dataUrl);
      const fileName = `QRCode_${plate.codigo_sequencial}.png`;

      await supabase.storage.from('qrcodes').upload(fileName, pngBytes, {
        contentType: 'image/png',
        upsert: true,
      });

      const publicUrl = getStoragePublicUrl(plate.codigo_sequencial);
      urlMap[plate.codigo_sequencial] = publicUrl;

      // Salva apenas a URL do Storage na coluna `qrcode_url` (sem Base64)
      try {
        if (plate.id) {
          await supabase.from('plates').update({ qrcode_url: publicUrl }).eq('id', plate.id);
        } else {
          await supabase
            .from('plates')
            .update({ qrcode_url: publicUrl })
            .eq('codigo_sequencial', plate.codigo_sequencial);
        }
      } catch {
        // Ignora caso a coluna qrcode_url ainda não exista
      }
    } catch {
      urlMap[plate.codigo_sequencial] = getStoragePublicUrl(plate.codigo_sequencial);
    }
  }

  return urlMap;
}

/**
 * Enriquece cada placa com:
 * - `url_permanente` normalizada para o domínio da Vercel
 * - `qrcode_url`: URL pública no bucket `qrcodes` do Supabase Storage
 * - `qrcode_data_url`: DataURL PNG 400x400 instantânea (garante exibição e download mesmo após limpeza de 30 dias)
 */
export async function enrichPlatesWithQrCodes(
  plates: any[],
  uploadToStorage = false
): Promise<any[]> {
  if (!plates || plates.length === 0) return [];

  const normalizedPlates = plates.map((p) => {
    const urlPermanente = normalizePermanentUrl(p.token_publico, p.url_permanente);
    return {
      ...p,
      url_permanente: urlPermanente,
    };
  });

  let storageUrls: Record<string, string> = {};
  if (uploadToStorage) {
    storageUrls = await uploadPlatesQrCodesToStorage(
      normalizedPlates.map((p) => ({
        id: p.id,
        codigo_sequencial: p.codigo_sequencial,
        url_permanente: p.url_permanente,
      }))
    );
  }

  return Promise.all(
    normalizedPlates.map(async (plate) => {
      const dataUrl = await generateQrCodeDataUrl(plate.url_permanente, plate.codigo_sequencial);
      const qrcodeUrl =
        storageUrls[plate.codigo_sequencial] ||
        plate.qrcode_url ||
        getStoragePublicUrl(plate.codigo_sequencial);

      return {
        ...plate,
        qrcode_url: qrcodeUrl,
        qrcode_data_url: dataUrl,
      };
    })
  );
}

/**
 * Descobre o maior número sequencial PLK-XXXXXX já utilizado no banco Supabase.
 */
export async function getHighestSequentialPlateNumber(): Promise<number> {
  const [{ data: plates }, { data: orders }] = await Promise.all([
    supabase.from('plates').select('codigo_sequencial'),
    supabase.from('orders').select('placa_codigo_inicial, placa_codigo_final'),
  ]);

  let maxNum = 0;

  for (const p of plates || []) {
    const num = parseInt(String(p.codigo_sequencial || '').replace('PLK-', ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }

  for (const o of orders || []) {
    const n1 = parseInt(String(o.placa_codigo_inicial || '').replace('PLK-', ''), 10);
    const n2 = parseInt(String(o.placa_codigo_final || '').replace('PLK-', ''), 10);
    if (!isNaN(n1) && n1 > maxNum) maxNum = n1;
    if (!isNaN(n2) && n2 > maxNum) maxNum = n2;
  }

  return maxNum;
}

/**
 * Consulta as placas e QR Codes de um pedido no Supabase.
 * Caso o pedido ainda não possua placas geradas, provisiona automaticamente.
 */
export async function cloudGetOrderPlates(orderId: string): Promise<{
  sucesso: boolean;
  total_placas: number;
  placa_codigo_inicial: string | null;
  placa_codigo_final: string | null;
  placas: any[];
}> {
  try {
    const resp = await fetch(`/api/qrcodes?action=get-order-plates&order_id=${encodeURIComponent(orderId)}`);
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && ct.includes('application/json')) {
      const json = await resp.json();
      if (json.sucesso && Array.isArray(json.placas)) {
        const enriched = await enrichPlatesWithQrCodes(json.placas, false);
        return {
          sucesso: true,
          total_placas: enriched.length,
          placa_codigo_inicial: json.placa_codigo_inicial || enriched[0]?.codigo_sequencial || null,
          placa_codigo_final: json.placa_codigo_final || enriched[enriched.length - 1]?.codigo_sequencial || null,
          placas: enriched,
        };
      }
    }
  } catch {}

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  let { data: existingPlates } = await supabase
    .from('plates')
    .select('*')
    .eq('order_id', orderId)
    .order('codigo_sequencial', { ascending: true });

  // Se o pedido tinha intervalo atribuído mas as placas não estavam vinculadas por order_id
  if ((!existingPlates || existingPlates.length === 0) && order?.placa_codigo_inicial && order?.placa_codigo_final) {
    const { data: rangePlates } = await supabase
      .from('plates')
      .select('*')
      .gte('codigo_sequencial', order.placa_codigo_inicial)
      .lte('codigo_sequencial', order.placa_codigo_final)
      .order('codigo_sequencial', { ascending: true });

    if (rangePlates && rangePlates.length > 0) {
      existingPlates = rangePlates;
    }
  }

  // Se ainda não existem placas para este pedido, gera agora e salva no bucket `qrcodes`
  if (!existingPlates || existingPlates.length === 0) {
    const genRes = await cloudGenerateOrderQRCodes(orderId);
    return {
      sucesso: true,
      total_placas: genRes.placas.length,
      placa_codigo_inicial: genRes.placa_codigo_inicial,
      placa_codigo_final: genRes.placa_codigo_final,
      placas: genRes.placas,
    };
  }

  const enriched = await enrichPlatesWithQrCodes(existingPlates, false);
  const codigoInicial = enriched[0]?.codigo_sequencial || order?.placa_codigo_inicial || null;
  const codigoFinal =
    enriched[enriched.length - 1]?.codigo_sequencial || order?.placa_codigo_final || null;

  return {
    sucesso: true,
    total_placas: enriched.length,
    placa_codigo_inicial: codigoInicial,
    placa_codigo_final: codigoFinal,
    placas: enriched,
  };
}

/**
 * Gera os QR Codes de um pedido aprovado/pago, faz upload dos PNGs para o bucket `qrcodes`
 * no Supabase Storage e grava `qrcode_url` na tabela `plates`.
 */
export async function cloudGenerateOrderQRCodes(orderId: string): Promise<{
  sucesso: boolean;
  mensagem: string;
  ja_gerados?: boolean;
  placa_codigo_inicial: string | null;
  placa_codigo_final: string | null;
  placas: any[];
}> {
  try {
    const resp = await fetch('/api/qrcodes?action=generate-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-order', order_id: orderId }),
    });
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && ct.includes('application/json')) {
      const json = await resp.json();
      if (json.sucesso && Array.isArray(json.placas)) {
        const enriched = await enrichPlatesWithQrCodes(json.placas, false);
        return {
          sucesso: true,
          mensagem: json.mensagem || `${enriched.length} QR Codes gerados com sucesso!`,
          ja_gerados: json.ja_gerados,
          placa_codigo_inicial: json.placa_codigo_inicial || enriched[0]?.codigo_sequencial || null,
          placa_codigo_final: json.placa_codigo_final || enriched[enriched.length - 1]?.codigo_sequencial || null,
          placas: enriched,
        };
      }
    }
  } catch {}

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

  if (existingPlates && existingPlates.length >= order.quantidade_total) {
    const enriched = await enrichPlatesWithQrCodes(existingPlates, true);
    const codigoInicial = enriched[0]?.codigo_sequencial || null;
    const codigoFinal = enriched[enriched.length - 1]?.codigo_sequencial || null;

    if (!order.placa_codigo_inicial || !order.placa_codigo_final) {
      await supabase
        .from('orders')
        .update({
          placa_codigo_inicial: codigoInicial,
          placa_codigo_final: codigoFinal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }

    return {
      sucesso: true,
      mensagem: 'QR Codes recuperados e sincronizados com o Supabase Storage.',
      ja_gerados: true,
      placa_codigo_inicial: codigoInicial,
      placa_codigo_final: codigoFinal,
      placas: enriched,
    };
  }

  // Garante que exista uma ordem de manufatura (manufacturing_orders)
  let { data: mfg } = await supabase
    .from('manufacturing_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  const now = new Date().toISOString();
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

  const currentCount = existingPlates ? existingPlates.length : 0;
  const needed = Math.max(0, order.quantidade_total - currentCount);
  const highestNum = await getHighestSequentialPlateNumber();
  const baseUrl = getPublicAppUrl();

  const parseSeqNum = (str?: string | null) => {
    if (!str) return null;
    const n = parseInt(String(str).trim().toUpperCase().replace('PLK-', ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
  };
  const preIni = parseSeqNum(order.placa_codigo_inicial);
  const preFim = parseSeqNum(order.placa_codigo_final);
  const usePresetRange =
    currentCount === 0 &&
    preIni !== null &&
    preFim !== null &&
    preFim - preIni + 1 === needed;

  const newPlatesToInsert: any[] = [];
  for (let i = 1; i <= needed; i++) {
    const seqNum = usePresetRange ? preIni! + (i - 1) : highestNum + i;
    const codigoSequencial = `PLK-${String(seqNum).padStart(6, '0')}`;
    const tokenPublico = generateRandomToken(12);
    const urlPermanente = `${baseUrl}/r/${tokenPublico}`;

    newPlatesToInsert.push({
      id: generateShortId('plt'),
      manufacturing_order_id: mfg?.id || null,
      order_id: orderId,
      revendedor_id: order.revendedor_id,
      codigo_sequencial: codigoSequencial,
      token_publico: tokenPublico,
      url_permanente: urlPermanente,
      status_fisico: 'planejada',
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

  const allOrderPlates = [...(existingPlates || []), ...newPlatesToInsert].sort((a, b) =>
    String(a.codigo_sequencial).localeCompare(String(b.codigo_sequencial))
  );

  // Faz upload dos PNGs (400px, margin 2) para o bucket `qrcodes` e atualiza `qrcode_url`
  const enriched = await enrichPlatesWithQrCodes(allOrderPlates, true);

  const codigoInicial = enriched[0]?.codigo_sequencial || null;
  const codigoFinal = enriched[enriched.length - 1]?.codigo_sequencial || null;

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
    mensagem: `${enriched.length} QR Codes gerados e armazenados no bucket 'qrcodes' (${codigoInicial} a ${codigoFinal})!`,
    ja_gerados: false,
    placa_codigo_inicial: codigoInicial,
    placa_codigo_final: codigoFinal,
    placas: enriched,
  };
}

/**
 * Gera placas antecipadas para estoque livre (sem pedido vinculado),
 * faz upload dos PNGs para o bucket `qrcodes` e salva `qrcode_url` na tabela `plates`.
 */
export async function cloudGenerateAdvancePlates(
  quantidade: number,
  statusFisico = 'em_producao'
): Promise<{
  sucesso: boolean;
  mensagem: string;
  total_geradas: number;
  codigo_inicial: string;
  codigo_final: string;
  placas: any[];
}> {
  try {
    const resp = await fetch('/api/qrcodes?action=generate-advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-advance', quantidade, status_fisico: statusFisico }),
    });
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && ct.includes('application/json')) {
      const json = await resp.json();
      if (json.sucesso && Array.isArray(json.placas)) {
        const enriched = await enrichPlatesWithQrCodes(json.placas, false);
        return {
          sucesso: true,
          mensagem: json.mensagem,
          total_geradas: json.total_geradas || enriched.length,
          codigo_inicial: json.codigo_inicial || enriched[0]?.codigo_sequencial || '',
          codigo_final: json.codigo_final || enriched[enriched.length - 1]?.codigo_sequencial || '',
          placas: enriched,
        };
      }
    }
  } catch {}

  const qty = Math.min(Math.max(1, Number(quantidade) || 1), 500);
  const statusInicial = statusFisico === 'planejada' ? 'planejada' : 'em_producao';
  const highestNum = await getHighestSequentialPlateNumber();
  const baseUrl = getPublicAppUrl();
  const now = new Date().toISOString();

  const newPlates: any[] = [];
  for (let i = 1; i <= qty; i++) {
    const seqNum = highestNum + i;
    const codigoSequencial = `PLK-${String(seqNum).padStart(6, '0')}`;
    const tokenPublico = generateRandomToken(12);
    const urlPermanente = `${baseUrl}/r/${tokenPublico}`;

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
    throw new Error(`Erro ao criar lote antecipado no Supabase: ${insertErr.message}`);
  }

  const enriched = await enrichPlatesWithQrCodes(newPlates, true);
  const codigoInicial = enriched[0]?.codigo_sequencial || '';
  const codigoFinal = enriched[enriched.length - 1]?.codigo_sequencial || '';

  return {
    sucesso: true,
    mensagem: `${qty} placas geradas e salvas no bucket 'qrcodes' (${codigoInicial} até ${codigoFinal})!`,
    total_geradas: qty,
    codigo_inicial: codigoInicial,
    codigo_final: codigoFinal,
    placas: enriched,
  };
}

/**
 * Atribui um intervalo de placas (de estoque ou novas) a um pedido aprovado.
 */
export async function cloudAssignPlatesRange(
  orderId: string,
  codigoInicial: string,
  codigoFinal: string
): Promise<{
  sucesso: boolean;
  mensagem: string;
  placa_codigo_inicial: string;
  placa_codigo_final: string;
  total_atribuidas: number;
}> {
  try {
    const resp = await fetch('/api/qrcodes?action=assign-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign-range',
        order_id: orderId,
        codigo_inicial: codigoInicial,
        codigo_final: codigoFinal,
      }),
    });
    const ct = resp.headers.get('content-type') || '';
    if (resp.ok && ct.includes('application/json')) {
      const json = await resp.json();
      if (json.sucesso) {
        return {
          sucesso: true,
          mensagem: json.mensagem,
          placa_codigo_inicial: json.placa_codigo_inicial,
          placa_codigo_final: json.placa_codigo_final,
          total_atribuidas: json.total_atribuidas,
        };
      } else if (json.mensagem) {
        throw new Error(json.mensagem);
      }
    }
  } catch (err: any) {
    if (err?.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    throw new Error('Pedido não encontrado.');
  }

  const parseNum = (str: string) => {
    const cleaned = String(str || '').trim().toUpperCase().replace('PLK-', '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) || n <= 0 ? null : n;
  };

  const numIni = parseNum(codigoInicial);
  const numFim = parseNum(codigoFinal);
  if (!numIni || !numFim || numFim < numIni) {
    throw new Error('Intervalo inválido. Use o formato PLK-000001.');
  }

  const expectedCount = numFim - numIni + 1;
  if (expectedCount !== order.quantidade_total) {
    throw new Error(
      `O intervalo selecionado possui ${expectedCount} placas, mas o pedido exige exatamente ${order.quantidade_total} unidades.`
    );
  }

  const formattedIni = `PLK-${String(numIni).padStart(6, '0')}`;
  const formattedFim = `PLK-${String(numFim).padStart(6, '0')}`;
  const now = new Date().toISOString();
  const baseUrl = getPublicAppUrl();

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

  // Libera placas que estavam vinculadas anteriormente a este pedido
  await supabase
    .from('plates')
    .update({ order_id: null, revendedor_id: null, manufacturing_order_id: null, updated_at: now })
    .eq('order_id', orderId);

  const platesToUpload: Array<{ id?: string; codigo_sequencial: string; url_permanente: string }> = [];

  for (let n = numIni; n <= numFim; n++) {
    const code = `PLK-${String(n).padStart(6, '0')}`;
    const { data: existing } = await supabase
      .from('plates')
      .select('*')
      .eq('codigo_sequencial', code)
      .maybeSingle();

    if (existing) {
      if (existing.order_id && existing.order_id !== orderId) {
        throw new Error(`A placa ${code} já pertence a outro pedido.`);
      }
      const urlPermanente = normalizePermanentUrl(existing.token_publico, existing.url_permanente);
      await supabase
        .from('plates')
        .update({
          order_id: orderId,
          revendedor_id: order.revendedor_id,
          manufacturing_order_id: mfg?.id || null,
          url_permanente: urlPermanente,
          updated_at: now,
        })
        .eq('id', existing.id);
      platesToUpload.push({ id: existing.id, codigo_sequencial: code, url_permanente: urlPermanente });
    } else {
      const id = generateShortId('plt');
      const tokenPublico = generateRandomToken(12);
      const urlPermanente = `${baseUrl}/r/${tokenPublico}`;
      await supabase.from('plates').insert({
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
      });
      platesToUpload.push({ id, codigo_sequencial: code, url_permanente: urlPermanente });
    }
  }

  await uploadPlatesQrCodesToStorage(platesToUpload);

  await supabase
    .from('orders')
    .update({
      placa_codigo_inicial: formattedIni,
      placa_codigo_final: formattedFim,
      updated_at: now,
    })
    .eq('id', orderId);

  return {
    sucesso: true,
    mensagem: `Placas ${formattedIni} até ${formattedFim} atribuídas com sucesso ao pedido #${order.numero_pedido}!`,
    placa_codigo_inicial: formattedIni,
    placa_codigo_final: formattedFim,
    total_atribuidas: expectedCount,
  };
}

/**
 * Obtém ou recria em tempo real o QR Code de uma placa específica (On-Demand Regeneration).
 */
export async function cloudGetPlateQrCode(plateId: string): Promise<{
  sucesso: boolean;
  url_permanente: string;
  qrcode_url: string;
  qrcode_data_url: string;
  codigo_sequencial: string;
}> {
  const { data: plate, error } = await supabase
    .from('plates')
    .select('*')
    .eq('id', plateId)
    .maybeSingle();

  if (error || !plate) {
    throw new Error('Placa não encontrada.');
  }

  const urlPermanente = normalizePermanentUrl(plate.token_publico, plate.url_permanente);
  const dataUrl = await generateQrCodeDataUrl(urlPermanente, plate.codigo_sequencial);
  const qrcodeUrl = plate.qrcode_url || getStoragePublicUrl(plate.codigo_sequencial);

  return {
    sucesso: true,
    url_permanente: urlPermanente,
    qrcode_url: qrcodeUrl,
    qrcode_data_url: dataUrl,
    codigo_sequencial: plate.codigo_sequencial,
  };
}

