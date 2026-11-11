import React, { useState } from 'react';
import { X, Store, Truck, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import type { DeliveryPreference, Profile } from '../types.js';
import { maskPhone, maskCpfCnpj } from '../utils/masks.js';

interface PublicRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProfile: Profile) => void;
}

export const PublicRegisterModal: React.FC<PublicRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [preferenciaEntrega] = useState<DeliveryPreference>('correios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.registerPublic({
        nome,
        email,
        telefone,
        cpf_cnpj: cpfCnpj,
        preferencia_entrega: 'correios',
      });

      if (response.sucesso) {
        onSuccess(response.perfil);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
            Cadastro de Revendedor Autorizado
          </span>
          <h2 className="text-xl font-bold text-white mt-2">Torne-se um Revendedor Atelier das Placas</h2>
          <p className="text-xs text-slate-400 mt-1">
            Tenha acesso ao portal comercial para compra de placas inteligentes com QR Code dinâmico e chip NFC.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nome Completo ou Razão Social *</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">E-mail Comercial *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp / Telefone *</label>
              <input
                type="text"
                required
                value={telefone}
                onChange={(e) => setTelefone(maskPhone(e.target.value))}
                placeholder="(21) 99999-0000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">CPF ou CNPJ</label>
            <input
              type="text"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* INFORMATIVO DE ENVIO EXCLUSIVO CORREIOS */}
          <div className="pt-2 border-t border-slate-800">
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-3">
              <Truck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Envio Seguro via Correios para Todo o Brasil
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Seus pedidos de placas serão produzidos sob demanda e despachados diretamente para o endereço de sua escolha com código de rastreamento.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Cadastrando...' : 'Concluir Cadastro'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
