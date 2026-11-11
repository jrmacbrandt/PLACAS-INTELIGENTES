/**
 * Utilitários Universais de Máscaras e Formatação Padrão Brasil (Atelier das Placas)
 */

/**
 * Máscara dinâmica de Telefone / WhatsApp: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function maskPhone(value: string = ''): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Máscara dinâmica de CPF / CNPJ: 000.000.000-00 (até 11) ou 00.000.000/0000-00 (até 14)
 */
export function maskCpfCnpj(value: string = ''): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';

  if (digits.length <= 11) {
    // Formato CPF
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  // Formato CNPJ
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Máscara de CEP: 00000-000
 */
export function maskCep(value: string = ''): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Formatação de Moeda Brasileira: R$ 0,00
 */
export function formatCurrency(value: number | string = 0): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : Number(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formatação inteligente de código de placa PLK:
 * Se o usuário digitar "1", converte para "PLK-000001".
 * Se digitar "PLK-000001", mantém.
 * Se digitar "7", converte para "PLK-000007".
 */
export function formatPlkCode(value: string = ''): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  // Se já tiver formato PLK-XXXXXX ou algo similar
  const matchPlk = /^plk[-_ ]?(\d+)$/i.exec(trimmed);
  if (matchPlk) {
    const num = parseInt(matchPlk[1], 10);
    return `PLK-${String(num).padStart(6, '0')}`;
  }

  // Se for apenas número
  const onlyDigits = trimmed.replace(/\D/g, '');
  if (onlyDigits && /^\d+$/.test(trimmed)) {
    const num = parseInt(onlyDigits, 10);
    if (!isNaN(num) && num > 0) {
      return `PLK-${String(num).padStart(6, '0')}`;
    }
  }

  return trimmed.toUpperCase();
}

/**
 * Sanitiza campos numéricos ao digitar (permite apagar até ficar vazio sem travar em 0)
 */
export function parseEmptyableInteger(raw: string, fallbackDefault?: number): number | '' {
  if (raw === '' || raw === undefined || raw === null) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  const val = parseInt(digits, 10);
  return isNaN(val) ? (fallbackDefault !== undefined ? fallbackDefault : '') : val;
}
