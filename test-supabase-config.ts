/**
 * Teste de Validação da Preparação da Integração com Supabase
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando Testes de Preparação do Supabase...');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FALHA: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Verificar existência e completude de supabase-schema.sql
    console.log('\n📄 1. Validando arquivo supabase-schema.sql...');
    const schemaPath = path.resolve(process.cwd(), 'supabase-schema.sql');
    assert(fs.existsSync(schemaPath), 'Arquivo supabase-schema.sql gerado na raiz');
    const sqlContent = fs.readFileSync(schemaPath, 'utf-8');

    const expectedTables = [
      'public.profiles',
      'public.pricing_tiers',
      'public.clients',
      'public.orders',
      'public.order_logistics',
      'public.manufacturing_orders',
      'public.plates',
      'public.inspections',
      'public.destination_history',
      'public.payments',
      'public.webhook_events',
      'public.audit_logs',
    ];

    for (const table of expectedTables) {
      assert(sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Contém definição da tabela ${table}`);
    }

    assert(sqlContent.includes('idx_plates_token_publico'), 'Contém índice de alta performance para QR Code (token_publico)');
    assert(sqlContent.includes('jrmacbrandt@gmail.com'), 'Contém seed inicial do administrador José Roberto');

    // 2. Testar Endpoint de Status do Supabase (/api/admin/supabase-status)
    console.log('\n📡 2. Testando Endpoint /api/admin/supabase-status...');
    const statusRes = await fetch(`${BASE_URL}/api/admin/supabase-status`);
    assert(statusRes.status === 200, 'Endpoint retornou status HTTP 200 OK');
    const statusData = await statusRes.json();
    assert(statusData.sucesso === true, 'Status retornou sucesso = true');
    assert(statusData.regiao_recomendada.includes('sa-east-1'), `Indica região sa-east-1 (retornou: ${statusData.regiao_recomendada})`);
    assert(statusData.estatisticas_locais?.total > 0, `Contabilizou dados locais prontos para nuvem: ${statusData.estatisticas_locais?.total} registros`);

    // 3. Testar Endpoint de Teste do Supabase (/api/admin/supabase-test)
    console.log('\n🔌 3. Testando Endpoint de Validação (/api/admin/supabase-test)...');
    const testRes = await fetch(`${BASE_URL}/api/admin/supabase-test`, { method: 'POST' });
    const testData = await testRes.json();
    assert(typeof testData.mensagem === 'string', 'Retornou mensagem de diagnóstico segura');
    console.log(`  Mensagem do diagnóstico: "${testData.mensagem}"`);

    // 4. Testar Endpoint de Sincronização em Modo Standby (/api/admin/supabase-sync)
    console.log('\n🔄 4. Testando Sincronização sem credenciais (/api/admin/supabase-sync)...');
    const syncRes = await fetch(`${BASE_URL}/api/admin/supabase-sync`, { method: 'POST' });
    const syncData = await syncRes.json();
    assert(syncData.sucesso === false, 'Recusa sincronização com mensagem clara se faltar credenciais');
    assert(syncData.mensagem.includes('SUPABASE_URL'), 'Mensagem orienta o preenchimento de SUPABASE_URL');

    console.log(`\n========================================`);
    console.log(`RESULTADO: ${passed} passaram, ${failed} falharam.`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erro nos testes:', err);
    process.exit(1);
  }
}

runTests();
