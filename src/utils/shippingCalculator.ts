import type { IntegrationSettings, PackageCalculationResult, ShippingOption } from '../types.js';

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  // 1. Asaas
  asaas_env: 'sandbox',
  asaas_api_key: '',
  asaas_webhook_token: '',
  asaas_wallet_id: '',
  asaas_dias_vencimento: 3,

  // 2. Melhor Envio
  melhor_envio_env: 'sandbox',
  melhor_envio_token: '',
  melhor_envio_user_agent: 'AtelierDasPlacas (suporte@atelierdasplacas.com.br)',
  melhor_envio_servicos: '1,2,3,4,17',
  melhor_envio_seguro_automatico: true,

  // Dados do Remetente (Origem do Atelier)
  origem_nome: 'Atelier das Placas',
  origem_cpf_cnpj: '06865841719',
  origem_telefone: '21980914107',
  origem_email: 'jrmacbrandt@gmail.com',
  origem_cep: '22745-271',
  origem_logradouro: 'Rua Araguaia',
  origem_numero: '1111',
  origem_complemento: 'Apto 403',
  origem_bairro: 'Freguesia (Jacarepaguá)',
  origem_cidade: 'Rio de Janeiro',
  origem_uf: 'RJ',

  // Parâmetros Físicos da Placa Unitária
  placa_peso_kg: 0.06,        // 60g por placa
  placa_largura_cm: 10,       // 10cm
  placa_comprimento_cm: 15,   // 15cm
  placa_espessura_cm: 0.4,    // 4mm por placa com proteção

  // Parâmetros Físicos das Caixas / Embalagens
  embalagem_tara_kg: 0.10,            // 100g da caixa + plástico bolha
  caixa_padrao_max_placas: 30,        // Até 30 placas usa Caixa Padrão
  caixa_padrao_largura_cm: 14,
  caixa_padrao_comprimento_cm: 18,
  caixa_padrao_altura_min_cm: 4,
  caixa_padrao_folga_altura_cm: 3,
  caixa_grande_largura_cm: 22,
  caixa_grande_comprimento_cm: 30,
  caixa_grande_altura_min_cm: 8,
  caixa_altura_max_cm: 60,

  // 3. Google Gemini AI
  gemini_api_key: '',
  gemini_model: 'gemini-2.5-flash',
  gemini_auto_preencher: true,

  // 4. WhatsApp & Atendimento
  whatsapp_empresa: '5521980914107',
};

/**
 * Calcula peso total e dimensões da caixa com base nas configurações dinâmicas de placas e embalagens.
 */
export function calculateDynamicPackage(
  quantidade: number,
  cfg: Partial<IntegrationSettings> = {}
): PackageCalculationResult {
  const s = { ...DEFAULT_INTEGRATION_SETTINGS, ...cfg };
  const qty = Math.max(1, Number(quantidade) || 1);

  const placaPeso = Math.max(0.005, Number(s.placa_peso_kg) || 0.06);
  const taraPeso = Math.max(0, Number(s.embalagem_tara_kg) || 0.1);
  const platesWeight = Number((qty * placaPeso).toFixed(3));
  const totalWeight = Math.max(0.1, Number((platesWeight + taraPeso).toFixed(2)));

  const limitePadrao = Math.max(1, Number(s.caixa_padrao_max_placas) || 30);
  const espessura = Math.max(0.1, Number(s.placa_espessura_cm) || 0.4);
  const folgaAltura = Math.max(0, Number(s.caixa_padrao_folga_altura_cm) || 3);
  const alturaMax = Math.max(10, Number(s.caixa_altura_max_cm) || 60);

  const isGrande = qty > limitePadrao;
  const alturaMin = isGrande
    ? Math.max(4, Number(s.caixa_grande_altura_min_cm) || 8)
    : Math.max(2, Number(s.caixa_padrao_altura_min_cm) || 4);

  // Na caixa grande as placas podem ser acomodadas em 2 pilhas lado a lado
  const pilhas = isGrande ? 2 : 1;
  const placasPorPilha = Math.ceil(qty / pilhas);
  const alturaCalculada = Math.ceil(placasPorPilha * espessura + folgaAltura);
  const height = Math.max(alturaMin, Math.min(alturaMax, alturaCalculada));

  const width = isGrande
    ? Math.max(11, Number(s.caixa_grande_largura_cm) || 22)
    : Math.max(11, Number(s.caixa_padrao_largura_cm) || 14);

  const length = isGrande
    ? Math.max(16, Number(s.caixa_grande_comprimento_cm) || 30)
    : Math.max(16, Number(s.caixa_padrao_comprimento_cm) || 18);

  return {
    box_type: isGrande ? 'caixa_grande' : 'caixa_padrao',
    box_label: isGrande
      ? `Caixa Grande / Atacado (${width}x${length}x${height} cm)`
      : `Caixa Padrão (${width}x${length}x${height} cm)`,
    weight: totalWeight,
    height,
    width,
    length,
    plates_weight_kg: platesWeight,
    tare_weight_kg: taraPeso,
  };
}

export function markCheapestAndFastestOptions(options: ShippingOption[]): ShippingOption[] {
  if (options.length === 0) return options;

  let minPrice = Infinity;
  let minDays = Infinity;

  options.forEach((opt) => {
    if (opt.price < minPrice) minPrice = opt.price;
    if (opt.delivery_time < minDays) minDays = opt.delivery_time;
  });

  return options
    .map((opt) => ({
      ...opt,
      is_cheapest: opt.price === minPrice,
      is_fastest: opt.delivery_time === minDays && opt.price > minPrice,
    }))
    .sort((a, b) => a.price - b.price);
}

/**
 * Simulador regional calibrado com o peso e cubagem dinâmicos configurados pelo Administrador.
 */
export function calculateSimulatedShippingOptions(
  cepDestino: string,
  pkg: PackageCalculationResult
): ShippingOption[] {
  const cleanCep = (cepDestino || '').replace(/\D/g, '');
  const prefixo2 = parseInt(cleanCep.slice(0, 2) || '20', 10);

  let regiaoFator = 1.0;
  let diasBase = 3;

  if (prefixo2 >= 20 && prefixo2 <= 28) {
    regiaoFator = 0.85;
    diasBase = 2;
  } else if (prefixo2 >= 1 && prefixo2 <= 19) {
    regiaoFator = 0.95;
    diasBase = 3;
  } else if (prefixo2 >= 30 && prefixo2 <= 39) {
    regiaoFator = 1.05;
    diasBase = 4;
  } else if (prefixo2 >= 80 && prefixo2 <= 99) {
    regiaoFator = 1.2;
    diasBase = 5;
  } else if (prefixo2 >= 70 && prefixo2 <= 79) {
    regiaoFator = 1.3;
    diasBase = 5;
  } else if (prefixo2 >= 40 && prefixo2 <= 59) {
    regiaoFator = 1.45;
    diasBase = 7;
  } else {
    regiaoFator = 1.7;
    diasBase = 9;
  }

  // Peso cubado padrão transportadora: (C * L * A) / 6000
  const pesoCubado = (pkg.length * pkg.width * pkg.height) / 6000;
  const pesoTaxavel = Math.max(pkg.weight, pesoCubado);
  const pesoAdicional = Math.max(0, pesoTaxavel - 0.5) * 4.2;

  const jadlogPackagePreco = Math.max(12.9, 13.5 * regiaoFator + pesoAdicional);
  const jadlogPackageDias = Math.max(2, diasBase + 1);

  const loggiPreco = Math.max(14.5, 15.2 * regiaoFator + pesoAdicional);
  const loggiDias = Math.max(2, diasBase);

  const pacPreco = Math.max(17.9, 18.5 * regiaoFator + pesoAdicional * 1.15);
  const pacDias = Math.max(3, diasBase + 2);

  const sedexPreco = Math.max(23.9, 26.0 * regiaoFator + pesoAdicional * 1.6);
  const sedexDias = Math.max(1, Math.ceil(diasBase / 2));

  const jadlogComPreco = Math.max(21.5, 23.5 * regiaoFator + pesoAdicional * 1.3);
  const jadlogComDias = Math.max(2, Math.ceil(diasBase / 2) + 1);

  const options: ShippingOption[] = [
    {
      service_id: 3,
      carrier_name: 'Jadlog',
      service_name: '.Package',
      price: Number(jadlogPackagePreco.toFixed(2)),
      original_price: Number((jadlogPackagePreco * 1.4).toFixed(2)),
      delivery_time: jadlogPackageDias,
    },
    {
      service_id: 17,
      carrier_name: 'Loggi',
      service_name: 'Express',
      price: Number(loggiPreco.toFixed(2)),
      original_price: Number((loggiPreco * 1.35).toFixed(2)),
      delivery_time: loggiDias,
    },
    {
      service_id: 1,
      carrier_name: 'Correios',
      service_name: 'PAC',
      price: Number(pacPreco.toFixed(2)),
      original_price: Number((pacPreco * 1.3).toFixed(2)),
      delivery_time: pacDias,
    },
    {
      service_id: 2,
      carrier_name: 'Correios',
      service_name: 'SEDEX',
      price: Number(sedexPreco.toFixed(2)),
      original_price: Number((sedexPreco * 1.25).toFixed(2)),
      delivery_time: sedexDias,
    },
    {
      service_id: 4,
      carrier_name: 'Jadlog',
      service_name: '.Com Expresso',
      price: Number(jadlogComPreco.toFixed(2)),
      original_price: Number((jadlogComPreco * 1.35).toFixed(2)),
      delivery_time: jadlogComDias,
    },
  ];

  return markCheapestAndFastestOptions(options);
}
