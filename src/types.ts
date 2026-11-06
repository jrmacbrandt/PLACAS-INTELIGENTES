export type UserRole = 'visitante' | 'revendedor' | 'admin';
export type PartnerType = 'revendedor_independente' | 'equipe_interna' | 'parceiro_especial';
export type DeliveryPreference = 'retirada' | 'correios';

export type OrderStatus = 
  | 'aguardando_pagamento' 
  | 'pago' 
  | 'em_analise' 
  | 'aprovado' 
  | 'em_producao' 
  | 'concluido' 
  | 'cancelado';

export interface ProfileTier {
  quantidade_minima: number;
  quantidade_maxima: number | null;
  preco_unitario: number;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  telefone: string;
  cpf_cnpj: string;
  role: UserRole;
  tipo_parceiro: PartnerType;
  preferencia_entrega: DeliveryPreference;
  preco_individual: number | null;
  faixas_preco_individual?: ProfileTier[] | null;
  ativo: boolean;
  is_master?: boolean;
  tem_senha?: boolean;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  numero_pedido: string;
  revendedor_id: string;
  revendedor_nome?: string;
  revendedor_telefone?: string;
  revendedor_email?: string;
  revendedor_tipo?: PartnerType;
  origem: 'compra_revendedor' | 'solicitacao_interna';
  cliente_id: string | null;
  cliente_nome?: string;
  status: OrderStatus;
  quantidade_total: number;
  preco_unitario_aplicado: number;
  valor_frete?: number;
  valor_total: number;
  modalidade_entrega: DeliveryPreference;
  observacoes_admin: string | null;
  aprovado_por: string | null;
  data_aprovacao: string | null;
  placa_codigo_inicial?: string | null;
  placa_codigo_final?: string | null;
  qrcodes_gerados?: boolean;
  total_placas_geradas?: number;
  mfg_status?: string | null;
  created_at: string;
  logistica?: {
    id: string;
    modalidade: DeliveryPreference;
    responsavel_retirada_nome: string | null;
    responsavel_retirada_telefone: string | null;
    retirada_status: string | null;
    data_retirada_efetiva: string | null;
    destinatario_nome: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    transportadora?: string | null;
    servico_frete?: string | null;
    servico_frete_id?: number | null;
    valor_frete?: number | null;
    prazo_dias?: number | null;
    melhor_envio_cart_id?: string | null;
    melhor_envio_order_id?: string | null;
    melhor_envio_protocol?: string | null;
    melhor_envio_status?: string | null;
    cotacao_json?: string | null;
    etiqueta_url?: string | null;
    codigo_rastreamento: string | null;
    correios_status: string | null;
    data_postagem: string | null;
    comprovante_url?: string | null;
  };
}

export interface ShippingOption {
  service_id: number;
  carrier_name: string;
  service_name: string;
  picture?: string;
  price: number;
  original_price?: number;
  delivery_time: number;
  is_cheapest?: boolean;
  is_fastest?: boolean;
  discount_percentage?: number;
}

export interface Plate {
  id: string;
  manufacturing_order_id?: string | null;
  order_id?: string | null;
  numero_pedido?: string;
  revendedor_id: string | null;
  revendedor_nome?: string;
  codigo_sequencial: string;
  token_publico: string;
  url_permanente: string;
  qrcode_url?: string | null;
  qrcode_data_url?: string;
  nome_estabelecimento: string | null;
  categoria_estabelecimento: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  tipo_destino: 'google_reviews' | 'whatsapp' | 'instagram' | 'website' | 'personalizado' | null;
  url_destino: string | null;
  status_fisico: 'planejada' | 'em_producao' | 'produzida' | 'aprovada' | 'reprovada' | 'liberada' | 'bloqueada';
  status_digital: 'inativa' | 'ativa' | 'bloqueada';
  status_nfc: 'nao_instalado' | 'instalado' | 'gravado' | 'testado' | 'com_problema';
  data_fabricacao: string | null;
  data_liberacao: string | null;
  data_ativacao: string | null;
  created_at: string;
}

export interface PricingTier {
  id: number;
  quantidade_minima: number;
  quantidade_maxima: number | null;
  preco_unitario: number;
  ativo: boolean;
}

export interface AdminStats {
  pedidos_aguardando_pagamento: number;
  pedidos_pagos: number;
  reservas_aguardando_aprovacao: number;
  faturamento_total: number;
  placas_produzidas: number;
  placas_aprovadas: number;
  placas_reprovadas: number;
  placas_liberadas: number;
  placas_ativas: number;
  retiradas_prontas: number;
  correios_aguardando_postagem: number;
  total_revendedores: number;
}

export interface IntegrationSettings {
  // 1. Asaas (Pagamentos PIX, Boleto & Webhook)
  asaas_env: 'sandbox' | 'production';
  asaas_api_key: string;
  asaas_webhook_token: string;
  asaas_wallet_id: string;
  asaas_dias_vencimento: number;

  // 2. Melhor Envio (Frete, Cotação, OAuth2 & Etiquetas)
  melhor_envio_env: 'sandbox' | 'production';
  melhor_envio_token: string;
  melhor_envio_refresh_token?: string;
  melhor_envio_token_expires_at?: string;
  melhor_envio_client_id?: string;
  melhor_envio_client_secret?: string;
  melhor_envio_redirect_uri?: string;
  melhor_envio_webhook_secret?: string;
  melhor_envio_scopes?: string;
  melhor_envio_user_agent: string;
  melhor_envio_servicos: string; // ex: '1,2,3,4,17'
  melhor_envio_seguro_automatico: boolean;
  melhor_envio_non_commercial?: boolean;
  melhor_envio_receipt?: boolean;
  melhor_envio_own_hand?: boolean;

  // Dados do Remetente (Origem do Atelier)
  origem_nome: string;
  origem_cpf_cnpj: string;
  origem_telefone: string;
  origem_email: string;
  origem_cep: string;
  origem_logradouro: string;
  origem_numero: string;
  origem_complemento: string;
  origem_bairro: string;
  origem_cidade: string;
  origem_uf: string;

  // Parâmetros Físicos da Placa Unitária
  placa_peso_kg: number;         // ex: 0.06 (60g)
  placa_largura_cm: number;      // ex: 10 cm
  placa_comprimento_cm: number;  // ex: 15 cm
  placa_espessura_cm: number;    // ex: 0.4 cm

  // Parâmetros Físicos das Caixas / Embalagens
  embalagem_tara_kg: number;            // ex: 0.10 (100g da caixa + proteção)
  caixa_padrao_max_placas: number;      // ex: 30 placas
  caixa_padrao_largura_cm: number;      // ex: 14 cm
  caixa_padrao_comprimento_cm: number;  // ex: 18 cm
  caixa_padrao_altura_min_cm: number;   // ex: 4 cm
  caixa_padrao_folga_altura_cm: number; // ex: 3 cm
  caixa_grande_largura_cm: number;      // ex: 22 cm
  caixa_grande_comprimento_cm: number;  // ex: 30 cm
  caixa_grande_altura_min_cm: number;   // ex: 8 cm
  caixa_altura_max_cm: number;          // ex: 60 cm

  // 3. Google Gemini AI (OCR de Comprovantes de Postagem)
  gemini_api_key: string;
  gemini_model: string; // ex: 'gemini-3.8-flash'
  gemini_auto_preencher: boolean;

  // 4. WhatsApp & Atendimento Operacional
  whatsapp_empresa: string;
  updated_at?: string;
}

export interface PackageCalculationResult {
  box_type: 'caixa_padrao' | 'caixa_grande';
  box_label: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  plates_weight_kg: number;
  tare_weight_kg: number;
}

