/**
 * SW Service Desk v1.0 - Top Bar Contract
 * Zone 1: Brand wordmark | Zone 2: Breadcrumb trail | Zone 3: Profile & Quick Switcher
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ASSETS } from '../../assets';
import { ShieldCheck, LogOut, Laptop, CheckCircle2 } from 'lucide-react';
import { UserRole } from '../../types';

interface HeaderProps {
  currentView: string;
  ticketBreadcrumb?: string | null;
  onClearTicketBreadcrumb?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, ticketBreadcrumb, onClearTicketBreadcrumb }) => {
  const { user, logout, quickSwitchRole } = useAuth();

  const roleLabels: Record<UserRole, { label: string; badge: string }> = {
    admin: { label: 'Administrador (CISO)', badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
    manager: { label: 'Gestora Service Desk', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    technician: { label: 'Técnico Sénior L2', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    user: { label: 'Colaborador (End-User)', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  };

  const getAvatarForRole = (role?: UserRole) => {
    if (role === 'admin') return ASSETS.avatarAdmin;
    if (role === 'manager') return ASSETS.avatarManager;
    return ASSETS.avatarTechnician;
  };

  const viewTitles: Record<string, string> = {
    tickets: 'Fila de Atendimento & Incidentes',
    cmdb: 'CMDB & Inventário de Ativos',
    catalog: 'Catálogo de Serviços & Pedidos',
    kb: 'Base de Conhecimento Corporativa',
    admin: 'Auditoria, Segurança & Produção',
  };

  return (
    <header className="h-16 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-8 shrink-0 z-30">
      {/* Zona 1: Marca Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <img
            src={ASSETS.logo}
            alt="SW Cloud Logo"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
            SW Service Desk <span className="text-blue-400 font-mono text-xs font-normal">v1.0</span>
          </span>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">SW Cloud Solutions</span>
        </div>
      </div>

      {/* Zona 2: Breadcrumb / Trilha Contextual */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 truncate">
        <span>ITSM</span>
        <span aria-hidden="true" className="text-slate-600">/</span>
        <span className="text-slate-300 font-medium">{viewTitles[currentView] || currentView}</span>
        {ticketBreadcrumb && (
          <>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <button
              onClick={onClearTicketBreadcrumb}
              className="text-blue-400 hover:text-blue-300 font-mono underline"
            >
              {ticketBreadcrumb}
            </button>
          </>
        )}
      </div>

      {/* Zona 3: Ação Primária & Seletor de Perfil RBAC */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Seletor Rápido de Papéis para Validação de Testes */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
          <span className="text-[11px] text-slate-400 px-2 font-medium">Testar Perfil:</span>
          {(['admin', 'manager', 'technician', 'user'] as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => quickSwitchRole(r)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                user?.role === r
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              {r === 'admin' ? 'Admin' : r === 'manager' ? 'Gestor' : r === 'technician' ? 'Técnico' : 'Colaborador'}
            </button>
          ))}
        </div>

        {/* Perfil Ativo */}
        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
              <img
                src={getAvatarForRole(user.role)}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-medium text-slate-200 truncate max-w-[130px]">{user.name}</span>
              <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{roleLabels[user.role].label}</span>
            </div>
            <button
              onClick={logout}
              title="Terminar Sessão"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
