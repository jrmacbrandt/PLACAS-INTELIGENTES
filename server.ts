import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initDatabase } from './server/db.js';

import { authRouter } from './server/routes/auth.js';
import { ordersRouter } from './server/routes/orders.js';
import { paymentsRouter } from './server/routes/payments.js';
import { manufacturingRouter } from './server/routes/manufacturing.js';
import { inspectionsRouter } from './server/routes/inspections.js';
import { platesRouter } from './server/routes/plates.js';
import { logisticsRouter } from './server/routes/logistics.js';
import { adminRouter } from './server/routes/admin.js';
import { redirectRouter } from './server/routes/redirect.js';
import { shippingRouter } from './server/routes/shipping.js';
import { backupRouter } from './server/routes/backup.js';
import { startBackupScheduler } from './server/services/backup.js';
import { triggerAutoSupabaseSync } from './server/services/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// Inicialização das tabelas relacionais e seeds + sincronização automática inicial com Supabase
initDatabase();
triggerAutoSupabaseSync();

const app = express();

// Parsers para requisições JSON e uploads em base64
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// 1. ROTA PÚBLICA DE REDIRECIONAMENTO DINÂMICO (/r/:token)
app.use('/r', redirectRouter);

// 2. ROTAS DA API REST
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/manufacturing', manufacturingRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/plates', platesRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/backup', backupRouter);

// Endpoint de integridade da API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', versao: '5.0.0', time: new Date().toISOString() });
});

// 3. INTEGRAÇÃO COM VITE (DEV) OU ARQUIVOS ESTÁTICOS (PROD)
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Inicializa o agendador de backups automáticos
  startBackupScheduler();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Plataforma de Placas Inteligentes v5.0 em execução na porta ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SERVER_INIT_FATAL]', err);
  process.exit(1);
});
