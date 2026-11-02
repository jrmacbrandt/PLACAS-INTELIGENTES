import type { Profile, Order, Plate, PricingTier, AdminStats, ShippingOption } from './types.js';

let currentUserId = 'prof_admin_001';

export function setCurrentUser(id: string) {
  currentUserId = id;
}

export function getCurrentUserId(): string {
  return currentUserId;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': currentUserId,
    ...(options.headers || {}),
  };

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensagem || 'Ocorreu um erro na solicitação.');
  }

  return data;
}

export const api = {
  // Autenticação & Perfis
  getProfiles: () => request<{ sucesso: boolean; perfis: Profile[] }>('/api/auth/profiles'),
  getMe: () => request<{ sucesso: boolean; perfil: Profile }>('/api/auth/me'),
  registerPublic: (body: any) => request<{ sucesso: boolean; mensagem: string; perfil: Profile }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  adminCreateUser: (body: any) => request<{ sucesso: boolean; mensagem: string; perfil: Profile }>('/api/auth/admin-create', { method: 'POST', body: JSON.stringify(body) }),

  // Pedidos
  getOrders: () => request<{ sucesso: boolean; pedidos: Order[] }>('/api/orders'),
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
  getPlates: () => request<{ sucesso: boolean; placas: Plate[] }>('/api/plates'),
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
  getAdminStats: () => request<{ sucesso: boolean; indicadores: AdminStats }>('/api/admin/stats'),
  getPricingTiers: () => request<{ sucesso: boolean; faixas: PricingTier[] }>('/api/admin/pricing-tiers'),
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
