import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { LoginLanding } from './components/LoginLanding.js';
import { ResellerPortal } from './components/ResellerPortal.js';
import { AdminPortal } from './components/AdminPortal.js';
import { PublicRegisterModal } from './components/PublicRegisterModal.js';
import { CancellationPolicyModal } from './components/CancellationPolicyModal.js';
import { api, setCurrentUser } from './api.js';
import type { Profile } from './types.js';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Roteamento de URL para /admin e / (aceita também /adim por tolerância a digitação)
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
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
    loadProfiles();
  }, []);

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
