import type { Profile, Order, Plate, PricingTier, ProfileTier, AdminStats, ShippingOption } from './types.js';
import { supabase } from './services/supabaseClient.js';
import {
  cloudGetOrders,
  cloudGetPlatesInProduction,
  cloudGetUnassignedPlates,
  cloudGetPendingInspections,
  cloudGetManufacturingQueue,
  cloudGetLogisticsOrders,
  cloudGetAdminStats,
} from './services/cloudQueries.js';
import {
  cloudGenerateOrderQRCodes,
  cloudGetOrderPlates,
  cloudGenerateAdvancePlates,
  cloudAssignPlatesRange,
  cloudGetPlateQrCode,
  enrichPlatesWithQrCodes,
} from './services/cloudQrService.js';

let currentUserId = 'prof_jose_brandt';

export function setCurrentUser(id: string) {
  currentUserId = id;
}

export function getCurrentUserId(): string {
  return currentUserId;
}

/**
 * Função utilitária para requisições com tratamento seguro de respostas não-JSON
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': currentUserId,
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';

    // Se a resposta for HTML (ex: 404 da Vercel para rotas /api), não tenta fazer response.json()
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`A rota ${path} retornou formato inválido (${response.status}). Modo nuvem ativo.`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.mensagem || 'Ocorreu um erro na solicitação.');
    }

    return data;
  } catch (err: any) {
    throw err;
  }
}

export const api = {
  // Autenticação & Perfis
  login: async (body: { email: string; senha: string; require_admin?: boolean }): Promise<{ sucesso: boolean; mensagem: string; perfil: Profile }> => {
    const cleanEmail = body.email.trim().toLowerCase();

    // 1. Tenta autenticar pelo backend Express (/api/auth/login) se disponível
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.sucesso && data.perfil) {
          return data;
        } else if (!res.ok) {
          throw new Error(data.mensagem || 'E-mail ou senha incorretos.');
        }
      }
    } catch (apiErr: any) {
      // Se for erro de credencial rejeitada pelo backend com mensagem clara, relança
      if (apiErr.message && !apiErr.message.includes('formato inválido') && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('JSON')) {
        throw apiErr;
      }
    }

    // 2. Fallback Nuvem: Autentica diretamente pelo Supabase Auth (utilizado na Vercel)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: body.senha,
    });

    if (authError || !authData?.user) {
      throw new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
    }

    // Validação de perfil administrativo
    const isAdmin = cleanEmail === 'jrmacbrandt@gmail.com' || authData.user.app_metadata?.role === 'admin' || authData.user.user_metadata?.role === 'admin';
    if (body.require_admin && !isAdmin) {
      throw new Error('Acesso restrito: este usuário não possui privilégios de Administrador.');
    }

    // Tenta buscar perfil salvo no Supabase
    let perfil: Profile | null = null;
    try {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .limit(1);

      if (profileRows && profileRows.length > 0) {
        perfil = profileRows[0] as Profile;
      }
    } catch {}

    if (!perfil) {
      perfil = {
        id: 'prof_jose_brandt',
        auth_user_id: authData.user.id,
        nome: authData.user.user_metadata?.nome || 'José Roberto Machado Brandt',
        email: cleanEmail,
        telefone: '21980914107',
        cpf_cnpj: '06865841719',
        role: 'admin',
        tipo_parceiro: 'equipe_interna',
        preferencia_entrega: 'correios',
        preco_individual: null,
        ativo: true,
        is_master: true,
        tem_senha: true,
        cep: '22745-271',
        logradouro: 'Rua Araguaia',
        numero: '1111',
        complemento: 'Apto 403',
        bairro: 'Freguesia (Jacarepaguá)',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
        created_at: new Date().toISOString(),
      };
    }

    return {
      sucesso: true,
      mensagem: 'Autenticação realizada com sucesso!',
      perfil,
    };
  },

  getProfiles: async (): Promise<{ sucesso: boolean; perfis: Profile[] }> => {
    try {
      return await request<{ sucesso: boolean; perfis: Profile[] }>('/api/auth/profiles');
    } catch {
      const { data } = await supabase.from('profiles').select('*');
      if (data && data.length > 0) {
        return { sucesso: true, perfis: data as Profile[] };
      }
      return {
        sucesso: true,
        perfis: [
          {
            id: 'prof_jose_brandt',
            auth_user_id: '7b78039a-8002-486c-8fde-5a676abd9b48',
            nome: 'José Roberto Machado Brandt',
            email: 'jrmacbrandt@gmail.com',
            telefone: '21980914107',
            cpf_cnpj: '06865841719',
            role: 'admin',
            tipo_parceiro: 'equipe_interna',
            preferencia_entrega: 'correios',
            preco_individual: null,
            ativo: true,
            is_master: true,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
  },

  getMe: () => request<{ sucesso: boolean; perfil: Profile }>('/api/auth/me'),
  registerPublic: (body: any) => request<{ sucesso: boolean; mensagem: string; perfil: Profile }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  adminCreateUser: async (body: any): Promise<{ sucesso: boolean; mensagem: string; perfil: Profile }> => {
    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const telefone = body.telefone ? String(body.telefone).trim() : null;
    const cpf_cnpj = body.cpf_cnpj ? String(body.cpf_cnpj).trim() : null;
    const partnerType = body.tipo_parceiro || 'equipe_interna';
    const prefEntrega = body.preferencia_entrega || 'retirada';
    const precoInd = body.preco_individual && Number(body.preco_individual) > 0 ? Number(body.preco_individual) : null;

    try {
      return await request<{ sucesso: boolean; mensagem: string; perfil: Profile }>('/api/auth/admin-create', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch {
      // Modo nuvem (Vercel): grava diretamente na tabela profiles do Supabase
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email);

      if (existing && existing.length > 0) {
        throw new Error('Este e-mail já está cadastrado no sistema.');
      }

      const newId = `prof_${Math.random().toString(36).substring(2, 10)}`;
      const newAuthId = `auth_${Math.random().toString(36).substring(2, 10)}`;

      const newProfile = {
        id: newId,
        auth_user_id: newAuthId,
        nome,
        email,
        telefone,
        cpf_cnpj,
        role: 'revendedor',
        tipo_parceiro: partnerType,
        preferencia_entrega: prefEntrega,
        preco_individual: precoInd,
        ativo: true,
        is_master: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (error) {
        throw new Error(`Falha ao cadastrar vendedor no Supabase: ${error.message}`);
      }

      return {
        sucesso: true,
        mensagem: `Vendedor interno "${nome}" cadastrado com sucesso!`,
        perfil: (data as Profile) || (newProfile as unknown as Profile),
      };
    }
  },

  adminDeleteUser: async (profileId: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/auth/profiles/${profileId}`, {
        method: 'DELETE',
      });
    } catch {
      // Modo nuvem (Vercel): exclui diretamente do Supabase com reatribuição segura
      const { data: target } = await supabase
        .from('profiles')
        .select('id, email, is_master, nome')
        .eq('id', profileId)
        .single();

      if (target?.is_master || target?.email?.toLowerCase() === 'jrmacbrandt@gmail.com') {
        throw new Error('O Administrador Master não pode ser excluído.');
      }

      const masterId = 'prof_jose_brandt';
      try {
        await supabase.from('clients').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('orders').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('orders').update({ aprovado_por: masterId }).eq('aprovado_por', profileId);
        await supabase.from('plates').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('inspections').update({ inspetor_id: masterId }).eq('inspetor_id', profileId);
        await supabase.from('audit_logs').update({ usuario_id: masterId }).eq('usuario_id', profileId);
      } catch {}

      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) {
        throw new Error(`Falha ao excluir no Supabase: ${error.message}`);
      }

      return {
        sucesso: true,
        mensagem: `Cadastro de "${target?.nome || 'usuário'}" excluído com sucesso!`,
      };
    }
  },

  // Pedidos
  getOrders: async (): Promise<{ sucesso: boolean; pedidos: Order[] }> => {
    try {
      return await request<{ sucesso: boolean; pedidos: Order[] }>('/api/orders');
    } catch {
      return { sucesso: true, pedidos: (await cloudGetOrders(currentUserId)) as Order[] };
    }
  },
  calculatePrice: (revendedorId: string, quantidade: number) => request<{ sucesso: boolean; calculo: any }>('/api/orders/calculate', { method: 'POST', body: JSON.stringify({ revendedor_id: revendedorId, quantidade }) }),
  createOrder: async (body: any): Promise<{ sucesso: boolean; mensagem: string; pedido: Order }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; pedido: Order }>('/api/orders/create', { method: 'POST', body: JSON.stringify(body) });
    } catch {
      const now = new Date().toISOString();
      const orderId = `ord_${Math.random().toString(16).slice(2, 10)}`;
      const ym = now.slice(0, 7).replace('-', '');
      const numeroPedido = `PED-${ym}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const qty = Math.max(1, Number(body.quantidade) || 1);
      const unitPrice = qty >= 50 ? 17.9 : qty >= 10 ? 19.9 : 21.9;
      const frete = Number(body.opcao_frete?.price || 0);
      const total = Number((qty * unitPrice + frete).toFixed(2));
      const modalidade = body.modalidade_entrega === 'retirada' ? 'retirada' : 'correios';

      const newOrder = {
        id: orderId,
        numero_pedido: numeroPedido,
        revendedor_id: currentUserId,
        origem: 'compra_revendedor',
        cliente_id: null,
        status: 'aguardando_pagamento',
        quantidade_total: qty,
        preco_unitario_aplicado: unitPrice,
        valor_frete: frete,
        valor_total: total,
        modalidade_entrega: modalidade,
        observacoes_admin: body.observacoes || null,
        created_at: now,
        updated_at: now,
      };
      const { error } = await supabase.from('orders').insert(newOrder);
      if (error) throw new Error(`Erro ao criar pedido no Supabase: ${error.message}`);

      await supabase.from('order_logistics').insert({
        id: `log_${Math.random().toString(16).slice(2, 10)}`,
        order_id: orderId,
        modalidade,
        retirada_status: modalidade === 'retirada' ? 'aguardando_producao' : null,
        correios_status: modalidade === 'correios' ? 'aguardando_producao' : null,
        destinatario_nome: body.endereco_entrega?.destinatario || null,
        cep: body.endereco_entrega?.cep || null,
        logradouro: body.endereco_entrega?.logradouro || null,
        numero: body.endereco_entrega?.numero || null,
        complemento: body.endereco_entrega?.complemento || null,
        bairro: body.endereco_entrega?.bairro || null,
        cidade: body.endereco_entrega?.cidade || null,
        uf: body.endereco_entrega?.estado || null,
        created_at: now,
        updated_at: now,
      });

      return { sucesso: true, mensagem: 'Pedido criado com sucesso!', pedido: newOrder as unknown as Order };
    }
  },
  createInternalOrder: async (body: { vendedor_id: string; quantidade: number; observacoes?: string }): Promise<{ sucesso: boolean; mensagem: string; pedido: Order }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; pedido: Order }>('/api/orders/create-internal', { method: 'POST', body: JSON.stringify(body) });
    } catch {
      const now = new Date().toISOString();
      const orderId = `ord_${Math.random().toString(16).slice(2, 10)}`;
      const ym = now.slice(0, 7).replace('-', '');
      const numeroPedido = `PED-${ym}-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const qty = Math.max(1, Number(body.quantidade) || 1);

      const newOrder = {
        id: orderId,
        numero_pedido: numeroPedido,
        revendedor_id: body.vendedor_id,
        origem: 'solicitacao_interna',
        cliente_id: null,
        status: 'aprovado',
        quantidade_total: qty,
        preco_unitario_aplicado: 0,
        valor_frete: 0,
        valor_total: 0,
        modalidade_entrega: 'retirada',
        observacoes_admin: body.observacoes || null,
        aprovado_por: currentUserId,
        data_aprovacao: now,
        created_at: now,
        updated_at: now,
      };
      const { error } = await supabase.from('orders').insert(newOrder);
      if (error) throw new Error(`Erro ao criar pedido interno no Supabase: ${error.message}`);

      await supabase.from('order_logistics').insert({
        id: `log_${Math.random().toString(16).slice(2, 10)}`,
        order_id: orderId,
        modalidade: 'retirada',
        retirada_status: 'aguardando_producao',
        created_at: now,
        updated_at: now,
      });

      // Gera os QR Codes e faz upload dos PNGs para o bucket `qrcodes` automaticamente
      await cloudGenerateOrderQRCodes(orderId);

      return {
        sucesso: true,
        mensagem: `Pedido interno #${numeroPedido} emitido e QR Codes gerados no Supabase Storage!`,
        pedido: newOrder as unknown as Order,
      };
    }
  },
  approveReservation: async (orderId: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/approve`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();
      await supabase.from('orders').update({ status: 'aprovado', aprovado_por: currentUserId, data_aprovacao: now, updated_at: now }).eq('id', orderId);
      return { sucesso: true, mensagem: 'Reserva interna aprovada com sucesso!' };
    }
  },
  changeDeliveryMode: async (orderId: string, body: any): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/change-delivery`, { method: 'POST', body: JSON.stringify(body) });
    } catch {
      const now = new Date().toISOString();
      const nova = body.nova_modalidade === 'retirada' ? 'retirada' : 'correios';
      await supabase.from('orders').update({ modalidade_entrega: nova, updated_at: now }).eq('id', orderId);
      await supabase.from('order_logistics').update({
        modalidade: nova,
        retirada_status: nova === 'retirada' ? 'pronta_para_retirada' : null,
        correios_status: nova === 'correios' ? 'aguardando_postagem' : null,
        updated_at: now,
      }).eq('order_id', orderId);
      return { sucesso: true, mensagem: `Modalidade de entrega alterada para ${nova === 'retirada' ? 'Retirada no Balcão' : 'Correios'}!` };
    }
  },
  confirmWithdrawal: async (orderId: string, quemRetirou: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/confirm-withdrawal`, { method: 'POST', body: JSON.stringify({ quem_retirou: quemRetirou }) });
    } catch {
      const now = new Date().toISOString();
      await supabase.from('orders').update({ status: 'concluido', updated_at: now }).eq('id', orderId);
      await supabase.from('order_logistics').update({
        retirada_status: 'retirado',
        responsavel_retirada_nome: quemRetirou || 'Retirado no Balcão',
        data_retirada_efetiva: now,
        updated_at: now,
      }).eq('order_id', orderId);
      await supabase.from('plates').update({ status_fisico: 'liberada', data_liberacao: now, updated_at: now }).eq('order_id', orderId);
      return { sucesso: true, mensagem: 'Retirada no balcão confirmada e placas liberadas!' };
    }
  },
  generateOrderQRCodes: async (orderId: string): Promise<{ sucesso: boolean; mensagem: string; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; pedido?: Order }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; pedido?: Order }>(`/api/orders/${orderId}/generate-qrcodes`, { method: 'POST' });
    } catch {
      const res = await cloudGenerateOrderQRCodes(orderId);
      return {
        sucesso: res.sucesso,
        mensagem: res.mensagem,
        placas: res.placas,
        placa_codigo_inicial: res.placa_codigo_inicial || undefined,
        placa_codigo_final: res.placa_codigo_final || undefined,
      };
    }
  },
  assignPlatesRange: async (orderId: string, codigoInicial: string, codigoFinal: string): Promise<{ sucesso: boolean; mensagem: string; pedido?: Order; placas?: any[] }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; pedido: Order; placas: any[] }>(`/api/orders/${orderId}/assign-range`, { method: 'POST', body: JSON.stringify({ codigo_inicial: codigoInicial, codigo_final: codigoFinal }) });
    } catch {
      const res = await cloudAssignPlatesRange(orderId, codigoInicial, codigoFinal);
      return {
        sucesso: res.sucesso,
        mensagem: res.mensagem,
      };
    }
  },
  getOrderPlates: async (orderId: string): Promise<{ sucesso: boolean; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; qrcodes_gerados?: boolean }> => {
    try {
      return await request<{ sucesso: boolean; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; qrcodes_gerados?: boolean }>(`/api/orders/${orderId}/plates-and-qrcodes`);
    } catch {
      const res = await cloudGetOrderPlates(orderId);
      return {
        sucesso: res.sucesso,
        placas: res.placas,
        placa_codigo_inicial: res.placa_codigo_inicial || undefined,
        placa_codigo_final: res.placa_codigo_final || undefined,
        qrcodes_gerados: res.placas.length > 0,
      };
    }
  },
  startOrderProduction: async (orderId: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/start-production`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();

      // 0. Garante que as placas e os PNGs no bucket `qrcodes` do Supabase Storage foram gerados
      await cloudGenerateOrderQRCodes(orderId);

      // 1. Atualiza pedido para 'em_producao'
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'em_producao', updated_at: now })
        .eq('id', orderId)
        .select()
        .single();

      if (orderErr) throw new Error(`Falha ao iniciar produção no Supabase: ${orderErr.message}`);

      // 2. Atualiza ou cria ordem de fabricação
      const { data: existingMfg } = await supabase
        .from('manufacturing_orders')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existingMfg) {
        await supabase
          .from('manufacturing_orders')
          .update({ status: 'em_producao', updated_at: now })
          .eq('id', existingMfg.id);
      } else {
        const mfgId = `mfg_${Math.random().toString(36).substring(2, 10)}`;
        await supabase.from('manufacturing_orders').insert({
          id: mfgId,
          order_id: orderId,
          status: 'em_producao',
          quantidade_prevista: order?.quantidade_total || 1,
          quantidade_produzida: order?.quantidade_total || 1,
          quantidade_aprovada: 0,
          quantidade_reprovada: 0,
          created_at: now,
          updated_at: now,
        });
      }

      // 3. Atualiza as placas vinculadas ao pedido para 'em_producao'
      await supabase
        .from('plates')
        .update({ status_fisico: 'em_producao', updated_at: now })
        .eq('order_id', orderId);

      return {
        sucesso: true,
        mensagem: `Produção do pedido #${order?.numero_pedido || orderId} iniciada com sucesso!`,
      };
    }
  },

  finalizeOrderProduction: async (orderId: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/finalize-production`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();

      // 1. Atualiza placas do pedido para 'aprovada'
      await supabase
        .from('plates')
        .update({ status_fisico: 'aprovada', data_liberacao: now, updated_at: now })
        .eq('order_id', orderId);

      // 2. Conclui a ordem de fabricação
      await supabase
        .from('manufacturing_orders')
        .update({ status: 'producao_concluida', updated_at: now })
        .eq('order_id', orderId);

      // 3. Busca detalhes do pedido para atualizar logística
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      const modalidade = order?.modalidade_entrega || 'correios';

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

      return {
        sucesso: true,
        mensagem: `Produção do pedido #${order?.numero_pedido || orderId} concluída com sucesso! Encaminhado para Despacho e Retirada.`,
      };
    }
  },
  confirmManualPayment: async (orderId: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/confirm-payment-manual`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();
      await supabase.from('orders').update({ status: 'pago', aprovado_por: currentUserId, data_aprovacao: now, updated_at: now }).eq('id', orderId);
      await cloudGenerateOrderQRCodes(orderId);
      return { sucesso: true, mensagem: 'Pagamento confirmado manualmente e QR Codes provisionados no Supabase Storage!' };
    }
  },
  updateOrderNotes: async (orderId: string, observacoes: string): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/update-notes`, { method: 'POST', body: JSON.stringify({ observacoes }) });
    } catch {
      const now = new Date().toISOString();
      await supabase.from('orders').update({ observacoes_admin: observacoes, updated_at: now }).eq('id', orderId);
      return { sucesso: true, mensagem: 'Observações do pedido atualizadas!' };
    }
  },
  deleteOrder: async (orderId: string, reaproveitarPlacas: boolean = true): Promise<{ sucesso: boolean; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}`, { method: 'DELETE', body: JSON.stringify({ reaproveitar_placas: reaproveitarPlacas }) });
    } catch {
      const now = new Date().toISOString();
      if (reaproveitarPlacas) {
        await supabase
          .from('plates')
          .update({ order_id: null, revendedor_id: null, manufacturing_order_id: null, updated_at: now })
          .eq('order_id', orderId);
      } else {
        await supabase.from('plates').delete().eq('order_id', orderId);
      }
      await supabase.from('order_logistics').delete().eq('order_id', orderId);
      await supabase.from('manufacturing_orders').delete().eq('order_id', orderId);
      await supabase.from('payments').delete().eq('order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);
      return {
        sucesso: true,
        mensagem: reaproveitarPlacas
          ? 'Pedido excluído e placas devolvidas ao estoque livre!'
          : 'Pedido excluído do banco de dados!',
      };
    }
  },
  bulkDeleteOrders: async (orderIds: string[], reaproveitarPlacas: boolean = true): Promise<{ sucesso: boolean; total_excluidos: number; mensagem: string }> => {
    try {
      return await request<{ sucesso: boolean; total_excluidos: number; mensagem: string }>('/api/orders/bulk-delete', { method: 'POST', body: JSON.stringify({ order_ids: orderIds, reaproveitar_placas: reaproveitarPlacas }) });
    } catch {
      const now = new Date().toISOString();
      if (reaproveitarPlacas) {
        await supabase
          .from('plates')
          .update({ order_id: null, revendedor_id: null, manufacturing_order_id: null, updated_at: now })
          .in('order_id', orderIds);
      } else {
        await supabase.from('plates').delete().in('order_id', orderIds);
      }
      await supabase.from('order_logistics').delete().in('order_id', orderIds);
      await supabase.from('manufacturing_orders').delete().in('order_id', orderIds);
      await supabase.from('payments').delete().in('order_id', orderIds);
      await supabase.from('orders').delete().in('id', orderIds);
      return {
        sucesso: true,
        total_excluidos: orderIds.length,
        mensagem: `${orderIds.length} pedidos excluídos com sucesso!`,
      };
    }
  },

  // Pagamentos (Asaas)
  getPaymentInfo: (orderId: string) => request<{ sucesso: boolean; pagamento: any; pedido: Order }>(`/api/payments/order/${orderId}`),
  simulatePayment: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>('/api/payments/simulate-pay', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }),
  simulateAsaasWebhook: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/payments/simulate-webhook/${orderId}`, { method: 'POST' }),
  checkPaymentStatus: (orderId: string) => request<{ sucesso: boolean; order_id: string; status: string; is_paid: boolean }>(`/api/payments/status/${orderId}`),
  getAsaasIntegrationStatus: () => request<{ sucesso: boolean; configurado: boolean; ambiente: string; webhook_token_configurado: boolean; base_url: string }>('/api/payments/integration-status'),

  // Fabricação & Inspeção
  getManufacturingQueue: async (): Promise<{ sucesso: boolean; fila: any[] }> => {
    try {
      return await request<{ sucesso: boolean; fila: any[] }>('/api/manufacturing/queue');
    } catch {
      return { sucesso: true, fila: await cloudGetManufacturingQueue() };
    }
  },
  produceUnits: (mfgId: string, quantidade: number) => request<{ sucesso: boolean; mensagem: string; placas_criadas: string[] }>(`/api/manufacturing/${mfgId}/produce`, { method: 'POST', body: JSON.stringify({ quantidade }) }),
  getPendingInspections: async (): Promise<{ sucesso: boolean; placas: Plate[] }> => {
    try {
      return await request<{ sucesso: boolean; placas: Plate[] }>('/api/inspections/pending');
    } catch {
      return { sucesso: true, placas: (await cloudGetPendingInspections()) as Plate[] };
    }
  },
  submitInspection: (body: any) => request<{ sucesso: boolean; mensagem: string; resultado: string }>('/api/inspections/submit', { method: 'POST', body: JSON.stringify(body) }),
  releasePlate: (plateId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/inspections/${plateId}/release`, { method: 'POST' }),

  // Placas (Adendo v5.0)
  getPlates: async (): Promise<{ sucesso: boolean; placas: Plate[] }> => {
    try {
      return await request<{ sucesso: boolean; placas: Plate[] }>('/api/plates');
    } catch {
      const { data } = await supabase.from('plates').select('*').order('codigo_sequencial', { ascending: true });
      const enriched = await enrichPlatesWithQrCodes((data as any[]) || [], false);
      return { sucesso: true, placas: enriched as Plate[] };
    }
  },
  getPlatesInProduction: async (): Promise<{ sucesso: boolean; placas: any[] }> => {
    try {
      return await request<{ sucesso: boolean; placas: any[] }>('/api/plates/in-production');
    } catch {
      return { sucesso: true, placas: await cloudGetPlatesInProduction() };
    }
  },
  getUnassignedPlates: async (): Promise<{ sucesso: boolean; total: number; proximo_codigo_disponivel: string; placas: any[] }> => {
    try {
      return await request<{ sucesso: boolean; total: number; proximo_codigo_disponivel: string; placas: any[] }>('/api/plates/unassigned');
    } catch {
      return { sucesso: true, ...(await cloudGetUnassignedPlates()) };
    }
  },
  generateAdvancePlates: async (
    quantidade: number,
    statusFisico = 'em_producao'
  ): Promise<{ sucesso: boolean; mensagem: string; total_geradas: number; codigo_inicial: string; codigo_final: string; placas: any[] }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; total_geradas: number; codigo_inicial: string; codigo_final: string; placas: any[] }>('/api/plates/generate-advance', {
        method: 'POST',
        body: JSON.stringify({ quantidade, status_fisico: statusFisico }),
      });
    } catch {
      return await cloudGenerateAdvancePlates(quantidade, statusFisico);
    }
  },
  finalizePlate: async (plateId: string): Promise<{ sucesso: boolean; mensagem: string; pedido_concluido?: boolean }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; pedido_concluido?: boolean }>(`/api/plates/${plateId}/finalize`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();
      await supabase
        .from('plates')
        .update({ status_fisico: 'aprovada', data_liberacao: now, updated_at: now })
        .eq('id', plateId);

      return {
        sucesso: true,
        mensagem: 'Placa finalizada e aprovada!',
      };
    }
  },
  getPlateDetails: (id: string) => request<{ sucesso: boolean; placa: Plate; historico: any[] }>(`/api/plates/${id}`),
  configurePlate: async (id: string, body: any): Promise<{ sucesso: boolean; mensagem: string; placa: Plate }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; placa: Plate }>(`/api/plates/${id}/configure`, { method: 'POST', body: JSON.stringify(body) });
    } catch {
      const now = new Date().toISOString();
      const { data: current } = await supabase.from('plates').select('*').eq('id', id).maybeSingle();
      const { data: updated, error } = await supabase
        .from('plates')
        .update({
          nome_estabelecimento: body.nome_estabelecimento || null,
          categoria_estabelecimento: body.categoria_estabelecimento || null,
          contato_nome: body.contato_nome || null,
          contato_telefone: body.contato_telefone || null,
          tipo_destino: body.tipo_destino || 'google_reviews',
          url_destino: body.url_destino,
          status_digital: 'ativa',
          data_ativacao: current?.data_ativacao || now,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao configurar placa: ${error.message}`);
      return {
        sucesso: true,
        mensagem: 'Placa configurada e ativada com sucesso! O redirecionamento vitalício já aponta para o novo link.',
        placa: updated as Plate,
      };
    }
  },
  togglePlateStatus: async (id: string): Promise<{ sucesso: boolean; mensagem: string; placa: Plate }> => {
    try {
      return await request<{ sucesso: boolean; mensagem: string; placa: Plate }>(`/api/plates/${id}/toggle-status`, { method: 'POST' });
    } catch {
      const now = new Date().toISOString();
      const { data: current } = await supabase.from('plates').select('*').eq('id', id).maybeSingle();
      const novoStatus = current?.status_digital === 'ativa' ? 'inativa' : 'ativa';
      const { data: updated, error } = await supabase
        .from('plates')
        .update({ status_digital: novoStatus, updated_at: now })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao alternar status da placa: ${error.message}`);
      return {
        sucesso: true,
        mensagem: `Placa marcada como ${novoStatus.toUpperCase()}.`,
        placa: updated as Plate,
      };
    }
  },
  getPlateQrCode: async (id: string): Promise<{ sucesso: boolean; url_permanente: string; qrcode_url?: string; qrcode_data_url: string; codigo_sequencial: string }> => {
    try {
      return await request<{ sucesso: boolean; url_permanente: string; qrcode_url?: string; qrcode_data_url: string; codigo_sequencial: string }>(`/api/plates/${id}/qrcode`);
    } catch {
      return await cloudGetPlateQrCode(id);
    }
  },

  // Logística Dual & OCR
  getLogisticsOrders: async (modalidade?: string): Promise<{ sucesso: boolean; registros: any[] }> => {
    try {
      return await request<{ sucesso: boolean; registros: any[] }>(`/api/logistics/orders${modalidade ? `?modalidade=${modalidade}` : ''}`);
    } catch {
      return { sucesso: true, registros: await cloudGetLogisticsOrders(modalidade) };
    }
  },
  getWhatsAppLink: (orderId: string) => request<{ sucesso: boolean; whatsapp_url: string; telefone_empresa: string; mensagem_predefinida: string }>(`/api/logistics/whatsapp-link/${orderId}`),
  updateTracking: (body: any) => request<{ sucesso: boolean; mensagem: string }>('/api/logistics/update-tracking', { method: 'POST', body: JSON.stringify(body) }),
  scanReceiptOcr: (body: any) => request<{ sucesso: boolean; resultado_ocr: any; aviso: string }>('/api/logistics/ocr-receipt', { method: 'POST', body: JSON.stringify(body) }),

  // Admin Dashboard
  getAdminStats: async (): Promise<{ sucesso: boolean; indicadores: AdminStats }> => {
    try {
      return await request<{ sucesso: boolean; indicadores: AdminStats }>('/api/admin/stats');
    } catch {
      return { sucesso: true, indicadores: await cloudGetAdminStats() };
    }
  },
  getPricingTiers: async (): Promise<{ sucesso: boolean; faixas: PricingTier[] }> => {
    const defaultFaixas: PricingTier[] = [
      { id: 1, quantidade_minima: 1, quantidade_maxima: 9, preco_unitario: 21.90, ativo: true },
      { id: 2, quantidade_minima: 10, quantidade_maxima: 49, preco_unitario: 19.90, ativo: true },
      { id: 3, quantidade_minima: 50, quantidade_maxima: null, preco_unitario: 17.90, ativo: true },
    ];

    // 1. Tenta Supabase primeiro (fonte de verdade em tempo real na nuvem)
    try {
      const { data, error } = await supabase.from('pricing_tiers').select('*').order('quantidade_minima', { ascending: true });
      if (!error && data && data.length > 0) {
        try {
          localStorage.setItem('atelier_pricing_tiers', JSON.stringify(data));
        } catch {}
        return { sucesso: true, faixas: data as PricingTier[] };
      }
    } catch {}

    // 2. Tenta localStorage (persistência imediata no navegador)
    try {
      const saved = localStorage.getItem('atelier_pricing_tiers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { sucesso: true, faixas: parsed };
        }
      }
    } catch {}

    // 3. Tenta servidor Express local
    try {
      const res = await request<{ sucesso: boolean; faixas: PricingTier[] }>('/api/admin/pricing-tiers');
      if (res.sucesso && Array.isArray(res.faixas) && res.faixas.length > 0) {
        return res;
      }
    } catch {}

    return { sucesso: true, faixas: defaultFaixas };
  },
  updatePricingTiers: async (faixas: PricingTier[]): Promise<{ sucesso: boolean; mensagem: string; faixas: PricingTier[] }> => {
    const validFaixas = faixas && faixas.length > 0 ? faixas : [
      { id: 1, quantidade_minima: 1, quantidade_maxima: 9, preco_unitario: 21.90, ativo: true },
      { id: 2, quantidade_minima: 10, quantidade_maxima: 49, preco_unitario: 19.90, ativo: true },
      { id: 3, quantidade_minima: 50, quantidade_maxima: null, preco_unitario: 17.90, ativo: true },
    ];

    // Salva imediatamente no localStorage
    try {
      localStorage.setItem('atelier_pricing_tiers', JSON.stringify(validFaixas));
    } catch {}

    // Sincroniza diretamente com Supabase Cloud
    try {
      for (const f of validFaixas) {
        await supabase
          .from('pricing_tiers')
          .upsert({
            quantidade_minima: f.quantidade_minima,
            quantidade_maxima: f.quantidade_maxima,
            preco_unitario: f.preco_unitario,
            ativo: true,
          }, { onConflict: 'quantidade_minima' });
      }
    } catch {}

    try {
      const res = await request<{ sucesso: boolean; mensagem: string; faixas: PricingTier[] }>('/api/admin/pricing-tiers', {
        method: 'PUT',
        body: JSON.stringify({ faixas: validFaixas }),
      });
      if (res.sucesso) return res;
    } catch {}

    return {
      sucesso: true,
      mensagem: 'Faixas de preço salvas e atualizadas com sucesso!',
      faixas: validFaixas,
    };
  },
  setIndividualPrice: async (
    profileId: string,
    preco: number | null,
    faixas: ProfileTier[] | null = null
  ): Promise<{ sucesso: boolean; mensagem: string }> => {
    const cleanFaixas = faixas && faixas.length > 0 ? faixas : null;
    try {
      return await request<{ sucesso: boolean; mensagem: string }>(`/api/admin/profiles/${profileId}/pricing`, {
        method: 'POST',
        body: JSON.stringify({ preco_individual: preco, faixas_preco_individual: cleanFaixas }),
      });
    } catch {
      // Modo nuvem (Vercel): grava direto no Supabase
      const { data: updatedRows, error } = await supabase
        .from('profiles')
        .update({
          preco_individual: preco,
          faixas_preco_individual: cleanFaixas,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId)
        .select('id');

      if (error) {
        throw new Error(
          /faixas_preco_individual/.test(error.message)
            ? 'A coluna de faixas individuais ainda não existe no Supabase. Execute o SQL de migração (supabase-rls-policies.sql / ALTER TABLE profiles ADD COLUMN faixas_preco_individual).'
            : `Erro ao salvar no Supabase: ${error.message}`
        );
      }
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'Nada foi gravado: o Supabase bloqueou a alteração (política RLS da tabela profiles ausente). Execute o SQL de políticas de profiles e tente novamente.'
        );
      }
      return {
        sucesso: true,
        mensagem: cleanFaixas
          ? `${cleanFaixas.length} faixas de preço personalizadas salvas para o parceiro.`
          : preco
            ? `Preço individual de R$ ${preco.toFixed(2)} configurado para o parceiro.`
            : 'Preço individual removido. Parceiro retornou à tabela global.',
      };
    }
  },
  getAuditLogs: async (): Promise<{ sucesso: boolean; logs: any[] }> => {
    try {
      return await request<{ sucesso: boolean; logs: any[] }>('/api/admin/audit-logs');
    } catch {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      return { sucesso: true, logs: (data as any[]) || [] };
    }
  },

  // Melhor Envio & Fretes Inteligentes
  calculateShipping: (cepDestino: string, quantidadePlacas: number) =>
    request<{ sucesso: boolean; opcoes: ShippingOption[]; origem_cep?: string; destino_cep?: string; mensagem?: string }>('/api/shipping/calculate', {
      method: 'POST',
      body: JSON.stringify({ cep_destino: cepDestino, quantidade_placas: quantidadePlacas }),
    }),
  generateShippingLabel: (orderId: string) =>
    request<{ sucesso: boolean; codigo_rastreamento: string; etiqueta_url: string; modo?: string; mensagem?: string }>('/api/shipping/generate-label', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId }),
    }),

  // Supabase (PostgreSQL & Nuvem)
  getSupabaseStatus: () =>
    request<{
      sucesso: boolean;
      configurado: boolean;
      url: string | null;
      tem_chave: boolean;
      regiao_recomendada: string;
      estatisticas_locais: any;
      mensagem: string;
    }>('/api/admin/supabase-status'),
  testSupabase: () =>
    request<{ sucesso: boolean; configurado: boolean; schema_pendente?: boolean; mensagem: string; url?: string }>('/api/admin/supabase-test', {
      method: 'POST',
    }),
  syncSupabase: () =>
    request<{ sucesso: boolean; mensagem: string; detalhes?: any }>('/api/admin/supabase-sync', {
      method: 'POST',
    }),

  // Backup & Restauração
  getBackupConfig: () =>
    request<{
      sucesso: boolean;
      config: {
        enabled: boolean;
        horarios: string[];
        max_arquivos: number;
        destino_automatico: 'local' | 'google_drive' | 'ambos';
        drive_folder_id?: string | null;
        drive_folder_name?: string | null;
        ultimo_backup?: string | null;
      };
    }>('/api/backup/config'),
  updateBackupConfig: (body: {
    enabled?: boolean;
    horarios?: string[];
    max_arquivos?: number;
    destino_automatico?: 'local' | 'google_drive' | 'ambos';
    drive_folder_id?: string | null;
    drive_folder_name?: string | null;
  }) =>
    request<{ sucesso: boolean; mensagem: string; config: any }>('/api/backup/config', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listBackups: () =>
    request<{
      sucesso: boolean;
      backups: Array<{
        filename: string;
        size: number;
        size_formatted: string;
        created_at: string;
        formatted_date: string;
        origem: string;
        estatisticas: any;
        checksum: string | null;
      }>;
    }>('/api/backup/list'),
  createBackup: () =>
    request<{ sucesso: boolean; mensagem: string; backup: any }>('/api/backup/create', {
      method: 'POST',
    }),
  deleteBackup: (filename: string) =>
    request<{ sucesso: boolean; mensagem: string }>(`/api/backup/${filename}`, {
      method: 'DELETE',
    }),
  restoreBackup: (payload: any) =>
    request<{ sucesso: boolean; mensagem: string; detalhes?: any }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
