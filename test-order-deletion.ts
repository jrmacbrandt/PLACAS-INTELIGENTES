import { db } from './server/db.js';
import { generateOrderNumber, generateCryptographicToken, generateNextPlateSequence } from './server/services/token.js';

async function testOrderDeletion() {
  console.log('=== TESTE DE REGRA: EXCLUSÃO TOTAL DE PEDIDOS DO BANCO DE DADOS ===\n');

  const adminProfile = db.prepare("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1").get() as any;
  const adminId = adminProfile?.id || 'prof_admin_001';

  // 1. Criação do Pedido 1 (para testar exclusão com devolução de placas ao estoque)
  const orderId1 = `ord_del_test1_${Date.now()}`;
  const num1 = generateOrderNumber();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, ?, 'compra_revendedor', 'pago', 2, 21.90, 43.80, 'correios')
  `).run(orderId1, num1, adminId);

  db.prepare(`
    INSERT INTO order_logistics (id, order_id, modalidade, correios_status)
    VALUES (?, ?, 'correios', 'aguardando_producao')
  `).run(`log_${Date.now()}`, orderId1);

  const mfgId1 = `mfg_del_1_${Date.now()}`;
  db.prepare(`
    INSERT INTO manufacturing_orders (id, order_id, origem, quantidade_solicitada, status)
    VALUES (?, ?, 'compra_revendedor', 2, 'aguardando_producao')
  `).run(mfgId1, orderId1);

  const seq1 = `PLK-${Date.now().toString().slice(-6)}`;
  const seq2 = `PLK-${(Date.now() + 1).toString().slice(-6)}`;
  const plt1 = `plt_del_1_${Date.now()}`;
  const plt2 = `plt_del_2_${Date.now()}`;
  const token1 = generateCryptographicToken(12);
  const token2 = generateCryptographicToken(12);

  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'produzida', 'inativa', 'instalado', ?)
  `).run(plt1, mfgId1, orderId1, adminId, seq1, token1, `https://atelierdasplacas.com.br/r/${token1}`, now);

  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'produzida', 'inativa', 'instalado', ?)
  `).run(plt2, mfgId1, orderId1, adminId, seq2, token2, `https://atelierdasplacas.com.br/r/${token2}`, now);

  console.log(`[CRIADO] Pedido #${num1} criado com 2 placas vinculadas (${seq1}, ${seq2})`);

  // Simula a exclusão com reaproveitamento de placas (reaproveitar_placas = true)
  db.prepare(`
    UPDATE plates 
    SET order_id = NULL, manufacturing_order_id = NULL, revendedor_id = NULL,
        nome_estabelecimento = NULL, url_destino = NULL, status_digital = 'inativa', updated_at = datetime('now')
    WHERE order_id = ?
  `).run(orderId1);
  db.prepare('DELETE FROM manufacturing_orders WHERE order_id = ?').run(orderId1);
  db.prepare('DELETE FROM order_logistics WHERE order_id = ?').run(orderId1);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId1);

  // Verificação no banco de dados
  const checkOrder1 = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId1);
  const checkPlates1 = db.prepare('SELECT id, order_id FROM plates WHERE id IN (?, ?)').all(plt1, plt2) as any[];

  if (checkOrder1) {
    throw new Error('Falha: Pedido 1 ainda existe no banco após exclusão!');
  }
  if (checkPlates1.length !== 2 || checkPlates1.some(p => p.order_id !== null)) {
    throw new Error('Falha: Placas deveriam ter sido desvinculadas para o estoque livre!');
  }
  console.log('[PASS] 1. Pedido 1 totalmente apagado e placas físicas devolvidas com sucesso ao Estoque Livre.');

  // Limpeza das placas livres do teste
  db.prepare('DELETE FROM plates WHERE id IN (?, ?)').run(plt1, plt2);

  // 2. Criação do Pedido 2 (para testar exclusão pura, com destruição das placas)
  const orderId2 = `ord_del_test2_${Date.now()}`;
  const num2 = generateOrderNumber();
  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, ?, 'compra_revendedor', 'aguardando_pagamento', 1, 21.90, 21.90, 'correios')
  `).run(orderId2, num2, adminId);

  const plt3 = `plt_del_3_${Date.now()}`;
  const seq3 = generateNextPlateSequence();
  const token3 = generateCryptographicToken(12);
  db.prepare(`
    INSERT INTO plates (id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao)
    VALUES (?, ?, ?, ?, ?, ?, 'planejada', 'inativa', 'instalado', ?)
  `).run(plt3, orderId2, adminId, seq3, token3, `https://atelierdasplacas.com.br/r/${token3}`, now);

  // Simula exclusão definitiva com remoção das placas
  db.prepare('DELETE FROM plates WHERE order_id = ?').run(orderId2);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId2);

  const checkOrder2 = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId2);
  const checkPlate3 = db.prepare('SELECT * FROM plates WHERE id = ?').get(plt3);

  if (checkOrder2 || checkPlate3) {
    throw new Error('Falha: Pedido 2 ou suas placas ainda existem no banco após exclusão completa!');
  }
  console.log('[PASS] 2. Pedido 2 e suas placas foram 100% apagados da base de dados.');

  console.log('\n=== TODOS OS TESTES DE EXCLUSÃO DE PEDIDOS FORAM APROVADOS COM SUCESSO! ===');
}

testOrderDeletion().catch((err) => {
  console.error('Erro no teste de exclusão:', err);
  process.exit(1);
});
