import { Router } from 'express';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import { generateCryptographicToken, generateNextPlateSequence, peekNextPlateSequence } from '../services/token.js';
import type { Plate, DestinationHistory } from '../types.js';

export const platesRouter = Router();

/**
 * Listagem de Placas Liberadas
 * Conforme Adendo v5.0 Seção 2: Revendedor acessa apenas placas a ele atribuídas e liberadas.
 */
platesRouter.get('/', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const user = db.prepare('SELECT role FROM profiles WHERE id = ?').get(userId) as { role: string } | undefined;

  let plates: any[];
  if (user?.role === 'admin') {
    plates = db.prepare(`
      SELECT p.*, o.numero_pedido, pr.nome as revendedor_nome, pr.tipo_parceiro as revendedor_tipo
      FROM plates p
      LEFT JOIN orders o ON p.order_id = o.id
      LEFT JOIN profiles pr ON p.revendedor_id = pr.id
      ORDER BY CAST(SUBSTR(p.codigo_sequencial, 5) AS INTEGER) DESC
    `).all();
  } else {
    plates = db.prepare(`
      SELECT p.*, o.numero_pedido, pr.nome as revendedor_nome
      FROM plates p
      JOIN orders o ON p.order_id = o.id
      JOIN profiles pr ON p.revendedor_id = pr.id
      WHERE p.revendedor_id = ? AND p.status_fisico = 'liberada'
      ORDER BY CAST(SUBSTR(p.codigo_sequencial, 5) AS INTEGER) DESC
    `).all(userId);
  }

  res.json({ sucesso: true, placas: plates });
});

/**
 * Geração Antecipada de QR Codes / Placas para Estoque (Sem Pedido Vinculado)
 * Permite produzir previamente as placas físicas com códigos sequenciais garantidos.
 */
platesRouter.post('/generate-advance', async (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const admin = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as any;
  if (admin?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem gerar placas antecipadas de estoque.' });
  }

  const { quantidade, status_fisico = 'em_producao' } = req.body;
  const qty = parseInt(quantidade, 10);
  if (isNaN(qty) || qty < 1 || qty > 500) {
    return res.status(400).json({ sucesso: false, mensagem: 'Quantidade inválida. Informe entre 1 e 500 placas.' });
  }

  const appUrl = process.env.APP_URL || 'https://placasinteligentes.vercel.app';
  const now = new Date().toISOString();
  const createdPlates: any[] = [];

  for (let i = 0; i < qty; i++) {
    const plateId = `plt_${crypto.randomUUID().slice(0, 8)}`;
    const codigoSeq = generateNextPlateSequence();
    const token = generateCryptographicToken(12);
    const urlPermanente = `${appUrl.replace(/\/$/, '')}/r/${token}`;

    db.prepare(`
      INSERT INTO plates (
        id, manufacturing_order_id, order_id, revendedor_id, codigo_sequencial,
        token_publico, url_permanente, status_fisico, status_digital, status_nfc, data_fabricacao
      ) VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, 'inativa', 'instalado', ?)
    `).run(plateId, codigoSeq, token, urlPermanente, status_fisico, now);

    createdPlates.push({
      id: plateId,
      codigo_sequencial: codigoSeq,
      token_publico: token,
      url_permanente: urlPermanente,
      status_fisico,
      status_digital: 'inativa',
      data_fabricacao: now,
    });
  }

  const platesWithQRCodes = await Promise.all(
    createdPlates.map(async (p) => {
      const qrcodeDataUrl = await QRCode.toDataURL(p.url_permanente, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return {
        ...p,
        qrcode_data_url: qrcodeDataUrl,
      };
    })
  );

  const codigoInicial = platesWithQRCodes[0].codigo_sequencial;
  const codigoFinal = platesWithQRCodes[platesWithQRCodes.length - 1].codigo_sequencial;

  logAudit({
    usuario_id: adminId,
    acao: 'GERACAO_PLACAS_ANTECIPADAS_ESTOQUE',
    entidade: 'plates',
    entidade_id: platesWithQRCodes[0].id,
    dados_novos: {
      quantidade: qty,
      codigo_inicial: codigoInicial,
      codigo_final: codigoFinal,
      status_fisico,
    },
    ip_origem: req.ip,
  });

  res.status(201).json({
    sucesso: true,
    mensagem: `${qty} placas geradas com sucesso para estoque (${codigoInicial} até ${codigoFinal})!`,
    total_geradas: qty,
    codigo_inicial: codigoInicial,
    codigo_final: codigoFinal,
    placas: platesWithQRCodes,
  });
});

/**
 * Consulta de Placas Antecipadas em Estoque (Não Atribuídas a Pedidos)
 */
platesRouter.get('/unassigned', async (req, res) => {
  const plates = db.prepare(`
    SELECT * 
    FROM plates 
    WHERE order_id IS NULL 
    ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) ASC
  `).all() as any[];

  const platesWithQRCodes = await Promise.all(
    plates.map(async (p) => {
      const qrcodeDataUrl = await QRCode.toDataURL(p.url_permanente, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 400,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return {
        ...p,
        qrcode_data_url: qrcodeDataUrl,
      };
    })
  );

  const preview = peekNextPlateSequence(1);

  res.json({
    sucesso: true,
    total: plates.length,
    proximo_codigo_disponivel: preview.proximo_codigo,
    placas: platesWithQRCodes,
  });
});

/**
 * Listagem de Placas em Produção para o Painel da Gestão
 * Retorna todas as placas com status 'em_producao', 'produzida' ou 'planejada'
 * Inclui tanto as placas vinculadas a pedidos quanto placas de estoque antecipado.
 */
platesRouter.get('/in-production', (req, res) => {
  const plates = db.prepare(`
    SELECT p.*, o.numero_pedido, o.modalidade_entrega, pr.nome as revendedor_nome, pr.tipo_parceiro as revendedor_tipo,
           c.nome_estabelecimento as cliente_nome
    FROM plates p
    LEFT JOIN orders o ON p.order_id = o.id
    LEFT JOIN profiles pr ON p.revendedor_id = pr.id
    LEFT JOIN clients c ON o.cliente_id = c.id
    WHERE p.status_fisico = 'em_producao'
    ORDER BY CAST(SUBSTR(p.codigo_sequencial, 5) AS INTEGER) ASC
  `).all();

  res.json({ sucesso: true, placas: plates });
});

/**
 * Finalização Individual de Placa em Produção ("Botão de Finalizado")
 * Marca a placa física como finalizada/aprovada. Se todas do pedido forem finalizadas,
 * avança a ordem e a logística para despacho/retirada.
 */
platesRouter.post('/:id/finalize', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { id } = req.params;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  const now = new Date().toISOString();

  // Marca placa como aprovada (finalizada fisicamente)
  db.prepare(`
    UPDATE plates 
    SET status_fisico = 'aprovada', updated_at = ? 
    WHERE id = ?
  `).run(now, id);

  // Atualiza ordem de fabricação correspondente
  if (plate.manufacturing_order_id) {
    db.prepare(`
      UPDATE manufacturing_orders 
      SET quantidade_produzida = quantidade_produzida + 1,
          quantidade_aprovada = quantidade_aprovada + 1,
          updated_at = ?
      WHERE id = ?
    `).run(now, plate.manufacturing_order_id);
  }

  // Verifica se restam placas não finalizadas deste pedido (caso vinculado)
  let pedidoConcluido = false;
  if (plate.order_id) {
    const pendentes = (db.prepare(`
      SELECT COUNT(*) as count 
      FROM plates 
      WHERE order_id = ? AND status_fisico IN ('planejada', 'em_producao', 'produzida')
    `).get(plate.order_id) as any).count;

    if (pendentes === 0) {
      pedidoConcluido = true;
      db.prepare(`
        UPDATE manufacturing_orders 
        SET status = 'producao_concluida', updated_at = ? 
        WHERE order_id = ?
      `).run(now, plate.order_id);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(plate.order_id) as any;
      if (order) {
        if (order.modalidade_entrega === 'retirada') {
          db.prepare("UPDATE order_logistics SET retirada_status = 'pronta_para_retirada', updated_at = ? WHERE order_id = ?").run(now, plate.order_id);
        } else {
          db.prepare("UPDATE order_logistics SET correios_status = 'aguardando_postagem', updated_at = ? WHERE order_id = ?").run(now, plate.order_id);
        }
      }
    }
  }

  logAudit({
    usuario_id: adminId,
    acao: 'FINALIZACAO_PLACA_PRODUCAO',
    entidade: 'plates',
    entidade_id: id,
    dados_novos: { codigo_sequencial: plate.codigo_sequencial, pedidoConcluido },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Placa ${plate.codigo_sequencial} finalizada com sucesso!${pedidoConcluido ? ' Todas as placas do pedido foram concluídas e estão prontas para despacho/retirada.' : ''}`,
    pedido_concluido: pedidoConcluido,
  });
});

/**
 * Detalhes de uma Placa Específica
 */
platesRouter.get('/:id', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const user = db.prepare('SELECT role FROM profiles WHERE id = ?').get(userId) as { role: string } | undefined;
  const { id } = req.params;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  // Validação estrita de autorização (Anti-IDOR)
  if (user?.role !== 'admin' && (plate.revendedor_id !== userId || plate.status_fisico !== 'liberada')) {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado a esta placa.' });
  }

  const historico = db.prepare(`
    SELECT h.*, p.nome as alterado_por_nome
    FROM destination_history h
    JOIN profiles p ON h.alterado_por = p.id
    WHERE h.plate_id = ?
    ORDER BY h.data_alteracao DESC
  `).all(id);

  res.json({ sucesso: true, placa: plate, historico });
});

/**
 * Configuração Individual de Cada Placa (Adendo v5.0 Seção 3)
 * REGRA CRÍTICA: Salvar a configuração NÃO ativa a placa. Permanece inativa até o clique explícito.
 */
platesRouter.post('/:id/configure', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const user = db.prepare('SELECT role, nome FROM profiles WHERE id = ?').get(userId) as any;
  const { id } = req.params;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  // Validação de posse
  if (user?.role !== 'admin' && (plate.revendedor_id !== userId || plate.status_fisico !== 'liberada')) {
    return res.status(403).json({ sucesso: false, mensagem: 'Você não tem permissão para configurar esta placa.' });
  }

  const {
    nome_estabelecimento,
    categoria_estabelecimento,
    contato_nome,
    contato_telefone,
    tipo_destino,
    url_destino,
  } = req.body;

  // Validação de segurança da URL (Seção 16 do Prompt Mestre)
  if (url_destino) {
    const trimmed = String(url_destino).trim();
    if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'A URL de destino deve começar obrigatoriamente com https:// ou http://.',
      });
    }

    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Protocolo de destino inseguro não permitido.',
      });
    }
  }

  const now = new Date().toISOString();
  const urlAnterior = plate.url_destino;
  const urlNova = url_destino ? String(url_destino).trim() : null;

  db.prepare(`
    UPDATE plates 
    SET nome_estabelecimento = ?,
        categoria_estabelecimento = ?,
        contato_nome = ?,
        contato_telefone = ?,
        tipo_destino = ?,
        url_destino = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nome_estabelecimento || null,
    categoria_estabelecimento || null,
    contato_nome || null,
    contato_telefone || null,
    tipo_destino || 'google_reviews',
    urlNova,
    now,
    id
  );

  // Registra alteração de destino no histórico se houve mudança
  if (urlNova && urlNova !== urlAnterior) {
    const histId = `hist_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO destination_history (id, plate_id, destino_anterior, destino_novo, alterado_por, data_alteracao)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(histId, id, urlAnterior, urlNova, userId, now);
  }

  logAudit({
    usuario_id: userId,
    acao: 'CONFIGURACAO_INDIVIDUAL_PLACA',
    entidade: 'plates',
    entidade_id: id,
    dados_anteriores: { url_anterior: urlAnterior },
    dados_novos: { nome_estabelecimento, tipo_destino, url_destino: urlNova },
    ip_origem: req.ip,
  });

  const updatedPlate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id);

  res.json({
    sucesso: true,
    mensagem: 'Configuração da placa salva com sucesso. Nota: A placa permanece em seu estado digital atual.',
    placa: updatedPlate,
  });
});

/**
 * Controle Alternável Único: "Ativar placa" / "Desativar placa" (Adendo v5.0 Seção 4)
 * - Se inativa -> Ativa (requer URL configurada)
 * - Se ativa -> Desativa (bloqueia o redirecionamento público sem apagar configurações salvas)
 */
platesRouter.post('/:id/toggle-status', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const user = db.prepare('SELECT role FROM profiles WHERE id = ?').get(userId) as { role: string } | undefined;
  const { id } = req.params;

  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id) as Plate | undefined;
  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  // Validação de posse
  if (user?.role !== 'admin' && (plate.revendedor_id !== userId || plate.status_fisico !== 'liberada')) {
    return res.status(403).json({ sucesso: false, mensagem: 'Você não tem permissão para alterar o estado desta placa.' });
  }

  if (plate.status_digital === 'bloqueada') {
    return res.status(400).json({ sucesso: false, mensagem: 'Placa bloqueada administrativamente. Não pode ser ativada diretamente.' });
  }

  const now = new Date().toISOString();
  let novoStatus: 'ativa' | 'inativa';
  let mensagem: string;

  if (plate.status_digital === 'inativa') {
    // Para ativar, exige que haja URL configurada válida
    if (!plate.url_destino) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não é possível ativar a placa sem antes configurar uma URL de destino válida.',
      });
    }

    novoStatus = 'ativa';
    db.prepare(`
      UPDATE plates 
      SET status_digital = 'ativa', data_ativacao = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, id);

    mensagem = `Placa ${plate.codigo_sequencial} ativada com sucesso! O QR Code e o NFC estão funcionando.`;
  } else {
    // Desativação
    novoStatus = 'inativa';
    db.prepare(`
      UPDATE plates 
      SET status_digital = 'inativa', updated_at = ?
      WHERE id = ?
    `).run(now, id);

    mensagem = `Placa ${plate.codigo_sequencial} desativada. O redirecionamento público foi pausado (configuração preservada).`;
  }

  logAudit({
    usuario_id: userId,
    acao: novoStatus === 'ativa' ? 'ATIVACAO_PLACA' : 'DESATIVACAO_PLACA',
    entidade: 'plates',
    entidade_id: id,
    dados_anteriores: { status_digital: plate.status_digital },
    dados_novos: { status_digital: novoStatus },
    ip_origem: req.ip,
  });

  const updatedPlate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id);

  res.json({
    sucesso: true,
    mensagem,
    placa: updatedPlate,
  });
});

/**
 * Geração de Imagem QR Code Real (Data URL) para a Placa
 * Aponta sempre para a URL permanente /r/:token
 */
platesRouter.get('/:id/qrcode', async (req, res) => {
  const { id } = req.params;
  const plate = db.prepare('SELECT * FROM plates WHERE id = ?').get(id) as Plate | undefined;

  if (!plate) {
    return res.status(404).json({ sucesso: false, mensagem: 'Placa não encontrada.' });
  }

  try {
    const dataUrl = await QRCode.toDataURL(plate.url_permanente, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    res.json({
      sucesso: true,
      url_permanente: plate.url_permanente,
      qrcode_data_url: dataUrl,
      codigo_sequencial: plate.codigo_sequencial,
    });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao gerar QR Code.' });
  }
});
