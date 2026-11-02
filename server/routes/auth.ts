import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import type { Profile, UserRole, PartnerType, DeliveryPreference } from '../types.js';

export const authRouter = Router();

/**
 * Lista perfis existentes (permite alternar no ambiente de desenvolvimento/demonstração)
 */
authRouter.get('/profiles', (req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC').all() as unknown as Profile[];
  res.json({ sucesso: true, perfis: profiles });
});

/**
 * Retorna dados do usuário autenticado (ou perfil ativo selecionado via header)
 */
authRouter.get('/me', (req, res) => {
  const profileId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as Profile | undefined;
  
  if (!profile) {
    return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado.' });
  }

  res.json({ sucesso: true, perfil: profile });
});

/**
 * Cadastro Público Autônomo de Revendedor (Seção 4.1 e Adendo v5.0)
 * Inclui pergunta obrigatória: "Como você prefere receber suas placas?"
 */
authRouter.post('/register', (req, res) => {
  const { nome, email, telefone, cpf_cnpj, preferencia_entrega } = req.body;

  if (!nome || !email || !telefone) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nome, e-mail e telefone são obrigatórios.' });
  }

  // Cadastro público de revendedor é SEMPRE via Correios (sem opção de retirada na tela inicial)
  const prefEntrega: DeliveryPreference = 'correios';

  // Verifica se email já existe
  const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
  }

  const id = `prof_${crypto.randomUUID().slice(0, 8)}`;
  const authUserId = `auth_${crypto.randomUUID().slice(0, 8)}`;

  // Regra Inegociável: Cadastro autônomo NUNCA pode conceder papel admin
  const role: UserRole = 'revendedor';
  const tipoParceiro: PartnerType = 'revendedor_independente';

  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega, preco_individual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    authUserId,
    nome,
    email,
    telefone,
    cpf_cnpj || null,
    role,
    tipoParceiro,
    prefEntrega,
    null
  );

  logAudit({
    usuario_id: id,
    acao: 'CADASTRO_AUTONOMO',
    entidade: 'profiles',
    entidade_id: id,
    dados_novos: { nome, email, role, tipoParceiro, preferencia_entrega: prefEntrega },
    ip_origem: req.ip,
  });

  const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  res.status(201).json({
    sucesso: true,
    mensagem: 'Cadastro de revendedor realizado com sucesso!',
    perfil: newProfile,
  });
});

/**
 * Cadastro Administrativo pelo Administrador (Vendedor Interno ou Parceiro)
 */
authRouter.post('/admin-create', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const adminProfile = db.prepare('SELECT role FROM profiles WHERE id = ?').get(adminId) as { role: string } | undefined;

  if (adminProfile?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem cadastrar parceiros diretamente.' });
  }

  const { nome, email, telefone, cpf_cnpj, tipo_parceiro, preferencia_entrega, preco_individual } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nome e e-mail são obrigatórios.' });
  }

  const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
  }

  const id = `prof_${crypto.randomUUID().slice(0, 8)}`;
  const authUserId = `auth_${crypto.randomUUID().slice(0, 8)}`;
  const partnerType: PartnerType = tipo_parceiro || 'equipe_interna';
  const prefEntrega: DeliveryPreference = preferencia_entrega === 'correios' ? 'correios' : 'retirada';
  const precoInd = preco_individual && Number(preco_individual) > 0 ? Number(preco_individual) : null;

  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega, preco_individual)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    authUserId,
    nome,
    email,
    telefone || null,
    cpf_cnpj || null,
    'revendedor', // Mesmo papel unificado!
    partnerType,
    prefEntrega,
    precoInd
  );

  logAudit({
    usuario_id: adminId,
    acao: 'CADASTRO_ADMINISTRATIVO_REVENDEDOR',
    entidade: 'profiles',
    entidade_id: id,
    dados_novos: { nome, email, tipo_parceiro: partnerType, preco_individual: precoInd },
    ip_origem: req.ip,
  });

  const created = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
  res.status(201).json({
    sucesso: true,
    mensagem: 'Revendedor cadastrado administrativamente com sucesso.',
    perfil: created,
  });
});

/**
 * Atualização cadastral do perfil (Dados pessoais, endereço e preferência de entrega)
 */
authRouter.put('/profile', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { nome, telefone, cpf_cnpj, cep, logradouro, numero, complemento, bairro, cidade, estado, preferencia_entrega } = req.body;

  db.prepare(`
    UPDATE profiles
    SET nome = COALESCE(?, nome),
        telefone = COALESCE(?, telefone),
        cpf_cnpj = COALESCE(?, cpf_cnpj),
        cep = COALESCE(?, cep),
        logradouro = COALESCE(?, logradouro),
        numero = COALESCE(?, numero),
        complemento = COALESCE(?, complemento),
        bairro = COALESCE(?, bairro),
        cidade = COALESCE(?, cidade),
        estado = COALESCE(?, estado),
        preferencia_entrega = COALESCE(?, preferencia_entrega),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    nome || null,
    telefone || null,
    cpf_cnpj || null,
    cep || null,
    logradouro || null,
    numero || null,
    complemento || null,
    bairro || null,
    cidade || null,
    estado || null,
    preferencia_entrega || null,
    userId
  );

  logAudit({
    usuario_id: userId,
    acao: 'ATUALIZAR_PERFIL',
    entidade: 'profiles',
    entidade_id: userId,
    dados_novos: { nome, telefone, cpf_cnpj, cep, logradouro, numero, bairro, cidade, estado, preferencia_entrega },
    ip_origem: req.ip,
  });

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
  res.json({ sucesso: true, mensagem: 'Dados atualizados com sucesso!', perfil: updated });
});

/**
 * Alteração de senha
 */
authRouter.post('/change-password', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_admin_001';
  const { nova_senha } = req.body;

  if (!nova_senha || nova_senha.length < 6) {
    return res.status(400).json({ sucesso: false, mensagem: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  logAudit({
    usuario_id: userId,
    acao: 'ALTERAR_SENHA',
    entidade: 'profiles',
    entidade_id: userId,
    dados_novos: { alterado: true },
    ip_origem: req.ip,
  });

  res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
});

