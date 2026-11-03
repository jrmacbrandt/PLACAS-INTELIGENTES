import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from './audit.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'data', 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'backup_config.json');

export interface BackupConfig {
  enabled: boolean;
  horarios: string[]; // ex: ["03:00", "12:00", "20:00"]
  max_arquivos: number; // quantidade máxima de arquivos retidos
  destino_automatico: 'local' | 'google_drive' | 'ambos'; // destino escolhido pelo usuário
  drive_folder_id?: string | null;
  drive_folder_name?: string | null;
  ultimo_backup?: string | null;
}

// Configuração padrão: 2 backups diários (12:00 e 23:00) mantendo os últimos 10
const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  horarios: ['12:00', '23:00'],
  max_arquivos: 10,
  destino_automatico: 'local',
  drive_folder_id: null,
  drive_folder_name: null,
  ultimo_backup: null,
};

export function getBackupConfig(): BackupConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.error('[BACKUP] Erro ao ler backup_config.json:', err);
  }
  return DEFAULT_CONFIG;
}

export function saveBackupConfig(config: Partial<BackupConfig>): BackupConfig {
  const current = getBackupConfig();
  const updated: BackupConfig = {
    ...current,
    ...config,
    // Garante horários únicos e válidos no formato HH:mm
    horarios: (config.horarios || current.horarios)
      .map((h) => h.trim())
      .filter((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h))
      .sort(),
    max_arquivos: Math.max(1, Math.min(100, Number(config.max_arquivos || current.max_arquivos))),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/**
 * Formata um carimbo de data/hora seguro para nome de arquivo
 * Formato: YYYY-MM-DD_HH-mm-ss
 */
export function generateTimestampFilename(prefix = 'backup_atelier_das_placas'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  return `${prefix}_${year}-${month}-${day}_${hours}h${minutes}m${seconds}s.json`;
}

/**
 * Extrai todos os dados do banco SQLite e cria o backup estruturado
 */
export function generateBackupPayload(origem: 'manual' | 'automatico' = 'manual') {
  const now = new Date();
  
  // Extrai todas as tabelas relacionais do sistema
  const profiles = db.prepare('SELECT * FROM profiles').all();
  const pricing_tiers = db.prepare('SELECT * FROM pricing_tiers').all();
  const clients = db.prepare('SELECT * FROM clients').all();
  const orders = db.prepare('SELECT * FROM orders').all();
  const order_logistics = db.prepare('SELECT * FROM order_logistics').all();
  const manufacturing_orders = db.prepare('SELECT * FROM manufacturing_orders').all();
  const plates = db.prepare('SELECT * FROM plates').all();
  const inspections = db.prepare('SELECT * FROM inspections').all();
  const destination_history = db.prepare('SELECT * FROM destination_history').all();
  const payments = db.prepare('SELECT * FROM payments').all();
  const webhook_events = db.prepare('SELECT * FROM webhook_events').all();
  const audit_logs = db.prepare('SELECT * FROM audit_logs').all();

  const estatisticas = {
    profiles: profiles.length,
    pricing_tiers: pricing_tiers.length,
    clients: clients.length,
    orders: orders.length,
    order_logistics: order_logistics.length,
    manufacturing_orders: manufacturing_orders.length,
    plates: plates.length,
    inspections: inspections.length,
    destination_history: destination_history.length,
    payments: payments.length,
    webhook_events: webhook_events.length,
    audit_logs: audit_logs.length,
    total_registros:
      profiles.length +
      pricing_tiers.length +
      clients.length +
      orders.length +
      order_logistics.length +
      manufacturing_orders.length +
      plates.length +
      inspections.length +
      destination_history.length +
      payments.length +
      webhook_events.length +
      audit_logs.length,
  };

  const dados = {
    profiles,
    pricing_tiers,
    clients,
    orders,
    order_logistics,
    manufacturing_orders,
    plates,
    inspections,
    destination_history,
    payments,
    webhook_events,
    audit_logs,
  };

  // Calcula checksum SHA-256 dos dados para validação de integridade na restauração
  const checksum = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');

  return {
    metadados: {
      sistema: 'Atelier das Placas - Plataforma de Placas Inteligentes QR & NFC',
      versao_schema: '5.0.0',
      data_criacao: now.toISOString(),
      data_formatada: now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      origem,
      checksum,
      estatisticas,
    },
    dados,
  };
}

/**
 * Cria e salva um backup em disco no servidor
 */
export async function createFullBackup(origem: 'manual' | 'automatico' = 'manual') {
  const payload = generateBackupPayload(origem);
  const filename = generateTimestampFilename();
  const filepath = path.join(BACKUP_DIR, filename);

  const jsonContent = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filepath, jsonContent, 'utf-8');

  // Atualiza último backup na config
  const cfg = getBackupConfig();
  saveBackupConfig({ ...cfg, ultimo_backup: payload.metadados.data_criacao });

  // Aplica política de retenção (limpa backups mais antigos se ultrapassar max_arquivos)
  applyRetentionPolicy(cfg.max_arquivos);

  logAudit({
    usuario_id: 'prof_jose_brandt',
    acao: 'CRIACAO_BACKUP',
    entidade: 'backup',
    dados_novos: { filename, origem, total_registros: payload.metadados.estatisticas.total_registros },
  });

  return {
    filename,
    filepath,
    size: Buffer.byteLength(jsonContent),
    metadata: payload.metadados,
  };
}

/**
 * Lista todos os arquivos de backup salvos no servidor
 */
export function listStoredBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

  const list = files.map((filename) => {
    const fullPath = path.join(BACKUP_DIR, filename);
    const stat = fs.statSync(fullPath);
    
    let info: any = null;
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      info = parsed.metadados;
    } catch {
      // Ignora erro de parse de arquivo corrompido
    }

    return {
      filename,
      size: stat.size,
      size_formatted: `${(stat.size / 1024).toFixed(1)} KB`,
      created_at: stat.birthtime.toISOString(),
      formatted_date: info?.data_formatada || stat.birthtime.toLocaleString('pt-BR'),
      origem: info?.origem || 'desconhecida',
      estatisticas: info?.estatisticas || null,
      checksum: info?.checksum || null,
    };
  });

  // Ordena pelos mais recentes primeiro
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Remove um arquivo de backup do servidor
 */
export function deleteStoredBackup(filename: string): boolean {
  // Segurança contra Directory Traversal
  const safeName = path.basename(filename);
  const targetPath = path.join(BACKUP_DIR, safeName);

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    logAudit({
      usuario_id: 'prof_jose_brandt',
      acao: 'EXCLUSAO_BACKUP',
      entidade: 'backup',
      dados_novos: { filename: safeName },
    });
    return true;
  }
  return false;
}

/**
 * Limpa backups automáticos antigos para respeitar a quantidade máxima configurada
 */
export function applyRetentionPolicy(maxArquivos: number) {
  const backups = listStoredBackups();
  if (backups.length > maxArquivos) {
    const toRemove = backups.slice(maxArquivos);
    for (const b of toRemove) {
      deleteStoredBackup(b.filename);
    }
  }
}

/**
 * Valida o conteúdo de um arquivo de backup antes de restaurar
 */
export function validateBackupContent(backupPayload: any) {
  if (!backupPayload || typeof backupPayload !== 'object') {
    throw new Error('Arquivo de backup inválido ou não formatado como JSON.');
  }

  if (!backupPayload.metadados || !backupPayload.dados) {
    throw new Error('Estrutura de backup incompatível: metadados ou dados ausentes.');
  }

  const { dados, metadados } = backupPayload;

  // Validação do Checksum SHA-256 se presente
  if (metadados.checksum) {
    const calculated = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
    if (calculated !== metadados.checksum) {
      throw new Error('Falha de integridade: O arquivo de backup foi corrompido ou modificado após a exportação.');
    }
  }

  return true;
}

/**
 * Restaura completamente o banco de dados a partir de um payload de backup
 * Executa em transação atômica
 */
export function restoreDatabaseFromPayload(backupPayload: any, adminId = 'prof_jose_brandt') {
  validateBackupContent(backupPayload);

  const { dados, metadados } = backupPayload;

  // Executa toda a restauração dentro de uma transação exclusiva no SQLite
  db.exec('BEGIN EXCLUSIVE TRANSACTION;');

  try {
    // 1. Desabilita temporariamente chaves estrangeiras para permitir limpeza limpa e inserção ordenada
    db.exec('PRAGMA foreign_keys = OFF;');

    // 2. Limpa todas as tabelas atuais
    db.exec(`
      DELETE FROM audit_logs;
      DELETE FROM webhook_events;
      DELETE FROM payments;
      DELETE FROM destination_history;
      DELETE FROM inspections;
      DELETE FROM plates;
      DELETE FROM manufacturing_orders;
      DELETE FROM order_logistics;
      DELETE FROM orders;
      DELETE FROM clients;
      DELETE FROM pricing_tiers;
      DELETE FROM profiles;
    `);

    // 3. Restaura Tabela profiles
    if (Array.isArray(dados.profiles) && dados.profiles.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO profiles (
          id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega,
          preco_individual, ativo, cep, logradouro, numero, complemento, bairro, cidade, estado, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of dados.profiles) {
        stmt.run(
          p.id,
          p.auth_user_id || null,
          p.nome,
          p.email,
          p.telefone || null,
          p.cpf_cnpj || null,
          p.role || 'revendedor',
          p.tipo_parceiro || 'revendedor_independente',
          p.preferencia_entrega || 'correios',
          p.preco_individual ?? null,
          p.ativo !== undefined ? (p.ativo ? 1 : 0) : 1,
          p.cep || null,
          p.logradouro || null,
          p.numero || null,
          p.complemento || null,
          p.bairro || null,
          p.cidade || null,
          p.estado || null,
          p.created_at || new Date().toISOString(),
          p.updated_at || new Date().toISOString()
        );
      }
    }

    // 4. Restaura Tabela pricing_tiers
    if (Array.isArray(dados.pricing_tiers) && dados.pricing_tiers.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO pricing_tiers (id, quantidade_minima, quantidade_maxima, preco_unitario, ativo, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of dados.pricing_tiers) {
        stmt.run(
          t.id || null,
          t.quantidade_minima,
          t.quantidade_maxima ?? null,
          t.preco_unitario,
          t.ativo !== undefined ? (t.ativo ? 1 : 0) : 1,
          t.created_at || new Date().toISOString()
        );
      }
    }

    // 5. Restaura Tabela clients
    if (Array.isArray(dados.clients) && dados.clients.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO clients (id, revendedor_id, nome_estabelecimento, categoria, contato_nome, contato_telefone, email, cidade, uf, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of dados.clients) {
        stmt.run(
          c.id,
          c.revendedor_id,
          c.nome_estabelecimento,
          c.categoria || null,
          c.contato_nome || null,
          c.contato_telefone || null,
          c.email || null,
          c.cidade || null,
          c.uf || null,
          c.created_at || new Date().toISOString()
        );
      }
    }

    // 6. Restaura Tabela orders
    if (Array.isArray(dados.orders) && dados.orders.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, numero_pedido, revendedor_id, origem, cliente_id, status, quantidade_total,
          preco_unitario_aplicado, valor_frete, valor_total, modalidade_entrega, observacoes_admin,
          aprovado_por, data_aprovacao, placa_codigo_inicial, placa_codigo_final, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const o of dados.orders) {
        stmt.run(
          o.id,
          o.numero_pedido,
          o.revendedor_id,
          o.origem || 'compra_revendedor',
          o.cliente_id || null,
          o.status || 'aguardando_pagamento',
          o.quantidade_total,
          o.preco_unitario_aplicado,
          o.valor_frete ?? 0,
          o.valor_total,
          o.modalidade_entrega || 'correios',
          o.observacoes_admin || null,
          o.aprovado_por || null,
          o.data_aprovacao || null,
          o.placa_codigo_inicial || null,
          o.placa_codigo_final || null,
          o.created_at || new Date().toISOString(),
          o.updated_at || new Date().toISOString()
        );
      }
    }

    // 7. Restaura Tabela order_logistics
    if (Array.isArray(dados.order_logistics) && dados.order_logistics.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO order_logistics (
          id, order_id, modalidade, responsavel_retirada_nome, responsavel_retirada_telefone,
          retirada_status, data_retirada_efetiva, liberado_por, destinatario_nome, cep, logradouro,
          numero, complemento, bairro, cidade, uf, transportadora, servico_frete, servico_frete_id,
          valor_frete, prazo_dias, melhor_envio_cart_id, melhor_envio_order_id, etiqueta_url,
          codigo_rastreamento, correios_status, data_postagem, comprovante_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of dados.order_logistics) {
        stmt.run(
          l.id,
          l.order_id,
          l.modalidade,
          l.responsavel_retirada_nome || null,
          l.responsavel_retirada_telefone || null,
          l.retirada_status || null,
          l.data_retirada_efetiva || null,
          l.liberado_por || null,
          l.destinatario_nome || null,
          l.cep || null,
          l.logradouro || null,
          l.numero || null,
          l.complemento || null,
          l.bairro || null,
          l.cidade || null,
          l.uf || null,
          l.transportadora || null,
          l.servico_frete || null,
          l.servico_frete_id ?? null,
          l.valor_frete ?? 0,
          l.prazo_dias ?? null,
          l.melhor_envio_cart_id || null,
          l.melhor_envio_order_id || null,
          l.etiqueta_url || null,
          l.codigo_rastreamento || null,
          l.correios_status || null,
          l.data_postagem || null,
          l.comprovante_url || null,
          l.created_at || new Date().toISOString(),
          l.updated_at || new Date().toISOString()
        );
      }
    }

    // 8. Restaura Tabela manufacturing_orders
    if (Array.isArray(dados.manufacturing_orders) && dados.manufacturing_orders.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO manufacturing_orders (
          id, order_id, origem, quantidade_solicitada, quantidade_produzida,
          quantidade_aprovada, quantidade_reprovada, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of dados.manufacturing_orders) {
        stmt.run(
          m.id,
          m.order_id,
          m.origem,
          m.quantidade_solicitada,
          m.quantidade_produzida ?? 0,
          m.quantidade_aprovada ?? 0,
          m.quantidade_reprovada ?? 0,
          m.status || 'aguardando_autorizacao',
          m.created_at || new Date().toISOString(),
          m.updated_at || new Date().toISOString()
        );
      }
    }

    // 9. Restaura Tabela plates
    if (Array.isArray(dados.plates) && dados.plates.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO plates (
          id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico,
          url_permanente, nome_estabelecimento, categoria_estabelecimento, contato_nome, contato_telefone,
          tipo_destino, url_destino, status_fisico, status_digital, status_nfc, data_fabricacao,
          data_liberacao, data_ativacao, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pl of dados.plates) {
        stmt.run(
          pl.id,
          pl.manufacturing_order_id || null,
          pl.order_id || null,
          pl.revendedor_id || null,
          pl.codigo_sequencial,
          pl.token_publico,
          pl.url_permanente,
          pl.nome_estabelecimento || null,
          pl.categoria_estabelecimento || null,
          pl.contato_nome || null,
          pl.contato_telefone || null,
          pl.tipo_destino || null,
          pl.url_destino || null,
          pl.status_fisico || 'planejada',
          pl.status_digital || 'inativa',
          pl.status_nfc || 'nao_instalado',
          pl.data_fabricacao || null,
          pl.data_liberacao || null,
          pl.data_ativacao || null,
          pl.created_at || new Date().toISOString(),
          pl.updated_at || new Date().toISOString()
        );
      }
    }

    // 10. Restaura Tabela inspections
    if (Array.isArray(dados.inspections) && dados.inspections.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO inspections (
          id, plate_id, resultado, inspetor_id, qr_code_legivel, acrilico_conforme,
          nfc_gravado_correto, motivo_reprovacao, observacoes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ins of dados.inspections) {
        stmt.run(
          ins.id,
          ins.plate_id,
          ins.resultado,
          ins.inspetor_id,
          ins.qr_code_legivel ? 1 : 0,
          ins.acrilico_conforme ? 1 : 0,
          ins.nfc_gravado_correto ? 1 : 0,
          ins.motivo_reprovacao || null,
          ins.observacoes || null,
          ins.created_at || new Date().toISOString()
        );
      }
    }

    // 11. Restaura Tabela destination_history
    if (Array.isArray(dados.destination_history) && dados.destination_history.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO destination_history (id, plate_id, destino_anterior, destino_novo, alterado_por, data_alteracao)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const dh of dados.destination_history) {
        stmt.run(
          dh.id,
          dh.plate_id,
          dh.destino_anterior || null,
          dh.destino_novo,
          dh.alterado_por,
          dh.data_alteracao || new Date().toISOString()
        );
      }
    }

    // 12. Restaura Tabela payments
    if (Array.isArray(dados.payments) && dados.payments.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO payments (id, order_id, asaas_payment_id, valor, forma_pagamento, status, pix_qrcode_url, pix_copia_cola, boleto_url, data_confirmacao, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pay of dados.payments) {
        stmt.run(
          pay.id,
          pay.order_id,
          pay.asaas_payment_id,
          pay.valor,
          pay.forma_pagamento,
          pay.status || 'PENDING',
          pay.pix_qrcode_url || null,
          pay.pix_copia_cola || null,
          pay.boleto_url || null,
          pay.data_confirmacao || null,
          pay.created_at || new Date().toISOString()
        );
      }
    }

    // 13. Restaura Tabela webhook_events
    if (Array.isArray(dados.webhook_events) && dados.webhook_events.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO webhook_events (id, event_id, evento, payload, processado, sucesso, mensagem_erro, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const wh of dados.webhook_events) {
        stmt.run(
          wh.id,
          wh.event_id,
          wh.evento,
          wh.payload,
          wh.processado ? 1 : 0,
          wh.sucesso ? 1 : 0,
          wh.mensagem_erro || null,
          wh.created_at || new Date().toISOString()
        );
      }
    }

    // 14. Restaura Tabela audit_logs
    if (Array.isArray(dados.audit_logs) && dados.audit_logs.length > 0) {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos, ip_origem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const al of dados.audit_logs) {
        stmt.run(
          al.id,
          al.usuario_id || null,
          al.acao,
          al.entidade,
          al.entidade_id || null,
          al.dados_anteriores || null,
          al.dados_novos || null,
          al.ip_origem || null,
          al.created_at || new Date().toISOString()
        );
      }
    }

    // 15. Reativa chaves estrangeiras
    db.exec('PRAGMA foreign_keys = ON;');

    // Confirma a transação
    db.exec('COMMIT;');

    // Registra auditoria da restauração
    logAudit({
      usuario_id: adminId,
      acao: 'RESTAURACAO_BACKUP',
      entidade: 'database',
      dados_novos: {
        origem_backup: metadados.origem,
        data_backup: metadados.data_criacao,
        total_restaurado: metadados.estatisticas?.total_registros,
      },
    });

    return {
      sucesso: true,
      mensagem: `Restauração concluída com sucesso! Banco atualizado para o estado de ${metadados.data_formatada}.`,
      detalhes: metadados.estatisticas,
    };
  } catch (err: any) {
    db.exec('ROLLBACK;');
    db.exec('PRAGMA foreign_keys = ON;');
    throw new Error(`Falha durante a restauração do banco: ${err?.message || 'Erro desconhecido'}`);
  }
}

/**
 * Agendador Interno de Backups Automáticos
 * Roda a cada minuto verificando se o horário atual bate com a lista configurada
 */
let schedulerInterval: NodeJS.Timeout | null = null;
let lastTriggeredMinute = '';

export function startBackupScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  schedulerInterval = setInterval(() => {
    try {
      const cfg = getBackupConfig();
      if (!cfg.enabled || !cfg.horarios || cfg.horarios.length === 0) return;

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const currentHHmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const minuteKey = `${now.toDateString()}_${currentHHmm}`;

      // Evita disparar mais de uma vez no mesmo minuto
      if (lastTriggeredMinute === minuteKey) return;

      if (cfg.horarios.includes(currentHHmm)) {
        lastTriggeredMinute = minuteKey;
        console.log(`[BACKUP_SCHEDULER] Disparando backup automático agendado para às ${currentHHmm}...`);
        createFullBackup('automatico')
          .then((res) => {
            console.log(`[BACKUP_SCHEDULER] Backup automático gerado com sucesso: ${res.filename} (${(res.size / 1024).toFixed(1)} KB)`);
          })
          .catch((err) => {
            console.error('[BACKUP_SCHEDULER] Erro ao gerar backup automático:', err);
          });
      }
    } catch (err) {
      console.error('[BACKUP_SCHEDULER] Erro no ciclo de agendamento:', err);
    }
  }, 30000); // Checa a cada 30 segundos
}
