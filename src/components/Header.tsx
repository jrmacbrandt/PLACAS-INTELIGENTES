import React, { useState } from 'react';
import {
  Menu,
  X,
  Zap,
  Package,
  ShoppingCart,
  BarChart2,
  LayoutGrid,
  User,
  FileText,
  LogOut,
  Shield,
  Layers,
  ChevronRight,
  Sliders,
  ArrowRightLeft,
  Store,
  QrCode,
  Truck,
  HardDrive,
  Building,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import type { Profile } from '../types.js';

interface HeaderProps {
  currentProfile: Profile | null;
  allProfiles: Profile[];
  activeTab?: string;
  viewMode?: 'admin' | 'revendedor';
  onToggleViewMode?: () => void;
  onSwitchToAdmin?: () => void;
  onSelectTab?: (tab: string) => void;
  onSelectProfile: (id: string) => void;
  onOpenPublicRegister: () => void;
  onOpenCancellationPolicy: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  allProfiles,
  activeTab = 'pedidos',
  viewMode = 'revendedor',
  onToggleViewMode,
  onSwitchToAdmin,
  onSelectTab,
  onSelectProfile,
  onOpenPublicRegister,
  onOpenCancellationPolicy,
  onLogout,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isUserAdmin = currentProfile?.role === 'admin';
  const isShowingAdminView = viewMode === 'admin';

  const handleNavClick = (tabKey: string) => {
    if (onSelectTab) {
      onSelectTab(tabKey);
    }
    setIsDrawerOpen(false);
  };

  const handleAdminPanelAccess = () => {
    if (isShowingAdminView && onToggleViewMode) {
      onToggleViewMode();
    } else if (isUserAdmin && onToggleViewMode) {
      onToggleViewMode();
    } else if (onSwitchToAdmin) {
      onSwitchToAdmin();
    }
  };

  return (
    <>
      {/* Top Bar - Atelier das Placas (Clean white with subtle bottom border) */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
          {/* Left: Drawer Toggle Button & Brand Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
              title="Abrir Menu"
              aria-label="Abrir menu lateral"
            >
              {/* Split layout icon resembling the browser screenshot */}
              <div className="w-5 h-5 border-2 border-slate-700 rounded-sm flex">
                <div className="w-1.5 h-full border-r-2 border-slate-700 bg-slate-200"></div>
              </div>
            </button>

            <div className="flex items-center gap-2.5">
              {/* Logo Oficial Atelier das Placas */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-0.5 shadow-xs flex items-center justify-center shrink-0">
                <div className="w-full h-full bg-slate-900/30 rounded-[6px] flex items-center justify-center text-white">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <rect x="7" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                    <rect x="14" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                    <rect x="7" y="14" width="3" height="3" fill="currentColor" stroke="none" />
                    <rect x="14" y="14" width="2" height="2" fill="currentColor" stroke="none" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                  Atelier das Placas
                </span>
                <span className="text-[9px] uppercase font-bold tracking-wider text-blue-600 -mt-0.5">
                  Placas Inteligentes · QR & NFC
                </span>
              </div>

              {isUserAdmin && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ml-1">
                  <Shield className="w-3 h-3 text-blue-600" />
                  {isShowingAdminView ? 'Painel de Gestão' : 'Modo Revendedor'}
                </span>
              )}
            </div>
          </div>

          {/* Right: Mode Switcher & Profile Selector */}
          <div className="flex items-center gap-2">
            {/* Botão de alternância para o Painel de Controle (Gestão) */}
            <button
              onClick={handleAdminPanelAccess}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition shadow-2xs ${
                isShowingAdminView
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
              title={isShowingAdminView ? 'Ver loja como Revendedor' : 'Ir para o Painel de Controle (Gestão)'}
            >
              {isShowingAdminView ? (
                <>
                  <Store className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ver como Revendedor</span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Painel de Controle</span>
                </>
              )}
            </button>

            {currentProfile && (
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Profile quick selector for easy testing between Admin and Reseller */}
                <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-0.5 sm:p-1 pl-1.5 sm:pl-2">
                  <span className="text-xs font-medium text-slate-700 hidden md:inline">
                    {currentProfile.nome.split(' ')[0]}
                  </span>
                  <select
                    value={currentProfile.id}
                    onChange={(e) => onSelectProfile(e.target.value)}
                    className="bg-white text-xs text-slate-700 border border-slate-200 rounded px-1.5 py-1 max-w-[85px] sm:max-w-none truncate focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
                    title="Alternar Perfil para Teste"
                  >
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.role === 'admin' ? '🛡️ Admin: ' : '👤 '}
                        {p.nome.split(' ')[0]} ({p.role === 'admin' ? 'Admin' : p.tipo_parceiro === 'equipe_interna' ? 'Equipe Interna' : 'Revendedor'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                  title="Sair"
                  aria-label="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Side Drawer Overlay & Panel (Identical to Screenshot_2026-10-26-19-45-03-898) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-80 max-w-[85vw] bg-[#0c1829] text-slate-100 flex flex-col h-full shadow-2xl z-10 animate-slideRight">
            {/* Header of Drawer */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-400 p-0.5 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <div className="w-full h-full bg-slate-950/40 rounded-[10px] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <rect x="7" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                      <rect x="14" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                      <rect x="7" y="14" width="3" height="3" fill="currentColor" stroke="none" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-white text-base leading-tight">
                    Atelier das Placas
                  </div>
                  <div className="text-xs text-blue-300">
                    {isShowingAdminView ? 'Painel de Gestão' : 'Portal do Revendedor'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alternador de Visão no Drawer se for Admin */}
            {isUserAdmin && onToggleViewMode && (
              <div className="p-3 bg-slate-900/90 border-b border-slate-800">
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    onToggleViewMode();
                  }}
                  className="w-full py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {isShowingAdminView ? 'Alternar para Visão Revendedor' : 'Alternar para Painel Admin'}
                  </span>
                </button>
              </div>
            )}

            {/* Menu Items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {!isShowingAdminView ? (
                <>
                  <button
                    onClick={() => handleNavClick('pedidos')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'pedidos'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0" />
                    <span>Meus Pedidos</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('comprar')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'comprar'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 shrink-0" />
                    <span>Comprar Placa</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('vendas')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'vendas'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4 shrink-0" />
                    <span>Minhas Vendas</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('placas')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'placas'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    <span>Gerenciador de Placas</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('perfil')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'perfil'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>Meu Perfil</span>
                  </button>

                  {/* Acesso ao Painel Administrativo de Gestão */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        handleAdminPanelAccess();
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Shield className="w-4 h-4 text-blue-400" />
                        <span>Painel de Gestão (Admin)</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Operações & Produção
                  </div>
                  <button
                    onClick={() => handleNavClick('pedidos_recebidos')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'pedidos_recebidos' || activeTab === 'pedidos'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Pedidos Recebidos</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('em_producao')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'em_producao' || activeTab === 'producao'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span>Placas em Produção</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('despacho_retirada')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'despacho_retirada'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Truck className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Despacho e Retirada</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('entregues')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'entregues'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Produtos Entregues</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('gerar_qrcodes')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'gerar_qrcodes'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span>Gerar QR Codes</span>
                  </button>

                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Equipes
                  </div>
                  <button
                    onClick={() => handleNavClick('vendedores_internos')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'vendedores_internos'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Building className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span>Vendedores Internos</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('revendedores')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'revendedores'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>Revendedores</span>
                  </button>

                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Gestão & Regras
                  </div>
                  <button
                    onClick={() => handleNavClick('placas_links')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'placas_links'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Central de Placas & Links</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('indicadores')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'indicadores'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4 shrink-0" />
                    <span>Visão Geral & Métricas</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('produtos_estoque')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'produtos_estoque'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Produtos & Estoque</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('precos_config')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'precos_config'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-4 h-4 shrink-0" />
                    <span>Faixas de Preço do Sistema</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('backup')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'backup'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <HardDrive className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Backup & Restauração</span>
                  </button>

                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Integrações
                  </div>
                  <button
                    onClick={() => handleNavClick('configuracoes')}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition ${
                      activeTab === 'configuracoes'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0 text-sky-400" />
                    <span>Configurações</span>
                  </button>
                </>
              )}
            </nav>

            {/* Bottom of Drawer: Política de cancelamento, E-mail, Sair */}
            <div className="p-4 border-t border-slate-800/80 space-y-3">
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenCancellationPolicy();
                }}
                className="w-full flex items-center gap-2.5 text-xs text-slate-300 hover:text-white transition py-1 text-left"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Política de cancelamento</span>
              </button>

              <div className="text-[11px] text-slate-400 truncate px-1">
                {currentProfile?.email || 'usuario@ecloura.com.br'}
              </div>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 text-xs font-medium text-rose-400 hover:text-rose-300 transition py-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
