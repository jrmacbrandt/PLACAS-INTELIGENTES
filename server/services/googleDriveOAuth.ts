export interface GoogleTokenBundle {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  expires_at: string;
}

export interface GoogleDriveUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Constrói a URL oficial de consentimento offline da Google (garante envio de refresh_token)
 */
export function buildGoogleDriveAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_DRIVE_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline'); // Garante que a Google entregue o refresh_token permanente
  url.searchParams.set('prompt', 'consent');      // Força tela de consentimento para emissão do refresh_token
  if (params.state) {
    url.searchParams.set('state', params.state);
  }
  return url.toString();
}

/**
 * Troca o authorization code pelo access_token e pelo refresh_token permanente
 */
export async function exchangeGoogleDriveCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenBundle> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Erro HTTP ${response.status} ao trocar código da Google.`);
  }

  const expiresInSec = Number(data.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: expiresInSec,
    token_type: data.token_type || 'Bearer',
    scope: data.scope || '',
    expires_at: expiresAt,
  };
}

/**
 * Renova o access_token utilizando o refresh_token permanente (VITALÍCIO)
 */
export async function refreshGoogleDriveAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ access_token: string; expires_at: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Falha ao renovar token da Google (${response.status}).`);
  }

  const expiresInSec = Number(data.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  return {
    access_token: data.access_token,
    expires_at: expiresAt,
    expires_in: expiresInSec,
  };
}

/**
 * Obtém os dados do perfil do usuário na Google
 */
export async function fetchGoogleDriveUserInfo(accessToken: string): Promise<GoogleDriveUser> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter perfil Google (${res.status}).`);
  }
  const data = await res.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name || data.email,
    picture: data.picture,
  };
}

/**
 * Cria ou busca pasta específica no Google Drive
 */
export async function findOrCreateGoogleDriveFolder(
  accessToken: string,
  folderName = 'Atelier das Placas - Backups'
): Promise<{ id: string; name: string }> {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const listRes = await fetch(`${GOOGLE_DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
      return listData.files[0];
    }
  }

  // Cria a pasta se não existir
  const createRes = await fetch(`${GOOGLE_DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Erro ao criar pasta "${folderName}" no Google Drive.`);
  }

  return await createRes.json();
}

/**
 * Faz o upload de um arquivo de backup estruturado diretamente no Google Drive via API
 */
export async function uploadBackupToGoogleDriveFolder(params: {
  accessToken: string;
  folderId: string;
  filename: string;
  payload: any;
}): Promise<{ id: string; name: string; size?: string }> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: params.filename,
    mimeType: 'application/json',
    parents: [params.folderId],
  };

  const jsonContent = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload, null, 2);

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro ${res.status} ao enviar arquivo para o Google Drive.`);
  }

  return await res.json();
}

/**
 * Aplica retenção de backups na pasta do Google Drive (exclui os mais antigos além do limite)
 */
export async function cleanOldGoogleDriveBackups(params: {
  accessToken: string;
  folderId: string;
  maxFiles: number;
}): Promise<number> {
  const query = encodeURIComponent(`'${params.folderId}' in parents and trashed = false`);
  const url = `${GOOGLE_DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });

  if (!res.ok) return 0;
  const data = await res.json();
  const files = data.files || [];

  if (files.length <= params.maxFiles) return 0;

  const toDelete = files.slice(params.maxFiles);
  let deletedCount = 0;
  for (const f of toDelete) {
    try {
      await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${f.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      deletedCount++;
    } catch {}
  }
  return deletedCount;
}
