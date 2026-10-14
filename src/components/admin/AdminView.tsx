/**
 * SW Service Desk v1.0 - Painel de Administração, Auditoria e Segurança
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuditLog, User } from '../../types';
import {
  ShieldAlert,
  Database,
  Lock,
  Users,
  HardDrive,
  Activity,
  Search,
  Key,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { token, user, toggle2FA } = useAuth();
  const [activeTab, setActiveTab] = useState<'audit' | 'security' | 'users' | 'backups' | 'health'>('audit');

  // Logs de Auditoria
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logSearch, setLogSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Utilizadores & RBAC
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Sessões
  const [sessions, setSessions] = useState<any[]>([]);

  // Backup Test
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupResult, setBackupResult] = useState<any | null>(null);

  // Health Check
  const [healthData, setHealthData] = useState<any | null>(null);

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logSearch) params.append('search', logSearch);

      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsersAndDepts = async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        fetch('/api/v1/admin/users', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        fetch('/api/v1/admin/departments'),
      ]);
      if (uRes.ok) {
        const d = await uRes.json();
        setUsers(d.users);
      }
      if (dRes.ok) {
        const d = await dRes.json();
        setDepartments(d.departments);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v1/auth/sessions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setSessions(d.sessions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const d = await res.json();
        setHealthData(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'users') fetchUsersAndDepts();
    if (activeTab === 'security') fetchSessions();
    if (activeTab === 'health') fetchHealth();
  }, [activeTab, logSearch, token]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Deseja revogar esta sessão ativa?')) return;
    try {
      const res = await fetch(`/api/v1/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        await fetchSessions();
      }
    } catch (e) {
      alert('Erro ao revogar sessão.');
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        await fetchUsersAndDepts();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao alterar perfil.');
      }
    } catch (e) {
      alert('Erro de comunicação.');
    }
  };

  const handleRunBackupTest = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const res = await fetch('/api/v1/admin/backup/test', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const d = await res.json();
        setBackupResult(d);
      } else {
        const err = await res.json();
        alert(err.error || 'Falha ao executar teste de backup.');
      }
    } catch {
      alert('Erro ao executar backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header do Painel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Consola de Administração & Segurança</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Trilhas de auditoria imutáveis, controlo RBAC, sessões ativas e procedimentos de cópia de segurança
          </p>
        </div>

        {/* Separadores de Submódulos */}
        <div className="flex flex-wrap items-center p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'audit', label: 'Auditoria' },
            { id: 'security', label: 'Segurança & Sessões' },
            { id: 'users', label: 'Gestão RBAC' },
            { id: 'backups', label: 'Backups & DR' },
            { id: 'health', label: 'Health & Produção' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Submódulo: Trilhas de Auditoria (Audit Logs) */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar utilizador, ação, entidade..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar Registos</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Utilizador</th>
                  <th className="py-3 px-4">Ação de Auditoria</th>
                  <th className="py-3 px-4">Entidade Afetada</th>
                  <th className="py-3 px-4">Endereço IP</th>
                  <th className="py-3 px-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Nenhum registo de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pt-PT')}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{log.user_name || 'Sistema / Anónimo'}</td>
                      <td className="py-3 px-4 font-mono text-blue-400">{log.action}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                        {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                      <td className="py-3 px-4 text-right">
                        {log.details ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-400 hover:text-blue-300 font-mono text-[11px] underline"
                          >
                            Ver Payload
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Submódulo: Segurança & Sessões Ativas */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Configuração de 2FA */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-400" />
                  <span>Autenticação de Dois Fatores (2FA / TOTP)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Protege o acesso à sua conta com códigos temporários compatíveis com Google e Microsoft Authenticator.
                </p>
              </div>

              <button
                onClick={async () => {
                  const res = await toggle2FA(!user?.two_factor_enabled);
                  if (res.secret) {
                    alert(`2FA Ativado! Código secreto de backup: ${res.secret}`);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  user?.two_factor_enabled
                    ? 'bg-rose-600/80 hover:bg-rose-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {user?.two_factor_enabled ? 'Desativar 2FA' : 'Ativar 2FA Agora'}
              </button>
            </div>
          </div>

          {/* Lista de Sessões Ativas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Sessões Ativas Registadas na Base de Dados ({sessions.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Permite a revogação instantânea de sessões remotas comprometidas
                </p>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Dispositivo / User Agent</th>
                  <th className="py-3 px-4">Endereço IP</th>
                  <th className="py-3 px-4">Início da Sessão</th>
                  <th className="py-3 px-4">Expiração</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 max-w-sm truncate text-white">
                      {s.user_agent}
                      {s.is_current ? (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          Sessão Atual
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{s.ip_address}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                      {new Date(s.created_at).toLocaleString('pt-PT')}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                      {new Date(s.expires_at).toLocaleString('pt-PT')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!s.is_current && (
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revogar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Submódulo: Gestão de Utilizadores & RBAC */}
      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 bg-slate-950">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Matriz de Controlo de Acessos (RBAC)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Definição de permissões por perfil: Administrador, Gestor, Técnico e Utilizador Final
            </p>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Função / Cargo</th>
                <th className="py-3 px-4">Perfil RBAC</th>
                <th className="py-3 px-4 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-medium text-white">{u.name}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-4 text-slate-300">{u.department_name || 'Geral'}</td>
                  <td className="py-3 px-4 text-slate-400">{u.job_title || 'Colaborador'}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      disabled={user?.role !== 'admin'}
                      className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none"
                    >
                      <option value="admin">Administrador (CISO)</option>
                      <option value="manager">Gestor de Service Desk</option>
                      <option value="technician">Técnico de Suporte</option>
                      <option value="user">Utilizador / Colaborador</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Ativo
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Submódulo: Backups e Recuperação de Desastre */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span>Procedimento de Cópias de Segurança Relacionais</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Exportação integral de tabelas, integridade referencial ACID, migrações e rotação automática de 30 dias.
                </p>
              </div>

              <button
                onClick={handleRunBackupTest}
                disabled={backupLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${backupLoading ? 'animate-spin' : ''}`} />
                <span>{backupLoading ? 'A executar backup...' : 'Testar Backup Relacional'}</span>
              </button>
            </div>

            {backupResult && (
              <div className="p-4 bg-slate-950 border border-emerald-800/50 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{backupResult.message}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
                  <div>Arquivo Gerado: {backupResult.backup_storage_path}</div>
                  <div>Timestamp: {backupResult.timestamp}</div>
                  <div>Motor Verificado: {backupResult.engine}</div>
                  <div>Tabelas Validadas: {backupResult.tables_verified?.length} tabelas relacionais</div>
                </div>
              </div>
            )}
          </div>

          {/* Procedimento de Recuperação de Emergência */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Instruções de Recuperação em Servidor Linux</span>
            </h3>
            <p className="text-xs text-slate-400">
              Para repor o sistema em caso de contingência, execute o script oficial incluído:
            </p>
            <pre className="p-3 bg-slate-950 rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto">
              $ sudo bash /var/www/sw-service-desk/scripts/restore.sh /var/backups/sw-service-desk/backup_sw_servicedesk_20261014.tar.gz
            </pre>
          </div>
        </div>
      )}

      {/* 6. Submódulo: Health Check & Configurações de Produção */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Estado do Servidor</span>
              <div className="text-lg font-semibold text-emerald-400 flex items-center gap-2 mt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{healthData?.status || 'Online'}</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">SW Service Desk v1.0</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Fonte de Verdade Transacional</span>
              <div className="text-lg font-semibold text-blue-400 mt-1">
                {healthData?.database?.engine || 'Relational SQL'}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Latência: {healthData?.database?.latency_ms || 1} ms
              </span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Tempo de Atividade (Uptime)</span>
              <div className="text-lg font-semibold text-white font-mono tabular-nums mt-1">
                {healthData?.system?.uptime_seconds || 120}s
              </div>
              <span className="text-[11px] text-slate-500">
                Memória RSS: {healthData?.system?.memory_rss_mb || 48} MB
              </span>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Configurações de Produção Criadas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="font-semibold text-blue-400">Nginx Reverse Proxy</div>
                <div className="text-[11px] text-slate-400 mt-1">docs/nginx-service-desk.conf</div>
                <div className="text-[10px] text-slate-500 mt-0.5">SSL TLS 1.3, HSTS, Rate Limit</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="font-semibold text-blue-400">Apache 2.4 VirtualHost</div>
                <div className="text-[11px] text-slate-400 mt-1">docs/apache-service-desk.conf</div>
                <div className="text-[10px] text-slate-500 mt-0.5">ProxyPass, WSS, ModSSL</div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="font-semibold text-blue-400">Systemd Linux Service</div>
                <div className="text-[11px] text-slate-400 mt-1">docs/sw-service-desk.service</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Arranque automático e watchdog</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exibição de Payload de Auditoria */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Registo de Auditoria Forense</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <pre className="p-3 bg-slate-950 rounded-lg text-slate-300 font-mono text-xs overflow-x-auto max-h-72">
              {JSON.stringify(
                typeof selectedLog.details === 'string'
                  ? JSON.parse(selectedLog.details)
                  : selectedLog.details,
                null,
                2
              )}
            </pre>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
