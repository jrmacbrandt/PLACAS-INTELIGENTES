import { db } from '../db.js';
import type { PricingTier } from '../types.js';

export interface PricingCalculationResult {
  preco_unitario: number;
  quantidade: number;
  valor_total: number;
  regra_aplicada: 'preco_individual' | 'faixa_global';
  desconto_unitario: number;
}

/**
 * Motor de Cálculo de Preço de Aquisição (ADR 002 e Seção 8.3)
 * Executado estritamente no backend.
 */
export function calculateOrderPrice(revendedorId: string, quantidade: number): PricingCalculationResult {
  if (quantidade < 1) {
    throw new Error('A quantidade mínima de placas para pedido é 1.');
  }

  // 1. Faixas individuais por quantidade (prioridade máxima) ou preço individual fixo (ADR 002)
  const profile = db.prepare('SELECT preco_individual, faixas_preco_individual FROM profiles WHERE id = ?').get(revendedorId) as
    | { preco_individual: number | null; faixas_preco_individual: string | null }
    | undefined;

  if (profile?.faixas_preco_individual) {
    try {
      const custom = JSON.parse(profile.faixas_preco_individual) as Array<{ quantidade_minima: number; quantidade_maxima: number | null; preco_unitario: number }>;
      const match = custom
        .slice()
        .sort((a, b) => a.quantidade_minima - b.quantidade_minima)
        .find((t) => quantidade >= t.quantidade_minima && (t.quantidade_maxima === null || quantidade <= t.quantidade_maxima));
      if (match && Number(match.preco_unitario) > 0) {
        const precoUnitario = Number(match.preco_unitario);
        return {
          preco_unitario: precoUnitario,
          quantidade,
          valor_total: Number((precoUnitario * quantidade).toFixed(2)),
          regra_aplicada: 'preco_individual',
          desconto_unitario: 0,
        };
      }
    } catch {}
  }

  if (profile && profile.preco_individual !== null && profile.preco_individual > 0) {
    const precoUnitario = Number(profile.preco_individual);
    return {
      preco_unitario: precoUnitario,
      quantidade,
      valor_total: Number((precoUnitario * quantidade).toFixed(2)),
      regra_aplicada: 'preco_individual',
      desconto_unitario: 0,
    };
  }

  // 2. Consulta tabela de faixas globais ordenadas (1-9: 21.90, 10-49: 19.90, 50+: 17.90)
  const tiers = db.prepare('SELECT * FROM pricing_tiers WHERE ativo = 1 ORDER BY quantidade_minima ASC').all() as unknown as PricingTier[];
  
  let appliedPrice = 21.90; // Default base
  for (const tier of tiers) {
    if (quantidade >= tier.quantidade_minima) {
      if (tier.quantidade_maxima === null || quantidade <= tier.quantidade_maxima) {
        appliedPrice = Number(tier.preco_unitario);
        break;
      }
    }
  }

  const basePrice = 21.90;
  const descontoUnitario = Number((basePrice - appliedPrice).toFixed(2));

  return {
    preco_unitario: appliedPrice,
    quantidade,
    valor_total: Number((appliedPrice * quantidade).toFixed(2)),
    regra_aplicada: 'faixa_global',
    desconto_unitario: Math.max(0, descontoUnitario),
  };
}
