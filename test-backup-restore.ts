/**
 * Teste Automatizado de Homologação: Sistema de Backup & Restauração Completa
 * Valida: Download único com data e horário no nome, agendamento de horários, retenção, e restauração atômica.
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Iniciando Teste de Homologação: Backup & Restauração...');
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
    // 1. Testar Download Instantâneo com Data e Horário no Nome
    console.log('\n📦 1. Testando Download Instantâneo (/api/backup/download-instant)...');
    const downloadRes = await fetch(`${BASE_URL}/api/backup/download-instant`);
    assert(downloadRes.status === 200, 'Download retornou status HTTP 200 OK');

    const disposition = downloadRes.headers.get('content-disposition') || '';
    assert(disposition.includes('attachment; filename="backup_atelier_das_placas_'), `Content-Disposition contém nome de arquivo correto: "${disposition}"`);
    
    // Verifica presença de data e horário (ex: 2026-11-01_16h45m10s.json)
    const filenameMatch = disposition.match(/filename="(.+?)"/);
    const filename = filenameMatch ? filenameMatch[1] : '';
    console.log(`  Nome do arquivo gerado: "${filename}"`);
    assert(/backup_atelier_das_placas_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}m\d{2}s\.json/.test(filename), 'Nome do arquivo contém data e horário exatos (YYYY-MM-DD_HHhmmss.json)');

    const backupContent = await downloadRes.json();
    assert(!!backupContent.metadados, 'Backup contém nó de metadados');
    assert(!!backupContent.dados, 'Backup contém nó de dados');
    assert(!!backupContent.metadados.checksum, `Possui checksum SHA-256 de integridade: ${backupContent.metadados.checksum?.slice(0, 16)}...`);
    assert(backupContent.metadados.versao_schema === '5.0.0', 'Versão do schema do backup é 5.0.0');

    // Verifica que todas as 12 tabelas foram exportadas
    const expectedTables = [
      'profiles',
      'pricing_tiers',
      'clients',
      'orders',
      'order_logistics',
      'manufacturing_orders',
      'plates',
      'inspections',
      'destination_history',
      'payments',
      'webhook_events',
      'audit_logs',
    ];
    for (const table of expectedTables) {
      assert(Array.isArray(backupContent.dados[table]), `Tabela "${table}" presente no backup com array de dados`);
    }

    // 2. Testar Criação de Backup Salvo no Servidor (/api/backup/create)
    console.log('\n💾 2. Testando Criação de Backup no Servidor (/api/backup/create)...');
    const createRes = await fetch(`${BASE_URL}/api/backup/create`, { method: 'POST' });
    const createData = await createRes.json();
    assert(createData.sucesso === true, 'Criação de backup retornou sucesso');
    assert(!!createData.backup?.filename, `Arquivo salvo: ${createData.backup?.filename}`);

    // 3. Testar Listagem de Backups (/api/backup/list)
    console.log('\n📋 3. Testando Listagem de Backups Salvos (/api/backup/list)...');
    const listRes = await fetch(`${BASE_URL}/api/backup/list`);
    const listData = await listRes.json();
    assert(listData.sucesso === true, 'Listagem retornou sucesso = true');
    assert(Array.isArray(listData.backups) && listData.backups.length > 0, `Encontrou ${listData.backups.length} backups salvos`);
    const found = listData.backups.find((b: any) => b.filename === createData.backup.filename);
    assert(!!found, 'O backup recém-criado foi encontrado na listagem');
    assert(!!found.size_formatted, `Tamanho legível formatado: ${found?.size_formatted}`);
    assert(found.origem === 'manual', 'Origem registrada como "manual"');

    // 4. Testar Configuração de Agendamento e Destino (Computador / Google Drive / Ambos)
    console.log('\n⏰ 4. Testando Configuração de Agendamento e Destino (/api/backup/config)...');
    const configPayload = {
      enabled: true,
      horarios: ['08:00', '14:30', '22:00'],
      max_arquivos: 7,
      destino_automatico: 'google_drive',
      drive_folder_id: 'drive_folder_mock_777',
      drive_folder_name: 'Minha Pasta no Drive',
    };
    const updateConfigRes = await fetch(`${BASE_URL}/api/backup/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configPayload),
    });
    const updateConfigData = await updateConfigRes.json();
    assert(updateConfigData.sucesso === true, 'Atualização de agendamento retornou sucesso');
    assert(updateConfigData.config.enabled === true, 'Agendamento automático ativado');
    assert(updateConfigData.config.horarios.length === 3, '3 horários programados salvos (08:00, 14:30, 22:00)');
    assert(updateConfigData.config.max_arquivos === 7, 'Retenção máxima configurada para 7 arquivos');
    assert(updateConfigData.config.destino_automatico === 'google_drive', 'Destino automático salvo como "google_drive"');
    assert(updateConfigData.config.drive_folder_id === 'drive_folder_mock_777', 'ID da pasta do Google Drive salvo');
    assert(updateConfigData.config.drive_folder_name === 'Minha Pasta no Drive', 'Nome da pasta do Google Drive salvo');

    // Testar opção "ambos"
    const updateAmbosRes = await fetch(`${BASE_URL}/api/backup/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destino_automatico: 'ambos' }),
    });
    const updateAmbosData = await updateAmbosRes.json();
    assert(updateAmbosData.config.destino_automatico === 'ambos', 'Destino automático atualizado para "ambos"');

    // Testar opção "local"
    const updateLocalRes = await fetch(`${BASE_URL}/api/backup/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destino_automatico: 'local' }),
    });
    const updateLocalData = await updateLocalRes.json();
    assert(updateLocalData.config.destino_automatico === 'local', 'Destino automático restaurado para "local"');

    // 5. Testar Restauração Atômica e Fidelidade de Dados (/api/backup/restore)
    console.log('\n🔄 5. Testando Restauração Atômica do Banco (/api/backup/restore)...');
    
    // Contagem de pedidos antes da restauração
    const initialOrdersCount = backupContent.dados.orders.length;
    console.log(`  Total de pedidos no backup extraído: ${initialOrdersCount}`);

    // Executa a restauração enviando o payload que foi baixado no passo 1
    const restoreRes = await fetch(`${BASE_URL}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: backupContent }),
    });
    const restoreData = await restoreRes.json();
    assert(restoreData.sucesso === true, 'Restauração retornou sucesso = true');
    console.log(`  Mensagem da restauração: "${restoreData.mensagem}"`);

    // Consulta os pedidos após restauração para confirmar fidelidade
    const verifyOrdersRes = await fetch(`${BASE_URL}/api/orders`);
    const verifyOrdersData = await verifyOrdersRes.json();
    assert(verifyOrdersData.sucesso === true, 'Consulta de pedidos pós-restauração bem-sucedida');
    assert(verifyOrdersData.pedidos.length === initialOrdersCount, `Quantidade de pedidos confere exatamente: ${verifyOrdersData.pedidos.length} pedidos restaurados`);

    // 6. Testar Exclusão de Arquivo de Backup (/api/backup/:filename)
    console.log('\n🗑️ 6. Testando Exclusão de Backup Salvo (/api/backup/:filename)...');
    const deleteRes = await fetch(`${BASE_URL}/api/backup/${createData.backup.filename}`, { method: 'DELETE' });
    const deleteData = await deleteRes.json();
    assert(deleteData.sucesso === true, 'Exclusão retornou sucesso = true');

    // Confirma que não está mais na listagem
    const listAfterRes = await fetch(`${BASE_URL}/api/backup/list`);
    const listAfterData = await listAfterRes.json();
    const stillExists = listAfterData.backups.some((b: any) => b.filename === createData.backup.filename);
    assert(!stillExists, 'Arquivo de backup removido com sucesso do servidor');

    console.log(`\n========================================`);
    console.log(`RESULTADO: ${passed} passaram, ${failed} falharam.`);
    console.log(`========================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erro nos testes de backup:', err);
    process.exit(1);
  }
}

runTests();
