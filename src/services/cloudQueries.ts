import { supabase } from './supabaseClient.js';
import { normalizePermanentUrl, getStoragePublicUrl, generateQrCodeDataUrl } from './cloudQrService.js';
import type { AdminStats } from '../types.js';

/**
 * Leituras diretas no Supabase (modo nuvem / Vercel), espelhando as consultas do servidor Express.
 */

async function readTable<T = any>(table: string, columns = '*'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`Falha ao ler "${table}": ${error.message}`);
  return (data as T[]) || [];
}

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

const seqNumber = (code?: string | null) => parseInt(String(code || '').replace(/\D/g, ''), 10) || 0;

const byCreatedAsc = (a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at));
const byCreatedDesc = (a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at));

export async function cloudGetOrders(currentUserId: string) {
  const [orders, profiles, clients, logistics, plates, mfgs] = await Promise.all([
    readTable('orders'),
    readTable('profiles', 'id,nome,telefone,email,tipo_parceiro,role'),
    readTable('clients', 'id,nome_estabelecimento'),
    readTable('order_logistics'),
    readTable('plates', 'order_id,codigo_sequencial'),
    readTable('manufacturing_orders', 'order_id,status'),
  ]);

  const profMap = byId<any>(profiles);
  const cliMap = byId<any>(clients);
  const me = profMap.get(currentUserId);
  const isAdmin = me?.role === 'admin';

  return orders
    .filter((o: any) => isAdmin || o.revendedor_id === currentUserId)
    .sort(byCreatedDesc)
    .map((o: any) => {
      const prof = profMap.get(o.revendedor_id);
      const orderPlates = plates.filter((p: any) => p.order_id === o.id);
      const codes = orderPlates.map((p: any) => p.codigo_sequencial).sort();
      const inicial = o.placa_codigo_inicial || codes[0] || null;
      const final = o.placa_codigo_final || codes[codes.length - 1] || null;
      return {
        ...o,
        revendedor_nome: prof?.nome,
        revendedor_telefone: prof?.telefone,
        revendedor_email: prof?.email,
        revendedor_tipo: prof?.tipo_parceiro,
        cliente_nome: o.cliente_id ? cliMap.get(o.cliente_id)?.nome_estabelecimento : undefined,
        placa_codigo_inicial: inicial,
        placa_codigo_final: final,
        qrcodes_gerados: orderPlates.length >= o.quantidade_total || (Boolean(inicial) && Boolean(final)),
        total_placas_geradas: orderPlates.length,
        mfg_status: mfgs.find((m: any) => m.order_id === o.id)?.status || null,
        logistica: logistics.find((l: any) => l.order_id === o.id),
      };
    });
}

export async function cloudGetPlatesInProduction() {
  const [plates, orders, profiles, clients] = await Promise.all([
    readTable('plates'),
    readTable('orders', 'id,numero_pedido,modalidade_entrega,cliente_id'),
    readTable('profiles', 'id,nome,tipo_parceiro'),
    readTable('clients', 'id,nome_estabelecimento'),
  ]);
  const ordMap = byId<any>(orders);
  const profMap = byId<any>(profiles);
  const cliMap = byId<any>(clients);

  return plates
    .filter((p: any) => p.status_fisico === 'em_producao')
    .sort((a: any, b: any) => seqNumber(a.codigo_sequencial) - seqNumber(b.codigo_sequencial))
    .map((p: any) => {
      const o = p.order_id ? ordMap.get(p.order_id) : undefined;
      const urlPermanente = normalizePermanentUrl(p.token_publico, p.url_permanente);
      const qrcodeUrl = p.qrcode_url || getStoragePublicUrl(p.codigo_sequencial);
      return {
        ...p,
        url_permanente: urlPermanente,
        qrcode_url: qrcodeUrl,
        numero_pedido: o?.numero_pedido,
        modalidade_entrega: o?.modalidade_entrega,
        revendedor_nome: p.revendedor_id ? profMap.get(p.revendedor_id)?.nome : undefined,
        revendedor_tipo: p.revendedor_id ? profMap.get(p.revendedor_id)?.tipo_parceiro : undefined,
        cliente_nome: o?.cliente_id ? cliMap.get(o.cliente_id)?.nome_estabelecimento : undefined,
      };
    });
}

export async function cloudGetUnassignedPlates() {
  const plates = (await readTable('plates'))
    .filter((p: any) => !p.order_id)
    .sort((a: any, b: any) => seqNumber(a.codigo_sequencial) - seqNumber(b.codigo_sequencial));

  let withQr: any[] = plates;
  try {
    withQr = await Promise.all(
      plates.map(async (p: any) => {
        const urlPermanente = normalizePermanentUrl(p.token_publico, p.url_permanente);
        const qrcodeUrl = p.qrcode_url || getStoragePublicUrl(p.codigo_sequencial);
        const dataUrl = await generateQrCodeDataUrl(urlPermanente, p.codigo_sequencial);
        return {
          ...p,
          url_permanente: urlPermanente,
          qrcode_url: qrcodeUrl,
          qrcode_data_url: dataUrl,
        };
      })
    );
  } catch {}

  const all = await readTable('plates', 'codigo_sequencial');
  const maxSeq = all.reduce((m: number, p: any) => Math.max(m, seqNumber(p.codigo_sequencial)), 0);

  return {
    total: withQr.length,
    proximo_codigo_disponivel: `PLK-${String(maxSeq + 1).padStart(6, '0')}`,
    placas: withQr,
  };
}

export async function cloudGetPendingInspections() {
  const [plates, orders, profiles] = await Promise.all([
    readTable('plates'),
    readTable('orders', 'id,numero_pedido,modalidade_entrega'),
    readTable('profiles', 'id,nome'),
  ]);
  const ordMap = byId<any>(orders);
  const profMap = byId<any>(profiles);

  return plates
    .filter((p: any) => p.status_fisico === 'produzida' && p.order_id && p.revendedor_id)
    .sort(byCreatedAsc)
    .map((p: any) => ({
      ...p,
      numero_pedido: ordMap.get(p.order_id)?.numero_pedido,
      modalidade_entrega: ordMap.get(p.order_id)?.modalidade_entrega,
      revendedor_nome: profMap.get(p.revendedor_id)?.nome,
    }));
}

export async function cloudGetManufacturingQueue() {
  const [mfgs, orders, profiles] = await Promise.all([
    readTable('manufacturing_orders'),
    readTable('orders', 'id,numero_pedido,modalidade_entrega,status,revendedor_id'),
    readTable('profiles', 'id,nome,tipo_parceiro'),
  ]);
  const ordMap = byId<any>(orders);
  const profMap = byId<any>(profiles);

  return mfgs
    .filter((m: any) => {
      const o = ordMap.get(m.order_id);
      return o && (m.status === 'em_producao' || o.status === 'em_producao') && m.status !== 'producao_concluida';
    })
    .sort(byCreatedAsc)
    .map((m: any) => {
      const o = ordMap.get(m.order_id);
      const p = profMap.get(o.revendedor_id);
      return {
        ...m,
        numero_pedido: o.numero_pedido,
        modalidade_entrega: o.modalidade_entrega,
        revendedor_nome: p?.nome,
        revendedor_tipo: p?.tipo_parceiro,
      };
    });
}

export async function cloudGetLogisticsOrders(modalidade?: string) {
  const [logistics, orders, profiles, mfgs] = await Promise.all([
    readTable('order_logistics'),
    readTable('orders', 'id,numero_pedido,quantidade_total,status,valor_total,revendedor_id,created_at,updated_at,observacoes_admin'),
    readTable('profiles', 'id,nome,telefone,email,tipo_parceiro'),
    readTable('manufacturing_orders', 'order_id,status'),
  ]);
  const ordMap = byId<any>(orders);
  const profMap = byId<any>(profiles);

  return logistics
    .map((l: any) => {
      const o = ordMap.get(l.order_id);
      const p = o ? profMap.get(o.revendedor_id) : undefined;
      return { l, o, p, m: mfgs.find((x: any) => x.order_id === l.order_id) };
    })
    .filter(({ l, o, p, m }: any) => {
      if (!o || !p) return false;
      const visible =
        m?.status === 'producao_concluida' ||
        ['aguardando_postagem', 'postado', 'em_transito', 'saiu_para_entrega', 'entregue'].includes(l.correios_status) ||
        ['pronta_para_retirada', 'retirada_agendada', 'retirada_realizada', 'retirado'].includes(l.retirada_status) ||
        o.status === 'concluido';
      const modalOk = modalidade === 'retirada' || modalidade === 'correios' ? l.modalidade === modalidade : true;
      return visible && modalOk;
    })
    .sort((a: any, b: any) => byCreatedDesc(a.l, b.l))
    .map(({ l, o, p, m }: any) => ({
      ...l,
      numero_pedido: o.numero_pedido,
      quantidade_total: o.quantidade_total,
      order_status: o.status,
      valor_total: o.valor_total,
      order_created_at: o.created_at,
      order_updated_at: o.updated_at,
      observacoes_admin: o.observacoes_admin,
      revendedor_nome: p.nome,
      revendedor_telefone: p.telefone,
      revendedor_email: p.email,
      tipo_parceiro: p.tipo_parceiro,
      mfg_status: m?.status,
    }));
}

export async function cloudGetAdminStats(): Promise<AdminStats> {
  const [orders, plates, logistics, profiles] = await Promise.all([
    readTable('orders', 'status,origem,valor_total'),
    readTable('plates', 'status_fisico,status_digital'),
    readTable('order_logistics', 'modalidade,retirada_status,correios_status'),
    readTable('profiles', 'role'),
  ]);
  const count = <T>(rows: T[], fn: (r: T) => boolean) => rows.filter(fn).length;

  return {
    pedidos_aguardando_pagamento: count(orders, (o: any) => o.status === 'aguardando_pagamento'),
    pedidos_pagos: count(orders, (o: any) => o.status === 'pago'),
    reservas_aguardando_aprovacao: count(orders, (o: any) => o.origem === 'solicitacao_interna' && o.status === 'em_analise'),
    faturamento_total: Number(
      orders.filter((o: any) => ['pago', 'concluido'].includes(o.status)).reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0).toFixed(2)
    ),
    placas_produzidas: count(plates, (p: any) => p.status_fisico === 'produzida'),
    placas_aprovadas: count(plates, (p: any) => p.status_fisico === 'aprovada'),
    placas_reprovadas: count(plates, (p: any) => p.status_fisico === 'reprovada'),
    placas_liberadas: count(plates, (p: any) => p.status_fisico === 'liberada'),
    placas_ativas: count(plates, (p: any) => p.status_digital === 'ativa'),
    retiradas_prontas: count(logistics, (l: any) => l.modalidade === 'retirada' && l.retirada_status === 'pronta_para_retirada'),
    correios_aguardando_postagem: count(logistics, (l: any) => l.modalidade === 'correios' && l.correios_status === 'aguardando_postagem'),
    total_revendedores: count(profiles, (p: any) => p.role === 'revendedor'),
  } as AdminStats;
}

