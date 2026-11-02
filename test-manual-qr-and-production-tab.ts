/**
 * Teste Automatizado: Validação de Regra de Geração Manual de QR Codes,
 * Bloqueio de Início de Produção Sem QR Codes e Transição para Em Produção
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Iniciando testes de Geração Manual de QR Codes e Transição de Produção...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      process.exit(1);
    }
  }

  // =========================================================================
  // CENÁRIO 1: Pedido de Equipe Interna
  // =========================================================================
  console.log('--- Cenário 1: Pedido de Equipe Interna (Isento de Pagamento) ---');
  const internalCreateRes = await fetch(`${BASE_URL}/api/orders/create-internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'prof_admin_001' },
    body: JSON.stringify({
      vendedor_id: 'prof_vendedor_001',
      quantidade: 3,
      observacoes: 'Teste automatizado de pedido interno',
    }),
  });
  const internalCreateData = await internalCreateRes.json();
  assert(internalCreateRes.status === 201, 'Pedido interno criado com HTTP 201');
  const internalOrderId = internalCreateData.pedido.id;
  assert(internalCreateData.pedido.status === 'aprovado', 'Pedido interno nasce com status "aprovado"');

  // Verifica que NÃO tem QR Codes gerados automaticamente
  const getOrdersRes1 = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const getOrdersData1 = await getOrdersRes1.json();
  const internalOrderInList = getOrdersData1.pedidos.find((o: any) => o.id === internalOrderId);
  assert(internalOrderInList.qrcodes_gerados === false, 'QR Codes NÃO estão gerados automaticamente (qrcodes_gerados = false)');
  assert(internalOrderInList.total_placas_geradas === 0, 'Total de placas geradas é 0');
  assert(!internalOrderInList.placa_codigo_inicial, 'Código inicial é nulo');
  assert(!internalOrderInList.placa_codigo_final, 'Código final é nulo');

  // Tentar iniciar produção SEM gerar QR Codes (DEVE FALHAR COM HTTP 400)
  console.log('\n--- Cenário 1.1: Tentativa de iniciar produção sem QR Codes no pedido interno ---');
  const startProdBlockedRes = await fetch(`${BASE_URL}/api/orders/${internalOrderId}/start-production`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const startProdBlockedData = await startProdBlockedRes.json();
  assert(startProdBlockedRes.status === 400, 'Tentativa de iniciar produção sem QR Codes bloqueada com HTTP 400');
  assert(startProdBlockedData.sucesso === false, 'Resposta contém sucesso = false');
  assert(
    startProdBlockedData.mensagem.includes('Não é possível iniciar a produção antes de gerar os QR Codes'),
    `Mensagem informativa de bloqueio: "${startProdBlockedData.mensagem}"`
  );

  // Agora gerar QR Codes MANUALMENTE
  console.log('\n--- Cenário 1.2: Geração manual de QR Codes para pedido interno ---');
  const genQrInternalRes = await fetch(`${BASE_URL}/api/orders/${internalOrderId}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const genQrInternalData = await genQrInternalRes.json();
  assert(genQrInternalRes.status === 200, 'Geração manual de QR Codes concluída com HTTP 200');
  assert(genQrInternalData.sucesso === true, 'Resposta contém sucesso = true');
  assert(genQrInternalData.placas?.length === 3, '3 placas geradas com sucesso');
  assert(Boolean(genQrInternalData.placa_codigo_inicial), `Código inicial gerado: ${genQrInternalData.placa_codigo_inicial}`);
  assert(Boolean(genQrInternalData.placa_codigo_final), `Código final gerado: ${genQrInternalData.placa_codigo_final}`);

  // Verificar na lista que agora qrcodes_gerados = true (card verde na UI)
  const getOrdersRes2 = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const getOrdersData2 = await getOrdersRes2.json();
  const internalOrderAfterQr = getOrdersData2.pedidos.find((o: any) => o.id === internalOrderId);
  assert(internalOrderAfterQr.qrcodes_gerados === true, 'qrcodes_gerados agora é true (card fica verde)');
  assert(internalOrderAfterQr.total_placas_geradas === 3, 'total_placas_geradas é 3');

  // Agora clicar em Início de Produção (DEVE TER SUCESSO)
  console.log('\n--- Cenário 1.3: Início de Produção liberado após geração de QR Codes ---');
  const startProdAllowedRes = await fetch(`${BASE_URL}/api/orders/${internalOrderId}/start-production`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const startProdAllowedData = await startProdAllowedRes.json();
  assert(startProdAllowedRes.status === 200, 'Início de produção realizado com sucesso (HTTP 200)');
  assert(startProdAllowedData.sucesso === true, 'Produção iniciada com sucesso');

  // Verifica que o pedido foi para a aba de produção ('em_producao')
  const getOrdersRes3 = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const getOrdersData3 = await getOrdersRes3.json();
  const internalOrderInProd = getOrdersData3.pedidos.find((o: any) => o.id === internalOrderId);
  assert(internalOrderInProd.status === 'em_producao', 'Pedido interno agora está com status "em_producao"');

  // Verifica que as placas estão em produção
  const getPlatesInProdRes = await fetch(`${BASE_URL}/api/plates/in-production`);
  const getPlatesInProdData = await getPlatesInProdRes.json();
  const platesInProd = getPlatesInProdData.placas.filter((p: any) => p.order_id === internalOrderId);
  assert(platesInProd.length === 3, 'As 3 placas do pedido interno constam na aba "Placas em Produção"');

  // =========================================================================
  // CENÁRIO 2: Pedido de Revendedor (Confirmado Manualmente)
  // =========================================================================
  console.log('\n--- Cenário 2: Pedido de Revendedor Pago/Aprovado ---');
  const revCreateRes = await fetch(`${BASE_URL}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'prof_revendedor_001' },
    body: JSON.stringify({
      origem: 'compra_revendedor',
      quantidade: 2,
      modalidade_entrega: 'retirada',
      dados_retirada: { nome: 'Revendedor Teste', telefone: '11977771234' },
    }),
  });
  const revCreateData = await revCreateRes.json();
  const revOrderId = revCreateData.pedido.id;

  // Aprovação manual do pagamento
  await fetch(`${BASE_URL}/api/orders/${revOrderId}/confirm-payment-manual`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });

  // Pedido aprovado deve estar sem QR Codes prévios (card vermelho)
  const getRevOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const getRevOrdersData = await getRevOrdersRes.json();
  const revOrderInList = getRevOrdersData.pedidos.find((o: any) => o.id === revOrderId);
  assert(revOrderInList.qrcodes_gerados === false, 'Revendedor aprovado inicia com qrcodes_gerados = false (card vermelho)');
  assert(revOrderInList.total_placas_geradas === 0, 'Revendedor aprovado possui 0 placas geradas');

  // Início de produção sem QR Codes deve falhar
  const revStartProdBlocked = await fetch(`${BASE_URL}/api/orders/${revOrderId}/start-production`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  assert(revStartProdBlocked.status === 400, 'Produção bloqueada para revendedor sem QR codes');

  // Geração manual de QR Codes
  const revGenQrRes = await fetch(`${BASE_URL}/api/orders/${revOrderId}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  assert(revGenQrRes.status === 200, 'Geração manual de QR Codes concluída para revendedor');

  // Início de Produção liberado
  const revStartProdRes = await fetch(`${BASE_URL}/api/orders/${revOrderId}/start-production`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  assert(revStartProdRes.status === 200, 'Produção iniciada com sucesso para revendedor');

  // Limpeza dos pedidos de teste
  const { db } = await import('./server/db.js');
  db.prepare('DELETE FROM plates WHERE order_id IN (?, ?)').run(internalOrderId, revOrderId);
  db.prepare('DELETE FROM manufacturing_orders WHERE order_id IN (?, ?)').run(internalOrderId, revOrderId);
  db.prepare('DELETE FROM order_logistics WHERE order_id IN (?, ?)').run(internalOrderId, revOrderId);
  db.prepare('DELETE FROM payments WHERE order_id IN (?, ?)').run(internalOrderId, revOrderId);
  db.prepare('DELETE FROM orders WHERE id IN (?, ?)').run(internalOrderId, revOrderId);

  console.log(`\n🎉 Todos os ${passed}/${total} testes de geração manual de QR codes e início de produção passaram com 100% de sucesso!`);
}

runTests().catch((err) => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
