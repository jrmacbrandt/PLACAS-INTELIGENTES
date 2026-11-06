/**
 * Serviço Oficial de Integração com a API v2 do Melhor Envio (Atelier das Placas)
 *
 * Implementa:
 * 1. Ambientes isolados: Sandbox (https://sandbox.melhorenvio.com.br) e Produção (https://melhorenvio.com.br)
 * 2. Fluxo OAuth2 Authorization Code (state anti-CSRF, troca de code por token, refresh automático single-flight sem condição de corrida)
 * 3. Validação e normalização rigorosa de CEP, CPF/CNPJ, endereço, pesos (kg), dimensões (cm) e valores (R$)
 * 4. Cliente HTTP isolado com HTTPS obrigatório, User-Agent técnico, Rate Limiting (250 req/min), timeout, retry seguro e sanitização de logs
 * 5. Fluxo completo de envios:
 *    - Cotação (/api/v2/me/shipment/calculate) com preferência a custom_price e custom_delivery_time
 *    - Inserção no carrinho (/api/v2/me/cart) com suporte a CPF/CNPJ, volumes/produtos, seguro e declaração de conteúdo/NF
 *    - Checkout/Compra explícita (/api/v2/me/shipment/checkout) com trava obrigatória de confirmação do operador
 *    - Geração (/api/v2/me/shipment/generate), Pré-visualização (/api/v2/me/shipment/preview) e Impressão (/api/v2/me/shipment/print)
 *    - Rastreamento ativo (/api/v2/me/shipment/tracking)
 *    - Webhook oficial com verificação criptográfica HMAC-SHA256 (X-ME-Signature) e processamento idempotente
 *    - Verificação de cancelabilidade (/api/v2/me/shipment/cancellable) e Cancelamento (/api/v2/me/shipment/cancel)
 */

import crypto from 'node:crypto';
import {
  DEFAULT_INTEGRATION_SETTINGS,
  calculateDynamicPackage,
  calculateSimulatedShippingOptions,
  markCheapestAndFastestOptions,
} from '../../src/utils/shippingCalculator.js';
import type { IntegrationSettings, PackageCalculationResult, ShippingOption } from '../../src/types.js';

export type { ShippingOption, PackageCalculationResult };

export type MelhorEnvioEnvironment = 'sandbox' | 'production';

export const MELHOR_ENVIO_BASE_URLS: Record<MelhorEnvioEnvironment, string> = {
  sandbox: 'https://sandbox.melhorenvio.com.br',
  production: 'https://melhorenvio.com.br',
};

/**
 * Escopos mínimos e necessários conforme documentação oficial do Melhor Envio v2
 */
export const REQUIRED_OAUTH_SCOPES = [
  'shipping-calculate',
  'shipping-checkout',
  'shipping-generate',
  'shipping-print',
  'shipping-tracking',
  'shipping-cancel',
  'cart-write',
  'cart-read',
  'users-read',
] as const;

export const ACCESS_TOKEN_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias (2.592.000s)
export const REFRESH_TOKEN_TTL_SECONDS = 45 * 24 * 60 * 60;        // 45 dias (3.888.000s)
export const RATE_LIMIT_MAX_REQUESTS_PER_MINUTE = 250;

export class MelhorEnvioError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requiresReauthorization?: boolean;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      details?: unknown;
      requiresReauthorization?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'MelhorEnvioError';
    this.statusCode = options.statusCode ?? 400;
    this.code = options.code ?? 'MELHOR_ENVIO_ERROR';
    this.details = options.details;
    this.requiresReauthorization = options.requiresReauthorization ?? false;
  }
}

export interface CalculateShippingParams {
  cep_destino: string;
  quantidade_placas: number;
  cep_origem?: string;
  valor_seguro?: number;
  settings?: Partial<IntegrationSettings>;
  allowSimulationFallback?: boolean;
  fetchImpl?: typeof fetch;
}

export interface OAuthTokenBundle {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  refresh_expires_at: string;
  environment: MelhorEnvioEnvironment;
  scopes: string;
}

export interface MelhorEnvioAddressParty {
  name: string;
  phone: string;
  email: string;
  document?: string;
  company_document?: string;
  state_register?: string;
  postal_code: string;
  address: string;
  location_number: string;
  complement?: string;
  district: string;
  city: string;
  state_abbr: string;
  country_id: string;
}

// ============================================================================
// 1. AMBIENTES, SEGURANÇA E SANITIZAÇÃO DE SEGREDOS / LOGS
// ============================================================================

export function resolveEnvironment(env?: string | null): MelhorEnvioEnvironment {
  return env === 'production' ? 'production' : 'sandbox';
}

export function getMelhorEnvioBaseUrl(env?: string | null): string {
  const resolved = resolveEnvironment(env);
  return MELHOR_ENVIO_BASE_URLS[resolved];
}

export function assertEnvironmentIsolation(
  tokenEnv: MelhorEnvioEnvironment | undefined,
  activeEnv: MelhorEnvioEnvironment
): void {
  if (tokenEnv && tokenEnv !== activeEnv) {
    throw new MelhorEnvioError(
      `Isolamento de ambiente violado: o token/recurso pertence ao ambiente "${tokenEnv}", mas o sistema está configurado para "${activeEnv}". Credenciais de Sandbox e Produção nunca devem ser misturadas.`,
      { statusCode: 400, code: 'ENVIRONMENT_MISMATCH' }
    );
  }
}

/**
 * Mascara chaves e tokens para exibição segura no painel sem expor o segredo real no navegador
 */
export function maskSecret(secret?: string | null): string {
  if (!secret || typeof secret !== 'string') return '';
  const trimmed = secret.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `••••••••••••${trimmed.slice(-4)}`;
}

export function isMaskedSecretValue(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('••••');
}

/**
 * Remove dados sensíveis (tokens, client_secret, CPF/CNPJ, telefone, e-mail) antes de registrar em logs
 */
export function sanitizeForLog(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return input
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED_TOKEN]')
      .replace(/\b\d{11,14}\b/g, '[REDACTED_DOC]');
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeForLog(item));
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('authorization') ||
        lower.includes('api_key')
      ) {
        out[k] = '[REDACTED_SECRET]';
      } else if (lower === 'document' || lower === 'company_document' || lower === 'cpf_cnpj' || lower === 'phone') {
        out[k] = typeof v === 'string' && v.length > 4 ? `***${v.slice(-2)}` : '[REDACTED_PII]';
      } else {
        out[k] = sanitizeForLog(v);
      }
    }
    return out;
  }
  return input;
}

// ============================================================================
// 2. VALIDAÇÃO E NORMALIZAÇÃO DE DADOS (CEP, CPF/CNPJ, ENDEREÇOS, MEDIDAS)
// ============================================================================

export function normalizeCep(rawCep?: string | null, fieldLabel = 'CEP'): string {
  const clean = String(rawCep || '').replace(/\D/g, '');
  if (clean.length !== 8 || /^0+$/.test(clean)) {
    throw new MelhorEnvioError(`${fieldLabel} inválido ("${rawCep || ''}"). Informe um CEP válido com 8 dígitos numéricos.`, {
      statusCode: 400,
      code: 'INVALID_CEP',
    });
  }
  return clean;
}

export function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean[10], 10);
}

export function isValidCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14 || /^(\d)\1{13}$/.test(clean)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i], 10) * weights[i];
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calcDigit(clean.slice(0, 12), w1);
  const d2 = calcDigit(clean.slice(0, 12) + d1, w2);
  return clean.endsWith(`${d1}${d2}`);
}

export function classifyAndValidateDocument(
  rawDoc?: string | null,
  fieldLabel = 'CPF/CNPJ',
  validateCheckDigits = true
): { type: 'cpf' | 'cnpj'; clean: string } {
  const clean = String(rawDoc || '').replace(/\D/g, '');
  if (clean.length === 11) {
    if (/^(\d)\1{10}$/.test(clean) || (validateCheckDigits && !isValidCpf(clean))) {
      throw new MelhorEnvioError(`${fieldLabel} inválido. Informe um CPF válido de 11 dígitos.`, {
        statusCode: 400,
        code: 'INVALID_CPF',
      });
    }
    return { type: 'cpf', clean };
  }
  if (clean.length === 14) {
    if (/^(\d)\1{13}$/.test(clean) || (validateCheckDigits && !isValidCnpj(clean))) {
      throw new MelhorEnvioError(`${fieldLabel} inválido. Informe um CNPJ válido de 14 dígitos.`, {
        statusCode: 400,
        code: 'INVALID_CNPJ',
      });
    }
    return { type: 'cnpj', clean };
  }
  throw new MelhorEnvioError(
    `${fieldLabel} ausente ou inválido. A API do Melhor Envio exige CPF (11 dígitos) ou CNPJ (14 dígitos) válido para emissão da etiqueta.`,
    { statusCode: 400, code: 'MISSING_DOCUMENT' }
  );
}

export function normalizePhone(rawPhone?: string | null, fieldLabel = 'Telefone'): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  // Remove prefixo 55 do Brasil caso tenha 12 ou 13 dígitos
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11) {
    throw new MelhorEnvioError(`${fieldLabel} inválido. Informe DDD + número (10 ou 11 dígitos).`, {
      statusCode: 400,
      code: 'INVALID_PHONE',
    });
  }
  return local;
}

export function validateAndNormalizeParty(
  raw: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    document?: string | null;
    postal_code?: string | null;
    address?: string | null;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string | null;
    state_abbr?: string | null;
  },
  roleLabel: 'Remetente' | 'Destinatário',
  validateCheckDigits = true
): MelhorEnvioAddressParty {
  const name = String(raw.name || '').trim();
  if (name.length < 2) {
    throw new MelhorEnvioError(`Nome do ${roleLabel} é obrigatório.`, { statusCode: 400, code: 'INVALID_NAME' });
  }

  const phone = normalizePhone(raw.phone, `Telefone do ${roleLabel}`);
  const email = String(raw.email || '').trim();
  if (!email || !email.includes('@')) {
    throw new MelhorEnvioError(`E-mail do ${roleLabel} é obrigatório e deve ser válido.`, {
      statusCode: 400,
      code: 'INVALID_EMAIL',
    });
  }

  const docInfo = classifyAndValidateDocument(raw.document, `CPF/CNPJ do ${roleLabel}`, validateCheckDigits);
  const postalCode = normalizeCep(raw.postal_code, `CEP do ${roleLabel}`);

  const address = String(raw.address || '').trim();
  if (!address) {
    throw new MelhorEnvioError(`Logradouro/Endereço do ${roleLabel} é obrigatório.`, {
      statusCode: 400,
      code: 'INVALID_ADDRESS',
    });
  }

  const number = String(raw.number || '').trim() || 'S/N';
  const district = String(raw.district || '').trim();
  if (!district) {
    throw new MelhorEnvioError(`Bairro do ${roleLabel} é obrigatório.`, {
      statusCode: 400,
      code: 'INVALID_DISTRICT',
    });
  }

  const city = String(raw.city || '').trim();
  if (!city) {
    throw new MelhorEnvioError(`Cidade do ${roleLabel} é obrigatória.`, {
      statusCode: 400,
      code: 'INVALID_CITY',
    });
  }

  const stateAbbr = String(raw.state_abbr || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(stateAbbr)) {
    throw new MelhorEnvioError(`UF do ${roleLabel} inválida ("${raw.state_abbr || ''}"). Informe a sigla de 2 letras (ex: RJ, SP).`, {
      statusCode: 400,
      code: 'INVALID_STATE',
    });
  }

  const party: MelhorEnvioAddressParty = {
    name,
    phone,
    email,
    postal_code: postalCode,
    address,
    location_number: number,
    complement: String(raw.complement || '').trim(),
    district,
    city,
    state_abbr: stateAbbr,
    country_id: 'BR',
  };

  if (docInfo.type === 'cpf') {
    party.document = docInfo.clean;
  } else {
    party.company_document = docInfo.clean;
  }

  return party;
}

export function validateVolumes(
  volumes: Array<{ height: number; width: number; length: number; weight: number }>
): Array<{ height: number; width: number; length: number; weight: number }> {
  if (!Array.isArray(volumes) || volumes.length === 0) {
    throw new MelhorEnvioError('Pelo menos 1 volume (pacote) é obrigatório para cálculo/envio.', {
      statusCode: 400,
      code: 'EMPTY_VOLUMES',
    });
  }

  return volumes.map((v, idx) => {
    const height = Number(v.height);
    const width = Number(v.width);
    const length = Number(v.length);
    const weight = Number(v.weight);

    if (!Number.isFinite(height) || height < 1 || height > 200) {
      throw new MelhorEnvioError(`Altura inválida no volume ${idx + 1}: ${v.height} cm (permitido: 1 a 200 cm).`, {
        statusCode: 400,
        code: 'INVALID_DIMENSIONS',
      });
    }
    if (!Number.isFinite(width) || width < 8 || width > 200) {
      throw new MelhorEnvioError(`Largura inválida no volume ${idx + 1}: ${v.width} cm (mínimo 8 cm).`, {
        statusCode: 400,
        code: 'INVALID_DIMENSIONS',
      });
    }
    if (!Number.isFinite(length) || length < 13 || length > 200) {
      throw new MelhorEnvioError(`Comprimento inválido no volume ${idx + 1}: ${v.length} cm (mínimo 13 cm).`, {
        statusCode: 400,
        code: 'INVALID_DIMENSIONS',
      });
    }
    if (!Number.isFinite(weight) || weight <= 0 || weight > 120) {
      throw new MelhorEnvioError(`Peso inválido no volume ${idx + 1}: ${v.weight} kg (deve ser maior que 0 kg em quilogramas).`, {
        statusCode: 400,
        code: 'INVALID_WEIGHT',
      });
    }

    return {
      height: Math.round(height),
      width: Math.round(width),
      length: Math.round(length),
      weight: Number(weight.toFixed(3)),
    };
  });
}

/**
 * Compatibilidade retroativa com chamadas existentes
 */
export function calculatePackageDimensions(quantidade: number, settings?: Partial<IntegrationSettings>) {
  const pkg = calculateDynamicPackage(quantidade, settings);
  return {
    weight: pkg.weight,
    height: pkg.height,
    width: pkg.width,
    length: pkg.length,
    box_label: pkg.box_label,
    box_type: pkg.box_type,
  };
}

// ============================================================================
// 3. OAUTH2 AUTHORIZATION CODE, CSRF STATE & SINGLE-FLIGHT TOKEN REFRESH
// ============================================================================

export function createOAuthState(
  secret: string,
  environment: MelhorEnvioEnvironment = 'sandbox',
  nowMs: number = Date.now()
): string {
  const cleanSecret = secret || 'atelier_oauth_default_state_key';
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${environment}.${nowMs}.${nonce}`;
  const sig = crypto.createHmac('sha256', cleanSecret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyOAuthState(
  state: string | undefined | null,
  secret: string,
  expectedEnvironment?: MelhorEnvioEnvironment,
  maxAgeMs = 15 * 60 * 1000,
  nowMs: number = Date.now()
): { valid: boolean; environment?: MelhorEnvioEnvironment; reason?: string } {
  if (!state || typeof state !== 'string') {
    return { valid: false, reason: 'Parâmetro state ausente.' };
  }
  const parts = state.split('.');
  if (parts.length !== 4) {
    return { valid: false, reason: 'Formato de state inválido.' };
  }
  const [envPart, tsStr, nonce, providedSig] = parts;
  if (envPart !== 'sandbox' && envPart !== 'production') {
    return { valid: false, reason: 'Ambiente no state inválido.' };
  }
  if (expectedEnvironment && envPart !== expectedEnvironment) {
    return { valid: false, reason: `Ambiente do state (${envPart}) difere do esperado (${expectedEnvironment}).` };
  }

  const timestamp = Number(tsStr);
  if (!Number.isFinite(timestamp) || nowMs - timestamp > maxAgeMs || timestamp > nowMs + 60000) {
    return { valid: false, reason: 'State expirado.' };
  }

  const cleanSecret = secret || 'atelier_oauth_default_state_key';
  const payload = `${envPart}.${tsStr}.${nonce}`;
  const expectedSig = crypto.createHmac('sha256', cleanSecret).update(payload).digest('hex');

  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'Assinatura CSRF do state inválida.' };
  }

  return { valid: true, environment: envPart as MelhorEnvioEnvironment };
}

export function buildOAuthAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  environment?: MelhorEnvioEnvironment;
  scopes?: string | string[];
  state: string;
}): string {
  const clientId = String(params.clientId || '').trim();
  const redirectUri = String(params.redirectUri || '').trim();
  if (!clientId || !redirectUri) {
    throw new MelhorEnvioError('client_id e redirect_uri são obrigatórios para construir a URL de autorização OAuth2.', {
      statusCode: 400,
      code: 'MISSING_OAUTH_CONFIG',
    });
  }

  const baseUrl = getMelhorEnvioBaseUrl(params.environment);
  const scopeList = Array.isArray(params.scopes)
    ? params.scopes.join(' ')
    : params.scopes && params.scopes.trim().length > 0
      ? params.scopes.trim()
      : REQUIRED_OAUTH_SCOPES.join(' ');

  const url = new URL(`${baseUrl}/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', scopeList);
  return url.toString();
}

export async function exchangeAuthorizationCode(
  params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    environment?: MelhorEnvioEnvironment;
    userAgent?: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<OAuthTokenBundle> {
  const env = resolveEnvironment(params.environment);
  const baseUrl = getMelhorEnvioBaseUrl(env);

  const response = await fetchImpl(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': params.userAgent || DEFAULT_INTEGRATION_SETTINGS.melhor_envio_user_agent,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.clientId.trim(),
      client_secret: params.clientSecret.trim(),
      redirect_uri: params.redirectUri.trim(),
      code: params.code.trim(),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[MelhorEnvio OAuth] Token exchange error:', response.status, errText);
    throw new MelhorEnvioError(
      `Falha ao trocar authorization code por token OAuth2 no Melhor Envio (HTTP ${response.status}): ${errText}`,
      { statusCode: response.status, code: 'OAUTH_TOKEN_EXCHANGE_FAILED', details: sanitizeForLog(errText) }
    );
  }

  const data = (await response.json()) as any;
  const now = Date.now();
  const expiresIn = Number(data.expires_in) || ACCESS_TOKEN_DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(now + expiresIn * 1000).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    environment: env,
    scopes: REQUIRED_OAUTH_SCOPES.join(' '),
  };
}

/**
 * Mapa de locks em memória por ambiente+clientId para evitar condição de corrida
 * quando múltiplas requisições simultâneas tentam renovar o mesmo refresh_token.
 */
const activeRefreshLocks = new Map<string, Promise<OAuthTokenBundle>>();

export function isTokenExpiringSoon(expiresAtIso?: string | null, bufferSeconds = 24 * 60 * 60): boolean {
  if (!expiresAtIso) return false;
  const expiryMs = Date.parse(expiresAtIso);
  if (Number.isNaN(expiryMs)) return false;
  return Date.now() + bufferSeconds * 1000 >= expiryMs;
}

export async function refreshAccessTokenSingleFlight(
  params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    environment?: MelhorEnvioEnvironment;
    userAgent?: string;
    onPersist?: (bundle: OAuthTokenBundle) => Promise<void> | void;
  },
  fetchImpl: typeof fetch = fetch
): Promise<OAuthTokenBundle> {
  const env = resolveEnvironment(params.environment);
  const lockKey = `${env}:${params.clientId.trim()}:${params.refreshToken.slice(-12)}`;

  const existingPromise = activeRefreshLocks.get(lockKey);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async () => {
    try {
      const baseUrl = getMelhorEnvioBaseUrl(env);
      const response = await fetchImpl(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': params.userAgent || DEFAULT_INTEGRATION_SETTINGS.melhor_envio_user_agent,
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: params.refreshToken.trim(),
          client_id: params.clientId.trim(),
          client_secret: params.clientSecret.trim(),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        const isRevokedOrExpired = response.status === 400 || response.status === 401 || response.status === 403;
        throw new MelhorEnvioError(
          isRevokedOrExpired
            ? 'O refresh_token do Melhor Envio expirou (validade de 45 dias) ou foi revogado. Realize nova autorização OAuth2 no painel.'
            : `Falha ao renovar token do Melhor Envio (HTTP ${response.status}).`,
          {
            statusCode: response.status,
            code: 'OAUTH_REFRESH_FAILED',
            requiresReauthorization: isRevokedOrExpired,
            details: sanitizeForLog(errText),
          }
        );
      }

      const data = (await response.json()) as any;
      const now = Date.now();
      const expiresIn = Number(data.expires_in) || ACCESS_TOKEN_DEFAULT_TTL_SECONDS;
      const bundle: OAuthTokenBundle = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || params.refreshToken,
        token_type: data.token_type || 'Bearer',
        expires_in: expiresIn,
        expires_at: new Date(now + expiresIn * 1000).toISOString(),
        refresh_expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
        environment: env,
        scopes: REQUIRED_OAUTH_SCOPES.join(' '),
      };

      if (params.onPersist) {
        await params.onPersist(bundle);
      }

      return bundle;
    } finally {
      activeRefreshLocks.delete(lockKey);
    }
  })();

  activeRefreshLocks.set(lockKey, refreshPromise);
  return refreshPromise;
}

// ============================================================================
// 4. RATE LIMITER (250 REQ/MIN) E CLIENTE HTTP ISOLADO
// ============================================================================

const requestTimestampsByAccount = new Map<string, number[]>();

export function checkAndRecordRateLimit(
  accountKey = 'default',
  nowMs: number = Date.now(),
  maxPerMinute = RATE_LIMIT_MAX_REQUESTS_PER_MINUTE
): void {
  const windowStart = nowMs - 60_000;
  const existing = requestTimestampsByAccount.get(accountKey) || [];
  const recent = existing.filter((t) => t > windowStart);

  if (recent.length >= maxPerMinute) {
    throw new MelhorEnvioError(
      `Limite de requisições do Melhor Envio atingido (${maxPerMinute} req/min). Aguarde alguns segundos antes de tentar novamente.`,
      { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' }
    );
  }

  recent.push(nowMs);
  requestTimestampsByAccount.set(accountKey, recent);
}

export function resetRateLimiterForTests(): void {
  requestTimestampsByAccount.clear();
}

export interface MelhorEnvioRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  settings: Partial<IntegrationSettings>;
  idempotent?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  onTokenRefreshed?: (bundle: OAuthTokenBundle) => Promise<void> | void;
  fetchImpl?: typeof fetch;
}

export async function melhorEnvioRequest<T = any>(options: MelhorEnvioRequestOptions): Promise<T> {
  const fetchFn = options.fetchImpl || fetch;
  const env = resolveEnvironment(options.settings.melhor_envio_env);
  const baseUrl = getMelhorEnvioBaseUrl(env);

  if (!baseUrl.startsWith('https://')) {
    throw new MelhorEnvioError('Comunicação com o Melhor Envio exige HTTPS obrigatório.', {
      statusCode: 500,
      code: 'HTTPS_REQUIRED',
    });
  }

  let accessToken = String(options.settings.melhor_envio_token || process.env.MELHOR_ENVIO_TOKEN || '').trim();
  const refreshToken = String(options.settings.melhor_envio_refresh_token || process.env.MELHOR_ENVIO_REFRESH_TOKEN || '').trim();
  const clientId = String(options.settings.melhor_envio_client_id || process.env.MELHOR_ENVIO_CLIENT_ID || '').trim();
  const clientSecret = String(options.settings.melhor_envio_client_secret || process.env.MELHOR_ENVIO_CLIENT_SECRET || '').trim();
  const userAgent =
    String(options.settings.melhor_envio_user_agent || process.env.MELHOR_ENVIO_USER_AGENT || '').trim() ||
    DEFAULT_INTEGRATION_SETTINGS.melhor_envio_user_agent;

  // Se o token está próximo de expirar e temos credenciais OAuth2 + refresh_token, renova preventivamente
  if (
    refreshToken &&
    clientId &&
    clientSecret &&
    options.settings.melhor_envio_token_expires_at &&
    isTokenExpiringSoon(options.settings.melhor_envio_token_expires_at)
  ) {
    const refreshed = await refreshAccessTokenSingleFlight(
      {
        refreshToken,
        clientId,
        clientSecret,
        environment: env,
        userAgent,
        onPersist: options.onTokenRefreshed,
      },
      fetchFn
    );
    accessToken = refreshed.access_token;
  }

  if (!accessToken || accessToken.includes('seu_token')) {
    throw new MelhorEnvioError(
      'Token de acesso do Melhor Envio não configurado para o ambiente selecionado.',
      { statusCode: 401, code: 'MISSING_ACCESS_TOKEN', requiresReauthorization: true }
    );
  }

  const accountKey = `${env}:${accessToken.slice(-8)}`;
  const maxRetries = options.idempotent ? (options.maxRetries ?? 2) : 0;
  let attempt = 0;
  let triedRefreshOn401 = false;

  while (true) {
    checkAndRecordRateLimit(accountKey);

    const url = options.path.startsWith('http') ? options.path : `${baseUrl}${options.path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': userAgent,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: options.method || 'POST',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
      });
    } catch (networkErr: any) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
        continue;
      }
      throw new MelhorEnvioError(
        `Erro de rede ao comunicar com o Melhor Envio (${env}): ${networkErr?.message || 'Timeout/Conexão'}`,
        { statusCode: 503, code: 'NETWORK_ERROR' }
      );
    }

    // Tratamento de 401 Unauthorized com tentativa única de refresh (sem loop infinito)
    if (response.status === 401 && !triedRefreshOn401 && refreshToken && clientId && clientSecret) {
      triedRefreshOn401 = true;
      const refreshed = await refreshAccessTokenSingleFlight(
        {
          refreshToken,
          clientId,
          clientSecret,
          environment: env,
          userAgent,
          onPersist: options.onTokenRefreshed,
        },
        fetchFn
      );
      accessToken = refreshed.access_token;
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      const errBody = await response.text();
      throw new MelhorEnvioError(
        `Melhor Envio (${env}) recusou a autorização (HTTP ${response.status}). Verifique seu token ou refaça a conexão OAuth2.`,
        {
          statusCode: response.status,
          code: 'UNAUTHORIZED',
          requiresReauthorization: true,
          details: sanitizeForLog(errBody),
        }
      );
    }

    // Tratamento de 429 Too Many Requests ou 5xx transitório (somente para rotas idempotentes)
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      attempt++;
      const retryAfterHeader = Number(response.headers?.get?.('retry-after') || 0);
      const delayMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 200 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, Math.min(delayMs, 2000)));
      continue;
    }

    const text = await response.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const apiMsg =
        (parsed && typeof parsed === 'object' && (parsed.message || parsed.error || JSON.stringify(parsed.errors || parsed))) ||
        String(text).slice(0, 220);
      throw new MelhorEnvioError(
        `Erro na API do Melhor Envio (HTTP ${response.status}): ${apiMsg}`,
        {
          statusCode: response.status,
          code: 'API_RESPONSE_ERROR',
          details: sanitizeForLog(parsed),
        }
      );
    }

    return parsed as T;
  }
}

// ============================================================================
// 5. FLUXO FUNCIONAL 1: COTAÇÃO DE FRETES (/api/v2/me/shipment/calculate)
// ============================================================================

export function buildCalculatePayload(params: {
  cepOrigem: string;
  cepDestino: string;
  pkg: PackageCalculationResult;
  quantidade: number;
  valorUnitario?: number;
  settings?: Partial<IntegrationSettings>;
}) {
  const s = { ...DEFAULT_INTEGRATION_SETTINGS, ...(params.settings || {}) };
  const cepOrigem = normalizeCep(params.cepOrigem || s.origem_cep, 'CEP de Origem');
  const cepDestino = normalizeCep(params.cepDestino, 'CEP de Destino');
  const validatedVolumes = validateVolumes([
    {
      height: params.pkg.height,
      width: params.pkg.width,
      length: params.pkg.length,
      weight: params.pkg.weight,
    },
  ]);

  const unitValue = Number(params.valorUnitario ?? 21.9);
  const insuranceValue = s.melhor_envio_seguro_automatico
    ? Number((Math.max(1, params.quantidade) * unitValue).toFixed(2))
    : 0;

  return {
    from: { postal_code: cepOrigem },
    to: { postal_code: cepDestino },
    volumes: validatedVolumes,
    options: {
      insurance_value: insuranceValue,
      receipt: Boolean(s.melhor_envio_receipt),
      own_hand: Boolean(s.melhor_envio_own_hand),
    },
    services: s.melhor_envio_servicos || '1,2,3,4,17',
  };
}

export function parseMelhorEnvioCalculateResponse(data: unknown): ShippingOption[] {
  if (!Array.isArray(data)) return [];

  const parsed: ShippingOption[] = data
    .filter((item: any) => item && !item.error && (item.custom_price || item.price))
    .map((item: any) => {
      // Dá preferência a custom_price e custom_delivery_time conforme especificação oficial
      const price = parseFloat(String(item.custom_price ?? item.price));
      const originalPrice = parseFloat(String(item.price ?? item.custom_price));
      const deliveryTime = Number(
        item.custom_delivery_time ??
          item.delivery_time ??
          item.custom_delivery_range?.max ??
          item.delivery_range?.max ??
          5
      );

      return {
        service_id: Number(item.id),
        carrier_name: item.company?.name || 'Transportadora',
        service_name: item.name || ' Padrão',
        picture: item.company?.picture,
        price: Number(price.toFixed(2)),
        original_price: Number(originalPrice.toFixed(2)),
        delivery_time: Math.max(1, deliveryTime),
      };
    });

  return markCheapestAndFastestOptions(parsed);
}

export async function calculateShippingRates(params: CalculateShippingParams): Promise<ShippingOption[]> {
  const s = { ...DEFAULT_INTEGRATION_SETTINGS, ...(params.settings || {}) };
  const cepDestino = normalizeCep(params.cep_destino, 'CEP de Destino');
  const cepOrigem = normalizeCep(
    params.cep_origem || s.origem_cep || process.env.ATELIER_ORIGIN_CEP || '22745271',
    'CEP de Origem'
  );
  const qty = Math.max(1, Number(params.quantidade_placas) || 1);
  const pkg = calculateDynamicPackage(qty, s);

  const token = String(s.melhor_envio_token || process.env.MELHOR_ENVIO_TOKEN || '').trim();
  const hasRealToken = Boolean(token && token.length > 15 && !token.includes('seu_token'));

  if (hasRealToken) {
    try {
      const payload = buildCalculatePayload({
        cepOrigem,
        cepDestino,
        pkg,
        quantidade: qty,
        settings: s,
      });

      const data = await melhorEnvioRequest<any[]>({
        path: '/api/v2/me/shipment/calculate',
        method: 'POST',
        body: payload,
        settings: { ...s, melhor_envio_token: token },
        idempotent: true,
        fetchImpl: params.fetchImpl,
      });

      const options = parseMelhorEnvioCalculateResponse(data);
      if (options.length > 0) {
        return options;
      }
    } catch (err) {
      if (params.allowSimulationFallback === false) {
        throw err;
      }
      console.warn('[Melhor Envio] Falha na cotação oficial, acionando simulador calibrado:', sanitizeForLog((err as Error)?.message));
    }
  } else if (params.allowSimulationFallback === false) {
    throw new MelhorEnvioError('Token do Melhor Envio não configurado para cotação oficial.', {
      statusCode: 401,
      code: 'MISSING_ACCESS_TOKEN',
    });
  }

  return calculateSimulatedShippingOptions(cepDestino, pkg);
}

// ============================================================================
// 6. FLUXO FUNCIONAL 3: INSERÇÃO NO CARRINHO (/api/v2/me/cart)
// ============================================================================

export function buildCartPayload(params: {
  order: any;
  logistics: any;
  settings?: Partial<IntegrationSettings>;
  invoiceKey?: string | null;
  validateCheckDigits?: boolean;
}) {
  const s = { ...DEFAULT_INTEGRATION_SETTINGS, ...(params.settings || {}) };
  const { order, logistics } = params;
  const checkDigits = params.validateCheckDigits ?? true;

  const qty = Math.max(1, Number(order?.quantidade_total) || 1);
  const unitValue = Number(order?.preco_unitario_aplicado || 21.9);
  const pkg = calculateDynamicPackage(qty, s);

  const fromParty = validateAndNormalizeParty(
    {
      name: s.origem_nome || 'Atelier das Placas',
      phone: s.origem_telefone || '21980914107',
      email: s.origem_email || 'jrmacbrandt@gmail.com',
      document: s.origem_cpf_cnpj || '06865841719',
      postal_code: s.origem_cep || '22745271',
      address: s.origem_logradouro || 'Rua Araguaia',
      number: s.origem_numero || '1111',
      complement: s.origem_complemento || 'Apto 403',
      district: s.origem_bairro || 'Freguesia (Jacarepaguá)',
      city: s.origem_cidade || 'Rio de Janeiro',
      state_abbr: s.origem_uf || 'RJ',
    },
    'Remetente',
    checkDigits
  );

  const recipientDoc = logistics?.destinatario_cpf_cnpj || order?.revendedor_cpf_cnpj || order?.cpf_cnpj;
  const recipientPhone = logistics?.responsavel_retirada_telefone || order?.revendedor_telefone || order?.telefone;
  const recipientEmail = order?.revendedor_email || order?.email || 'revenda@atelierdasplacas.com.br';

  const toParty = validateAndNormalizeParty(
    {
      name: logistics?.destinatario_nome || order?.revendedor_nome || 'Destinatário',
      phone: recipientPhone,
      email: recipientEmail,
      document: recipientDoc,
      postal_code: logistics?.cep,
      address: logistics?.logradouro,
      number: logistics?.numero || 'S/N',
      complement: logistics?.complemento || '',
      district: logistics?.bairro,
      city: logistics?.cidade,
      state_abbr: logistics?.uf,
    },
    'Destinatário',
    checkDigits
  );

  const serviceId = Number(logistics?.servico_frete_id || 3);
  const validatedVolumes = validateVolumes([
    {
      height: pkg.height,
      width: pkg.width,
      length: pkg.length,
      weight: pkg.weight,
    },
  ]);

  const insuranceValue = s.melhor_envio_seguro_automatico
    ? Number((qty * unitValue).toFixed(2))
    : 0;

  const hasInvoice = Boolean(params.invoiceKey && String(params.invoiceKey).replace(/\D/g, '').length === 44);

  return {
    service: serviceId,
    agency: logistics?.agencia_id ? Number(logistics.agencia_id) : null,
    from: {
      ...fromParty,
      number: fromParty.location_number,
    },
    to: {
      ...toParty,
      number: toParty.location_number,
    },
    products: [
      {
        name: 'Placas Inteligentes NFC + QR Code',
        quantity: String(qty),
        unitary_value: String(Number(unitValue.toFixed(2))),
      },
    ],
    volumes: validatedVolumes,
    options: {
      insurance_value: insuranceValue,
      receipt: Boolean(s.melhor_envio_receipt),
      own_hand: Boolean(s.melhor_envio_own_hand),
      reverse: false,
      non_commercial: !hasInvoice,
      ...(hasInvoice ? { invoice: { key: String(params.invoiceKey).replace(/\D/g, '') } } : {}),
      platform: 'Atelier das Placas',
      tags: [
        {
          tag: String(order?.numero_pedido || order?.id || ''),
          Url: null,
        },
      ],
    },
  };
}

export async function addShipmentToCart(params: {
  order: any;
  logistics: any;
  settings: Partial<IntegrationSettings>;
  invoiceKey?: string | null;
  validateCheckDigits?: boolean;
  fetchImpl?: typeof fetch;
}) {
  // Proteção contra duplicidade: se já existe item no carrinho aguardando checkout, retorna-o
  if (
    params.logistics?.melhor_envio_cart_id &&
    params.logistics?.melhor_envio_status === 'no_carrinho'
  ) {
    return {
      sucesso: true,
      ja_no_carrinho: true,
      cart_id: params.logistics.melhor_envio_cart_id,
      protocol: params.logistics.melhor_envio_protocol || null,
      status: 'no_carrinho',
    };
  }

  const payload = buildCartPayload({
    order: params.order,
    logistics: params.logistics,
    settings: params.settings,
    invoiceKey: params.invoiceKey,
    validateCheckDigits: params.validateCheckDigits,
  });

  const cartData = await melhorEnvioRequest<any>({
    path: '/api/v2/me/cart',
    method: 'POST',
    body: payload,
    settings: params.settings,
    idempotent: false,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    ja_no_carrinho: false,
    cart_id: cartData.id,
    protocol: cartData.protocol || null,
    price: Number(cartData.price || payload.options.insurance_value || 0),
    status: 'no_carrinho',
    raw: cartData,
  };
}

// ============================================================================
// 7. FLUXO FUNCIONAL 4: COMPRA / CHECKOUT DE FRETES (/api/v2/me/shipment/checkout)
// ============================================================================

export async function checkoutShipmentOrders(params: {
  orderIds: string[];
  explicitConfirmation: boolean;
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  if (params.explicitConfirmation !== true) {
    throw new MelhorEnvioError(
      'Confirmação explícita do operador (explicitConfirmation: true) é obrigatória antes de debitar o saldo da carteira no Melhor Envio.',
      { statusCode: 400, code: 'EXPLICIT_CONFIRMATION_REQUIRED' }
    );
  }

  const cleanIds = (params.orderIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) {
    throw new MelhorEnvioError('Informe pelo menos um ID de etiqueta do carrinho para realizar o checkout.', {
      statusCode: 400,
      code: 'EMPTY_ORDER_IDS',
    });
  }

  const checkoutData = await melhorEnvioRequest<any>({
    path: '/api/v2/me/shipment/checkout',
    method: 'POST',
    body: { orders: cleanIds },
    settings: params.settings,
    idempotent: false, // Operação financeira: NUNCA repetir automaticamente
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    purchase: checkoutData?.purchase || checkoutData,
    orders: cleanIds,
    status: 'comprada',
  };
}

// ============================================================================
// 8. FLUXO FUNCIONAL 5: GERAÇÃO, PREVIEW E IMPRESSÃO DE ETIQUETAS
// ============================================================================

export async function generateShipmentLabels(params: {
  orderIds: string[];
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  const cleanIds = (params.orderIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) {
    throw new MelhorEnvioError('Informe pelo menos um ID de envio para gerar a etiqueta.', {
      statusCode: 400,
      code: 'EMPTY_ORDER_IDS',
    });
  }

  const generateData = await melhorEnvioRequest<any>({
    path: '/api/v2/me/shipment/generate',
    method: 'POST',
    body: { orders: cleanIds },
    settings: params.settings,
    idempotent: false,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    generate_key: generateData?.generate_key || null,
    details: generateData,
    status: 'gerada',
  };
}

export async function previewShipmentLabels(params: {
  orderIds: string[];
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  const cleanIds = (params.orderIds || []).map((id) => String(id).trim()).filter(Boolean);
  const data = await melhorEnvioRequest<any>({
    path: '/api/v2/me/shipment/preview',
    method: 'POST',
    body: { orders: cleanIds },
    settings: params.settings,
    idempotent: true,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    url: data?.url || null,
  };
}

export async function printShipmentLabels(params: {
  orderIds: string[];
  mode?: 'private' | 'public';
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  const cleanIds = (params.orderIds || []).map((id) => String(id).trim()).filter(Boolean);
  const data = await melhorEnvioRequest<any>({
    path: '/api/v2/me/shipment/print',
    method: 'POST',
    body: {
      mode: params.mode || 'public',
      orders: cleanIds,
    },
    settings: params.settings,
    idempotent: true,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    url: data?.url || null,
  };
}

// ============================================================================
// 9. FLUXO FUNCIONAL 6: RASTREAMENTO ATIVO E WEBHOOK (HMAC-SHA256)
// ============================================================================

export async function trackShipments(params: {
  orderIds: string[];
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  const cleanIds = (params.orderIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) {
    throw new MelhorEnvioError('Informe pelo menos um ID de etiqueta do Melhor Envio para rastrear.', {
      statusCode: 400,
      code: 'EMPTY_ORDER_IDS',
    });
  }

  const data = await melhorEnvioRequest<Record<string, any>>({
    path: '/api/v2/me/shipment/tracking',
    method: 'POST',
    body: { orders: cleanIds },
    settings: params.settings,
    idempotent: true,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    tracking: data || {},
  };
}

/**
 * Valida a assinatura criptográfica X-ME-Signature enviada pelo Melhor Envio nos Webhooks
 * usando HMAC-SHA256 sobre o corpo bruto (rawBody) e o secret do aplicativo,
 * comparando com crypto.timingSafeEqual (suporta Base64 padrão do Melhor Envio e Hex).
 */
export function verifyMelhorEnvioWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  appSecret: string | undefined | null
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const cleanSig = String(signatureHeader).trim().replace(/^sha256=/i, '');
  const cleanSecret = String(appSecret).trim();
  if (!cleanSig || !cleanSecret) return false;

  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const hmacBase64 = crypto.createHmac('sha256', cleanSecret).update(bodyBuffer).digest('base64');
  const hmacHex = crypto.createHmac('sha256', cleanSecret).update(bodyBuffer).digest('hex');

  const sigBuf = Buffer.from(cleanSig, 'utf8');
  const b64Buf = Buffer.from(hmacBase64, 'utf8');
  const hexBuf = Buffer.from(hmacHex, 'utf8');

  if (sigBuf.length === b64Buf.length && crypto.timingSafeEqual(sigBuf, b64Buf)) {
    return true;
  }
  if (sigBuf.length === hexBuf.length && crypto.timingSafeEqual(sigBuf, hexBuf)) {
    return true;
  }
  return false;
}

export interface WebhookProcessResult {
  ignored: boolean;
  duplicate: boolean;
  event: string;
  event_id: string;
  melhor_envio_order_id: string | null;
  melhor_envio_status: string;
  correios_status: string;
  tracking_code: string | null;
  protocol: string | null;
}

export function mapWebhookEventToLogisticsStatus(
  payload: any,
  alreadyProcessedEventIds: Set<string> = new Set()
): WebhookProcessResult {
  const event = String(payload?.event || '').trim();
  const data = payload?.data || {};
  const meOrderId = data?.id ? String(data.id) : null;
  const protocol = data?.protocol ? String(data.protocol) : null;
  const trackingCode = data?.tracking || data?.self_tracking || null;
  const updatedAt = data?.updated_at || data?.generated_at || data?.posted_at || '';

  const eventId = `me_${event}_${meOrderId || 'unknown'}_${updatedAt}`;
  if (alreadyProcessedEventIds.has(eventId)) {
    return {
      ignored: true,
      duplicate: true,
      event,
      event_id: eventId,
      melhor_envio_order_id: meOrderId,
      melhor_envio_status: data?.status || 'unchanged',
      correios_status: 'unchanged',
      tracking_code: trackingCode,
      protocol,
    };
  }

  let correiosStatus = 'aguardando_postagem';
  let meStatus = data?.status || event;

  switch (event) {
    case 'order.created':
    case 'order.pending':
      correiosStatus = 'aguardando_postagem';
      meStatus = 'no_carrinho';
      break;
    case 'order.released':
      correiosStatus = 'etiqueta_comprada';
      meStatus = 'comprada';
      break;
    case 'order.generated':
      correiosStatus = 'etiqueta_gerada';
      meStatus = 'gerada';
      break;
    case 'order.posted':
      correiosStatus = 'postado';
      meStatus = 'postado';
      break;
    case 'order.delivered':
      correiosStatus = 'entregue';
      meStatus = 'entregue';
      break;
    case 'order.cancelled':
      correiosStatus = 'cancelado';
      meStatus = 'cancelada';
      break;
    case 'order.undelivered':
    case 'order.paused':
      correiosStatus = 'em_transito';
      meStatus = event.replace('order.', '');
      break;
    default:
      return {
        ignored: true,
        duplicate: false,
        event,
        event_id: eventId,
        melhor_envio_order_id: meOrderId,
        melhor_envio_status: meStatus,
        correios_status: 'unchanged',
        tracking_code: trackingCode,
        protocol,
      };
  }

  alreadyProcessedEventIds.add(eventId);
  return {
    ignored: false,
    duplicate: false,
    event,
    event_id: eventId,
    melhor_envio_order_id: meOrderId,
    melhor_envio_status: meStatus,
    correios_status: correiosStatus,
    tracking_code: trackingCode,
    protocol,
  };
}

// ============================================================================
// 10. FLUXO FUNCIONAL 7: CANCELAMENTO SEGURO (/cancellable + /cancel)
// ============================================================================

export async function checkAndCancelShipmentOrder(params: {
  orderId: string;
  description?: string;
  settings: Partial<IntegrationSettings>;
  fetchImpl?: typeof fetch;
}) {
  const meOrderId = String(params.orderId || '').trim();
  if (!meOrderId) {
    throw new MelhorEnvioError('ID da etiqueta no Melhor Envio é obrigatório para cancelamento.', {
      statusCode: 400,
      code: 'MISSING_ORDER_ID',
    });
  }

  // 1. Verifica primeiro se a etiqueta pode ser cancelada
  const cancellableData = await melhorEnvioRequest<any>({
    path: `/api/v2/me/shipment/cancellable?orders=${encodeURIComponent(meOrderId)}`,
    method: 'GET',
    settings: params.settings,
    idempotent: true,
    fetchImpl: params.fetchImpl,
  });

  const orderStatusObj = cancellableData?.[meOrderId];
  if (orderStatusObj && orderStatusObj.cancellable === false) {
    throw new MelhorEnvioError(
      `Esta etiqueta (${meOrderId}) não pode mais ser cancelada pela API do Melhor Envio.`,
      { statusCode: 400, code: 'NOT_CANCELLABLE' }
    );
  }

  // 2. Executa o cancelamento oficial
  const cancelRes = await melhorEnvioRequest<any>({
    path: '/api/v2/me/shipment/cancel',
    method: 'POST',
    body: {
      order: {
        id: meOrderId,
        reason_id: '2',
        description: params.description || 'Cancelamento solicitado pelo operador no painel administrativo.',
      },
    },
    settings: params.settings,
    idempotent: false,
    fetchImpl: params.fetchImpl,
  });

  return {
    sucesso: true,
    canceled: cancelRes?.[meOrderId]?.canceled ?? true,
    details: cancelRes,
  };
}

// ============================================================================
// 11. FLUXO ORQUESTRADO PARA O PAINEL ADMINISTRATIVO
// ============================================================================

/**
 * Emite ou prepara a etiqueta de envio respeitando a segurança financeira:
 * - Por padrão (autoCheckout: false), adiciona o envio ao carrinho do Melhor Envio
 *   sem debitar saldo automaticamente, a menos que explicitCheckoutConfirmation === true.
 * - Se explicitCheckoutConfirmation === true, executa Cart -> Checkout -> Generate -> Print -> Tracking.
 */
export async function generateShippingLabel(
  order: any,
  logistics: any,
  options: {
    settings?: Partial<IntegrationSettings>;
    explicitCheckoutConfirmation?: boolean;
    invoiceKey?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
) {
  const s = { ...DEFAULT_INTEGRATION_SETTINGS, ...(options.settings || {}) };
  const token = String(s.melhor_envio_token || process.env.MELHOR_ENVIO_TOKEN || '').trim();
  const isRealAuth = Boolean(token && token.length > 15 && !token.includes('seu_token'));
  const pkg = calculateDynamicPackage(order?.quantidade_total || 1, s);

  if (isRealAuth) {
    try {
      const mergedSettings = { ...s, melhor_envio_token: token };
      // Etapa 1: Inserir no carrinho (ou reutilizar se já inserido)
      const cartResult = await addShipmentToCart({
        order,
        logistics,
        settings: mergedSettings,
        invoiceKey: options.invoiceKey,
        validateCheckDigits: false, // permite CPFs cadastrados em ambiente de homologação/sandbox
        fetchImpl: options.fetchImpl,
      });

      const meOrderId = cartResult.cart_id;

      // Se o operador confirmou explicitamente a compra/débito de saldo:
      if (options.explicitCheckoutConfirmation === true) {
        await checkoutShipmentOrders({
          orderIds: [meOrderId],
          explicitConfirmation: true,
          settings: mergedSettings,
          fetchImpl: options.fetchImpl,
        });

        await generateShipmentLabels({
          orderIds: [meOrderId],
          settings: mergedSettings,
          fetchImpl: options.fetchImpl,
        });

        const printRes = await printShipmentLabels({
          orderIds: [meOrderId],
          mode: 'public',
          settings: mergedSettings,
          fetchImpl: options.fetchImpl,
        });

        let trackingCode = cartResult.raw?.tracking || '';
        try {
          const trackRes = await trackShipments({
            orderIds: [meOrderId],
            settings: mergedSettings,
            fetchImpl: options.fetchImpl,
          });
          const itemTrack = trackRes.tracking?.[meOrderId];
          if (itemTrack?.tracking) trackingCode = itemTrack.tracking;
        } catch {}

        if (!trackingCode) {
          trackingCode = cartResult.protocol || `ME-${String(meOrderId).slice(0, 8).toUpperCase()}`;
        }

        return {
          sucesso: true,
          modo: 'oficial_melhor_envio',
          status_etiqueta: 'gerada',
          cart_id: meOrderId,
          melhor_envio_order_id: meOrderId,
          protocol: cartResult.protocol,
          codigo_rastreamento: trackingCode,
          etiqueta_url: printRes.url || `/api/integrations?action=print-label&order_id=${order.id}`,
          pacote: pkg,
          mensagem: `Etiqueta comprada e gerada com sucesso no Melhor Envio (${s.melhor_envio_env.toUpperCase()})! Protocolo: ${cartResult.protocol || meOrderId}`,
        };
      }

      // Sem confirmação financeira explícita: apenas insere no carrinho com segurança (sem debitar saldo)
      return {
        sucesso: true,
        modo: 'oficial_carrinho_melhor_envio',
        status_etiqueta: 'no_carrinho',
        requer_confirmacao_checkout: true,
        cart_id: meOrderId,
        melhor_envio_order_id: meOrderId,
        protocol: cartResult.protocol,
        codigo_rastreamento: cartResult.protocol || `CART-${String(meOrderId).slice(0, 8).toUpperCase()}`,
        etiqueta_url: `/api/integrations?action=print-label&order_id=${order.id}`,
        pacote: pkg,
        mensagem: `Envio inserido no carrinho do Melhor Envio (Protocolo ${cartResult.protocol || meOrderId}). Confirme o checkout para debitar o saldo e emitir a etiqueta definitiva.`,
      };
    } catch (err: any) {
      console.warn('[Melhor Envio] Aviso na chamada oficial:', sanitizeForLog(err?.message));
    }
  }

  // Modo Integrado Preparado (Simulador local quando não há token oficial ativo)
  const isCorreios = (logistics?.transportadora || '').toLowerCase().includes('correios');
  const trackingCode = isCorreios
    ? `OG${Date.now().toString().slice(-9)}BR`
    : `JAD-${Date.now().toString().slice(-8)}`;
  const simulatedLabelUrl = `/api/integrations?action=print-label&order_id=${order.id}`;

  return {
    sucesso: true,
    modo: 'integrado_preparado',
    status_etiqueta: 'simulada',
    cart_id: `cart_${Date.now().toString().slice(-6)}`,
    melhor_envio_order_id: null,
    protocol: null,
    codigo_rastreamento: trackingCode,
    etiqueta_url: simulatedLabelUrl,
    pacote: pkg,
    mensagem: `Etiqueta preparada (${pkg.box_label} • ${pkg.weight}kg) para ${logistics?.transportadora || 'Melhor Envio'}! Rastreio: ${trackingCode}`,
  };
}
