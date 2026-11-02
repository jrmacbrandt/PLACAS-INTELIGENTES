import { db } from './server/db.js';
import { generateOrderNumber, generateCryptographicToken } from './server/services/token.js';

async function testBulkDelete() {
  console.log('=== TESTE DE REGRA: EXCLUSÃO EM MASSA DE PEDIDOS (/api/orders/bulk-delete) ===\n');

  const adminProfile = db.prepare("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1").get() as any;
  const adminId = adminProfile?.id || 'prof_admin_001';

  // 1. Cria 3 pedidos para teste de exclusão em massa com reaproveitamento de placas
  const orderId1 = `ord_bulk1_${Date.now()}`;
  const orderId2 = `ord_bulk2_${Date.now()}`;
  const orderId3 = `ord_bulk3_${Date.now()}`;
  const now = new Date().toISOString();

  for (const [idx, id] of [orderId1, orderId2, orderId3].entries()) {
    const num = generateOrderNumber();
    db.prepare(`
      INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
      VALUES (?, ?, ?, 'compra_revendedor', 'aguardando_pagamento', 2, 21.90, 43.80, 'correios')
    `).run(id, num, adminId);

    // Placas associadas
    const seq = `PLK-${Date.now().toString().slice(-6)}${idx}`;
    const token = generateCryptographicToken(12);
    db.prepare(`
      INSERT INTO plates (id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao)
      VALUES (?, ?, ?, ?, ?, ?, 'produzida', 'inativa', 'instalado', ?)
    `).run(`plt_${id}`, id, adminId, seq, token, `https://atelierdasplacas.com.br/r/${token}`, now);
  }

  console.log(`[CRIADOS] 3 pedidos inseridos para teste de exclusão em massa.`);

  // Teste 1: Bulk Delete via API com reaproveitar_placas = true
  const res1 = await fetch('http://localhost:3000/api/orders/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_ids: [orderId1, orderId2],
      reaproveitar_placas: true,
    }),
  });

  const json1 = await res1.json();
  console.log('[API RESPONSE]', json1);

  if (!res1.ok || !json1.sucesso) {
    throw new Error(`Falha na API bulk-delete: ${json1.mensagem || res1.statusText}`);
  }

  // Verificar no banco
  const checkOrders1 = db.prepare('SELECT id FROM orders WHERE id IN (?, ?)').all(orderId1, orderId2);
  const checkPlates1 = db.prepare('SELECT id, order_id FROM plates WHERE id IN (?, ?)').all(`plt_${orderId1}`, `plt_${orderId2}`) as any[];

  if (checkOrders1.length > 0) {
    throw new Error('Falha: Pedidos ainda existem no banco após bulk-delete!');
  }
  if (checkPlates1.length !== 2 || checkPlates1.some(p => p.order_id !== null)) {
    throw new Error('Falha: Placas deveriam ter order_id = null para estoque livre!');
  }
  console.log('✓ PASS: Pedidos 1 e 2 apagados em lote e suas placas devolvidas ao estoque livre.');

  // Teste 2: Bulk Delete via API com reaproveitar_placas = false
  const res2 = await fetch('http://localhost:3000/api/orders/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_ids: [orderId3],
      reaproveitar_placas: false,
    }),
  });

  const json2 = await res2.json();
  console.log('[API RESPONSE 2]', json2);

  if (!res2.ok || !json2.sucesso) {
    throw new Error(`Falha na API bulk-delete (sem reaproveitamento): ${json2.mensagem || res2.statusText}`);
  }

  const checkOrder3 = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId3);
  const checkPlate3 = db.prepare('SELECT id FROM plates WHERE id = ?').get(`plt_${orderId3}`);

  if (checkOrder3 || checkPlate3) {
    throw new Error('Falha: Pedido 3 ou sua placa ainda existem após exclusão definitiva!');
  }
  console.log('✓ PASS: Pedido 3 e suas placas apagados definitivamente em lote.');

  // Limpeza das placas desvinculadas no teste 1
  db.prepare('DELETE FROM plates WHERE id IN (?, ?)').run(`plt_${orderId1}`, `plt_${orderId2}`);

  console.log('\n=== TODOS OS TESTES DE EXCLUSÃO EM MASSA PASSARAM COM 100% DE SUCESSO! ===\n');
}

testBulkDelete().catch((err) => {
  console.error('ERRO NO TESTE DE EXCLUSÃO EM MASSA:', err);
  process.exit(1);
});
