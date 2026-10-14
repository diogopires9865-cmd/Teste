/**
 * SW Service Desk v1.0 - Sidebar de Navegação
 * Organização: SW Cloud Solutions
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Inbox,
  Server,
  Layers,
  FileText,
  ShieldAlert,
  Database,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  openTicketsCount?: number;
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  openTicketsCount = 0,
  pendingApprovalsCount = 0,
}) => {
  const { user } = useAuth();

  const navItems = [
    {
      id: 'tickets',
      label: 'Fila de Tickets',
      icon: Inbox,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-400',
    },
    {
      id: 'cmdb',
      label: 'CMDB & Ativos',
      icon: Server,
    },
    {
      id: 'catalog',
      label: 'Catálogo de Serviços',
      icon: Layers,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} pend.` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400',
    },
    {
      id: 'kb',
      label: 'Base de Conhecimento',
      icon: FileText,
    },
    {
      id: 'admin',
      label: 'Auditoria & Segurança',
      icon: ShieldAlert,
      restricted: ['user', 'technician'], // Apenas manager ou admin
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div className="p-4 space-y-6">
        {/* Secção de Navegação Principal */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
            Módulos ITSM
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              if (item.restricted && user && item.restricted.includes(user.role)) {
                return null;
              }

              const isActive = currentView === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Resumo do SLA & Normas */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-slate-400 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-slate-300">
            <span>Matriz de SLAs ITIL</span>
            <span className="text-[10px] text-emerald-400 font-mono">ATIVO</span>
          </div>
          <div className="space-y-1 text-[10px] text-slate-400">
            <div className="flex justify-between">
              <span className="text-rose-400">P1 Crítico:</span>
              <span className="font-mono tabular-nums">15m / 2h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-400">P2 Alto:</span>
              <span className="font-mono tabular-nums">1h / 8h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">P3 Médio:</span>
              <span className="font-mono tabular-nums">4h / 24h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé da Barra Lateral */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/80">
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="flex flex-col truncate">
            <span className="font-medium text-slate-300 truncate">MySQL Relational ACID</span>
            <span className="text-[10px] text-slate-500 truncate">Fonte de Verdade Transacional</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
