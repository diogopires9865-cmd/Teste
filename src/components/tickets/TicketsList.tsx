/**
 * SW Service Desk v1.0 - Lista e Fila de Atendimento de Tickets
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Ticket, TicketType, TicketStatus, ImpactLevel, UrgencyLevel, PriorityLevel } from '../../types';
import {
  Search,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle,
  Inbox,
  Sparkles,
  X,
  Filter,
} from 'lucide-react';

interface TicketsListProps {
  onSelectTicket: (ticketId: number) => void;
  onRefreshStats?: () => void;
}

export const TicketsList: React.FC<TicketsListProps> = ({ onSelectTicket, onRefreshStats }) => {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  // Modal Novo Ticket
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [aiClassifying, setAiClassifying] = useState<boolean>(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TicketType>('incident');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [impact, setImpact] = useState<ImpactLevel>('MEDIUM');
  const [urgency, setUrgency] = useState<UrgencyLevel>('MEDIUM');
  const [assetId, setAssetId] = useState<number | ''>('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter === 'open') {
        // Filtrar no cliente ou via query
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/v1/tickets?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error('Erro ao carregar tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [typeFilter, statusFilter, searchTerm, token]);

  // Carregar Categorias e Ativos para o Modal
  const loadModalData = async () => {
    try {
      const [catRes, astRes] = await Promise.all([
        fetch('/api/v1/admin/categories'),
        fetch('/api/v1/cmdb/assets', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      ]);
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.categories);
        if (d.categories.length > 0 && !categoryId) {
          setCategoryId(d.categories[0].id);
        }
      }
      if (astRes.ok) {
        const d = await astRes.json();
        setAssets(d.assets);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenModal = () => {
    loadModalData();
    setIsModalOpen(true);
  };

  // Classificação Inteligente por IA Privada
  const handleAiClassify = async () => {
    if (!title || !description) {
      alert('Por favor introduza o título e a descrição antes de solicitar a classificação da IA.');
      return;
    }

    setAiClassifying(true);
    setAiReasoning(null);
    try {
      const res = await fetch('/api/v1/ai/classify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title, description }),
      });

      if (res.ok) {
        const data = await res.json();
        setImpact(data.suggestedImpact);
        setUrgency(data.suggestedUrgency);
        setAiReasoning(`${data.confidenceReasoning} (Confirmação humana pendente)`);

        // Tentar encontrar categoria semelhante
        const matched = categories.find((c) =>
          c.name.toLowerCase().includes(data.categorySuggestion.toLowerCase())
        );
        if (matched) {
          setCategoryId(matched.id);
        }
      }
    } catch (err) {
      console.error('Erro na classificação por IA:', err);
    } finally {
      setAiClassifying(false);
    }
  };

  // Cálculo da Prioridade em Tempo Real
  const calculateLivePriority = (): PriorityLevel => {
    if (impact === 'CRITICAL' && urgency === 'CRITICAL') return 'P1_CRITICAL';
    if ((impact === 'CRITICAL' && urgency === 'HIGH') || (impact === 'HIGH' && urgency === 'CRITICAL')) return 'P1_CRITICAL';
    if ((impact === 'HIGH' && urgency === 'HIGH') || (impact === 'CRITICAL' && urgency === 'MEDIUM') || (impact === 'MEDIUM' && urgency === 'CRITICAL')) return 'P2_HIGH';
    if (impact === 'HIGH' || urgency === 'HIGH') return 'P2_HIGH';
    if (impact === 'MEDIUM' && urgency === 'MEDIUM') return 'P3_MEDIUM';
    if ((impact === 'MEDIUM' && urgency === 'LOW') || (impact === 'LOW' && urgency === 'MEDIUM')) return 'P3_MEDIUM';
    return 'P4_LOW';
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !categoryId) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          description,
          type,
          category_id: categoryId,
          impact,
          urgency,
          asset_id: assetId || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsModalOpen(false);
        setTitle('');
        setDescription('');
        setAiReasoning(null);
        await fetchTickets();
        if (onRefreshStats) onRefreshStats();
        onSelectTicket(data.id);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao criar ticket.');
      }
    } catch (err) {
      alert('Erro de comunicação.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtragem no cliente para o estado "open"
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'open') {
      return !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status);
    }
    return true;
  });

  // Métricas rápidas
  const totalOpen = tickets.filter((t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)).length;
  const criticalCount = tickets.filter((t) => t.priority === 'P1_CRITICAL' && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const breachedCount = tickets.filter((t) => t.sla_breached && !['RESOLVED', 'CLOSED'].includes(t.status)).length;

  const priorityBadges: Record<PriorityLevel, { label: string; style: string }> = {
    P1_CRITICAL: { label: 'P1 Crítico', style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    P2_HIGH: { label: 'P2 Alto', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    P3_MEDIUM: { label: 'P3 Médio', style: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    P4_LOW: { label: 'P4 Baixo', style: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  };

  const statusLabels: Record<TicketStatus, { label: string; dot: string }> = {
    NEW: { label: 'Novo', dot: 'bg-emerald-400' },
    ASSIGNED: { label: 'Atribuído', dot: 'bg-blue-400' },
    IN_PROGRESS: { label: 'Em Análise', dot: 'bg-indigo-400' },
    PENDING_USER: { label: 'Aguardando Utilizador', dot: 'bg-amber-400' },
    PENDING_VENDOR: { label: 'Aguardando Fornecedor', dot: 'bg-purple-400' },
    RESOLVED: { label: 'Resolvido', dot: 'bg-teal-400' },
    CLOSED: { label: 'Fechado', dot: 'bg-slate-500' },
    CANCELLED: { label: 'Cancelado', dot: 'bg-rose-500' },
  };

  return (
    <div className="space-y-6">
      {/* 1. Faixa de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tickets Abertos</span>
            <Inbox className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-semibold text-white font-mono tabular-nums mt-2">{totalOpen}</div>
          <div className="text-[11px] text-slate-400 mt-1">Em triagem e atendimento ativo</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Incidentes Críticos P1</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-semibold text-rose-400 font-mono tabular-nums mt-2">{criticalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">SLA estrito de 15m / 2h</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Violações de SLA</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-semibold text-amber-400 font-mono tabular-nums mt-2">{breachedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Requer intervenção de supervisão</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Conformidade ITIL</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-semibold text-emerald-400 font-mono tabular-nums mt-2">98.4%</div>
          <div className="text-[11px] text-slate-400 mt-1">Índice global de cumprimento</div>
        </div>
      </div>

      {/* 2. Barra de Controlos e Filtros */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Control - Tipo de Ticket */}
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'incident', label: 'Incidentes' },
              { id: 'service_request', label: 'Pedidos' },
              { id: 'problem', label: 'Problemas' },
              { id: 'change', label: 'Mudanças' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro de Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="open">Apenas Abertos / Em Curso</option>
            <option value="all">Todos os Estados (Inclui Fechados)</option>
            <option value="NEW">Novos</option>
            <option value="ASSIGNED">Atribuídos</option>
            <option value="IN_PROGRESS">Em Análise</option>
            <option value="RESOLVED">Resolvidos</option>
            <option value="CLOSED">Fechados</option>
          </select>
        </div>

        {/* Pesquisa e Botão Criar Ticket */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar código, assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Ticket</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela Principal de Tickets */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Assunto / Descrição</th>
                <th className="py-3 px-4">Requerente</th>
                <th className="py-3 px-4">Prioridade</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">SLA Resolução</th>
                <th className="py-3 px-4">Técnico</th>
                <th className="py-3 px-4 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    A carregar tickets da base de dados relacional...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Nenhum ticket encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const pBadge = priorityBadges[ticket.priority] || priorityBadges.P3_MEDIUM;
                  const sLabel = statusLabels[ticket.status] || { label: ticket.status, dot: 'bg-slate-400' };

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-blue-400 tabular-nums whitespace-nowrap">
                        {ticket.ticket_number}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-slate-200 group-hover:text-blue-300 transition-colors truncate">
                          {ticket.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {ticket.category_name || 'Geral'} {ticket.asset_tag ? `· ${ticket.asset_tag}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-200">{ticket.requester_name || 'Utilizador'}</div>
                        <div className="text-[11px] text-slate-400">{ticket.requester_email}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${pBadge.style}`}>
                          {pBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${sLabel.dot}`} />
                          <span className="text-slate-300 font-medium">{sLabel.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                        <span className={ticket.sla_breached ? 'text-rose-400 font-medium' : 'text-slate-400'}>
                          {ticket.sla_label || 'Em prazo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                        {ticket.assigned_to_name || (
                          <span className="text-slate-500 italic">Não atribuído</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums text-slate-400">
                        {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('pt-PT') : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal de Abertura de Novo Ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="text-base font-semibold text-white">Registo de Novo Ticket ITSM</h3>
                <p className="text-xs text-slate-400 mt-0.5">Alinhado com a matriz de impacto e SLA ITIL</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-5">
              {/* Tipo e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Tipo de Pedido</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TicketType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="incident">Incidente (Falha ou Interrupção)</option>
                    <option value="service_request">Pedido de Serviço (Solicitação Padrão)</option>
                    <option value="problem">Problema (Análise de Causa Raiz)</option>
                    <option value="change">Gestão de Mudança (Change Request)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Categoria do Catálogo</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Assunto Resumido</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Falha na conexão ao gateway VPN Lisboa"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Descrição com Assistência de IA */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">Descrição Detalhada do Problema</label>
                  <button
                    type="button"
                    onClick={handleAiClassify}
                    disabled={aiClassifying || !title || !description}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiClassifying ? 'IA a classificar...' : 'Classificar por IA'}</span>
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Descreva detalhadamente o sintoma, mensagens de erro observadas e o impacto na sua atividade..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
                {aiReasoning && (
                  <div className="mt-2 p-2.5 bg-blue-950/40 border border-blue-800/50 rounded-lg text-xs text-blue-300">
                    <span className="font-semibold">Recomendação da IA: </span>
                    {aiReasoning}
                  </div>
                )}
              </div>

              {/* Matriz de Impacto e Urgência */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-semibold text-slate-300">Cálculo Automático de Prioridade & SLA</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Impacto Organizacional</label>
                    <select
                      value={impact}
                      onChange={(e) => setImpact(e.target.value as ImpactLevel)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                    >
                      <option value="LOW">Baixo (1 utilizador sem paragem crítica)</option>
                      <option value="MEDIUM">Médio (Departamento afetado com contorno)</option>
                      <option value="HIGH">Alto (Serviço essencial degradado)</option>
                      <option value="CRITICAL">Crítico (Paragem geral de produção)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Urgência de Negócio</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-white"
                    >
                      <option value="LOW">Baixa (Pode aguardar ciclo normal)</option>
                      <option value="MEDIUM">Média (Atraso aceitável até 24h)</option>
                      <option value="HIGH">Alta (Necessidade de resposta no mesmo dia)</option>
                      <option value="CRITICAL">Crítica (Intervenção imediata requerida)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">Prioridade Calculada Automaticamente:</span>
                  <span className={`px-2 py-0.5 rounded font-medium border ${priorityBadges[calculateLivePriority()].style}`}>
                    {priorityBadges[calculateLivePriority()].label}
                  </span>
                </div>
              </div>

              {/* Equipamento Associado (CMDB) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Associar a Equipamento (CMDB - Opcional)</label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Nenhum equipamento associado</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_tag} - {a.name} ({a.model || a.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                >
                  {submitting ? 'A submeter...' : 'Criar Ticket no Sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
