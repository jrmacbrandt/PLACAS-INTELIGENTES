import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { hashMasterPassword } from './services/password.js';
import type { PricingTier, Profile, Order, Plate } from './types.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'placas.db');
export const db = new DatabaseSync(DB_PATH);

// Habilita chaves estrangeiras e journal WAL para concorrência segura
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Inicialização do Esquema Relacional Completo
 * Compatível com o DDL de DATABASE.md
 */
export function initDatabase() {
  db.exec(`
    -- 1. PERFIS DE USUÁRIOS
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      auth_user_id TEXT UNIQUE,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT,
      cpf_cnpj TEXT,
      role TEXT NOT NULL DEFAULT 'revendedor', -- 'visitante', 'revendedor', 'admin'
      tipo_parceiro TEXT NOT NULL DEFAULT 'revendedor_independente', -- 'revendedor_independente', 'equipe_interna', 'parceiro_especial'
      preferencia_entrega TEXT NOT NULL DEFAULT 'retirada', -- 'retirada', 'correios'
      preco_individual REAL DEFAULT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      is_master INTEGER NOT NULL DEFAULT 0,
      senha_hash TEXT DEFAULT NULL,
      cep TEXT DEFAULT NULL,
      logradouro TEXT DEFAULT NULL,
      numero TEXT DEFAULT NULL,
      complemento TEXT DEFAULT NULL,
      bairro TEXT DEFAULT NULL,
      cidade TEXT DEFAULT NULL,
      estado TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. TABELA DE PREÇOS POR VOLUME (ADR 002)
    CREATE TABLE IF NOT EXISTS pricing_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quantidade_minima INTEGER NOT NULL UNIQUE,
      quantidade_maxima INTEGER,
      preco_unitario REAL NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. CLIENTES COMERCIAIS
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      revendedor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      nome_estabelecimento TEXT NOT NULL,
      categoria TEXT,
      contato_nome TEXT,
      contato_telefone TEXT,
      email TEXT,
      cidade TEXT,
      uf TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 4. PEDIDOS E SOLICITAÇÕES
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      numero_pedido TEXT UNIQUE NOT NULL,
      revendedor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
      origem TEXT NOT NULL DEFAULT 'compra_revendedor', -- 'compra_revendedor', 'solicitacao_interna'
      cliente_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
      quantidade_total INTEGER NOT NULL CHECK (quantidade_total >= 1),
      preco_unitario_aplicado REAL NOT NULL,
      valor_total REAL NOT NULL,
      modalidade_entrega TEXT NOT NULL, -- 'retirada', 'correios'
      observacoes_admin TEXT,
      aprovado_por TEXT REFERENCES profiles(id),
      data_aprovacao TEXT,
      placa_codigo_inicial TEXT DEFAULT NULL,
      placa_codigo_final TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. LOGÍSTICA DO PEDIDO (DESACOPLADA - ADR 003)
    CREATE TABLE IF NOT EXISTS order_logistics (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      modalidade TEXT NOT NULL,
      responsavel_retirada_nome TEXT,
      responsavel_retirada_telefone TEXT,
      retirada_status TEXT, -- 'retirada_selecionada', 'pronta_para_retirada', 'retirada_realizada', etc.
      data_retirada_efetiva TEXT,
      liberado_por TEXT REFERENCES profiles(id),
      destinatario_nome TEXT,
      cep TEXT,
      logradouro TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      codigo_rastreamento TEXT,
      correios_status TEXT, -- 'aguardando_postagem', 'postado', 'em_transito', 'entregue'
      data_postagem TEXT,
      comprovante_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. FILA UNIFICADA DE FABRICAÇÃO SOB DEMANDA
    CREATE TABLE IF NOT EXISTS manufacturing_orders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      origem TEXT NOT NULL,
      quantidade_solicitada INTEGER NOT NULL,
      quantidade_produzida INTEGER NOT NULL DEFAULT 0,
      quantidade_aprovada INTEGER NOT NULL DEFAULT 0,
      quantidade_reprovada INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'aguardando_autorizacao',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 7. PLACAS FÍSICAS INDIVIDUAIS (ADENDO V5.0)
    CREATE TABLE IF NOT EXISTS plates (
      id TEXT PRIMARY KEY,
      manufacturing_order_id TEXT REFERENCES manufacturing_orders(id),
      order_id TEXT REFERENCES orders(id),
      revendedor_id TEXT REFERENCES profiles(id) ON DELETE RESTRICT,
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
      data_fabricacao TEXT,
      data_liberacao TEXT,
      data_ativacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 8. INSPEÇÃO FÍSICA DE QUALIDADE
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      plate_id TEXT NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
      resultado TEXT NOT NULL, -- 'aprovada', 'reprovada'
      inspetor_id TEXT NOT NULL REFERENCES profiles(id),
      qr_code_legivel INTEGER NOT NULL,
      acrilico_conforme INTEGER NOT NULL,
      nfc_gravado_correto INTEGER NOT NULL,
      motivo_reprovacao TEXT,
      observacoes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 9. HISTÓRICO DE DESTINOS DA PLACA
    CREATE TABLE IF NOT EXISTS destination_history (
      id TEXT PRIMARY KEY,
      plate_id TEXT NOT NULL REFERENCES plates(id) ON DELETE CASCADE,
      destino_anterior TEXT,
      destino_novo TEXT NOT NULL,
      alterado_por TEXT NOT NULL REFERENCES profiles(id),
      data_alteracao TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 10. TRANSAÇÕES DE PAGAMENTO (ASAAS)
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      asaas_payment_id TEXT UNIQUE NOT NULL,
      valor REAL NOT NULL,
      forma_pagamento TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      pix_qrcode_url TEXT,
      pix_copia_cola TEXT,
      boleto_url TEXT,
      data_confirmacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 11. CONTROLE DE IDEMPOTÊNCIA DE WEBHOOKS
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_id TEXT UNIQUE NOT NULL,
      evento TEXT NOT NULL,
      payload TEXT NOT NULL,
      processado INTEGER NOT NULL DEFAULT 0,
      sucesso INTEGER NOT NULL DEFAULT 0,
      mensagem_erro TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 12. LOGS DE AUDITORIA DO SISTEMA
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT REFERENCES profiles(id),
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      entidade_id TEXT,
      dados_anteriores TEXT,
      dados_novos TEXT,
      ip_origem TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrações seguras de colunas caso a tabela já exista
  try { db.exec('ALTER TABLE profiles ADD COLUMN is_master INTEGER NOT NULL DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN senha_hash TEXT DEFAULT NULL;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN faixas_preco_individual TEXT DEFAULT NULL;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN cep TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN logradouro TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN numero TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN complemento TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN bairro TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN cidade TEXT;'); } catch {}
  try { db.exec('ALTER TABLE profiles ADD COLUMN estado TEXT;'); } catch {}

  seedInitialData();
}

/**
 * Carga Inicial Obrigatória (ADR 002 e Perfis Base)
 */
function seedInitialData() {
  // 1. Faixas de Precificação Global Aprovadas (ADR 002)
  const tierCountRow = db.prepare('SELECT COUNT(*) as count FROM pricing_tiers').get() as { count: number };
  if (tierCountRow.count === 0) {
    const insertTier = db.prepare(`
      INSERT INTO pricing_tiers (quantidade_minima, quantidade_maxima, preco_unitario)
      VALUES (?, ?, ?)
    `);
    insertTier.run(1, 9, 21.90);
    insertTier.run(10, 49, 19.90);
    insertTier.run(50, null, 17.90);
  }

  // 2. Perfis Demonstrativos Iniciais
  const profileCountRow = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  if (profileCountRow.count === 0) {
    const insertProfile = db.prepare(`
      INSERT INTO profiles (id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega, preco_individual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Revendedor Autônomo Independente
    const revendedorId = 'prof_revendedor_001';
    insertProfile.run(
      revendedorId,
      'auth_revendedor_001',
      'Carlos Eduardo Silva (Revendedor SP)',
      'carlos@revendas.com.br',
      '(11) 97777-1234',
      '234.567.890-12',
      'revendedor',
      'revendedor_independente',
      'retirada',
      null
    );

    // Vendedor da Equipe Comercial Interna
    const vendedorInternoId = 'prof_vendedor_001';
    insertProfile.run(
      vendedorInternoId,
      'auth_vendedor_001',
      'Mariana Costa (Vendedora Interna)',
      'mariana.costa@empresa.com.br',
      '(11) 96666-4321',
      '345.678.901-23',
      'revendedor',
      'equipe_interna',
      'correios',
      null
    );

    // Parceiro Especial com Preço Individual Ativo (R$ 16,50)
    const parceiroId = 'prof_parceiro_001';
    insertProfile.run(
      parceiroId,
      'auth_parceiro_001',
      'Studio Marketing & Design (Parceiro Especial)',
      'contato@studiomarketing.com',
      '(21) 95555-7890',
      '98.765.432/0001-10',
      'revendedor',
      'parceiro_especial',
      'correios',
      16.50
    );

    // 3. Cliente exemplo para vendedor interno
    const clientId = 'cli_exemplo_001';
    db.prepare(`
      INSERT INTO clients (id, revendedor_id, nome_estabelecimento, categoria, contato_nome, contato_telefone, email, cidade, uf)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId,
      vendedorInternoId,
      'Padaria Bella Vista',
      'Gastronomia',
      'Seu Manoel',
      '(11) 91111-2222',
      'contato@bellavista.com.br',
      'São Paulo',
      'SP'
    );
  }

  // Garante que o perfil Master do José Roberto Machado Brandt exista com os dados completos e senha criptografada
  const masterPasswordHash = hashMasterPassword('Ze001300$');
  const existingJose = db.prepare('SELECT id, senha_hash FROM profiles WHERE LOWER(email) = ?').get('jrmacbrandt@gmail.com') as { id: string; senha_hash?: string | null } | undefined;
  if (!existingJose) {
    db.prepare(`
      INSERT INTO profiles (id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega, is_master, senha_hash, cep, logradouro, numero, complemento, bairro, cidade, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'prof_jose_brandt',
      'auth_jose_brandt',
      'José Roberto Machado Brandt',
      'jrmacbrandt@gmail.com',
      '21980914107',
      '06865841719',
      'admin',
      'equipe_interna',
      'correios',
      1,
      masterPasswordHash,
      '22745-271',
      'Rua Araguaia',
      '1111',
      'Apto 403',
      'Freguesia (Jacarepaguá)',
      'Rio de Janeiro',
      'RJ'
    );
  } else {
    db.prepare(`
      UPDATE profiles
      SET nome = 'José Roberto Machado Brandt',
          role = 'admin',
          is_master = 1,
          senha_hash = COALESCE(senha_hash, ?),
          telefone = '21980914107',
          cpf_cnpj = '06865841719',
          cep = '22745-271',
          logradouro = 'Rua Araguaia',
          numero = '1111',
          complemento = 'Apto 403',
          bairro = 'Freguesia (Jacarepaguá)',
          cidade = 'Rio de Janeiro',
          estado = 'RJ'
      WHERE LOWER(email) = 'jrmacbrandt@gmail.com'
    `).run(masterPasswordHash);
  }

  // Remove o Administrador Geral legado: apenas jrmacbrandt@gmail.com é administrador master
  try {
    const legacyAdminId = 'prof_admin_001';
    const masterId = 'prof_jose_brandt';
    const refs: Array<[string, string]> = [
      ['clients', 'revendedor_id'], ['orders', 'revendedor_id'], ['orders', 'aprovado_por'],
      ['plates', 'revendedor_id'], ['plates', 'liberado_por'], ['inspections', 'inspetor_id'],
      ['destination_history', 'alterado_por'], ['audit_logs', 'usuario_id'], ['manufacturing_orders', 'revendedor_id'],
    ];
    for (const [table, column] of refs) {
      try { db.prepare('UPDATE ' + table + ' SET ' + column + ' = ? WHERE ' + column + ' = ?').run(masterId, legacyAdminId); } catch {}
    }
    db.prepare('DELETE FROM profiles WHERE id = ?').run(legacyAdminId);
    db.prepare("UPDATE profiles SET role = 'revendedor', is_master = 0 WHERE role = 'admin' AND LOWER(email) != 'jrmacbrandt@gmail.com'").run();
  } catch (err) {
    console.error('Falha ao remover administrador legado:', err);
  }

  // Migrações dinâmicas idempotentes
  try {
    db.exec('ALTER TABLE orders ADD COLUMN placa_codigo_inicial TEXT DEFAULT NULL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE orders ADD COLUMN placa_codigo_final TEXT DEFAULT NULL;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE orders ADD COLUMN valor_frete REAL DEFAULT 0;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN transportadora TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN servico_frete TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN servico_frete_id INTEGER;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN valor_frete REAL DEFAULT 0;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN prazo_dias INTEGER;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN melhor_envio_cart_id TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN melhor_envio_order_id TEXT;');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE order_logistics ADD COLUMN etiqueta_url TEXT;');
  } catch (_) {}
}

