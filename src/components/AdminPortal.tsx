import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Building,
  Users,
  DollarSign,
  FileText,
  Camera,
  RefreshCw,
  Search,
  Check,
  Power,
  Shield,
  ShieldCheck,
  MessageCircle,
  Sparkles,
  ExternalLink,
  Sliders,
  Package,
  QrCode,
  Radio,
  ArrowRight,
  ClipboardCheck,
  Play,
  Download,
  Eye,
  Inbox,
  Filter,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Phone,
  Zap,
  MoreVertical,
  Trash2,
  RotateCcw,
  AlertOctagon,
  CheckSquare,
  Printer,
  Database,
  Cloud,
  HardDrive,
  Upload,
  History,
  Calendar,
  Save,
  Folder,
  FolderPlus,
  FolderCheck,
} from 'lucide-react';
import { api } from '../api.js';
import { generateLabeledQrDataUrlInBrowser } from '../utils/qrLabeledPng.js';
import IntegrationsConfigPanel from './IntegrationsConfigPanel.js';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getCachedDriveSession,
  listDriveFolders,
  createDriveFolder,
  uploadBackupToDriveFolder,
  listBackupsInDriveFolder,
  downloadBackupContentFromDrive,
  deleteDriveFile,
  cleanOldDriveBackups,
  type DriveFolder,
  type DriveFile,
} from '../services/googleDrive.js';
import { createSupabaseBackup, markBackupSentToDrive } from '../services/clientBackup.js';
import type { AdminStats, PricingTier, Order, Plate, Profile } from '../types.js';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.336 11.893-11.893a11.821 11.821 0 00-3.48-8.414z" />
  </svg>
);

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

const GoogleDriveIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 87.3 78" fill="none">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 50 0 51.55 0 53.1h27.5z" fill="#00ac47"/>
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l6.1 10.55z" fill="#ea4335"/>
    <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2z" fill="#00832d"/>
    <path d="M59.8 53.1H87.3c0-1.55-.4-3.1-1.2-4.5l-22.5-39c-.8-1.4-1.95-2.5-3.3-3.3L46.55 29.9z" fill="#ffba00"/>
    <path d="M27.5 53.1h32.3l-13.75-23.8H20.15z" fill="#2684fc"/>
  </svg>
);

const formatWhatsAppRecoveryLink = (order: Order) => {
  const rawPhone = (order.revendedor_telefone || '').replace(/\D/g, '');
  const phone = rawPhone.length > 0
    ? (rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`)
    : '5521999999999';

  const revendedorNome = order.revendedor_nome || 'Revendedor';
  const numero = order.numero_pedido || order.id.slice(0, 8);
  const qtd = order.quantidade_total;
  const valor = order.valor_total ? order.valor_total.toFixed(2) : '0.00';

  const message = `Olá, ${revendedorNome}! Tudo bem? Aqui é do Atelier das Placas.\n\nVi que você gerou o pedido #${numero} de ${qtd} placas inteligentes no valor total de R$ ${valor}, mas o pagamento ainda não foi concluído.\n\nPosso te ajudar com o código Pix ou tirar alguma dúvida para já colocarmos suas placas em produção hoje?`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const getElapsedTimeFormatted = (dateStr: string) => {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return 'há poucos segundos';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `há ${diffHours}h ${diffMinutes % 60}m`;
    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} dia(s)`;
  } catch {
    return '';
  }
};

interface AdminPortalProps {
  onRefreshAll: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const DEFAULT_PRICING_TIERS: PricingTier[] = [
  { id: 1, quantidade_minima: 1, quantidade_maxima: 9, preco_unitario: 21.90, ativo: true },
  { id: 2, quantidade_minima: 10, quantidade_maxima: 49, preco_unitario: 19.90, ativo: true },
  { id: 3, quantidade_minima: 50, quantidade_maxima: null, preco_unitario: 17.90, ativo: true },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onRefreshAll,
  activeTab: externalTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<
    'pedidos_recebidos' | 'gerar_qrcodes' | 'em_producao' | 'despacho_retirada' | 'entregues' | 'placas_links' | 'vendedores_internos' | 'indicadores' | 'pedidos' | 'producao' | 'revendedores' | 'precos_config'
  >('pedidos_recebidos');
  const [allPlatesList, setAllPlatesList] = useState<Plate[]>([]);
  const [centralPlateSearch, setCentralPlateSearch] = useState<string>('');
  const [centralPlateFilter, setCentralPlateFilter] = useState<'todas' | 'ativas' | 'aguardando' | 'estoque'>('todas');
  const [adminEditingPlate, setAdminEditingPlate] = useState<any | null>(null);
  const [adminPlateForm, setAdminPlateForm] = useState<{
    nome_estabelecimento: string;
    url_destino: string;
    tipo_destino: 'google_reviews' | 'whatsapp' | 'instagram' | 'website' | 'personalizado';
    contato_nome: string;
    contato_telefone: string;
    status_digital: 'ativa' | 'inativa' | 'bloqueada';
  }>({
    nome_estabelecimento: '',
    url_destino: '',
    tipo_destino: 'google_reviews',
    contato_nome: '',
    contato_telefone: '',
    status_digital: 'ativa',
  });
  const [savingAdminPlate, setSavingAdminPlate] = useState<boolean>(false);
  const [deliveredSearch, setDeliveredSearch] = useState<string>('');
  const [deliveredFilter, setDeliveredFilter] = useState<'todos' | 'retirada' | 'correios' | 'revendedores' | 'internos'>('todos');
  const [expandedDeliveredOrderId, setExpandedDeliveredOrderId] = useState<string | null>(null);
  const [deliveredOrderPlatesMap, setDeliveredOrderPlatesMap] = useState<Record<string, any[]>>({});
  const [loadingDeliveredPlatesOrderId, setLoadingDeliveredPlatesOrderId] = useState<string | null>(null);
  const activeTab = (externalTab as any) || internalTab;

  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [platesInProduction, setPlatesInProduction] = useState<any[]>([]);
  const [unassignedPlates, setUnassignedPlates] = useState<any[]>([]);
  const [nextAvailableCode, setNextAvailableCode] = useState<string>('PLK-000001');
  const [mfgQueue, setMfgQueue] = useState<any[]>([]);
  const [pendingInspections, setPendingInspections] = useState<Plate[]>([]);
  const [logisticsList, setLogisticsList] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(() => {
    try {
      const saved = localStorage.getItem('atelier_pricing_tiers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PRICING_TIERS;
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gestão de Vendedores Internos e Pedidos sem Cobrança (Retirada)
  const [isNewInternalSellerModalOpen, setIsNewInternalSellerModalOpen] = useState(false);
  const [newInternalSellerData, setNewInternalSellerData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
  });
  const [savingInternalSeller, setSavingInternalSeller] = useState(false);

  const [isNewInternalOrderModalOpen, setIsNewInternalOrderModalOpen] = useState(false);
  const [newInternalOrderData, setNewInternalOrderData] = useState({
    vendedor_id: '',
    quantidade: 10,
    observacoes: '',
  });
  const [creatingInternalOrder, setCreatingInternalOrder] = useState(false);
  const [confirmingWithdrawalOrderId, setConfirmingWithdrawalOrderId] = useState<string | null>(null);

  // Controle de Menu (...) e Exclusão Total de Pedidos da Esteira
  const [openMenuOrderId, setOpenMenuOrderId] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<Order | any | null>(null);
  const [reaproveitarPlacasOption, setReaproveitarPlacasOption] = useState<boolean>(true);
  const [isDeletingLoading, setIsDeletingLoading] = useState<boolean>(false);

  // Seleção e Exclusão em Massa (Exclusivo da aba com todos os pedidos)
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeletingModalOpen, setIsBulkDeletingModalOpen] = useState<boolean>(false);
  const [bulkReaproveitarPlacasOption, setBulkReaproveitarPlacasOption] = useState<boolean>(true);
  const [isBulkDeletingLoading, setIsBulkDeletingLoading] = useState<boolean>(false);

  // Mapeamento local dos campos de intervalo de placas por pedido
  const [orderRangeInputs, setOrderRangeInputs] = useState<Record<string, { inicial: string; final: string }>>({});
  const [savingRangeOrderId, setSavingRangeOrderId] = useState<string | null>(null);
  const [generatingQrOrderId, setGeneratingQrOrderId] = useState<string | null>(null);
  const [expandedRangeOrderId, setExpandedRangeOrderId] = useState<string | null>(null);

  // Geração Antecipada de QR Codes (Estoque)
  const [advanceQty, setAdvanceQty] = useState<number>(10);
  const [advanceStatus, setAdvanceStatus] = useState<'em_producao' | 'planejada'>('em_producao');
  const [advanceGenerating, setAdvanceGenerating] = useState(false);
  const [advanceBatchResult, setAdvanceBatchResult] = useState<{
    codigo_inicial: string;
    codigo_final: string;
    total: number;
    placas: any[];
  } | null>(null);

  // Filtros rápidos da esteira de pedidos recebidos (Inicia por padrão em 'aprovados')
  const [receivedFilter, setReceivedFilter] = useState<'aprovados' | 'em_producao' | 'pendentes' | 'todos'>('aprovados');
  const [expandedPlatesOrderId, setExpandedPlatesOrderId] = useState<string | null>(null);
  const [editingNotesOrder, setEditingNotesOrder] = useState<Order | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [logisticsTabFilter, setLogisticsTabFilter] = useState<'todos' | 'correios' | 'retirada'>('todos');
  const [confirmingPaymentOrderId, setConfirmingPaymentOrderId] = useState<string | null>(null);
  const [simulatingAsaasOrderId, setSimulatingAsaasOrderId] = useState<string | null>(null);
  const [copiedPixOrderId, setCopiedPixOrderId] = useState<string | null>(null);

  // Modal de Visualização / Geração de QR Codes
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  const [qrModalPlates, setQrModalPlates] = useState<any[]>([]);
  const [qrModalLoading, setQrModalLoading] = useState(false);

  // Modais de Gestão
  const [producingOrder, setProducingOrder] = useState<any | null>(null);
  const [productionQty, setProductionQty] = useState<number>(1);

  const [inspectingPlate, setInspectingPlate] = useState<Plate | null>(null);
  const [inspectionData, setInspectionData] = useState({
    qr_code_legivel: true,
    acrilico_conforme: true,
    nfc_gravado_correto: true,
    motivo_reprovacao: '',
    observacoes: '',
  });

  const [changingDeliveryOrder, setChangingDeliveryOrder] = useState<any | null>(null);
  const [novaModalidade, setNovaModalidade] = useState<'retirada' | 'correios'>('retirada');
  const [motivoAlteracao, setMotivoAlteracao] = useState('');

  const [ocrModalOrder, setOcrModalOrder] = useState<any | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);

  const [resellerSearch, setResellerSearch] = useState<string>('');
  const [resellerFilter, setResellerFilter] = useState<'todos' | 'independentes' | 'especiais' | 'internos'>('todos');
  const [editingFullProfile, setEditingFullProfile] = useState<Profile | null>(null);
  const [editingProfileForm, setEditingProfileForm] = useState<{
    nome: string;
    email: string;
    telefone: string;
    cpf_cnpj: string;
    tipo_parceiro: 'revendedor_independente' | 'parceiro_especial' | 'equipe_interna';
    preferencia_entrega: 'correios' | 'retirada';
    ativo: boolean;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    nova_senha: string;
  }>({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    tipo_parceiro: 'revendedor_independente',
    preferencia_entrega: 'correios',
    ativo: true,
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    nova_senha: '',
  });
  const [savingFullProfile, setSavingFullProfile] = useState<boolean>(false);
  const [isNewResellerModalOpen, setIsNewResellerModalOpen] = useState<boolean>(false);
  const [newResellerForm, setNewResellerForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    preferencia_entrega: 'correios' as 'correios' | 'retirada',
  });
  const [creatingReseller, setCreatingReseller] = useState<boolean>(false);
  const [editingPriceProfile, setEditingPriceProfile] = useState<Profile | null>(null);
  const [novoPrecoIndividual, setNovoPrecoIndividual] = useState<string>('');
  const [individualTierRows, setIndividualTierRows] = useState<Array<{ min: string; max: string; preco: string }>>([]);
  const [individualUseCustom, setIndividualUseCustom] = useState(false);

  const openIndividualPricingModal = (prof: Profile) => {
    setEditingPriceProfile(prof);
    setNovoPrecoIndividual(prof.preco_individual ? prof.preco_individual.toString() : '');
    const baseTiers = pricingTiers.length > 0 ? pricingTiers : DEFAULT_PRICING_TIERS;
    const custom = prof.faixas_preco_individual && prof.faixas_preco_individual.length > 0 ? prof.faixas_preco_individual : null;
    const source = custom || baseTiers.map((t) => ({
      quantidade_minima: t.quantidade_minima,
      quantidade_maxima: t.quantidade_maxima,
      preco_unitario: prof.preco_individual && prof.preco_individual > 0 ? prof.preco_individual : t.preco_unitario,
    }));
    setIndividualTierRows(
      source.map((t) => ({
        min: String(t.quantidade_minima),
        max: t.quantidade_maxima === null ? '' : String(t.quantidade_maxima),
        preco: String(t.preco_unitario),
      }))
    );
    setIndividualUseCustom(Boolean(custom) || Boolean(prof.preco_individual && prof.preco_individual > 0));
  };

  const [trackingModalOrder, setTrackingModalOrder] = useState<any | null>(null);
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [generatingLabelOrderId, setGeneratingLabelOrderId] = useState<string | null>(null);

  const [supabaseStatus, setSupabaseStatus] = useState<any | null>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const loadSupabaseStatus = async () => {
    try {
      const res = await api.getSupabaseStatus();
      if (res.sucesso) {
        setSupabaseStatus(res);
      }
    } catch {}
  };

  const handleTestSupabase = async () => {
    setSupabaseLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.testSupabase();
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || 'Conexão com o Supabase validada com sucesso!',
        });
        loadSupabaseStatus();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao conectar com o Supabase.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao testar conexão com o Supabase.',
      });
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleSyncSupabase = async () => {
    setSupabaseLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.syncSupabase();
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `✓ ${res.mensagem}`,
        });
        loadSupabaseStatus();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha na sincronização.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao sincronizar com o Supabase.',
      });
    } finally {
      setSupabaseLoading(false);
    }
  };

  // Estados e Handlers para Backup & Restauração
  const [backupList, setBackupList] = useState<any[]>([]);
  const [backupConfig, setBackupConfig] = useState<{
    enabled: boolean;
    horarios: string[];
    max_arquivos: number;
    destino_automatico: 'local' | 'google_drive' | 'ambos';
    drive_folder_id?: string | null;
    drive_folder_name?: string | null;
    ultimo_backup?: string | null;
  }>(() => {
    let savedDestino: 'local' | 'google_drive' | 'ambos' = 'google_drive';
    let savedFolderId: string | null = null;
    let savedFolderName: string | null = null;
    try {
      const d = localStorage.getItem('atelier_backup_destino');
      if (d === 'local' || d === 'google_drive' || d === 'ambos') savedDestino = d;
      savedFolderId = localStorage.getItem('atelier_drive_folder_id');
      savedFolderName = localStorage.getItem('atelier_drive_folder_name');
    } catch {}
    return {
      enabled: true,
      horarios: ['12:00', '23:00'],
      max_arquivos: 10,
      destino_automatico: savedDestino,
      drive_folder_id: savedFolderId,
      drive_folder_name: savedFolderName,
      ultimo_backup: null,
    };
  });
  const [backupLoading, setBackupLoading] = useState(false);
  const [newHorarioInput, setNewHorarioInput] = useState('08:00');
  const [restoreModalData, setRestoreModalData] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Estados para Google Drive (OAuth de 1 clique, escolha de conta e pasta)
  const [driveSession, setDriveSession] = useState<{
    token: string | null;
    user: { email: string | null; name: string | null; photoURL: string | null } | null;
    isConnected: boolean;
  }>(() => getCachedDriveSession());
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('Atelier das Placas - Backups');
  const [driveBackupsList, setDriveBackupsList] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);

  const loadDriveData = async (token: string, folderId?: string | null) => {
    setDriveLoading(true);
    try {
      const folders = await listDriveFolders(token);
      setDriveFolders(folders);

      const targetFolderId = folderId || backupConfig.drive_folder_id;
      if (targetFolderId) {
        const files = await listBackupsInDriveFolder(token, targetFolderId);
        setDriveBackupsList(files);
      }
    } catch (err: any) {
      console.error('[LOAD_DRIVE_DATA_ERROR]', err);
    } finally {
      setDriveLoading(false);
    }
  };

  const handleConnectGoogleDriveVitalicio = async () => {
    setDriveLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/integrations?action=google-drive-oauth-url');
      const data = await res.json();
      if (!data.sucesso || !data.authorize_url) {
        throw new Error(data.mensagem || 'Falha ao gerar link de conexão vitalícia com Google Drive.');
      }
      window.location.href = data.authorize_url;
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao conectar ao Google Drive.' });
      setDriveLoading(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    // Redireciona diretamente para a autorização vitalícia oficial com Refresh Token
    await handleConnectGoogleDriveVitalicio();
  };

  const handleDisconnectGoogleDrive = async () => {
    await disconnectGoogleDrive();
    await fetch('/api/integrations?action=google-drive-disconnect', { method: 'POST' }).catch(() => {});
    setDriveSession({ token: null, user: null, isConnected: false });
    setDriveBackupsList([]);
    try {
      localStorage.removeItem('atelier_drive_folder_id');
      localStorage.removeItem('atelier_drive_folder_name');
    } catch {}
    setFeedbackMessage({ type: 'success', text: 'Google Drive desconectado com sucesso.' });
  };

  const handleCreateFolderInDrive = async () => {
    if (!driveSession.token) return;
    const name = newFolderNameInput.trim();
    if (!name) return;

    setDriveLoading(true);
    try {
      const newFolder = await createDriveFolder(driveSession.token, name);
      setDriveFolders((prev) => [...prev, newFolder]);
      const updatedCfg = {
        ...backupConfig,
        drive_folder_id: newFolder.id,
        drive_folder_name: newFolder.name,
      };
      setBackupConfig(updatedCfg);
      await api.updateBackupConfig(updatedCfg);
      await fetch('/api/integrations?action=google-drive-set-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: newFolder.id, folder_name: newFolder.name }),
      }).catch(() => {});
      setIsCreatingFolder(false);
      setNewFolderNameInput('');
      setFeedbackMessage({
        type: 'success',
        text: `✓ Pasta "${newFolder.name}" criada e selecionada no Google Drive!`,
      });
      const files = await listBackupsInDriveFolder(driveSession.token, newFolder.id);
      setDriveBackupsList(files);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Falha ao criar pasta no Drive.' });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleUpdateDestinoAutomatico = async (novoDestino: 'local' | 'google_drive' | 'ambos') => {
    const updated = { ...backupConfig, destino_automatico: novoDestino };
    setBackupConfig(updated);
    try {
      localStorage.setItem('atelier_backup_destino', novoDestino);
      await api.updateBackupConfig(updated);
    } catch {}
  };

  const handleSelectDriveFolder = async (folderId: string) => {
    if (!driveSession.token) return;
    const folder = driveFolders.find((f) => f.id === folderId);
    if (!folder) return;

    const updatedCfg = {
      ...backupConfig,
      drive_folder_id: folder.id,
      drive_folder_name: folder.name,
    };
    try {
      localStorage.setItem('atelier_drive_folder_id', folder.id);
      localStorage.setItem('atelier_drive_folder_name', folder.name);
    } catch {}
    setBackupConfig(updatedCfg);
    await api.updateBackupConfig(updatedCfg);
    await fetch('/api/integrations?action=google-drive-set-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folder.id, folder_name: folder.name }),
    }).catch(() => {});

    setDriveLoading(true);
    try {
      const files = await listBackupsInDriveFolder(driveSession.token, folder.id);
      setDriveBackupsList(files);
      setFeedbackMessage({
        type: 'success',
        text: `✓ Pasta "${folder.name}" definida para os backups do Google Drive!`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao carregar arquivos da pasta.' });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleUploadBackupToDriveNow = async () => {
    if (!driveSession.token || !backupConfig.drive_folder_id) {
      setFeedbackMessage({
        type: 'error',
        text: 'Conecte ao Google Drive e selecione uma pasta antes de enviar.',
      });
      return;
    }

    setUploadingToDrive(true);
    setFeedbackMessage(null);
    try {
      const { filename, payload } = await createSupabaseBackup('manual');

      const uploadedFile = await uploadBackupToDriveFolder(
        driveSession.token,
        backupConfig.drive_folder_id,
        filename,
        payload
      );
      await markBackupSentToDrive(filename, uploadedFile.id, backupConfig.drive_folder_name).catch(() => {});

      await cleanOldDriveBackups(driveSession.token, backupConfig.drive_folder_id, backupConfig.max_arquivos);

      const files = await listBackupsInDriveFolder(driveSession.token, backupConfig.drive_folder_id);
      setDriveBackupsList(files);
      await loadBackupData().catch(() => {});

      setFeedbackMessage({
        type: 'success',
        text: `✓ Backup "${uploadedFile.name}" enviado com sucesso para a pasta "${backupConfig.drive_folder_name || 'Google Drive'}"!`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Falha ao enviar backup para o Drive.' });
    } finally {
      setUploadingToDrive(false);
    }
  };

  const handleRestoreFromDriveFile = async (file: DriveFile) => {
    if (!driveSession.token) return;
    setDriveLoading(true);
    try {
      const content = await downloadBackupContentFromDrive(driveSession.token, file.id);
      setRestoreModalData({
        filename: file.name,
        payload: content,
        origem: 'google_drive',
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Falha ao baixar arquivo de backup do Google Drive.',
      });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleDeleteDriveBackupFile = async (fileId: string, fileName: string) => {
    if (!driveSession.token || !backupConfig.drive_folder_id) return;
    if (!confirm(`Deseja realmente excluir permanentemente o arquivo "${fileName}" do seu Google Drive?`)) {
      return;
    }

    setDriveLoading(true);
    try {
      await deleteDriveFile(driveSession.token, fileId);
      const files = await listBackupsInDriveFolder(driveSession.token, backupConfig.drive_folder_id);
      setDriveBackupsList(files);
      setFeedbackMessage({ type: 'success', text: `✓ Arquivo "${fileName}" excluído do Google Drive.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao excluir arquivo do Drive.' });
    } finally {
      setDriveLoading(false);
    }
  };

  const loadBackupData = async () => {
    try {
      const [listRes, cfgRes] = await Promise.all([
        api.listBackups(),
        api.getBackupConfig(),
      ]);
      if (listRes.sucesso) setBackupList(listRes.backups);
      if (cfgRes.sucesso) {
        setBackupConfig((prev) => {
          const folderId = cfgRes.config.drive_folder_id || prev.drive_folder_id;
          const folderName = cfgRes.config.drive_folder_name || prev.drive_folder_name;
          const destino = cfgRes.config.destino_automatico || prev.destino_automatico || 'google_drive';
          try {
            if (folderId) localStorage.setItem('atelier_drive_folder_id', folderId);
            if (folderName) localStorage.setItem('atelier_drive_folder_name', folderName);
            localStorage.setItem('atelier_backup_destino', destino);
          } catch {}
          return {
            ...prev,
            ...cfgRes.config,
            destino_automatico: destino,
            drive_folder_id: folderId,
            drive_folder_name: folderName,
          };
        });

        const session = getCachedDriveSession();
        const folderToLoad = cfgRes.config.drive_folder_id || backupConfig.drive_folder_id;
        if (session.isConnected && session.token) {
          loadDriveData(session.token, folderToLoad).catch(() => {});
        }

        // Sincroniza o status da conexão vitalícia salva no servidor
        fetch('/api/integrations?action=google-drive-status')
          .then((r) => r.json())
          .then((st) => {
            if (st.sucesso && st.connected && st.user) {
              const activeTok = st.access_token;
              setDriveSession((prev) => ({
                ...prev,
                isConnected: true,
                token: activeTok || prev.token,
                user: {
                  email: st.user.email,
                  name: st.user.name,
                  photoURL: st.user.picture || prev.user?.photoURL || null,
                },
              }));
              const fId = st.folder_id || cfgRes.config.drive_folder_id || folderToLoad;
              const fName = st.folder_name || cfgRes.config.drive_folder_name;
              if (fId) {
                setBackupConfig((prev) => ({
                  ...prev,
                  drive_folder_id: fId,
                  drive_folder_name: fName || prev.drive_folder_name,
                }));
                try {
                  localStorage.setItem('atelier_drive_folder_id', fId);
                  if (fName) localStorage.setItem('atelier_drive_folder_name', fName);
                } catch {}
              }
              const tokToUse = activeTok || session.token;
              if (tokToUse) {
                loadDriveData(tokToUse, fId).catch(() => {});
              }
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Erro ao carregar dados de backup:', err);
    }
  };

  const handleDownloadInstantBackup = async () => {
    setBackupLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.createBackup();
      if (!res.sucesso) throw new Error(res.mensagem);
      const payload = res.payload;
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.backup?.filename || `backup_atelier_das_placas_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedbackMessage({
        type: 'success',
        text: `✓ Backup "${res.backup?.filename}" gerado no Supabase e baixado no computador com sucesso!`,
      });
      await loadBackupData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao gerar download de backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateServerBackup = async () => {
    setBackupLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.createBackup();
      if (res.sucesso) {
        let driveMsg = '';
        if (
          (backupConfig.destino_automatico === 'google_drive' || backupConfig.destino_automatico === 'ambos') &&
          driveSession.token &&
          backupConfig.drive_folder_id
        ) {
          try {
            const payload = res.payload;
            if (payload) {
              const uploadedFile = await uploadBackupToDriveFolder(
                driveSession.token,
                backupConfig.drive_folder_id,
                res.backup.filename,
                payload
              );
              await markBackupSentToDrive(res.backup.filename, uploadedFile.id, backupConfig.drive_folder_name).catch(() => {});
              await cleanOldDriveBackups(driveSession.token, backupConfig.drive_folder_id, backupConfig.max_arquivos);
              const files = await listBackupsInDriveFolder(driveSession.token, backupConfig.drive_folder_id);
              setDriveBackupsList(files);
              driveMsg = ` e sincronizado na pasta "${backupConfig.drive_folder_name || 'Google Drive'}"`;
            }
          } catch (driveErr) {
            console.error('Falha ao espelhar backup no Drive:', driveErr);
          }
        }

        setFeedbackMessage({
          type: 'success',
          text: `✓ Backup registrado no Supabase com sucesso: "${res.backup.filename}"${driveMsg}!`,
        });
        await loadBackupData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao gerar backup.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao gerar backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Deseja realmente excluir permanentemente o arquivo de backup "${filename}" do servidor?`)) {
      return;
    }
    setFeedbackMessage(null);
    try {
      const res = await api.deleteBackup(filename);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        await loadBackupData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Erro ao excluir backup.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao excluir backup.' });
    }
  };

  const handleAddHorario = () => {
    const val = newHorarioInput.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
      alert('Informe um horário válido no formato HH:mm (ex: 08:00, 14:30).');
      return;
    }
    if (backupConfig.horarios.includes(val)) {
      return;
    }
    const updatedHorarios = [...backupConfig.horarios, val].sort();
    setBackupConfig({ ...backupConfig, horarios: updatedHorarios });
  };

  const handleRemoveHorario = (horarioToRemove: string) => {
    const updatedHorarios = backupConfig.horarios.filter((h) => h !== horarioToRemove);
    setBackupConfig({ ...backupConfig, horarios: updatedHorarios });
  };

  const handleSaveBackupConfig = async () => {
    setBackupLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.updateBackupConfig(backupConfig);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: '✓ Configurações de agendamento de backup salvas!' });
        setBackupConfig(res.config);
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao salvar agendamento.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao salvar agendamento.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSelectFileToRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.metadados || !parsed.dados) {
          alert('O arquivo selecionado não possui a estrutura válida de backup do Atelier das Placas.');
          return;
        }
        setRestoreModalData({
          filename: file.name,
          payload: parsed,
          origem: 'upload',
        });
      } catch {
        alert('Não foi possível ler o arquivo. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restoreModalData) return;
    setIsRestoring(true);
    setFeedbackMessage(null);
    try {
      const payloadToSend =
        restoreModalData.origem === 'upload' || restoreModalData.origem === 'google_drive'
          ? { backup: restoreModalData.payload }
          : { filename: restoreModalData.filename };

      const res = await api.restoreBackup(payloadToSend);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `✓ ${res.mensagem}`,
        });
        setRestoreModalData(null);
        await loadAllAdminData();
        await loadBackupData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao restaurar backup.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro durante a restauração.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.getAdminStats(),
        api.getOrders(),
        api.getPlatesInProduction(),
        api.getManufacturingQueue(),
        api.getPendingInspections(),
        api.getLogisticsOrders(),
        api.getProfiles(),
        api.getPricingTiers(),
        api.getAuditLogs(),
        api.getUnassignedPlates(),
        api.getPlates(),
      ]);

      const [
        statsSettled,
        ordersSettled,
        platesInProdSettled,
        queueSettled,
        inspSettled,
        logSettled,
        profSettled,
        tiersSettled,
        auditSettled,
        unassignedSettled,
        allPlatesSettled,
      ] = results;

      if (statsSettled.status === 'fulfilled' && statsSettled.value?.sucesso) {
        setStats(statsSettled.value.indicadores);
      }
      if (ordersSettled.status === 'fulfilled' && ordersSettled.value?.sucesso) {
        setOrdersList(ordersSettled.value.pedidos);
        setOrderRangeInputs((prev) => {
          const updated = { ...prev };
          for (const ord of ordersSettled.value.pedidos) {
            if (!updated[ord.id] || (!updated[ord.id].inicial && ord.placa_codigo_inicial)) {
              updated[ord.id] = {
                inicial: ord.placa_codigo_inicial || '',
                final: ord.placa_codigo_final || '',
              };
            }
          }
          return updated;
        });
      }
      if (platesInProdSettled.status === 'fulfilled' && platesInProdSettled.value?.sucesso) {
        setPlatesInProduction(platesInProdSettled.value.placas);
      }
      if (queueSettled.status === 'fulfilled' && queueSettled.value?.sucesso) {
        setMfgQueue(queueSettled.value.fila);
      }
      if (inspSettled.status === 'fulfilled' && inspSettled.value?.sucesso) {
        setPendingInspections(inspSettled.value.placas);
      }
      if (logSettled.status === 'fulfilled' && logSettled.value?.sucesso) {
        setLogisticsList(logSettled.value.registros);
      }
      if (profSettled.status === 'fulfilled' && profSettled.value?.sucesso) {
        setProfilesList(profSettled.value.perfis);
      }
      if (tiersSettled.status === 'fulfilled' && tiersSettled.value?.sucesso && tiersSettled.value.faixas?.length > 0) {
        setPricingTiers(tiersSettled.value.faixas);
      }
      if (auditSettled.status === 'fulfilled' && auditSettled.value?.sucesso) {
        setAuditLogs(auditSettled.value.logs);
      }
      if (unassignedSettled.status === 'fulfilled' && unassignedSettled.value?.sucesso) {
        setUnassignedPlates(unassignedSettled.value.placas);
        if (unassignedSettled.value.proximo_codigo_disponivel) {
          setNextAvailableCode(unassignedSettled.value.proximo_codigo_disponivel);
        }
      }
      if (allPlatesSettled.status === 'fulfilled' && allPlatesSettled.value?.sucesso) {
        const platesData = allPlatesSettled.value.placas || [];
        setAllPlatesList(platesData);
        // Sincroniza automaticamente o mapa de placas dos pedidos entregues para refletir ativações dos clientes em tempo real
        setDeliveredOrderPlatesMap((prev) => {
          const nextMap = { ...prev };
          for (const ordId of Object.keys(nextMap)) {
            const freshForOrder = platesData.filter((p: any) => p.order_id === ordId);
            if (freshForOrder.length > 0) {
              nextMap[ordId] = freshForOrder;
            }
          }
          return nextMap;
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados administrativos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('drive_connected') === 'success') {
      setFeedbackMessage({
        type: 'success',
        text: '✓ Conexão com Google Drive Vitalício ativada com sucesso! O acesso permanente está configurado.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Busca imediata de faixas de preço na nuvem/cache com alta prioridade
    api.getPricingTiers().then((res) => {
      if (res.sucesso && res.faixas && res.faixas.length > 0) {
        setPricingTiers(res.faixas);
      }
    }).catch(() => {});

    loadAllAdminData();
    loadSupabaseStatus();
    loadBackupData();

    // Verificador automático dos horários pré-definidos de backup (roda na inicialização e a cada 60s)
    const checkScheduledBackups = () => {
      fetch('/api/cron/scheduled-backup?check_schedule=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.executed) {
            loadBackupData();
          }
        })
        .catch(() => {});
    };
    checkScheduledBackups();
    const backupScheduleTimer = setInterval(checkScheduledBackups, 60000);

    // Polling suave periódico para atualizar automaticamente pedidos quando o Webhook do Asaas confirmar
    const pollInterval = setInterval(() => {
      api.getOrders().then((res) => {
        if (res.sucesso && res.pedidos) {
          let newlyPaidOrder: Order | null = null;
          setOrdersList((prevList) => {
            const paidChange = res.pedidos.find((newOrd) => {
              const prev = prevList.find((p) => p.id === newOrd.id);
              return prev && prev.status === 'aguardando_pagamento' && (newOrd.status === 'pago' || newOrd.status === 'aprovado');
            });
            if (paidChange) {
              newlyPaidOrder = paidChange;
            }

            const hasStatusChange = res.pedidos.some((newOrd) => {
              const prev = prevList.find((p) => p.id === newOrd.id);
              return !prev || prev.status !== newOrd.status || prev.qrcodes_gerados !== newOrd.qrcodes_gerados;
            });

            if (hasStatusChange || res.pedidos.length !== prevList.length) {
              return res.pedidos;
            }
            return prevList;
          });

          if (newlyPaidOrder) {
            setFeedbackMessage({
              type: 'success',
              text: `🔔 Pagamento do pedido #${(newlyPaidOrder as Order).numero_pedido} reconhecido automaticamente no Asaas! Movido para a aba Aprovados e liberado para geração de QR Codes.`,
            });
            loadAllAdminData();
          }
        }
      }).catch(() => {});

      // Sincroniza em tempo real as ativações e links de placas feitas pelos revendedores/clientes
      api.getPlates().then((pRes) => {
        if (pRes.sucesso && pRes.placas) {
          const freshPlates = pRes.placas;
          setAllPlatesList(freshPlates);
          setDeliveredOrderPlatesMap((prev) => {
            let changed = false;
            const nextMap = { ...prev };
            for (const ordId of Object.keys(nextMap)) {
              const byOrder = freshPlates.filter((p: any) => p.order_id === ordId);
              if (byOrder.length > 0) {
                nextMap[ordId] = byOrder;
                changed = true;
              }
            }
            return changed ? nextMap : prev;
          });
        }
      }).catch(() => {});
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(backupScheduleTimer);
    };
  }, []);

  const handleAprovarReservaInterna = async (orderId: string) => {
    setFeedbackMessage(null);
    try {
      const res = await api.approveReservation(orderId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao aprovar reserva.' });
    }
  };

  // 1A. Gerar QR Codes do Pedido ali na hora (habilita o botão Ver / Baixar QR Codes em seguida)
  const handleGerarQRCodesPedido = async (order: Order) => {
    const isOrderExemptOrApproved =
      order.status === 'pago' ||
      order.status === 'aprovado' ||
      order.origem === 'solicitacao_interna' ||
      order.revendedor_tipo === 'equipe_interna';

    if (!isOrderExemptOrApproved && order.status === 'aguardando_pagamento') {
      setFeedbackMessage({
        type: 'error',
        text: 'A geração de QR Codes está bloqueada para pedidos pendentes de pagamento. Aguarde a confirmação automática do Asaas ou realize a confirmação manual.',
      });
      return;
    }

    setGeneratingQrOrderId(order.id);
    setFeedbackMessage(null);
    try {
      const res = await api.generateOrderQRCodes(order.id);
      if (res.sucesso) {
        if (res.placa_codigo_inicial && res.placa_codigo_final) {
          setOrderRangeInputs((prev) => ({
            ...prev,
            [order.id]: {
              inicial: res.placa_codigo_inicial || '',
              final: res.placa_codigo_final || '',
            },
          }));
        }
        setFeedbackMessage({
          type: 'success',
          text:
            res.mensagem ||
            `✓ ${order.quantidade_total} QR Codes (${res.placa_codigo_inicial} a ${res.placa_codigo_final}) gerados com sucesso! O botão "Ver / Baixar QR Codes" está habilitado.`,
        });
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao gerar QR Codes do pedido.' });
    } finally {
      setGeneratingQrOrderId(null);
    }
  };

  // 1B. Visualizar e Baixar QR Codes já gerados ou atribuídos ao Pedido
  const handleAbrirGeradorQRCodes = async (order: Order) => {
    const isAlreadyGenerated = Boolean(
      order.qrcodes_gerados ||
      (order.placa_codigo_inicial && order.placa_codigo_final) ||
      (order.total_placas_geradas && order.total_placas_geradas >= order.quantidade_total)
    );

    const isOrderExemptOrApproved = order.status === 'pago' || order.status === 'aprovado' || order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna';

    // REGRA DO USUÁRIO: Placas/pedidos aguardando pagamento não podem gerar QR codes
    if (!isAlreadyGenerated && !isOrderExemptOrApproved && order.status === 'aguardando_pagamento') {
      setFeedbackMessage({
        type: 'error',
        text: 'A geração de QR Codes está bloqueada para pedidos pendentes de pagamento. Aguarde a confirmação automática do Asaas ou realize a confirmação manual.',
      });
      return;
    }

    setQrModalOrder(order);
    setQrModalLoading(true);
    setQrModalPlates([]);
    try {
      let res;
      if (isAlreadyGenerated) {
        // Se já foram gerados ou atribuídos, consulta as placas existentes sem criar novas
        res = await api.getOrderPlates(order.id);
        if (!res.placas || res.placas.length < order.quantidade_total) {
          res = await api.generateOrderQRCodes(order.id);
        }
      } else {
        // Se ainda não foram gerados, gera pela primeira vez
        res = await api.generateOrderQRCodes(order.id);
      }

      if (res.sucesso) {
        const hydrated = await Promise.all(
          (res.placas || []).map(async (p: any) => {
            if (p.qrcode_data_url) return p;
            const fallbackDataUrl = p.url_permanente
              ? await generateLabeledQrDataUrlInBrowser(p.url_permanente, p.codigo_sequencial)
              : '';
            return { ...p, qrcode_data_url: fallbackDataUrl };
          })
        );
        setQrModalPlates(hydrated);
        if (res.placa_codigo_inicial && res.placa_codigo_final) {
          setOrderRangeInputs((prev) => ({
            ...prev,
            [order.id]: {
              inicial: res.placa_codigo_inicial || '',
              final: res.placa_codigo_final || '',
            },
          }));
        }
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao carregar QR Codes do pedido.' });
    } finally {
      setQrModalLoading(false);
    }
  };

  // 2. Mudança no campo de código inicial com cálculo automático do final
  const handleRangeInicialChange = (order: Order, val: string) => {
    const cleaned = val.trim().toUpperCase();
    let autoFinal = orderRangeInputs[order.id]?.final || '';

    // Se for digitado algo como PLK-000010 ou 10, calcula o final automático
    const num = parseInt(cleaned.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const finalNum = num + order.quantidade_total - 1;
      autoFinal = `PLK-${String(finalNum).padStart(6, '0')}`;
    }

    setOrderRangeInputs((prev) => ({
      ...prev,
      [order.id]: {
        inicial: cleaned,
        final: autoFinal,
      },
    }));
  };

  const handleRangeInicialBlur = (order: Order) => {
    const currentIni = orderRangeInputs[order.id]?.inicial || order.placa_codigo_inicial || '';
    const num = parseInt(currentIni.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      const formattedIni = `PLK-${String(num).padStart(6, '0')}`;
      const formattedFim = `PLK-${String(num + order.quantidade_total - 1).padStart(6, '0')}`;
      setOrderRangeInputs((prev) => ({
        ...prev,
        [order.id]: {
          inicial: formattedIni,
          final: formattedFim,
        },
      }));
    }
  };

  // Preenche automaticamente o intervalo com placas livres do estoque antecipado
  const handlePreencherComEstoqueLivre = (order: Order) => {
    if (unassignedPlates.length === 0) {
      setFeedbackMessage({
        type: 'error',
        text: 'Não há placas livres geradas antecipadamente no estoque. Você pode digitar o código inicial manualmente ou gerar um lote na aba "Gerar QR Codes".',
      });
      return;
    }
    const sorted = [...unassignedPlates].sort((a, b) =>
      String(a.codigo_sequencial).localeCompare(String(b.codigo_sequencial))
    );
    const firstCode = sorted[0]?.codigo_sequencial || 'PLK-000001';
    const startNum = parseInt(String(firstCode).replace(/[^0-9]/g, ''), 10) || 1;
    const endNum = startNum + order.quantidade_total - 1;
    const formattedIni = `PLK-${String(startNum).padStart(6, '0')}`;
    const formattedFim = `PLK-${String(endNum).padStart(6, '0')}`;

    setOrderRangeInputs((prev) => ({
      ...prev,
      [order.id]: {
        inicial: formattedIni,
        final: formattedFim,
      },
    }));
  };

  // 3. Atribuição de intervalo de placas já fabricadas a um pedido
  const handleAtribuirIntervalo = async (order: Order) => {
    const isOrderExemptOrApproved = order.status === 'pago' || order.status === 'aprovado' || order.status === 'em_producao' || order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna';
    if (!isOrderExemptOrApproved && order.status === 'aguardando_pagamento') {
      setFeedbackMessage({
        type: 'error',
        text: 'A atribuição de placas está bloqueada para pedidos pendentes de pagamento. Confirme o pagamento antes de atribuir.',
      });
      return;
    }

    const rawIni = orderRangeInputs[order.id]?.inicial ?? order.placa_codigo_inicial ?? '';
    const rawFim = orderRangeInputs[order.id]?.final ?? order.placa_codigo_final ?? '';
    const numIni = parseInt(String(rawIni).replace(/[^0-9]/g, ''), 10);
    const numFim = parseInt(String(rawFim).replace(/[^0-9]/g, ''), 10);

    if (isNaN(numIni) || numIni <= 0) {
      setFeedbackMessage({ type: 'error', text: 'Preencha o Código Inicial das placas (ex: PLK-000001).' });
      return;
    }

    const formattedIni = `PLK-${String(numIni).padStart(6, '0')}`;
    const formattedFim = !isNaN(numFim) && numFim >= numIni
      ? `PLK-${String(numFim).padStart(6, '0')}`
      : `PLK-${String(numIni + order.quantidade_total - 1).padStart(6, '0')}`;

    setOrderRangeInputs((prev) => ({
      ...prev,
      [order.id]: {
        inicial: formattedIni,
        final: formattedFim,
      },
    }));

    setSavingRangeOrderId(order.id);
    setFeedbackMessage(null);
    try {
      const res = await api.assignPlatesRange(order.id, formattedIni, formattedFim);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        if (qrModalOrder && qrModalOrder.id === order.id) {
          setQrModalOrder({
            ...qrModalOrder,
            placa_codigo_inicial: res.placa_codigo_inicial || formattedIni,
            placa_codigo_final: res.placa_codigo_final || formattedFim,
          });
          if (res.placas && res.placas.length > 0) {
            const hydrated = await Promise.all(
              res.placas.map(async (p: any) => {
                if (p.qrcode_data_url) return p;
                const fallbackDataUrl = p.url_permanente
                  ? await generateLabeledQrDataUrlInBrowser(p.url_permanente, p.codigo_sequencial)
                  : '';
                return { ...p, qrcode_data_url: fallbackDataUrl };
              })
            );
            setQrModalPlates(hydrated);
          } else {
            const platesRes = await api.getOrderPlates(order.id);
            if (platesRes.sucesso && platesRes.placas) {
              setQrModalPlates(platesRes.placas);
            }
          }
        }
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao atribuir placas ao pedido.' });
    } finally {
      setSavingRangeOrderId(null);
    }
  };

  // 4. Geração Antecipada de Placas para Estoque
  const handleGerarPlacasAntecipadas = async () => {
    if (advanceQty < 1) return;
    setAdvanceGenerating(true);
    setFeedbackMessage(null);
    try {
      const res = await api.generateAdvancePlates(advanceQty, advanceStatus);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setAdvanceBatchResult({
          codigo_inicial: res.codigo_inicial,
          codigo_final: res.codigo_final,
          total: res.total_geradas,
          placas: res.placas,
        });
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao gerar placas antecipadas.' });
    } finally {
      setAdvanceGenerating(false);
    }
  };

  const handleConfirmarPagamentoManual = async (orderId: string, orderNumero: string) => {
    if (!confirm(`Deseja confirmar manualmente o pagamento do pedido #${orderNumero}?\n\nO status passará para "pago" e você poderá gerar os QR codes e iniciar a produção das placas.`)) {
      return;
    }
    setConfirmingPaymentOrderId(orderId);
    try {
      const res = await api.confirmManualPayment(orderId);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `Pagamento do pedido #${orderNumero} confirmado com sucesso! O pedido agora está como "Pago".`,
        });
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Erro ao confirmar pagamento.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Erro ao confirmar pagamento manual.',
      });
    } finally {
      setConfirmingPaymentOrderId(null);
    }
  };

  const handleSimulateAsaasWebhook = async (orderId: string, orderNumero: string) => {
    setSimulatingAsaasOrderId(orderId);
    try {
      const res = await api.simulateAsaasWebhook(orderId);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `⚡ Confirmação Automática Asaas: Pedido #${orderNumero} liquidado com sucesso! O webhook inseriu o pedido na fila de fabricação.`,
        });
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao simular confirmação do Asaas.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao simular webhook do Asaas.',
      });
    } finally {
      setSimulatingAsaasOrderId(null);
    }
  };

  const downloadSingleQrCode = async (plate: { codigo_sequencial: string; qrcode_url?: string | null; qrcode_data_url?: string; url_permanente?: string }) => {
    let downloadHref = plate.qrcode_data_url || '';
    if (!downloadHref && plate.url_permanente) {
      downloadHref = await generateLabeledQrDataUrlInBrowser(plate.url_permanente, plate.codigo_sequencial);
    }
    if (!downloadHref && plate.qrcode_url) {
      try {
        const resp = await fetch(plate.qrcode_url);
        if (resp.ok) {
          const blob = await resp.blob();
          downloadHref = URL.createObjectURL(blob);
        }
      } catch {}
    }
    if (!downloadHref) return;
    const link = document.createElement('a');
    link.href = downloadHref;
    // REGRA DO USUÁRIO: O nome dos arquivos para download deve ter o número específico de cada QR code
    link.download = `QRCode_${plate.codigo_sequencial}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllQrCodes = () => {
    if (qrModalPlates.length === 0) return;
    qrModalPlates.forEach((plate, index) => {
      setTimeout(() => {
        downloadSingleQrCode(plate);
      }, index * 250);
    });
    setFeedbackMessage({
      type: 'success',
      text: `Iniciado o download de ${qrModalPlates.length} QR Codes com seus respectivos números sequenciais!`,
    });
  };

  // 2. Início de Produção
  const handleIniciarProducao = async (orderId: string) => {
    setLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.startOrderProduction(orderId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        await loadAllAdminData();
        setActiveTab('em_producao');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao iniciar produção.' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Finalização de Placa em Produção ("Botão de Finalizado")
  const handleFinalizarPlaca = async (plateId: string) => {
    setFeedbackMessage(null);
    try {
      const res = await api.finalizePlate(plateId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao finalizar placa.' });
    }
  };
  const handleVerQrCodePlaca = async (placa: any) => {
    const parentOrder = ordersList.find((o: Order) => o.id === placa.order_id) || ({
      id: placa.order_id || placa.id,
      numero_pedido: placa.numero_pedido || placa.codigo_sequencial,
      quantidade_total: 1,
      revendedor_nome: placa.revendedor_nome,
    } as Order);
    setQrModalOrder(parentOrder);
    setQrModalLoading(true);
    setQrModalPlates([]);
    try {
      let dataUrl = placa.url_permanente ? await generateLabeledQrDataUrlInBrowser(placa.url_permanente, placa.codigo_sequencial) : placa.qrcode_data_url;
      if (!dataUrl && placa.url_permanente) {
        dataUrl = await generateLabeledQrDataUrlInBrowser(placa.url_permanente, placa.codigo_sequencial);
      }
      setQrModalPlates([{
        id: placa.id,
        order_id: placa.order_id,
        codigo_sequencial: placa.codigo_sequencial,
        token_publico: placa.token_publico,
        url_permanente: placa.url_permanente,
        qrcode_data_url: dataUrl,
      }]);
    } catch {
      setQrModalPlates([placa]);
    } finally {
      setQrModalLoading(false);
    }
  };

  // 4. Finalização de Todas as Placas do Pedido
  const handleFinalizarProducaoLote = async (orderId: string) => {
    setFeedbackMessage(null);
    try {
      const res = await api.finalizeOrderProduction(orderId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        await loadAllAdminData();
        setActiveTab('despacho_retirada');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao finalizar produção do pedido.' });
    }
  };

  const handleExecutarProducao = async () => {
    if (!producingOrder) return;
    setFeedbackMessage(null);
    try {
      const res = await api.produceUnits(producingOrder.id, productionQty);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setProducingOrder(null);
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao registrar produção.' });
    }
  };

  const handleFinalizarInspecao = async (aprovada: boolean) => {
    if (!inspectingPlate) return;
    setFeedbackMessage(null);
    try {
      const res = await api.submitInspection({
        plate_id: inspectingPlate.id,
        qr_code_legivel: aprovada ? true : inspectionData.qr_code_legivel,
        acrilico_conforme: aprovada ? true : inspectionData.acrilico_conforme,
        nfc_gravado_correto: aprovada ? true : inspectionData.nfc_gravado_correto,
        motivo_reprovacao: aprovada ? null : (inspectionData.motivo_reprovacao || 'Reprovada na checagem física'),
        observacoes: inspectionData.observacoes,
      });

      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setInspectingPlate(null);
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao registrar inspeção.' });
    }
  };

  const handleLiberarPlaca = async (plateId: string) => {
    setFeedbackMessage(null);
    try {
      const res = await api.releasePlate(plateId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao liberar placa.' });
    }
  };

  const handleAlterarModalidade = async () => {
    if (!changingDeliveryOrder) return;
    setFeedbackMessage(null);
    try {
      const orderId = changingDeliveryOrder.id || changingDeliveryOrder.order_id;
      const res = await api.changeDeliveryMode(orderId, {
        nova_modalidade: novaModalidade,
        motivo: motivoAlteracao || 'Alteração solicitada pelo operador no painel',
      });

      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setChangingDeliveryOrder(null);
        setMotivoAlteracao('');
        await loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao alterar modalidade de entrega.' });
    }
  };

  const handleSaveOrderNotes = async () => {
    if (!editingNotesOrder) return;
    setSavingNotes(true);
    setFeedbackMessage(null);
    try {
      const res = await api.updateOrderNotes(editingNotesOrder.id, notesInput);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setEditingNotesOrder(null);
        setNotesInput('');
        await loadAllAdminData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao salvar observações.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao atualizar observações do pedido.' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleConfirmarRetiradaPresencial = async (orderId: string, nomeResponsavel: string) => {
    setFeedbackMessage(null);
    try {
      const res = await api.confirmWithdrawal(orderId, nomeResponsavel);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || '✓ Entrega confirmada com sucesso! O pedido foi movido para a aba Produtos Entregues.',
        });
        await loadAllAdminData();
        setActiveTab('entregues');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao confirmar entrega física.' });
    }
  };

  const handleToggleInspectDeliveredPlates = async (orderId: string) => {
    if (expandedDeliveredOrderId === orderId) {
      setExpandedDeliveredOrderId(null);
      return;
    }
    setExpandedDeliveredOrderId(orderId);
    setLoadingDeliveredPlatesOrderId(orderId);
    try {
      const res = await api.getOrderPlates(orderId);
      if (res.sucesso && res.placas) {
        setDeliveredOrderPlatesMap((prev) => ({ ...prev, [orderId]: res.placas }));
      }
    } catch {
    } finally {
      setLoadingDeliveredPlatesOrderId(null);
    }
  };

  const handleOpenAdminPlateEditor = (placa: any) => {
    setAdminEditingPlate(placa);
    setAdminPlateForm({
      nome_estabelecimento: placa.nome_estabelecimento || '',
      url_destino: placa.url_destino || '',
      tipo_destino: placa.tipo_destino || 'google_reviews',
      contato_nome: placa.contato_nome || '',
      contato_telefone: placa.contato_telefone || '',
      status_digital: placa.url_destino ? (placa.status_digital || 'ativa') : 'ativa',
    });
  };

  const handleSaveAdminPlateEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEditingPlate) return;
    const cleanUrl = adminPlateForm.url_destino.trim();
    if (adminPlateForm.status_digital === 'ativa' && !cleanUrl) {
      setFeedbackMessage({
        type: 'error',
        text: 'Informe o link de destino (ex: link do Google Avaliações, Instagram ou WhatsApp) para ativar a placa.',
      });
      return;
    }
    const formattedUrl =
      cleanUrl && !/^https?:\/\//i.test(cleanUrl) ? `https://${cleanUrl}` : cleanUrl;

    setSavingAdminPlate(true);
    setFeedbackMessage(null);
    try {
      const res = await api.configurePlate(adminEditingPlate.id, {
        nome_estabelecimento: adminPlateForm.nome_estabelecimento.trim() || null,
        url_destino: formattedUrl || null,
        tipo_destino: adminPlateForm.tipo_destino,
        contato_nome: adminPlateForm.contato_nome.trim() || null,
        contato_telefone: adminPlateForm.contato_telefone.trim() || null,
      });

      if (adminPlateForm.status_digital !== 'ativa' && res.placa?.status_digital === 'ativa') {
        await api.togglePlateStatus(adminEditingPlate.id);
      }

      const updatedPlateObj = {
        ...adminEditingPlate,
        nome_estabelecimento: adminPlateForm.nome_estabelecimento.trim() || null,
        url_destino: formattedUrl || null,
        tipo_destino: adminPlateForm.tipo_destino,
        contato_nome: adminPlateForm.contato_nome.trim() || null,
        contato_telefone: adminPlateForm.contato_telefone.trim() || null,
        status_digital: formattedUrl ? adminPlateForm.status_digital : 'inativa',
      };

      // Atualiza imediatamente todas as listas em memória
      setAllPlatesList((prev) => prev.map((p) => (p.id === adminEditingPlate.id ? { ...p, ...updatedPlateObj } : p)));
      if (adminEditingPlate.order_id) {
        setDeliveredOrderPlatesMap((prev) => ({
          ...prev,
          [adminEditingPlate.order_id]: (prev[adminEditingPlate.order_id] || []).map((p: any) =>
            p.id === adminEditingPlate.id ? { ...p, ...updatedPlateObj } : p
          ),
        }));
      }
      setQrModalPlates((prev) => prev.map((p) => (p.id === adminEditingPlate.id ? { ...p, ...updatedPlateObj } : p)));

      setFeedbackMessage({
        type: 'success',
        text: `✓ Placa ${adminEditingPlate.codigo_sequencial} atualizada com sucesso! O QR Code e NFC já redirecionam para o novo destino.`,
      });
      setAdminEditingPlate(null);
      await loadAllAdminData();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao salvar configuração da placa.',
      });
    } finally {
      setSavingAdminPlate(false);
    }
  };

  const handleAtualizarRastreio = async () => {
    if (!trackingModalOrder || !trackingCodeInput) return;
    setFeedbackMessage(null);
    try {
      const res = await api.updateTracking({
        order_id: trackingModalOrder.order_id,
        codigo_rastreamento: trackingCodeInput,
      });
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: 'Código de rastreamento salvo com sucesso!' });
        setTrackingModalOrder(null);
        setTrackingCodeInput('');
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao salvar rastreamento.' });
    }
  };

  const handleEmitirEtiquetaMelhorEnvio = async (
    orderId: string,
    confirmCheckout = false
  ) => {
    setGeneratingLabelOrderId(orderId);
    setFeedbackMessage(null);
    try {
      const res = await api.generateShippingLabel(orderId, confirmCheckout);
      if (res.sucesso) {
        if (res.status_etiqueta === 'no_carrinho' || res.requer_confirmacao_checkout) {
          setFeedbackMessage({
            type: 'success',
            text: `✓ Envio adicionado com segurança ao carrinho do Melhor Envio (Protocolo: ${res.protocol || res.cart_id}). Clique em "Comprar Etiqueta" para debitar saldo e gerar a impressão.`,
          });
        } else {
          setFeedbackMessage({
            type: 'success',
            text: `✓ Etiqueta gerada via Melhor Envio com sucesso! Código de Rastreamento: ${res.codigo_rastreamento || 'Gerado'}`,
          });
        }
        await loadAllAdminData();
        if (res.etiqueta_url && !res.requer_confirmacao_checkout) {
          window.open(res.etiqueta_url, '_blank');
        }
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao emitir etiqueta.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao emitir etiqueta de frete.' });
    } finally {
      setGeneratingLabelOrderId(null);
    }
  };

  const handleProcessarComprovanteOcr = async (file: File) => {
    if (!ocrModalOrder) return;
    setOcrLoading(true);
    setOcrResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await api.scanReceiptOcr({
          order_id: ocrModalOrder.order_id,
          image_base64: base64,
          mime_type: file.type || 'image/jpeg',
        });

        if (res.sucesso) {
          setOcrResult(res.resultado_ocr);
          setFeedbackMessage({ type: 'success', text: 'Comprovante lido via IA Gemini!' });
          loadAllAdminData();
        }
      } catch (err: any) {
        setFeedbackMessage({ type: 'error', text: err?.message || 'Falha ao processar OCR.' });
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarPrecoIndividual = async () => {
    if (!editingPriceProfile) return;
    setFeedbackMessage(null);
    try {
      let faixas: Array<{ quantidade_minima: number; quantidade_maxima: number | null; preco_unitario: number }> | null = null;

      if (individualUseCustom) {
        faixas = individualTierRows.map((r) => ({
          quantidade_minima: parseInt(r.min, 10),
          quantidade_maxima: r.max.trim() === '' ? null : parseInt(r.max, 10),
          preco_unitario: parseFloat(r.preco.replace(',', '.')),
        }));

        const invalid = faixas.some(
          (f) =>
            !Number.isFinite(f.quantidade_minima) ||
            f.quantidade_minima < 1 ||
            !Number.isFinite(f.preco_unitario) ||
            f.preco_unitario <= 0 ||
            (f.quantidade_maxima !== null && (!Number.isFinite(f.quantidade_maxima) || f.quantidade_maxima < f.quantidade_minima))
        );
        if (faixas.length === 0 || invalid) {
          setFeedbackMessage({ type: 'error', text: 'Revise as faixas: quantidade mínima ≥ 1, máxima ≥ mínima e preço maior que zero.' });
          return;
        }
        faixas.sort((a, b) => a.quantidade_minima - b.quantidade_minima);
      }

      const res = await api.setIndividualPrice(editingPriceProfile.id, null, faixas);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        setEditingPriceProfile(null);
        loadAllAdminData();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao salvar preço individual.' });
    }
  };

  const handleSalvarFaixasPreco = async () => {
    setFeedbackMessage(null);
    const toSave = pricingTiers && pricingTiers.length > 0 ? pricingTiers : DEFAULT_PRICING_TIERS;
    try {
      const res = await api.updatePricingTiers(toSave);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: 'Faixas de preço atualizadas com sucesso!' });
        if (res.faixas && res.faixas.length > 0) {
          setPricingTiers(res.faixas);
        }
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao salvar faixas.' });
    }
  };

  // Handlers para Vendedores Internos e Pedidos com Retirada no Balcão
  const handleSalvarVendedorInterno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternalSellerData.nome.trim() || !newInternalSellerData.email.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Nome e E-mail são obrigatórios para o vendedor interno.' });
      return;
    }
    setSavingInternalSeller(true);
    setFeedbackMessage(null);
    try {
      const res = await api.adminCreateUser({
        nome: newInternalSellerData.nome.trim(),
        email: newInternalSellerData.email.trim(),
        telefone: newInternalSellerData.telefone.trim(),
        cpf_cnpj: newInternalSellerData.cpf_cnpj.trim(),
        tipo_parceiro: 'equipe_interna',
        preferencia_entrega: 'retirada',
      });
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `Vendedor interno "${newInternalSellerData.nome}" cadastrado com sucesso!`,
        });
        setIsNewInternalSellerModalOpen(false);
        setNewInternalSellerData({ nome: '', email: '', telefone: '', cpf_cnpj: '' });
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao cadastrar vendedor interno.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao cadastrar vendedor interno.',
      });
    } finally {
      setSavingInternalSeller(false);
    }
  };
  const handleExcluirPerfil = async (profileId: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir permanentemente o cadastro de "${nome}"? O histórico de pedidos e placas será preservado.`)) {
      return;
    }
    setFeedbackMessage(null);
    try {
      const res = await api.adminDeleteUser(profileId);
      if (res.sucesso) {
        setFeedbackMessage({ type: 'success', text: res.mensagem });
        await loadAllAdminData();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao excluir parceiro.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao excluir parceiro.' });
    }
  };

  const handleOpenEditFullProfile = (prof: Profile) => {
    setEditingFullProfile(prof);
    setEditingProfileForm({
      nome: prof.nome || '',
      email: prof.email || '',
      telefone: prof.telefone || '',
      cpf_cnpj: prof.cpf_cnpj || '',
      tipo_parceiro: (prof.tipo_parceiro as any) || 'revendedor_independente',
      preferencia_entrega: prof.tipo_parceiro === 'equipe_interna' ? 'retirada' : 'correios',
      ativo: prof.ativo !== false,
      cep: prof.cep || '',
      logradouro: prof.logradouro || '',
      numero: prof.numero || '',
      complemento: prof.complemento || '',
      bairro: prof.bairro || '',
      cidade: prof.cidade || '',
      estado: prof.estado || '',
      nova_senha: '',
    });
  };

  const handleSaveFullProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFullProfile) return;
    if (!editingProfileForm.nome.trim() || !editingProfileForm.email.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Nome completo e e-mail são obrigatórios.' });
      return;
    }
    setSavingFullProfile(true);
    setFeedbackMessage(null);
    try {
      const normalizedPayload = {
        ...editingProfileForm,
        preferencia_entrega:
          editingProfileForm.tipo_parceiro === 'equipe_interna'
            ? ('retirada' as const)
            : ('correios' as const),
      };
      const res = await api.adminUpdateUser(editingFullProfile.id, normalizedPayload);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || `✓ Cadastro de "${editingProfileForm.nome}" atualizado e sincronizado com o Painel do Revendedor!`,
        });
        setEditingFullProfile(null);
        await loadAllAdminData();
        onRefreshAll();
      } else {
        setFeedbackMessage({ type: 'error', text: res.mensagem || 'Falha ao salvar alterações do revendedor.' });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao atualizar cadastro do revendedor.' });
    } finally {
      setSavingFullProfile(false);
    }
  };

  const handleCreateNewReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResellerForm.nome.trim() || !newResellerForm.email.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Informe o nome e o e-mail do revendedor.' });
      return;
    }
    setCreatingReseller(true);
    setFeedbackMessage(null);
    try {
      const res = await api.adminCreateUser({
        nome: newResellerForm.nome,
        email: newResellerForm.email,
        telefone: newResellerForm.telefone,
        cpf_cnpj: newResellerForm.cpf_cnpj,
        tipo_parceiro: 'revendedor_independente',
        preferencia_entrega: 'correios',
      });
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: `✓ Revendedor "${newResellerForm.nome}" cadastrado com sucesso!`,
        });
        setIsNewResellerModalOpen(false);
        setNewResellerForm({ nome: '', email: '', telefone: '', cpf_cnpj: '', preferencia_entrega: 'correios' });
        await loadAllAdminData();
        onRefreshAll();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err?.message || 'Erro ao cadastrar revendedor.' });
    } finally {
      setCreatingReseller(false);
    }
  };

  const handleCriarPedidoInterno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternalOrderData.vendedor_id) {
      setFeedbackMessage({ type: 'error', text: 'Por favor, selecione um vendedor interno.' });
      return;
    }
    const qty = Number(newInternalOrderData.quantidade);
    if (isNaN(qty) || qty < 1) {
      setFeedbackMessage({ type: 'error', text: 'Informe uma quantidade válida de placas (mínimo 1).' });
      return;
    }
    setCreatingInternalOrder(true);
    setFeedbackMessage(null);
    try {
      const res = await api.createInternalOrder({
        vendedor_id: newInternalOrderData.vendedor_id,
        quantidade: qty,
        observacoes: newInternalOrderData.observacoes,
      });
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || 'Pedido interno criado com sucesso! Direcionado para produção.',
        });
        setIsNewInternalOrderModalOpen(false);
        setNewInternalOrderData({ vendedor_id: '', quantidade: 10, observacoes: '' });
        await loadAllAdminData();
        setActiveTab('pedidos_recebidos');
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao gerar pedido interno.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar pedido interno.',
      });
    } finally {
      setCreatingInternalOrder(false);
    }
  };

  const handleConfirmarRetiradaBalcao = async (orderId: string, responsavel: string) => {
    if (!confirm(`Deseja confirmar a retirada presencial no balcão?\n\nAs placas físicas deste pedido serão marcadas como liberadas e o pedido será concluído.`)) {
      return;
    }
    setConfirmingWithdrawalOrderId(orderId);
    setFeedbackMessage(null);
    try {
      const res = await api.confirmWithdrawal(orderId, responsavel);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: '✓ Retirada no balcão confirmada com sucesso! Lote entregue e liberado.',
        });
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao confirmar retirada.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao registrar retirada.',
      });
    } finally {
      setConfirmingWithdrawalOrderId(null);
    }
  };

  // Handler de Exclusão Definitiva de Pedidos da Esteira
  const handleConfirmarExclusaoPedido = async () => {
    if (!deletingOrder) return;
    setIsDeletingLoading(true);
    setFeedbackMessage(null);
    try {
      const orderId = deletingOrder.id || deletingOrder.order_id;
      const res = await api.deleteOrder(orderId, reaproveitarPlacasOption);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || `Pedido #${deletingOrder.numero_pedido} totalmente apagado do banco de dados!`,
        });
        setDeletingOrder(null);
        setOpenMenuOrderId(null);
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao excluir pedido.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao excluir pedido do banco de dados.',
      });
    } finally {
      setIsDeletingLoading(false);
    }
  };

  // Handlers para Seleção e Exclusão em Massa
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllOrders = (ordersToToggle: Order[]) => {
    const allIds = ordersToToggle.map((o) => o.id);
    const areAllSelected = allIds.length > 0 && allIds.every((id) => selectedOrderIds.includes(id));
    if (areAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(allIds);
    }
  };

  const handleConfirmarExclusaoEmMassa = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkDeletingLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await api.bulkDeleteOrders(selectedOrderIds, bulkReaproveitarPlacasOption);
      if (res.sucesso) {
        setFeedbackMessage({
          type: 'success',
          text: res.mensagem || `${selectedOrderIds.length} pedidos excluídos com sucesso do banco de dados!`,
        });
        setSelectedOrderIds([]);
        setIsBulkDeletingModalOpen(false);
        await loadAllAdminData();
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.mensagem || 'Falha ao excluir pedidos em massa.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao excluir pedidos em massa.',
      });
    } finally {
      setIsBulkDeletingLoading(false);
    }
  };

  // Fecha o menu (...) ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuOrderId) setOpenMenuOrderId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuOrderId]);

  // Fecha automaticamente as mensagens de feedback do topo após 6 segundos
  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => {
      setFeedbackMessage(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  // Separação oficial dos estágios da esteira:
  // 1. Pedidos em Fabricação Ativa (estágio de produção física)
  const ordersInProduction = ordersList.filter((o: Order) => {
    const isMfgActive = mfgQueue.some((m) => m.order_id === o.id && m.status !== 'producao_concluida');
    return (o.status === 'em_producao' || o.mfg_status === 'em_producao' || isMfgActive) && o.status !== 'concluido';
  });

  // 2. Pedidos Aprovados aguardando início de produção (Pagos ou Equipe Interna isenta)
  const ordersApprovedAwaitingProduction = ordersList.filter((o: Order) => {
    if (o.status === 'em_producao' || o.status === 'concluido') return false;
    if (o.mfg_status === 'em_producao' || o.mfg_status === 'producao_concluida') return false;
    const isMfgActive = mfgQueue.some((m) => m.order_id === o.id && m.status !== 'producao_concluida');
    if (isMfgActive) return false;
    const isInternal = o.origem === 'solicitacao_interna' || o.revendedor_tipo === 'equipe_interna';
    return o.status === 'pago' || o.status === 'aprovado' || o.status === 'em_analise' || isInternal;
  });

  // 3. Pedidos Pendentes de pagamento (estritamente revendedores externos)
  const ordersPendingPayment = ordersList.filter((o: Order) => {
    const isMfgActive = mfgQueue.some((m) => m.order_id === o.id && m.status !== 'producao_concluida');
    if (isMfgActive) return false;
    const isInternal = o.origem === 'solicitacao_interna' || o.revendedor_tipo === 'equipe_interna';
    if (isInternal || o.status === 'aprovado' || o.status === 'pago' || o.status === 'em_producao' || o.status === 'concluido') return false;
    return o.status === 'aguardando_pagamento';
  });

  // 4. Pedidos da esteira de Pedidos Recebidos segundo o filtro ativo
  const receivedOrders = ordersList.filter((o: Order) => {
    if (o.status === 'concluido') return false;
    if (receivedFilter === 'todos') return true;
    if (receivedFilter === 'aprovados') return ordersApprovedAwaitingProduction.includes(o);
    if (receivedFilter === 'em_producao') return ordersInProduction.includes(o);
    if (receivedFilter === 'pendentes') return ordersPendingPayment.includes(o);
    return true;
  });

  // 5. Separação oficial entre Despacho e Retirada (Pendentes) vs. Produtos Entregues (Histórico Completo)
  const isLogisticsItemDelivered = (item: any) => {
    const correspondingOrder = ordersList.find((o) => o.id === item.order_id);
    return (
      correspondingOrder?.status === 'concluido' ||
      item.order_status === 'concluido' ||
      item.retirada_status === 'retirada_realizada' ||
      item.retirada_status === 'retirado' ||
      item.correios_status === 'entregue'
    );
  };

  const pendingLogisticsList = logisticsList.filter((item) => !isLogisticsItemDelivered(item));

  // Constrói a lista unificada de Produtos Entregues (pedidos concluídos com ou sem registro em logisticsList)
  const deliveredLogisticsList = (() => {
    const fromLogistics = logisticsList.filter((item) => isLogisticsItemDelivered(item));
    const existingOrderIds = new Set(fromLogistics.map((item) => item.order_id));
    const extraCompletedOrders = ordersList
      .filter((o) => o.status === 'concluido' && !existingOrderIds.has(o.id))
      .map((o) => ({
        order_id: o.id,
        numero_pedido: o.numero_pedido,
        quantidade_total: o.quantidade_total,
        valor_total: o.valor_total,
        order_status: 'concluido',
        order_created_at: o.created_at,
        order_updated_at: o.updated_at,
        observacoes_admin: o.observacoes_admin,
        modalidade: o.modalidade_entrega || 'retirada',
        retirada_status: o.modalidade_entrega === 'correios' ? null : 'retirada_realizada',
        correios_status: o.modalidade_entrega === 'correios' ? 'entregue' : null,
        responsavel_retirada_nome: o.revendedor_nome || 'Retirado pelo Cliente',
        data_retirada_efetiva: o.updated_at || o.created_at,
        revendedor_nome: o.revendedor_nome,
        revendedor_telefone: o.revendedor_telefone,
        revendedor_email: o.revendedor_email,
        tipo_parceiro: o.revendedor_tipo || (o.origem === 'solicitacao_interna' ? 'equipe_interna' : 'revendedor'),
      }));
    return [...fromLogistics, ...extraCompletedOrders].sort((a, b) => {
      const dateA = new Date(a.data_retirada_efetiva || a.updated_at || a.order_updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.data_retirada_efetiva || b.updated_at || b.order_updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  })();

  return (
    <div className="pb-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 text-slate-800">
      {/* Toast Feedback */}
      {feedbackMessage && !feedbackMessage.text.includes('auth/unauthorized-domain') && (
        <div
          className={`mb-4 p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm animate-fadeIn ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Top Header Admin */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            SISTEMA DE GESTÃO INTEGRADA
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Painel do Administrador</h2>
        </div>

        <button
          onClick={loadAllAdminData}
          disabled={loading}
          className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Segmented Navigation Tabs (Atelier das Placas - Dock Clean) */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex items-center gap-1 overflow-x-auto scrollbar-none mb-6 shadow-2xs">
        {[
          {
            id: 'pedidos_recebidos',
            match: ['pedidos_recebidos', 'pedidos'],
            label: 'Pedidos Recebidos',
            icon: Package,
            badge: ordersApprovedAwaitingProduction.length > 0 ? ordersApprovedAwaitingProduction.length : undefined,
          },
          {
            id: 'em_producao',
            match: ['em_producao', 'producao'],
            label: 'Placas em Produção',
            icon: Layers,
            badge: ordersInProduction.length > 0 ? ordersInProduction.length : (platesInProduction.length > 0 ? platesInProduction.length : undefined),
          },
          {
            id: 'despacho_retirada',
            match: ['despacho_retirada'],
            label: 'Despacho e Retirada',
            icon: Truck,
            badge: pendingLogisticsList.length > 0 ? pendingLogisticsList.length : undefined,
          },
          {
            id: 'entregues',
            match: ['entregues'],
            label: 'Produtos Entregues',
            icon: CheckCircle2,
            badge: deliveredLogisticsList.length > 0 ? deliveredLogisticsList.length : undefined,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = tab.match.includes(activeTab);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90 font-bold scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                    isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: PEDIDOS RECEBIDOS (Geração de QR Codes + Início de Produção) */}
      {/* ========================================================================= */}
      {(activeTab === 'pedidos_recebidos' || activeTab === 'pedidos') && (() => {
        // Pedidos aprovados aguardando início de produção (exclui os que já estão em produção ou concluídos)
        const isOrderApproved = (o: Order) => {
          if (o.status === 'em_producao' || o.status === 'concluido' || o.mfg_status === 'em_producao' || o.mfg_status === 'producao_concluida') {
            return false;
          }
          const isMfgActive = mfgQueue.some((m) => m.order_id === o.id && m.status !== 'producao_concluida');
    if (isMfgActive) return false;
    const isInternal = o.origem === 'solicitacao_interna' || o.revendedor_tipo === 'equipe_interna';
          return o.status === 'pago' || o.status === 'aprovado' || o.status === 'em_analise' || isInternal;
        };

        // Pedidos pendentes de pagamento (estritamente aguardando pagamento externo)
        const isOrderPending = (o: Order) => {
          if (o.status === 'em_producao' || o.status === 'concluido' || o.mfg_status === 'em_producao' || o.mfg_status === 'producao_concluida') {
            return false;
          }
          const isMfgActive = mfgQueue.some((m) => m.order_id === o.id && m.status !== 'producao_concluida');
    if (isMfgActive) return false;
    const isInternal = o.origem === 'solicitacao_interna' || o.revendedor_tipo === 'equipe_interna';
          if (isInternal || o.status === 'aprovado' || o.status === 'pago') return false;
          return o.status === 'aguardando_pagamento';
        };

        const approvedOrdersCount = receivedOrders.filter(isOrderApproved).length;
        const pendingOrdersCount = receivedOrders.filter(isOrderPending).length;

        const filteredOrders = receivedOrders.filter((order) => {
          if (receivedFilter === 'todos') return true;
          if (receivedFilter === 'pendentes') return isOrderPending(order);
          if (receivedFilter === 'aprovados') return isOrderApproved(order);
          return true;
        });

        return (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pedidos Recebidos</h3>
                <p className="text-xs text-slate-500">
                  Gere os QR codes individuais para download com numeração sequencial única ou atribua placas de estoque já produzidas antecipadamente.
                </p>
              </div>

              {/* Filtros da Esteira: Aprovados (Padrão), Pendentes e Todos */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold overflow-x-auto max-w-full">
                <button
                  onClick={() => {
                    setReceivedFilter('aprovados');
                    setSelectedOrderIds([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    receivedFilter === 'aprovados'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/50'
                  }`}
                  title="Pedidos liberados para fabricação: Pagos via Asaas e pedidos isentos da Equipe Interna"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aprovados ({approvedOrdersCount})</span>
                </button>
                <button
                  onClick={() => {
                    setReceivedFilter('pendentes');
                    setSelectedOrderIds([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    receivedFilter === 'pendentes'
                      ? 'bg-amber-500 text-white shadow-2xs font-bold'
                      : 'text-amber-700 bg-amber-50/90 hover:bg-amber-100 border border-amber-200/50'
                  }`}
                  title="Filtrar pedidos de revendedores com pagamento pendente para contato e recuperação de carrinho"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pendentes ({pendingOrdersCount})</span>
                </button>
                <button
                  onClick={() => {
                    setReceivedFilter('todos');
                    setSelectedOrderIds([]);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                    receivedFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({receivedOrders.length})
                </button>
              </div>
            </div>

            {/* Banner Informativo de Integração Asaas quando na aba Pendentes */}
            {receivedFilter === 'pendentes' && (
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200/90 rounded-2xl p-4 text-xs space-y-2 animate-fadeIn shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <strong className="text-slate-900 font-bold flex items-center gap-1.5 text-sm">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      Integração Asaas Pronta para Confirmação Automática
                    </strong>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Pix, Cartão de Crédito e Débito
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Toda a arquitetura está 100% conectada ao Asaas. Assim que a chave real for inserida no seu ambiente (<code className="bg-white px-1.5 py-0.5 rounded text-blue-700 font-mono text-[10px] border border-blue-200">ASAAS_API_KEY</code>), o Webhook oficial confirmará os pagamentos em tempo real sem qualquer ação manual.
                </p>
                <div className="flex items-center gap-1 text-[11px] text-indigo-700 font-medium pt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Dica de Teste: Você já pode testar a confirmação automática imediata clicando em <strong>"Testar Confirmação Asaas"</strong> em qualquer pedido abaixo.</span>
                </div>
              </div>
            )}

            {/* Barra de Ações em Massa (Exclusiva da aba Todos os Pedidos) */}
            {receivedFilter === 'todos' && receivedOrders.length > 0 && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length > 0 && selectedOrderIds.length === receivedOrders.length}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate =
                            selectedOrderIds.length > 0 && selectedOrderIds.length < receivedOrders.length;
                        }
                      }}
                      onChange={() => handleSelectAllOrders(receivedOrders)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Selecionar Todos</span>
                  </label>

                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                    {selectedOrderIds.length} de {receivedOrders.length} selecionados
                  </span>
                </div>

                {selectedOrderIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderIds([])}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-700 font-semibold text-xs transition cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkReaproveitarPlacasOption(true);
                        setIsBulkDeletingModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Selecionados ({selectedOrderIds.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Lista de Pedidos Recebidos */}
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isPaid = order.status === 'pago';
                const isApproved = order.status === 'aprovado' || order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna';
                const isInternalAnalysis = order.status === 'em_analise';
                const isInProduction = order.status === 'em_producao';
                const isConcluded = order.status === 'concluido';
                const isPaymentPending = order.status === 'aguardando_pagamento' && !isApproved;
                const canGenerateQr = (isPaid || isApproved) && !isPaymentPending;
                const isQrGenerated = Boolean(
                  order.qrcodes_gerados ||
                  (order.placa_codigo_inicial && order.placa_codigo_final) ||
                  (order.total_placas_geradas && order.total_placas_geradas >= order.quantidade_total)
                );

                // Regra do Usuário: o botão de início de produção só deve estar ativo nos pedidos em que já foram gerados os QR codes ou atribuídos (cards em verde)
                const canStartProduction = !loading && (isPaid || isApproved) && isQrGenerated && !isInProduction && !isConcluded;
                const isRangeExpanded = expandedRangeOrderId === order.id;
                const isSelected = selectedOrderIds.includes(order.id);

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition-all space-y-3 relative ${
                      receivedFilter === 'todos' && isSelected
                        ? 'ring-2 ring-blue-500/80 bg-blue-50/15 border-blue-400'
                        : isQrGenerated
                        ? 'border-emerald-300/80 border-l-[6px] border-l-emerald-500'
                        : 'border-rose-200/80 border-l-[6px] border-l-rose-500'
                    }`}
                  >
                    {/* Linha Superior: Identificação e Único Badge Principal */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {receivedFilter === 'todos' && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                            title="Selecionar pedido para exclusão em massa"
                          />
                        )}
                        <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                          #{order.numero_pedido}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {order.revendedor_nome || 'Revendedor'}
                        </span>
                        {order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna' ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700 flex items-center gap-1 shadow-2xs">
                            <Building className="w-3 h-3 text-cyan-400" />
                            <span>Equipe Interna • Retirada Balcão</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-indigo-500" />
                            <span>Revendedor • Envio Correios</span>
                          </span>
                        )}
                      </div>

                      {/* Sinalização Verde / Vermelha Única e Objetiva + Botão (...) */}
                      <div className="flex items-center gap-1.5">
                        {isQrGenerated ? (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>QR Codes Prontos ({order.placa_codigo_inicial ? `${order.placa_codigo_inicial} a ${order.placa_codigo_final}` : `${order.quantidade_total} un.`})</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>QR Codes Pendentes</span>
                          </span>
                        )}

                        {/* Botão (...) no Canto Superior Direito */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuOrderId(openMenuOrderId === order.id ? null : order.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Opções do pedido"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuOrderId === order.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs animate-fadeIn"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingOrder(order);
                                  setReaproveitarPlacasOption(true);
                                  setOpenMenuOrderId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir Pedido</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadados: Status do Pagamento, Modalidade de Entrega e Data */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5 border-b border-slate-100 pb-2.5">
                      {order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna' ? (
                        <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ Isento de Pagamento (Equipe Interna)
                        </span>
                      ) : (
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : isApproved
                              ? 'bg-blue-100 text-blue-800'
                              : isInternalAnalysis
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {isPaid
                            ? '✓ Pagamento Confirmado'
                            : isApproved
                            ? '✓ Aprovado Internamente'
                            : isInternalAnalysis
                            ? 'Aguardando Aprovação'
                            : `⏳ Aguardando Pagamento (${getElapsedTimeFormatted(order.created_at)})`}
                        </span>
                      )}

                      <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                        {order.modalidade_entrega === 'retirada' ? (
                          <>
                            <Building className="w-3 h-3 text-cyan-600" />
                            <span>Retirada no Balcão</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3 h-3 text-slate-500" />
                            <span>Correios</span>
                          </>
                        )}
                      </span>

                      <span className="text-slate-400 ml-auto text-[11px]">
                        Recebido em {new Date(order.created_at).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Grade de Dados Compacta e Escaneável */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Quantidade:</span>
                        <strong className="text-slate-900 font-bold text-sm">
                          {order.quantidade_total} placas
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Valor Unitário:</span>
                        <span className="font-semibold text-slate-700 text-sm">
                          R$ {order.preco_unitario_aplicado?.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Total do Pedido:</span>
                        <strong className="text-blue-700 font-bold text-sm">
                          R$ {order.valor_total?.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    {/* Bloco Exclusivo de Recuperação de Carrinho para Revendedores com Pagamento Pendente */}
                    {order.status === 'aguardando_pagamento' && order.origem !== 'solicitacao_interna' && order.revendedor_tipo !== 'equipe_interna' && (
                      <div className="p-3 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-emerald-50/60 border border-amber-200/90 rounded-xl space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Aguardando Pagamento {getElapsedTimeFormatted(order.created_at)}</span>
                          </div>
                          {order.revendedor_telefone ? (
                            <span className="text-[11px] text-slate-700 font-semibold flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{order.revendedor_telefone}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Telefone não cadastrado</span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-600 leading-snug">
                          O revendedor <strong>{order.revendedor_nome || 'Revendedor'}</strong> ainda não concluiu o pagamento via Pix. Utilize o botão abaixo para enviar mensagem imediata no WhatsApp oficial com suporte e recuperação de venda.
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {/* Botão Oficial WhatsApp de Recuperação de Carrinho */}
                          <a
                            href={formatWhatsAppRecoveryLink(order)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm hover:shadow cursor-pointer"
                            title="Abrir conversa no WhatsApp com o revendedor com mensagem de recuperação de carrinho pronta"
                          >
                            <WhatsAppIcon className="w-4 h-4 fill-white shrink-0" />
                            <span>Recuperar Carrinho via WhatsApp</span>
                          </a>

                          {/* Botão de Testar Confirmação Asaas (Simula o Webhook que a API do Asaas envia) */}
                          <button
                            type="button"
                            onClick={() => handleSimulateAsaasWebhook(order.id, order.numero_pedido)}
                            disabled={simulatingAsaasOrderId === order.id}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Simula o Webhook de confirmação automática do Asaas (Pix / Cartão de Crédito / Débito)"
                          >
                            {simulatingAsaasOrderId === order.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>Testar Confirmação Asaas</span>
                          </button>

                          {/* Botão de Confirmação Manual de Pagamento */}
                          <button
                            type="button"
                            onClick={() => handleConfirmarPagamentoManual(order.id, order.numero_pedido)}
                            disabled={confirmingPaymentOrderId === order.id}
                            className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Confirmar pagamento manualmente caso o revendedor tenha enviado o comprovante no WhatsApp"
                          >
                            {confirmingPaymentOrderId === order.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>Confirmar Manual</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bloco de Intervalo de Placas (Campos vazios inicialmente + Botão OK) */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700">
                          Intervalo ({order.quantidade_total} un.):
                        </span>
                        <input
                          type="text"
                          value={orderRangeInputs[order.id]?.inicial ?? (order.placa_codigo_inicial || '')}
                          onChange={(e) => handleRangeInicialChange(order, e.target.value)}
                          onBlur={() => handleRangeInicialBlur(order)}
                          placeholder="Cód. Inicial (ex: PLK-000001)"
                          disabled={!canGenerateQr}
                          className="w-40 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <span className="text-slate-400 font-semibold text-xs">até</span>
                        <input
                          type="text"
                          value={orderRangeInputs[order.id]?.final ?? (order.placa_codigo_final || '')}
                          onChange={(e) => {
                            const val = e.target.value.trim().toUpperCase();
                            setOrderRangeInputs((prev) => ({
                              ...prev,
                              [order.id]: {
                                inicial: prev[order.id]?.inicial || order.placa_codigo_inicial || '',
                                final: val,
                              },
                            }));
                          }}
                          placeholder="Cód. Final"
                          disabled={!canGenerateQr}
                          className="w-36 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => handleAtribuirIntervalo(order)}
                          disabled={savingRangeOrderId === order.id || !canGenerateQr}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs ${
                            canGenerateQr && savingRangeOrderId !== order.id
                              ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          }`}
                          title={!canGenerateQr ? 'Confirme o pagamento do pedido para liberar a atribuição de placas' : 'Atribuir este intervalo de placas do estoque ao pedido'}
                        >
                          {savingRangeOrderId === order.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>OK</span>
                          )}
                        </button>
                      </div>

                      {isQrGenerated && order.placa_codigo_inicial && order.placa_codigo_final && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            Vinculado: <strong className="font-mono font-bold text-emerald-900">{order.placa_codigo_inicial}</strong> a <strong className="font-mono font-bold text-emerald-900">{order.placa_codigo_final}</strong>
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Barra de Ações Inferior */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="text-[11px]">
                        {isQrGenerated ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>QR Codes prontos · Liberado para Ver / Baixar e Início de Produção</span>
                          </span>
                        ) : isPaymentPending ? (
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Aguardando pagamento no Asaas ou confirmação manual para liberar a geração de QR Codes</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Gere os QR Codes ali na hora ou atribua um intervalo com OK para habilitar Ver / Baixar</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão de Aprovação Interna (se aplicável) */}
                        {isInternalAnalysis && (
                          <button
                            onClick={() => handleAprovarReservaInterna(order.id)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aprovar Reserva</span>
                          </button>
                        )}

                        {/* Botão 1: Gerar QR Codes (Habilitado no estado inicial do pedido aprovado; desabilitado após gerar/atribuir) */}
                        <button
                          type="button"
                          onClick={() => handleGerarQRCodesPedido(order)}
                          disabled={!canGenerateQr || isQrGenerated || generatingQrOrderId === order.id}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                            canGenerateQr && !isQrGenerated && generatingQrOrderId !== order.id
                              ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          }`}
                          title={
                            isQrGenerated
                              ? 'Os QR Codes deste pedido já foram gerados ou atribuídos'
                              : !canGenerateQr
                                ? 'Aguardando confirmação de pagamento no Asaas ou aprovação manual'
                                : 'Gerar novos QR Codes sequenciais para este pedido agora'
                          }
                        >
                          {generatingQrOrderId === order.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <QrCode className="w-3.5 h-3.5" />
                          )}
                          <span>{generatingQrOrderId === order.id ? 'Gerando...' : 'Gerar QR Codes'}</span>
                        </button>

                        {/* Botão 2: Ver / Baixar QR Codes (Desabilitado no estado inicial; habilitado APÓS gerar QR Codes ou atribuir intervalo com OK) */}
                        <button
                          type="button"
                          onClick={() => handleAbrirGeradorQRCodes(order)}
                          disabled={!isQrGenerated}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                            isQrGenerated
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          }`}
                          title={
                            isQrGenerated
                              ? 'Visualizar e baixar os QR Codes deste pedido'
                              : 'Gere os QR Codes ou atribua um intervalo do estoque (OK) para habilitar este botão'
                          }
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ver / Baixar QR Codes</span>
                        </button>

                        {/* Botão 3: Início de Produção (Habilitado somente após gerar ou atribuir QR Codes) */}
                        {!isInProduction && !isConcluded && (
                          <button
                            onClick={() => handleIniciarProducao(order.id)}
                            disabled={!canStartProduction}
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs ${
                              canStartProduction
                                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            }`}
                            title={
                              !isQrGenerated
                                ? 'Gere os QR Codes ou atribua as placas antes de iniciar a produção'
                                : !isPaid && !isApproved
                                ? 'Aguardando confirmação de pagamento ou aprovação interna'
                                : 'Iniciar fabricação física das placas'
                            }
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Início de Produção</span>
                          </button>
                        )}

                        {isInProduction && (
                          <button
                            onClick={() => setActiveTab('em_producao')}
                            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Ver em Produção</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                );
              })}

              {filteredOrders.length === 0 && (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center">
                  <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-bold">
                    {receivedFilter === 'pendentes'
                      ? 'Nenhum pedido pendente de pagamento no momento!'
                      : receivedFilter === 'aprovados'
                      ? 'Nenhum pedido aprovado aguardando início de produção.'
                      : 'Nenhum pedido recebido no momento.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                    {receivedFilter === 'pendentes'
                      ? 'Todos os pedidos estão aprovados ou são da equipe interna (isentos). Quando um revendedor iniciar um pedido e não pagar, ele aparecerá aqui com botão direto para WhatsApp.'
                      : 'Assim que novos pedidos forem pagos ou emitidos pela equipe interna, eles aparecerão aqui para geração de QR Codes e início de produção.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* ABA: GERAR QR CODES (PRODUÇÃO ANTECIPADA / ESTOQUE SEM PEDIDO) */}
      {/* ========================================================================= */}
      {activeTab === 'gerar_qrcodes' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                FERRAMENTA DO MENU • ESTOQUE ANTECIPADO & NUMERAÇÃO SEQUENCIAL
              </span>
              <h3 className="text-lg font-bold text-slate-900">Geração de QR Codes Antecipada (Estoque)</h3>
              <p className="text-xs text-slate-600 max-w-2xl mt-0.5">
                Produza placas antecipadamente para adiantar a fabricação física mesmo sem pedidos imediatos.
                À medida que os pedidos dos revendedores chegarem, basta atribuir o intervalo de numeração já produzido.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('pedidos_recebidos')}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
            >
              <span>← Voltar para Esteira de Produção</span>
            </button>
          </div>
          <div className="hidden">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
              ESTOQUE ANTECIPADO & NUMERAÇÃO SEQUENCIAL
            </span>
            <h3 className="text-lg font-bold text-slate-900">Geração de QR Codes Antecipada</h3>
            <p className="text-xs text-slate-500 max-w-2xl">
              Produza placas antecipadamente para adiantar a fabricação física (corte, montagem e gravação a laser) mesmo sem pedidos imediatos.
              À medida que os pedidos dos revendedores chegarem, basta atribuir o intervalo de numeração já produzido.
            </p>
          </div>

          {/* Cards de Métricas do Estoque Antecipado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">Placas Livres em Estoque</span>
                <strong className="text-lg font-bold text-slate-900">{unassignedPlates.length}</strong>
                <span className="text-[10px] text-slate-500 block">não atribuídas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">Próximo Código Livre</span>
                <strong className="text-lg font-mono font-bold text-blue-600">{nextAvailableCode}</strong>
                <span className="text-[10px] text-slate-500 block">sequência contínua</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block uppercase">Em Produção no Estoque</span>
                <strong className="text-lg font-bold text-cyan-700">
                  {unassignedPlates.filter((p) => p.status_fisico === 'em_producao' || p.status_fisico === 'planejada').length}
                </strong>
                <span className="text-[10px] text-slate-500 block">adiantando fabricação</span>
              </div>
            </div>
          </div>

          {/* Painel de Ação: Gerar Novo Lote Antecipado */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30">
                  <QrCode className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Gerar Novo Lote de Placas Antecipado</h4>
                  <p className="text-xs text-slate-300">
                    Defina a quantidade de placas para fabricar e gravar a laser previamente.
                  </p>
                </div>
              </div>
            </div>

            {/* Seleção de Quantidade */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Quantidade de Placas a Gerar:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[5, 10, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdvanceQty(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      advanceQty === preset
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {preset} un.
                  </button>
                ))}

                <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Outra:</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={advanceQty}
                    onChange={(e) => setAdvanceQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 bg-transparent text-white text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Status Inicial da Produção */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
              <span className="text-slate-300 font-medium">Status inicial:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="advanceStatus"
                  value="em_producao"
                  checked={advanceStatus === 'em_producao'}
                  onChange={() => setAdvanceStatus('em_producao')}
                  className="text-blue-600 focus:ring-0"
                />
                <span>Enviar direto para <strong>Em Produção</strong> (recomendado)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                <input
                  type="radio"
                  name="advanceStatus"
                  value="planejada"
                  checked={advanceStatus === 'planejada'}
                  onChange={() => setAdvanceStatus('planejada')}
                  className="text-blue-600 focus:ring-0"
                />
                <span>Apenas Planejada (aguarda início)</span>
              </label>
            </div>

            {/* Prévia do Intervalo Calculado */}
            <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs">
                <span className="text-slate-400 block text-[11px]">Intervalo Sequencial Previsto:</span>
                <span className="font-mono font-bold text-indigo-300 text-sm">
                  {nextAvailableCode}
                </span>
                <span className="text-slate-400 mx-1.5">até</span>
                <span className="font-mono font-bold text-indigo-300 text-sm">
                  {(() => {
                    const startNum = parseInt(nextAvailableCode.replace('PLK-', ''), 10) || 1;
                    const endNum = startNum + advanceQty - 1;
                    return `PLK-${String(endNum).padStart(6, '0')}`;
                  })()}
                </span>
                <span className="ml-2 text-slate-400 text-[11px]">({advanceQty} placas garantidas sem repetição)</span>
              </div>

              <button
                type="button"
                onClick={handleGerarPlacasAntecipadas}
                disabled={advanceGenerating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {advanceGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando Placas...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Gerar Lote de Placas Antecipado</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Banner de Lote Recém-Gerado */}
          {advanceBatchResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      Lote de {advanceBatchResult.total} Placas Gerado com Sucesso!
                    </h4>
                    <p className="text-[11px] font-mono text-emerald-700">
                      Intervalo: {advanceBatchResult.codigo_inicial} até {advanceBatchResult.codigo_final}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      advanceBatchResult.placas.forEach((p) => downloadSingleQrCode(p));
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Todos os {advanceBatchResult.placas.length} QR Codes</span>
                  </button>
                  <button
                    onClick={() => setAdvanceBatchResult(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Grid Rápido de Amostras do Lote Recém-Gerado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-emerald-100">
                {advanceBatchResult.placas.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white p-2 rounded-xl border border-emerald-100 text-center space-y-1 shadow-2xs"
                  >
                    <span className="font-mono text-[10px] font-bold text-slate-800 block">
                      {p.codigo_sequencial}
                    </span>
                    {p.qrcode_data_url && (
                      <img
                        src={p.qrcode_data_url}
                        alt={p.codigo_sequencial}
                        className="w-16 h-16 mx-auto rounded border border-slate-100"
                      />
                    )}
                    <button
                      onClick={() => downloadSingleQrCode(p)}
                      className="w-full text-[9px] font-semibold py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition"
                      title={`Baixar QRCode_${p.codigo_sequencial}.png`}
                    >
                      Baixar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Placas em Estoque Livre (Não Atribuídas) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Estoque Físico de Placas Livres ({unassignedPlates.length} un.)</span>
              </h4>

              {unassignedPlates.length > 0 && (
                <button
                  onClick={() => {
                    unassignedPlates.forEach((p) => downloadSingleQrCode(p));
                  }}
                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Baixar Todos os QR Codes do Estoque</span>
                </button>
              )}
            </div>

            {unassignedPlates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {unassignedPlates.map((plate) => {
                  const isInProd = plate.status_fisico === 'em_producao' || plate.status_fisico === 'planejada';
                  const isDone = plate.status_fisico === 'produzida' || plate.status_fisico === 'aprovada';

                  return (
                    <div
                      key={plate.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-sm font-bold text-slate-900 block">
                            {plate.codigo_sequencial}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Estoque Antecipado
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                          }`}
                        >
                          {isDone ? 'Pronta em Estoque' : 'Em Fabricação'}
                        </span>
                      </div>

                      {/* Imagem do QR Code e URL Permanente */}
                      <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        {(plate.qrcode_url || plate.qrcode_data_url) ? (
                          <img
                            src={plate.qrcode_data_url || plate.qrcode_url}
                            alt={plate.codigo_sequencial}
                            className="w-14 h-14 rounded-lg bg-white p-0.5 border border-slate-200 shrink-0"
                            onError={async (e) => {
                              const target = e.currentTarget;
                              if (plate.qrcode_data_url && target.src !== plate.qrcode_data_url) {
                                target.src = plate.qrcode_data_url;
                              } else if (plate.url_permanente) {
                                target.src = await generateLabeledQrDataUrlInBrowser(plate.url_permanente, plate.codigo_sequencial);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                            <QrCode className="w-6 h-6 text-slate-400" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] uppercase font-semibold text-slate-400 block">
                            URL Permanente:
                          </span>
                          <a
                            href={plate.url_permanente}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline font-mono truncate block"
                            title={plate.url_permanente}
                          >
                            {plate.url_permanente.replace(/^https?:\/\//, '')}
                          </a>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Status digital: Inativa
                          </span>
                        </div>
                      </div>

                      {/* Ações da Placa de Estoque */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                        <button
                          onClick={() => downloadSingleQrCode(plate)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium flex items-center gap-1 transition"
                          title={`Baixar QRCode_${plate.codigo_sequencial}.png`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar QR</span>
                        </button>

                        {isInProd && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.finalizePlate(plate.id);
                                if (res.sucesso) {
                                  setFeedbackMessage({ type: 'success', text: `Placa ${plate.codigo_sequencial} marcada como finalizada!` });
                                  loadAllAdminData();
                                }
                              } catch (e: any) {
                                setFeedbackMessage({ type: 'error', text: e?.message || 'Erro ao finalizar placa.' });
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
                          >
                            <Check className="w-3 h-3" />
                            <span>Finalizado</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <h5 className="text-xs font-bold text-slate-700">Nenhuma placa antecipada em estoque</h5>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Utilize o painel acima para produzir placas previamente e acelerar as entregas aos seus revendedores.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PLACAS EM PRODUÇÃO (Com Botão de Finalizado) */}
      {/* ========================================================================= */}
      {(activeTab === 'em_producao' || activeTab === 'producao') && (
        <div className="space-y-5 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-slate-900">Placas em Produção</h3>
            <p className="text-xs text-slate-500">
              Acompanhe as unidades em usinagem, gravação e montagem. Ao concluir a fabricação, clique no botão <strong>Finalizado</strong> para liberar ao despacho/retirada.
            </p>
          </div>

          {/* Lotes e Pedidos em Fabricação Ativa (Design Completo e Idêntico a Pedidos Recebidos) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Pedidos e Lotes em Fabricação ({ordersInProduction.length})</span>
              </h4>
            </div>

            {ordersInProduction.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center text-xs text-slate-500 space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhum pedido em fabricação ativa no momento.</p>
                <p className="text-[11px] text-slate-400">
                  Para iniciar a produção de um lote, acesse a aba <strong>Pedidos Recebidos</strong> e clique em <strong>Início de Produção</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ordersInProduction.map((order) => {
                  const isQrGenerated = Boolean(
                    order.qrcodes_gerados ||
                    (order.placa_codigo_inicial && order.placa_codigo_final) ||
                    (order.total_placas_geradas && order.total_placas_geradas >= order.quantidade_total)
                  );

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition-all space-y-3 relative border-emerald-300/80 border-l-[6px] border-l-emerald-500"
                    >
                      {/* Cabeçalho do Card */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                            #{order.numero_pedido || order.id.slice(0, 8)}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">
                            {order.revendedor_nome || 'Revendedor'}
                          </span>
                          {order.origem === 'solicitacao_interna' || order.revendedor_tipo === 'equipe_interna' ? (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700 flex items-center gap-1 shadow-2xs">
                              <Building className="w-3 h-3 text-cyan-400" />
                              <span>Equipe Interna • Retirada Balcão</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-indigo-500" />
                              <span>Revendedor • {order.modalidade_entrega === 'retirada' ? 'Retirada no Balcão' : 'Envio Correios'}</span>
                            </span>
                          )}
                        </div>

                        {/* Sinalização Verde de QR Codes Prontos + Botão (...) */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              QR Codes Prontos ({order.placa_codigo_inicial ? `${order.placa_codigo_inicial} a ${order.placa_codigo_final}` : `${order.quantidade_total} un.`})
                            </span>
                          </span>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuOrderId(openMenuOrderId === order.id ? null : order.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Opções do pedido"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuOrderId === order.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs animate-fadeIn"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingOrder(order);
                                    setReaproveitarPlacasOption(true);
                                    setOpenMenuOrderId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir Pedido</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Metadados: Status de Produção, Modalidade de Entrega e Data */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5 border-b border-slate-100 pb-2.5">
                        <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          ✓ Pagamento Confirmado
                        </span>

                        <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                          {order.modalidade_entrega === 'retirada' ? (
                            <>
                              <Building className="w-3 h-3 text-cyan-600" />
                              <span>Retirada no Balcão</span>
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3 text-slate-500" />
                              <span>Correios</span>
                            </>
                          )}
                        </span>

                        <span className="text-slate-400 ml-auto text-[11px]">
                          Recebido em {new Date(order.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Grade de Dados Compacta e Escaneável */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Quantidade:</span>
                          <strong className="text-slate-900 font-bold text-sm">
                            {order.quantidade_total} placas
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Valor Unitário:</span>
                          <span className="font-semibold text-slate-700 text-sm">
                            R$ {order.preco_unitario_aplicado?.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Total do Pedido:</span>
                          <strong className="text-blue-700 font-bold text-sm">
                            R$ {order.valor_total?.toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {/* Bloco de Intervalo de Placas Vinculadas */}
                      {order.placa_codigo_inicial && (
                        <div className="px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-emerald-800">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              Placas vinculadas: <strong className="font-mono font-bold text-emerald-900">{order.placa_codigo_inicial}</strong> até <strong className="font-mono font-bold text-emerald-900">{order.placa_codigo_final}</strong>
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {order.quantidade_total} unidades em usinagem
                          </span>
                        </div>
                      )}

                      {/* Barra de Ações Inferior: Ver/Baixar QR Codes + Finalizar Produção */}
                      <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="text-[11px]">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Placas em usinagem, gravação e montagem física</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Botão Oficial: Ver / Baixar QR Codes */}
                          <button
                            type="button"
                            onClick={() => handleAbrirGeradorQRCodes(order)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                            title="Visualizar e baixar novamente os QR Codes já gerados para este pedido"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Ver / Baixar QR Codes</span>
                          </button>

                          {/* Botão Oficial: Finalizar Lote Inteiro / Concluir Produção */}
                          <button
                            type="button"
                            onClick={() => handleFinalizarProducaoLote(order.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                            title="Concluir a fabricação deste lote e encaminhar para Despacho e Retirada"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Finalizar Produção</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Unidades Físicas Individuais em Produção (Design Completo e Idêntico) */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-blue-600" />
                <span>Placas Individuais em Produção ({platesInProduction.length})</span>
              </h4>
            </div>

            {platesInProduction.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center text-xs text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p>Nenhuma placa individual pendente de produção física no momento.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Inicie a produção de um pedido recebido na aba <strong>Pedidos Recebidos</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {platesInProduction.map((placa) => (
                  <div
                    key={placa.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition-all space-y-3 relative border-emerald-300/80 border-l-[6px] border-l-emerald-500"
                  >
                    {/* Cabeçalho da Placa Individual */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200/80 shadow-2xs">
                          {placa.codigo_sequencial}
                        </span>
                        {placa.numero_pedido && (
                          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            Pedido #{placa.numero_pedido}
                          </span>
                        )}
                        <strong className="text-xs text-slate-900">
                          {placa.revendedor_nome || 'Revendedor'}
                        </strong>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {placa.modalidade_entrega === 'retirada' ? 'Retirada no Balcão' : 'Envio Correios'}
                        </span>
                      </div>

                      <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Usinagem em Curso ({placa.codigo_sequencial})</span>
                      </span>
                    </div>

                    {/* Informações Técnicas e Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 pt-0.5">
                      <span className="text-cyan-800 font-medium bg-cyan-50/60 px-2 py-0.5 rounded border border-cyan-200/60 flex items-center gap-1">
                        <Radio className="w-3 h-3 text-cyan-600" />
                        <span>NFC: NTAG213 (144 bytes)</span>
                      </span>

                      <span className="text-slate-500 font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        Token: {placa.token_publico || 'Pendente'}
                      </span>

                      <span className="text-slate-400 ml-auto text-[11px] truncate max-w-xs font-mono">
                        URL: {placa.url_permanente || 'https://...'}
                      </span>
                    </div>

                    {/* Grade de Especificações da Unidade */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Acabamento:</span>
                        <strong className="text-slate-800 font-bold">
                          Acrílico Cristal 3mm
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Status Físico:</span>
                        <span className="font-semibold text-cyan-700">
                          Em Fabricação
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Status Digital:</span>
                        <strong className="text-slate-700 font-semibold">
                          {placa.status_digital === 'ativa' ? '✓ Ativa' : 'Aguardando Ativação'}
                        </strong>
                      </div>
                    </div>

                    {/* Barra de Ações Inferior da Placa */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pronta para inspeção de leitura do QR Code e acabamento</span>
                      </span>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* Botão Ver / Baixar QR Code Individual */}
                        <button
                          type="button"
                          onClick={() => handleVerQrCodePlaca(placa)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          title="Visualizar e baixar o QR Code específico desta placa"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ver / Baixar QR Code</span>
                        </button>

                        {/* Checklist de Inspeção */}
                        <button
                          type="button"
                          onClick={() => setInspectingPlate(placa)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition flex items-center gap-1 cursor-pointer"
                          title="Abrir checklist de inspeção de qualidade"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 text-slate-600" />
                          <span>Inspeção</span>
                        </button>

                        {/* Botão Finalizar Placa */}
                        <button
                          type="button"
                          onClick={() => handleFinalizarPlaca(placa.id)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                          title="Marcar placa como produzida e aprovada"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Finalizar Placa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: DESPACHO E RETIRADA (Itens Produzidos) */}
      {/* ========================================================================= */}
      {activeTab === 'despacho_retirada' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Despacho e Retirada</h3>
              <p className="text-xs text-slate-500">
                Gerencie o despacho de itens produzidos via Correios/Transportadora ou a entrega física por retirada no balcão.
              </p>
            </div>

            {/* Sub-filtro de Modalidade */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold">
              <button
                onClick={() => setLogisticsTabFilter('todos')}
                className={`px-3 py-1 rounded-lg transition ${
                  logisticsTabFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({pendingLogisticsList.length})
              </button>
              <button
                onClick={() => setLogisticsTabFilter('correios')}
                className={`px-3 py-1 rounded-lg transition ${
                  logisticsTabFilter === 'correios' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Correios ({pendingLogisticsList.filter((l) => l.modalidade === 'correios').length})
              </button>
              <button
                onClick={() => setLogisticsTabFilter('retirada')}
                className={`px-3 py-1 rounded-lg transition ${
                  logisticsTabFilter === 'retirada' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Retirada ({pendingLogisticsList.filter((l) => l.modalidade === 'retirada').length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {pendingLogisticsList
              .filter((item) => {
                if (logisticsTabFilter === 'todos') return true;
                return item.modalidade === logisticsTabFilter;
              })
              .map((item) => {
                const correspondingOrder = ordersList.find((o) => o.id === item.order_id);
                const fullOrder: Order = correspondingOrder || ({
                  id: item.order_id,
                  numero_pedido: item.numero_pedido || item.order_id,
                  quantidade_total: item.quantidade_total || 1,
                  valor_total: item.valor_total || 0,
                  preco_unitario_aplicado: item.valor_total && item.quantidade_total ? (item.valor_total / item.quantidade_total) : 21.90,
                  revendedor_nome: item.revendedor_nome,
                  status: item.order_status,
                  modalidade_entrega: item.modalidade,
                  origem: item.tipo_parceiro === 'equipe_interna' ? 'solicitacao_interna' : 'loja_revendedor',
                  revendedor_tipo: item.tipo_parceiro,
                  qrcodes_gerados: true,
                } as Order);

                const isInternal = item.tipo_parceiro === 'equipe_interna' || fullOrder.origem === 'solicitacao_interna' || fullOrder.revendedor_tipo === 'equipe_interna';
                const isRetiradaConcluida = item.modalidade === 'retirada' && item.retirada_status === 'retirada_realizada';
                const isCorreiosEnviado = item.modalidade === 'correios' && Boolean(item.codigo_rastreamento || item.correios_status === 'postado' || item.correios_status === 'em_transito' || item.correios_status === 'entregue');

                return (
                  <div
                    key={item.order_id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition-all space-y-3 relative border-emerald-300/80 border-l-[6px] border-l-emerald-500"
                  >
                    {/* Linha Superior: Identificação e Status da Logística */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                          #{item.numero_pedido}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {item.revendedor_nome || 'Revendedor'}
                        </span>
                        {isInternal ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700 flex items-center gap-1 shadow-2xs">
                            <Building className="w-3 h-3 text-cyan-400" />
                            <span>Equipe Interna</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-indigo-500" />
                            <span>Revendedor • {item.modalidade === 'retirada' ? 'Retirada no Balcão' : 'Envio Correios'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Principal de Logística */}
                        {item.modalidade === 'retirada' ? (
                          isRetiradaConcluida ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>✓ Retirado pelo Cliente</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Pronto para Retirada no Balcão</span>
                            </span>
                          )
                        ) : (
                          isCorreiosEnviado ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1 shadow-2xs">
                              <Truck className="w-3 h-3 text-blue-600" />
                              <span>Enviado {item.codigo_rastreamento ? `(${item.codigo_rastreamento})` : ''}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Pronto para Envio (Aguardando Postagem)</span>
                            </span>
                          )
                        )}

                        {/* Menu 3 Pontos */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuOrderId(openMenuOrderId === item.order_id ? null : item.order_id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Opções do pedido"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuOrderId === item.order_id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs animate-fadeIn"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingOrder(fullOrder);
                                  setReaproveitarPlacasOption(true);
                                  setOpenMenuOrderId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir Pedido</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadados: Status de Pagamento, Modalidade de Entrega e Data */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5 border-b border-slate-100 pb-2.5">
                      {isInternal ? (
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Equipe Interna (Isento de Pagamento)</span>
                        </span>
                      ) : (
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>✓ Pagamento Confirmado</span>
                        </span>
                      )}

                      <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                        {item.modalidade === 'retirada' ? (
                          <>
                            <Building className="w-3 h-3 text-emerald-600" />
                            <span>Retirada no Balcão</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>Envio Correios / Transportadora</span>
                          </>
                        )}
                      </span>

                      <span className="text-slate-400 flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" />
                        <span>
                          {correspondingOrder?.created_at
                            ? `Recebido em ${new Date(correspondingOrder.created_at).toLocaleDateString('pt-BR')} às ${new Date(correspondingOrder.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Pedido Ativo'}
                        </span>
                      </span>
                    </div>

                    {/* Grade Quantitativa e Financeira (3 Colunas) */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Quantidade:</span>
                        <strong className="text-slate-900 font-bold text-sm">
                          {item.quantidade_total} {item.quantidade_total === 1 ? 'placa' : 'placas'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Valor Unitário:</span>
                        <span className="font-semibold text-slate-700 text-sm">
                          R$ {(fullOrder.preco_unitario_aplicado || ((item.valor_total || 0) / (item.quantidade_total || 1))).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Total do Pedido:</span>
                        <strong className="text-blue-700 font-bold text-sm">
                          R$ {(item.valor_total || 0).toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    {/* Bloco de Intervalo de Placas Vinculadas */}
                    <div className="px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {correspondingOrder?.placa_codigo_inicial ? (
                            <>
                              Placas vinculadas: <strong className="font-mono font-bold text-emerald-900">{correspondingOrder.placa_codigo_inicial}</strong> até <strong className="font-mono font-bold text-emerald-900">{correspondingOrder.placa_codigo_final}</strong>
                            </>
                          ) : (
                            <>
                              Placas vinculadas: <strong className="font-mono font-bold text-emerald-900">{item.quantidade_total} unidades produzidas</strong>
                            </>
                          )}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-medium">
                        ✓ Fabricação física finalizada • Liberado para despacho/retirada
                      </span>
                    </div>

                    {/* Bloco Específico da Logística: Endereço ou Responsável Balcão */}
                    {item.modalidade === 'correios' ? (
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-700 pb-1.5 border-b border-slate-200/60">
                          <span className="flex items-center gap-1.5 text-blue-700">
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dados de Envio & Transportadora</span>
                          </span>
                          {item.transportadora && (
                            <span className="text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {item.transportadora} {item.servico_frete ? `(${item.servico_frete})` : ''} · {Number(item.valor_frete || 0) === 0 ? 'Frete Grátis' : `R$ ${Number(item.valor_frete).toFixed(2)}`}
                            </span>
                          )}
                        </div>

                        {item.destinatario_nome || item.logradouro ? (
                          <div className="text-[11px] text-slate-600 leading-relaxed">
                            <strong className="text-slate-900">Destinatário:</strong> {item.destinatario_nome || item.revendedor_nome}
                            <br />
                            <strong className="text-slate-900">Endereço de Entrega:</strong> {item.logradouro || 'Endereço cadastrado'}, {item.numero || 'S/N'}{' '}{item.complemento ? `(${item.complemento})` : ''} - {item.bairro || 'Bairro'}, {item.cidade || 'Cidade'}/{item.uf || 'UF'} - CEP {item.cep || 'CEP'}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">
                            Endereço de entrega padrão do revendedor ({item.revendedor_nome}).
                          </div>
                        )}

                        {item.codigo_rastreamento ? (
                          <div className="flex items-center gap-2 pt-1 text-[11px]">
                            <span className="text-slate-500 font-medium">Código de Rastreamento:</span>
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {item.codigo_rastreamento}
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Aguardando despacho. Insira o código de rastreamento ou faça a leitura do comprovante via OCR.</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/60 text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-emerald-900 pb-1.5 border-b border-emerald-200/60">
                          <span className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Retirada Física no Balcão do Atelier</span>
                          </span>
                          <span className="text-emerald-700 text-[10px] font-normal">
                            Local: Sede / Balcão de Produção
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Responsável pela Retirada:</span>
                            <strong className="text-slate-800">
                              {item.responsavel_retirada_nome || item.revendedor_nome || 'Revendedor'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Telefone / Contato:</span>
                            <span className="text-slate-700 font-mono font-medium">
                              {item.responsavel_retirada_telefone || item.revendedor_telefone || 'Não informado'}
                            </span>
                          </div>
                        </div>

                        {isRetiradaConcluida ? (
                          <div className="text-[11px] text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1.5 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Retirada confirmada presencialmente por: {item.responsavel_retirada_nome || item.revendedor_nome || 'Cliente'}.</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Aguardando comparecimento do revendedor. Envie um aviso por WhatsApp ou registre a retirada abaixo.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Barra de Ações Inferior: Ver/Baixar QR Codes + Ações Específicas da Fase */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="text-[11px]">
                        {item.modalidade === 'retirada' ? (
                          <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Itens conferidos e prontos para entrega presencial</span>
                          </span>
                        ) : (
                          <span className="text-blue-800 font-semibold flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Itens embalados e prontos para envio logístico</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Botão Oficial: Ver / Baixar QR Codes */}
                        <button
                          type="button"
                          onClick={() => handleAbrirGeradorQRCodes(fullOrder)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          title="Visualizar e baixar novamente os QR Codes deste pedido"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ver / Baixar QR Codes</span>
                        </button>

                        {/* Botão Oficial: Alterar Modalidade */}
                        <button
                          type="button"
                          onClick={() => {
                            setChangingDeliveryOrder(item);
                            setNovaModalidade(item.modalidade === 'retirada' ? 'correios' : 'retirada');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                          title="Mudar entrega entre Balcão e Correios"
                        >
                          Alterar Modalidade
                        </button>

                        {/* Ações Específicas de Correios */}
                        {item.modalidade === 'correios' && (
                          <>
                            <button
                              disabled={generatingLabelOrderId === item.order_id}
                              onClick={() => handleEmitirEtiquetaMelhorEnvio(item.order_id, false)}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                              title="Adiciona ao carrinho do Melhor Envio sem debitar saldo automaticamente"
                            >
                              {generatingLabelOrderId === item.order_id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              )}
                              <span>{item.etiqueta_url ? 'Reemitir / Carrinho' : 'Adicionar ao Carrinho ME'}</span>
                            </button>

                            {/* Botão de Compra / Checkout com Confirmação Explícita de Saldo */}
                            <button
                              disabled={generatingLabelOrderId === item.order_id}
                              onClick={() => {
                                const valorFreteFormatado = item.valor_frete ? `R$ ${Number(item.valor_frete).toFixed(2)}` : 'valor cotado';
                                if (
                                  confirm(
                                    `Confirma a compra da etiqueta no Melhor Envio?\n\nTransportadora: ${item.transportadora || 'Melhor Envio'}\nServiço: ${item.servico_frete || '.Package'}\nCusto do frete: ${valorFreteFormatado}\n\nO saldo da sua carteira no Melhor Envio será debitado.`
                                  )
                                ) {
                                  handleEmitirEtiquetaMelhorEnvio(item.order_id, true);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                              title="Efetua o pagamento da etiqueta com saldo da carteira e gera código de barras para impressão"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                              <span>Comprar Etiqueta (Checkout)</span>
                            </button>

                            {(item.etiqueta_url || item.codigo_rastreamento) && (
                              <a
                                href={`/api/integrations?action=print-label&order_id=${item.order_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                                title="Visualizar e imprimir etiqueta térmica / A4 com código de barras"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Imprimir Etiqueta</span>
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setTrackingModalOrder(item);
                                setTrackingCodeInput(item.codigo_rastreamento || '');
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                              title="Digitar ou editar o código de rastreamento"
                            >
                              Inserir Rastreio
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOcrModalOrder(item);
                                setOcrResult(null);
                              }}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Escanear comprovante com OCR inteligente do Gemini"
                            >
                              <Camera className="w-3.5 h-3.5 text-purple-600" />
                              <span>OCR Gemini</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const obs = prompt(
                                  'Confirmar entrega via Correios/Transportadora (opcional: informe código de rastreio ou recebedor):',
                                  item.codigo_rastreamento ? `Entregue (${item.codigo_rastreamento})` : (item.destinatario_nome || item.revendedor_nome || 'Entregue via Transportadora')
                                );
                                if (obs !== null) {
                                  handleConfirmarRetiradaPresencial(item.order_id, obs || 'Entregue via Correios');
                                }
                              }}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                              title="Marcar pedido como entregue e mover para Produtos Entregues"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirmar Entrega</span>
                            </button>
                          </>
                        )}

                        {/* Ações Específicas de Retirada */}
                        {item.modalidade === 'retirada' && (
                          <>
                            <a
                              href={`https://wa.me/${(item.responsavel_retirada_telefone || item.revendedor_telefone || '5521999999999').replace(/\D/g, '')}?text=Ol%C3%A1%2C%20seu%20pedido%20Atelier%20das%20Placas%20%23${item.numero_pedido}%20est%C3%A1%20pronto%20para%20retirada!`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                              title="Abrir conversa no WhatsApp avisando sobre a retirada"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                const quem = prompt('Informe o nome da pessoa que retirou as placas:', item.responsavel_retirada_nome || item.revendedor_nome);
                                if (quem !== null) {
                                  handleConfirmarRetiradaPresencial(item.order_id, quem || 'Próprio Revendedor');
                                }
                              }}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                              title="Registrar que o cliente retirou o pedido e mover para Produtos Entregues"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirmar Retirada</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            {pendingLogisticsList.length === 0 && (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-2">
                <Truck className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-700">Nenhum pedido pendente de despacho ou retirada no momento.</p>
                <p className="text-[11px] text-slate-400">
                  Os pedidos já retirados ou entregues encontram-se arquivados com histórico completo na aba <strong>Produtos Entregues</strong>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: PRODUTOS ENTREGUES (Histórico Completo, Rastreabilidade e Controle) */}
      {/* ========================================================================= */}
      {activeTab === 'entregues' && (() => {
        const totalPlacasEntregues = deliveredLogisticsList.reduce((acc, item) => acc + (Number(item.quantidade_total) || 0), 0);
        const totalRetiradasBalcao = deliveredLogisticsList.filter((item) => item.modalidade !== 'correios').length;
        const totalEnviosCorreios = deliveredLogisticsList.filter((item) => item.modalidade === 'correios').length;

        const filteredDelivered = deliveredLogisticsList.filter((item) => {
          const correspondingOrder = ordersList.find((o) => o.id === item.order_id);
          const isInternal = item.tipo_parceiro === 'equipe_interna' || correspondingOrder?.origem === 'solicitacao_interna' || correspondingOrder?.revendedor_tipo === 'equipe_interna';

          if (deliveredFilter === 'retirada' && item.modalidade === 'correios') return false;
          if (deliveredFilter === 'correios' && item.modalidade !== 'correios') return false;
          if (deliveredFilter === 'internos' && !isInternal) return false;
          if (deliveredFilter === 'revendedores' && isInternal) return false;

          if (deliveredSearch.trim()) {
            const q = deliveredSearch.trim().toLowerCase();
            const matchNumero = (item.numero_pedido || '').toLowerCase().includes(q);
            const matchNome = (item.revendedor_nome || '').toLowerCase().includes(q);
            const matchResponsavel = (item.responsavel_retirada_nome || '').toLowerCase().includes(q);
            const matchRastreio = (item.codigo_rastreamento || '').toLowerCase().includes(q);
            const matchPlacaIni = (correspondingOrder?.placa_codigo_inicial || '').toLowerCase().includes(q);
            const matchPlacaFim = (correspondingOrder?.placa_codigo_final || '').toLowerCase().includes(q);
            return matchNumero || matchNome || matchResponsavel || matchRastreio || matchPlacaIni || matchPlacaFim;
          }
          return true;
        });

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Cabeçalho da Aba Produtos Entregues */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
                  HISTÓRICO OFICIAL DE ENTREGAS & AUDITORIA DE LOTES
                </span>
                <h3 className="text-base font-bold text-slate-900">Produtos Entregues</h3>
                <p className="text-xs text-slate-500">
                  Consulte todo o histórico de placas e pedidos entregues aos revendedores e à equipe interna com rastreabilidade completa de numeração, datas, recebedor e QR Codes.
                </p>
              </div>
            </div>

            {/* Cards de Resumo de Produtos Entregues */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Pedidos Entregues</span>
                  <strong className="text-lg font-bold text-slate-900">{deliveredLogisticsList.length}</strong>
                  <span className="text-[10px] text-emerald-600 font-medium block">concluídos</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total de Placas</span>
                  <strong className="text-lg font-bold text-blue-700">{totalPlacasEntregues}</strong>
                  <span className="text-[10px] text-slate-500 block">unidades em campo</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Retiradas Balcão</span>
                  <strong className="text-lg font-bold text-slate-900">{totalRetiradasBalcao}</strong>
                  <span className="text-[10px] text-slate-500 block">entregas presenciais</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Via Correios</span>
                  <strong className="text-lg font-bold text-slate-900">{totalEnviosCorreios}</strong>
                  <span className="text-[10px] text-slate-500 block">remessas enviadas</span>
                </div>
              </div>
            </div>

            {/* Barra de Busca e Filtros de Auditoria */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={deliveredSearch}
                  onChange={(e) => setDeliveredSearch(e.target.value)}
                  placeholder="Buscar por nº do pedido, revendedor, vendedor interno, placa (ex: PLK-000057), recebedor ou rastreio..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold shrink-0">
                {[
                  { id: 'todos', label: `Todos (${deliveredLogisticsList.length})` },
                  { id: 'retirada', label: `Balcão (${totalRetiradasBalcao})` },
                  { id: 'correios', label: `Correios (${totalEnviosCorreios})` },
                  { id: 'revendedores', label: 'Revendedores' },
                  { id: 'internos', label: 'Equipe Interna' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDeliveredFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      deliveredFilter === f.id ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Cards Completos de Produtos Entregues */}
            <div className="space-y-3">
              {filteredDelivered.map((item) => {
                const correspondingOrder = ordersList.find((o) => o.id === item.order_id);
                const fullOrder: Order = correspondingOrder || ({
                  id: item.order_id,
                  numero_pedido: item.numero_pedido || item.order_id,
                  quantidade_total: item.quantidade_total || 1,
                  valor_total: item.valor_total || 0,
                  preco_unitario_aplicado: item.valor_total && item.quantidade_total ? (item.valor_total / item.quantidade_total) : 21.90,
                  revendedor_nome: item.revendedor_nome,
                  revendedor_telefone: item.revendedor_telefone,
                  revendedor_email: item.revendedor_email,
                  status: 'concluido',
                  modalidade_entrega: item.modalidade,
                  origem: item.tipo_parceiro === 'equipe_interna' ? 'solicitacao_interna' : 'loja_revendedor',
                  revendedor_tipo: item.tipo_parceiro,
                  qrcodes_gerados: true,
                  observacoes_admin: item.observacoes_admin,
                } as Order);

                const isInternal = item.tipo_parceiro === 'equipe_interna' || fullOrder.origem === 'solicitacao_interna' || fullOrder.revendedor_tipo === 'equipe_interna';
                const deliveryDateRaw = item.data_retirada_efetiva || item.updated_at || item.order_updated_at || correspondingOrder?.updated_at || correspondingOrder?.created_at;
                const orderCreatedRaw = item.order_created_at || correspondingOrder?.created_at || item.created_at;
                const isExpandedPlates = expandedDeliveredOrderId === item.order_id;
                const orderPlates = deliveredOrderPlatesMap[item.order_id] || [];

                return (
                  <div
                    key={item.order_id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border shadow-xs hover:shadow-md transition-all space-y-3 relative border-emerald-300/80 border-l-[6px] border-l-emerald-500"
                  >
                    {/* Linha Superior: Identificação Completa + Selo Oficial de Produto Entregue */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 tracking-tight">
                          #{item.numero_pedido || fullOrder.numero_pedido}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {item.revendedor_nome || fullOrder.revendedor_nome || 'Revendedor'}
                        </span>
                        {isInternal ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700 flex items-center gap-1 shadow-2xs">
                            <Building className="w-3 h-3 text-cyan-400" />
                            <span>Equipe Interna</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-indigo-500" />
                            <span>Revendedor • {item.modalidade === 'correios' ? 'Envio Correios' : 'Retirada no Balcão'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Produto Entregue ({correspondingOrder?.placa_codigo_inicial ? `${correspondingOrder.placa_codigo_inicial} a ${correspondingOrder.placa_codigo_final}` : `${item.quantidade_total} un.`})</span>
                        </span>

                        {/* Menu 3 Pontos */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuOrderId(openMenuOrderId === item.order_id ? null : item.order_id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Opções do registro"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuOrderId === item.order_id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs animate-fadeIn"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNotesOrder(fullOrder);
                                  setNotesInput(fullOrder.observacoes_admin || item.observacoes_admin || '');
                                  setOpenMenuOrderId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Editar Observações</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingOrder(fullOrder);
                                  setReaproveitarPlacasOption(true);
                                  setOpenMenuOrderId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir Pedido</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metadados: Pagamento, Modalidade, Data do Pedido e Data Efetiva da Entrega */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5 border-b border-slate-100 pb-2.5">
                      {isInternal ? (
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Equipe Interna (Isento de Pagamento)</span>
                        </span>
                      ) : (
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>✓ Pagamento Liquidado</span>
                        </span>
                      )}

                      <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 flex items-center gap-1">
                        {item.modalidade === 'correios' ? (
                          <>
                            <Truck className="w-3 h-3 text-blue-600" />
                            <span>Entregue via Correios / Transportadora</span>
                          </>
                        ) : (
                          <>
                            <Building className="w-3 h-3 text-emerald-600" />
                            <span>Retirado no Balcão do Atelier</span>
                          </>
                        )}
                      </span>

                      <div className="flex flex-wrap items-center gap-3 ml-auto text-[11px]">
                        {orderCreatedRaw && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              Pedido: {new Date(orderCreatedRaw).toLocaleDateString('pt-BR')} às {new Date(orderCreatedRaw).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        )}
                        {deliveryDateRaw && (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>
                              Entregue em {new Date(deliveryDateRaw).toLocaleDateString('pt-BR')} às {new Date(deliveryDateRaw).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grade Quantitativa e Financeira (3 Colunas) */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Quantidade Entregue:</span>
                        <strong className="text-slate-900 font-bold text-sm">
                          {item.quantidade_total} {item.quantidade_total === 1 ? 'placa' : 'placas'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Valor Unitário:</span>
                        <span className="font-semibold text-slate-700 text-sm">
                          R$ {(fullOrder.preco_unitario_aplicado || ((item.valor_total || 0) / (item.quantidade_total || 1))).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium truncate">Total do Pedido:</span>
                        <strong className="text-blue-700 font-bold text-sm">
                          R$ {(item.valor_total || 0).toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    {/* Bloco de Intervalo de Placas Vinculadas + Botão para Inspecionar cada Placa Individualmente */}
                    <div className="px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-800">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            {correspondingOrder?.placa_codigo_inicial ? (
                              <>
                                Placas vinculadas: <strong className="font-mono font-bold text-emerald-900">{correspondingOrder.placa_codigo_inicial}</strong> até <strong className="font-mono font-bold text-emerald-900">{correspondingOrder.placa_codigo_final}</strong>
                              </>
                            ) : (
                              <>
                                Placas vinculadas: <strong className="font-mono font-bold text-emerald-900">{item.quantidade_total} unidades liberadas</strong>
                              </>
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleInspectDeliveredPlates(item.order_id)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpandedPlates ? 'Ocultar placas individuais' : 'Auditar placas individuais'}</span>
                          {isExpandedPlates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Lista Expansível de Placas Individuais do Pedido Entregue */}
                      {isExpandedPlates && (
                        <div className="pt-2 border-t border-emerald-200/80 space-y-2 animate-fadeIn">
                          {loadingDeliveredPlatesOrderId === item.order_id ? (
                            <div className="py-4 text-center text-xs text-emerald-800 flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                              <span>Consultando placas vinculadas a este pedido...</span>
                            </div>
                          ) : orderPlates.length === 0 ? (
                            <p className="text-xs text-slate-500 py-2">Nenhuma placa individual localizada para este pedido.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {orderPlates.map((rawPlaca: any) => {
                                const livePlaca = allPlatesList.find((p) => p.id === rawPlaca.id) || rawPlaca;
                                const placa = { ...rawPlaca, ...livePlaca };
                                const isActivated = placa.status_digital === 'ativa' && Boolean(placa.url_destino);
                                return (
                                  <div
                                    key={placa.id}
                                    className={`bg-white p-3 rounded-xl border shadow-2xs flex flex-col justify-between gap-2 text-[11px] transition ${
                                      isActivated ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200/90'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-mono font-black text-slate-900 text-xs">{placa.codigo_sequencial}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                          isActivated
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActivated ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`}></span>
                                        <span>{isActivated ? 'Placa Ativada' : 'Aguardando Ativação'}</span>
                                      </span>
                                    </div>

                                    <div className="text-[10px] text-slate-600 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      {placa.nome_estabelecimento ? (
                                        <div className="truncate">
                                          <strong className="text-slate-800">Estabelecimento:</strong> {placa.nome_estabelecimento}
                                        </div>
                                      ) : (
                                        <div className="italic text-slate-400">Sem estabelecimento vinculado ainda</div>
                                      )}
                                      {placa.url_destino ? (
                                        <div className="truncate text-blue-600 font-mono" title={placa.url_destino}>
                                          <strong className="text-slate-700 font-sans">Link Destino:</strong>{' '}
                                          <a href={placa.url_destino} target="_blank" rel="noreferrer" className="hover:underline">
                                            {placa.url_destino}
                                          </a>
                                        </div>
                                      ) : (
                                        <div className="text-amber-700 font-medium">
                                          Nenhum link configurado pelo cliente
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                                      <a
                                        href={placa.url_permanente}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-slate-500 hover:text-blue-600 hover:underline font-mono flex items-center gap-0.5"
                                        title="Testar redirecionamento público desta placa"
                                      >
                                        <span>/r/{placa.token_publico}</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenAdminPlateEditor({ ...placa, revendedor_nome: item.revendedor_nome, numero_pedido: item.numero_pedido })}
                                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[10px] flex items-center gap-1 transition shadow-2xs cursor-pointer"
                                          title="Editar link de destino ou ativar esta placa em nome do cliente/revendedor"
                                        >
                                          <Sliders className="w-2.5 h-2.5" />
                                          <span>{isActivated ? 'Editar Link' : 'Ativar / Link'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => downloadSingleQrCode(placa)}
                                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold text-[10px] flex items-center gap-1 transition cursor-pointer"
                                          title="Baixar imagem PNG do QR Code com número"
                                        >
                                          <Download className="w-2.5 h-2.5" />
                                          <span>PNG</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bloco Completo de Comprovação de Entrega e Contato para Sanar Dúvidas Futuras */}
                    <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80 text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-800 pb-1.5 border-b border-slate-200/70">
                        <span className="flex items-center gap-1.5 text-emerald-800">
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Comprovante & Dados de Rastreabilidade da Entrega</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">ID Pedido: {item.order_id}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            {isInternal ? 'Vendedor Interno Solicitante:' : 'Revendedor Responsável:'}
                          </span>
                          <strong className="text-slate-900 block">{item.revendedor_nome || fullOrder.revendedor_nome || 'Não informado'}</strong>
                          {(item.revendedor_email || fullOrder.revendedor_email) && (
                            <span className="text-slate-500 text-[10px] block">{item.revendedor_email || fullOrder.revendedor_email}</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Telefone / WhatsApp:</span>
                          <span className="text-slate-800 font-mono font-semibold block">
                            {item.responsavel_retirada_telefone || item.revendedor_telefone || fullOrder.revendedor_telefone || 'Não informado'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                            {item.modalidade === 'correios' ? 'Rastreamento / Recebedor:' : 'Retirado Presencialmente Por:'}
                          </span>
                          <strong className="text-emerald-800 font-bold block">
                            {item.modalidade === 'correios'
                              ? (item.codigo_rastreamento ? `Rastreio: ${item.codigo_rastreamento}` : (item.responsavel_retirada_nome || item.destinatario_nome || 'Entregue via Transportadora'))
                              : (item.responsavel_retirada_nome || item.revendedor_nome || 'Próprio Revendedor')}
                          </strong>
                        </div>
                      </div>

                      {item.modalidade === 'correios' && (item.logradouro || item.cidade) && (
                        <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600">
                          <strong className="text-slate-800">Endereço de Destino:</strong>{' '}
                          {item.logradouro || 'Endereço cadastrado'}, {item.numero || 'S/N'} {item.complemento ? `(${item.complemento})` : ''} - {item.bairro || ''}, {item.cidade || ''}/{item.uf || ''} - CEP {item.cep || ''}
                        </div>
                      )}

                      {(fullOrder.observacoes_admin || item.observacoes_admin) && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start justify-between gap-2">
                          <div>
                            <strong className="font-bold block text-[10px] uppercase text-amber-700">Observações de Controle / Auditoria:</strong>
                            <span>{fullOrder.observacoes_admin || item.observacoes_admin}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Barra de Ações Inferior: Baixar QR Codes Novamente, Registrar Nota ou Contatar via WhatsApp */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ciclo de produção e entrega finalizado • Placas liberadas para uso</span>
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAbrirGeradorQRCodes(fullOrder)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                          title="Visualizar e baixar novamente qualquer QR Code deste lote entregue"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Ver / Baixar QR Codes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesOrder(fullOrder);
                            setNotesInput(fullOrder.observacoes_admin || item.observacoes_admin || '');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Adicionar ou editar observações sobre esta entrega"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>Observações</span>
                        </button>

                        <a
                          href={`https://wa.me/${(item.responsavel_retirada_telefone || item.revendedor_telefone || '5521999999999').replace(/\D/g, '')}?text=Ol%C3%A1%2C%20sobre%20o%20seu%20pedido%20entregue%20%23${item.numero_pedido}%20do%20Atelier%20das%20Placas...`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Entrar em contato com o revendedor/vendedor via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredDelivered.length === 0 && (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700">Nenhum produto entregue encontrado para este filtro.</p>
                  <p className="text-[11px] text-slate-400">
                    Assim que você confirmar uma retirada ou entrega na aba <strong>Despacho e Retirada</strong>, o histórico completo do pedido aparecerá automaticamente aqui.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* ABA: INDICADORES EXECUTIVOS (Painel de Métricas em Tempo Real) */}
      {/* ========================================================================= */}
      {activeTab === 'indicadores' && (() => {
        const totalFaturamento = ordersList.reduce((acc, o) => (o.status === 'pago' || o.status === 'concluido' || o.status === 'em_producao') ? acc + (o.valor_total || 0) : acc, 0);
        const totalPlacas = ordersList.reduce((acc, o) => acc + (o.quantidade_total || 0), 0);
        const pedidosPagos = ordersList.filter(o => o.status === 'pago' || o.status === 'concluido').length;
        const pedidosPendentes = ordersList.filter(o => o.status === 'aguardando_pagamento').length;
        const totalRetiradasPendentes = logisticsList.filter(l => l.modalidade === 'retirada' && l.retirada_status !== 'retirada_realizada').length;
        const totalCorreiosPendentes = logisticsList.filter(l => l.modalidade === 'correios' && !l.codigo_rastreamento).length;

        return (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                Métricas do Sistema
              </span>
              <h3 className="text-base font-bold text-slate-900">Indicadores Operacionais e Comerciais</h3>
              <p className="text-xs text-slate-500">
                Consolidação analítica de faturamento, pedidos, capacidade produtiva e logística do Atelier.
              </p>
            </div>

            {/* Grade de KPIs Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Faturamento */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Faturamento</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{pedidosPagos} pedidos aprovados e faturados</span>
                </p>
              </div>

              {/* KPI 2: Placas Fabricadas */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Volume de Placas</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
                    <QrCode className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {totalPlacas}
                </div>
                <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>{ordersInProduction.length} lotes em fabricação ativa</span>
                </p>
              </div>

              {/* KPI 3: Pedidos Ativos */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Pedidos</span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200/60">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {ordersList.length}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {pedidosPendentes} aguardando confirmação financeira
                </p>
              </div>

              {/* KPI 4: Parceiros e Equipe */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rede Parceira</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/80">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {profilesList.length}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Revendedores ativos e equipe comercial
                </p>
              </div>
            </div>

            {/* Painel de Fluxo Operacional */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>Gargalos e Fila Operacional em Tempo Real</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] text-slate-500 block font-medium">Aguardando Produção (Aprovados)</span>
                  <strong className="text-xl font-bold text-slate-900 block">
                    {ordersApprovedAwaitingProduction.length} pedidos
                  </strong>
                  <span className="text-[11px] text-emerald-700">Liberados para início imediato</span>
                </div>

                <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200/80 space-y-1">
                  <span className="text-[11px] text-cyan-800 block font-medium">Em Usinagem Física</span>
                  <strong className="text-xl font-bold text-cyan-950 block">
                    {ordersInProduction.length} lotes ({platesInProduction.length} placas)
                  </strong>
                  <span className="text-[11px] text-cyan-700">Na fresa, laser e gravação NFC</span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                  <span className="text-[11px] text-emerald-800 block font-medium">Prontos para Retirada / Envio</span>
                  <strong className="text-xl font-bold text-emerald-950 block">
                    {totalRetiradasPendentes + totalCorreiosPendentes} unidades
                  </strong>
                  <span className="text-[11px] text-emerald-700">{totalRetiradasPendentes} balcão · {totalCorreiosPendentes} correios</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ========================================================================= */}
      {/* ABA: VENDEDORES INTERNOS (Equipe Interna - Retirada Balcão sem Cobrança) */}
      {/* ========================================================================= */}
      {activeTab === 'vendedores_internos' && (() => {
        const internalSellers = profilesList.filter((p) => p.tipo_parceiro === 'equipe_interna' && p.role !== 'admin');
        const internalOrders = ordersList.filter((o) => o.origem === 'solicitacao_interna' || o.revendedor_tipo === 'equipe_interna');
        const totalPlacasSolicitadas = internalOrders.reduce((acc, o) => acc + (o.quantidade_total || 0), 0);
        const totalPlacasRetiradas = internalOrders
          .filter((o) => o.status === 'concluido' || o.logistica?.retirada_status === 'retirada_realizada')
          .reduce((acc, o) => acc + (o.quantidade_total || 0), 0);
        const pedidosEmProducao = internalOrders.filter((o) => o.status === 'em_producao' || o.mfg_status === 'em_producao').length;

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Cabeçalho da Aba */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700">
                    EQUIPE COMERCIAL INTERNA
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Retirada Presencial · Isento de Pagamento
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-1">Vendedores Internos</h3>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Gerencie a equipe de vendas interna. Os pedidos vinculados a vendedores internos não exigem pagamento via gateway Asaas e são entregues exclusivamente via retirada física no balcão, seguindo o mesmo fluxo na esteira de corte, QR Code e montagem.
                </p>
              </div>

              {/* Botões de Ação do Topo */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewInternalSellerModalOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Novo Vendedor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (internalSellers.length > 0) {
                      setNewInternalOrderData({
                        vendedor_id: internalSellers[0].id,
                        quantidade: 10,
                        observacoes: '',
                      });
                    }
                    setIsNewInternalOrderModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>+ Novo Pedido Interno</span>
                </button>
              </div>
            </div>

            {/* Painel de Métricas da Equipe Interna */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Vendedores Cadastrados</span>
                  <strong className="text-lg font-bold text-slate-900">{internalSellers.length}</strong>
                  <span className="text-[10px] text-slate-500 block">equipe interna</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Pedidos Internos</span>
                  <strong className="text-lg font-bold text-indigo-700">{internalOrders.length}</strong>
                  <span className="text-[10px] text-slate-500 block">{pedidosEmProducao} em produção</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Total Solicitado</span>
                  <strong className="text-lg font-bold text-cyan-700">{totalPlacasSolicitadas} un.</strong>
                  <span className="text-[10px] text-slate-500 block">volume total</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Placas Retiradas</span>
                  <strong className="text-lg font-bold text-emerald-700">{totalPlacasRetiradas} un.</strong>
                  <span className="text-[10px] text-slate-500 block">baixa confirmada</span>
                </div>
              </div>
            </div>

            {/* Listagem de Vendedores Internos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  <span>Membros da Equipe Comercial ({internalSellers.length})</span>
                </h4>
              </div>

              {internalSellers.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-3">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">Nenhum vendedor interno cadastrado ainda.</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Cadastre o primeiro vendedor interno para emitir pedidos com retirada física no balcão sem cobrança Asaas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewInternalSellerModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                  >
                    Cadastrar Vendedor Interno
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {internalSellers.map((seller) => {
                    const sellerOrders = internalOrders.filter((o) => o.revendedor_id === seller.id);
                    const sellerTotalPlacas = sellerOrders.reduce((acc, o) => acc + (o.quantidade_total || 0), 0);
                    const sellerPlacasRetiradas = sellerOrders
                      .filter((o) => o.status === 'concluido' || o.logistica?.retirada_status === 'retirada_realizada')
                      .reduce((acc, o) => acc + (o.quantidade_total || 0), 0);
                    const sellerPendentes = sellerOrders.filter((o) => o.status !== 'concluido').length;

                    const cleanPhone = (seller.telefone || '').replace(/\D/g, '');
                    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

                    return (
                      <div
                        key={seller.id}
                        className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:border-slate-200 transition space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-cyan-300 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                              {seller.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong className="text-xs font-bold text-slate-900 block">{seller.nome}</strong>
                              <span className="text-[11px] text-slate-500 font-mono block">{seller.email}</span>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">
                            Retirada Balcão
                          </span>
                        </div>

                        {/* Dados de Contato e CPF */}
                        <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-medium">WhatsApp / Tel:</span>
                            <span className="font-semibold text-slate-700">{seller.telefone || 'Não informado'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-medium">CPF / Matrícula:</span>
                            <span className="font-mono text-slate-700">{seller.cpf_cnpj || 'Não informado'}</span>
                          </div>
                        </div>

                        {/* Resumo de Produção do Vendedor */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-2 rounded-xl text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Pedidos</span>
                            <strong className="text-slate-800 font-bold">{sellerOrders.length}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Total Placas</span>
                            <strong className="text-indigo-600 font-bold">{sellerTotalPlacas}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Retiradas</span>
                            <strong className="text-emerald-600 font-bold">{sellerPlacasRetiradas}</strong>
                          </div>
                        </div>

                        {/* Botões de Ação Rápida */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] rounded-xl text-[11px] font-semibold flex items-center gap-1 transition"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5 fill-[#128C7E]" />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sem WhatsApp</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditFullProfile(seller)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title={`Editar dados de ${seller.nome}`}
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewInternalOrderData({
                                  vendedor_id: seller.id,
                                  quantidade: 10,
                                  observacoes: '',
                                });
                                setIsNewInternalOrderModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            >
                              <Package className="w-3 h-3" />
                              <span>Gerar Pedido</span>
                            </button>
                            {(!seller.is_master && seller.email?.toLowerCase() !== 'jrmacbrandt@gmail.com') && (
                              <button
                                type="button"
                                onClick={() => handleExcluirPerfil(seller.id, seller.nome)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                title={`Excluir vendedor ${seller.nome}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}


      {/* ========================================================================= */}
      {/* CENTRAL DE PLACAS & LINKS (Suporte Rápido ao Cliente/Revendedor) */}
      {/* ========================================================================= */}
      {activeTab === 'placas_links' && (() => {
        const enrichedAllPlates = allPlatesList.map((p) => {
          const ord = ordersList.find((o) => o.id === p.order_id);
          const prof = profilesList.find((pr) => pr.id === (p.revendedor_id || ord?.revendedor_id));
          return {
            ...p,
            numero_pedido: p.numero_pedido || ord?.numero_pedido || null,
            revendedor_nome: p.revendedor_nome || ord?.revendedor_nome || prof?.nome || null,
            revendedor_telefone: ord?.revendedor_telefone || prof?.telefone || null,
          };
        });

        const totalAtivas = enrichedAllPlates.filter((p) => p.status_digital === 'ativa' && Boolean(p.url_destino)).length;
        const totalAguardando = enrichedAllPlates.filter((p) => (!p.url_destino || p.status_digital !== 'ativa') && Boolean(p.order_id)).length;
        const totalEstoque = enrichedAllPlates.filter((p) => !p.order_id).length;

        const filteredPlates = enrichedAllPlates.filter((p) => {
          const isActivated = p.status_digital === 'ativa' && Boolean(p.url_destino);
          if (centralPlateFilter === 'ativas' && !isActivated) return false;
          if (centralPlateFilter === 'aguardando' && (isActivated || !p.order_id)) return false;
          if (centralPlateFilter === 'estoque' && p.order_id) return false;

          if (centralPlateSearch.trim()) {
            const q = centralPlateSearch.trim().toLowerCase();
            const matchCode = (p.codigo_sequencial || '').toLowerCase().includes(q);
            const matchToken = (p.token_publico || '').toLowerCase().includes(q);
            const matchClient = (p.nome_estabelecimento || '').toLowerCase().includes(q);
            const matchUrl = (p.url_destino || '').toLowerCase().includes(q);
            const matchOrder = (p.numero_pedido || '').toLowerCase().includes(q);
            const matchReseller = (p.revendedor_nome || '').toLowerCase().includes(q);
            return matchCode || matchToken || matchClient || matchUrl || matchOrder || matchReseller;
          }
          return true;
        });

        return (
          <div className="space-y-5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white border border-blue-200/80 rounded-2xl p-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  SUPORTE AO CLIENTE & GESTÃO DE REDIRECIONAMENTO VITALÍCIO
                </span>
                <h3 className="text-lg font-bold text-slate-900">Central de Placas & Edição de Links</h3>
                <p className="text-xs text-slate-600 max-w-2xl mt-0.5">
                  Pesquise qualquer placa pelo número (<strong className="font-mono">PLK-XXXXXX</strong>), pedido, revendedor ou nome do estabelecimento para ativar, corrigir ou atualizar o link de redirecionamento instantaneamente caso o cliente precise de ajuda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('pedidos_recebidos')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
              >
                <span>← Voltar para Esteira</span>
              </button>
            </div>

            {/* Resumo Rápido de Status Digital das Placas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total de Placas</span>
                  <strong className="text-lg font-bold text-slate-900">{enrichedAllPlates.length}</strong>
                  <span className="text-[10px] text-slate-500 block">registradas no banco</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Placas Ativadas</span>
                  <strong className="text-lg font-bold text-emerald-700">{totalAtivas}</strong>
                  <span className="text-[10px] text-emerald-600 font-medium block">com link configurado</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Aguardando Ativação</span>
                  <strong className="text-lg font-bold text-amber-700">{totalAguardando}</strong>
                  <span className="text-[10px] text-slate-500 block">em posse do cliente</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Estoque Livre</span>
                  <strong className="text-lg font-bold text-indigo-700">{totalEstoque}</strong>
                  <span className="text-[10px] text-slate-500 block">sem pedido vinculado</span>
                </div>
              </div>
            </div>

            {/* Barra de Busca e Filtro por Status Digital */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={centralPlateSearch}
                  onChange={(e) => setCentralPlateSearch(e.target.value)}
                  placeholder="Digite o código da placa (ex: PLK-000090), nome do cliente, link de destino, nº do pedido ou revendedor..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold shrink-0">
                {[
                  { id: 'todas', label: `Todas (${enrichedAllPlates.length})` },
                  { id: 'ativas', label: `Ativadas (${totalAtivas})` },
                  { id: 'aguardando', label: `Aguardando Ativação (${totalAguardando})` },
                  { id: 'estoque', label: `Estoque Livre (${totalEstoque})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCentralPlateFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      centralPlateFilter === f.id ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Placas com Edição de Link em 1 Clique */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPlates.map((placa) => {
                const isActivated = placa.status_digital === 'ativa' && Boolean(placa.url_destino);
                return (
                  <div
                    key={placa.id}
                    className={`bg-white rounded-2xl p-4 border shadow-2xs hover:shadow-md transition space-y-3 ${
                      isActivated ? 'border-emerald-200/90 hover:border-emerald-400' : 'border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                          {placa.codigo_sequencial}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {placa.revendedor_nome || 'Estoque Livre (Sem Revendedor)'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {placa.numero_pedido ? `Pedido #${placa.numero_pedido}` : 'Placa de Estoque'} · Token: /r/{placa.token_publico}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                          isActivated
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActivated ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`}></span>
                        <span>{isActivated ? 'Ativa em Cliente' : 'Aguardando Ativação'}</span>
                      </span>
                    </div>

                    {/* Dados do Cliente e Link Configurado */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Estabelecimento / Cliente Final:</span>
                        {placa.tipo_destino && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {placa.tipo_destino === 'google_reviews' ? 'Google Avaliações' : placa.tipo_destino === 'instagram' ? 'Instagram' : placa.tipo_destino === 'whatsapp' ? 'WhatsApp' : 'Link Personalizado'}
                          </span>
                        )}
                      </div>
                      <strong className="text-slate-900 block truncate">
                        {placa.nome_estabelecimento || 'Nenhum estabelecimento informado pelo revendedor/cliente'}
                      </strong>

                      <div className="pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Link de Redirecionamento Atual:</span>
                        {placa.url_destino ? (
                          <a
                            href={placa.url_destino}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-mono text-[11px] break-all flex items-center gap-1"
                          >
                            <span className="truncate">{placa.url_destino}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-700 italic">
                            Ainda não configurado — clique em &quot;Editar Link / Ativar&quot; para configurar pelo painel.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra de Ações da Placa */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <a
                        href={placa.url_permanente}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-500 hover:text-blue-600 font-mono flex items-center gap-1"
                      >
                        <span>Testar QR (/r/{placa.token_publico})</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => downloadSingleQrCode(placa)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAdminPlateEditor(placa)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{isActivated ? 'Editar Link / Destino' : 'Ativar / Configurar Link'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredPlates.length === 0 && (
              <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-2">
                <QrCode className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Nenhuma placa encontrada para a pesquisa atual.</p>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === 'revendedores' && (() => {
        const resellersOnlyList = profilesList.filter(
          (p) => p.tipo_parceiro !== 'equipe_interna' && p.role !== 'admin'
        );
        const independentResellersCount = resellersOnlyList.filter(
          (p) => p.tipo_parceiro !== 'parceiro_especial'
        ).length;
        const specialPartnersCount = resellersOnlyList.filter(
          (p) => p.tipo_parceiro === 'parceiro_especial'
        ).length;
        const customPricingCount = resellersOnlyList.filter((p) =>
          Boolean(p.preco_individual || (p.faixas_preco_individual && p.faixas_preco_individual.length > 0))
        ).length;

        const filteredResellers = resellersOnlyList.filter((prof) => {
          if (resellerFilter === 'independentes' && prof.tipo_parceiro === 'parceiro_especial') return false;
          if (resellerFilter === 'internos' && prof.tipo_parceiro !== 'parceiro_especial') return false;
          if (
            resellerFilter === 'especiais' &&
            !prof.preco_individual &&
            !(prof.faixas_preco_individual && prof.faixas_preco_individual.length > 0)
          ) {
            return false;
          }

          if (resellerSearch.trim()) {
            const q = resellerSearch.trim().toLowerCase();
            const matchNome = (prof.nome || '').toLowerCase().includes(q);
            const matchEmail = (prof.email || '').toLowerCase().includes(q);
            const matchTel = (prof.telefone || '').toLowerCase().includes(q);
            const matchDoc = (prof.cpf_cnpj || '').toLowerCase().includes(q);
            const matchCidade = (prof.cidade || '').toLowerCase().includes(q);
            return matchNome || matchEmail || matchTel || matchDoc || matchCidade;
          }
          return true;
        });

        return (
          <div className="space-y-5 animate-fadeIn">
            {/* Cabeçalho da Gestão de Revendedores */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  CONTROLE TOTAL DE CADASTROS • SINCRONIZADO COM O PAINEL DO REVENDEDOR
                </span>
                <h3 className="text-lg font-bold text-slate-900">Revendedores Cadastrados na Plataforma</h3>
                <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                  Visualize e edite todas as informações pessoais, WhatsApp, CPF/CNPJ, endereço completo de entrega, modalidade preferencial e tabela de preços de qualquer revendedor. Ao salvar, as alterações já aparecem imediatamente no perfil do revendedor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewResellerModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>+ Novo Revendedor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pedidos_recebidos')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>← Esteira</span>
                </button>
              </div>
            </div>

            {/* Cards de Resumo de Revendedores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total Revendedores</span>
                  <strong className="text-lg font-bold text-slate-900">{resellersOnlyList.length}</strong>
                  <span className="text-[10px] text-slate-500 block">revendedores ativos</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Independentes</span>
                  <strong className="text-lg font-bold text-emerald-700">{independentResellersCount}</strong>
                  <span className="text-[10px] text-emerald-600 font-medium block">revendedores oficiais</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Preço Diferenciado</span>
                  <strong className="text-lg font-bold text-indigo-700">{customPricingCount}</strong>
                  <span className="text-[10px] text-slate-500 block">tabela personalizada</span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-cyan-200/80 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Parceiros Especiais</span>
                  <strong className="text-lg font-bold text-cyan-700">{specialPartnersCount}</strong>
                  <span className="text-[10px] text-slate-500 block">contas especiais</span>
                </div>
              </div>
            </div>

            {/* Barra de Busca e Filtros de Revendedores */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={resellerSearch}
                  onChange={(e) => setResellerSearch(e.target.value)}
                  placeholder="Buscar revendedor por nome, e-mail, WhatsApp, CPF/CNPJ ou cidade..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold shrink-0">
                {[
                  { id: 'todos', label: `Todos os Revendedores (${resellersOnlyList.length})` },
                  { id: 'independentes', label: `Independentes (${independentResellersCount})` },
                  { id: 'especiais', label: `Com Preço Especial (${customPricingCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setResellerFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      resellerFilter === f.id ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista Completa de Cards de Revendedores */}
            <div className="space-y-3">
              {filteredResellers.map((prof) => {
                const resellerOrders = ordersList.filter((o) => o.revendedor_id === prof.id);
                const resellerPlates = allPlatesList.filter((p) => p.revendedor_id === prof.id);
                const activeResellerPlates = resellerPlates.filter((p) => p.status_digital === 'ativa' && Boolean(p.url_destino));
                const totalSpent = resellerOrders
                  .filter((o) => o.status === 'pago' || o.status === 'em_producao' || o.status === 'concluido')
                  .reduce((acc, o) => acc + (Number(o.valor_total) || 0), 0);
                const cleanPhone = (prof.telefone || '').replace(/\D/g, '');
                const waHref = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : null;
                const hasAddress = Boolean(prof.logradouro || prof.cidade || prof.cep);

                return (
                  <div
                    key={prof.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-blue-300 transition space-y-3.5"
                  >
                    {/* Cabeçalho do Revendedor */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {(prof.nome || 'RV').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm font-bold text-slate-900">{prof.nome}</strong>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                prof.role === 'admin'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : prof.tipo_parceiro === 'equipe_interna'
                                    ? 'bg-slate-900 text-cyan-300 border-slate-700'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {prof.role === 'admin'
                                ? '★ Administrador Master'
                                : prof.tipo_parceiro === 'equipe_interna'
                                  ? 'Equipe Interna'
                                  : prof.tipo_parceiro === 'parceiro_especial'
                                    ? 'Parceiro Especial'
                                    : 'Revendedor Oficial'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                prof.ativo !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {prof.ativo !== false ? '● Conta Ativa' : '○ Conta Inativa'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono">{prof.email}</span>
                            <span>·</span>
                            <span>WhatsApp: <strong className="text-slate-700 font-mono">{prof.telefone || 'Não informado'}</strong></span>
                            <span>·</span>
                            <span>CPF/CNPJ: <strong className="text-slate-700 font-mono">{prof.cpf_cnpj || 'Não informado'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Botões Principais de Controle do Revendedor */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditFullProfile(prof)}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                          title="Editar nome, e-mail, telefone, CPF/CNPJ, endereço completo e preferências deste revendedor"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Editar Cadastro Completo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openIndividualPricingModal(prof)}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Definir preço diferenciado ou faixas exclusivas para este revendedor"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Faixas de Preço</span>
                        </button>

                        {waHref && (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            title="Conversar com este revendedor no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {(!prof.is_master && prof.email?.toLowerCase() !== 'jrmacbrandt@gmail.com') && (
                          <button
                            type="button"
                            onClick={() => handleExcluirPerfil(prof.id, prof.nome)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title={`Excluir cadastro de ${prof.nome}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grade de Informações Cadastrais, Endereço e Desempenho do Revendedor */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {/* Bloco 1: Endereço de Entrega Cadastrado */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                          <span>Endereço & Entrega no Perfil:</span>
                          <span className="text-blue-700 font-semibold">
                            Envio via Postagem
                          </span>
                        </div>
                        {hasAddress ? (
                          <p className="text-slate-700 leading-relaxed">
                            {prof.logradouro || 'Logradouro não informado'}, {prof.numero || 'S/N'}
                            {prof.complemento ? ` (${prof.complemento})` : ''} — {prof.bairro || 'Bairro'}
                            <br />
                            <strong className="text-slate-900">{prof.cidade || 'Cidade'}/{prof.estado || 'UF'}</strong> · CEP: <span className="font-mono">{prof.cep || 'N/D'}</span>
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">
                            Nenhum endereço completo preenchido ainda. Clique em &quot;Editar Cadastro Completo&quot; para preencher.
                          </p>
                        )}
                      </div>

                      {/* Bloco 2: Condição Comercial & Preço Unitário */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-[11px] space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Condição Comercial Aplicada:
                        </span>
                        <strong className="text-blue-700 block text-xs">
                          {prof.faixas_preco_individual && prof.faixas_preco_individual.length > 0
                            ? `★ Tabela Exclusiva (${prof.faixas_preco_individual.length} faixas)`
                            : prof.preco_individual
                              ? `★ Preço Fixo Especial: R$ ${prof.preco_individual.toFixed(2)}/placa`
                              : 'Tabela Padrão do Sistema (R$ 21,90 / R$ 19,90 / R$ 17,90)'}
                        </strong>
                        {prof.faixas_preco_individual && prof.faixas_preco_individual.length > 0 && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            {prof.faixas_preco_individual
                              .map((f) => `${f.quantidade_minima}${f.quantidade_maxima ? `–${f.quantidade_maxima}` : '+'} un: R$ ${Number(f.preco_unitario).toFixed(2)}`)
                              .join(' | ')}
                          </p>
                        )}
                      </div>

                      {/* Bloco 3: Histórico de Compras e Placas do Revendedor */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 text-[11px] grid grid-cols-3 gap-2 items-center text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pedidos</span>
                          <strong className="text-sm font-bold text-slate-900">{resellerOrders.length}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Placas (Ativas)</span>
                          <strong className="text-sm font-bold text-emerald-700">
                            {resellerPlates.length} <span className="text-[10px] font-normal text-slate-500">({activeResellerPlates.length})</span>
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Volume R$</span>
                          <strong className="text-xs font-bold text-blue-700">R$ {totalSpent.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredResellers.length === 0 && (
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Nenhum revendedor encontrado para o filtro selecionado.</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* ABA 5: PREÇOS & REGRAS (Prompt Mestre v5.0) */}
      {/* ========================================================================= */}
      {activeTab === 'precos_config' && (
        <div className="space-y-5 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tabela de Preços & Regras Comerciais</h3>
            <p className="text-xs text-slate-500">
              Configuração aprovada na decisão técnica (R$ 21,90 / R$ 19,90 / R$ 17,90).
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Faixas de Preço por Volume
            </h4>

            <div className="space-y-2.5">
              {(pricingTiers.length > 0 ? pricingTiers : DEFAULT_PRICING_TIERS).map((tier, index) => (
                <div
                  key={tier.id || index}
                  className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-700">
                    Faixa {index + 1}: {tier.quantidade_minima} {tier.quantidade_maxima ? `a ${tier.quantidade_maxima}` : '+'} unidades
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={tier.preco_unitario}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPricingTiers((prev) => {
                          const base = prev.length > 0 ? prev : DEFAULT_PRICING_TIERS;
                          return base.map((t, idx) => ((t.id === tier.id || idx === index) ? { ...t, preco_unitario: val } : t));
                        });
                      }}
                      className="w-24 p-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-right"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPricingTiers(DEFAULT_PRICING_TIERS)}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Restaurar Padrão Oficial (ADR 002)
              </button>
              <button
                onClick={handleSalvarFaixasPreco}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
              >
                Salvar Faixas de Preço
              </button>
            </div>
          </div>

          {/* CARD DE INTEGRAÇÃO SUPABASE & POSTGRESQL EM NUVEM */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Banco de Dados em Nuvem & Storage (Supabase)
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        supabaseStatus?.configurado
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {supabaseStatus?.configurado ? '✓ Conectado em Nuvem' : 'Pronto para Ativar'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Infraestrutura PostgreSQL gerenciada com backups diários e armazenamento de comprovantes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition"
                >
                  Ver Instruções & SQL
                </button>
                <button
                  type="button"
                  disabled={supabaseLoading}
                  onClick={handleTestSupabase}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {supabaseLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  <span>Testar Conexão</span>
                </button>
                {supabaseStatus?.configurado && (
                  <button
                    type="button"
                    disabled={supabaseLoading}
                    onClick={handleSyncSupabase}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Sincronizar SQLite → Supabase</span>
                  </button>
                )}
              </div>
            </div>

            {/* Caixa Informativa sobre Região e Latência */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-emerald-600" />
                  Região Recomendada no Supabase:
                </span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  sa-east-1 (São Paulo, Brasil)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                A região de São Paulo assegura que os redirecionamentos de QR Code dinâmicos (<code className="font-mono text-blue-600">/r/:token</code>) respondam em menos de 100ms para todos os clientes em território nacional.
              </p>

              {supabaseStatus?.estatisticas_locais && (
                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Perfis Locais:</span>
                    <strong className="text-slate-800">{supabaseStatus.estatisticas_locais.perfis} registros</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pedidos Criados:</span>
                    <strong className="text-slate-800">{supabaseStatus.estatisticas_locais.pedidos} pedidos</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Placas Fabricadas:</span>
                    <strong className="text-slate-800">{supabaseStatus.estatisticas_locais.placas} placas</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Sincronizável:</span>
                    <strong className="text-emerald-700">{supabaseStatus.estatisticas_locais.total} registros</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSTRUÇÕES SUPABASE */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Passo a Passo de Conexão com o Supabase</h4>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong className="text-slate-900 block">Crie seu Projeto no Supabase:</strong>
                  Acesse <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">supabase.com</a> e crie um projeto gratuito selecionando a região <strong>South America (São Paulo - sa-east-1)</strong>.
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong className="text-slate-900 block">Execute o Script de Tabelas:</strong>
                  No painel do Supabase, clique em <strong>SQL Editor</strong>, copie e cole o conteúdo do arquivo <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">supabase-schema.sql</code> já gerado na raiz do projeto e clique em <em>Run</em>.
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong className="text-slate-900 block">Preencha as Chaves no arquivo .env:</strong>
                  Vá em <em>Project Settings → API</em> e copie a <strong>URL</strong> e a <strong>anon key</strong> ou <strong>service_role key</strong>:
                  <pre className="mt-1.5 p-2.5 bg-slate-900 text-cyan-300 rounded-lg text-[10px] font-mono overflow-x-auto">
{`SUPABASE_URL=https://seuid.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-semibold text-xs rounded-xl shadow-xs transition"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA: BACKUP & RESTAURAÇÃO (ADR 012 - Download Único, Google Drive e Agendamento) */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Cabeçalho da Aba */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-emerald-300 border border-slate-700">
                  SEGURANÇA & INTEGRIDADE
                </span>
                <span className="text-[10px] font-semibold text-slate-500">
                  Google Drive · Nuvem · Computador Local · Agendamento
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Backup & Restauração do Sistema</h3>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Exporte todo o banco de dados em um único arquivo diário com data e horário no nome, salve automaticamente no seu Google Drive com 1 clique ou restaure todo o estado a qualquer momento.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadInstantBackup}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                title="Gera e faz o download imediato de um arquivo único completo com data e horário no nome"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Backup no Computador</span>
              </button>

              {driveSession.isConnected && (
                <button
                  type="button"
                  disabled={uploadingToDrive}
                  onClick={handleUploadBackupToDriveNow}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Gera o backup agora e envia para a sua pasta selecionada no Google Drive"
                >
                  {uploadingToDrive ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  <span>{uploadingToDrive ? 'Enviando ao Drive...' : 'Salvar no Google Drive'}</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD GOOGLE DRIVE (LOGIN DE 1 CLIQUE, ESCOLHA DE CONTA E PASTAS) */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-br from-white to-blue-50/40 rounded-2xl p-5 border border-blue-100/80 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-blue-100/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-blue-100 flex items-center justify-center shrink-0">
                  <GoogleDriveIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">Integração Direta com Google Drive</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        driveSession.isConnected
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {driveSession.isConnected ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Conectado</span>
                        </>
                      ) : (
                        <span>Não Conectado</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Login de 1 clique permanente (OAuth2 Offline). O token nunca expira e os backups agendados são enviados automaticamente 24h por dia.
                  </p>
                </div>
              </div>

              {/* Botão de Ação de Conexão / Troca de Conta */}
              <div className="flex items-center gap-2">
                {!driveSession.isConnected ? (
                  <button
                    type="button"
                    disabled={driveLoading}
                    onClick={handleConnectGoogleDriveVitalicio}
                    className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition hover:shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {driveLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <GoogleIcon className="w-4 h-4 shrink-0" />
                    )}
                    <span>{driveLoading ? 'Conectando...' : 'Conectar ao Google Drive Vitalício (Nuvem 24/7)'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      ⚡ Token Vitalício Ativo
                    </span>
                    <button
                      type="button"
                      disabled={driveLoading}
                      onClick={handleConnectGoogleDriveVitalicio}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                      title="Escolher outra conta Google da lista"
                    >
                      <GoogleIcon className="w-3.5 h-3.5" />
                      <span>Trocar Conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectGoogleDrive}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition cursor-pointer"
                    >
                      Desconectar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Conteúdo do Google Drive quando conectado */}
            {driveSession.isConnected ? (
              <div className="space-y-4 text-xs">
                {/* Linha com dados da conta conectada */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/80 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2.5">
                    {driveSession.user?.photoURL ? (
                      <img
                        src={driveSession.user.photoURL}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-blue-200 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                        {driveSession.user?.name?.[0] || driveSession.user?.email?.[0] || 'G'}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-900 block leading-tight">
                        {driveSession.user?.name || 'Conta Google'}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {driveSession.user?.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingToDrive}
                      onClick={handleUploadBackupToDriveNow}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {uploadingToDrive ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-3.5 h-3.5" />
                          <span>Fazer Backup Manual e Enviar para o Drive Agora</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Seleção e Criação de Pasta no Google Drive */}
                <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-amber-500" />
                        <span>Pasta de Destino dos Backups no Google Drive</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Todos os backups enviados para o Google Drive serão armazenados dentro desta pasta.
                      </p>
                    </div>

                    {!isCreatingFolder && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(true)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                        <span>+ Nova Pasta</span>
                      </button>
                    )}
                  </div>

                  {/* Formulário Inline para Criar Nova Pasta na Hora */}
                  {isCreatingFolder ? (
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 animate-fadeIn">
                      <span className="text-[11px] font-bold text-amber-900 block">
                        Criar Nova Pasta no Google Drive:
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newFolderNameInput}
                          onChange={(e) => setNewFolderNameInput(e.target.value)}
                          placeholder="Nome da pasta (ex: Atelier das Placas - Backups)"
                          className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          disabled={driveLoading || !newFolderNameInput.trim()}
                          onClick={handleCreateFolderInDrive}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                        >
                          {driveLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span>Criar e Selecionar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingFolder(false);
                            setNewFolderNameInput('');
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <select
                        value={backupConfig.drive_folder_id || ''}
                        disabled={driveLoading}
                        onChange={(e) => handleSelectDriveFolder(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="">-- Selecione uma pasta existente --</option>
                        {backupConfig.drive_folder_id && !driveFolders.some((f) => f.id === backupConfig.drive_folder_id) && (
                          <option value={backupConfig.drive_folder_id}>
                            📁 {backupConfig.drive_folder_name || 'Atelier das Placas - Backups'}
                          </option>
                        )}
                        {driveFolders.map((f) => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name}
                          </option>
                        ))}
                      </select>

                      {backupConfig.drive_folder_id && (
                        <a
                          href={`https://drive.google.com/drive/folders/${backupConfig.drive_folder_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          <span>Abrir no Drive</span>
                        </a>
                      )}
                    </div>
                  )}

                  {backupConfig.drive_folder_id && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                      <FolderCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Pasta ativa configurada:{' '}
                        <strong>"{backupConfig.drive_folder_name || 'Pasta Selecionada'}"</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Sub-tabela: Backups Salvos nesta Pasta do Google Drive */}
                <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-600" />
                      <h5 className="font-bold text-slate-900 text-xs">
                        Backups Armazenados no Google Drive (Nesta Pasta)
                      </h5>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {driveBackupsList.length} arquivos
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={driveLoading || !driveSession.token}
                      onClick={() =>
                        driveSession.token && loadDriveData(driveSession.token, backupConfig.drive_folder_id)
                      }
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${driveLoading ? 'animate-spin' : ''}`} />
                      <span>Atualizar Lista do Drive</span>
                    </button>
                  </div>

                  {driveBackupsList.length > 0 ? (
                    <div className="divide-y divide-slate-100 overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead>
                          <tr className="text-[10px] uppercase font-bold text-slate-400 pb-2">
                            <th className="py-2">Nome do Arquivo (Data e Horário)</th>
                            <th className="py-2">Tamanho</th>
                            <th className="py-2">Criado em</th>
                            <th className="py-2 text-right">Ações Rápidas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {driveBackupsList.map((file) => (
                            <tr key={file.id} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 font-mono font-medium text-slate-900 max-w-xs truncate" title={file.name}>
                                {file.name}
                              </td>
                              <td className="py-2.5 text-slate-500">
                                {file.size ? `${(parseInt(file.size, 10) / 1024).toFixed(1)} KB` : '—'}
                              </td>
                              <td className="py-2.5 text-slate-500">
                                {file.createdTime
                                  ? new Date(file.createdTime).toLocaleString('pt-BR')
                                  : '—'}
                              </td>
                              <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition"
                                    title="Visualizar no Google Drive"
                                  >
                                    <ExternalLink className="w-3 h-3 text-slate-500" />
                                    <span>Ver</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRestoreFromDriveFile(file)}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition cursor-pointer"
                                  title="Restaurar toda a aplicação com este arquivo do Google Drive"
                                >
                                  <RotateCcw className="w-3 h-3 text-blue-600" />
                                  <span>Restaurar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteDriveBackupFile(file.id, file.name)}
                                  className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition inline-flex items-center cursor-pointer"
                                  title="Excluir arquivo do Google Drive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      {backupConfig.drive_folder_id
                        ? 'Nenhum backup encontrado nesta pasta do Google Drive ainda. Clique em "Fazer Backup Manual e Enviar para o Drive Agora" acima.'
                        : 'Selecione ou crie uma pasta acima para gerenciar os arquivos de backup no Google Drive.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/70 rounded-xl border border-slate-200/80 text-xs space-y-2">
                <p className="text-slate-600 leading-relaxed">
                  Conecte sua conta Google com 1 clique para salvar seus backups em nuvem, escolher uma pasta ou criar novas pastas dinamicamente e restaurar seus dados a qualquer momento diretamente pela web.
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Permite escolher qualquer conta Google na lista
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Criação de pastas dedicadas na hora
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Reciclagem automática dos backups mais antigos
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Grid Superior: Backup Manual & Restauração no Computador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Backup Manual */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Download de Arquivo Único (Computador)</h4>
                    <span className="text-[11px] text-slate-400">Contém todas as 12 tabelas relacionais</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Baixe um arquivo consolidado com <strong>data e horário exatos no nome</strong> contendo todos os pedidos, placas, clientes, revendedores, rastreamento dos Correios e logs de auditoria.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadInstantBackup}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Arquivo no Computador (.json)</span>
                </button>
                <button
                  type="button"
                  disabled={backupLoading}
                  onClick={handleCreateServerBackup}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  title="Salva uma cópia no disco do servidor para o histórico"
                >
                  {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-slate-500" />}
                  <span>Salvar Cópia no Servidor</span>
                </button>
              </div>
            </div>

            {/* Card 2: Restauração via Upload */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Restaurar a partir de Arquivo Baixado</h4>
                    <span className="text-[11px] text-slate-400">Volta o sistema para o estado do backup</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Selecione o arquivo de backup que você baixou anteriormente no seu computador. O sistema validará a integridade (hash SHA-256) e exibirá um resumo antes de confirmar a substituição.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Selecionar Arquivo de Backup do Computador</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleSelectFileToRestore}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* Card 3: Configuração de Backups Automáticos Agendados */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Agendamento de Backups Automáticos</h4>
                  <p className="text-xs text-slate-500">Defina o destino (computador ou Google Drive), os horários diários e a retenção máxima.</p>
                </div>
              </div>

              {/* Toggle Ativar/Desativar */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-2">
                  <span>{backupConfig.enabled ? 'Agendador Ativo' : 'Agendador Desativado'}</span>
                  <input
                    type="checkbox"
                    checked={backupConfig.enabled}
                    onChange={(e) => setBackupConfig({ ...backupConfig, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* SELETOR DE DESTINO DOS BACKUPS AUTOMÁTICOS */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div>
                <label className="font-bold text-slate-900 text-xs block">
                  Destino dos Backups Automáticos:
                </label>
                <p className="text-[11px] text-slate-500">
                  Escolha se os backups periódicos devem ser guardados no servidor/computador, no Google Drive ou em ambos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Opção 1: Computador / Servidor */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    backupConfig.destino_automatico === 'local'
                      ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-slate-700" />
                      <strong className="text-xs text-slate-900">Computador / Servidor</strong>
                    </div>
                    <input
                      type="radio"
                      name="destino_automatico"
                      value="local"
                      checked={backupConfig.destino_automatico === 'local'}
                      onChange={() => handleUpdateDestinoAutomatico('local')}
                      className="text-blue-600 focus:ring-0 cursor-pointer mt-0.5"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Salva no disco local para download direto no seu computador pelo histórico.
                  </p>
                </label>

                {/* Opção 2: Google Drive */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    backupConfig.destino_automatico === 'google_drive'
                      ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-600" />
                      <strong className="text-xs text-slate-900">Google Drive</strong>
                    </div>
                    <input
                      type="radio"
                      name="destino_automatico"
                      value="google_drive"
                      checked={backupConfig.destino_automatico === 'google_drive'}
                      onChange={() => handleUpdateDestinoAutomatico('google_drive')}
                      className="text-blue-600 focus:ring-0 cursor-pointer mt-0.5"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Envia diretamente para a pasta selecionada no seu Google Drive na nuvem.
                  </p>
                  {backupConfig.drive_folder_name && (
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded mt-2 truncate">
                      📁 {backupConfig.drive_folder_name}
                    </span>
                  )}
                </label>

                {/* Opção 3: Ambos */}
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    backupConfig.destino_automatico === 'ambos'
                      ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      <strong className="text-xs text-slate-900">Ambos (Máxima Redundância)</strong>
                    </div>
                    <input
                      type="radio"
                      name="destino_automatico"
                      value="ambos"
                      checked={backupConfig.destino_automatico === 'ambos'}
                      onChange={() => handleUpdateDestinoAutomatico('ambos')}
                      className="text-blue-600 focus:ring-0 cursor-pointer mt-0.5"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Garante uma cópia local no servidor e sincroniza outra no Google Drive.
                  </p>
                </label>
              </div>

              {(backupConfig.destino_automatico === 'google_drive' || backupConfig.destino_automatico === 'ambos') &&
                !driveSession.isConnected && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-center justify-between">
                    <span>
                      ⚠️ <strong>Atenção:</strong> Você selecionou o Google Drive como destino, mas ainda não conectou sua conta.
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectGoogleDrive}
                      className="font-bold underline text-blue-700 hover:text-blue-900 cursor-pointer"
                    >
                      Conectar Agora
                    </button>
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Horários Programados */}
              <div className="space-y-3">
                <label className="font-bold text-slate-800 block">Horários de Execução Diária:</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {backupConfig.horarios.map((horario) => (
                    <span
                      key={horario}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
                    >
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span>{horario}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHorario(horario)}
                        className="text-indigo-400 hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        title="Remover horário"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {backupConfig.horarios.length === 0 && (
                    <span className="text-slate-400 italic text-[11px]">Nenhum horário cadastrado.</span>
                  )}
                </div>

                {/* Adicionar Novo Horário */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="time"
                    value={newHorarioInput}
                    onChange={(e) => setNewHorarioInput(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddHorario}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                  >
                    + Adicionar Horário
                  </button>
                </div>

                {/* Presets Rápidos */}
                <div className="flex flex-wrap gap-1 pt-1 text-[11px] text-slate-500">
                  <span className="text-[10px] text-slate-400 mr-1 self-center">Sugestões:</span>
                  <button
                    type="button"
                    onClick={() => setBackupConfig({ ...backupConfig, horarios: ['23:00'] })}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition cursor-pointer"
                  >
                    1x ao dia (23:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupConfig({ ...backupConfig, horarios: ['12:00', '23:00'] })}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition cursor-pointer"
                  >
                    2x ao dia (12h e 23h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupConfig({ ...backupConfig, horarios: ['08:00', '14:00', '22:00'] })}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition cursor-pointer"
                  >
                    3x ao dia (08h, 14h e 22h)
                  </button>
                </div>
              </div>

              {/* Quantidade Máxima de Arquivos Retidos */}
              <div className="space-y-3">
                <label className="font-bold text-slate-800 block">Quantidade Máxima de Arquivos Retidos:</label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Quando o número de backups ultrapassar este limite, os arquivos mais antigos serão reciclados automaticamente para não sobrecarregar seu armazenamento (tanto no servidor quanto na pasta do Google Drive).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={backupConfig.max_arquivos}
                    onChange={(e) => setBackupConfig({ ...backupConfig, max_arquivos: parseInt(e.target.value) || 10 })}
                    className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                  />
                  <span className="text-xs text-slate-600">arquivos mantidos</span>
                </div>

                {backupConfig.ultimo_backup && (
                  <div className="text-[11px] text-slate-500 pt-1">
                    Último backup automático gerado em:{' '}
                    <strong className="text-slate-800">
                      {new Date(backupConfig.ultimo_backup).toLocaleString('pt-BR')}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                disabled={backupLoading}
                onClick={handleSaveBackupConfig}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {backupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Salvar Configurações de Agendamento</span>
              </button>
            </div>
          </div>

          {/* Card 4: Histórico de Arquivos no Servidor */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="text-sm font-bold text-slate-900">Histórico de Backups Salvos no Servidor Local</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {backupList.length} arquivos
                </span>
              </div>

              <button
                type="button"
                onClick={loadBackupData}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Atualizar Lista</span>
              </button>
            </div>

            {backupList.length > 0 ? (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="text-[10px] uppercase font-bold text-slate-400 pb-2">
                      <th className="py-2">Nome do Arquivo (Data e Horário)</th>
                      <th className="py-2">Tamanho</th>
                      <th className="py-2">Origem</th>
                      <th className="py-2">Registros</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {backupList.map((item) => (
                      <tr key={item.filename} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 font-mono font-medium text-slate-900 max-w-xs truncate" title={item.filename}>
                          {item.filename}
                        </td>
                        <td className="py-2.5 text-slate-500">{item.size_formatted}</td>
                        <td className="py-2.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.origem === 'automatico'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.origem === 'automatico' ? 'Automático' : 'Manual'}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {item.estatisticas?.total_registros || '—'} itens
                        </td>
                        <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Download */}
                          <a
                            href={`/api/backup/download/${item.filename}`}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition"
                            title="Fazer download deste arquivo"
                          >
                            <Download className="w-3 h-3 text-slate-600" />
                            <span>Baixar</span>
                          </a>

                          {/* Restaurar */}
                          <button
                            type="button"
                            onClick={() =>
                              setRestoreModalData({
                                filename: item.filename,
                                payload: {
                                  metadados: {
                                    data_formatada: item.formatted_date,
                                    estatisticas: item.estatisticas,
                                  },
                                },
                                origem: 'servidor',
                              })
                            }
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs inline-flex items-center gap-1 transition cursor-pointer"
                            title="Restaurar banco para este backup"
                          >
                            <RotateCcw className="w-3 h-3 text-blue-600" />
                            <span>Restaurar</span>
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(item.filename)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition inline-flex items-center cursor-pointer"
                            title="Excluir arquivo do servidor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum backup armazenado no servidor ainda. Clique em "Baixar Backup Completo Agora" ou aguarde o agendamento automático.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA: CONFIGURAÇÕES DE INTEGRAÇÕES */}
      {activeTab === 'configuracoes' && (
        <IntegrationsConfigPanel onFeedback={(msg) => setFeedbackMessage({ type: 'success', text: msg })} />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE RESTAURAÇÃO */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">Confirmar Restauração do Banco</h4>
                <span className="text-[11px] text-slate-500">Operação sensível e irreversível</span>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                Você está prestes a restaurar o banco de dados a partir do arquivo:
                <br />
                <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded block mt-1 truncate">
                  {restoreModalData.filename}
                </code>
              </p>

              {restoreModalData.payload?.metadados && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data do Backup:</span>
                    <strong className="text-slate-800">{restoreModalData.payload.metadados.data_formatada || '—'}</strong>
                  </div>
                  {restoreModalData.payload.metadados.estatisticas && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total de Registros:</span>
                      <strong className="text-blue-700">{restoreModalData.payload.metadados.estatisticas.total_registros || '—'} itens</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Todos os dados atuais do sistema serão substituídos pelo conteúdo deste arquivo de backup. Certifique-se de que é realmente este o estado que deseja recuperar.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setRestoreModalData(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{isRestoring ? 'Restaurando...' : 'Sim, Restaurar Tudo Agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUÇÃO */}
      {producingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Registrar Produção de Placas</h4>
            <p className="text-xs text-slate-500">
              Ao confirmar, os números de série e QR Codes dinâmicos são provisionados.
            </p>
            <div>
              <label className="text-[11px] font-semibold text-slate-600">Quantidade a usinar:</label>
              <input
                type="number"
                min="1"
                value={productionQty}
                onChange={(e) => setProductionQty(parseInt(e.target.value) || 1)}
                className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setProducingOrder(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecutarProducao}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
              >
                Confirmar Usinagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSERIR RASTREIO */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Código de Rastreamento</h4>
            <input
              type="text"
              placeholder="Ex: NL123456789BR"
              value={trackingCodeInput}
              onChange={(e) => setTrackingCodeInput(e.target.value.toUpperCase())}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono uppercase"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTrackingModalOrder(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleAtualizarRastreio}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
              >
                Salvar Rastreamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OCR GEMINI 2.5 */}
      {ocrModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h4 className="font-bold text-slate-900 text-sm">OCR de Comprovante de Postagem</h4>
            </div>
            <p className="text-xs text-slate-500">
              Faça upload do comprovante emitido pelos Correios para leitura automática do rastreio e valor via Gemini.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessarComprovanteOcr(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700"
            />

            {ocrLoading && (
              <div className="p-3 bg-purple-50 text-purple-900 rounded-xl text-xs flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                <span>Analisando comprovante com IA multimodal...</span>
              </div>
            )}

            {ocrResult && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div>
                  <strong>Código Lido:</strong>{' '}
                  <span className="font-mono text-purple-700 font-bold">
                    {ocrResult.codigo_rastreamento || 'Não identificado'}
                  </span>
                </div>
                <div>
                  <strong>Data:</strong> {ocrResult.data_postagem || 'N/D'}
                </div>
                <div>
                  <strong>Valor do Frete:</strong> R$ {ocrResult.valor_pago || '0,00'}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setOcrModalOrder(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREÇO INDIVIDUAL */}
      {editingPriceProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h4 className="font-bold text-slate-900 text-sm">
              Faixas de Preço: {editingPriceProfile.nome}
            </h4>
            <p className="text-xs text-slate-500">
              Defina o preço unitário deste parceiro conforme a quantidade de placas por pedido.
            </p>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={individualUseCustom}
                onChange={(e) => setIndividualUseCustom(e.target.checked)}
              />
              Usar faixas personalizadas (desmarcado = tabela padrão do sistema)
            </label>

            {individualUseCustom && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-bold text-slate-500 uppercase">
                  <span>De (qtd)</span>
                  <span>Até (vazio = ∞)</span>
                  <span>Preço (R$)</span>
                  <span />
                </div>
                {individualTierRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      value={row.min}
                      onChange={(e) =>
                        setIndividualTierRows((prev) => prev.map((r, i) => (i === idx ? { ...r, min: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="∞"
                      value={row.max}
                      onChange={(e) =>
                        setIndividualTierRows((prev) => prev.map((r, i) => (i === idx ? { ...r, max: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.preco}
                      onChange={(e) =>
                        setIndividualTierRows((prev) => prev.map((r, i) => (i === idx ? { ...r, preco: e.target.value } : r)))
                      }
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setIndividualTierRows((prev) => prev.filter((_, i) => i !== idx))}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                      aria-label="Remover faixa"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setIndividualTierRows((prev) => {
                      const last = prev[prev.length - 1];
                      const nextMin = last && last.max !== '' ? String(parseInt(last.max, 10) + 1) : '1';
                      return [...prev, { min: nextMin, max: '', preco: last?.preco || '21.90' }];
                    })
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  + Adicionar faixa
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPriceProfile(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarPrecoIndividual}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
              >
                Salvar Faixas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERAÇÃO E DOWNLOAD DE QR CODES (Item 1 do Menu da Gestão) */}
      {qrModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            {/* Cabeçalho do Modal */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      QR Codes do Pedido #{qrModalOrder.numero_pedido}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {qrModalPlates.length} de {qrModalOrder.quantidade_total} placas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Revendedor: <strong>{qrModalOrder.revendedor_nome || 'Revendedor'}</strong> · Cada QR Code possui um número sequencial único e nunca repetido.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQrModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition shrink-0"
              >
                ×
              </button>
            </div>

            {/* Ações Globais do Modal (Baixar Todos) */}
            <div className="px-5 py-3 bg-blue-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-blue-900 font-medium">
                Arquivos salvos com o formato: <strong className="font-mono">QRCode_[NÚMERO].png</strong>
              </span>

              {qrModalPlates.length > 0 && (
                <button
                  onClick={downloadAllQrCodes}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition cursor-pointer"
                  title="Baixa automaticamente todos os arquivos individualmente nomeados com o número de cada QR code"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Todos os {qrModalPlates.length} QR Codes (.PNG)</span>
                </button>
              )}
            </div>

            {/* Conteúdo com Grid dos QR Codes */}
            <div className="p-5 overflow-y-auto flex-1">
              {qrModalLoading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Gerando identificadores sequenciais únicos e renderizando QR Codes...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Garantindo unicidade estrita conforme Adendo Operacional e Prompt Mestre v5.0
                  </p>
                </div>
              ) : qrModalPlates.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhum QR code disponível para este pedido.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {qrModalPlates.map((plate, index) => (
                    <div
                      key={plate.id || index}
                      className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center text-center space-y-3 hover:shadow-sm hover:border-blue-300 transition"
                    >
                      {/* Código Sequencial em Destaque */}
                      <div className="w-full flex items-center justify-between pb-1 border-b border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400">Placa #{index + 1}</span>
                        <span className="font-mono text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                          {plate.codigo_sequencial}
                        </span>
                      </div>

                      {/* Imagem do QR Code Renderizada */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                        <img
                          src={plate.qrcode_data_url || plate.qrcode_url}
                          alt={`QR Code ${plate.codigo_sequencial}`}
                          className="w-36 h-36 object-contain"
                          onError={async (e) => {
                            const target = e.currentTarget;
                            if (plate.qrcode_data_url && target.src !== plate.qrcode_data_url) {
                              target.src = plate.qrcode_data_url;
                            } else if (plate.url_permanente) {
                              target.src = await generateLabeledQrDataUrlInBrowser(plate.url_permanente, plate.codigo_sequencial);
                            }
                          }}
                        />
                      </div>

                      {/* URL Criptografada Permanente */}
                      <div className="w-full">
                        <span className="text-[10px] text-slate-400 block">Link Permanente:</span>
                        <span className="font-mono text-[10px] text-slate-700 block truncate" title={plate.url_permanente}>
                          {plate.url_permanente?.replace(/^https?:\/\/[^/]+/, '') || `/r/${plate.token_publico}`}
                        </span>
                      </div>

                      {/* Status Digital + Destino no Modal de QR Codes */}
                      <div className="w-full text-left bg-white p-2 rounded-xl border border-slate-200/80 text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-semibold uppercase">Status Cliente:</span>
                          <span className={`font-bold ${plate.status_digital === 'ativa' && plate.url_destino ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {plate.status_digital === 'ativa' && plate.url_destino ? '● Ativa' : '○ Aguardando Ativação'}
                          </span>
                        </div>
                        {plate.nome_estabelecimento && (
                          <div className="truncate text-slate-700 font-medium">{plate.nome_estabelecimento}</div>
                        )}
                        {plate.url_destino && (
                          <div className="truncate text-blue-600 font-mono" title={plate.url_destino}>{plate.url_destino}</div>
                        )}
                      </div>

                      {/* Botões de Download e Edição Rápida do Link */}
                      <div className="w-full flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenAdminPlateEditor({ ...plate, revendedor_nome: qrModalOrder?.revendedor_nome, numero_pedido: qrModalOrder?.numero_pedido })}
                          className="w-full py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{plate.url_destino ? 'Editar Link de Destino' : 'Configurar / Ativar Link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSingleQrCode(plate)}
                          className="w-full py-2 bg-white hover:bg-emerald-600 hover:text-white text-slate-700 border border-slate-300 hover:border-emerald-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                          title={`Baixar QRCode_${plate.codigo_sequencial}.png`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar {plate.codigo_sequencial}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
              <span className="text-[11px] text-slate-500">
                Cada QR Code aponta para uma URL definitiva <strong className="font-mono">/r/[token]</strong> com redirecionamento dinâmico.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQrModalOrder(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Fechar
                </button>

                {qrModalOrder.status !== 'em_producao' && qrModalOrder.status !== 'concluido' && (
                  <button
                    onClick={() => {
                      const id = qrModalOrder.id;
                      setQrModalOrder(null);
                      handleIniciarProducao(id);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Produção Deste Pedido</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRAR NOVO VENDEDOR INTERNO */}
      {isNewInternalSellerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-cyan-300 flex items-center justify-center">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Cadastrar Vendedor Interno</h4>
                  <p className="text-[11px] text-slate-500">Membro da equipe comercial do Atelier das Placas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewInternalSellerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-cyan-50/80 border border-cyan-200/80 rounded-2xl text-[11px] text-cyan-900 space-y-1">
              <strong>Regra Operacional:</strong>
              <p className="text-cyan-800 leading-relaxed">
                Vendedores internos têm modalidade de entrega fixada como <strong>Retirada no Balcão</strong> e seus pedidos não exigem pagamento via Asaas, sendo autorizados diretamente para a produção.
              </p>
            </div>

            <form onSubmit={handleSalvarVendedorInterno} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nome Completo do Vendedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Costa"
                  value={newInternalSellerData.nome}
                  onChange={(e) => setNewInternalSellerData((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="mariana.costa@atelierdasplacas.com.br"
                  value={newInternalSellerData.email}
                  onChange={(e) => setNewInternalSellerData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">WhatsApp / Telefone *</label>
                  <input
                    type="text"
                    required
                    placeholder="(21) 98888-0000"
                    value={newInternalSellerData.telefone}
                    onChange={(e) => setNewInternalSellerData((prev) => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CPF ou Matrícula</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={newInternalSellerData.cpf_cnpj}
                    onChange={(e) => setNewInternalSellerData((prev) => ({ ...prev, cpf_cnpj: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewInternalSellerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInternalSeller}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingInternalSeller ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Cadastrar Vendedor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CRIAR NOVO PEDIDO INTERNO (SEM COBRANÇA / RETIRADA NO BALCÃO) */}
      {isNewInternalOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Novo Pedido Interno</h4>
                  <p className="text-[11px] text-slate-500">Sem cobrança Asaas · Retirada Presencial Balcão</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewInternalOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 space-y-1">
              <strong>Esteira de Produção Integrada:</strong>
              <p className="text-blue-800 leading-relaxed">
                Este pedido nascerá autorizado para fabricação com <strong>R$ 0,00</strong>. Ele entrará em <em>Pedidos Recebidos</em> para você gerar os QR Codes ou atribuir placas de estoque e seguir com o início de produção normalmente.
              </p>
            </div>

            <form onSubmit={handleCriarPedidoInterno} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Selecione o Vendedor Interno *</label>
                <select
                  required
                  value={newInternalOrderData.vendedor_id}
                  onChange={(e) => setNewInternalOrderData((prev) => ({ ...prev, vendedor_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Escolha um vendedor interno --</option>
                  {profilesList
                    .filter((p) => p.tipo_parceiro === 'equipe_interna' && p.role !== 'admin')
                    .map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.nome} ({seller.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantidade de Placas *</label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {[5, 10, 20, 30, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewInternalOrderData((prev) => ({ ...prev, quantidade: preset }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        newInternalOrderData.quantidade === preset
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset} un.
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={newInternalOrderData.quantidade}
                  onChange={(e) => setNewInternalOrderData((prev) => ({ ...prev, quantidade: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Observações Operacionais (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Lote promocional para demonstração presencial em clientes..."
                  value={newInternalOrderData.observacoes}
                  onChange={(e) => setNewInternalOrderData((prev) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-normal focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewInternalOrderModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingInternalOrder}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {creatingInternalOrder ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando Pedido...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Emitir Pedido para Produção</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DEFINITIVA DO PEDIDO */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            {/* Cabeçalho do Diálogo */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-base leading-tight">
                  Excluir Pedido #{deletingOrder.numero_pedido || deletingOrder.id}?
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação é irreversível e apagará totalmente o pedido do banco de dados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Resumo do Pedido a ser Apagado */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-700">
                <span className="text-slate-500">Revendedor / Equipe:</span>
                <strong className="text-slate-900">{deletingOrder.revendedor_nome || 'Revendedor'}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="text-slate-500">Quantidade:</span>
                <strong className="text-slate-900">{deletingOrder.quantidade_total} placas</strong>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span className="text-slate-500">Valor Total:</span>
                <span className="font-semibold text-slate-900">
                  {deletingOrder.valor_total && deletingOrder.valor_total > 0
                    ? `R$ ${deletingOrder.valor_total.toFixed(2)}`
                    : 'Isento (Equipe Interna)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Fase Atual:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                  {deletingOrder.status || 'Esteira de Produção'}
                </span>
              </div>
            </div>

            {/* Opção Inteligente de Aproveitamento das Placas */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2">
              <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider">
                Destino das Placas Físicas:
              </span>
              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="reaproveitarPlacas"
                  checked={reaproveitarPlacasOption === true}
                  onChange={() => setReaproveitarPlacasOption(true)}
                  className="mt-0.5 text-blue-600 focus:ring-0"
                />
                <div className="text-[11px] leading-snug">
                  <strong className="text-slate-900 block font-semibold">
                    Devolver ao Estoque Livre (Recomendado)
                  </strong>
                  <span className="text-slate-500">
                    O pedido é apagado, mas os QR Codes gravados voltam para a aba Estoque para você reaproveitar o acrílico.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 pt-1">
                <input
                  type="radio"
                  name="reaproveitarPlacas"
                  checked={reaproveitarPlacasOption === false}
                  onChange={() => setReaproveitarPlacasOption(false)}
                  className="mt-0.5 text-rose-600 focus:ring-0"
                />
                <div className="text-[11px] leading-snug">
                  <strong className="text-rose-700 block font-semibold">
                    Excluir Placas Definitivamente
                  </strong>
                  <span className="text-slate-500">
                    Apaga todas as placas e QR codes associados a este pedido do sistema.
                  </span>
                </div>
              </label>
            </div>

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                disabled={isDeletingLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarExclusaoPedido}
                disabled={isDeletingLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeletingLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Apagando Pedido...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir Pedido</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA FLUTUANTE DE AÇÕES EM MASSA (Aparece ao selecionar pedidos na aba Todos) */}
      {receivedFilter === 'todos' && selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 border border-slate-700 animate-fadeIn max-w-[95vw]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs sm:text-sm block leading-none">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">
                {receivedOrders
                  .filter((o: Order) => selectedOrderIds.includes(o.id))
                  .reduce((acc: number, o: Order) => acc + (o.quantidade_total || 0), 0)}{' '}
                placas no total
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700 mx-1"></div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkReaproveitarPlacasOption(true);
                setIsBulkDeletingModalOpen(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO COMPLETA DE REVENDEDOR PELO ADMINISTRADOR (CONTROLE TOTAL SINCRONIZADO COM O PERFIL DO REVENDEDOR) */}
      {editingFullProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                  {(editingFullProfile.nome || 'RV').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    Editar Cadastro Completo do Revendedor
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Todas as alterações salvas aqui atualizam automaticamente a aba <strong>Meu Perfil</strong> e o endereço de entrega no Painel do Revendedor.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFullProfile(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFullProfile} className="space-y-4 text-xs">
              {/* Seção 1: Dados Pessoais e de Acesso */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                  1. Identificação, Contato & Status da Conta
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome Completo / Razão Social *</label>
                    <input
                      type="text"
                      required
                      value={editingProfileForm.nome}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, nome: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">E-mail de Acesso *</label>
                    <input
                      type="email"
                      required
                      value={editingProfileForm.email}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={editingProfileForm.telefone}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CPF / CNPJ</label>
                    <input
                      type="text"
                      value={editingProfileForm.cpf_cnpj}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, cpf_cnpj: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Status da Conta</label>
                    <select
                      value={editingProfileForm.ativo ? 'ativo' : 'inativo'}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, ativo: e.target.value === 'ativo' }))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="ativo">● Ativo (Acesso Liberado)</option>
                      <option value="inativo">○ Inativo (Suspenso)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Categoria de Parceiro</label>
                    <select
                      value={editingProfileForm.tipo_parceiro}
                      onChange={(e) => {
                        const nextTipo = e.target.value as any;
                        setEditingProfileForm((prev) => ({
                          ...prev,
                          tipo_parceiro: nextTipo,
                          preferencia_entrega: nextTipo === 'equipe_interna' ? 'retirada' : 'correios',
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="revendedor_independente">Revendedor Independente (Padrão)</option>
                      <option value="parceiro_especial">Parceiro Especial</option>
                      <option value="equipe_interna">Equipe Interna (Sem Cobrança Asaas)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Modalidade de Entrega (Regra por Categoria)</label>
                    <select
                      value={editingProfileForm.tipo_parceiro === 'equipe_interna' ? 'retirada' : 'correios'}
                      disabled
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold cursor-not-allowed"
                    >
                      {editingProfileForm.tipo_parceiro === 'equipe_interna' ? (
                        <option value="retirada">🏢 Retirada Física no Balcão (Exclusivo Equipe Interna)</option>
                      ) : (
                        <option value="correios">🚚 Envio via Postagem / Transportadora (Exclusivo Revendedor)</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Endereço Completo de Entrega (Sincronizado com o Perfil do Revendedor) */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                    2. Endereço Completo de Entrega (Aparece em &quot;Meu Perfil&quot; e na Compra do Revendedor)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">CEP</label>
                    <input
                      type="text"
                      value={editingProfileForm.cep}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, cep: e.target.value }))}
                      placeholder="00000-000"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Endereço (Rua / Avenida)</label>
                    <input
                      type="text"
                      value={editingProfileForm.logradouro}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, logradouro: e.target.value }))}
                      placeholder="Rua, Avenida, Estrada..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Número</label>
                    <input
                      type="text"
                      value={editingProfileForm.numero}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, numero: e.target.value }))}
                      placeholder="123"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={editingProfileForm.complemento}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, complemento: e.target.value }))}
                      placeholder="Apto, Sala, Bloco..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={editingProfileForm.bairro}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, bairro: e.target.value }))}
                      placeholder="Bairro"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={editingProfileForm.cidade}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, cidade: e.target.value }))}
                      placeholder="Cidade"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Estado (UF)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editingProfileForm.estado}
                      onChange={(e) => setEditingProfileForm((prev) => ({ ...prev, estado: e.target.value.toUpperCase() }))}
                      placeholder="SP, RJ, MG..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ações de Rodapé */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFullProfile(null)}
                  disabled={savingFullProfile}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingFullProfile}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {savingFullProfile ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando Alterações...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar e Atualizar Perfil do Revendedor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE NOVO REVENDEDOR PELO PAINEL DE GESTÃO */}
      {isNewResellerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Cadastrar Novo Revendedor</h4>
                  <p className="text-[11px] text-slate-500">Crie uma nova conta de revendedor na plataforma.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewResellerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewReseller} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newResellerForm.nome}
                  onChange={(e) => setNewResellerForm((prev) => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  value={newResellerForm.email}
                  onChange={(e) => setNewResellerForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@revendedor.com.br"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={newResellerForm.telefone}
                    onChange={(e) => setNewResellerForm((prev) => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF / CNPJ</label>
                  <input
                    type="text"
                    value={newResellerForm.cpf_cnpj}
                    onChange={(e) => setNewResellerForm((prev) => ({ ...prev, cpf_cnpj: e.target.value }))}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Modalidade de Entrega (Regra Revendedor)</label>
                <select
                  value="correios"
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold cursor-not-allowed"
                >
                  <option value="correios">🚚 Envio via Postagem / Transportadora (Exclusivo Revendedor)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewResellerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingReseller}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {creatingReseller ? 'Cadastrando...' : 'Criar Revendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL DE EDIÇÃO E ATIVAÇÃO DE PLACA PELO ADMINISTRADOR (SUPORTE AO CLIENTE) */}
      {adminEditingPlate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-base">
                      Configurar Placa {adminEditingPlate.codigo_sequencial}
                    </h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      /r/{adminEditingPlate.token_publico}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {adminEditingPlate.revendedor_nome ? `Revendedor: ${adminEditingPlate.revendedor_nome}` : 'Placa de Estoque'}{' '}
                    {adminEditingPlate.numero_pedido ? `· Pedido #${adminEditingPlate.numero_pedido}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminEditingPlate(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdminPlateEditor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome do Estabelecimento / Cliente Final
                </label>
                <input
                  type="text"
                  value={adminPlateForm.nome_estabelecimento}
                  onChange={(e) => setAdminPlateForm((prev) => ({ ...prev, nome_estabelecimento: e.target.value }))}
                  placeholder="Ex: Restaurante Sabor da Serra, Clínica Sorriso, Loja Centro..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tipo de Destino
                  </label>
                  <select
                    value={adminPlateForm.tipo_destino}
                    onChange={(e) => setAdminPlateForm((prev) => ({ ...prev, tipo_destino: e.target.value as any }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="google_reviews">⭐ Google Avaliações</option>
                    <option value="instagram">📸 Instagram</option>
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="website">🌐 Site / Cardápio Digital</option>
                    <option value="personalizado">🔗 Outro Link Personalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status Digital da Placa
                  </label>
                  <select
                    value={adminPlateForm.status_digital}
                    onChange={(e) => setAdminPlateForm((prev) => ({ ...prev, status_digital: e.target.value as any }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="ativa">● Ativa (Redirecionando)</option>
                    <option value="inativa">○ Aguardando Ativação (Inativa)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL / Link de Destino (Para onde o QR Code e o NFC vão redirecionar)
                </label>
                <input
                  type="text"
                  value={adminPlateForm.url_destino}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAdminPlateForm((prev) => ({
                      ...prev,
                      url_destino: val,
                      status_digital: val.trim() ? 'ativa' : prev.status_digital,
                    }));
                  }}
                  placeholder="https://g.page/r/... ou https://instagram.com/... ou https://wa.me/..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-blue-700 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  A imagem física do QR Code nunca muda! Assim que você salvar, a rota vitalícia <strong className="font-mono">/r/{adminEditingPlate.token_publico}</strong> passará a abrir este link imediatamente.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Responsável no Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={adminPlateForm.contato_nome}
                    onChange={(e) => setAdminPlateForm((prev) => ({ ...prev, contato_nome: e.target.value }))}
                    placeholder="Nome do proprietário/gerente"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    WhatsApp do Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={adminPlateForm.contato_telefone}
                    onChange={(e) => setAdminPlateForm((prev) => ({ ...prev, contato_telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdminEditingPlate(null)}
                  disabled={savingAdminPlate}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAdminPlate}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {savingAdminPlate ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando Destino...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar e Atualizar Placa</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO EM MASSA DE PEDIDOS */}
      {isBulkDeletingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            {/* Cabeçalho do Diálogo */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 text-base leading-tight">
                  Excluir {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Pedido' : 'Pedidos'} Selecionados?
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Esta ação é irreversível e apagará totalmente os pedidos selecionados do banco de dados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeletingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Resumo Consolidado dos Pedidos Selecionados */}
            {(() => {
              const selectedOrders = receivedOrders.filter((o: Order) => selectedOrderIds.includes(o.id));
              const totalPlacas = selectedOrders.reduce((acc: number, o: Order) => acc + (o.quantidade_total || 0), 0);
              const totalValor = selectedOrders.reduce((acc: number, o: Order) => acc + (o.valor_total || 0), 0);

              return (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-2 max-h-48 overflow-y-auto">
                  <div className="flex justify-between items-start text-slate-700 gap-2">
                    <span className="text-slate-500 shrink-0">Pedidos Selecionados:</span>
                    <strong className="text-slate-900 font-mono text-right break-words">
                      {selectedOrders.map((o) => `#${o.numero_pedido}`).join(', ')}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Total de Placas Físicas:</span>
                    <strong className="text-slate-900">{totalPlacas} placas</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-500">Valor Consolidado:</span>
                    <span className="font-semibold text-slate-900">
                      {totalValor > 0 ? `R$ ${totalValor.toFixed(2)}` : 'Isentos (Equipe Interna)'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Opção Inteligente de Aproveitamento das Placas */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2">
              <span className="font-bold text-amber-900 block text-[11px] uppercase tracking-wider">
                Destino das Placas Físicas dos Pedidos:
              </span>
              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="bulkReaproveitarPlacas"
                  checked={bulkReaproveitarPlacasOption === true}
                  onChange={() => setBulkReaproveitarPlacasOption(true)}
                  className="mt-0.5 text-blue-600 focus:ring-0"
                />
                <div className="text-[11px] leading-snug">
                  <strong className="text-slate-900 block font-semibold">
                    Devolver ao Estoque Livre (Recomendado)
                  </strong>
                  <span className="text-slate-500">
                    Os pedidos são apagados, mas os QR Codes gravados voltam para a aba Estoque Livre para você reaproveitar as peças de acrílico.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-slate-700 pt-1">
                <input
                  type="radio"
                  name="bulkReaproveitarPlacas"
                  checked={bulkReaproveitarPlacasOption === false}
                  onChange={() => setBulkReaproveitarPlacasOption(false)}
                  className="mt-0.5 text-rose-600 focus:ring-0"
                />
                <div className="text-[11px] leading-snug">
                  <strong className="text-rose-700 block font-semibold">
                    Excluir Placas Definitivamente
                  </strong>
                  <span className="text-slate-500">
                    Apaga todas as placas e QR codes associados a todos os pedidos selecionados do sistema.
                  </span>
                </div>
              </label>
            </div>

            {/* Ações do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkDeletingModalOpen(false)}
                disabled={isBulkDeletingLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarExclusaoEmMassa}
                disabled={isBulkDeletingLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isBulkDeletingLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Apagando {selectedOrderIds.length} Pedidos...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Pedido' : 'Pedidos'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
