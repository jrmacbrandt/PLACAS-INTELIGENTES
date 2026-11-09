import type { IntegrationSettings, PackageCalculationResult, ShippingOption } from '../types.js';

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  // 1. Asaas
  asaas_env: 'sandbox',
  asaas_api_key: '',
  asaas_webhook_token: '',
  asaas_wallet_id: '',
  asaas_dias_vencimento: 3,
  asaas_sandbox_api_key: '',
  asaas_sandbox_webhook_token: '',
  asaas_sandbox_wallet_id: '',
  asaas_production_api_key: '',
  asaas_production_webhook_token: '',
  asaas_production_wallet_id: '',

  // 2. Melhor Envio
  melhor_envio_env: 'sandbox',
  melhor_envio_token: '',
  melhor_envio_refresh_token: '',
  melhor_envio_token_expires_at: '',
  melhor_envio_client_id: '',
  melhor_envio_client_secret: '',
  melhor_envio_redirect_uri: '',
  melhor_envio_webhook_secret: '',
  melhor_envio_sandbox_token: '',
  melhor_envio_sandbox_refresh_token: '',
  melhor_envio_sandbox_token_expires_at: '',
  melhor_envio_sandbox_client_id: '',
  melhor_envio_sandbox_client_secret: '',
  melhor_envio_sandbox_redirect_uri: '',
  melhor_envio_sandbox_webhook_secret: '',
  melhor_envio_production_token: '',
  melhor_envio_production_refresh_token: '',
  melhor_envio_production_token_expires_at: '',
  melhor_envio_production_client_id: '',
  melhor_envio_production_client_secret: '',
  melhor_envio_production_redirect_uri: '',
  melhor_envio_production_webhook_secret: '',
  melhor_envio_scopes: 'shipping-calculate shipping-checkout shipping-generate shipping-print shipping-tracking shipping-cancel cart-write cart-read users-read',
  melhor_envio_user_agent: 'AtelierDasPlacas (suporte@atelierdasplacas.com.br)',
  melhor_envio_servicos: '1,2,3,4,17',
  melhor_envio_dias_producao: 0,
  melhor_envio_frete_gratis_min_placas: 20,
  melhor_envio_seguro_automatico: true,
  melhor_envio_non_commercial: true,
  melhor_envio_receipt: false,
  melhor_envio_own_hand: false,

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
  gemini_model: 'gemini-3.5-flash',
  gemini_auto_preencher: true,

  // 4. WhatsApp & Atendimento
  whatsapp_empresa: '5521980914107',
};

/**
 * Sincroniza e isola as credenciais de Sandbox e Produção para Melhor Envio e Asaas.
 * Caso um modo não tenha sido preenchido, seus campos permanecem em branco ('').
 * Os campos ativos (melhor_envio_token, asaas_api_key, etc.) sempre refletem o modo selecionado.
 */
export function hydrateModeSpecificSettings(saved: Partial<IntegrationSettings> = {}): IntegrationSettings {
  const meEnv: 'sandbox' | 'production' = saved.melhor_envio_env === 'production' ? 'production' : 'sandbox';
  const asaasEnv: 'sandbox' | 'production' = saved.asaas_env === 'production' ? 'production' : 'sandbox';

  const hasMeSplit =
    saved.melhor_envio_sandbox_token !== undefined ||
    saved.melhor_envio_production_token !== undefined ||
    saved.melhor_envio_sandbox_client_id !== undefined ||
    saved.melhor_envio_production_client_id !== undefined;

  const meSandboxToken = hasMeSplit
    ? (saved.melhor_envio_sandbox_token ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_token ?? '') : '');
  const meSandboxRefresh = hasMeSplit
    ? (saved.melhor_envio_sandbox_refresh_token ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_refresh_token ?? '') : '');
  const meSandboxExpires = hasMeSplit
    ? (saved.melhor_envio_sandbox_token_expires_at ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_token_expires_at ?? '') : '');
  const meSandboxClientId = hasMeSplit
    ? (saved.melhor_envio_sandbox_client_id ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_client_id ?? '') : '');
  const meSandboxClientSecret = hasMeSplit
    ? (saved.melhor_envio_sandbox_client_secret ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_client_secret ?? '') : '');
  const meSandboxRedirectUri = hasMeSplit
    ? (saved.melhor_envio_sandbox_redirect_uri ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_redirect_uri ?? '') : '');
  const meSandboxWebhookSecret = hasMeSplit
    ? (saved.melhor_envio_sandbox_webhook_secret ?? '')
    : (meEnv === 'sandbox' ? (saved.melhor_envio_webhook_secret ?? '') : '');

  const meProdToken = hasMeSplit
    ? (saved.melhor_envio_production_token ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_token ?? '') : '');
  const meProdRefresh = hasMeSplit
    ? (saved.melhor_envio_production_refresh_token ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_refresh_token ?? '') : '');
  const meProdExpires = hasMeSplit
    ? (saved.melhor_envio_production_token_expires_at ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_token_expires_at ?? '') : '');
  const meProdClientId = hasMeSplit
    ? (saved.melhor_envio_production_client_id ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_client_id ?? '') : '');
  const meProdClientSecret = hasMeSplit
    ? (saved.melhor_envio_production_client_secret ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_client_secret ?? '') : '');
  const meProdRedirectUri = hasMeSplit
    ? (saved.melhor_envio_production_redirect_uri ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_redirect_uri ?? '') : '');
  const meProdWebhookSecret = hasMeSplit
    ? (saved.melhor_envio_production_webhook_secret ?? '')
    : (meEnv === 'production' ? (saved.melhor_envio_webhook_secret ?? '') : '');

  const hasAsaasSplit =
    saved.asaas_sandbox_api_key !== undefined ||
    saved.asaas_production_api_key !== undefined ||
    saved.asaas_sandbox_webhook_token !== undefined ||
    saved.asaas_production_webhook_token !== undefined ||
    saved.asaas_sandbox_wallet_id !== undefined ||
    saved.asaas_production_wallet_id !== undefined;

  const asaasSandboxKey = hasAsaasSplit
    ? (saved.asaas_sandbox_api_key ?? '')
    : (asaasEnv === 'sandbox' ? (saved.asaas_api_key ?? '') : '');
  const asaasSandboxWebhook = hasAsaasSplit
    ? (saved.asaas_sandbox_webhook_token ?? '')
    : (asaasEnv === 'sandbox' ? (saved.asaas_webhook_token ?? '') : '');
  const asaasSandboxWallet = hasAsaasSplit
    ? (saved.asaas_sandbox_wallet_id ?? '')
    : (asaasEnv === 'sandbox' ? (saved.asaas_wallet_id ?? '') : '');

  const asaasProdKey = hasAsaasSplit
    ? (saved.asaas_production_api_key ?? '')
    : (asaasEnv === 'production' ? (saved.asaas_api_key ?? '') : '');
  const asaasProdWebhook = hasAsaasSplit
    ? (saved.asaas_production_webhook_token ?? '')
    : (asaasEnv === 'production' ? (saved.asaas_webhook_token ?? '') : '');
  const asaasProdWallet = hasAsaasSplit
    ? (saved.asaas_production_wallet_id ?? '')
    : (asaasEnv === 'production' ? (saved.asaas_wallet_id ?? '') : '');

  const merged: IntegrationSettings = {
    ...DEFAULT_INTEGRATION_SETTINGS,
    ...saved,
    melhor_envio_env: meEnv,
    melhor_envio_sandbox_token: meSandboxToken,
    melhor_envio_sandbox_refresh_token: meSandboxRefresh,
    melhor_envio_sandbox_token_expires_at: meSandboxExpires,
    melhor_envio_sandbox_client_id: meSandboxClientId,
    melhor_envio_sandbox_client_secret: meSandboxClientSecret,
    melhor_envio_sandbox_redirect_uri: meSandboxRedirectUri,
    melhor_envio_sandbox_webhook_secret: meSandboxWebhookSecret,
    melhor_envio_production_token: meProdToken,
    melhor_envio_production_refresh_token: meProdRefresh,
    melhor_envio_production_token_expires_at: meProdExpires,
    melhor_envio_production_client_id: meProdClientId,
    melhor_envio_production_client_secret: meProdClientSecret,
    melhor_envio_production_redirect_uri: meProdRedirectUri,
    melhor_envio_production_webhook_secret: meProdWebhookSecret,
    melhor_envio_token: meEnv === 'production' ? meProdToken : meSandboxToken,
    melhor_envio_refresh_token: meEnv === 'production' ? meProdRefresh : meSandboxRefresh,
    melhor_envio_token_expires_at: meEnv === 'production' ? meProdExpires : meSandboxExpires,
    melhor_envio_client_id: meEnv === 'production' ? meProdClientId : meSandboxClientId,
    melhor_envio_client_secret: meEnv === 'production' ? meProdClientSecret : meSandboxClientSecret,
    melhor_envio_redirect_uri: meEnv === 'production' ? meProdRedirectUri : meSandboxRedirectUri,
    melhor_envio_webhook_secret: meEnv === 'production' ? meProdWebhookSecret : meSandboxWebhookSecret,
    asaas_env: asaasEnv,
    asaas_sandbox_api_key: asaasSandboxKey,
    asaas_sandbox_webhook_token: asaasSandboxWebhook,
    asaas_sandbox_wallet_id: asaasSandboxWallet,
    asaas_production_api_key: asaasProdKey,
    asaas_production_webhook_token: asaasProdWebhook,
    asaas_production_wallet_id: asaasProdWallet,
    asaas_api_key: asaasEnv === 'production' ? asaasProdKey : asaasSandboxKey,
    asaas_webhook_token: asaasEnv === 'production' ? asaasProdWebhook : asaasSandboxWebhook,
    asaas_wallet_id: asaasEnv === 'production' ? asaasProdWallet : asaasSandboxWallet,
  };

  return merged;
}

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
  pkg: PackageCalculationResult,
  diasProducao = 0
): ShippingOption[] {
  const extraProducao = Math.max(0, Math.floor(Number(diasProducao) || 0));
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
  const jadlogPackageDias = Math.max(2, diasBase + 1) + extraProducao;

  const loggiPreco = Math.max(14.5, 15.2 * regiaoFator + pesoAdicional);
  const loggiDias = Math.max(2, diasBase) + extraProducao;

  const pacPreco = Math.max(17.9, 18.5 * regiaoFator + pesoAdicional * 1.15);
  const pacDias = Math.max(3, diasBase + 2) + extraProducao;

  const sedexPreco = Math.max(23.9, 26.0 * regiaoFator + pesoAdicional * 1.6);
  const sedexDias = Math.max(1, Math.ceil(diasBase / 2)) + extraProducao;

  const jadlogComPreco = Math.max(21.5, 23.5 * regiaoFator + pesoAdicional * 1.3);
  const jadlogComDias = Math.max(2, Math.ceil(diasBase / 2) + 1) + extraProducao;

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

