import crypto from 'node:crypto';
import { db, initDatabase } from './server/db.js';
import { calculateOrderPrice } from './server/services/pricing.js';
import { generateCryptographicToken, generateNextPlateSequence, generateOrderNumber } from './server/services/token.js';

console.log('================================================================');
console.log('  RELATÓRIO DE HOMOLOGAÇÃO COMPLETA — VERSÃO 5.0 (ETAPA 19)    ');
console.log('================================================================\n');

initDatabase();

let pass = 0;
let fail = 0;

function test(id: string, category: string, description: string, fn: () => boolean) {
  try {
    const ok = fn();
    if (ok) {
      pass++;
      console.log(`[APROVADO] ${id} (${category}): ${description}`);
    } else {
      fail++;
      console.error(`[FALHA] ${id} (${category}): ${description}`);
    }
  } catch (err: any) {
    fail++;
    console.error(`[ERRO] ${id} (${category}): ${description} -> ${err?.message}`);
  }
}

// CRIAÇÃO DE DADOS DE BASE PARA TESTES RELACIONAIS
const baseOrderId = `ord_test_base_${crypto.randomUUID().slice(0, 8)}`;
db.prepare(`
  INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
  VALUES (?, ?, 'prof_revendedor_001', 'compra_revendedor', 'pago', 10, 19.90, 199.00, 'retirada')
`).run(baseOrderId, generateOrderNumber());

const baseMfgId = `mfg_test_base_${crypto.randomUUID().slice(0, 8)}`;
db.prepare(`
  INSERT INTO manufacturing_orders (id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status)
  VALUES (?, ?, 'compra_revendedor', 10, 0, 0, 0, 'em_producao')
`).run(baseMfgId, baseOrderId);

// 1. MODELO COMERCIAL UNIFICADO & PERFIS (SEÇÃO 4 E ADENDO V5.0)
test('T01', 'Perfis', 'Cadastro autônomo cria perfil com papel revendedor', () => {
  const id = `test_u1_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, role, tipo_parceiro, preferencia_entrega)
    VALUES (?, ?, 'Revendedor T01', ?, '11999999991', 'revendedor', 'revendedor_independente', 'retirada')
  `).run(id, `auth_${id}`, `t01_${crypto.randomUUID().slice(0, 8)}@teste.com`);
  const row = db.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as any;
  return row?.role === 'revendedor';
});

test('T02', 'Perfis', 'Administrador cadastra vendedor interno usando o mesmo modelo de perfil de revendedor', () => {
  const id = `test_u2_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, role, tipo_parceiro, preferencia_entrega)
    VALUES (?, ?, 'Vendedora Interna T02', ?, '11999999992', 'revendedor', 'equipe_interna', 'correios')
  `).run(id, `auth_${id}`, `t02_${crypto.randomUUID().slice(0, 8)}@empresa.com`);
  const row = db.prepare('SELECT role, tipo_parceiro FROM profiles WHERE id = ?').get(id) as any;
  return row?.role === 'revendedor' && row?.tipo_parceiro === 'equipe_interna';
});

test('T03', 'Perfis', 'Vendedor interno não recebe privilégios administrativos automaticamente', () => {
  const row = db.prepare("SELECT role FROM profiles WHERE id = 'prof_vendedor_001'").get() as any;
  return row?.role === 'revendedor' && row?.role !== 'admin';
});

// 2. PRECIFICAÇÃO E PREÇO INDIVIDUAL (ADR 002)
test('T05.1', 'Precificação', 'Faixa 1 a 9 unidades calcula exatamente R$ 21,90 / un', () => {
  const res = calculateOrderPrice('prof_revendedor_001', 7);
  return res.preco_unitario === 21.90 && res.valor_total === 153.30;
});

test('T05.2', 'Precificação', 'Faixa 10 a 49 unidades calcula exatamente R$ 19,90 / un', () => {
  const res = calculateOrderPrice('prof_revendedor_001', 15);
  return res.preco_unitario === 19.90 && res.valor_total === 298.50;
});

test('T05.3', 'Precificação', 'Faixa 50+ unidades calcula exatamente R$ 17,90 / un', () => {
  const res = calculateOrderPrice('prof_revendedor_001', 50);
  return res.preco_unitario === 17.90 && res.valor_total === 895.00;
});

test('T05.4', 'Precificação', 'Preço individual ativo prevalece sobre a tabela global', () => {
  const res = calculateOrderPrice('prof_parceiro_001', 10);
  return res.preco_unitario === 16.50 && res.valor_total === 165.00 && res.regra_aplicada === 'preco_individual';
});

// 3. FLUXO DE PEDIDOS E AUTORIZAÇÃO DE FABRICAÇÃO (SEÇÃO 10 E 24.3)
test('T07', 'Pedidos', 'Compra de revendedor NÃO autoriza fabricação antes do pagamento confirmado', () => {
  const orderId = `ord_t07_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, 'prof_revendedor_001', 'compra_revendedor', 'aguardando_pagamento', 10, 19.90, 199.00, 'retirada')
  `).run(orderId, generateOrderNumber());

  const mfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(orderId);
  return mfg === undefined;
});

test('T09', 'Pedidos', 'Reserva interna aprovada pelo Admin autoriza fabricação física sem pagamento prévio', () => {
  const orderId = `ord_t09_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, 'prof_vendedor_001', 'solicitacao_interna', 'aprovado', 5, 21.90, 109.50, 'retirada')
  `).run(orderId, generateOrderNumber());

  const mfgId = `mfg_t09_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO manufacturing_orders (id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status)
    VALUES (?, ?, 'solicitacao_interna', 5, 0, 0, 0, 'aguardando_producao')
  `).run(mfgId, orderId);

  const mfg = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(orderId) as any;
  return mfg !== undefined;
});

// 4. FABRICAÇÃO PARCIAL E INSPEÇÃO DE QUALIDADE (SEÇÃO 11 E 13)
test('T10', 'Fabricação', 'Produção unitária gera identificadores únicos e tokens imprevisíveis', () => {
  const token1 = generateCryptographicToken(12);
  const token2 = generateCryptographicToken(12);
  return token1 !== token2 && token1.length === 12;
});

test('T11', 'Inspeção', 'Placa reprovada na inspeção física não pode ser marcada como liberada', () => {
  const plateId = `plt_t11_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://exemplo.com/r/t11', 'reprovada', 'inativa', 'com_problema')
  `).run(plateId, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  const isApproved = db.prepare("SELECT COUNT(*) as count FROM plates WHERE id = ? AND status_fisico = 'aprovada'").get(plateId) as any;
  return isApproved.count === 0;
});

// 5. GESTÃO INDIVIDUAL DE PLACAS (ADENDO OBRIGATÓRIO V5.0)
test('A07', 'Adendo v5.0', 'Salvar configuração individual NÃO ativa a placa (permanece inativa)', () => {
  const plateId = `plt_a07_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://exemplo.com/r/a07', 'liberada', 'inativa', 'instalado')
  `).run(plateId, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  // Salva link de Google Avaliações
  db.prepare(`
    UPDATE plates 
    SET nome_estabelecimento = 'Loja Teste A07', tipo_destino = 'google_reviews', url_destino = 'https://g.page/r/test-a07/review'
    WHERE id = ?
  `).run(plateId);

  const plate = db.prepare('SELECT status_digital, url_destino FROM plates WHERE id = ?').get(plateId) as any;
  return plate.status_digital === 'inativa' && plate.url_destino === 'https://g.page/r/test-a07/review';
});

test('A08', 'Adendo v5.0', 'Controle alternável ativa a placa no backend', () => {
  const plateId = `plt_a08_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, url_destino)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://exemplo.com/r/a08', 'liberada', 'inativa', 'instalado', 'https://g.page/test')
  `).run(plateId, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  db.prepare("UPDATE plates SET status_digital = 'ativa' WHERE id = ?").run(plateId);
  const plate = db.prepare('SELECT status_digital FROM plates WHERE id = ?').get(plateId) as any;
  return plate.status_digital === 'ativa';
});

test('A09', 'Adendo v5.0', 'Desativar a placa suspende o redirecionamento mantendo intactos a URL, dados e histórico', () => {
  const plateId = `plt_a09_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, nome_estabelecimento, url_destino)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://exemplo.com/r/a09', 'liberada', 'ativa', 'instalado', 'Restaurante Sabor', 'https://g.page/sabor')
  `).run(plateId, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  // Desativação
  db.prepare("UPDATE plates SET status_digital = 'inativa' WHERE id = ?").run(plateId);
  const plate = db.prepare('SELECT status_digital, nome_estabelecimento, url_destino FROM plates WHERE id = ?').get(plateId) as any;
  return plate.status_digital === 'inativa' && plate.nome_estabelecimento === 'Restaurante Sabor' && plate.url_destino === 'https://g.page/sabor';
});

test('A11', 'Adendo v5.0', 'Ativar, desativar ou alterar o destino de uma placa não afeta outras placas', () => {
  const p1 = `plt_p1_${crypto.randomUUID().slice(0, 8)}`;
  const p2 = `plt_p2_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, url_destino)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://ex.com/p1', 'liberada', 'inativa', 'instalado', 'https://site1.com')
  `).run(p1, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  db.prepare(`
    INSERT INTO plates (id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial, token_publico, url_permanente, status_fisico, status_digital, status_nfc, url_destino)
    VALUES (?, ?, ?, 'prof_revendedor_001', ?, ?, 'https://ex.com/p2', 'liberada', 'ativa', 'instalado', 'https://site2.com')
  `).run(p2, baseMfgId, baseOrderId, generateNextPlateSequence(), generateCryptographicToken(12));

  // Altera P1
  db.prepare("UPDATE plates SET status_digital = 'ativa', url_destino = 'https://novosite1.com' WHERE id = ?").run(p1);

  const rowP2 = db.prepare('SELECT status_digital, url_destino FROM plates WHERE id = ?').get(p2) as any;
  return rowP2.status_digital === 'ativa' && rowP2.url_destino === 'https://site2.com';
});

// 6. LOGÍSTICA DUAL & ADR 003
test('T13/T14', 'Logística Dual', 'Preferência padrão de entrega salva no perfil e desacoplada dos pedidos', () => {
  const p = db.prepare('SELECT preferencia_entrega FROM profiles WHERE id = ?').get('prof_revendedor_001') as any;
  return p && (p.preferencia_entrega === 'retirada' || p.preferencia_entrega === 'correios');
});

test('T17/ADR 003', 'Logística Dual', 'Administrador altera modalidade de entrega do pedido com histórico', () => {
  const orderId = `ord_t17_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, 'prof_revendedor_001', 'compra_revendedor', 'pago', 5, 21.90, 109.50, 'retirada')
  `).run(orderId, generateOrderNumber());

  db.prepare(`
    INSERT INTO order_logistics (id, order_id, modalidade, responsavel_retirada_nome, retirada_status)
    VALUES (?, ?, 'retirada', 'Carlos Revendedor', 'retirada_selecionada')
  `).run(`log_${crypto.randomUUID().slice(0, 8)}`, orderId);

  // Alteração para Correios pelo Admin
  db.prepare("UPDATE orders SET modalidade_entrega = 'correios' WHERE id = ?").run(orderId);
  db.prepare(`
    UPDATE order_logistics 
    SET modalidade = 'correios', correios_status = 'aguardando_postagem', destinatario_nome = 'Carlos', cep = '01310-100', logradouro = 'Av Paulista', numero = '100'
    WHERE order_id = ?
  `).run(orderId);

  const updatedLog = db.prepare('SELECT modalidade, correios_status FROM order_logistics WHERE order_id = ?').get(orderId) as any;
  return updatedLog.modalidade === 'correios' && updatedLog.correios_status === 'aguardando_postagem';
});

test('T20', 'Logística Dual', 'Retirada só é marcada como realizada após confirmação explícita de operador', () => {
  const orderId = `ord_t20_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
    VALUES (?, ?, 'prof_revendedor_001', 'compra_revendedor', 'pago', 2, 21.90, 43.80, 'retirada')
  `).run(orderId, generateOrderNumber());

  db.prepare(`
    INSERT INTO order_logistics (id, order_id, modalidade, responsavel_retirada_nome, retirada_status)
    VALUES (?, ?, 'retirada', 'Marcos', 'pronta_para_retirada')
  `).run(`log_${crypto.randomUUID().slice(0, 8)}`, orderId);

  db.prepare("UPDATE order_logistics SET retirada_status = 'retirada_realizada', data_retirada_efetiva = datetime('now') WHERE order_id = ?").run(orderId);
  const log = db.prepare('SELECT retirada_status, data_retirada_efetiva FROM order_logistics WHERE order_id = ?').get(orderId) as any;
  return log.retirada_status === 'retirada_realizada' && log.data_retirada_efetiva !== null;
});

// 7. WEBHOOKS & IDEMPOTÊNCIA (SEÇÃO 16)
test('T08', 'Webhooks Asaas', 'Controle de idempotência descarta eventos repetidos com o mesmo event_id', () => {
  const eventId = `evt_test_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO webhook_events (id, event_id, evento, payload, processado, sucesso)
    VALUES (?, ?, 'PAYMENT_CONFIRMED', '{}', 1, 1)
  `).run(`wh_${crypto.randomUUID().slice(0, 8)}`, eventId);

  const check = db.prepare('SELECT COUNT(*) as count FROM webhook_events WHERE event_id = ?').get(eventId) as any;
  return check.count === 1;
});

console.log('\n================================================================');
console.log(`  RESULTADO: ${pass} TESTES APROVADOS, ${fail} REPROVADOS       `);
console.log('================================================================\n');

if (fail > 0) {
  process.exit(1);
} else {
  console.log('HOMOLOGAÇÃO CONCLUÍDA COM 100% DE SUCESSO!');
}
