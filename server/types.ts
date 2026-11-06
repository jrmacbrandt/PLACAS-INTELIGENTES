/**
 * Tipos e Interfaces do Banco de Dados e APIs da Plataforma
 * Alinhado ao Prompt Mestre Versão 5.0 e Adendo Obrigatório
 */

export type UserRole = 'visitante' | 'revendedor' | 'admin';
export type PartnerType = 'revendedor_independente' | 'equipe_interna' | 'parceiro_especial';
export type DeliveryPreference = 'retirada' | 'correios';

export type OrderOrigin = 'compra_revendedor' | 'solicitacao_interna';
export type OrderStatus = 
  | 'aguardando_pagamento' 
  | 'pago' 
  | 'em_analise' 
  | 'aprovado' 
  | 'em_producao' 
  | 'concluido' 
  | 'cancelado';

export type WithdrawalStatus = 
  | 'retirada_selecionada' 
  | 'aguardando_producao' 
  | 'aguardando_liberacao' 
  | 'pronta_para_retirada' 
  | 'retirada_agendada' 
  | 'retirada_realizada' 
  | 'cancelada';

export type CorreiosStatus = 
  | 'aguardando_producao' 
  | 'aguardando_liberacao' 
  | 'aguardando_etiqueta' 
  | 'aguardando_postagem' 
  | 'postado' 
  | 'em_transito' 
  | 'entregue' 
  | 'com_ocorrencia';

export type ManufacturingStatus = 
  | 'aguardando_autorizacao' 
  | 'aguardando_producao' 
  | 'em_producao' 
  | 'producao_parcial' 
  | 'producao_concluida' 
  | 'aguardando_inspecao' 
  | 'inspecao_concluida' 
  | 'atribuicao_concluida' 
  | 'cancelada';

export type PlatePhysicalStatus = 
  | 'planejada' 
  | 'em_producao' 
  | 'produzida' 
  | 'aguardando_inspecao' 
  | 'aprovada' 
  | 'reprovada' 
  | 'atribuida' 
  | 'liberada' 
  | 'bloqueada' 
  | 'descartada';

export type PlateDigitalStatus = 'inativa' | 'ativa' | 'bloqueada';
export type NfcStatus = 'nao_instalado' | 'instalado' | 'gravado' | 'testado' | 'com_problema';
export type DestinationType = 'google_reviews' | 'whatsapp' | 'instagram' | 'website' | 'personalizado';

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
  faixas_preco_individual?: Array<{ quantidade_minima: number; quantidade_maxima: number | null; preco_unitario: number }> | null;
  ativo: boolean;
  is_master?: boolean;
  senha_hash?: string | null;
  tem_senha?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingTier {
  id: number;
  quantidade_minima: number;
  quantidade_maxima: number | null;
  preco_unitario: number;
  ativo: boolean;
}

export interface Client {
  id: string;
  revendedor_id: string;
  nome_estabelecimento: string;
  categoria: string;
  contato_nome: string;
  contato_telefone: string;
  email: string;
  cidade: string;
  uf: string;
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
  origem: OrderOrigin;
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
  updated_at: string;
  logistica?: OrderLogistics;
}

export interface OrderLogistics {
  id: string;
  order_id: string;
  modalidade: DeliveryPreference;
  responsavel_retirada_nome: string | null;
  responsavel_retirada_telefone: string | null;
  retirada_status: WithdrawalStatus | null;
  data_retirada_efetiva: string | null;
  liberado_por: string | null;
  destinatario_nome: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_rastreamento: string | null;
  correios_status: CorreiosStatus | null;
  data_postagem: string | null;
  comprovante_url?: string | null;
}

export interface ManufacturingOrder {
  id: string;
  order_id: string;
  numero_pedido?: string;
  revendedor_nome?: string;
  origem: OrderOrigin;
  quantidade_solicitada: number;
  quantidade_produzida: number;
  quantidade_aprovada: number;
  quantidade_reprovada: number;
  status: ManufacturingStatus;
  created_at: string;
  updated_at: string;
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
  nome_estabelecimento: string | null;
  categoria_estabelecimento: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  tipo_destino: DestinationType | null;
  url_destino: string | null;
  status_fisico: PlatePhysicalStatus;
  status_digital: PlateDigitalStatus;
  status_nfc: NfcStatus;
  data_fabricacao: string | null;
  data_liberacao: string | null;
  data_ativacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  plate_id: string;
  codigo_sequencial?: string;
  resultado: 'aprovada' | 'reprovada';
  inspetor_id: string;
  inspetor_nome?: string;
  qr_code_legivel: boolean;
  acrilico_conforme: boolean;
  nfc_gravado_correto: boolean;
  motivo_reprovacao: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface DestinationHistory {
  id: string;
  plate_id: string;
  destino_anterior: string | null;
  destino_novo: string;
  alterado_por: string;
  alterado_por_nome?: string;
  data_alteracao: string;
}

export interface Payment {
  id: string;
  order_id: string;
  asaas_payment_id: string;
  valor: number;
  forma_pagamento: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED';
  pix_qrcode_url: string | null;
  pix_copia_cola: string | null;
  boleto_url: string | null;
  data_confirmacao: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  usuario_id: string | null;
  usuario_nome?: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_anteriores: any;
  dados_novos: any;
  ip_origem: string | null;
  created_at: string;
}
