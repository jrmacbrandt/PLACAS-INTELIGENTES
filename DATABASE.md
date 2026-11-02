# DATABASE.md — MODELO DE DADOS RELACIONAL E REGRAS DE INTEGRIDADE (VERSÃO 5.0)

**Compatibilidade:** PostgreSQL 15+ / Supabase  
**Status:** Etapa 3 — Documentação Oficial do Projeto  
**Alinhamento:** ADR 001 (PostgreSQL relacional puro com RLS) e ADR 002/003/004/005

---

## 1. VISÃO GERAL DAS ENTIDADES

```
                      +-------------------+
                      |     profiles      |
                      +---------+---------+
                                | 1
                                |
             +------------------+------------------+
             | n                                   | n
      +------v------+                       +------v------+
      |   orders    |                       |   clients   |
      +------+------+                       +------+------+
             | 1                                   | 1
             |                                     |
      +------v------+                              | n
      | order_items |                       +------v------+
      +------+------+                       |opportunities|
             |                                     |
             | 1:1                                 |
      +------v----------+                          |
      | order_logistics |                          |
      +------+----------+                          |
             |                                     |
             | n                                   |
+------------v------------+                        |
|  manufacturing_orders   |<-----------------------+ (reserva interna)
+------------+------------+
             | 1
             | n
      +------v------+
      |   plates    |<-------------------+
      +------+------+                    |
             | 1                         | 1
             +-------------+-------------+
             | n           | n
      +------v------+ +----v---------------+
      | inspections | |destination_history |
      +-------------+ +--------------------+
```

---

## 2. ESQUEMA DDL COMPLETO (POSTGRESQL / SUPABASE)

```sql
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE PERFIS DE USUÁRIO (UNIFICADA)
CREATE TYPE user_role AS ENUM ('visitante', 'revendedor', 'admin');
CREATE TYPE partner_type AS ENUM ('revendedor_independente', 'equipe_interna', 'parceiro_especial');
CREATE TYPE delivery_preference AS ENUM ('retirada', 'correios');

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Vínculo com supabase.auth.users
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(30),
    cpf_cnpj VARCHAR(20),
    role user_role NOT NULL DEFAULT 'revendedor',
    tipo_parceiro partner_type NOT NULL DEFAULT 'revendedor_independente',
    preferencia_entrega delivery_preference NOT NULL DEFAULT 'retirada',
    preco_individual NUMERIC(10, 2) DEFAULT NULL, -- Se preenchido, prevalece sobre tabela global
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE FAIXAS DE PREÇO GLOBAL (ADR 002)
CREATE TABLE pricing_tiers (
    id SERIAL PRIMARY KEY,
    quantidade_minima INT NOT NULL UNIQUE,
    quantidade_maxima INT, -- NULL para sem limite superior
    preco_unitario NUMERIC(10, 2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserção das faixas aprovadas
INSERT INTO pricing_tiers (quantidade_minima, quantidade_maxima, preco_unitario) VALUES
(1, 9, 21.90),
(10, 49, 19.90),
(50, NULL, 17.90);

-- 3. TABELA DE CLIENTES (Para equipe interna e revendedores)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    nome_estabelecimento VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    contato_nome VARCHAR(255),
    contato_telefone VARCHAR(30),
    email VARCHAR(255),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE PEDIDOS E SOLICITAÇÕES COMERCIAIS
CREATE TYPE order_origin AS ENUM ('compra_revendedor', 'solicitacao_interna');
CREATE TYPE order_status AS ENUM ('aguardando_pagamento', 'pago', 'em_analise', 'aprovado', 'em_producao', 'concluido', 'cancelado');
CREATE TYPE order_delivery_mode AS ENUM ('retirada', 'correios');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_pedido VARCHAR(30) UNIQUE NOT NULL,
    revendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    origem order_origin NOT NULL DEFAULT 'compra_revendedor',
    cliente_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'aguardando_pagamento',
    quantidade_total INT NOT NULL CHECK (quantidade_total >= 1),
    preco_unitario_aplicado NUMERIC(10, 2) NOT NULL,
    valor_total NUMERIC(10, 2) NOT NULL,
    modalidade_entrega order_delivery_mode NOT NULL,
    observacoes_admin TEXT,
    aprovado_por UUID REFERENCES profiles(id),
    data_aprovacao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABELA DE LOGÍSTICA DO PEDIDO (DESACOPLADA - ADR 003)
CREATE TYPE withdrawal_status AS ENUM (
    'retirada_selecionada', 'aguardando_producao', 'aguardando_liberacao', 
    'pronta_para_retirada', 'retirada_agendada', 'retirada_realizada', 'cancelada'
);
CREATE TYPE correios_status AS ENUM (
    'aguardando_producao', 'aguardando_liberacao', 'aguardando_etiqueta', 
    'aguardando_postagem', 'postado', 'em_transito', 'entregue', 'com_ocorrencia'
);

CREATE TABLE order_logistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    modalidade order_delivery_mode NOT NULL,
    -- Dados para Retirada:
    responsavel_retirada_nome VARCHAR(255),
    responsavel_retirada_telefone VARCHAR(30),
    retirada_status withdrawal_status,
    data_retirada_efetiva TIMESTAMP WITH TIME ZONE,
    liberado_por UUID REFERENCES profiles(id),
    -- Dados para Envio Correios:
    destinatario_nome VARCHAR(255),
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf VARCHAR(2),
    codigo_rastreamento VARCHAR(50),
    correios_status correios_status,
    data_postagem TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABELA DE FILA UNIFICADA DE FABRICAÇÃO SOB DEMANDA
CREATE TYPE manufacturing_status AS ENUM (
    'aguardando_autorizacao', 'aguardando_producao', 'em_producao', 
    'producao_parcial', 'producao_concluida', 'aguardando_inspecao', 
    'inspecao_concluida', 'atribuicao_concluida', 'cancelada'
);

CREATE TABLE manufacturing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    origem order_origin NOT NULL,
    quantidade_solicitada INT NOT NULL,
    quantidade_produzida INT NOT NULL DEFAULT 0,
    quantidade_aprovada INT NOT NULL DEFAULT 0,
    quantidade_reprovada INT NOT NULL DEFAULT 0,
    status manufacturing_status NOT NULL DEFAULT 'aguardando_autorizacao',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABELA INDIVIDUAL DE PLACAS FÍSICAS (ADENDO V5.0)
CREATE TYPE plate_physical_status AS ENUM (
    'planejada', 'em_producao', 'produzida', 'aguardando_inspecao', 
    'aprovada', 'reprovada', 'atribuida', 'liberada', 'bloqueada', 'descartada'
);
CREATE TYPE plate_digital_status AS ENUM ('inativa', 'ativa', 'bloqueada');
CREATE TYPE nfc_status AS ENUM ('nao_instalado', 'instalado', 'gravado', 'testado', 'com_problema');
CREATE TYPE destination_type AS ENUM ('google_reviews', 'whatsapp', 'instagram', 'website', 'personalizado');

CREATE TABLE plates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturing_order_id UUID NOT NULL REFERENCES manufacturing_orders(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    revendedor_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
    codigo_sequencial VARCHAR(30) UNIQUE NOT NULL, -- Ex: PLK-0001
    token_publico VARCHAR(64) UNIQUE NOT NULL,     -- Token imprevisível da URL /r/:token
    url_permanente VARCHAR(255) NOT NULL,
    -- Configuração individual da placa:
    nome_estabelecimento VARCHAR(255),
    categoria_estabelecimento VARCHAR(100),
    contato_nome VARCHAR(255),
    contato_telefone VARCHAR(30),
    tipo_destino destination_type,
    url_destino TEXT,
    -- Estados separados e independentes:
    status_fisico plate_physical_status NOT NULL DEFAULT 'planejada',
    status_digital plate_digital_status NOT NULL DEFAULT 'inativa',
    status_nfc nfc_status NOT NULL DEFAULT 'nao_instalado',
    data_fabricacao TIMESTAMP WITH TIME ZONE,
    data_liberacao TIMESTAMP WITH TIME ZONE,
    data_ativacao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABELA DE INSPEÇÃO DE QUALIDADE FÍSICA
CREATE TYPE inspection_result AS ENUM ('aprovada', 'reprovada');

CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_id UUID NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
    resultado inspection_result NOT NULL,
    inspetor_id UUID NOT NULL REFERENCES profiles(id),
    qr_code_legivel BOOLEAN NOT NULL,
    acrilico_conforme BOOLEAN NOT NULL,
    nfc_gravado_correto BOOLEAN NOT NULL,
    motivo_reprovacao TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABELA DE HISTÓRICO DE DESTINOS DA PLACA
CREATE TABLE destination_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_id UUID NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
    destino_anterior TEXT,
    destino_novo TEXT NOT NULL,
    alterado_por UUID NOT NULL REFERENCES profiles(id),
    data_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABELA DE TRANSAÇÕES FINANCEIRAS (ASAAS)
CREATE TYPE payment_gateway_status AS ENUM (
    'PENDING', 'RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'CANCELLED'
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    asaas_payment_id VARCHAR(100) UNIQUE NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    forma_pagamento VARCHAR(50) NOT NULL, -- PIX, BOLETO, CREDIT_CARD
    status payment_gateway_status NOT NULL DEFAULT 'PENDING',
    pix_qrcode_url TEXT,
    pix_copia_cola TEXT,
    boleto_url TEXT,
    data_confirmacao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. TABELA DE CONTROLE DE IDEMPOTÊNCIA DE WEBHOOKS
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) UNIQUE NOT NULL,
    evento VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processado BOOLEAN NOT NULL DEFAULT FALSE,
    sucesso BOOLEAN NOT NULL DEFAULT FALSE,
    mensagem_erro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. TABELA DE AUDITORIA GERAL (LOGS DE SEGURANÇA E OPERAÇÕES)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES profiles(id),
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(100) NOT NULL,
    entidade_id VARCHAR(100),
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_origem VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

---

## 3. POLÍTICAS DE ROW LEVEL SECURITY (RLS PARA SUPABASE)

```sql
-- Ativação de RLS nas tabelas principais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE plates ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_history ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para PROFILES
CREATE POLICY "Admins têm acesso total a perfis" ON profiles
    FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Usuário acessa e edita seu próprio perfil" ON profiles
    FOR ALL USING (auth.uid() = auth_user_id);

-- 2. Políticas para ORDERS
CREATE POLICY "Admins visualizam todos os pedidos" ON orders
    FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Revendedor visualiza seus próprios pedidos" ON orders
    FOR SELECT USING (revendedor_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

CREATE POLICY "Revendedor cria seus próprios pedidos" ON orders
    FOR INSERT WITH CHECK (revendedor_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

-- 3. Políticas para PLATES (Adendo v5.0)
CREATE POLICY "Admins gerenciam todas as placas" ON plates
    FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Revendedor acessa e configura apenas suas placas liberadas" ON plates
    FOR ALL USING (
        revendedor_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        AND status_fisico = 'liberada'
    );
```
