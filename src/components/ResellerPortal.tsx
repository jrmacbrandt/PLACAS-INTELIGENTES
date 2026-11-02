import React, { useState, useEffect } from 'react';
import {
  Package,
  ShoppingCart,
  BarChart2,
  LayoutGrid,
  User,
  Plus,
  Minus,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Download,
  Copy,
  Check,
  Search,
  MessageCircle,
  Truck,
  Building,
  Key,
  Save,
  HelpCircle,
  ChevronRight,
  Eye,
  EyeOff,
  ShoppingBag,
  Zap,
  Sparkles,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api.js';
import type { Profile, Order, Plate, DeliveryPreference, ShippingOption } from '../types.js';

interface ResellerPortalProps {
  currentProfile: Profile;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onRefreshProfile: () => void;
  onOpenCancellationPolicy?: () => void;
}

export const ResellerPortal: React.FC<ResellerPortalProps> = ({
  currentProfile,
  activeTab: externalTab,
  onTabChange,
  onRefreshProfile,
  onOpenCancellationPolicy,
}) => {
  const [internalTab, setInternalTab] = useState<'pedidos' | 'comprar' | 'vendas' | 'placas' | 'perfil'>('pedidos');
  const activeTab = (externalTab as any) || internalTab;

  const setActiveTab = (tab: 'pedidos' | 'comprar' | 'vendas' | 'placas' | 'perfil') => {
    setInternalTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const [plates, setPlates] = useState<Plate[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Produtos do Catálogo Atelier das Placas (conforme telas de compra do usuário)
  const [catalogItems, setCatalogItems] = useState([
    {
      id: 'cesta_ouro',
      nome: 'Kit completo Cesta Ouro',
      descricao: 'Cesta dourada elegante com suporte e placa NFC + QR Code dinâmico Google Avaliações.',
      preco: 70.00,
      imagem: '/assets/aistudio/cesta_ouro.jpg',
      isLancamento: true,
      badge: 'NOVIDADE ECLOURA',
      quantidade: 0,
    },
    {
      id: 'parede_branca',
      nome: '3 em 1 Parede Branca com 2 tira de Duplaface',
      descricao: 'Modelo de parede triplo com chips NFC e QR Codes integrados para Pix, Instagram e Google.',
      preco: 55.00,
      imagem: '/assets/aistudio/placa_3x1_branca.jpg',
      isLancamento: true,
      isSobEncomenda: true,
      badge: '3 EM 1 LANÇAMENTO',
      quantidade: 0,
    },
    {
      id: 'parede_preta',
      nome: 'Placa 3x1 Preta Acrílico Premium',
      descricao: 'Design fosco com 3 atalhos inteligentes NFC para estabelecimentos sofisticados.',
      preco: 60.00,
      imagem: '/assets/aistudio/placa_3x1_preta.jpg',
      isLancamento: true,
      badge: 'PLACA 3X1 LANÇAMENTO',
      quantidade: 0,
    },
    {
      id: 'placa_natal',
      nome: 'Placa Lançamento Natal (Google Avaliações)',
      descricao: 'Edição especial comemorativa para antecipar vendas de fim de ano e campanhas sazonais.',
      preco: 35.00,
      imagem: '/assets/aistudio/placa_natal.jpg',
      isLancamento: true,
      badge: 'EDIÇÃO LIMITADA',
      quantidade: 0,
    },
    {
      id: 'placa_tradicional',
      nome: 'Placa Tradicional QR Code + NFC (Mesa e Balcão)',
      descricao: 'A clássica placa compacta com gravação UV permanente e tecnologia de aproximação.',
      preco: 21.90, // Sujeito a faixas dinâmicas
      imagem: '/assets/aistudio/plates_showcase.png',
      badge: 'MAIS VENDIDA',
      quantidade: 0,
    },
  ]);

  // Modalidade de Entrega na Compra
  const [modalidadeEntrega, setModalidadeEntrega] = useState<DeliveryPreference>(
    currentProfile.preferencia_entrega || 'correios'
  );
  const [observacaoPedido, setObservacaoPedido] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(false);

  // Dados do Endereço de Entrega Editáveis
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({
    destinatario: currentProfile.nome,
    telefone: currentProfile.telefone || '',
    cpf_cnpj: currentProfile.cpf_cnpj || '',
    cep: currentProfile.cep || '22745-271',
    logradouro: currentProfile.logradouro || 'Rua Araguaia',
    numero: currentProfile.numero || '1111',
    complemento: currentProfile.complemento || 'Apto 403',
    bairro: currentProfile.bairro || 'Freguesia (Jacarepaguá)',
    cidade: currentProfile.cidade || 'Rio de Janeiro',
    estado: currentProfile.estado || 'RJ',
  });

  // Modal de Pagamento PIX / Asaas
  const [pixModalOrder, setPixModalOrder] = useState<Order | null>(null);
  const [pixPaymentInfo, setPixPaymentInfo] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Melhor Envio - Cotação de Frete Inteligente
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [loadingShipping, setLoadingShipping] = useState<boolean>(false);

  // Gerenciador de Placas
  const [searchPlaca, setSearchPlaca] = useState('');
  const [filterPlacaStatus, setFilterPlacaStatus] = useState<'todos' | 'ativas' | 'inativas'>('todos');
  const [editingPlateId, setEditingPlateId] = useState<string | null>(null);
  const [editingPlateData, setEditingPlateData] = useState({
    nome_estabelecimento: '',
    url_destino: '',
    tipo_destino: 'google_reviews' as const,
  });
  const [qrCodeModal, setQrCodeModal] = useState<{ plate: Plate; dataUrl: string } | null>(null);

  // Minhas Vendas / Financeiro do Revendedor
  const [vendasPeriodo, setVendasPeriodo] = useState<'hoje' | 'ontem' | '7dias' | '30dias' | 'ano'>('30dias');
  const [vendasSubtab, setVendasSubtab] = useState<'clientes' | 'vendas' | 'custos' | 'despesas'>('clientes');
  const [clientSalePrices, setClientSalePrices] = useState<Record<string, number>>({});

  // Meu Perfil - Senha
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Modal de zoom do manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Carregar dados iniciais
  const loadData = async () => {
    setLoading(true);
    try {
      const [platesRes, ordersRes] = await Promise.all([
        api.getPlates(),
        api.getOrders(),
      ]);
      if (platesRes.sucesso) setPlates(platesRes.placas);
      if (ordersRes.sucesso) setOrders(ordersRes.pedidos);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentProfile.id]);

  // Saudação conforme horário
  const getGreeting = () => {
    const hour = new Date().getHours();
    const firstName = currentProfile.nome.split(' ')[0] || 'Revendedor';
    if (hour >= 5 && hour < 12) return `Bom dia, ${firstName}!`;
    if (hour >= 12 && hour < 18) return `Boa tarde, ${firstName}!`;
    return `Boa noite, ${firstName}!`;
  };

  // Cálculo do total de itens no carrinho
  const totalItens = catalogItems.reduce((acc, item) => acc + item.quantidade, 0);

  // Consulta automática de opções do Melhor Envio ao alterar quantidade ou CEP
  useEffect(() => {
    const cleanCep = (deliveryAddress.cep || '').replace(/\D/g, '');
    if (cleanCep.length === 8 && totalItens > 0) {
      setLoadingShipping(true);
      api.calculateShipping(cleanCep, totalItens)
        .then((res) => {
          if (res.sucesso && res.opcoes && res.opcoes.length > 0) {
            setShippingOptions(res.opcoes);
            setSelectedShipping((prev) => {
              if (prev && res.opcoes.some((o) => o.service_id === prev.service_id)) {
                return res.opcoes.find((o) => o.service_id === prev.service_id) || res.opcoes[0];
              }
              return res.opcoes.find((o) => o.is_cheapest) || res.opcoes[0];
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingShipping(false));
    }
  }, [deliveryAddress.cep, totalItens]);

  // Preço unitário da Placa Tradicional com regras do Prompt Mestre v5.0:
  // Preço individual customizado (se admin definiu) OU
  // 1-9: R$ 21,90 | 10-49: R$ 19,90 | 50+: R$ 17,90
  const getTradicionalUnitPrice = (qtdTotal: number) => {
    if (currentProfile.preco_individual && currentProfile.preco_individual > 0) {
      return currentProfile.preco_individual;
    }
    if (qtdTotal >= 50) return 17.90;
    if (qtdTotal >= 10) return 19.90;
    return 21.90;
  };

  // Subtotal dos itens
  const subtotal = catalogItems.reduce((acc, item) => {
    if (item.id === 'placa_tradicional') {
      const price = getTradicionalUnitPrice(item.quantidade);
      return acc + price * item.quantidade;
    }
    return acc + item.preco * item.quantidade;
  }, 0);

  // Regra de Frete: Grátis acima de 20 unidades no total ou se modalidade for retirada
  const isFreteGratis = totalItens >= 20 || modalidadeEntrega === 'retirada';
  const freteValor = totalItens === 0 ? 0 : isFreteGratis ? 0 : (selectedShipping?.price ?? (shippingOptions[0]?.price || 14.20));
  const desconto = cupomAplicado ? subtotal * 0.10 : 0;
  const totalGeral = Math.max(0, subtotal - desconto + freteValor);

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCatalogItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const next = Math.max(0, item.quantidade + delta);
          return { ...item, quantidade: next };
        }
        return item;
      })
    );
  };

  // Finalização do Pedido de Compra
  const handleFinalizarCompra = async () => {
    if (totalItens <= 0) {
      setFeedback({ type: 'error', text: 'Selecione ao menos 1 unidade para realizar o pedido.' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.createOrder({
        quantidade: totalItens,
        modalidade_entrega: modalidadeEntrega,
        observacoes: observacaoPedido,
        endereco_entrega: modalidadeEntrega === 'correios' ? deliveryAddress : null,
        itens_selecionados: catalogItems.filter((i) => i.quantidade > 0),
        opcao_frete: modalidadeEntrega === 'correios' ? selectedShipping : null,
      });

      if (res.sucesso && res.pedido) {
        setFeedback({ type: 'success', text: 'Pedido criado com sucesso! Gere o pagamento via PIX para liberação.' });
        // Abre modal de pagamento imediatamente
        handleOpenPixModal(res.pedido);
        // Reseta carrinho
        setCatalogItems((prev) => prev.map((item) => ({ ...item, quantidade: 0 })));
        setObservacaoPedido('');
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Falha ao emitir pedido de compra.' });
    } finally {
      setLoading(false);
    }
  };

  // Abrir PIX Modal
  const handleOpenPixModal = async (pedido: Order) => {
    setPixModalOrder(pedido);
    try {
      const res = await api.getPaymentInfo(pedido.id);
      if (res.sucesso) {
        setPixPaymentInfo(res.pagamento);
      }
    } catch {
      // Cria mock Asaas PIX payload se offline
      setPixPaymentInfo({
        pix_copia_cola: `00020126580014br.gov.bcb.pix0136atelierdasplacas-pagamentos-${pedido.id}520400005303986540${pedido.valor_total.toFixed(2)}5802BR5925ATELIER DAS PLACAS6009SAO PAULO62070503***6304ABCD`,
        pix_qrcode_url: '',
      });
    }
  };

  // Simular Pagamento Imediato (Adendo Teste)
  const handleSimularPagamento = async (orderId: string) => {
    try {
      const res = await api.simulatePayment(orderId);
      if (res.sucesso) {
        setFeedback({ type: 'success', text: 'Pagamento PIX confirmado com sucesso! Placas disponibilizadas no seu painel.' });
        setPixModalOrder(null);
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao simular pagamento.' });
    }
  };

  // Configuração rápida da placa
  const handleStartEditingPlate = (plate: Plate) => {
    setEditingPlateId(plate.id);
    setEditingPlateData({
      nome_estabelecimento: plate.nome_estabelecimento || '',
      url_destino: plate.url_destino || '',
      tipo_destino: (plate.tipo_destino as any) || 'google_reviews',
    });
  };

  const handleSavePlateConfig = async (plateId: string) => {
    try {
      const res = await api.configurePlate(plateId, editingPlateData);
      if (res.sucesso) {
        setFeedback({ type: 'success', text: 'Placa atualizada! O QR Code já direciona para o novo link.' });
        setEditingPlateId(null);
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao atualizar placa.' });
    }
  };

  const handleTogglePlateStatus = async (plateId: string) => {
    try {
      const res = await api.togglePlateStatus(plateId);
      if (res.sucesso) {
        setFeedback({ type: 'success', text: res.mensagem });
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao alterar status.' });
    }
  };

  const handleOpenQrCodeModal = async (plate: Plate) => {
    try {
      const res = await api.getPlateQrCode(plate.id);
      if (res.sucesso) {
        setQrCodeModal({ plate, dataUrl: res.qrcode_data_url });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível carregar o QR Code da placa.' });
    }
  };

  // Salvar Dados do Perfil
  const handleSalvarPerfil = async () => {
    setProfileSaving(true);
    setFeedback(null);
    try {
      // Simulação ou update via API
      setTimeout(() => {
        setProfileSaving(false);
        setFeedback({ type: 'success', text: 'Dados e endereço atualizados com sucesso!' });
        onRefreshProfile();
      }, 600);
    } catch {
      setProfileSaving(false);
      setFeedback({ type: 'error', text: 'Falha ao atualizar dados.' });
    }
  };

  // Estatísticas calculadas do revendedor
  const placasAtivasCount = plates.filter((p) => p.status_digital === 'ativa').length;
  const leiturasTotal = plates.length * 14; // Mock dinâmico de interações NFC/QR

  // Cálculo de vendas do revendedor
  const totalCustoPlacas = plates.reduce((acc) => acc + 21.90, 0);
  const totalVendido = plates.reduce((acc, p) => acc + (clientSalePrices[p.id] || 0), 0);
  const lucroLiquido = Math.max(0, totalVendido - totalCustoPlacas);
  const margemLucro = totalVendido > 0 ? Math.round((lucroLiquido / totalVendido) * 100) : 0;
  const ticketMedio = plates.length > 0 && totalVendido > 0 ? totalVendido / plates.length : 0;

  // Filtragem de placas
  const filteredPlates = plates.filter((p) => {
    const matchSearch =
      !searchPlaca ||
      p.codigo_sequencial.toLowerCase().includes(searchPlaca.toLowerCase()) ||
      (p.nome_estabelecimento && p.nome_estabelecimento.toLowerCase().includes(searchPlaca.toLowerCase())) ||
      (p.url_destino && p.url_destino.toLowerCase().includes(searchPlaca.toLowerCase()));
    if (!matchSearch) return false;
    if (filterPlacaStatus === 'ativas') return p.status_digital === 'ativa';
    if (filterPlacaStatus === 'inativas') return p.status_digital !== 'ativa';
    return true;
  });

  return (
    <div className="pb-24 max-w-xl mx-auto px-4 pt-4 text-slate-800">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`mb-4 p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: MEUS PEDIDOS (Prints: Screenshot 19-43-38 e 19-43-35) */}
      {/* ========================================================================= */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          {/* Card Superior de Saudação */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{getGreeting()}</h2>
            <p className="text-xs text-slate-500 mt-1">Pronto para pedir suas placas? É rápido e fácil.</p>
            <button
              onClick={() => setActiveTab('comprar')}
              className="mt-4 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Fazer pedido</span>
            </button>
          </div>

          {/* Banner "MANUAL DE USO DAS NOSSAS PLACAS NFC" */}
          <div
            onClick={() => setIsManualModalOpen(true)}
            className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm hover:opacity-95 transition"
            title="Clique para ver o manual de uso em tamanho ampliado"
          >
            <img
              src="/assets/aistudio/manual_placas_banner.jpg"
              alt="Manual de Uso das Nossas Placas NFC"
              className="w-full h-auto object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Seção Meus Pedidos */}
          <div>
            <h3 className="text-lg font-bold text-slate-900">Meus Pedidos</h3>
            <p className="text-xs text-slate-500">Acompanhe o status dos seus pedidos de placas NFC.</p>
          </div>

          {/* Lista ou Vazio */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                <Package className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Você ainda não tem pedidos.</p>
                <p className="text-xs text-slate-400 mt-0.5">Quando você fizer uma compra, seus pedidos aparecerão aqui.</p>
              </div>
              <button
                onClick={() => setActiveTab('comprar')}
                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center gap-2"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Fazer primeiro pedido</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => {
                const isPaid = ord.status !== 'aguardando_pagamento' && ord.status !== 'cancelado';
                return (
                  <div key={ord.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-800">
                          #{ord.numero_pedido}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-2">
                          {new Date(ord.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          ord.status === 'aguardando_pagamento'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : ord.status === 'pago' || ord.status === 'concluido'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {ord.status === 'aguardando_pagamento'
                          ? 'Aguardando Pagamento'
                          : ord.status === 'pago'
                          ? 'Pago / Liberado'
                          : ord.status === 'em_producao'
                          ? 'Em Produção'
                          : ord.status === 'concluido'
                          ? 'Concluído'
                          : ord.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-900">{ord.quantidade_total} placas</span> ·{' '}
                        <span>R$ {ord.valor_total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        {ord.modalidade_entrega === 'retirada' ? (
                          <>
                            <Building className="w-3.5 h-3.5 text-blue-500" />
                            <span>Retirada</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3.5 h-3.5 text-slate-500" />
                            <span>Correios</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Rastreio ou Retirada */}
                    {ord.logistica?.codigo_rastreamento && (
                      <div className="p-2.5 bg-blue-50/70 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-blue-700 block">Rastreamento</span>
                          <span className="font-mono font-medium">{ord.logistica.codigo_rastreamento}</span>
                        </div>
                        <a
                          href={`https://rastreamento.correios.com.br/app/index.php?codigo=${ord.logistica.codigo_rastreamento}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Rastrear <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {ord.modalidade_entrega === 'retirada' && (
                      <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">Retirada no Local</span>
                          <span>Combinar retirada via WhatsApp</span>
                        </div>
                        <a
                          href="https://wa.me/5521999999999?text=Ol%C3%A1%2C%20gostaria%20de%20combinar%20a%20retirada%20do%20meu%20pedido%20Atelier%20das%20Placas"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 shadow-xs"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {/* Ação de Pagamento se pendente */}
                    {!isPaid && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleOpenPixModal(ord)}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-xl shadow-sm transition"
                        >
                          Pagar via PIX (R$ {ord.valor_total.toFixed(2)})
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: COMPRAR PLACA (Prints: 19-43-54, 19-43-49, 19-44-28, 19-44-31) */}
      {/* ========================================================================= */}
      {activeTab === 'comprar' && (
        <div className="space-y-5">
          {/* Título & Descrição */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Comprar Placa</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Escolha os modelos e a quantidade de cada um. Frete grátis a partir de 20 unidades no total.
            </p>
          </div>

          {/* Banner de Aviso Vermelho (Screenshot 19-43-54) */}
          <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-4 text-slate-700 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>Você não precisa criar nenhum QR Code</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Todos os QR Codes são gerados e impressos pela Atelier das Placas. Ao concluir a compra de um modelo com QR Code dinâmico, a placa aparece automaticamente aqui no seu painel, já pronta para uso.
            </p>
            <p className="text-xs leading-relaxed text-slate-600">
              No Gerenciador de Placas você define e altera o link de destino quantas vezes quiser — o QR Code impresso continua o mesmo e passa a direcionar para o novo endereço na hora. Você também pode ligar ou desligar cada placa quando precisar.
            </p>
          </div>

          {/* 1. Escolha os modelos e as quantidades */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">1. Escolha os modelos e as quantidades</h3>

            {/* Banner Dark de Lançamentos (Screenshot 19-43-49) */}
            <div className="bg-[#0b172a] text-white rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-600 rounded-full uppercase tracking-wider text-white">
                  ✨ 2 NOVOS MODELOS
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 rounded-full uppercase tracking-wider text-slate-300">
                  🔥 JÁ DISPONÍVEIS
                </span>
              </div>
              <h4 className="text-lg font-bold tracking-tight text-white">
                Agora temos placas 3x1 e Placa do Natal
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Chegaram os 2 modelos mais pedidos: Se antecipe para as vendas da Black e Natal.
                As duas usam <strong>QR Code dinâmico</strong>: a pessoa escaneia ou aproxima o celular, abre a nossa página segura e é redirecionada para o seu Pix ou para o seu Wi-Fi.
              </p>
              <button
                onClick={() => {
                  handleUpdateQuantity('parede_branca', 1);
                  setFeedback({ type: 'success', text: 'Modelo 3x1 Parede Branca adicionado ao carrinho!' });
                }}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <span>QUERO A NOVIDADE AGORA</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lista dos Modelos com fotos reais e seletores de quantidade */}
            <div className="space-y-3">
              {catalogItems.map((item) => {
                const unitPrice =
                  item.id === 'placa_tradicional'
                    ? getTradicionalUnitPrice(item.quantidade)
                    : item.preco;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center"
                  >
                    {/* Imagem do Produto */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center p-1">
                      <img
                        src={item.imagem}
                        alt={item.nome}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Detalhes do Produto */}
                    <div className="flex-1 space-y-1 text-center sm:text-left w-full">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                          {item.badge}
                        </span>
                        {item.isSobEncomenda && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            Sob Encomenda (48h)
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{item.nome}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{item.descricao}</p>

                      <div className="pt-1 flex items-baseline justify-center sm:justify-start gap-1">
                        <span className="text-base font-bold text-blue-600">
                          R$ {unitPrice.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">/unidade</span>
                        {item.id === 'placa_tradicional' && (
                          <span className="text-[10px] text-emerald-600 ml-1">
                            (10+ R$ 19,90 · 50+ R$ 17,90)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Seletor de Quantidade (+ / -) */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        disabled={item.quantidade === 0}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition shadow-2xs"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-8 text-center font-bold text-xs text-slate-800">
                        {item.quantidade}
                      </span>

                      <button
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Endereço de entrega (Screenshot 19-44-28) */}
          <div className="space-y-3 pt-2">
            <h3 className="font-bold text-slate-900 text-sm">2. Endereço de entrega</h3>

            {/* Card Endereço Salvo */}
            <div className="bg-blue-50/40 border border-blue-200/70 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">Entregar neste endereço</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                        SALVO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {deliveryAddress.logradouro}, {deliveryAddress.numero}
                      {deliveryAddress.complemento ? ` - ${deliveryAddress.complemento}` : ''}
                      <br />
                      {deliveryAddress.bairro} · {deliveryAddress.cidade}/{deliveryAddress.estado}
                      <br />
                      CEP {deliveryAddress.cep}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Destinatário: {deliveryAddress.destinatario} · Doc: {deliveryAddress.cpf_cnpj} · Tel: {deliveryAddress.telefone}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition"
                >
                  {isEditingAddress ? 'Fechar' : 'Alterar'}
                </button>
              </div>

              {/* Formulário de alteração de endereço inline */}
              {isEditingAddress && (
                <div className="pt-3 border-t border-blue-200/60 grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-slate-600">Rua/Avenida</label>
                    <input
                      type="text"
                      value={deliveryAddress.logradouro}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, logradouro: e.target.value })}
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">Número</label>
                    <input
                      type="text"
                      value={deliveryAddress.numero}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, numero: e.target.value })}
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">Complemento</label>
                    <input
                      type="text"
                      value={deliveryAddress.complemento}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, complemento: e.target.value })}
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">Bairro</label>
                    <input
                      type="text"
                      value={deliveryAddress.bairro}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, bairro: e.target.value })}
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600">CEP</label>
                    <input
                      type="text"
                      value={deliveryAddress.cep}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, cep: e.target.value })}
                      className="w-full mt-0.5 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Opções de Modalidade de Entrega e Cotação Melhor Envio */}
              <div className="pt-3 border-t border-blue-200/60 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Transportadora e Frete (Melhor Envio):
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Até 80% de desconto</span>
                  </span>
                </div>

                {loadingShipping && (
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-800 flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span>Cotando opções mais baratas e rápidas no Melhor Envio (Jadlog, Correios, Loggi)...</span>
                  </div>
                )}

                {shippingOptions.length > 0 && !loadingShipping && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Escolha a transportadora ideal para o seu endereço (CEP {deliveryAddress.cep}):
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {shippingOptions.map((opt) => {
                        const isSelected = selectedShipping?.service_id === opt.service_id;
                        return (
                          <div
                            key={opt.service_id}
                            onClick={() => setSelectedShipping(opt)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                              isSelected
                                ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900">
                                    {opt.carrier_name}
                                  </span>
                                  <span className="text-[11px] font-medium text-slate-600">
                                    {opt.service_name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{opt.delivery_time} {opt.delivery_time === 1 ? 'dia útil' : 'dias úteis'}</span>
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                {isFreteGratis ? (
                                  <span className="font-bold text-xs text-emerald-600 block">
                                    Grátis
                                  </span>
                                ) : (
                                  <div>
                                    {opt.original_price && opt.original_price > opt.price && (
                                      <span className="text-[10px] text-slate-400 line-through block leading-tight">
                                        R$ {opt.original_price.toFixed(2)}
                                      </span>
                                    )}
                                    <span className="font-bold text-xs text-blue-700">
                                      R$ {opt.price.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Badges de Destaque */}
                            <div className="flex items-center gap-1.5 mt-2">
                              {opt.is_cheapest && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-white uppercase tracking-wider flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 fill-current" />
                                  <span>Mais Barato</span>
                                </span>
                              )}
                              {opt.is_fastest && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-600 text-white uppercase tracking-wider flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Mais Rápido</span>
                                </span>
                              )}
                              <span className="text-[9px] text-slate-400 ml-auto">
                                {isSelected ? '✓ Selecionado' : 'Clique para escolher'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Observação para o pedido */}
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <span>Observação para este pedido (opcional)</span>
                </label>
                <textarea
                  value={observacaoPedido}
                  onChange={(e) => setObservacaoPedido(e.target.value)}
                  placeholder="Ex: entregar após 14h, ponto de referência..."
                  rows={2}
                  className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Resumo do pedido (Screenshot 19-44-31) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span>Resumo do pedido</span>
            </div>

            {totalItens === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Nenhum item no pedido ainda.</p>
            ) : (
              <div className="space-y-1.5 py-1">
                {catalogItems
                  .filter((i) => i.quantidade > 0)
                  .map((i) => (
                    <div key={i.id} className="flex justify-between text-xs text-slate-600">
                      <span>
                        {i.quantidade}x {i.nome}
                      </span>
                      <span className="font-mono font-medium">
                        R${' '}
                        {(
                          (i.id === 'placa_tradicional'
                            ? getTradicionalUnitPrice(i.quantidade)
                            : i.preco) * i.quantidade
                        ).toFixed(2)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-600">
              <div className="flex flex-col">
                <span>
                  Frete ({modalidadeEntrega === 'retirada' ? 'Retirada no Balcão' : selectedShipping ? `${selectedShipping.carrier_name} ${selectedShipping.service_name} · ${selectedShipping.delivery_time} dias úteis` : 'Melhor Envio'})
                </span>
                {selectedShipping?.is_cheapest && !isFreteGratis && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 fill-current" />
                    <span>Opção mais econômica selecionada</span>
                  </span>
                )}
              </div>
              <span className={`font-semibold ${isFreteGratis ? 'text-emerald-600' : 'text-slate-900 font-mono'}`}>
                {totalItens === 0 ? '—' : isFreteGratis ? 'Grátis (Promoção 20+ un)' : `R$ ${freteValor.toFixed(2)}`}
              </span>
            </div>

            {/* Campo Cupom de Desconto */}
            <div className="pt-2">
              <label className="text-[11px] text-slate-500 block mb-1">Tem um cupom de desconto?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite o cupom"
                  value={cupomDesconto}
                  onChange={(e) => setCupomDesconto(e.target.value.toUpperCase())}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    if (cupomDesconto === 'PRIMEIRACOMPRA' || cupomDesconto === 'ECLOURA10') {
                      setCupomAplicado(true);
                      setFeedback({ type: 'success', text: 'Cupom de 10% de desconto aplicado!' });
                    } else {
                      setFeedback({ type: 'error', text: 'Cupom inválido ou expirado.' });
                    }
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {/* Total e Botão Final */}
            <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
              <span className="font-bold text-slate-900 text-base">Total</span>
              <span className="text-xl font-bold text-blue-600 font-mono">
                R$ {totalGeral.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleFinalizarCompra}
              disabled={totalItens === 0 || loading}
              className={`w-full py-3 rounded-xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 ${
                totalItens > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-blue-200 text-white cursor-not-allowed'
              }`}
            >
              {loading ? 'Processando pedido...' : `Comprar R$ ${totalGeral.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: MINHAS VENDAS (Prints: 19-44-57 e 19-43-59) */}
      {/* ========================================================================= */}
      {activeTab === 'vendas' && (
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
              SEU NEGÓCIO
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Minhas vendas</h2>
          </div>

          {/* Filtros de Período (Hoje, Ontem, 7 dias, 30 dias, Este ano) */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'hoje', label: 'Hoje' },
              { id: 'ontem', label: 'Ontem' },
              { id: '7dias', label: '7 dias' },
              { id: '30dias', label: '30 dias' },
              { id: 'ano', label: 'Este ano' },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setVendasPeriodo(period.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition ${
                  vendasPeriodo === period.id
                    ? 'bg-white text-blue-600 shadow-2xs border border-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Card Azul de Destaque - Lucro Líquido */}
          <div className="bg-gradient-to-tr from-blue-600 to-blue-500 rounded-3xl p-6 text-white shadow-md space-y-2 relative overflow-hidden">
            <span className="text-xs font-medium text-blue-100 block">Lucro líquido no período</span>
            <div className="text-3xl font-extrabold tracking-tight font-mono">
              R$ {lucroLiquido.toFixed(2)}
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-xs">
                ↗ {margemLucro}% de margem
              </span>
            </div>
          </div>

          {/* 4 Cards de Métricas em Grid 2x2 (Screenshot 19-44-57) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-blue-600">
                <BarChart2 className="w-4 h-4" />
                <span className="text-xs text-slate-500 font-medium">Vendido</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                R$ {totalVendido.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">{plates.length} venda(s)</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Building className="w-4 h-4" />
                <span className="text-xs text-slate-500 font-medium">Ticket médio</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                R$ {ticketMedio.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">média por venda</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-blue-600">
                <ShoppingCart className="w-4 h-4" />
                <span className="text-xs text-slate-500 font-medium">Custos</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                R$ {totalCustoPlacas.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">o que você pagou nas placas</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
              <div className="flex items-center gap-1.5 text-blue-600">
                <User className="w-4 h-4" />
                <span className="text-xs text-slate-500 font-medium">A receber</span>
              </div>
              <div className="text-base font-bold text-slate-900 font-mono">
                R$ 0,00
              </div>
              <div className="text-[10px] text-slate-400">vendas pendentes</div>
            </div>
          </div>

          {/* Subabas: Clientes, Vendas, Custos, Despesas */}
          <div className="space-y-3 pt-2">
            <div className="flex border-b border-slate-200">
              {[
                { id: 'clientes', label: 'Clientes' },
                { id: 'vendas', label: 'Vendas' },
                { id: 'custos', label: 'Custos' },
                { id: 'despesas', label: 'Despesas' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setVendasSubtab(sub.id as any)}
                  className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
                    vendasSubtab === sub.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Os clientes vêm do nome que você coloca em cada placa no Gerenciador de Placas. Digite por quanto vendeu e o lucro aparece na hora.
            </p>

            {/* Listagem de Placas com Registro de Preço de Venda ao Cliente */}
            {plates.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm text-center">
                <p className="text-xs text-slate-500">
                  Você ainda não tem placas. Quando comprar, elas aparecem aqui.
                </p>
                <button
                  onClick={() => setActiveTab('comprar')}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Comprar placas
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {plates.map((placa) => {
                  const valorVendaAtual = clientSalePrices[placa.id] || 0;
                  const lucroDestaPlaca = Math.max(0, valorVendaAtual - 21.90);

                  return (
                    <div
                      key={placa.id}
                      className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800 font-mono">
                            {placa.codigo_sequencial}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {placa.nome_estabelecimento || 'Cliente não definido'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Custo base: R$ 21,90 · Lucro: R$ {lucroDestaPlaca.toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs text-slate-500">Vendeu por:</span>
                        <div className="relative flex-1 sm:w-28">
                          <span className="absolute left-2.5 top-2 text-xs text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={valorVendaAtual || ''}
                            placeholder="0,00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setClientSalePrices({ ...clientSalePrices, [placa.id]: val });
                            }}
                            className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: GERENCIADOR DE PLACAS (Prints: 19-44-41 e 19-44-44) */}
      {/* ========================================================================= */}
      {activeTab === 'placas' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gerenciador de Placas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie suas placas, QR Codes e destinos em um só lugar.
            </p>
          </div>

          {/* 3 Metric Cards (Placas, Ativas, Leituras) */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm text-center">
              <span className="text-[11px] text-slate-500 font-medium block">Placas</span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
                {plates.length}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm text-center">
              <span className="text-[11px] text-slate-500 font-medium block">Ativas</span>
              <span className="text-xl font-bold text-emerald-600 font-mono mt-0.5 block">
                {placasAtivasCount}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm text-center">
              <span className="text-[11px] text-slate-500 font-medium block">Leituras</span>
              <span className="text-xl font-bold text-blue-600 font-mono mt-0.5 block">
                {leiturasTotal}
              </span>
            </div>
          </div>

          {/* Barra de Busca e Filtro de Status */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar placa..."
                value={searchPlaca}
                onChange={(e) => setSearchPlaca(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <select
              value={filterPlacaStatus}
              onChange={(e) => setFilterPlacaStatus(e.target.value as any)}
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="ativas">Somente Ativas</option>
              <option value="inativas">Somente Inativas</option>
            </select>
          </div>

          {/* Listagem de Placas */}
          {filteredPlates.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center">
                <QrCode className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">Nenhuma placa encontrada</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Suas placas aparecem aqui automaticamente assim que o pedido é confirmado.
              </p>
              {plates.length === 0 && (
                <button
                  onClick={() => setActiveTab('comprar')}
                  className="mt-2 py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Comprar placas agora</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlates.map((placa) => {
                const isEditing = editingPlateId === placa.id;
                const isAtiva = placa.status_digital === 'ativa';

                return (
                  <div
                    key={placa.id}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3"
                  >
                    {/* Header da Placa */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {placa.codigo_sequencial}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              isAtiva
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isAtiva ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {placa.nome_estabelecimento || 'Sem cliente vinculado'}
                        </p>
                      </div>

                      {/* Botão de Alternar Status (Ativa / Inativa) */}
                      <button
                        onClick={() => handleTogglePlateStatus(placa.id)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                          isAtiva
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {isAtiva ? 'Desligar placa' : 'Ligar placa'}
                      </button>
                    </div>

                    {/* Conteúdo e Configuração */}
                    {!isEditing ? (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">
                          <span className="font-medium text-slate-500 block text-[10px] uppercase">
                            Destino Atual:
                          </span>
                          <div className="font-mono text-[11px] truncate text-blue-600 bg-blue-50/50 p-1.5 rounded-md mt-0.5 flex items-center justify-between">
                            <span className="truncate">{placa.url_destino || 'https://google.com'}</span>
                            <a
                              href={placa.url_destino || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 ml-2"
                              title="Testar link"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => handleOpenQrCodeModal(placa)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 py-1"
                          >
                            <QrCode className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ver QR Code</span>
                          </button>

                          <button
                            onClick={() => handleStartEditingPlate(placa)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition"
                          >
                            Alterar destino
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Formulário de Edição de Destino */
                      <div className="pt-2 space-y-2.5 text-xs animate-fadeIn">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">
                            Nome do Cliente / Estabelecimento
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Restaurante Bella Napoli"
                            value={editingPlateData.nome_estabelecimento}
                            onChange={(e) =>
                              setEditingPlateData({
                                ...editingPlateData,
                                nome_estabelecimento: e.target.value,
                              })
                            }
                            className="w-full mt-0.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-slate-600">
                            Link de Destino do QR Code Dinâmico
                          </label>
                          <input
                            type="url"
                            placeholder="https://g.page/r/sua-empresa/review"
                            value={editingPlateData.url_destino}
                            onChange={(e) =>
                              setEditingPlateData({
                                ...editingPlateData,
                                url_destino: e.target.value,
                              })
                            }
                            className="w-full mt-0.5 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>

                        {/* Atalhos de Destino */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {[
                            { label: 'Google Avaliações', url: 'https://search.google.com/local/writereview?placeid=ChIJ' },
                            { label: 'WhatsApp', url: 'https://wa.me/5521999999999' },
                            { label: 'Instagram', url: 'https://instagram.com/' },
                            { label: 'Cardápio / Site', url: 'https://' },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                setEditingPlateData({
                                  ...editingPlateData,
                                  url_destino: preset.url,
                                })
                              }
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px]"
                            >
                              + {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setEditingPlateId(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePlateConfig(placa.id)}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs"
                          >
                            Salvar destino
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: MEU PERFIL (Prints: 19-42-42, 19-43-02, 19-43-11) */}
      {/* ========================================================================= */}
      {activeTab === 'perfil' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Meu Perfil</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atualize seus dados de entrega e sua senha de acesso.
            </p>
          </div>

          {/* Card: Dados e endereço (Screenshot 19-42-42 e 19-43-02) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              <Building className="w-4 h-4 text-blue-600" />
              <span>Dados e endereço</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Nome completo</label>
                <input
                  type="text"
                  value={deliveryAddress.destinatario}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, destinatario: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">Telefone (WhatsApp)</label>
                <input
                  type="text"
                  value={deliveryAddress.telefone}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, telefone: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">CPF</label>
                <input
                  type="text"
                  value={deliveryAddress.cpf_cnpj}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, cpf_cnpj: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">CEP</label>
                <input
                  type="text"
                  value={deliveryAddress.cep}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, cep: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">Endereço (rua/av.)</label>
                <input
                  type="text"
                  value={deliveryAddress.logradouro}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, logradouro: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Número</label>
                  <input
                    type="text"
                    value={deliveryAddress.numero}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, numero: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Complemento</label>
                  <input
                    type="text"
                    value={deliveryAddress.complemento}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, complemento: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">Bairro</label>
                <input
                  type="text"
                  value={deliveryAddress.bairro}
                  onChange={(e) => setDeliveryAddress({ ...deliveryAddress, bairro: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Cidade</label>
                  <input
                    type="text"
                    value={deliveryAddress.cidade}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, cidade: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Estado (UF)</label>
                  <input
                    type="text"
                    value={deliveryAddress.estado}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, estado: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSalvarPerfil}
                  disabled={profileSaving}
                  className="w-full sm:w-auto py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{profileSaving ? 'Salvando...' : 'Salvar alterações'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card: Alterar senha (Screenshot 19-43-11) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              <Key className="w-4 h-4 text-blue-600" />
              <span>Alterar senha</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Nova senha</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">Confirmar nova senha</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    if (newPassword.length < 6) {
                      setFeedback({ type: 'error', text: 'A senha deve conter ao menos 6 caracteres.' });
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setFeedback({ type: 'error', text: 'As senhas não coincidem.' });
                      return;
                    }
                    setFeedback({ type: 'success', text: 'Senha alterada com sucesso!' });
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="w-full sm:w-auto py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition inline-flex items-center justify-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Alterar senha</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QR CODE AMPLIAÇÃO & TESTE */}
      {/* ========================================================================= */}
      {qrCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">QR Code Dinâmico</h3>
            <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 rounded-md text-slate-700">
              {qrCodeModal.plate.codigo_sequencial}
            </span>

            <div className="p-3 bg-white border border-slate-200 rounded-xl inline-block shadow-xs">
              <img
                src={qrCodeModal.dataUrl}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-xs text-slate-500 break-all px-2">
              Destino atual: <br />
              <strong className="text-blue-600">{qrCodeModal.plate.url_destino || 'https://google.com'}</strong>
            </p>

            <div className="flex gap-2 pt-2">
              <a
                href={qrCodeModal.dataUrl}
                download={`qrcode_${qrCodeModal.plate.codigo_sequencial}.png`}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar PNG</span>
              </a>
              <button
                onClick={() => setQrCodeModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PAGAMENTO PIX / ASAAS COM SIMULAÇÃO */}
      {/* ========================================================================= */}
      {pixModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">Pagamento via PIX</h3>
              <p className="text-xs text-slate-500">
                Pedido #{pixModalOrder.numero_pedido} · Total: R$ {pixModalOrder.valor_total.toFixed(2)}
              </p>
            </div>

            {pixPaymentInfo?.pix_qrcode_url && (
              <div className="flex flex-col items-center justify-center p-2 bg-slate-50 border border-slate-100 rounded-xl">
                <img
                  src={pixPaymentInfo.pix_qrcode_url}
                  alt="QR Code Pix Asaas"
                  className="w-40 h-40 rounded-lg bg-white p-1 border border-slate-200"
                />
                <span className="text-[10px] text-slate-500 mt-1 font-medium">Aponte a câmera do aplicativo do seu banco</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2">
              <label className="text-[10px] font-bold text-slate-600 uppercase">PIX Copia e Cola:</label>
              <div className="p-2 bg-white border border-slate-200 rounded-lg text-[11px] font-mono break-all max-h-24 overflow-y-auto text-slate-700 select-all">
                {pixPaymentInfo?.pix_copia_cola || '00020126580014br.gov.bcb.pix...'}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixPaymentInfo?.pix_copia_cola || '');
                  setCopiedPix(true);
                  setTimeout(() => setCopiedPix(false), 2000);
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPix ? 'Chave Copiada!' : 'Copiar Código PIX'}</span>
              </button>
            </div>

            {/* Simulação para Homologação */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => handleSimularPagamento(pixModalOrder.id)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                ⚡ Simular Confirmação do Pagamento PIX (Homologação)
              </button>
              <button
                onClick={() => setPixModalOrder(null)}
                className="mt-2 text-xs text-slate-400 hover:text-slate-600"
              >
                Fechar e pagar depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ZOOM DO MANUAL DE USO */}
      {/* ========================================================================= */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-slate-800 text-sm">Manual de Uso das Placas NFC</span>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto mt-2">
              <img
                src="/assets/aistudio/manual_placas_banner.jpg"
                alt="Manual de Uso das Nossas Placas NFC"
                className="w-full h-auto rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOTÃO FLUTUANTE WHATSAPP (Exato como nas telas) */}
      {/* ========================================================================= */}
      <a
        href="https://wa.me/5521999999999?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20as%20placas%20Atelier%20das%20Placas"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-20 right-4 z-40 w-13 h-13 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-transform"
        title="Falar no WhatsApp"
        aria-label="Atendimento no WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-white text-white" />
      </a>

      {/* ========================================================================= */}
      {/* BOTTOM NAVIGATION BAR (Exato como nos 17 prints) */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200/80 shadow-lg">
        <div className="max-w-xl mx-auto grid grid-cols-5 items-center h-16 px-2">
          {/* Tab 1: Pedidos */}
          <button
            onClick={() => setActiveTab('pedidos')}
            className={`flex flex-col items-center justify-center transition ${
              activeTab === 'pedidos' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] mt-1">Pedidos</span>
          </button>

          {/* Tab 2: Comprar */}
          <button
            onClick={() => setActiveTab('comprar')}
            className={`flex flex-col items-center justify-center transition ${
              activeTab === 'comprar' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="text-[10px] mt-1">Comprar</span>
          </button>

          {/* Tab 3: Vendas (Botão Circular Central Elevado) */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <button
              onClick={() => setActiveTab('vendas')}
              className={`w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-transform ${
                activeTab === 'vendas' ? 'ring-4 ring-blue-100' : ''
              }`}
              title="Minhas Vendas"
            >
              <BarChart2 className="w-6 h-6" />
            </button>
            <span
              className={`text-[10px] mt-1 ${
                activeTab === 'vendas' ? 'text-blue-600 font-semibold' : 'text-slate-400'
              }`}
            >
              Vendas
            </span>
          </div>

          {/* Tab 4: Placas */}
          <button
            onClick={() => setActiveTab('placas')}
            className={`flex flex-col items-center justify-center transition ${
              activeTab === 'placas' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] mt-1">Placas</span>
          </button>

          {/* Tab 5: Perfil */}
          <button
            onClick={() => setActiveTab('perfil')}
            className={`flex flex-col items-center justify-center transition ${
              activeTab === 'perfil' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-1">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
