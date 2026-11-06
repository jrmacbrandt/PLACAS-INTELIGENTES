import { getCurrentUserId } from '../api.js';

async function backupRequest<T>(action: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/backup?action=${action}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': getCurrentUserId(),
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.sucesso) {
    throw new Error(data?.mensagem || `Falha no backup em nuvem (HTTP ${res.status}).`);
  }
  return data as T;
}

/** Cria o backup no servidor, grava no Supabase (Storage + registro) e devolve o conteudo. */
export async function createSupabaseBackup(origem: 'manual' | 'automatico' = 'manual') {
  const data = await backupRequest<{ backup: { filename: string }; payload: any }>('create', {
    method: 'POST',
    body: JSON.stringify({ origem }),
  });
  return { filename: data.backup.filename, payload: data.payload };
}

/** Registra no Supabase que o backup foi enviado ao Google Drive. */
export async function markBackupSentToDrive(filename: string, driveFileId?: string, driveFolderName?: string | null) {
  await backupRequest('mark-drive', {
    method: 'POST',
    body: JSON.stringify({ filename, drive_file_id: driveFileId, drive_folder_name: driveFolderName }),
  });
}
