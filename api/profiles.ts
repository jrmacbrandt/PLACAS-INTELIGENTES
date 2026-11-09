import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

/**
 * Serverless Function Vercel: /api/profiles
 * Gerencia leitura, criação, edição completa (inclusive endereço e faixas de preço) e exclusão
 * de Vendedores Internos e Revendedores diretamente no PostgreSQL do Supabase usando Service Role.
 */
export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(200).json({
        sucesso: true,
        perfis: data || [],
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (req.method === 'POST') {
      const nome = String(body.nome || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!nome || !email) {
        return res.status(400).json({ sucesso: false, mensagem: 'Nome e e-mail são obrigatórios.' });
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email);

      if (existing && existing.length > 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado no sistema.' });
      }

      const newId = `prof_${Math.random().toString(36).substring(2, 10)}`;
      const newAuthId = `auth_${Math.random().toString(36).substring(2, 10)}`;
      const now = new Date().toISOString();

      const partnerType = body.tipo_parceiro || 'revendedor_independente';
      const newProfile: Record<string, any> = {
        id: newId,
        auth_user_id: newAuthId,
        nome,
        email,
        telefone: body.telefone ? String(body.telefone).trim() : null,
        cpf_cnpj: body.cpf_cnpj ? String(body.cpf_cnpj).trim() : null,
        role: 'revendedor',
        tipo_parceiro: partnerType,
        preferencia_entrega: partnerType === 'equipe_interna' ? 'retirada' : 'correios',
        preco_individual: body.preco_individual && Number(body.preco_individual) > 0 ? Number(body.preco_individual) : null,
        cep: body.cep ? String(body.cep).trim() : null,
        logradouro: body.logradouro ? String(body.logradouro).trim() : null,
        numero: body.numero ? String(body.numero).trim() : null,
        complemento: body.complemento ? String(body.complemento).trim() : null,
        bairro: body.bairro ? String(body.bairro).trim() : null,
        cidade: body.cidade ? String(body.cidade).trim() : null,
        estado: body.estado ? String(body.estado).trim().toUpperCase() : null,
        ativo: true,
        is_master: false,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(201).json({
        sucesso: true,
        mensagem: `Cadastro de "${nome}" realizado com sucesso!`,
        perfil: data,
      });
    }

    if (req.method === 'PUT') {
      const profileId = req.query?.id || body.id;
      if (!profileId) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do perfil é obrigatório.' });
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.nome !== undefined) payload.nome = String(body.nome).trim();
      if (body.email !== undefined) payload.email = String(body.email).trim().toLowerCase();
      if (body.telefone !== undefined) payload.telefone = body.telefone ? String(body.telefone).trim() : null;
      if (body.cpf_cnpj !== undefined) payload.cpf_cnpj = body.cpf_cnpj ? String(body.cpf_cnpj).trim() : null;
      if (body.tipo_parceiro !== undefined) {
        payload.tipo_parceiro = body.tipo_parceiro;
        payload.preferencia_entrega = body.tipo_parceiro === 'equipe_interna' ? 'retirada' : 'correios';
      } else if (body.preferencia_entrega !== undefined) {
        payload.preferencia_entrega = body.preferencia_entrega;
      }
      if (body.preco_individual !== undefined) {
        payload.preco_individual = body.preco_individual && Number(body.preco_individual) > 0 ? Number(body.preco_individual) : null;
      }
      if (body.faixas_preco_individual !== undefined) {
        payload.faixas_preco_individual = body.faixas_preco_individual;
      }
      if (body.ativo !== undefined) payload.ativo = Boolean(body.ativo);
      if (body.cep !== undefined) payload.cep = body.cep ? String(body.cep).trim() : null;
      if (body.logradouro !== undefined) payload.logradouro = body.logradouro ? String(body.logradouro).trim() : null;
      if (body.numero !== undefined) payload.numero = body.numero ? String(body.numero).trim() : null;
      if (body.complemento !== undefined) payload.complemento = body.complemento ? String(body.complemento).trim() : null;
      if (body.bairro !== undefined) payload.bairro = body.bairro ? String(body.bairro).trim() : null;
      if (body.cidade !== undefined) payload.cidade = body.cidade ? String(body.cidade).trim() : null;
      if (body.estado !== undefined) payload.estado = body.estado ? String(body.estado).trim().toUpperCase() : null;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: `Dados cadastrais de "${data?.nome || body.nome}" salvos e sincronizados com sucesso!`,
        perfil: data,
      });
    }

    if (req.method === 'DELETE') {
      const profileId = req.query?.id || body.id;
      if (!profileId) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do perfil é obrigatório.' });
      }

      const { data: target } = await supabase
        .from('profiles')
        .select('id, email, is_master, nome')
        .eq('id', profileId)
        .single();

      if (target?.is_master || target?.email?.toLowerCase() === 'jrmacbrandt@gmail.com') {
        return res.status(403).json({ sucesso: false, mensagem: 'O Administrador Master não pode ser excluído.' });
      }

      const masterId = 'prof_jose_brandt';
      try {
        await supabase.from('clients').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('orders').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('orders').update({ aprovado_por: masterId }).eq('aprovado_por', profileId);
        await supabase.from('plates').update({ revendedor_id: masterId }).eq('revendedor_id', profileId);
        await supabase.from('inspections').update({ inspetor_id: masterId }).eq('inspetor_id', profileId);
        await supabase.from('audit_logs').update({ usuario_id: masterId }).eq('usuario_id', profileId);
      } catch {}

      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) {
        return res.status(500).json({ sucesso: false, mensagem: error.message });
      }

      return res.status(200).json({
        sucesso: true,
        mensagem: `Cadastro de "${target?.nome || 'usuário'}" removido com sucesso.`,
      });
    }

    return res.status(405).json({ sucesso: false, mensagem: 'Método não permitido.' });
  } catch (err: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: err?.message || 'Erro interno no gerenciamento de perfis.',
    });
  }
}
