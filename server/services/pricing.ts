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

  // 1. Verifica se o revendedor possui preço individual ativo (ADR 002)
  const profile = db.prepare('SELECT preco_individual FROM profiles WHERE id = ?').get(revendedorId) as { preco_individual: number | null } | undefined;
  
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
