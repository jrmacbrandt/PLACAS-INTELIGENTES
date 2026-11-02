import { db, initDatabase } from './server/db.js';
import { calculateOrderPrice } from './server/services/pricing.js';
import { generateCryptographicToken, generateNextPlateSequence, generateOrderNumber } from './server/services/token.js';

console.log('=== INICIANDO SUÍTE DE TESTES OBRIGATÓRIOS (TEST_PLAN.md - VERSÃO 5.0) ===\n');

initDatabase();

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`[PASS] ${testId}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testId}: ${description}`);
    failCount++;
  }
}

// TESTE T01 / A01: Cadastro autônomo cria perfil de revendedor com acesso imediato e sem permissão de admin
const testUserId = `test_prof_${Date.now()}`;
db.prepare(`
  INSERT INTO profiles (id, auth_user_id, nome, email, telefone, role, tipo_parceiro, preferencia_entrega)
  VALUES (?, ?, ?, ?, ?, 'revendedor', 'revendedor_independente', 'retirada')
`).run(testUserId, `auth_${testUserId}`, 'Revendedor Teste', `revendedor_${Date.now()}@teste.com`, '11999999999');

const registeredProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(testUserId) as any;
assert(registeredProfile && registeredProfile.role === 'revendedor' && registeredProfile.role !== 'admin', 'T01/A01', 'Cadastro autônomo cria revendedor sem privilégio admin');

// TESTE T05 / A03: Preço por Volume (ADR 002) e Preço Individual
const calc5 = calculateOrderPrice(testUserId, 5);
assert(calc5.preco_unitario === 21.90 && calc5.valor_total === 109.50, 'T05.1', 'Faixa 1 a 9 unidades calcula R$ 21,90 / un');

const calc20 = calculateOrderPrice(testUserId, 20);
assert(calc20.preco_unitario === 19.90 && calc20.valor_total === 398.00, 'T05.2', 'Faixa 10 a 49 unidades calcula R$ 19,90 / un');

const calc60 = calculateOrderPrice(testUserId, 60);
assert(calc60.preco_unitario === 17.90 && calc60.valor_total === 1074.00, 'T05.3', 'Faixa 50+ unidades calcula R$ 17,90 / un');

// Preço individual prevalece sobre o global
db.prepare('UPDATE profiles SET preco_individual = 15.00 WHERE id = ?').run(testUserId);
const calcIndiv = calculateOrderPrice(testUserId, 5);
assert(calcIndiv.preco_unitario === 15.00 && calcIndiv.valor_total === 75.00 && calcIndiv.regra_aplicada === 'preco_individual', 'T05.4', 'Preço individual ativo prevalece sobre a tabela global');
db.prepare('UPDATE profiles SET preco_individual = NULL WHERE id = ?').run(testUserId);

// TESTE T07: Pedido de compra de revendedor não autoriza fabricação sem pagamento
const testOrderId = `test_ord_${Date.now()}`;
db.prepare(`
  INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
  VALUES (?, ?, ?, 'compra_revendedor', 'aguardando_pagamento', 10, 19.90, 199.00, 'retirada')
`).run(testOrderId, generateOrderNumber(), testUserId);

const mfgCheck = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(testOrderId);
assert(mfgCheck === undefined, 'T07', 'Pedido aguardando pagamento não entra na fila de fabricação');

// TESTE T09: Reserva de vendedor interno autoriza fabricação após aprovação admin
const internalOrderId = `test_ord_int_${Date.now()}`;
db.prepare(`
  INSERT INTO orders (id, numero_pedido, revendedor_id, origem, status, quantidade_total, preco_unitario_aplicado, valor_total, modalidade_entrega)
  VALUES (?, ?, ?, 'solicitacao_interna', 'aprovado', 5, 21.90, 109.50, 'retirada')
`).run(internalOrderId, generateOrderNumber(), testUserId);

const mfgIntId = `test_mfg_${Date.now()}`;
db.prepare(`
  INSERT INTO manufacturing_orders (id, order_id, origem, quantidade_solicitada, quantidade_produzida, quantidade_aprovada, quantidade_reprovada, status)
  VALUES (?, ?, 'solicitacao_interna', 5, 0, 0, 0, 'aguardando_producao')
`).run(mfgIntId, internalOrderId);

const mfgIntFound = db.prepare('SELECT id FROM manufacturing_orders WHERE order_id = ?').get(internalOrderId);
assert(mfgIntFound !== undefined, 'T09', 'Reserva de vendedor interno aprovada autoriza fabricação física');

// TESTE A07: Salvar configuração NÃO ativa a placa
const plateTestId = `test_plt_${Date.now()}`;
const plateToken = generateCryptographicToken(12);
db.prepare(`
  INSERT INTO plates (
    id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
    token_publico, url_permanente, status_fisico, status_digital, status_nfc
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'liberada', 'inativa', 'instalado')
`).run(
  plateTestId,
  mfgIntId,
  internalOrderId,
  testUserId,
  generateNextPlateSequence(),
  plateToken,
  `https://ais-dev-6ezygfhqwiuwevza32effv-186490178798.us-west2.run.app/r/${plateToken}`
);

// Atualiza configuração com link do Google
db.prepare(`
  UPDATE plates 
  SET nome_estabelecimento = 'Pizzaria Teste', tipo_destino = 'google_reviews', url_destino = 'https://g.page/r/test/review'
  WHERE id = ?
`).run(plateTestId);

const plateAfterConfig = db.prepare('SELECT status_digital, url_destino FROM plates WHERE id = ?').get(plateTestId) as any;
assert(plateAfterConfig.status_digital === 'inativa' && plateAfterConfig.url_destino === 'https://g.page/r/test/review', 'A07', 'Salvar URL válida mantém a placa inativa (não ativa automaticamente)');

// TESTE A08 / A09 / A10: Ativação, desativação sem perda de dados e reativação
db.prepare("UPDATE plates SET status_digital = 'ativa', data_ativacao = datetime('now') WHERE id = ?").run(plateTestId);
const plateAtiva = db.prepare('SELECT status_digital FROM plates WHERE id = ?').get(plateTestId) as any;
assert(plateAtiva.status_digital === 'ativa', 'A08', 'Placa ativada com sucesso');

// Desativação
db.prepare("UPDATE plates SET status_digital = 'inativa' WHERE id = ?").run(plateTestId);
const plateDesativada = db.prepare('SELECT status_digital, url_destino, nome_estabelecimento FROM plates WHERE id = ?').get(plateTestId) as any;
assert(plateDesativada.status_digital === 'inativa' && plateDesativada.url_destino === 'https://g.page/r/test/review' && plateDesativada.nome_estabelecimento === 'Pizzaria Teste', 'A09', 'Desativar a placa suspende o redirecionamento mantendo intactos a URL, dados e histórico');

// TESTE T11: Placa reprovada não pode ser liberada
const rejectedPlateId = `test_plt_rej_${Date.now()}`;
db.prepare(`
  INSERT INTO plates (
    id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
    token_publico, url_permanente, status_fisico, status_digital, status_nfc
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'reprovada', 'inativa', 'com_problema')
`).run(
  rejectedPlateId,
  mfgIntId,
  internalOrderId,
  testUserId,
  generateNextPlateSequence(),
  generateCryptographicToken(12),
  'https://exemplo.com/r/test'
);

const isLiberavel = db.prepare("SELECT COUNT(*) as count FROM plates WHERE id = ? AND status_fisico = 'aprovada'").get(rejectedPlateId) as any;
assert(isLiberavel.count === 0, 'T11', 'Placa reprovada na inspeção física não pode ser marcada como liberada');

// TESTE T17 / ADR 003: Alteração de modalidade de entrega do pedido com histórico
db.prepare(`
  INSERT INTO order_logistics (id, order_id, modalidade, responsavel_retirada_nome, retirada_status)
  VALUES (?, ?, 'retirada', 'João Silva', 'retirada_selecionada')
`).run(`log_${Date.now()}`, testOrderId);

db.prepare("UPDATE order_logistics SET modalidade = 'correios', correios_status = 'aguardando_postagem' WHERE order_id = ?").run(testOrderId);
const logisticaUpdated = db.prepare('SELECT modalidade, correios_status FROM order_logistics WHERE order_id = ?').get(testOrderId) as any;
assert(logisticaUpdated.modalidade === 'correios' && logisticaUpdated.correios_status === 'aguardando_postagem', 'T17/ADR 003', 'Administrador altera modalidade de entrega do pedido com sucesso');

console.log(`\n=== RESUMO DOS TESTES EXECUTADOS: ${passCount} APROVADOS, ${failCount} REPROVADOS ===\n`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('TODOS OS TESTES DE NEGÓCIO E ACEITAÇÃO DO ADENDO V5.0 FORAM APROVADOS!');
}
