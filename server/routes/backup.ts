import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateTimestampFilename,
  generateBackupPayload,
  createFullBackup,
  listStoredBackups,
  deleteStoredBackup,
  restoreDatabaseFromPayload,
  getBackupConfig,
  saveBackupConfig,
} from '../services/backup.js';

export const backupRouter = Router();

/**
 * 1. DOWNLOAD INSTANTÂNEO DE BACKUP (ARQUIVO ÚNICO COM DATA E HORÁRIO)
 * Gera na hora e baixa direto no navegador
 */
backupRouter.get('/download-instant', (req, res) => {
  try {
    const payload = generateBackupPayload('manual');
    const filename = generateTimestampFilename();
    const jsonString = JSON.stringify(payload, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(jsonString));
    res.send(jsonString);
  } catch (err: any) {
    res.status(500).json({ sucesso: false, mensagem: `Erro ao gerar backup: ${err?.message}` });
  }
});

/**
 * 2. GERAÇÃO DE BACKUP SALVO NO SERVIDOR
 */
backupRouter.post('/create', async (req, res) => {
  try {
    const result = await createFullBackup('manual');
    res.json({
      sucesso: true,
      mensagem: `Backup "${result.filename}" gerado com sucesso!`,
      backup: {
        filename: result.filename,
        size: result.size,
        metadata: result.metadata,
      },
    });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, mensagem: `Falha ao criar backup: ${err?.message}` });
  }
});

/**
 * 3. LISTAGEM DOS BACKUPS SALVOS NO SERVIDOR
 */
backupRouter.get('/list', (req, res) => {
  try {
    const list = listStoredBackups();
    res.json({ sucesso: true, backups: list });
  } catch (err: any) {
    res.status(500).json({ sucesso: false, mensagem: `Erro ao listar backups: ${err?.message}` });
  }
});

/**
 * 4. DOWNLOAD DE UM ARQUIVO DE BACKUP ESPECÍFICO DO SERVIDOR
 */
backupRouter.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const safeName = path.basename(filename);
  const filePath = path.resolve(process.cwd(), 'data', 'backups', safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ sucesso: false, mensagem: 'Arquivo de backup não encontrado no servidor.' });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

/**
 * 5. EXCLUSÃO DE UM ARQUIVO DE BACKUP DO SERVIDOR
 */
backupRouter.delete('/:filename', (req, res) => {
  const { filename } = req.params;
  const deleted = deleteStoredBackup(filename);

  if (deleted) {
    res.json({ sucesso: true, mensagem: `Backup "${filename}" excluído com sucesso.` });
  } else {
    res.status(404).json({ sucesso: false, mensagem: 'Arquivo de backup não encontrado para exclusão.' });
  }
});

/**
 * 6. RESTAURAÇÃO COMPLETA A PARTIR DE PAYLOAD DE BACKUP
 * Recebe o JSON baixado pelo usuário ou restaurado diretamente de um arquivo salvo
 */
backupRouter.post('/restore', (req, res) => {
  const adminId = (req.headers['x-user-id'] as string) || 'prof_jose_brandt';
  let payload = req.body;

  // Suporte a payload encapsulado em { backup: ... } ou payload direto
  if (payload.backup) {
    payload = typeof payload.backup === 'string' ? JSON.parse(payload.backup) : payload.backup;
  }

  // Se o usuário enviou um nome de arquivo salvo no servidor em { filename: '...' }
  if (payload.filename && !payload.dados) {
    const safeName = path.basename(payload.filename);
    const filePath = path.resolve(process.cwd(), 'data', 'backups', safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ sucesso: false, mensagem: 'Arquivo de backup selecionado não existe no servidor.' });
    }
    payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  try {
    const resultado = restoreDatabaseFromPayload(payload, adminId);
    res.json(resultado);
  } catch (err: any) {
    res.status(400).json({ sucesso: false, mensagem: err?.message || 'Erro durante a restauração do backup.' });
  }
});

/**
 * 7. CONFIGURAÇÃO DE BACKUPS AUTOMÁTICOS
 */
backupRouter.get('/config', (req, res) => {
  const config = getBackupConfig();
  res.json({ sucesso: true, config });
});

backupRouter.post('/config', (req, res) => {
  const { enabled, horarios, max_arquivos, destino_automatico, drive_folder_id, drive_folder_name } = req.body || {};
  const updated = saveBackupConfig({
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
    horarios: Array.isArray(horarios) ? horarios : undefined,
    max_arquivos: typeof max_arquivos === 'number' ? max_arquivos : undefined,
    destino_automatico: ['local', 'google_drive', 'ambos'].includes(destino_automatico) ? destino_automatico : undefined,
    drive_folder_id: drive_folder_id !== undefined ? drive_folder_id : undefined,
    drive_folder_name: drive_folder_name !== undefined ? drive_folder_name : undefined,
  });

  res.json({
    sucesso: true,
    mensagem: 'Configurações de backup salvas com sucesso!',
    config: updated,
  });
});
