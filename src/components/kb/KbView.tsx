/**
 * SW Service Desk v1.0 - Base de Conhecimento (KB)
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { KbArticle } from '../../types';
import {
  FileText,
  Search,
  Plus,
  ThumbsUp,
  Eye,
  BookOpen,
  X,
  Share2,
  Check,
} from 'lucide-react';

export const KbView: React.FC = () => {
  const { token, user } = useAuth();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  // Modal Criar Artigo
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [publishing, setPublishing] = useState<boolean>(false);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const res = await fetch(`/api/v1/kb/articles?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setArticles(d.articles);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/v1/admin/categories');
      if (res.ok) {
        const d = await res.json();
        setCategories(d.categories);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [search, token]);

  const openArticle = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/kb/articles/${id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedArticle(d.article);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVote = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/kb/articles/${id}/vote`, { method: 'POST' });
      if (res.ok) {
        if (selectedArticle) {
          setSelectedArticle({
            ...selectedArticle,
            helpful_votes: selectedArticle.helpful_votes + 1,
          });
        }
        await fetchArticles();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setPublishing(true);
    try {
      const res = await fetch('/api/v1/kb/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          summary,
          content,
          category_id: categoryId,
          is_public: isPublic,
        }),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setTitle('');
        setSummary('');
        setContent('');
        await fetchArticles();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao publicar artigo.');
      }
    } catch {
      alert('Erro de comunicação.');
    } finally {
      setPublishing(false);
    }
  };

  const isTechnicianOrAbove = user && ['technician', 'manager', 'admin'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* 1. Header & Pesquisa */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Base de Conhecimento (Knowledge Base)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manuais técnicos, procedimentos operacionais padrão e guias de autoajuda
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar guias, VPN, drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {isTechnicianOrAbove && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar Artigo</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Grelha de Artigos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500">
            A carregar base de conhecimento...
          </div>
        ) : articles.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500">
            Nenhum artigo encontrado para a pesquisa.
          </div>
        ) : (
          articles.map((art) => (
            <div
              key={art.id}
              onClick={() => openArticle(art.id)}
              className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-blue-400 font-medium">{art.category_name || 'Procedimentos'}</span>
                  <span>{art.is_public ? 'Público' : 'Apenas Técnicos'}</span>
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                  {art.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {art.summary || art.content.slice(0, 150)}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{art.views_count}</span>
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{art.helpful_votes}</span>
                  </span>
                </div>
                <span>{art.author_name || 'Service Desk'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Modal de Leitura de Artigo */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs text-blue-400 font-medium">{selectedArticle.category_name}</span>
                <h3 className="text-base font-semibold text-white mt-0.5">{selectedArticle.title}</h3>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                  Por {selectedArticle.author_name} · {selectedArticle.views_count} visualizações
                </div>
              </div>

              <button onClick={() => setSelectedArticle(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Markdown / Texto */}
            <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed max-h-[450px] overflow-y-auto pr-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {selectedArticle.content}
            </div>

            {/* Votação de Utilidade */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">Este artigo ajudou a resolver o problema?</span>
              <button
                onClick={() => handleVote(selectedArticle.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium rounded-lg border border-emerald-500/30 transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Sim, foi útil ({selectedArticle.helpful_votes})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Publicar Novo Artigo */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">Publicar Novo Artigo na Base de Conhecimento</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArticle} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Título do Artigo *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Como configurar a assinatura de email no Outlook corporativo"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Visibilidade</label>
                  <select
                    value={isPublic ? 'true' : 'false'}
                    onChange={(e) => setIsPublic(e.target.value === 'true')}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="true">Público (Todos os Colaboradores)</option>
                    <option value="false">Interno (Apenas Técnicos ITSM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Resumo Rápido</label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Breve sumário para visualização nos resultados de pesquisa..."
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Conteúdo do Artigo (Markdown) *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  placeholder="Instruções passo a passo, notas de diagnóstico e comandos..."
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded text-xs text-white font-mono resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs"
                >
                  {publishing ? 'A publicar...' : 'Publicar Artigo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
