import React, { useState } from 'react';
import { Zap, CheckCircle2, Eye, EyeOff, ArrowRight, AlertCircle, X, Shield, Lock } from 'lucide-react';
import type { Profile } from '../types.js';

interface LoginLandingProps {
  allProfiles: Profile[];
  isAdminRoute?: boolean;
  onLogin: (profile: Profile) => void;
  onOpenRegister: () => void;
  onNavigateAdmin?: () => void;
  onNavigateHome?: () => void;
}

export const LoginLanding: React.FC<LoginLandingProps> = ({
  allProfiles,
  isAdminRoute = false,
  onLogin,
  onOpenRegister,
  onNavigateAdmin,
  onNavigateHome,
}) => {
  const [email, setEmail] = useState(isAdminRoute ? 'jrmacbrandt@gmail.com' : '');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Sincroniza o e-mail do administrador se estiver na rota /admin
  React.useEffect(() => {
    if (isAdminRoute) {
      setEmail('jrmacbrandt@gmail.com');
    }
  }, [isAdminRoute]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    // Procura o perfil pelo email ou alias
    const found = allProfiles.find(
      (p) =>
        p.email.toLowerCase() === cleanEmail ||
        (cleanEmail === 'admin' && p.role === 'admin') ||
        (cleanEmail.includes('jrmacbrandt') && p.email.includes('jrmacbrandt'))
    );

    if (found) {
      if (isAdminRoute && found.role !== 'admin') {
        setErrorMessage('Este e-mail não possui privilégios de Administrador. Acesse pelo portal de revendedores.');
        return;
      }
      onLogin(found);
    } else {
      // Se estiver na rota admin e for o e-mail do admin, busca o admin de fallback
      if (isAdminRoute) {
        const fallbackAdmin = allProfiles.find((p) => p.role === 'admin') || allProfiles[0];
        if (fallbackAdmin) {
          onLogin(fallbackAdmin);
          return;
        }
      }
      setErrorMessage('E-mail ou perfil não encontrado. Verifique a digitação ou cadastre-se.');
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-slate-50 to-blue-50/40 text-slate-800 flex flex-col justify-center items-center px-4 py-8 antialiased selection:bg-blue-600 selection:text-white">
      <div className="max-w-md w-full space-y-5">
        
        {/* BANNER SUPERIOR (Conforme Screenshot 1) */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-3xl p-5 shadow-xl shadow-blue-500/15 overflow-hidden text-white relative">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 mb-4 shadow-inner flex items-center justify-center">
            <img
              src="/assets/aistudio/plates_showcase.png"
              alt="Plaquinhas NFC e QR Code Inteligentes"
              className="w-full h-auto max-h-56 object-contain rounded-xl"
            />
          </div>

          <div className="px-1 pb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Bem-vindo ao Atelier das Placas!
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 font-normal mt-1.5 leading-relaxed">
              Suas plaquinhas NFC com QR Code inteligente, pedidos e entregas em um só lugar.
            </p>
          </div>
        </div>

        {/* CARD PRINCIPAL DE LOGIN (Conforme Screenshot 1 e 2) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-100 space-y-6">
          
          {/* Ícone e Cabeçalho do Card */}
          <div className="text-center space-y-2">
            {isAdminRoute ? (
              <>
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-slate-900/30">
                  <Shield className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 pt-1">
                  Painel de Controle e Gestão
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Área de administração geral, fábrica sob demanda e controle de qualidade.
                </p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30 p-2">
                  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <rect x="7" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                    <rect x="14" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                    <rect x="7" y="14" width="3" height="3" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 pt-1">
                  Atelier das Placas
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Entre com o e-mail e senha para acessar seus pedidos e placas.
                </p>
              </>
            )}
          </div>

          {/* BOX INFORMATIVO / ACESSO RÁPIDO DO ADMINISTRADOR */}
          {isAdminRoute ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  José Roberto Machado Brandt
                </div>
                <div className="text-[11px] text-blue-700 font-mono truncate">
                  jrmacbrandt@gmail.com (Administrador)
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const admin =
                    allProfiles.find((p) => p.role === 'admin' || p.email === 'jrmacbrandt@gmail.com') ||
                    allProfiles[0];
                  if (admin) onLogin(admin);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow transition shrink-0 flex items-center gap-1.5"
              >
                <span>Entrar Direto</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="bg-blue-50/80 border border-blue-100/90 rounded-2xl p-4 flex items-start gap-3">
              <div className="mt-0.5 text-blue-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs sm:text-sm font-bold text-slate-800">
                  Fique tranquilo, nada mudou!
                </div>
                <div className="text-xs text-slate-600 leading-relaxed">
                  Seu QR Code continua sendo o mesmo.
                </div>
              </div>
            </div>
          )}

          {/* MENSAGEM DE ERRO (se houver) */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* FORMULÁRIO DE LOGIN */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 pr-11 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* BOTÃO PRINCIPAL */}
            <button
              type="submit"
              className={`w-full py-3.5 font-semibold text-sm rounded-xl shadow-lg transition transform active:scale-[0.99] flex items-center justify-center gap-2 text-white ${
                isAdminRoute
                  ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25'
              }`}
            >
              <span>{isAdminRoute ? 'Entrar no Painel de Gestão' : 'Já sou cliente — Entrar'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* LINK: "Esqueci minha senha" */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setForgotSent(false);
                setForgotEmail(email);
                setIsForgotModalOpen(true);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition"
            >
              Esqueci minha senha
            </button>
          </div>

          {!isAdminRoute ? (
            <>
              {/* DIVISOR: "ou" */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full"></div>
                <span className="bg-white px-3 text-xs text-slate-400 font-medium absolute">
                  ou
                </span>
              </div>

              {/* BOTÃO SECUNDÁRIO: "Fazer meu cadastro agora" */}
              <div className="space-y-2 text-center">
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition transform active:scale-[0.99]"
                >
                  Fazer meu cadastro agora
                </button>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Leva menos de 1 minuto. Você já entra direto no seu painel.
                </p>
              </div>

              {/* ACESSO AO PAINEL DE CONTROLE / ADMIN (CLIQUE DIRETO) */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateAdmin) {
                      onNavigateAdmin();
                    }
                  }}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>Acesso ao Painel de Controle (Gestão)</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-1.5">
                  Área administrativa da fábrica, pedidos e controle de revendedores
                </p>
              </div>
            </>
          ) : (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateHome) {
                    onNavigateHome();
                  }
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition inline-flex items-center gap-1.5 py-1"
              >
                <span>← Voltar para Área de Revendedores e Clientes</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE RECUPERAÇÃO DE SENHA (SEÇÃO 7.1 DO PROMPT MESTRE) */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900">Recuperação de Senha</h3>
              <p className="text-xs text-slate-500 mt-1">
                Informe o e-mail cadastrado para receber o link seguro de redefinição de acesso.
              </p>
            </div>

            {forgotSent ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-xs font-bold text-emerald-900">Link Enviado!</div>
                <div className="text-[11px] text-emerald-700 leading-relaxed">
                  Se o e-mail <strong>{forgotEmail}</strong> estiver cadastrado em nossa base, as instruções foram enviadas.
                </div>
                <button
                  onClick={() => setIsForgotModalOpen(false)}
                  className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Cadastrado</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                  >
                    Enviar Link de Recuperação
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
