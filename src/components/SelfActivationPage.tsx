import React, { useState, useEffect } from 'react';
import { QrCode, CheckCircle2, ShieldCheck, ArrowRight, ExternalLink, Sparkles, AlertCircle, RefreshCw, Lock, Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { maskPhone, formatPlkCode } from '../utils/masks.js';

export const SelfActivationPage: React.FC = () => {
  const [codigoInput, setCodigoInput] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('codigo') || urlParams.get('c') || '';
    } catch {
      return '';
    }
  });

  const [verifying, setVerifying] = useState(false);
  const [placaData, setPlacaData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulário de ativação / edição
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [linkDestino, setLinkDestino] = useState('');
  const [pin, setPin] = useState('');
  const [tipoDestino, setTipoDestino] = useState<'instagram' | 'whatsapp' | 'google_reviews' | 'website' | 'personalizado'>('instagram');
  const [saving, setSaving] = useState(false);

  // Se veio código na URL, busca automaticamente
  useEffect(() => {
    if (codigoInput.trim()) {
      handleVerificarPlaca(codigoInput.trim());
    }
  }, []);

  const handleVerificarPlaca = async (codigoParaBuscar?: string) => {
    const raw = codigoParaBuscar || codigoInput;
    if (!raw.trim()) {
      setErrorMessage('Digite o código gravado na sua placa (ex: PLK-000008 ou apenas o número).');
      return;
    }

    const formatted = formatPlkCode(raw);
    setCodigoInput(formatted);
    setVerifying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.checkPlateForActivation(formatted);
      if (res.sucesso && res.placa) {
        setPlacaData(res.placa);
        if (res.placa.nome_estabelecimento) setNomeEstabelecimento(res.placa.nome_estabelecimento);
        if (res.placa.contato_telefone) setWhatsapp(maskPhone(res.placa.contato_telefone));
        if (res.placa.url_destino) setLinkDestino(res.placa.url_destino);
        if (res.placa.tipo_destino) setTipoDestino(res.placa.tipo_destino);
      } else {
        setErrorMessage(res.mensagem || 'Placa não encontrada.');
        setPlacaData(null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao buscar placa. Verifique o código e tente novamente.');
      setPlacaData(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleSalvarAtivacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placaData) return;

    if (!linkDestino.trim()) {
      setErrorMessage('Por favor, informe o link de destino (Instagram, WhatsApp, Avaliação Google, etc.).');
      return;
    }

    const cleanPin = pin.replace(/\D/g, '').slice(0, 4);
    if (cleanPin.length !== 4) {
      setErrorMessage('Defina seu PIN de segurança com exatamente 4 dígitos numéricos para poder alterar seu link quando quiser.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await api.selfActivatePlate({
        codigo_sequencial: placaData.codigo_sequencial,
        nome_estabelecimento: nomeEstabelecimento.trim(),
        contato_whatsapp: whatsapp.trim(),
        url_destino: linkDestino.trim(),
        pin: cleanPin,
        tipo_destino: tipoDestino,
      });

      if (res.sucesso) {
        setSuccessMessage(res.mensagem);
        setPlacaData({
          ...placaData,
          status_digital: 'ativa',
          url_destino: res.placa?.url_destino || linkDestino.trim(),
          ja_ativada: true,
          tem_pin: true,
        });

        // Notifica instantaneamente o Painel do Administrador aberto em outra aba
        try {
          const bc = new BroadcastChannel('venda_direta_sync');
          bc.postMessage({ type: 'plate_activated', code: placaData.codigo_sequencial, timestamp: Date.now() });
          bc.close();
        } catch (e) {}
        try {
          localStorage.setItem('venda_direta_last_update', String(Date.now()));
        } catch (e) {}
      } else {
        setErrorMessage(res.mensagem || 'Falha ao ativar placa.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao processar ativação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase">Atelier das Placas</h1>
            <p className="text-[10px] text-emerald-400 font-bold tracking-wider">AUTOATIVAÇÃO DE PLACAS QR & NFC</p>
          </div>
        </div>
        <span className="text-[10px] bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded-full text-slate-400 flex items-center gap-1 font-mono">
          <ShieldCheck className="w-3 h-3 text-emerald-400" /> Oficial
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto my-auto py-6 space-y-5">
        {/* Card Principal */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-5">
          {/* Instruções Iniciais */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Ativação Rápida em 1 Minuto
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Ative sua Placa Inteligente</h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Digite o código que veio gravado na sua placa física para configurar o link para onde seus clientes irão.
            </p>
          </div>

          {/* Mensagens de Feedback */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Placa Ativada com Sucesso!</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Agora, quando qualquer pessoa aproximar o celular do NFC ou escanear o QR Code da sua placa física, será direcionada imediatamente para o seu link.
              </p>
              {placaData?.url_destino && (
                <a
                  href={placaData.url_destino}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-mono underline break-all pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Testar meu link agora</span>
                </a>
              )}
            </div>
          )}

          {/* Passo 1: Busca do Código */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              Código da Placa <span className="text-slate-500 font-normal">(impresso na placa)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ex: 8 ou PLK-000008"
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleVerificarPlaca();
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
              </div>
              <button
                type="button"
                onClick={() => handleVerificarPlaca()}
                disabled={verifying}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-2xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Buscar</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 block">
              Dica: você pode digitar apenas o número (ex: 8) que o sistema converte para PLK-000008 automaticamente.
            </span>
          </div>

          {/* Passo 2: Formulário de Configuração do Link (Aparece após encontrar a placa) */}
          {placaData && (
            <form onSubmit={handleSalvarAtivacao} className="space-y-4 pt-3 border-t border-slate-800 animate-fadeIn">
              {/* Badge de Identificação da Placa Encontrada */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Placa Selecionada:</span>
                  <span className="font-mono text-sm font-black text-emerald-400">{placaData.codigo_sequencial}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  placaData.status_digital === 'ativa'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {placaData.status_digital === 'ativa' ? '✓ Placa Ativa' : '● Aguardando Ativação'}
                </span>
              </div>

              {/* Nome do Negócio */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Nome do seu Negócio / Estabelecimento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Barbearia VIP ou Dra. Mariana"
                  value={nomeEstabelecimento}
                  onChange={(e) => setNomeEstabelecimento(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* WhatsApp do Responsável */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Seu WhatsApp de Contato
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Tipo de Destino (Atalhos) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">Tipo de Link</label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {[
                    { id: 'instagram', label: 'Instagram' },
                    { id: 'whatsapp', label: 'WhatsApp' },
                    { id: 'google_reviews', label: 'Avaliação Google' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTipoDestino(t.id as any)}
                      className={`py-1.5 px-2 rounded-lg font-semibold transition border ${
                        tipoDestino === t.id
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link de Destino Principal */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  Link de Destino Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    tipoDestino === 'instagram'
                      ? 'https://instagram.com/seunegocio'
                      : tipoDestino === 'whatsapp'
                      ? 'https://wa.me/5521999999999'
                      : 'https://seusite.com.br ou link do Google'
                  }
                  value={linkDestino}
                  onChange={(e) => setLinkDestino(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* PIN de Segurança (4 dígitos) */}
              <div className="space-y-1 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <label className="block text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{placaData.tem_pin ? 'Digite seu PIN de Segurança' : 'Crie seu PIN de Segurança (4 dígitos)'}</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  placeholder="Ex: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-center font-bold text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block text-center">
                  {placaData.tem_pin
                    ? 'Informe o mesmo PIN de 4 números criado na primeira ativação para liberar a alteração do link.'
                    : 'Guarde este PIN! Ele permitirá que você mesmo altere o link no futuro a qualquer momento.'}
                </span>
              </div>

              {/* Botão de Submissão */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Gravando Placa na Nuvem...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>{placaData.ja_ativada ? 'Salvar Novo Link da Placa' : 'Ativar Minha Placa Agora'}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-4 border-t border-slate-800 text-[11px] text-slate-500 space-y-1">
        <p>© {new Date().getFullYear()} Atelier das Placas Inteligentes · Tecnologia QR Code Dinâmico e NFC</p>
        <p className="text-[10px] text-slate-600">Precisa de suporte? Entre em contato pelo WhatsApp oficial do Atelier.</p>
      </footer>
    </div>
  );
};

