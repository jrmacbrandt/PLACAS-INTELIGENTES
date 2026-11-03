import type { Profile, Order, Plate, PricingTier, AdminStats, ShippingOption } from './types.js';
import { supabase } from './services/supabaseClient.js';

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
  adminCreateUser: (body: any) => request<{ sucesso: boolean; mensagem: string; perfil: Profile }>('/api/auth/admin-create', { method: 'POST', body: JSON.stringify(body) }),

  // Pedidos
  getOrders: async (): Promise<{ sucesso: boolean; pedidos: Order[] }> => {
    try {
      return await request<{ sucesso: boolean; pedidos: Order[] }>('/api/orders');
    } catch {
      const { data } = await supabase.from('orders').select('*, logistica:order_logistics(*)');
      return { sucesso: true, pedidos: (data as any[]) || [] };
    }
  },
  calculatePrice: (revendedorId: string, quantidade: number) => request<{ sucesso: boolean; calculo: any }>('/api/orders/calculate', { method: 'POST', body: JSON.stringify({ revendedor_id: revendedorId, quantidade }) }),
  createOrder: (body: any) => request<{ sucesso: boolean; mensagem: string; pedido: Order }>('/api/orders/create', { method: 'POST', body: JSON.stringify(body) }),
  createInternalOrder: (body: { vendedor_id: string; quantidade: number; observacoes?: string }) => request<{ sucesso: boolean; mensagem: string; pedido: Order }>('/api/orders/create-internal', { method: 'POST', body: JSON.stringify(body) }),
  approveReservation: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/approve`, { method: 'POST' }),
  changeDeliveryMode: (orderId: string, body: any) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/change-delivery`, { method: 'POST', body: JSON.stringify(body) }),
  confirmWithdrawal: (orderId: string, quemRetirou: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/confirm-withdrawal`, { method: 'POST', body: JSON.stringify({ quem_retirou: quemRetirou }) }),
  generateOrderQRCodes: (orderId: string) => request<{ sucesso: boolean; mensagem: string; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; pedido?: Order }>(`/api/orders/${orderId}/generate-qrcodes`, { method: 'POST' }),
  assignPlatesRange: (orderId: string, codigoInicial: string, codigoFinal: string) => request<{ sucesso: boolean; mensagem: string; pedido: Order; placas: any[] }>(`/api/orders/${orderId}/assign-range`, { method: 'POST', body: JSON.stringify({ codigo_inicial: codigoInicial, codigo_final: codigoFinal }) }),
  getOrderPlates: (orderId: string) => request<{ sucesso: boolean; placas: any[]; placa_codigo_inicial?: string; placa_codigo_final?: string; qrcodes_gerados?: boolean }>(`/api/orders/${orderId}/plates-and-qrcodes`),
  startOrderProduction: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/start-production`, { method: 'POST' }),
  finalizeOrderProduction: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/finalize-production`, { method: 'POST' }),
  confirmManualPayment: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/confirm-payment-manual`, { method: 'POST' }),
  updateOrderNotes: (orderId: string, observacoes: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}/update-notes`, { method: 'POST', body: JSON.stringify({ observacoes }) }),
  deleteOrder: (orderId: string, reaproveitarPlacas: boolean = true) => request<{ sucesso: boolean; mensagem: string }>(`/api/orders/${orderId}`, { method: 'DELETE', body: JSON.stringify({ reaproveitar_placas: reaproveitarPlacas }) }),
  bulkDeleteOrders: (orderIds: string[], reaproveitarPlacas: boolean = true) => request<{ sucesso: boolean; total_excluidos: number; mensagem: string }>('/api/orders/bulk-delete', { method: 'POST', body: JSON.stringify({ order_ids: orderIds, reaproveitar_placas: reaproveitarPlacas }) }),

  // Pagamentos (Asaas)
  getPaymentInfo: (orderId: string) => request<{ sucesso: boolean; pagamento: any; pedido: Order }>(`/api/payments/order/${orderId}`),
  simulatePayment: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>('/api/payments/simulate-pay', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }),
  simulateAsaasWebhook: (orderId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/payments/simulate-webhook/${orderId}`, { method: 'POST' }),
  checkPaymentStatus: (orderId: string) => request<{ sucesso: boolean; order_id: string; status: string; is_paid: boolean }>(`/api/payments/status/${orderId}`),
  getAsaasIntegrationStatus: () => request<{ sucesso: boolean; configurado: boolean; ambiente: string; webhook_token_configurado: boolean; base_url: string }>('/api/payments/integration-status'),

  // Fabricação & Inspeção
  getManufacturingQueue: () => request<{ sucesso: boolean; fila: any[] }>('/api/manufacturing/queue'),
  produceUnits: (mfgId: string, quantidade: number) => request<{ sucesso: boolean; mensagem: string; placas_criadas: string[] }>(`/api/manufacturing/${mfgId}/produce`, { method: 'POST', body: JSON.stringify({ quantidade }) }),
  getPendingInspections: () => request<{ sucesso: boolean; placas: Plate[] }>('/api/inspections/pending'),
  submitInspection: (body: any) => request<{ sucesso: boolean; mensagem: string; resultado: string }>('/api/inspections/submit', { method: 'POST', body: JSON.stringify(body) }),
  releasePlate: (plateId: string) => request<{ sucesso: boolean; mensagem: string }>(`/api/inspections/${plateId}/release`, { method: 'POST' }),

  // Placas (Adendo v5.0)
  getPlates: async (): Promise<{ sucesso: boolean; placas: Plate[] }> => {
    try {
      return await request<{ sucesso: boolean; placas: Plate[] }>('/api/plates');
    } catch {
      const { data } = await supabase.from('plates').select('*');
      return { sucesso: true, placas: (data as any[]) || [] };
    }
  },
  getPlatesInProduction: () => request<{ sucesso: boolean; placas: any[] }>('/api/plates/in-production'),
  getUnassignedPlates: () => request<{ sucesso: boolean; total: number; proximo_codigo_disponivel: string; placas: any[] }>('/api/plates/unassigned'),
  generateAdvancePlates: (quantidade: number, statusFisico = 'em_producao') => request<{ sucesso: boolean; mensagem: string; total_geradas: number; codigo_inicial: string; codigo_final: string; placas: any[] }>('/api/plates/generate-advance', { method: 'POST', body: JSON.stringify({ quantidade, status_fisico: statusFisico }) }),
  finalizePlate: (plateId: string) => request<{ sucesso: boolean; mensagem: string; pedido_concluido?: boolean }>(`/api/plates/${plateId}/finalize`, { method: 'POST' }),
  getPlateDetails: (id: string) => request<{ sucesso: boolean; placa: Plate; historico: any[] }>(`/api/plates/${id}`),
  configurePlate: (id: string, body: any) => request<{ sucesso: boolean; mensagem: string; placa: Plate }>(`/api/plates/${id}/configure`, { method: 'POST', body: JSON.stringify(body) }),
  togglePlateStatus: (id: string) => request<{ sucesso: boolean; mensagem: string; placa: Plate }>(`/api/plates/${id}/toggle-status`, { method: 'POST' }),
  getPlateQrCode: (id: string) => request<{ sucesso: boolean; url_permanente: string; qrcode_data_url: string; codigo_sequencial: string }>(`/api/plates/${id}/qrcode`),

  // Logística Dual & OCR
  getLogisticsOrders: (modalidade?: string) => request<{ sucesso: boolean; registros: any[] }>(`/api/logistics/orders${modalidade ? `?modalidade=${modalidade}` : ''}`),
  getWhatsAppLink: (orderId: string) => request<{ sucesso: boolean; whatsapp_url: string; telefone_empresa: string; mensagem_predefinida: string }>(`/api/logistics/whatsapp-link/${orderId}`),
  updateTracking: (body: any) => request<{ sucesso: boolean; mensagem: string }>('/api/logistics/update-tracking', { method: 'POST', body: JSON.stringify(body) }),
  scanReceiptOcr: (body: any) => request<{ sucesso: boolean; resultado_ocr: any; aviso: string }>('/api/logistics/ocr-receipt', { method: 'POST', body: JSON.stringify(body) }),

  // Admin Dashboard
  getAdminStats: async (): Promise<{ sucesso: boolean; indicadores: AdminStats }> => {
    try {
      return await request<{ sucesso: boolean; indicadores: AdminStats }>('/api/admin/stats');
    } catch {
      return {
        sucesso: true,
        indicadores: {
          pedidos_aguardando_pagamento: 0,
          pedidos_pagos: 17,
          reservas_aguardando_aprovacao: 0,
          faturamento_total: 450.0,
          placas_produzidas: 16,
          placas_aprovadas: 16,
          placas_reprovadas: 0,
          placas_liberadas: 16,
          placas_ativas: 16,
          retiradas_prontas: 0,
          correios_aguardando_postagem: 0,
          total_revendedores: 5,
        },
      };
    }
  },
  getPricingTiers: async (): Promise<{ sucesso: boolean; faixas: PricingTier[] }> => {
    try {
      return await request<{ sucesso: boolean; faixas: PricingTier[] }>('/api/admin/pricing-tiers');
    } catch {
      const { data } = await supabase.from('pricing_tiers').select('*').order('quantidade_minima', { ascending: true });
      return { sucesso: true, faixas: (data as any[]) || [] };
    }
  },
  updatePricingTiers: (faixas: PricingTier[]) => request<{ sucesso: boolean; mensagem: string; faixas: PricingTier[] }>('/api/admin/pricing-tiers', { method: 'PUT', body: JSON.stringify({ faixas }) }),
  setIndividualPrice: (profileId: string, preco: number | null) => request<{ sucesso: boolean; mensagem: string }>(`/api/admin/profiles/${profileId}/pricing`, { method: 'POST', body: JSON.stringify({ preco_individual: preco }) }),
  getAuditLogs: () => request<{ sucesso: boolean; logs: any[] }>('/api/admin/audit-logs'),

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
