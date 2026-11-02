import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface CancellationPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CancellationPolicyModal: React.FC<CancellationPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white text-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Política de Cancelamento</h3>
              <p className="text-xs text-slate-500">Regras de pedidos, trocas e reembolsos Atelier das Placas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Garantia de Qualidade e Legislação Vigente</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Todas as transações e pedidos de placas inteligentes Atelier das Placas respeitam o Código de Defesa do Consumidor (Lei nº 8.078/1990) e os termos de produção personalizada sob demanda.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 text-sm mb-1">1. Cancelamento Antes da Produção</h4>
            <p>
              O revendedor pode solicitar o cancelamento e reembolso integral do pedido enquanto o status estiver em <strong>"Aguardando Pagamento"</strong> ou <strong>"Pago"</strong> (antes de entrar no processo de gravação a laser, impressão UV e gravação de chips NFC).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 text-sm mb-1">2. Produtos Sob Encomenda</h4>
            <p>
              Modelos com acabamentos especiais (ex: 3 em 1 Parede Branca, Placa 3x1 Preta, Cesta Ouro e Lançamentos Sazonais) são produzidos sob encomenda exclusiva após a confirmação do pagamento. Uma vez iniciada a usinagem e gravação UV dos QR Codes permanentes, o cancelamento sem vício do produto não é admitido, em conformidade com o Art. 49 do CDC relativo a bens personalizados.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 text-sm mb-1">3. Garantia e Inconformidade Técnica</h4>
            <p>
              Todas as placas passam por dupla inspeção (física e digital). Caso você receba alguma placa com defeito de leitura do chip NFC ou falha de legibilidade do QR Code impresso, a substituição da unidade com defeito é realizada sem custos adicionais de frete ou produção.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 text-sm mb-1">4. Como Solicitar Suporte</h4>
            <p>
              Para solicitar suporte, cancelamento ou garantia, utilize o canal direto de atendimento pelo WhatsApp oficial Atelier das Placas através do botão verde flutuante no painel ou informe o número do pedido.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
