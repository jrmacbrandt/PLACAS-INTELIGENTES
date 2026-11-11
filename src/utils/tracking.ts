/**
 * Utilitário de rastreamento de encomendas
 * Direciona para o portal oficial correto de acordo com a transportadora ou código
 */
export function getOfficialTrackingUrl(code: string, carrierName?: string | null): string {
  if (!code) return '#';
  const cleanCode = code.trim().toUpperCase();
  const carrier = (carrierName || '').toLowerCase();

  // Verifica se segue o padrão oficial dos Correios (ex: 2 letras + 9 dígitos + 2 letras ou termina com BR)
  const isCorreiosPattern =
    /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(cleanCode) ||
    cleanCode.endsWith('BR') ||
    cleanCode.startsWith('OG') ||
    cleanCode.startsWith('NL') ||
    cleanCode.startsWith('QB');

  const isCorreiosCarrier =
    carrier.includes('correio') ||
    carrier.includes('sedex') ||
    carrier.includes('pac');

  if (isCorreiosPattern || (isCorreiosCarrier && !cleanCode.startsWith('JAD'))) {
    return `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(cleanCode)}`;
  }

  // Se for Jadlog (código iniciando com JAD ou nome Jadlog)
  if (cleanCode.startsWith('JAD') || carrier.includes('jadlog')) {
    // Melhor Rastreio é a plataforma oficial que consulta em tempo real a remessa Jadlog do Melhor Envio
    return `https://melhorrastreio.com.br/rastreio/${encodeURIComponent(cleanCode)}`;
  }

  // Se for Loggi
  if (carrier.includes('loggi')) {
    return `https://www.loggi.com/rastreador/${encodeURIComponent(cleanCode)}`;
  }

  // Se for Azul Cargo Express
  if (carrier.includes('azul')) {
    return `https://www.azulcargoexpress.com.br/Rastreio/RastrearObjeto?codigo=${encodeURIComponent(cleanCode)}`;
  }

  // Padrão universal para transportadoras parceiras e Melhor Envio
  return `https://melhorrastreio.com.br/rastreio/${encodeURIComponent(cleanCode)}`;
}
