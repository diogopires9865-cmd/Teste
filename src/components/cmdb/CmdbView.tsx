/**
 * SW Service Desk v1.0 - CMDB & Gestão de Ativos de TI
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CmdbAsset,
  AssetType,
  AssetStatus,
  AssetHistoryItem,
  SoftwareLicense,
} from '../../types';
import {
  Server,
  Laptop,
  Plus,
  Search,
  UserCheck,
  UserX,
  History,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  X,
  ExternalLink,
  Layers,
  Cpu,
} from 'lucide-react';

interface CmdbViewProps {
  onSelectTicket?: (ticketId: number) => void;
  selectedAssetId?: number | null;
  onClearSelectedAsset?: () => void;
}

export const CmdbView: React.FC<CmdbViewProps> = ({
  onSelectTicket,
  selectedAssetId,
  onClearSelectedAsset,
}) => {
  const { token, user } = useAuth();
  const [assets, setAssets] = useState<CmdbAsset[]>([]);
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'licenses'>('inventory');

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal Novo Equipamento
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('LAPTOP');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [location, setLocation] = useState('');
  const [specs, setSpecs] = useState('{"cpu": "Intel i7", "ram": "32GB", "storage": "512GB SSD"}');
  const [creating, setCreating] = useState(false);

  // Drawer / Detalhes de Ativo Selecionado
  const [detailedAsset, setDetailedAsset] = useState<CmdbAsset | null>(null);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryItem[]>([]);
  const [assetSoftware, setAssetSoftware] = useState<any[]>([]);
  const [assetTickets, setAssetTickets] = useState<any[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Ações de Custódia
  const [usersList, setUsersList] = useState<any[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState<number | ''>('');
  const [assignmentNotes, setAssignmentNotes] = useState<string>('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (search) params.append('search', search);

      const res = await fetch(`/api/v1/cmdb/assets?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      const res = await fetch('/api/v1/cmdb/licenses', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setLicenses(d.licenses);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchLicenses();
    fetchUsers();
  }, [statusFilter, typeFilter, search, token]);

  const openAssetDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/cmdb/assets/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setDetailedAsset(d.asset);
        setAssetHistory(d.history);
        setAssetSoftware(d.software);
        setAssetTickets(d.tickets);
        setIsDetailOpen(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedAssetId) {
      openAssetDetails(selectedAssetId);
    }
  }, [selectedAssetId]);

  // Criação de Equipamento
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetTag || !name || !type) return;

    setCreating(true);
    try {
      const res = await fetch('/api/v1/cmdb/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          asset_tag: assetTag,
          serial_number: serialNumber,
          name,
          type,
          model,
          manufacturer,
          location,
          specs,
        }),
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setAssetTag('');
        setSerialNumber('');
        setName('');
        setModel('');
        await fetchAssets();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao criar equipamento.');
      }
    } catch {
      alert('Erro de comunicação.');
    } finally {
      setCreating(false);
    }
  };

  // Atribuição de Utilizador
  const handleAssignUser = async () => {
    if (!detailedAsset) return;

    try {
      const res = await fetch(`/api/v1/cmdb/assets/${detailedAsset.id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: assigneeUserId || null,
          notes: assignmentNotes || undefined,
        }),
      });

      if (res.ok) {
        setIsAssignModalOpen(false);
        setAssignmentNotes('');
        await openAssetDetails(detailedAsset.id);
        await fetchAssets();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro na atribuição.');
      }
    } catch {
      alert('Erro ao atribuir.');
    }
  };

  // Retirar de Serviço (RETIRED)
  const handleRetireAsset = async () => {
    if (!detailedAsset) return;
    if (
      !confirm(
        `Tem a certeza de que pretende abater o equipamento ${detailedAsset.asset_tag}? Esta ação libertará todas as licenças de software e desassociará utilizadores.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/cmdb/assets/${detailedAsset.id}/retire`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ notes: 'Abatido através da consola do CMDB.' }),
      });

      if (res.ok) {
        await openAssetDetails(detailedAsset.id);
        await fetchAssets();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao abater equipamento.');
      }
    } catch {
      alert('Erro ao abater ativo.');
    }
  };

  const statusBadges: Record<AssetStatus, { label: string; style: string }> = {
    IN_STOCK: { label: 'Em Stock TI', style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    ASSIGNED: { label: 'Atribuído', style: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    MAINTENANCE: { label: 'Em Manutenção', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    RETIRED: { label: 'Abatido / Retirado', style: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  };

  const isTechnicianOrAbove = user && ['technician', 'manager', 'admin'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* 1. Header & Seletor de Separador */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Base de Dados de Gestão de Configurações (CMDB)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inventário de hardware, estações de trabalho, histórico de custódia e licenças corporativas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                activeTab === 'inventory' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Inventário de Hardware
            </button>
            <button
              onClick={() => setActiveTab('licenses')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                activeTab === 'licenses' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Licenças de Software ({licenses.length})
            </button>
          </div>

          {isTechnicianOrAbove && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Registar Equipamento</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* 2. Filtros e Pesquisa */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">Todos os Tipos de Ativo</option>
                <option value="LAPTOP">Portáteis (Laptops)</option>
                <option value="DESKTOP">Desktops & Workstations</option>
                <option value="SERVER">Servidores & VMs</option>
                <option value="NETWORK">Dispositivos de Rede</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
              >
                <option value="all">Todos os Estados</option>
                <option value="IN_STOCK">Em Stock TI</option>
                <option value="ASSIGNED">Atribuídos a Colaboradores</option>
                <option value="MAINTENANCE">Em Reparação / Manutenção</option>
                <option value="RETIRED">Abatidos / Descontinuados</option>
              </select>
            </div>

            <div className="relative md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar Tag, Série, Modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 3. Tabela de Ativos */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                  <tr>
                    <th className="py-3 px-4">Tag de Ativo</th>
                    <th className="py-3 px-4">Nome & Modelo</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Utilizador Atribuído</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Localização</th>
                    <th className="py-3 px-4 text-right">Tickets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        A carregar dados do CMDB...
                      </td>
                    </tr>
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Nenhum equipamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const badge = statusBadges[asset.status] || statusBadges.IN_STOCK;

                      return (
                        <tr
                          key={asset.id}
                          onClick={() => openAssetDetails(asset.id)}
                          className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-blue-400 whitespace-nowrap">
                            {asset.asset_tag}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-slate-200 group-hover:text-blue-300 transition-colors truncate">
                              {asset.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                              {asset.manufacturer} · {asset.model || 'Padrão'} {asset.serial_number ? `· S/N: ${asset.serial_number}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400">{asset.type}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {asset.assigned_user_name ? (
                              <div>
                                <span className="text-slate-200 font-medium">{asset.assigned_user_name}</span>
                                <span className="block text-[10px] text-slate-500">{asset.department_name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Disponível em Stock</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badge.style}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                            {asset.location || 'Lisboa - Edifício Central'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                            {asset.tickets_count || 0}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Separador de Licenças de Software */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Gestão de Licenças de Software Corporativas
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Alocação automática e devolução ao pool em caso de abate de equipamentos
              </p>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Software</th>
                <th className="py-3 px-4">Fabricante</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Lugares Ocupados</th>
                <th className="py-3 px-4">Disponíveis</th>
                <th className="py-3 px-4 text-right">Validade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {licenses.map((lic) => {
                const available = lic.total_seats - lic.seats_used;
                const percent = Math.round((lic.seats_used / lic.total_seats) * 100);

                return (
                  <tr key={lic.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-white">{lic.software_name}</td>
                    <td className="py-3 px-4 text-slate-400">{lic.publisher}</td>
                    <td className="py-3 px-4 text-slate-400">{lic.license_type}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <div className="flex items-center gap-2">
                        <span>
                          {lic.seats_used} / {lic.total_seats}
                        </span>
                        <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${percent > 90 ? 'bg-rose-500' : 'bg-blue-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-emerald-400 font-semibold">
                      {available} livres
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                      {lic.expiration_date || 'Perpétua'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Drawer de Detalhe do Ativo CMDB */}
      {isDetailOpen && detailedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 space-y-6 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold text-blue-400">
                    {detailedAsset.asset_tag}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${statusBadges[detailedAsset.status].style}`}>
                    {statusBadges[detailedAsset.status].label}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mt-1">{detailedAsset.name}</h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  {detailedAsset.manufacturer} · {detailedAsset.model} · S/N: {detailedAsset.serial_number || 'N/A'}
                </div>
              </div>

              <button
                onClick={() => {
                  setIsDetailOpen(false);
                  if (onClearSelectedAsset) onClearSelectedAsset();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ações de Gestão de Custódia */}
            {isTechnicianOrAbove && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    setAssigneeUserId(detailedAsset.assigned_user_id || '');
                    setIsAssignModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{detailedAsset.assigned_user_id ? 'Transferir Utilizador' : 'Atribuir a Colaborador'}</span>
                </button>

                {detailedAsset.status !== 'RETIRED' && (
                  <button
                    onClick={handleRetireAsset}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Retirar de Serviço (Abater Ativo)</span>
                  </button>
                )}
              </div>
            )}

            {/* Abas de Detalhes: Histórico, Software, Incidentes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Especificações de Hardware */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  <span>Especificações Técnicas</span>
                </div>
                <div className="space-y-1 text-slate-400">
                  <div>Localização: {detailedAsset.location || 'Datacenter / Sede'}</div>
                  <div>Aquisição: {detailedAsset.purchase_date || '2024'}</div>
                  <div>Garantia: {detailedAsset.warranty_expiration || '2027'}</div>
                  <pre className="p-2 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto mt-2">
                    {typeof detailedAsset.specs === 'object'
                      ? JSON.stringify(detailedAsset.specs, null, 2)
                      : detailedAsset.specs || 'Nenhuma especificação gravada'}
                  </pre>
                </div>
              </div>

              {/* Utilizador Atual */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Custodiante Atual</span>
                </div>
                {detailedAsset.assigned_user_name ? (
                  <div className="space-y-1 text-slate-300">
                    <div className="font-medium text-white">{detailedAsset.assigned_user_name}</div>
                    <div className="text-slate-400">{detailedAsset.assigned_user_email}</div>
                    <div className="text-slate-500">{detailedAsset.department_name}</div>
                  </div>
                ) : (
                  <div className="text-slate-500 italic py-4">Equipamento sem utilizador atribuído (Em Stock).</div>
                )}
              </div>
            </div>

            {/* Software Instalado */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Software Instalado & Licenças Associadas ({assetSoftware.length})</span>
              </div>
              {assetSoftware.length === 0 ? (
                <div className="text-slate-500 text-xs italic">Nenhum software corporativo associado.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {assetSoftware.map((s) => (
                    <div key={s.link_id} className="p-2 bg-slate-900 rounded border border-slate-800">
                      <div className="font-medium text-white">{s.software_name}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.publisher} · Versão: {s.installed_version || 'Homologada'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Histórico Completo de Custódia */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
                <History className="w-4 h-4 text-slate-400" />
                <span>Histórico de Movimentações & Custódia ({assetHistory.length})</span>
              </div>
              <div className="space-y-2 border-l border-slate-800 pl-4 text-xs">
                {assetHistory.map((h) => (
                  <div key={h.id} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-500" />
                    <div className="text-slate-200 font-medium">
                      {h.action} · por {h.actor_name}
                    </div>
                    {h.new_user_name && (
                      <div className="text-slate-300 text-[11px]">Novo Utilizador: {h.new_user_name}</div>
                    )}
                    <div className="text-slate-500 text-[11px]">{h.notes}</div>
                    <div className="text-slate-600 text-[10px] font-mono tabular-nums">
                      {new Date(h.created_at).toLocaleString('pt-PT')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Incidentes Vinculados */}
            {assetTickets.length > 0 && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-slate-300">Incidentes Registados para este Equipamento</div>
                <div className="space-y-1">
                  {assetTickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setIsDetailOpen(false);
                        if (onSelectTicket) onSelectTicket(t.id);
                      }}
                      className="p-2 bg-slate-900 rounded hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-blue-400 font-medium">{t.ticket_number}</span>
                        <span className="text-slate-200">{t.title}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Atribuição de Utilizador */}
      {isAssignModalOpen && detailedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Atribuir / Transferir Equipamento</h3>
            <p className="text-xs text-slate-400">
              Equipamento: <span className="text-blue-400 font-mono">{detailedAsset.asset_tag}</span> ({detailedAsset.name})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Selecionar Utilizador Responsável</label>
                <select
                  value={assigneeUserId}
                  onChange={(e) => setAssigneeUserId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                >
                  <option value="">Sem atribuição (Devolver ao Stock)</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Justificação / Notas de Entrega</label>
                <input
                  type="text"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Ex: Entrega de computador para novas funções..."
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                Confirmar Atribuição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Equipamento */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 my-8">
            <h3 className="text-base font-semibold text-white">Registo de Novo Equipamento no CMDB</h3>

            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Tag de Ativo (Asset Tag) *</label>
                  <input
                    type="text"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    placeholder="Ex: SW-NB-004"
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Número de Série (S/N)</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Ex: PF3894AB"
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Designação do Equipamento *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Dell Latitude 7440 Ultrabook"
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Tipo de Ativo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AssetType)}
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="LAPTOP">Portátil (Laptop)</option>
                    <option value="DESKTOP">Desktop</option>
                    <option value="SERVER">Servidor</option>
                    <option value="NETWORK">Dispositivo de Rede</option>
                    <option value="PRINTER">Impressora</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Fabricante</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="Ex: Apple / Dell / HP"
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: Latitude 7440"
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Localização</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex: Lisboa - Edifício Central"
                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                >
                  {creating ? 'A registar...' : 'Gravar no Inventário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
