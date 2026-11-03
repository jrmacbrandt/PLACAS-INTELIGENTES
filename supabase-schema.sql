-- =============================================================================
-- ESQUEMA COMPLETO POSTGRESQL — ATELIER DAS PLACAS (SUPABASE)
-- Versão: 5.0
-- Região Recomendada no Supabase: sa-east-1 (São Paulo, Brasil)
-- Este script pode ser colado e executado diretamente no SQL Editor do Supabase.
-- =============================================================================

-- Habilita extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PERFIS DE USUÁRIOS (ADMIN, REVENDEDOR, VENDEDOR INTERNO)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  cpf_cnpj TEXT,
  role TEXT NOT NULL DEFAULT 'revendedor', -- 'visitante', 'revendedor', 'admin'
  tipo_parceiro TEXT NOT NULL DEFAULT 'revendedor_independente', -- 'revendedor_independente', 'equipe_interna', 'parceiro_especial'
  preferencia_entrega TEXT NOT NULL DEFAULT 'correios', -- 'retirada', 'correios'
  preco_individual NUMERIC(10, 2) DEFAULT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_master BOOLEAN NOT NULL DEFAULT false,
  senha_hash TEXT DEFAULT NULL,
  cep TEXT DEFAULT NULL,
  logradouro TEXT DEFAULT NULL,
  numero TEXT DEFAULT NULL,
  complemento TEXT DEFAULT NULL,
  bairro TEXT DEFAULT NULL,
  cidade TEXT DEFAULT NULL,
  estado TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migração idempotente caso a tabela profiles já exista no Supabase
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_hash TEXT DEFAULT NULL;

-- 2. TABELA DE PREÇOS POR VOLUME (ADR 002)
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  id SERIAL PRIMARY KEY,
  quantidade_minima INTEGER NOT NULL UNIQUE,
  quantidade_maxima INTEGER,
  preco_unitario NUMERIC(10, 2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CLIENTES COMERCIAIS
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  revendedor_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome_estabelecimento TEXT NOT NULL,
  categoria TEXT,
  contato_nome TEXT,
  contato_telefone TEXT,
  email TEXT,
  cidade TEXT,
  uf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. PEDIDOS E SOLICITAÇÕES
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  numero_pedido TEXT UNIQUE NOT NULL,
  revendedor_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  origem TEXT NOT NULL DEFAULT 'compra_revendedor', -- 'compra_revendedor', 'solicitacao_interna'
  cliente_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  quantidade_total INTEGER NOT NULL CHECK (quantidade_total >= 1),
  preco_unitario_aplicado NUMERIC(10, 2) NOT NULL,
  valor_frete NUMERIC(10, 2) DEFAULT 0,
  valor_total NUMERIC(10, 2) NOT NULL,
  modalidade_entrega TEXT NOT NULL, -- 'retirada', 'correios'
  observacoes_admin TEXT,
  aprovado_por TEXT REFERENCES public.profiles(id),
  data_aprovacao TIMESTAMPTZ,
  placa_codigo_inicial TEXT DEFAULT NULL,
  placa_codigo_final TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. LOGÍSTICA DO PEDIDO (DESACOPLADA - ADR 003 E MELHOR ENVIO ADR 010)
CREATE TABLE IF NOT EXISTS public.order_logistics (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  modalidade TEXT NOT NULL,
  responsavel_retirada_nome TEXT,
  responsavel_retirada_telefone TEXT,
  retirada_status TEXT, -- 'retirada_selecionada', 'pronta_para_retirada', 'retirada_realizada'
  data_retirada_efetiva TIMESTAMPTZ,
  liberado_por TEXT REFERENCES public.profiles(id),
  destinatario_nome TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  transportadora TEXT,
  servico_frete TEXT,
  servico_frete_id INTEGER,
  valor_frete NUMERIC(10, 2) DEFAULT 0,
  prazo_dias INTEGER,
  melhor_envio_cart_id TEXT,
  melhor_envio_order_id TEXT,
  etiqueta_url TEXT,
  codigo_rastreamento TEXT,
  correios_status TEXT, -- 'aguardando_producao', 'aguardando_postagem', 'etiqueta_gerada', 'postado', 'em_transito', 'entregue'
  data_postagem TIMESTAMPTZ,
  comprovante_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. FILA UNIFICADA DE FABRICAÇÃO SOB DEMANDA
CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  origem TEXT NOT NULL,
  quantidade_solicitada INTEGER NOT NULL,
  quantidade_produzida INTEGER NOT NULL DEFAULT 0,
  quantidade_aprovada INTEGER NOT NULL DEFAULT 0,
  quantidade_reprovada INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_autorizacao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. PLACAS FÍSICAS INDIVIDUAIS (ADENDO V5.0)
CREATE TABLE IF NOT EXISTS public.plates (
  id TEXT PRIMARY KEY,
  manufacturing_order_id TEXT REFERENCES public.manufacturing_orders(id),
  order_id TEXT REFERENCES public.orders(id),
  revendedor_id TEXT REFERENCES public.profiles(id) ON DELETE RESTRICT,
  codigo_sequencial TEXT UNIQUE NOT NULL,
  token_publico TEXT UNIQUE NOT NULL,
  url_permanente TEXT NOT NULL,
  nome_estabelecimento TEXT,
  categoria_estabelecimento TEXT,
  contato_nome TEXT,
  contato_telefone TEXT,
  tipo_destino TEXT, -- 'google_reviews', 'whatsapp', 'instagram', 'website', 'personalizado'
  url_destino TEXT,
  status_fisico TEXT NOT NULL DEFAULT 'planejada', -- 'planejada', 'em_producao', 'produzida', 'aprovada', 'reprovada', 'liberada', 'bloqueada'
  status_digital TEXT NOT NULL DEFAULT 'inativa',  -- 'inativa', 'ativa', 'bloqueada'
  status_nfc TEXT NOT NULL DEFAULT 'nao_instalado', -- 'nao_instalado', 'gravado', 'testado'
  data_fabricacao TIMESTAMPTZ,
  data_liberacao TIMESTAMPTZ,
  data_ativacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. INSPEÇÃO FÍSICA DE QUALIDADE
CREATE TABLE IF NOT EXISTS public.inspections (
  id TEXT PRIMARY KEY,
  plate_id TEXT NOT NULL REFERENCES public.plates(id) ON DELETE CASCADE,
  resultado TEXT NOT NULL, -- 'aprovada', 'reprovada'
  inspetor_id TEXT NOT NULL REFERENCES public.profiles(id),
  qr_code_legivel BOOLEAN NOT NULL,
  acrilico_conforme BOOLEAN NOT NULL,
  nfc_gravado_correto BOOLEAN NOT NULL,
  motivo_reprovacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. HISTÓRICO DE DESTINOS DA PLACA
CREATE TABLE IF NOT EXISTS public.destination_history (
  id TEXT PRIMARY KEY,
  plate_id TEXT NOT NULL REFERENCES public.plates(id) ON DELETE CASCADE,
  destino_anterior TEXT,
  destino_novo TEXT NOT NULL,
  alterado_por TEXT NOT NULL REFERENCES public.profiles(id),
  data_alteracao TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. TRANSAÇÕES DE PAGAMENTO (ASAAS)
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  asaas_payment_id TEXT UNIQUE NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  forma_pagamento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  pix_qrcode_url TEXT,
  pix_copia_cola TEXT,
  boleto_url TEXT,
  data_confirmacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. CONTROLE DE IDEMPOTÊNCIA DE WEBHOOKS
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  processado BOOLEAN NOT NULL DEFAULT false,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  mensagem_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. LOGS DE AUDITORIA DO SISTEMA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  usuario_id TEXT REFERENCES public.profiles(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE ULTRA-RÁPIDA (REDIRECIONAMENTO QR CODE < 100MS)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_plates_token_publico ON public.plates(token_publico);
CREATE INDEX IF NOT EXISTS idx_plates_codigo_sequencial ON public.plates(codigo_sequencial);
CREATE INDEX IF NOT EXISTS idx_plates_revendedor_id ON public.plates(revendedor_id);
CREATE INDEX IF NOT EXISTS idx_plates_order_id ON public.plates(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_revendedor_id ON public.orders(revendedor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_logistics_order_id ON public.order_logistics(order_id);
CREATE INDEX IF NOT EXISTS idx_order_logistics_codigo_rastreio ON public.order_logistics(codigo_rastreamento);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- =============================================================================
-- DADOS INICIAIS BASE (PRECIFICAÇÃO POR VOLUME E ADMIN)
-- =============================================================================
INSERT INTO public.pricing_tiers (quantidade_minima, quantidade_maxima, preco_unitario, ativo)
VALUES 
  (1, 9, 21.90, true),
  (10, 49, 19.90, true),
  (50, NULL, 17.90, true)
ON CONFLICT (quantidade_minima) DO NOTHING;

INSERT INTO public.profiles (
  id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega,
  is_master, senha_hash, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo
)
VALUES (
  'prof_admin_001',
  'auth_admin_001',
  'José Roberto Machado Brandt',
  'jrmacbrandt@gmail.com',
  '21980914107',
  '06865841719',
  'admin',
  'equipe_interna',
  'correios',
  true,
  'scrypt$atelier_master_v5_salt_2026$a5574575683208a5ca506a0cffc7b1b6e2b22e46bba2ab13c299957d3feecd7d30dff19efc9630f9742cfb5ee0135bf9322f7a2a4dc1311f6921472c7a04bbcc',
  '22745-271',
  'Rua Araguaia',
  '1111',
  'Apto 403',
  'Freguesia (Jacarepaguá)',
  'Rio de Janeiro',
  'RJ',
  true
)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  role = EXCLUDED.role,
  is_master = true,
  senha_hash = COALESCE(public.profiles.senha_hash, EXCLUDED.senha_hash),
  telefone = EXCLUDED.telefone,
  cpf_cnpj = EXCLUDED.cpf_cnpj;
