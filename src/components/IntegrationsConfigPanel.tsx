import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Truck,
  CreditCard,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Package,
  MapPin,
  Copy,
  Check,
  Calculator,
  ShieldCheck,
  Box,
  Scale,
  Ruler,
  Zap,
} from 'lucide-react';
import { api } from '../api.js';
import type { IntegrationSettings, ShippingOption } from '../types.js';
import {
  DEFAULT_INTEGRATION_SETTINGS,
  calculateDynamicPackage,
  hydrateModeSpecificSettings,
} from '../utils/shippingCalculator.js';

interface IntegrationsConfigPanelProps {
  onFeedback?: (msg: string) => void;
}

export default function IntegrationsConfigPanel({ onFeedback }: IntegrationsConfigPanelProps) {
  const [settings, setSettings] = useState<IntegrationSettings>(DEFAULT_INTEGRATION_SETTINGS);
  const [status, setStatus] = useState({
    asaas_configured: false,
    melhor_envio_configured: false,
    gemini_configured: false,
  });
  const [activeSubTab, setActiveSubTab] = useState<'melhor_envio' | 'asaas' | 'gemini'>('melhor_envio');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Visibilidade de chaves secretas
  const [showMelhorEnvioToken, setShowMelhorEnvioToken] = useState(false);
  const [showMelhorEnvioClientSecret, setShowMelhorEnvioClientSecret] = useState(false);
  const [showMelhorEnvioWebhookSecret, setShowMelhorEnvioWebhookSecret] = useState(false);
  const [showAsaasKey, setShowAsaasKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [authorizingOAuth, setAuthorizingOAuth] = useState(false);

  // Simulador Ao Vivo de Cubagem e Frete
  const [simQty, setSimQty] = useState<number>(10);
  const [simCep, setSimCep] = useState<string>('01310-100');
  const [simLoading, setSimLoading] = useState(false);
  const [simOptions, setSimOptions] = useState<ShippingOption[]>([]);
  const [simMode, setSimMode] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getIntegrationSettings();
      if (res.sucesso && res.settings) {
        setSettings(hydrateModeSpecificSettings(res.settings));
        if (res.status) setStatus(res.status);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações de integrações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await api.saveIntegrationSettings(settings);
      if (res.settings) setSettings(hydrateModeSpecificSettings(res.settings));
      if (res.status) setStatus(res.status);
      const msg = res.mensagem || 'Configurações salvas e sincronizadas com sucesso!';
      if (onFeedback) onFeedback(msg);
      setTestResult({ ok: true, message: msg });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Erro ao salvar configurações.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMelhorEnvioEnvChange = (newEnv: 'sandbox' | 'production') => {
    setSettings((prev) =>
      hydrateModeSpecificSettings({
        ...prev,
        melhor_envio_env: newEnv,
      })
    );
  };

  const updateMelhorEnvioField = (
    field: 'token' | 'client_id' | 'client_secret' | 'redirect_uri' | 'webhook_secret',
    value: string
  ) => {
    setSettings((prev) => {
      const isProd = prev.melhor_envio_env === 'production';
      const modeKey = `melhor_envio_${isProd ? 'production' : 'sandbox'}_${field}` as keyof IntegrationSettings;
      const activeKey = `melhor_envio_${field}` as keyof IntegrationSettings;
      return {
        ...prev,
        [modeKey]: value,
        [activeKey]: value,
      };
    });
  };

  const handleAsaasEnvChange = (newEnv: 'sandbox' | 'production') => {
    setSettings((prev) =>
      hydrateModeSpecificSettings({
        ...prev,
        asaas_env: newEnv,
      })
    );
  };

  const updateAsaasField = (
    field: 'api_key' | 'webhook_token' | 'wallet_id',
    value: string
  ) => {
    setSettings((prev) => {
      const isProd = prev.asaas_env === 'production';
      const modeKey = `asaas_${isProd ? 'production' : 'sandbox'}_${field}` as keyof IntegrationSettings;
      const activeKey = `asaas_${field}` as keyof IntegrationSettings;
      return {
        ...prev,
        [modeKey]: value,
        [activeKey]: value,
      };
    });
  };

  const isMelhorEnvioTokenActive = Boolean(
    settings.melhor_envio_token &&
      settings.melhor_envio_token.trim().length > 5 &&
      !settings.melhor_envio_token.includes('seu_token')
  );
  const melhorEnvioBadgeText = isMelhorEnvioTokenActive
    ? settings.melhor_envio_env === 'production'
      ? 'Token Produção Ativo'
      : 'Token Sandbox Ativo'
    : 'Simulador Calibrado';

  const isAsaasTokenActive = Boolean(
    settings.asaas_api_key &&
      settings.asaas_api_key.trim().length > 5 &&
      !settings.asaas_api_key.includes('MY_')
  );
  const asaasBadgeText = isAsaasTokenActive
    ? settings.asaas_env === 'production'
      ? 'Token Produção Ativo'
      : 'Token Sandbox Ativo'
    : 'Sem Token Ativo';

  const handleStartMelhorEnvioOAuth = async () => {
    setAuthorizingOAuth(true);
    setTestResult(null);
    try {
      const res = await api.getMelhorEnvioOAuthUrl(
        settings.melhor_envio_env,
        settings.melhor_envio_client_id,
        settings.melhor_envio_redirect_uri
      );
      if (res.sucesso && res.authorize_url) {
        window.location.href = res.authorize_url;
      } else {
        throw new Error('Não foi possível obter a URL de autorização OAuth2.');
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Erro ao iniciar fluxo OAuth2 com o Melhor Envio.',
      });
      setAuthorizingOAuth(false);
    }
  };

  const handleTestConnection = async (provider: 'asaas' | 'melhor_envio' | 'gemini') => {
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await api.testIntegration(provider, settings);
      setTestResult({ ok: res.sucesso, message: res.mensagem });
      if (res.sucesso && onFeedback) onFeedback(res.mensagem);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Não foi possível validar a conexão.',
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleLookupOriginCep = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setSettings((prev) => ({
          ...prev,
          origem_cep: clean.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
          origem_logradouro: d.logradouro || prev.origem_logradouro,
          origem_bairro: d.bairro || prev.origem_bairro,
          origem_cidade: d.localidade || prev.origem_cidade,
          origem_uf: d.uf || prev.origem_uf,
        }));
      }
    } catch {}
  };

  const livePackage = useMemo(() => {
    return calculateDynamicPackage(simQty, settings);
  }, [simQty, settings]);

  const handleRunSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await api.calculateShipping(simCep, simQty, settings);
      setSimOptions(res.opcoes || []);
      setSimMode(res.modo || 'simulador_calibrado');
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'Erro ao simular frete.' });
    } finally {
      setSimLoading(false);
    }
  };

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/integrations?action=asaas-webhook`
      : 'https://placasinteligentes.vercel.app/api/integrations?action=asaas-webhook';

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-medium">Carregando central de integrações e parâmetros de frete...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho Principal */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold mb-2">
              <Settings className="w-3.5 h-3.5" />
              CENTRAL DE INTEGRAÇÕES & PARÂMETROS LOGÍSTICOS
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Configurações de Integrações (Melhor Envio, Asaas & Gemini AI)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gerencie todas as chaves de API, credenciais, endereço de origem e as medidas/pesos das placas e caixas para cálculo automático de frete.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Salvando...' : 'Salvar Todas as Configurações'}</span>
            </button>
          </div>
        </div>

        {/* Cards de Status das 3 Integrações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
          <div
            onClick={() => setActiveSubTab('melhor_envio')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeSubTab === 'melhor_envio'
                ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/15'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Melhor Envio & Cubagem</h3>
                  <p className="text-[11px] text-slate-500">Frete, Placas, Caixas e Etiquetas</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isMelhorEnvioTokenActive
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {melhorEnvioBadgeText}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Ambiente: <strong>{settings.melhor_envio_env === 'production' ? 'PRODUÇÃO' : 'SANDBOX'}</strong> • Placa: <strong>{Math.round((settings.placa_peso_kg || 0.06) * 1000)}g</strong> ({settings.placa_largura_cm}x{settings.placa_comprimento_cm}cm)
            </p>
          </div>

          <div
            onClick={() => setActiveSubTab('asaas')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeSubTab === 'asaas'
                ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/15'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Asaas Pagamentos</h3>
                  <p className="text-[11px] text-slate-500">PIX QR Code, Boleto e Webhook</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isAsaasTokenActive
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {asaasBadgeText}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Ambiente: <strong>{settings.asaas_env === 'production' ? 'PRODUÇÃO' : 'SANDBOX'}</strong> • Vencimento padrão: <strong>{settings.asaas_dias_vencimento} dias</strong>
            </p>
          </div>

          <div
            onClick={() => setActiveSubTab('gemini')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              activeSubTab === 'gemini'
                ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/15'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Google Gemini AI (OCR)</h3>
                  <p className="text-[11px] text-slate-500">Leitura de Comprovantes de Envio</p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  status.gemini_configured
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {status.gemini_configured ? 'IA Conectada' : 'Aguardando Chave'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-2">
              Modelo ativo: <strong>{settings.gemini_model || 'gemini-3.5-flash'}</strong> • Auto-preenchimento ativo
            </p>
          </div>
        </div>

        {/* Alerta de feedback de teste/salvamento */}
        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
              testResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-xs underline opacity-75 hover:opacity-100"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* ABA 1: MELHOR ENVIO + PESOS, PLACAS E CAIXAS */}
      {activeSubTab === 'melhor_envio' && (
        <div className="space-y-6">
          {/* Bloco 1: Credenciais da API do Melhor Envio */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-600" />
                    1. Credenciais, OAuth2 e Ambiente Oficial do Melhor Envio
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      isMelhorEnvioTokenActive
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {melhorEnvioBadgeText}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conecte sua conta do Melhor Envio via <strong>OAuth2 Authorization Code</strong> oficial ou informe o Bearer Token. As credenciais de <strong>Sandbox</strong> e <strong>Produção</strong> são independentes e salvas separadamente.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartMelhorEnvioOAuth}
                  disabled={authorizingOAuth}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0 disabled:opacity-50"
                  title="Abre a tela oficial do Melhor Envio para autorizar a aplicação"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{authorizingOAuth ? 'Redirecionando...' : 'Conectar via OAuth2'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTestConnection('melhor_envio')}
                  disabled={testingProvider === 'melhor_envio'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{testingProvider === 'melhor_envio' ? 'Testando API...' : 'Testar Conexão Melhor Envio'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ambiente da API
                </label>
                <select
                  value={settings.melhor_envio_env}
                  onChange={(e) => handleMelhorEnvioEnvChange(e.target.value as 'sandbox' | 'production')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="sandbox">Sandbox (https://sandbox.melhorenvio.com.br)</option>
                  <option value="production">Produção Oficial (https://melhorenvio.com.br)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  OAuth2 Client ID ({settings.melhor_envio_env === 'production' ? 'Produção' : 'Sandbox'})
                </label>
                <input
                  type="text"
                  value={settings.melhor_envio_client_id || ''}
                  onChange={(e) => updateMelhorEnvioField('client_id', e.target.value)}
                  placeholder="Ex: 1234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  OAuth2 Client Secret ({settings.melhor_envio_env === 'production' ? 'Produção' : 'Sandbox'})
                </label>
                <div className="relative">
                  <input
                    type={showMelhorEnvioClientSecret ? 'text' : 'password'}
                    value={settings.melhor_envio_client_secret || ''}
                    onChange={(e) => updateMelhorEnvioField('client_secret', e.target.value)}
                    placeholder="Chave secreta do app Melhor Envio"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMelhorEnvioClientSecret(!showMelhorEnvioClientSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showMelhorEnvioClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Redirect URI do OAuth2 ({settings.melhor_envio_env === 'production' ? 'Produção' : 'Sandbox'})
                </label>
                <input
                  type="text"
                  value={settings.melhor_envio_redirect_uri || ''}
                  onChange={(e) => updateMelhorEnvioField('redirect_uri', e.target.value)}
                  placeholder="https://placasinteligentes.vercel.app/api/integrations?action=melhor-envio-oauth-callback"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Cadastre exatamente esta URL no seu aplicativo no painel do Melhor Envio (Área Dev).
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Webhook Secret ({settings.melhor_envio_env === 'production' ? 'Produção' : 'Sandbox'})
                </label>
                <div className="relative">
                  <input
                    type={showMelhorEnvioWebhookSecret ? 'text' : 'password'}
                    value={settings.melhor_envio_webhook_secret || ''}
                    onChange={(e) => updateMelhorEnvioField('webhook_secret', e.target.value)}
                    placeholder="Segredo do webhook"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMelhorEnvioWebhookSecret(!showMelhorEnvioWebhookSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showMelhorEnvioWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bearer Token de Acesso Ativo — {settings.melhor_envio_env === 'production' ? 'Modo Produção' : 'Modo Sandbox'}
                </label>
                <div className="relative">
                  <input
                    type={showMelhorEnvioToken ? 'text' : 'password'}
                    value={settings.melhor_envio_token || ''}
                    onChange={(e) => updateMelhorEnvioField('token', e.target.value)}
                    placeholder={`Token Bearer de ${settings.melhor_envio_env === 'production' ? 'Produção' : 'Sandbox'} do Melhor Envio`}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMelhorEnvioToken(!showMelhorEnvioToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showMelhorEnvioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {settings.melhor_envio_token_expires_at && (
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>
                      Token OAuth renovável ativo até:{' '}
                      {new Date(settings.melhor_envio_token_expires_at).toLocaleString('pt-BR')} (Renovação automática via refresh token)
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  User-Agent (Identificação Exigida pela API)
                </label>
                <input
                  type="text"
                  value={settings.melhor_envio_user_agent}
                  onChange={(e) => setSettings({ ...settings, melhor_envio_user_agent: e.target.value })}
                  placeholder="AtelierDasPlacas (contato@empresa.com.br)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IDs dos Serviços de Transporte Cotados
                </label>
                <input
                  type="text"
                  value={settings.melhor_envio_servicos}
                  onChange={(e) => setSettings({ ...settings, melhor_envio_servicos: e.target.value })}
                  placeholder="1,2,3,4,17 (PAC, SEDEX, Jadlog, Loggi)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <span className="text-[10px] text-slate-400">1=PAC, 2=SEDEX, 3=Jadlog .Package, 4=Jadlog .Com, 17=Loggi</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dias para Produção (Regra Interna)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={settings.melhor_envio_dias_producao ?? 0}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      melhor_envio_dias_producao: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    })
                  }
                  placeholder="Ex: 2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Soma automaticamente +X dia(s) ao prazo exibido da transportadora para o revendedor (sem exibir aviso de produção).
                </span>
              </div>

              <div className="flex items-center pt-5">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.melhor_envio_seguro_automatico}
                    onChange={(e) =>
                      setSettings({ ...settings, melhor_envio_seguro_automatico: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Declarar Valor / Seguro Automático nas Cotações
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Bloco 2: Peso e Tamanho das Placas e Caixas / Embalagens */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-600" />
                2. Pesos e Dimensões das Placas, Caixas e Embalagens (Cálculo de Frete)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure o peso unitário e tamanho de cada placa, a tara da embalagem e as dimensões das caixas. O checkout do revendedor e a geração de etiquetas usam exatamente estes valores.
              </p>
            </div>

            {/* Sub-seção: Placa Unitária */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-blue-600" />
                  Medidas e Peso da Placa Unitária (Acrílico + NFC)
                </h4>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  1 placa = {Math.round((Number(settings.placa_peso_kg) || 0.06) * 1000)} gramas
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Peso de 1 Placa (kg)
                  </label>
                  <input
                    type="number"
                    step="0.005"
                    min="0.005"
                    value={settings.placa_peso_kg}
                    onChange={(e) =>
                      setSettings({ ...settings, placa_peso_kg: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ex: 0.06 = 60g por placa</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Largura da Placa (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={settings.placa_largura_cm}
                    onChange={(e) =>
                      setSettings({ ...settings, placa_largura_cm: parseFloat(e.target.value) || 10 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Padrão: 10 cm</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Comprimento / Altura (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={settings.placa_comprimento_cm}
                    onChange={(e) =>
                      setSettings({ ...settings, placa_comprimento_cm: parseFloat(e.target.value) || 15 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Padrão: 15 cm</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Espessura Empilhada (cm)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={settings.placa_espessura_cm}
                    onChange={(e) =>
                      setSettings({ ...settings, placa_espessura_cm: parseFloat(e.target.value) || 0.4 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ex: 0.4 cm (4mm c/ espuma)</span>
                </div>
              </div>
            </div>

            {/* Sub-seção: Caixas e Embalagens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Caixa Padrão */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Caixa Padrão (Pedidos Pequenos e Médios)
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Até {settings.caixa_padrao_max_placas} placas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Tara da Caixa (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.embalagem_tara_kg}
                      onChange={(e) =>
                        setSettings({ ...settings, embalagem_tara_kg: parseFloat(e.target.value) || 0.1 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                    <span className="text-[10px] text-slate-400">
                      {Math.round((Number(settings.embalagem_tara_kg) || 0.1) * 1000)}g (caixa vazia)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Máx. Placas na Caixa
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.caixa_padrao_max_placas}
                      onChange={(e) =>
                        setSettings({ ...settings, caixa_padrao_max_placas: parseInt(e.target.value, 10) || 30 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Largura Caixa (cm)
                    </label>
                    <input
                      type="number"
                      min="11"
                      value={settings.caixa_padrao_largura_cm}
                      onChange={(e) =>
                        setSettings({ ...settings, caixa_padrao_largura_cm: parseFloat(e.target.value) || 14 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Comprimento (cm)
                    </label>
                    <input
                      type="number"
                      min="16"
                      value={settings.caixa_padrao_comprimento_cm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          caixa_padrao_comprimento_cm: parseFloat(e.target.value) || 18,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Altura Mínima (cm)
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={settings.caixa_padrao_altura_min_cm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          caixa_padrao_altura_min_cm: parseFloat(e.target.value) || 4,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Folga Proteção (cm)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.caixa_padrao_folga_altura_cm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          caixa_padrao_folga_altura_cm: parseFloat(e.target.value) || 3,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Caixa Grande / Atacado */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-amber-600" />
                    Caixa Grande / Atacado (Lotes Maiores)
                  </h4>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Acima de {settings.caixa_padrao_max_placas} placas
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Largura (cm)
                    </label>
                    <input
                      type="number"
                      min="11"
                      value={settings.caixa_grande_largura_cm}
                      onChange={(e) =>
                        setSettings({ ...settings, caixa_grande_largura_cm: parseFloat(e.target.value) || 22 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Comprimento (cm)
                    </label>
                    <input
                      type="number"
                      min="16"
                      value={settings.caixa_grande_comprimento_cm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          caixa_grande_comprimento_cm: parseFloat(e.target.value) || 30,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Altura Mín. (cm)
                    </label>
                    <input
                      type="number"
                      min="4"
                      value={settings.caixa_grande_altura_min_cm}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          caixa_grande_altura_min_cm: parseFloat(e.target.value) || 8,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Altura Máx. (cm)
                    </label>
                    <input
                      type="number"
                      min="15"
                      value={settings.caixa_altura_max_cm}
                      onChange={(e) =>
                        setSettings({ ...settings, caixa_altura_max_cm: parseFloat(e.target.value) || 60 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Na Caixa Grande, o sistema acomoda automaticamente as placas em 2 colunas internas para otimizar a altura e reduzir o peso cubado nas transportadoras.
                </p>
              </div>
            </div>

            {/* Simulador Ao Vivo de Cubagem e Frete */}
            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Simulador Ao Vivo de Embalagem, Peso e Cotação de Frete
                  </h4>
                  <p className="text-[11px] text-blue-700">
                    Teste agora mesmo como o sistema calcula a caixa e o frete para qualquer quantidade de placas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200">
                    <span className="text-xs text-slate-600 font-medium">Qtd. Placas:</span>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={simQty}
                      onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-16 text-xs font-bold text-slate-900 border-b border-slate-300 focus:outline-none text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200">
                    <span className="text-xs text-slate-600 font-medium">CEP Destino:</span>
                    <input
                      type="text"
                      value={simCep}
                      onChange={(e) => setSimCep(e.target.value)}
                      placeholder="01310-100"
                      className="w-24 text-xs font-bold text-slate-900 border-b border-slate-300 focus:outline-none text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={simLoading}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    {simLoading ? 'Cotando...' : 'Simular Frete'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Caixa Selecionada</span>
                  <span className="text-xs font-bold text-slate-800">{livePackage.box_label}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Peso Total Envio</span>
                  <span className="text-xs font-bold text-slate-800">
                    {livePackage.weight} kg ({Math.round(livePackage.weight * 1000)}g)
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Composição do Peso</span>
                  <span className="text-xs font-semibold text-slate-700">
                    Placas: {livePackage.plates_weight_kg}kg + Caixa: {livePackage.tare_weight_kg}kg
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Medidas Finais (L×C×A)</span>
                  <span className="text-xs font-bold text-blue-700">
                    {livePackage.width} × {livePackage.length} × {livePackage.height} cm
                  </span>
                </div>
              </div>

              {simOptions.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-slate-600 mb-2">
                    Resultado da Cotação ({simMode === 'oficial_melhor_envio' ? 'API Oficial Melhor Envio' : 'Motor Regional Calibrado'}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {simOptions.map((opt) => (
                      <div
                        key={opt.service_id}
                        className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {opt.carrier_name} {opt.service_name}
                          </span>
                          {opt.is_cheapest && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                              Mais Barato
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-baseline justify-between">
                          <span className="text-sm font-extrabold text-blue-700">
                            R$ {opt.price.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500">{opt.delivery_time} dias úteis</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bloco 3: Endereço e Dados do Remetente (Origem do Atelier) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                3. Dados do Remetente e CEP de Origem (Expedição do Atelier)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Estes dados constam como remetente nas etiquetas do Melhor Envio e definem o CEP de origem para o cálculo de frete.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Nome / Razão Social Remetente</label>
                <input
                  type="text"
                  value={settings.origem_nome}
                  onChange={(e) => setSettings({ ...settings, origem_nome: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CPF / CNPJ Remetente</label>
                <input
                  type="text"
                  value={settings.origem_cpf_cnpj}
                  onChange={(e) => setSettings({ ...settings, origem_cpf_cnpj: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Telefone / WhatsApp Expedição</label>
                <input
                  type="text"
                  value={settings.origem_telefone}
                  onChange={(e) => setSettings({ ...settings, origem_telefone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">CEP de Origem</label>
                <input
                  type="text"
                  value={settings.origem_cep}
                  onChange={(e) => {
                    setSettings({ ...settings, origem_cep: e.target.value });
                    if (e.target.value.replace(/\D/g, '').length === 8) {
                      handleLookupOriginCep(e.target.value);
                    }
                  }}
                  placeholder="22745-271"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Logradouro / Rua</label>
                <input
                  type="text"
                  value={settings.origem_logradouro}
                  onChange={(e) => setSettings({ ...settings, origem_logradouro: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Número</label>
                <input
                  type="text"
                  value={settings.origem_numero}
                  onChange={(e) => setSettings({ ...settings, origem_numero: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Complemento</label>
                <input
                  type="text"
                  value={settings.origem_complemento}
                  onChange={(e) => setSettings({ ...settings, origem_complemento: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={settings.origem_bairro}
                  onChange={(e) => setSettings({ ...settings, origem_bairro: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  value={settings.origem_cidade}
                  onChange={(e) => setSettings({ ...settings, origem_cidade: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">UF</label>
                <input
                  type="text"
                  maxLength={2}
                  value={settings.origem_uf}
                  onChange={(e) => setSettings({ ...settings, origem_uf: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm uppercase"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ASAAS PAGAMENTOS */}
      {activeSubTab === 'asaas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Configuração do Gateway de Pagamentos Asaas (PIX, Boleto & Webhook)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    isAsaasTokenActive
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {asaasBadgeText}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure a chave de API do Asaas para gerar QR Codes PIX reais e aprovar pedidos automaticamente via Webhook. As credenciais de <strong>Sandbox</strong> e <strong>Produção</strong> são independentes e salvas separadamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection('asaas')}
              disabled={testingProvider === 'asaas'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{testingProvider === 'asaas' ? 'Validando Asaas...' : 'Testar Conexão Asaas'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ambiente Asaas
              </label>
              <select
                value={settings.asaas_env}
                onChange={(e) => handleAsaasEnvChange(e.target.value as 'sandbox' | 'production')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="sandbox">Sandbox (Homologação — sandbox.asaas.com)</option>
                <option value="production">Produção (Oficial — api.asaas.com)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chave de API do Asaas — {settings.asaas_env === 'production' ? 'Modo Produção' : 'Modo Sandbox'}
              </label>
              <div className="relative">
                <input
                  type={showAsaasKey ? 'text' : 'password'}
                  value={settings.asaas_api_key || ''}
                  onChange={(e) => updateAsaasField('api_key', e.target.value)}
                  placeholder="$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAw..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAsaasKey(!showAsaasKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showAsaasKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Token de Autenticação do Webhook ({settings.asaas_env === 'production' ? 'Produção' : 'Sandbox'})
              </label>
              <input
                type="text"
                value={settings.asaas_webhook_token || ''}
                onChange={(e) => updateAsaasField('webhook_token', e.target.value)}
                placeholder="Token secreto configurado no Webhook Asaas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Wallet ID ({settings.asaas_env === 'production' ? 'Produção' : 'Sandbox'})
              </label>
              <input
                type="text"
                value={settings.asaas_wallet_id || ''}
                onChange={(e) => updateAsaasField('wallet_id', e.target.value)}
                placeholder="ID da Carteira Asaas (se aplicável)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo de Vencimento das Cobranças (Dias)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.asaas_dias_vencimento}
                onChange={(e) =>
                  setSettings({ ...settings, asaas_dias_vencimento: parseInt(e.target.value, 10) || 3 })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                URL Oficial do Webhook para Cadastrar no Painel do Asaas:
              </span>
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? 'Copiado!' : 'Copiar URL'}</span>
              </button>
            </div>
            <code className="block text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200 text-blue-700 break-all">
              {webhookUrl}
            </code>
            <p className="text-[11px] text-slate-500">
              No painel do Asaas, vá em <strong>Minha Conta → Integrações → Webhooks</strong>, cole a URL acima e marque os eventos <code>PAYMENT_RECEIVED</code> e <code>PAYMENT_CONFIRMED</code>. Assim que o revendedor pagar o PIX, o pedido é aprovado e os QR Codes são gerados automaticamente!
            </p>
          </div>
        </div>
      )}

      {/* ABA 3: GOOGLE GEMINI AI & WHATSAPP */}
      {activeSubTab === 'gemini' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Google Gemini AI (Leitura OCR de Comprovantes dos Correios) & WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure sua chave do Google AI Studio para ler fotos de comprovantes de envio na aba Despacho e Retirada e extrair o código de rastreamento automaticamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection('gemini')}
              disabled={testingProvider === 'gemini'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{testingProvider === 'gemini' ? 'Testando Gemini AI...' : 'Testar Conexão Gemini AI'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chave de API do Google Gemini (GEMINI_API_KEY)
              </label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={settings.gemini_api_key}
                  onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400">
                Obtenha gratuitamente em aistudio.google.com/apikey
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modelo Multimodal Gemini
              </label>
              <select
                value={settings.gemini_model}
                onChange={(e) => setSettings({ ...settings, gemini_model: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (Recomendado - Rápido e estável)</option>
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Mais econômico)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Econômico)</option>
                <option value="gemini-3.8-flash">gemini-3.8-flash (Mais novo - pode oscilar)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Alta precisão - cota limitada)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Oficial de Atendimento (com DDI 55)
              </label>
              <input
                type="text"
                value={settings.whatsapp_empresa}
                onChange={(e) => setSettings({ ...settings, whatsapp_empresa: e.target.value })}
                placeholder="5521980914107"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="md:col-span-2 flex items-center pt-4">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.gemini_auto_preencher}
                  onChange={(e) =>
                    setSettings({ ...settings, gemini_auto_preencher: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Preencher automaticamente o campo de Código de Rastreamento após leitura da foto do comprovante (mantendo confirmação manual)
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Fixo de Ação */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {settings.updated_at ? (
            <span>
              Última atualização salva no Supabase em:{' '}
              <strong>{new Date(settings.updated_at).toLocaleString('pt-BR')}</strong>
            </span>
          ) : (
            <span>Todas as alterações ficam salvas de forma permanente no banco de dados Supabase.</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Salvando Configurações...' : 'Salvar Todas as Configurações'}</span>
        </button>
      </div>
    </div>
  );
}

