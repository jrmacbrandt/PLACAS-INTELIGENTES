import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://rsphrxkmeeudlqpotdzi.supabase.co';
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcGhyeGttZWV1ZGxxcG90ZHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY2MDI4NSwiZXhwIjoyMTA5MjM2Mjg1fQ.3hjy4v_LjTX1eTVIimMfhVup9SteY3L8uIkO-8qH-OI';

function renderStatusHtml(title: string, message: string, code: string, color: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Atelier das Placas</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-4 font-sans">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
    <div class="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style="background-color: ${color}20; color: ${color}">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <span class="text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800 text-slate-300">${code}</span>
    <h1 class="text-2xl font-bold mt-4 mb-2">${title}</h1>
    <p class="text-slate-400 text-sm leading-relaxed mb-6">${message}</p>
    <a href="/" class="inline-block w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition">Acessar Painel de Ativação</a>
  </div>
</body>
</html>`;
}

/**
 * GET /r/:token (rewritten to /api/r?token=:token)
 * Redirecionamento Vitalício (NUNCA depende do arquivo PNG no Storage; consulta diretamente `plates`).
 */
export default async function handler(req: any, res: any) {
  const rawToken =
    req.query?.token ||
    (req.url ? req.url.split('/r/')[1]?.split('?')[0] : '') ||
    '';
  const token = String(rawToken).trim();

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (!token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(404)
      .send(renderStatusHtml('Placa Não Encontrada', 'O token informado na leitura não é válido.', '404_NOT_FOUND', '#ef4444'));
  }

  const supabaseUrl = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SERVICE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: plate, error } = await supabase
    .from('plates')
    .select('id, codigo_sequencial, token_publico, url_permanente, url_destino, status_fisico, status_digital')
    .eq('token_publico', token)
    .maybeSingle();

  if (error || !plate) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(404)
      .send(
        renderStatusHtml(
          'Placa Não Encontrada',
          'O código QR ou NFC lido não corresponde a nenhuma placa registrada.',
          '404_NOT_FOUND',
          '#ef4444'
        )
      );
  }

  if (plate.status_digital === 'bloqueada' || plate.status_fisico === 'bloqueada') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(403)
      .send(
        renderStatusHtml(
          'Placa Bloqueada',
          'Esta placa inteligente encontra-se temporariamente suspensa pela administração.',
          plate.codigo_sequencial,
          '#ef4444'
        )
      );
  }

  if (plate.status_digital === 'inativa' || !plate.url_destino) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send(
        renderStatusHtml(
          'Placa Aguardando Ativação',
          'Esta placa inteligente já foi fabricada e validada! Se você é o revendedor ou proprietário do estabelecimento, acesse o painel para configurar o link de destino (Google Avaliações, Instagram, WhatsApp ou Site).',
          plate.codigo_sequencial,
          '#f59e0b'
        )
      );
  }

  // Redirecionamento Vitalício (302 Found para permitir troca dinâmica instantânea de destino)
  return res.redirect(302, plate.url_destino);
}

