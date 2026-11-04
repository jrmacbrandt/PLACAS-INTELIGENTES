import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { LoginLanding } from './components/LoginLanding.js';
import { ResellerPortal } from './components/ResellerPortal.js';
import { AdminPortal } from './components/AdminPortal.js';
import { PublicRegisterModal } from './components/PublicRegisterModal.js';
import { CancellationPolicyModal } from './components/CancellationPolicyModal.js';
import { api, setCurrentUser } from './api.js';
import { supabase } from './services/supabaseClient.js';
import type { Profile } from './types.js';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Roteamento de URL para /admin, /r/:token e / (aceita também /adim por tolerância a digitação)
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [redirectStatus, setRedirectStatus] = useState<{
    loading: boolean;
    title: string;
    message: string;
    code: string;
  } | null>(null);
  const isRedirectPath = currentPath.startsWith('/r/');
  const isAdminPath =
    currentPath === '/admin' ||
    currentPath.startsWith('/admin') ||
    currentPath === '/adim' ||
    currentPath.startsWith('/adim');

  // Modo de visualização do Admin: pode ver o Painel Admin ou a Loja como Revendedor
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'revendedor'>('admin');

  // Controle de abas ativas
  const [resellerTab, setResellerTab] = useState<'pedidos' | 'comprar' | 'vendas' | 'placas' | 'perfil'>('pedidos');
  const [adminTab, setAdminTab] = useState<
    'pedidos_recebidos' | 'gerar_qrcodes' | 'em_producao' | 'despacho_retirada' | 'vendedores_internos' | 'indicadores' | 'pedidos' | 'producao' | 'revendedores' | 'precos_config' | 'backup'
  >('pedidos_recebidos');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const loadProfiles = async () => {
    try {
      const res = await api.getProfiles();
      if (res.sucesso) {
        setAllProfiles(res.perfis);
      }
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isRedirectPath) {
      const token = currentPath.replace(/^\/r\//, '').split('?')[0].trim();
      setRedirectStatus({
        loading: true,
        title: 'Redirecionando...',
        message: 'Consultando destino vitalício da placa inteligente...',
        code: token,
      });
      supabase
        .from('plates')
        .select('codigo_sequencial, token_publico, url_destino, status_digital, status_fisico')
        .eq('token_publico', token)
        .maybeSingle()
        .then(({ data: plate }) => {
          if (!plate) {
            setRedirectStatus({
              loading: false,
              title: 'Placa Não Encontrada',
              message: 'O código QR ou NFC lido não corresponde a nenhuma placa registrada.',
              code: '404_NOT_FOUND',
            });
            return;
          }
          if (plate.status_digital === 'bloqueada' || plate.status_fisico === 'bloqueada') {
            setRedirectStatus({
              loading: false,
              title: 'Placa Bloqueada',
              message: 'Esta placa inteligente encontra-se temporariamente suspensa pela administração.',
              code: plate.codigo_sequencial,
            });
            return;
          }
          if (plate.status_digital === 'inativa' || !plate.url_destino) {
            setRedirectStatus({
              loading: false,
              title: 'Placa Aguardando Ativação',
              message:
                'Esta placa inteligente já foi fabricada! Acesse o painel para configurar o link de destino (Google Avaliações, Instagram, WhatsApp ou Site).',
              code: plate.codigo_sequencial,
            });
            return;
          }
          window.location.replace(plate.url_destino);
        });
      return;
    }
    loadProfiles();
  }, [isRedirectPath, currentPath]);

  // Restaura sessão autenticada da aba atual (se já tiver feito login com senha)
  useEffect(() => {
    if (allProfiles.length > 0 && !isAuthenticated) {
      try {
        const savedProfileId = sessionStorage.getItem('atelier_auth_profile_id');
        if (savedProfileId) {
          const found = allProfiles.find((p) => p.id === savedProfileId);
          if (found) {
            if (isAdminPath && found.role !== 'admin') {
              return;
            }
            setCurrentProfile(found);
            setCurrentUser(found.id);
            setIsAuthenticated(true);
            setAdminViewMode(found.role === 'admin' && isAdminPath ? 'admin' : found.role === 'admin' ? 'admin' : 'revendedor');
          }
        }
      } catch {}
    }
  }, [allProfiles, isAdminPath, isAuthenticated]);

  const handleLogin = (profile: Profile) => {
    setCurrentProfile(profile);
    setCurrentUser(profile.id);
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem('atelier_auth_profile_id', profile.id);
    } catch {}
    if (profile.role === 'admin') {
      setAdminViewMode('admin');
      if (!isAdminPath) {
        navigateTo('/admin');
      }
    } else {
      setAdminViewMode('revendedor');
      if (isAdminPath) {
        navigateTo('/');
      }
    }
  };

  const handleNavigateAdmin = () => {
    if (isAuthenticated && currentProfile?.role === 'admin') {
      setAdminViewMode('admin');
      navigateTo('/admin');
    } else {
      setIsAuthenticated(false);
      setCurrentProfile(null);
      navigateTo('/admin');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentProfile(null);
    try {
      sessionStorage.removeItem('atelier_auth_profile_id');
    } catch {}
  };

  const handleSelectProfile = (id: string) => {
    const found = allProfiles.find((p) => p.id === id);
    if (found) {
      setCurrentProfile(found);
      setCurrentUser(found.id);
      if (found.role === 'admin') {
        setAdminViewMode('admin');
      } else {
        setAdminViewMode('revendedor');
      }
    }
  };

  const handleRegisterSuccess = (newProfile: Profile) => {
    setAllProfiles((prev) => [...prev, newProfile]);
    setCurrentProfile(newProfile);
    setCurrentUser(newProfile.id);
    setIsAuthenticated(true);
    setAdminViewMode('revendedor');
    navigateTo('/');
  };

  const handleToggleViewMode = () => {
    if (adminViewMode === 'admin') {
      setAdminViewMode('revendedor');
      navigateTo('/');
    } else {
      setAdminViewMode('admin');
      navigateTo('/admin');
    }
  };

  if (isRedirectPath && redirectStatus) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
          <span className="text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-slate-800 text-slate-300">
            {redirectStatus.code}
          </span>
          <h1 className="text-2xl font-bold mt-4 mb-2">{redirectStatus.title}</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">{redirectStatus.message}</p>
          {!redirectStatus.loading && (
            <button
              onClick={() => navigateTo('/')}
              className="inline-block w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition cursor-pointer"
            >
              Acessar Painel de Ativação
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-medium">
        Carregando Atelier das Placas...
      </div>
    );
  }

  // TELA INICIAL NA URL PRINCIPAL OU /admin (QUANDO NÃO AUTENTICADO)
  if (!isAuthenticated || !currentProfile) {
    return (
      <>
        <LoginLanding
          allProfiles={allProfiles}
          isAdminRoute={isAdminPath}
          onLogin={handleLogin}
          onOpenRegister={() => setIsRegisterModalOpen(true)}
          onNavigateAdmin={handleNavigateAdmin}
          onNavigateHome={() => navigateTo('/')}
        />
        <PublicRegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={handleRegisterSuccess}
        />
      </>
    );
  }

  const isUserAdmin = currentProfile?.role === 'admin';
  const shouldRenderAdminPortal = isUserAdmin && adminViewMode === 'admin';

  // AMBIENTE DO PORTAL APÓS LOGIN (ATELIER DAS PLACAS)
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Cabeçalho de Navegação Atelier das Placas com Menu Lateral (Drawer) e Alternador de Visão */}
      <Header
        currentProfile={currentProfile}
        allProfiles={allProfiles}
        activeTab={shouldRenderAdminPortal ? adminTab : resellerTab}
        viewMode={shouldRenderAdminPortal ? 'admin' : 'revendedor'}
        onToggleViewMode={isUserAdmin ? handleToggleViewMode : undefined}
        onSwitchToAdmin={handleNavigateAdmin}
        onSelectTab={(tab) => {
          if (shouldRenderAdminPortal) {
            setAdminTab(tab as any);
          } else {
            setResellerTab(tab as any);
          }
        }}
        onSelectProfile={handleSelectProfile}
        onOpenPublicRegister={() => setIsRegisterModalOpen(true)}
        onOpenCancellationPolicy={() => setIsCancellationModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Conteúdo Principal do Painel */}
      <main className="flex-1 w-full mx-auto">
        {shouldRenderAdminPortal ? (
          <AdminPortal
            onRefreshAll={loadProfiles}
            activeTab={adminTab}
            onTabChange={(t) => setAdminTab(t as any)}
          />
        ) : (
          <ResellerPortal
            currentProfile={currentProfile}
            activeTab={resellerTab}
            onTabChange={(t) => setResellerTab(t as any)}
            onRefreshProfile={loadProfiles}
            onOpenCancellationPolicy={() => setIsCancellationModalOpen(true)}
          />
        )}
      </main>

      {/* Modais Globais */}
      <PublicRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={handleRegisterSuccess}
      />

      <CancellationPolicyModal
        isOpen={isCancellationModalOpen}
        onClose={() => setIsCancellationModalOpen(false)}
      />
    </div>
  );
}
