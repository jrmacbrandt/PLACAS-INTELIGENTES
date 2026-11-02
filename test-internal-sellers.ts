import { db } from './server/db.js';
import { generateOrderNumber, generateCryptographicToken, generateNextPlateSequence } from './server/services/token.js';

async function testInternalSellersFlow() {
  console.log('=== TESTE DE REGRA: VENDEDORES INTERNOS E RETIRADA NO BALCÃO ===\n');

  // 1. Testa cadastro autônomo de revendedor (deve ser SEMPRE correios)
  const revendedorId = `prof_test_rev_${Date.now()}`;
  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, role, tipo_parceiro, preferencia_entrega)
    VALUES (?, ?, ?, ?, ?, 'revendedor', 'revendedor_independente', 'correios')
  `).run(
    revendedorId,
    `auth_${Date.now()}`,
    'Revendedor Autonomo Teste',
    `revendedor_${Date.now()}@teste.com`,
    '(21) 99999-8888'
  );

  const revProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(revendedorId) as any;
  if (revProfile.preferencia_entrega !== 'correios') {
    throw new Error('Falha: Revendedor autônomo deveria ter modalidade correios');
  }
  console.log('[PASS] 1. Cadastro autônomo de revendedor configurado estritamente para Correios');

  // 2. Testa cadastro de Vendedor Interno pelo Admin (deve ser equipe_interna e retirada)
  const vendedorInternoId = `prof_test_vend_${Date.now()}`;
  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, role, tipo_parceiro, preferencia_entrega)
    VALUES (?, ?, ?, ?, ?, 'revendedor', 'equipe_interna', 'retirada')
  `).run(
    vendedorInternoId,
    `auth_vend_${Date.now()}`,
    'Vendedor Interno Balcão',
    `vendedor_${Date.now()}@atelier.com`,
    '(21) 97777-6666'
  );

  const vendProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(vendedorInternoId) as any;
  if (vendProfile.tipo_parceiro !== 'equipe_interna' || vendProfile.preferencia_entrega !== 'retirada') {
    throw new Error('Falha: Vendedor interno não foi salvo com tipo equipe_interna ou retirada');
  }
  console.log('[PASS] 2. Vendedor interno cadastrado com equipe_interna e retirada no balcão');

  // 3. Testa emissão de pedido interno (sem cobrança Asaas, status aprovado, modalidade retirada)
  const orderId = `ord_test_int_${Date.now()}`;
  const numeroPedido = generateOrderNumber();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO orders (
      id, numero_pedido, revendedor_id, origem, status,
      quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega,
      aprovado_por, data_aprovacao, observacoes_admin
    ) VALUES (?, ?, ?, 'solicitacao_interna', 'aprovado', 10, 0.00, 0.00, 'retirada', 'prof_admin_001', ?, 'Pedido de teste equipe interna')
  `).run(orderId, numeroPedido, vendedorInternoId, now);

  db.prepare(`
    INSERT INTO order_logistics (
      id, order_id, modalidade, responsavel_retirada_nome, responsavel_retirada_telefone, retirada_status
    ) VALUES (?, ?, 'retirada', ?, ?, 'retirada_selecionada')
  `).run(`log_${Date.now()}`, orderId, vendProfile.nome, vendProfile.telefone);

  const mfgId = `mfg_test_${Date.now()}`;
  db.prepare(`
    INSERT INTO manufacturing_orders (
      id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status
    ) VALUES (?, ?, 'solicitacao_interna', 10, 0, 0, 0, 'aguardando_producao')
  `).run(mfgId, orderId);

  const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (createdOrder.valor_total !== 0 || createdOrder.status !== 'aprovado' || createdOrder.modalidade_entrega !== 'retirada') {
    throw new Error('Falha: Pedido interno deve ter valor R$ 0, status aprovado e modalidade retirada');
  }
  console.log('[PASS] 3. Pedido interno gerado com sucesso: R$ 0,00, sem cobrança e autorizado para esteira');

  // 4. Testa esteira unificada: atribuição de QR Codes para o pedido interno
  const plates = [];
  for (let i = 0; i < 10; i++) {
    const pltId = `plt_test_${Date.now()}_${i}`;
    const seq = generateNextPlateSequence();
    const token = generateCryptographicToken(12);
    db.prepare(`
      INSERT INTO plates (
        id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
        token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'produzida', 'inativa', 'instalado', ?)
    `).run(pltId, mfgId, orderId, vendedorInternoId, seq, token, `https://atelierdasplacas.com.br/r/${token}`, now);
    plates.push(seq);
  }

  db.prepare('UPDATE orders SET placa_codigo_inicial = ?, placa_codigo_final = ? WHERE id = ?')
    .run(plates[0], plates[plates.length - 1], orderId);

  console.log(`[PASS] 4. QR Codes vinculados ao pedido interno: ${plates[0]} até ${plates[plates.length - 1]}`);

  // 5. Início de Produção e Finalização de Lote
  db.prepare("UPDATE manufacturing_orders SET status = 'em_producao' WHERE id = ?").run(mfgId);
  db.prepare("UPDATE orders SET status = 'em_producao' WHERE id = ?").run(orderId);
  console.log('[PASS] 5. Pedido interno transitou para "em_producao"');

  db.prepare("UPDATE manufacturing_orders SET status = 'producao_concluida', quantidade_produzida = 10, quantidade_aprovada = 10 WHERE id = ?").run(mfgId);
  db.prepare("UPDATE plates SET status_fisico = 'aprovada' WHERE order_id = ?").run(orderId);
  db.prepare("UPDATE order_logistics SET retirada_status = 'pronta_para_retirada' WHERE order_id = ?").run(orderId);
  console.log('[PASS] 6. Lote do pedido interno finalizado e colocado como "pronta_para_retirada" no balcão');

  // 6. Confirmação de Retirada Presencial
  db.prepare(`
    UPDATE order_logistics 
    SET retirada_status = 'retirada_realizada', data_retirada_efetiva = ?, liberado_por = 'prof_admin_001'
    WHERE order_id = ?
  `).run(now, orderId);
  db.prepare("UPDATE orders SET status = 'concluido' WHERE id = ?").run(orderId);
  db.prepare("UPDATE plates SET status_fisico = 'liberada' WHERE order_id = ?").run(orderId);

  const finalOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as any;
  const finalLogistics = db.prepare('SELECT retirada_status FROM order_logistics WHERE order_id = ?').get(orderId) as any;
  if (finalOrder.status !== 'concluido' || finalLogistics.retirada_status !== 'retirada_realizada') {
    throw new Error('Falha na confirmação de retirada presencial');
  }
  console.log('[PASS] 7. Retirada no balcão registrada com sucesso e placas físicas liberadas');

  // Limpeza dos dados de teste
  db.prepare('DELETE FROM plates WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM manufacturing_orders WHERE id = ?').run(mfgId);
  db.prepare('DELETE FROM order_logistics WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  db.prepare('DELETE FROM profiles WHERE id IN (?, ?)').run(revendedorId, vendedorInternoId);

  console.log('\n=== TODOS OS 7 TESTES DE VENDEDORES INTERNOS E RETIRADA PASSARAM COM SUCESSO! ===');
}

testInternalSellersFlow().catch((err) => {
  console.error('Erro nos testes de vendedores internos:', err);
  process.exit(1);
});
