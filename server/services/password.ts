import crypto from 'node:crypto';

const FIXED_MASTER_SALT = 'atelier_master_v5_salt_2026';

/**
 * Gera hash criptográfico seguro (scrypt) para armazenamento de senhas.
 * Formato salvo no banco: `scrypt$<salt>$<hashHex>`
 */
export function hashPassword(password: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Gera hash determinístico para o seed inicial do Usuário Master
 */
export function hashMasterPassword(password: string): string {
  return hashPassword(password, FIXED_MASTER_SALT);
}

/**
 * Verifica de forma segura (timingSafeEqual) se a senha informada corresponde ao hash salvo
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !password) return false;

  try {
    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) return false;
      const [, salt, originalHash] = parts;
      const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
      const a = Buffer.from(originalHash, 'hex');
      const b = Buffer.from(derivedKey, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    }

    // Fallback caso exista texto simples legado
    return password === storedHash;
  } catch {
    return false;
  }
}

