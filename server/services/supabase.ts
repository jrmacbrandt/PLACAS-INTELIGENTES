import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db.js';

/**
 * Serviço de Integração em Nuvem com Supabase (PostgreSQL & Storage)
 * Suporta modo Híbrido:
 * - Se as credenciais estiverem no ambiente, conecta ao Supabase
 * - Se ainda não estiverem configuradas, opera no modo Standby sem quebrar nada
 */

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const isConfigured = Boolean(url && key && url.startsWith('http'));

  return {
    url,
    hasKey: Boolean(key),
    isConfigured,
    region: 'sa-east-1 (São Paulo, Brasil recomendada)',
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  if (!cachedClient) {
    cachedClient = createClient(config.url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}

/**
 * Testa a conexão ativa com o Supabase
 */
export async function testSupabaseConnection() {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      sucesso: false,
      configurado: false,
      mensagem: 'Supabase aguardando credenciais (SUPABASE_URL e SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY no arquivo .env).',
    };
  }

  try {
    const client = getSupabaseClient();
    if (!client) throw new Error('Cliente Supabase não inicializado.');

    // Tenta uma consulta simples na tabela pricing_tiers ou profiles
    const { data, error } = await client.from('pricing_tiers').select('count', { count: 'exact', head: true });

    if (error) {
      // Se a tabela ainda não existir no Supabase, a conexão funciona, mas requer o schema
      return {
        sucesso: true,
        configurado: true,
        schema_pendente: true,
        mensagem: `Conexão com o Supabase estabelecida com sucesso! Nota: Execute o arquivo "supabase-schema.sql" no SQL Editor do Supabase para criar as tabelas. (${error.message})`,
      };
    }

    return {
      sucesso: true,
      configurado: true,
      schema_pendente: false,
      mensagem: 'Conexão com o Supabase (PostgreSQL) estabelecida e validada com 100% de sucesso!',
      url: config.url,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      configurado: true,
      mensagem: `Erro ao conectar com o Supabase: ${err?.message || 'Falha de rede.'}`,
    };
  }
}

/**
 * Retorna contagem de registros locais do SQLite para balanço de sincronização
 */
export function getLocalDatabaseStats() {
  const countProfiles = (db.prepare('SELECT COUNT(*) as c FROM profiles').get() as any)?.c || 0;
  const countOrders = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any)?.c || 0;
  const countPlates = (db.prepare('SELECT COUNT(*) as c FROM plates').get() as any)?.c || 0;
  const countTiers = (db.prepare('SELECT COUNT(*) as c FROM pricing_tiers').get() as any)?.c || 0;
  const countLogs = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any)?.c || 0;

  return {
    perfis: countProfiles,
    pedidos: countOrders,
    placas: countPlates,
    faixas_preco: countTiers,
    logs: countLogs,
    total: countProfiles + countOrders + countPlates + countTiers + countLogs,
  };
}

/**
 * Sincroniza em lote todos os dados locais do SQLite para as tabelas do Supabase
 */
export async function syncAllLocalDataToSupabase() {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return {
      sucesso: false,
      mensagem: 'Supabase não configurado. Adicione SUPABASE_URL e as chaves no arquivo .env antes de sincronizar.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { sucesso: false, mensagem: 'Não foi possível inicializar o cliente Supabase.' };
  }

  try {
    const stats: Record<string, number> = {};

    // 1. Tabela pricing_tiers
    const tiers = db.prepare('SELECT * FROM pricing_tiers').all();
    if (tiers.length > 0) {
      const { error } = await client.from('pricing_tiers').upsert(tiers, { onConflict: 'quantidade_minima' });
      if (error) throw new Error(`Erro ao sincronizar faixas de preço: ${error.message}`);
      stats.pricing_tiers = tiers.length;
    }

    // 2. Tabela profiles
    const profiles = db.prepare('SELECT * FROM profiles').all().map((p: any) => ({
      ...p,
      ativo: Boolean(p.ativo),
    }));
    if (profiles.length > 0) {
      const { error } = await client.from('profiles').upsert(profiles, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar perfis: ${error.message}`);
      stats.profiles = profiles.length;
    }

    // 3. Tabela clients
    const clients = db.prepare('SELECT * FROM clients').all();
    if (clients.length > 0) {
      const { error } = await client.from('clients').upsert(clients, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar clientes: ${error.message}`);
      stats.clients = clients.length;
    }

    // 4. Tabela orders
    const orders = db.prepare('SELECT * FROM orders').all();
    if (orders.length > 0) {
      const { error } = await client.from('orders').upsert(orders, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar pedidos: ${error.message}`);
      stats.orders = orders.length;
    }

    // 5. Tabela order_logistics
    const logistics = db.prepare('SELECT * FROM order_logistics').all();
    if (logistics.length > 0) {
      const { error } = await client.from('order_logistics').upsert(logistics, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar logística: ${error.message}`);
      stats.order_logistics = logistics.length;
    }

    // 6. Tabela manufacturing_orders
    const mfg = db.prepare('SELECT * FROM manufacturing_orders').all();
    if (mfg.length > 0) {
      const { error } = await client.from('manufacturing_orders').upsert(mfg, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar ordens fabris: ${error.message}`);
      stats.manufacturing_orders = mfg.length;
    }

    // 7. Tabela plates
    const plates = db.prepare('SELECT * FROM plates').all();
    if (plates.length > 0) {
      const { error } = await client.from('plates').upsert(plates, { onConflict: 'id' });
      if (error) throw new Error(`Erro ao sincronizar placas: ${error.message}`);
      stats.plates = plates.length;
    }

    return {
      sucesso: true,
      mensagem: 'Sincronização com o Supabase concluída com sucesso!',
      detalhes: stats,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      mensagem: `Falha na sincronização com o Supabase: ${err?.message || 'Erro desconhecido'}`,
    };
  }
}
