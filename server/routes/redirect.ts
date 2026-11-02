import { Router } from 'express';
import { db } from '../db.js';
import type { Plate } from '../types.js';

export const redirectRouter = Router();

/**
 * Rota Pública Permanente de Redirecionamento Dinâmico (Seção 15.2 e Adendo v5.0 Seção 5)
 * Endpoint: /r/:token
 * Regra: Utiliza redirecionamento temporário HTTP 302 para evitar cache permanente no navegador
 * e garantir que desativação ou alteração de destino tenham efeito imediato.
 */
redirectRouter.get('/:token', (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 6) {
    return renderStatusPage(res, 404, 'Placa Não Encontrada', 'O link ou QR Code escaneado não corresponde a uma placa válida no sistema.');
  }

  const plate = db.prepare('SELECT * FROM plates WHERE token_publico = ?').get(token) as Plate | undefined;

  if (!plate) {
    return renderStatusPage(res, 404, 'Placa Não Encontrada', 'Este QR Code não está registrado em nosso sistema.');
  }

  // 1. Placa Bloqueada Administrativamente
  if (plate.status_digital === 'bloqueada' || plate.status_fisico === 'bloqueada') {
    return renderStatusPage(res, 403, 'Placa Temporariamente Indisponível', 'Este serviço está temporariamente suspenso pela administração.');
  }

  // 2. Placa Inativa (Pausada ou Não Ativada pelo Revendedor)
  if (plate.status_digital === 'inativa') {
    return renderStatusPage(res, 200, 'Placa em Configuração', 'Esta placa física inteligente ainda não foi ativada pelo seu proprietário ou está temporariamente pausada.');
  }

  // 3. Placa Não Liberada
  if (plate.status_fisico !== 'liberada') {
    return renderStatusPage(res, 200, 'Placa em Processamento', 'Esta unidade física ainda está em processo de fabricação ou liberação.');
  }

  // 4. Placa Ativa sem URL de Destino
  if (!plate.url_destino) {
    return renderStatusPage(res, 200, 'Destino Não Configurado', 'A placa está ativa, mas nenhum link de destino foi informado.');
  }

  // 5. Sucesso: Redirecionamento Dinâmico Imediato (302 Found)
  // Cabeçalhos para impedir cache que retardaria desativação
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.redirect(302, plate.url_destino);
});

function renderStatusPage(res: any, httpStatus: number, titulo: string, mensagem: string) {
  res.status(httpStatus).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${titulo} | Placas Inteligentes</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased selection:bg-indigo-500 selection:text-white">
      <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div class="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
          ⚡
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-white mb-3">${titulo}</h1>
        <p class="text-slate-400 text-sm leading-relaxed mb-8">${mensagem}</p>
        <div class="pt-6 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-center gap-2">
          <span>Plataforma de Placas Inteligentes</span>
          <span>•</span>
          <span>QR Code Dinâmico & NFC</span>
        </div>
      </div>
    </body>
    </html>
  `);
}
