/**
 * SW Service Desk v1.0 - Aplicação Principal ITSM
 * Organização: SW Cloud Solutions
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { TicketsList } from './components/tickets/TicketsList';
import { TicketDetail } from './components/tickets/TicketDetail';
import { CmdbView } from './components/cmdb/CmdbView';
import { CatalogView } from './components/catalog/CatalogView';
import { KbView } from './components/kb/KbView';
import { AdminView } from './components/admin/AdminView';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('tickets');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  // Contadores Globais
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  const fetchGlobalStats = async () => {
    try {
      const [ticketsRes, approvalsRes] = await Promise.all([
        fetch('/api/v1/tickets?status=open'),
        fetch('/api/v1/catalog/approvals'),
      ]);
      if (ticketsRes.ok) {
        const d = await ticketsRes.json();
        const openCount = d.tickets?.filter(
          (t: any) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
        ).length;
        setOpenTicketsCount(openCount || 0);
      }
      if (approvalsRes.ok) {
        const d = await approvalsRes.json();
        const pending = d.approvals?.filter((a: any) => a.approval_status === 'PENDING').length;
        setPendingApprovalsCount(pending || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchGlobalStats();
  }, [currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>A carregar SW Service Desk v1.0...</span>
        </div>
      </div>
    );
  }

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    setCurrentView('tickets');
  };

  const handleSelectAsset = (id: number) => {
    setSelectedAssetId(id);
    setCurrentView('cmdb');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Bar Contract (1-line Brand wordmark, Breadcrumbs, Profile / Quick Switcher) */}
      <Header
        currentView={currentView}
        ticketBreadcrumb={selectedTicketId ? `Ticket #${selectedTicketId}` : null}
        onClearTicketBreadcrumb={() => setSelectedTicketId(null)}
      />

      {/* Workspace Canvas (Sidebar 260px + Content Viewport) */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => {
            setCurrentView(view);
            if (view !== 'tickets') {
              setSelectedTicketId(null);
            }
          }}
          openTicketsCount={openTicketsCount}
          pendingApprovalsCount={pendingApprovalsCount}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          <div className="max-w-7xl mx-auto">
            {currentView === 'tickets' && (
              selectedTicketId ? (
                <TicketDetail
                  ticketId={selectedTicketId}
                  onBack={() => setSelectedTicketId(null)}
                  onAssetClick={handleSelectAsset}
                />
              ) : (
                <TicketsList
                  onSelectTicket={handleSelectTicket}
                  onRefreshStats={fetchGlobalStats}
                />
              )
            )}

            {currentView === 'cmdb' && (
              <CmdbView
                onSelectTicket={handleSelectTicket}
                selectedAssetId={selectedAssetId}
                onClearSelectedAsset={() => setSelectedAssetId(null)}
              />
            )}

            {currentView === 'catalog' && (
              <CatalogView
                onSelectTicket={handleSelectTicket}
                onRefreshStats={fetchGlobalStats}
              />
            )}

            {currentView === 'kb' && <KbView />}

            {currentView === 'admin' && <AdminView />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
