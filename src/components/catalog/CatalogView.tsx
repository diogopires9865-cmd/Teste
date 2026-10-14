/**
 * SW Service Desk v1.0 - Catálogo de Serviços e Fluxos de Aprovação
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CatalogItem, ServiceApproval } from '../../types';
import {
  Layers,
  Laptop,
  ShieldCheck,
  Cloud,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  X,
  FileCheck,
} from 'lucide-react';

interface CatalogViewProps {
  onSelectTicket?: (ticketId: number) => void;
  onRefreshStats?: () => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ onSelectTicket, onRefreshStats }) => {
  const { token, user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [approvals, setApprovals] = useState<ServiceApproval[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'approvals'>('catalog');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal de Submissão
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [justification, setJustification] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal de Decisão de Aprovação
  const [decisionApproval, setDecisionApproval] = useState<ServiceApproval | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [deciding, setDeciding] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, approvalsRes] = await Promise.all([
        fetch('/api/v1/catalog/items', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch('/api/v1/catalog/approvals', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items);
      }
      if (approvalsRes.ok) {
        const d = await approvalsRes.json();
        setApprovals(d.approvals);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleOpenRequest = (item: CatalogItem) => {
    setSelectedItem(item);
    setJustification('');
    setFormValues({});
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/catalog/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          item_id: selectedItem.id,
          justification,
          custom_values: formValues,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setSelectedItem(null);
        await fetchData();
        if (onRefreshStats) onRefreshStats();
        if (onSelectTicket) onSelectTicket(data.id);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao submeter pedido.');
      }
    } catch {
      alert('Erro de comunicação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecideApproval = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!decisionApproval) return;

    setDeciding(true);
    try {
      const res = await fetch(`/api/v1/catalog/approvals/${decisionApproval.id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision,
          notes: decisionNotes || undefined,
        }),
      });

      if (res.ok) {
        setDecisionApproval(null);
        setDecisionNotes('');
        await fetchData();
        if (onRefreshStats) onRefreshStats();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao processar aprovação.');
      }
    } catch {
      alert('Erro ao registar decisão.');
    } finally {
      setDeciding(false);
    }
  };

  const getItemIcon = (id: number) => {
    if (id === 1) return Laptop;
    if (id === 2) return ShieldCheck;
    return Cloud;
  };

  const pendingApprovalsCount = approvals.filter((a) => a.approval_status === 'PENDING').length;
  const isManagerOrAdmin = user && ['manager', 'admin'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* 1. Header & Separadores */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Catálogo de Serviços TI & Workflows</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Solicitação padronizada de equipamentos, acessos corporativos e gestão de aprovações
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'catalog' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Itens do Catálogo
          </button>
          {isManagerOrAdmin && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'approvals' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Aprovações Pendentes</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'catalog' ? (
        /* Grelha de Itens de Catálogo */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const Icon = getItemIcon(item.id);

            return (
              <div
                key={item.id}
                className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm space-y-4"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Prazo Estimado:</span>
                    </span>
                    <span className="font-mono text-slate-200">{item.estimated_days} dias úteis</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span>Aprovação Prévia:</span>
                    <span className={item.requires_approval ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
                      {item.requires_approval ? `Exigida (${item.approval_role})` : 'Dispensada'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenRequest(item)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Solicitar Serviço</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Lista de Aprovações Pendentes */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Fila de Aprovações Hierárquicas
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pedidos de serviço que requerem autorização prévia de supervisor ou administração
            </p>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Serviço Solicitado</th>
                <th className="py-3 px-4">Requerente</th>
                <th className="py-3 px-4">Estado da Aprovação</th>
                <th className="py-3 px-4">Data do Pedido</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Não existem pedidos de aprovação pendentes de momento.
                  </td>
                </tr>
              ) : (
                approvals.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono font-medium text-blue-400">{app.ticket_number}</td>
                    <td className="py-3 px-4 font-medium text-white">{app.title}</td>
                    <td className="py-3 px-4 text-slate-300">{app.requester_name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          app.approval_status === 'APPROVED'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : app.approval_status === 'REJECTED'
                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}
                      >
                        {app.approval_status === 'APPROVED'
                          ? 'Aprovado'
                          : app.approval_status === 'REJECTED'
                          ? 'Rejeitado'
                          : 'Pendente de Avaliação'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                      {new Date(app.created_at).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {app.approval_status === 'PENDING' ? (
                        <button
                          onClick={() => setDecisionApproval(app)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition-colors"
                        >
                          Avaliar Pedido
                        </button>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Decidido</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Solicitação de Serviço com Campos Dinâmicos */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">Solicitar {selectedItem.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedItem.description}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              {/* Campos Dinâmicos do Item */}
              {selectedItem.fields_schema?.fields?.map((field) => (
                <div key={field.name}>
                  <label className="block text-slate-300 mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={formValues[field.name] || ''}
                      onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      required={field.required}
                    >
                      <option value="">Selecione uma opção...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formValues[field.name] || ''}
                      onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      rows={2}
                      className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white resize-none"
                      required={field.required}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formValues[field.name] || ''}
                      onChange={(e) => setFormValues({ ...formValues, [field.name]: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                      required={field.required}
                    />
                  )}
                </div>
              ))}

              {/* Justificação de Negócio */}
              <div>
                <label className="block text-slate-300 mb-1">Justificação de Negócio *</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  placeholder="Explique a necessidade operacional deste pedido para validação..."
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white resize-none"
                  required
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-lg text-slate-400 text-[11px] space-y-1">
                <div>Prazo normal de entrega: {selectedItem.estimated_days} dias úteis</div>
                {selectedItem.requires_approval && (
                  <div className="text-amber-400">
                    * Este pedido será submetido a aprovação do seu gestor antes do encaminhamento técnico.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs"
                >
                  {submitting ? 'A submeter...' : 'Submeter Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Decisão de Aprovação */}
      {decisionApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Avaliação de Pedido de Serviço</h3>
            <div className="p-3 bg-slate-950 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-white">{decisionApproval.title}</div>
              <div className="text-slate-400">Requerente: {decisionApproval.requester_name}</div>
              <div className="text-slate-500 font-mono">{decisionApproval.ticket_number}</div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-300">Parecer / Notas da Decisão (Opcional)</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                rows={3}
                placeholder="Ex: Aprovado conforme orçamento previsto no projeto..."
                className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDecisionApproval(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white mr-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => handleDecideApproval('REJECTED')}
                className="px-4 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg"
              >
                Rejeitar
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => handleDecideApproval('APPROVED')}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
              >
                Aprovar Pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
