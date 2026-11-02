/**
 * Teste Automatizado: Bloqueio de Geração de QR Codes em Placas Pendentes
 * e Reconhecimento Automático via Asaas / Aprovação Manual
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Iniciando testes de Bloqueio de QR Codes em Pedidos Pendentes e Transição para Aprovados...\n');
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

  // 1. Criar pedido de revendedor externo (nasce como aguardando_pagamento)
  console.log('--- Teste 1: Criação de pedido de revendedor externo pendente de pagamento ---');
  const createRes = await fetch(`${BASE_URL}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'prof_revendedor_001' },
    body: JSON.stringify({
      origem: 'compra_revendedor',
      quantidade: 2,
      modalidade_entrega: 'retirada',
      dados_retirada: { nome: 'Carlos Revendedor', telefone: '11988887777' },
    }),
  });
  const createData = await createRes.json();
  assert(createRes.status === 201, 'Pedido criado com sucesso');
  assert(createData.pedido.status === 'aguardando_pagamento', 'Status do pedido é "aguardando_pagamento"');
  const orderId = createData.pedido.id;

  // 2. Tentar gerar QR Codes enquanto pendente de pagamento (DEVE SER BLOQUEADO COM HTTP 400)
  console.log('\n--- Teste 2: Tentativa de gerar QR Codes em pedido pendente ---');
  const genQrRes = await fetch(`${BASE_URL}/api/orders/${orderId}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const genQrData = await genQrRes.json();
  assert(genQrRes.status === 400, 'Endpoint POST generate-qrcodes retornou HTTP 400');
  assert(genQrData.sucesso === false, 'Resposta contém sucesso = false');
  assert(
    genQrData.mensagem.includes('Não é permitido gerar QR Codes para pedidos aguardando confirmação de pagamento'),
    `Mensagem informativa de bloqueio: "${genQrData.mensagem}"`
  );

  // 3. Tentar atribuir intervalo de placas enquanto pendente de pagamento (DEVE SER BLOQUEADO COM HTTP 400)
  console.log('\n--- Teste 3: Tentativa de atribuir intervalo de placas em pedido pendente ---');
  const assignRes = await fetch(`${BASE_URL}/api/orders/${orderId}/assign-range`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'prof_admin_001' },
    body: JSON.stringify({
      codigo_inicial: 'PLK-000001',
      codigo_final: 'PLK-000002',
    }),
  });
  const assignData = await assignRes.json();
  assert(assignRes.status === 400, 'Endpoint POST assign-range retornou HTTP 400');
  assert(assignData.sucesso === false, 'Resposta contém sucesso = false');
  assert(
    assignData.mensagem.includes('Não é permitido atribuir numeração de placas a pedidos aguardando confirmação de pagamento'),
    `Mensagem informativa de bloqueio: "${assignData.mensagem}"`
  );

  // 4. Testar reconhecimento automático de pagamento no Asaas (simulação de webhook)
  console.log('\n--- Teste 4: Reconhecimento de pagamento via Asaas (transição automática para "pago") ---');
  const simAsaasRes = await fetch(`${BASE_URL}/api/payments/simulate-webhook/${orderId}`, {
    method: 'POST',
  });
  const simAsaasData = await simAsaasRes.json();
  assert(simAsaasRes.status === 200, 'Webhook Asaas processado com HTTP 200');
  assert(simAsaasData.sucesso === true, 'Webhook Asaas confirmou sucesso');

  // Verificar se o pedido agora está com status 'pago'
  const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const ordersData = await ordersRes.json();
  const updatedOrder = ordersData.pedidos.find((o: any) => o.id === orderId);
  assert(updatedOrder?.status === 'pago', 'Pedido agora possui status "pago" (aprovado para produção)');

  // 5. Agora que está pago, geração de QR Codes deve ser liberada com sucesso!
  console.log('\n--- Teste 5: Geração de QR Codes após confirmação de pagamento ---');
  const genQrAllowedRes = await fetch(`${BASE_URL}/api/orders/${orderId}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const genQrAllowedData = await genQrAllowedRes.json();
  assert(genQrAllowedRes.status === 200, 'Geração de QR codes concluída com HTTP 200');
  assert(genQrAllowedData.sucesso === true, 'Resposta contém sucesso = true');
  assert(genQrAllowedData.placas?.length === 2, '2 placas com QR Codes geradas com sucesso');
  assert(Boolean(genQrAllowedData.placa_codigo_inicial), `Código inicial definido: ${genQrAllowedData.placa_codigo_inicial}`);
  assert(Boolean(genQrAllowedData.placa_codigo_final), `Código final definido: ${genQrAllowedData.placa_codigo_final}`);

  // 6. Testar aprovação manual de outro pedido
  console.log('\n--- Teste 6: Criação de segundo pedido e aprovação manual do pagamento ---');
  const order2Res = await fetch(`${BASE_URL}/api/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': 'prof_revendedor_001' },
    body: JSON.stringify({
      origem: 'compra_revendedor',
      quantidade: 3,
      modalidade_entrega: 'retirada',
      dados_retirada: { nome: 'Carlos Revendedor', telefone: '11988887777' },
    }),
  });
  const order2Data = await order2Res.json();
  const order2Id = order2Data.pedido.id;
  assert(order2Data.pedido.status === 'aguardando_pagamento', 'Segundo pedido inicia como "aguardando_pagamento"');

  // Geração de QR codes bloqueada
  const gen2Blocked = await fetch(`${BASE_URL}/api/orders/${order2Id}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  assert(gen2Blocked.status === 400, 'QR codes bloqueados antes da confirmação manual');

  // Confirmação manual pelo administrador
  const manualConfirmRes = await fetch(`${BASE_URL}/api/orders/${order2Id}/confirm-payment-manual`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const manualConfirmData = await manualConfirmRes.json();
  assert(manualConfirmRes.status === 200, 'Confirmação manual executada com sucesso');
  assert(manualConfirmData.sucesso === true, 'Resposta sucesso = true');

  // Geração liberada após confirmação manual
  const gen2Allowed = await fetch(`${BASE_URL}/api/orders/${order2Id}/generate-qrcodes`, {
    method: 'POST',
    headers: { 'x-user-id': 'prof_admin_001' },
  });
  const gen2AllowedData = await gen2Allowed.json();
  assert(gen2Allowed.status === 200, 'Geração de QR codes liberada após confirmação manual');
  assert(gen2AllowedData.placas?.length === 3, '3 placas geradas com sucesso para o pedido 2');

  console.log(`\n🎉 Todos os ${passed}/${total} testes de bloqueio de QR codes e reconhecimento Asaas passaram com 100% de sucesso!`);
}

runTests().catch((err) => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
