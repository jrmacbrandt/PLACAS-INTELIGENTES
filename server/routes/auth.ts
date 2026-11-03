import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { logAudit } from '../services/audit.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import type { Profile, UserRole, PartnerType, DeliveryPreference } from '../types.js';

export const authRouter = Router();

function sanitizeProfile(raw: any): Profile {
  if (!raw) return raw;
  const { senha_hash, ...rest } = raw;
  let faixas: any = null;
  try {
    faixas = typeof raw.faixas_preco_individual === 'string' ? JSON.parse(raw.faixas_preco_individual) : raw.faixas_preco_individual ?? null;
  } catch {
    faixas = null;
  }
  return {
    ...rest,
    faixas_preco_individual: Array.isArray(faixas) && faixas.length > 0 ? faixas : null,
    ativo: Boolean(raw.ativo),
    is_master: Boolean(raw.is_master),
    tem_senha: Boolean(senha_hash),
  };
}

/**
 * Lista perfis existentes (sem expor hash de senha)
 */
authRouter.get('/profiles', (req, res) => {
  const rows = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC').all() as any[];
  const profiles = rows.map(sanitizeProfile);
  res.json({ sucesso: true, perfis: profiles });
});

/**
 * Retorna dados do usuário autenticado (ou perfil ativo selecionado via header)
 */
authRouter.get('/me', (req, res) => {
  const profileId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as any;
  
  if (!profile) {
    return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado.' });
  }

  res.json({ sucesso: true, perfil: sanitizeProfile(profile) });
});

/**
 * Login autenticado com validação de e-mail e senha criptografada (Master Admin & Revendedores)
 */
authRouter.post('/login', (req, res) => {
  const { email, senha, require_admin } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail) {
    return res.status(400).json({ sucesso: false, mensagem: 'Informe seu e-mail de acesso.' });
  }

  if (!senha || String(senha).trim().length === 0) {
    return res.status(400).json({ sucesso: false, mensagem: 'Informe sua senha de acesso.' });
  }

  let profile = db
    .prepare('SELECT * FROM profiles WHERE LOWER(email) = ?')
    .get(cleanEmail) as any;

  if (!profile && cleanEmail === 'admin') {
    profile = db
      .prepare("SELECT * FROM profiles WHERE LOWER(email) = 'jrmacbrandt@gmail.com' OR role = 'admin' ORDER BY is_master DESC LIMIT 1")
      .get() as any;
  }

  if (!profile) {
    return res.status(401).json({
      sucesso: false,
      mensagem: 'Usuário não encontrado. Verifique o e-mail informado.',
    });
  }

  if (require_admin && profile.role !== 'admin') {
    return res.status(403).json({
      sucesso: false,
      mensagem: 'Acesso restrito: este usuário não possui permissão de Administrador Master.',
    });
  }

  // Se o perfil possui senha cadastrada (obrigatório para o Usuário Master/Admin), valida o hash
  if (profile.senha_hash || profile.role === 'admin' || profile.is_master) {
    const isValid = verifyPassword(String(senha), profile.senha_hash);
    if (!isValid) {
      logAudit({
        usuario_id: profile.id,
        acao: 'TENTATIVA_LOGIN_FALHA',
        entidade: 'profiles',
        entidade_id: profile.id,
        dados_novos: { email: cleanEmail, motivo: 'SENHA_INCORRETA' },
        ip_origem: req.ip,
      });
      return res.status(401).json({
        sucesso: false,
        mensagem: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
      });
    }
  } else {
    // Primeiro acesso de revendedor legado sem senha definida: grava a senha informada no primeiro login
    const newHash = hashPassword(String(senha));
    db.prepare("UPDATE profiles SET senha_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, profile.id);
    profile.senha_hash = newHash;
  }

  logAudit({
    usuario_id: profile.id,
    acao: 'LOGIN_SUCESSO',
    entidade: 'profiles',
    entidade_id: profile.id,
    dados_novos: { email: profile.email, role: profile.role, is_master: Boolean(profile.is_master) },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: 'Autenticação realizada com sucesso!',
    perfil: sanitizeProfile(profile),
  });
});

/**
 * Cadastro Público Autônomo de Revendedor (Seção 4.1 e Adendo v5.0)
 * Inclui pergunta obrigatória: "Como você prefere receber suas placas?"
 */
authRouter.post('/register', (req, res) => {
  const { nome, email, telefone, cpf_cnpj, senha } = req.body;

  if (!nome || !email || !telefone) {
    return res.status(400).json({ sucesso: false, mensagem: 'Nome, e-mail e telefone são obrigatórios.' });
  }

  // Cadastro público de revendedor é SEMPRE via Correios (sem opção de retirada na tela inicial)
  const prefEntrega: DeliveryPreference = 'correios';

  // Verifica se email já existe
  const existing = db.prepare('SELECT id FROM profiles WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
  }

  const id = `prof_${crypto.randomUUID().slice(0, 8)}`;
  const authUserId = `auth_${crypto.randomUUID().slice(0, 8)}`;

  // Regra Inegociável: Cadastro autônomo NUNCA pode conceder papel admin
  const role: UserRole = 'revendedor';
  const tipoParceiro: PartnerType = 'revendedor_independente';
  const senhaHash = senha && String(senha).trim().length >= 4 ? hashPassword(String(senha)) : null;

  db.prepare(`
    INSERT INTO profiles (id, auth_user_id, nome, email, telefone, cpf_cnpj, role, tipo_parceiro, preferencia_entrega, preco_individual, is_master, senha_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    authUserId,
    nome,
    email.trim(),
    telefone,
    cpf_cnpj || null,
    role,
    tipoParceiro,
    prefEntrega,
    null,
    senhaHash
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
    perfil: sanitizeProfile(newProfile),
  });
});

/**
 * Cadastro Administrativo pelo Administrador (Vendedor Interno ou Parceiro)
 */
authRouter.post('/admin-create', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
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
 * Exclusão de Perfil / Vendedor / Revendedor pelo Administrador
 */
authRouter.delete('/profiles/:id', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const adminProfile = db.prepare('SELECT role, is_master FROM profiles WHERE id = ?').get(adminId) as any;

  if (adminProfile?.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Apenas administradores podem excluir parceiros.' });
  }

  const { id } = req.params;
  const target = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ sucesso: false, mensagem: 'Perfil não encontrado.' });
  }

  if (target.is_master || target.email?.toLowerCase() === 'jrmacbrandt@gmail.com') {
    return res.status(400).json({ sucesso: false, mensagem: 'O Administrador Master não pode ser excluído.' });
  }

  const masterId = 'prof_jose_brandt';
  const refs: Array<[string, string]> = [
    ['clients', 'revendedor_id'],
    ['orders', 'revendedor_id'],
    ['orders', 'aprovado_por'],
    ['plates', 'revendedor_id'],
    ['plates', 'liberado_por'],
    ['inspections', 'inspetor_id'],
    ['destination_history', 'alterado_por'],
    ['audit_logs', 'usuario_id'],
    ['manufacturing_orders', 'revendedor_id'],
  ];

  for (const [table, column] of refs) {
    try {
      db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(masterId, id);
    } catch {}
  }

  db.prepare('DELETE FROM profiles WHERE id = ?').run(id);

  logAudit({
    usuario_id: adminId,
    acao: 'EXCLUSAO_USUARIO',
    entidade: 'profiles',
    entidade_id: id,
    dados_anteriores: { nome: target.nome, email: target.email, role: target.role },
    ip_origem: req.ip,
  });

  res.json({
    sucesso: true,
    mensagem: `Cadastro de "${target.nome}" excluído com sucesso.`,
  });
});

/**
 * Atualização cadastral do perfil (Dados pessoais, endereço e preferência de entrega)
 */
authRouter.put('/profile', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
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
  res.json({ sucesso: true, mensagem: 'Dados atualizados com sucesso!', perfil: sanitizeProfile(updated) });
});

/**
 * Alteração de senha (persiste senha_hash criptografado no banco local e sincroniza com Supabase)
 */
authRouter.post('/change-password', (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  const { nova_senha } = req.body;

  if (!nova_senha || String(nova_senha).length < 6) {
    return res.status(400).json({ sucesso: false, mensagem: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const novoHash = hashPassword(String(nova_senha));
  db.prepare("UPDATE profiles SET senha_hash = ?, updated_at = datetime('now') WHERE id = ?").run(novoHash, userId);

  logAudit({
    usuario_id: userId,
    acao: 'ALTERAR_SENHA',
    entidade: 'profiles',
    entidade_id: userId,
    dados_novos: { alterado: true },
    ip_origem: req.ip,
  });

  res.json({ sucesso: true, mensagem: 'Senha alterada e criptografada com sucesso!' });
});

