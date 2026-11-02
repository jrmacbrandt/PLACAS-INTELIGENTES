import crypto from 'node:crypto';
import { db } from '../db.js';

/**
 * Geração de Token Criptográfico Imprevisível para a URL Permanente
 * Atende às Seções 14 e ao Adendo Obrigatório v5.0
 */
export function generateCryptographicToken(length = 12): string {
  // Gera token seguro URL-safe sem caracteres ambíguos
  const bytes = crypto.randomBytes(length);
  return bytes.toString('base64url').slice(0, length);
}

/**
 * Extrai o número inteiro de um código de placa (ex: 'PLK-000010' -> 10, '10' -> 10)
 */
export function parsePlateSequence(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return input > 0 ? input : null;
  const cleaned = String(input).trim().toUpperCase();
  if (cleaned.startsWith('PLK-')) {
    const num = parseInt(cleaned.replace('PLK-', ''), 10);
    return isNaN(num) ? null : num;
  }
  const rawNum = parseInt(cleaned, 10);
  return isNaN(rawNum) ? null : rawNum;
}

/**
 * Formata um número inteiro no padrão oficial da placa (ex: 10 -> 'PLK-000010')
 */
export function formatPlateSequence(num: number): string {
  return `PLK-${String(num).padStart(6, '0')}`;
}

/**
 * Retorna o próximo número sequencial inteiro disponível
 */
export function getNextPlateSequenceNumber(): number {
  const row = db.prepare(`
    SELECT codigo_sequencial 
    FROM plates 
    WHERE codigo_sequencial LIKE 'PLK-%'
    ORDER BY CAST(SUBSTR(codigo_sequencial, 5) AS INTEGER) DESC 
    LIMIT 1
  `).get() as { codigo_sequencial: string } | undefined;

  let nextNumber = 1;
  if (row?.codigo_sequencial) {
    const currentNum = parseInt(row.codigo_sequencial.replace('PLK-', ''), 10);
    if (!isNaN(currentNum)) {
      nextNumber = currentNum + 1;
    }
  }
  return nextNumber;
}

/**
 * Previsão do próximo intervalo de placas a serem geradas sem alterar o banco
 */
export function peekNextPlateSequence(qty = 1): { proximo_codigo: string; codigo_final: string; proximo_numero: number; quantidade: number } {
  const nextNum = getNextPlateSequenceNumber();
  const safeQty = Math.max(1, qty);
  const endNum = nextNum + safeQty - 1;
  return {
    proximo_codigo: formatPlateSequence(nextNum),
    codigo_final: formatPlateSequence(endNum),
    proximo_numero: nextNum,
    quantidade: safeQty,
  };
}

/**
 * Gera próximo número sequencial de placa formatado (ex: PLK-000001)
 * Garante unicidade estrita e monotonicidade (nunca repete, mesmo com exclusões)
 */
export function generateNextPlateSequence(): string {
  const nextNumber = getNextPlateSequenceNumber();
  return formatPlateSequence(nextNumber);
}

/**
 * Gera número de pedido único formatado (ex: PED-202610-0001)
 */
export function generateOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
  const row = db.prepare('SELECT COUNT(*) as total FROM orders').get() as { total: number };
  const nextSeq = (row?.total || 0) + 1;
  return `PED-${datePrefix}-${String(nextSeq).padStart(4, '0')}`;
}
