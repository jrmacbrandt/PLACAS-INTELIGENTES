import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializa o Firebase apenas uma vez
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
// Força exibição da lista de contas para o usuário escolher com 1 clique
provider.setCustomParameters({
  prompt: 'select_account',
});

let cachedAccessToken: string | null = null;
let cachedDriveUser: { email: string | null; name: string | null; photoURL: string | null } | null = null;

// Salva token e usuário temporariamente na sessão para persistir durante navegação na aba
try {
  const savedToken = sessionStorage.getItem('atelier_drive_token');
  const savedUser = sessionStorage.getItem('atelier_drive_user');
  if (savedToken) cachedAccessToken = savedToken;
  if (savedUser) cachedDriveUser = JSON.parse(savedUser);
} catch {}

export interface DriveFolder {
  id: string;
  name: string;
  createdTime?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime?: string;
  webViewLink?: string;
}

/**
 * Login com 1 clique permitindo escolher uma conta Google na lista
 */
export async function connectGoogleDrive(): Promise<{
  accessToken: string;
  user: { email: string | null; name: string | null; photoURL: string | null };
}> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    cachedDriveUser = {
      email: result.user.email,
      name: result.user.displayName,
      photoURL: result.user.photoURL,
    };

    try {
      sessionStorage.setItem('atelier_drive_token', cachedAccessToken);
      sessionStorage.setItem('atelier_drive_user', JSON.stringify(cachedDriveUser));
    } catch {}

    return {
      accessToken: cachedAccessToken,
      user: cachedDriveUser,
    };
  } catch (err: any) {
    console.error('[DRIVE_AUTH_ERROR]', err);
    throw new Error(err?.message || 'Falha ao autenticar com a conta Google.');
  }
}

/**
 * Desconecta a conta do Google Drive
 */
export async function disconnectGoogleDrive() {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  cachedDriveUser = null;
  try {
    sessionStorage.removeItem('atelier_drive_token');
    sessionStorage.removeItem('atelier_drive_user');
  } catch {}
}

export function getCachedDriveSession() {
  return {
    token: cachedAccessToken,
    user: cachedDriveUser,
    isConnected: Boolean(cachedAccessToken && cachedDriveUser),
  };
}

/**
 * Lista as pastas acessíveis no Google Drive
 */
export async function listDriveFolders(token: string): Promise<DriveFolder[]> {
  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime)&orderBy=name&pageSize=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ${res.status} ao listar pastas do Google Drive.`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Cria uma nova pasta no Google Drive
 */
export async function createDriveFolder(token: string, folderName: string): Promise<DriveFolder> {
  const url = 'https://www.googleapis.com/drive/v3/files';
  const body = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ${res.status} ao criar pasta no Google Drive.`);
  }

  const data = await res.json();
  return { id: data.id, name: data.name };
}

/**
 * Faz upload do arquivo de backup (.json) para a pasta escolhida no Google Drive
 */
export async function uploadBackupToDriveFolder(
  token: string,
  folderId: string,
  filename: string,
  backupContent: object | string
): Promise<DriveFile> {
  const fileData = typeof backupContent === 'string' ? backupContent : JSON.stringify(backupContent, null, 2);

  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json',
    description: 'Backup completo do sistema Atelier das Placas (QR Code Dinâmico e NFC)',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileData +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,createdTime,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ${res.status} ao enviar backup para o Google Drive.`);
  }

  return await res.json();
}

/**
 * Lista os arquivos de backup salvos dentro da pasta específica no Google Drive
 */
export async function listBackupsInDriveFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,webViewLink)&orderBy=createdTime desc&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ${res.status} ao consultar arquivos no Google Drive.`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Baixa o conteúdo do arquivo de backup do Google Drive para restauração
 */
export async function downloadBackupContentFromDrive(token: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Erro ao baixar arquivo do Google Drive: HTTP ${res.status}`);
  }

  return await res.json();
}

/**
 * Exclui um arquivo do Google Drive (com confirmação)
 */
export async function deleteDriveFile(token: string, fileId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ao excluir arquivo do Google Drive: HTTP ${res.status}`);
  }

  return true;
}

/**
 * Gerencia a retenção automática na pasta do Google Drive:
 * Remove os arquivos mais antigos se a contagem ultrapassar maxFiles
 */
export async function cleanOldDriveBackups(token: string, folderId: string, maxFiles: number) {
  try {
    const files = await listBackupsInDriveFolder(token, folderId);
    if (files.length > maxFiles) {
      // Ordena por data (os mais antigos ficam no final)
      const toDelete = files.slice(maxFiles);
      for (const f of toDelete) {
        await deleteDriveFile(token, f.id);
      }
    }
  } catch (err) {
    console.error('[DRIVE_RETENTION_ERROR]', err);
  }
}
