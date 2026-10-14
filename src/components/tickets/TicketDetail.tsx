/**
 * SW Service Desk v1.0 - Detalhe do Ticket e Ciclo de Vida ITIL
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketHistoryItem,
  TicketStatus,
  ImpactLevel,
  UrgencyLevel,
  PriorityLevel,
} from '../../types';
import {
  ArrowLeft,
  Clock,
  User,
  Shield,
  MessageSquare,
  Lock,
  Paperclip,
  History,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Send,
  Upload,
  Download,
  File,
} from 'lucide-react';

interface TicketDetailProps {
  ticketId: number;
  onBack: () => void;
  onAssetClick?: (assetId: number) => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, onBack, onAssetClick }) => {
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [history, setHistory] = useState<TicketHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Comentários
  const [newComment, setNewComment] = useState<string>('');
  const [isInternalNote, setIsInternalNote] = useState<boolean>(false);
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);

  // Upload
  const [uploading, setUploading] = useState<boolean>(false);

  // Mudança de Estado e Resolução
  const [isResolveModalOpen, setIsResolveModalOpen] = useState<boolean>(false);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Mudança de Prioridade
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState<boolean>(false);
  const [newImpact, setNewImpact] = useState<ImpactLevel>('MEDIUM');
  const [newUrgency, setNewUrgency] = useState<UrgencyLevel>('MEDIUM');

  // Técnicos para Atribuição
  const [technicians, setTechnicians] = useState<any[]>([]);

  // IA Privada (Gemini 3.8 Flash)
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<any | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<any | null>(null);
  const [editableAiDraft, setEditableAiDraft] = useState<string>('');

  const fetchTicketDetail = async () => {
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
        setComments(data.comments);
        setAttachments(data.attachments);
        setHistory(data.history);
        setNewImpact(data.ticket.impact);
        setNewUrgency(data.ticket.urgency);
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await fetch('/api/v1/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTechnicians(data.users.filter((u: any) => ['admin', 'manager', 'technician'].includes(u.role)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTicketDetail();
    fetchTechnicians();
  }, [ticketId, token]);

  // Transição de Estado
  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (newStatus === 'RESOLVED') {
      setIsResolveModalOpen(true);
      return;
    }

    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchTicketDetail();
      }
    } catch (err) {
      alert('Erro ao atualizar estado.');
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolutionNotes.trim()) {
      alert('Por favor introduza as notas de resolução e diagnóstico.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'RESOLVED', resolution_notes: resolutionNotes }),
      });
      if (res.ok) {
        setIsResolveModalOpen(false);
        setResolutionNotes('');
        await fetchTicketDetail();
      }
    } catch (err) {
      alert('Erro ao resolver ticket.');
    }
  };

  // Atribuição de Técnico
  const handleAssign = async (assigneeId: number | null) => {
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ assigned_to_id: assigneeId }),
      });
      if (res.ok) {
        await fetchTicketDetail();
      }
    } catch (err) {
      alert('Erro ao atribuir ticket.');
    }
  };

  // Alteração de Prioridade e SLA
  const handleSavePriority = async () => {
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/priority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ impact: newImpact, urgency: newUrgency }),
      });
      if (res.ok) {
        setIsPriorityModalOpen(false);
        await fetchTicketDetail();
      }
    } catch (err) {
      alert('Erro ao atualizar prioridade.');
    }
  };

  // Enviar Comentário ou Nota Interna
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: newComment, is_internal: isInternalNote }),
      });

      if (res.ok) {
        setNewComment('');
        await fetchTicketDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao adicionar mensagem.');
      }
    } catch (err) {
      alert('Erro de envio.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Upload de Anexo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        await fetchTicketDetail();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro no envio do ficheiro.');
      }
    } catch (err) {
      alert('Erro de comunicação no upload.');
    } finally {
      setUploading(false);
    }
  };

  // IA: Resumo Executivo
  const handleAiSummarize = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/v1/ai/summarize/${ticketId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  // IA: Sugerir Resposta / Resolução
  const handleAiSuggestResponse = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/v1/ai/suggest-response/${ticketId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data);
        setEditableAiDraft(data.draftReply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  // Aplicar rascunho de IA (Human-in-the-Loop)
  const handleApplyAiDraft = (asInternal: boolean) => {
    if (!editableAiDraft) return;
    setNewComment(editableAiDraft);
    setIsInternalNote(asInternal);
    setAiSuggestion(null);
  };

  if (loading || !ticket) {
    return (
      <div className="py-20 text-center text-slate-400">
        A carregar histórico e ciclo de vida do ticket...
      </div>
    );
  }

  const isTechnicianOrAbove = user && ['technician', 'manager', 'admin'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* 1. Header do Ticket */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-blue-400 tabular-nums">
                {ticket.ticket_number}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs uppercase text-slate-400 font-semibold">{ticket.type}</span>
            </div>
            <h2 className="text-lg font-semibold text-white mt-0.5">{ticket.title}</h2>
          </div>
        </div>

        {/* Toolbar de Ações Técnicas */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mudança de Estado */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Estado:</span>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              disabled={!isTechnicianOrAbove && !['CLOSED'].includes(ticket.status)}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none"
            >
              <option value="NEW">Novo</option>
              <option value="ASSIGNED">Atribuído</option>
              <option value="IN_PROGRESS">Em Análise</option>
              <option value="PENDING_USER">Aguardando Utilizador (Pausa SLA)</option>
              <option value="PENDING_VENDOR">Aguardando Fornecedor</option>
              <option value="RESOLVED">Resolvido</option>
              <option value="CLOSED">Fechado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          {/* Atribuição de Técnico */}
          {isTechnicianOrAbove && (
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 px-2 font-medium">Técnico:</span>
              <select
                value={ticket.assigned_to_id || ''}
                onChange={(e) => handleAssign(e.target.value ? Number(e.target.value) : null)}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none"
              >
                <option value="">Não atribuído</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alterar Prioridade & SLA */}
          {isTechnicianOrAbove && (
            <button
              onClick={() => setIsPriorityModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              Ajustar Prioridade ({ticket.priority})
            </button>
          )}
        </div>
      </div>

      {/* 2. Layout em 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Coluna Esquerda: Descrição, Feed Dual de Mensagens, Anexos e Histórico */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descrição Original do Incidente */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium text-slate-200">{ticket.requester_name}</span>
                <span>({ticket.requester_email})</span>
              </div>
              <span className="font-mono tabular-nums">
                {ticket.created_at ? new Date(ticket.created_at).toLocaleString('pt-PT') : ''}
              </span>
            </div>
            <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
              {ticket.description}
            </div>

            {ticket.resolution_notes && (
              <div className="p-3 bg-teal-950/40 border border-teal-800/60 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>Notas Oficiais de Resolução e Causa Raiz:</span>
                </div>
                <div className="text-teal-200/90 whitespace-pre-line">{ticket.resolution_notes}</div>
              </div>
            )}
          </div>

          {/* Feed de Comunicação: Comentários Públicos vs Notas Internas */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Comunicação & Notas Técnicas ({comments.length})
              </h3>
              {isTechnicianOrAbove && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-slate-400">Modo de envio:</span>
                  <button
                    onClick={() => setIsInternalNote(false)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      !isInternalNote
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                  >
                    Resposta Pública
                  </button>
                  <button
                    onClick={() => setIsInternalNote(true)}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                      isInternalNote
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Nota Interna</span>
                  </button>
                </div>
              )}
            </div>

            {/* Lista de Mensagens */}
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Ainda não existem comentários ou notas registadas.
                </div>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      comment.is_internal
                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-100'
                        : 'bg-slate-950/70 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{comment.user_name}</span>
                        {comment.is_internal ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-medium flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Nota Interna Confidencial</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">· Resposta Pública</span>
                        )}
                      </div>
                      <span className="text-slate-500 font-mono tabular-nums">
                        {comment.created_at ? new Date(comment.created_at).toLocaleString('pt-PT') : ''}
                      </span>
                    </div>
                    <div className="whitespace-pre-line leading-relaxed text-slate-300">
                      {comment.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Caixa de Entrada de Mensagem */}
            <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-800 space-y-2">
              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder={
                    isInternalNote
                      ? 'Escrever nota interna confidencial (visível apenas para a equipa técnica)...'
                      : 'Escrever resposta pública para o colaborador...'
                  }
                  className={`w-full p-3 rounded-lg text-xs text-white focus:outline-none resize-none transition-colors ${
                    isInternalNote
                      ? 'bg-amber-950/15 border border-amber-800/60 focus:border-amber-500'
                      : 'bg-slate-950 border border-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  {isInternalNote ? (
                    <span className="text-amber-400/90 font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      O utilizador não verá esta nota.
                    </span>
                  ) : (
                    <span>Mensagem visível para o requerente no portal.</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                    isInternalNote ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isInternalNote ? 'Gravar Nota Interna' : 'Enviar Resposta'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Anexos de Ficheiro Protegidos */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-blue-400" />
                <span>Anexos do Incidente ({attachments.length})</span>
              </h3>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'A enviar...' : 'Anexar Ficheiro'}</span>
                <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              </label>
            </div>

            {attachments.length === 0 ? (
              <div className="text-xs text-slate-500 italic">Nenhum anexo adicionado.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <File className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-slate-200 truncate">{att.file_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                          {Math.round(att.file_size_bytes / 1024)} KB · {att.uploader_name}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`/api/v1/tickets/${ticket.id}/attachments/${att.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-900 rounded"
                      title="Descarregar ficheiro"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico Imutável de Auditoria */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              <span>Histórico de Auditoria & Ciclo de Vida</span>
            </h3>
            <div className="space-y-2 border-l border-slate-800 pl-4 text-xs">
              {history.map((h) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-500" />
                  <div className="text-slate-300 font-medium">
                    {h.user_name} · <span className="text-blue-400 font-mono text-[11px]">{h.action_type}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">{h.comment || `Alterado para ${h.new_value}`}</div>
                  <div className="text-slate-600 text-[10px] font-mono tabular-nums">
                    {h.created_at ? new Date(h.created_at).toLocaleString('pt-PT') : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna Direita: SLA, Equipamento CMDB & Assistente de IA Privada */}
        <div className="space-y-6">
          {/* Card de IA Privada (Gemini 3.8 Flash) */}
          {isTechnicianOrAbove && (
            <div className="p-5 bg-gradient-to-b from-blue-950/40 to-slate-900 border border-blue-800/40 rounded-xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-white">IA Privada para Técnicos</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                  Gemini 3.8
                </span>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                Apoio na classificação, resumo de conversas e sugestões técnicas.
                <span className="block text-slate-300 font-medium mt-1">
                  * Confirmação humana obrigatória para qualquer ação.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleAiSummarize}
                  disabled={aiLoading}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
                >
                  Resumir Ticket
                </button>
                <button
                  onClick={handleAiSuggestResponse}
                  disabled={aiLoading}
                  className="px-3 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Sugerir Solução
                </button>
              </div>

              {/* Resultado do Resumo */}
              {aiSummary && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2 mt-2">
                  <div className="font-semibold text-blue-300">Resumo Executivo:</div>
                  <div className="text-slate-300 leading-relaxed">{aiSummary.executiveSummary}</div>
                  {aiSummary.suggestedNextSteps?.length > 0 && (
                    <div>
                      <div className="font-medium text-slate-400 text-[11px] mt-1">Passos Recomendados:</div>
                      <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5 mt-0.5">
                        {aiSummary.suggestedNextSteps.map((step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado da Sugestão com Human-in-the-Loop */}
              {aiSuggestion && (
                <div className="p-3 bg-slate-950 border border-blue-900/60 rounded-lg text-xs space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-300">Rascunho Sugerido:</span>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded">Revisão Humana</span>
                  </div>

                  <textarea
                    value={editableAiDraft}
                    onChange={(e) => setEditableAiDraft(e.target.value)}
                    rows={4}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 resize-none focus:outline-none"
                  />

                  {aiSuggestion.diagnosticCommands?.length > 0 && (
                    <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-emerald-400 space-y-1">
                      <div className="text-slate-500 text-[9px] uppercase">Comandos de Diagnóstico Sugeridos:</div>
                      {aiSuggestion.diagnosticCommands.map((cmd: string, i: number) => (
                        <div key={i}>$ {cmd}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={() => handleApplyAiDraft(false)}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                    >
                      Aplicar como Resposta ao Colaborador
                    </button>
                    <button
                      onClick={() => handleApplyAiDraft(true)}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium rounded transition-colors"
                    >
                      Guardar como Nota Interna
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dados do SLA & Prazos */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Nível de Serviço (SLA)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Prioridade ITIL:</span>
                <span className="font-semibold text-slate-200">{ticket.priority}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Impacto:</span>
                <span className="text-slate-300">{ticket.impact}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Urgência:</span>
                <span className="text-slate-300">{ticket.urgency}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Limite de Resolução:</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {ticket.sla_resolution_due
                    ? new Date(ticket.sla_resolution_due).toLocaleString('pt-PT')
                    : 'Sem SLA'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Estado do Prazo:</span>
                <span className={ticket.sla_breached ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-medium'}>
                  {ticket.sla_label}
                </span>
              </div>
            </div>
          </div>

          {/* Equipamento Associado (CMDB) */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-blue-400" />
              <span>Equipamento Vinculado (CMDB)</span>
            </h3>

            {ticket.asset_id ? (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-blue-400">{ticket.asset_tag}</span>
                  <span className="text-[10px] text-slate-400">{ticket.asset_model}</span>
                </div>
                <div className="font-medium text-slate-200">{ticket.asset_name}</div>
                {ticket.asset_serial && (
                  <div className="text-[11px] text-slate-500 font-mono">S/N: {ticket.asset_serial}</div>
                )}
                {onAssetClick && (
                  <button
                    onClick={() => onAssetClick(ticket.asset_id!)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium underline mt-1"
                  >
                    Ver Ficha de Inventário & Histórico &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">
                Nenhum equipamento associado a este incidente.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Resolução de Incidente */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Registo de Resolução do Incidente</h3>
            <p className="text-xs text-slate-400">
              Descreva detalhadamente a causa raiz identificada e as ações corretivas efetuadas.
            </p>

            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="Ex: Atualização de driver OEM e redefinição de perfil..."
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
              required
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResolution}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg"
              >
                Confirmar Resolução
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Prioridade */}
      {isPriorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Ajustar Impacto, Urgência e SLA</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Impacto Organizacional</label>
                <select
                  value={newImpact}
                  onChange={(e) => setNewImpact(e.target.value as ImpactLevel)}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="LOW">Baixo</option>
                  <option value="MEDIUM">Médio</option>
                  <option value="HIGH">Alto</option>
                  <option value="CRITICAL">Crítico</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Urgência de Atendimento</label>
                <select
                  value={newUrgency}
                  onChange={(e) => setNewUrgency(e.target.value as UrgencyLevel)}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Crítica</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setIsPriorityModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePriority}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                Recalcular SLA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
