import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Settings } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { usePresencaHeartbeat, AvisoPlataformaBanner } from '../hooks/usePresencaHeartbeat';

export function MainLayout() {
  const { usuario } = useAuth();
  const { aviso } = usePresencaHeartbeat(!!usuario);

  // Sidebar mobile (md:hidden) — em md:+ a sidebar fica sempre visível
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Topbar mobile com botão hamburger (md:hidden) */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-700"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Settings className="w-5 h-5 text-emerald-600" />
          <h1 className="font-semibold text-sm text-slate-800">Configurador</h1>
        </div>
        <AvisoPlataformaBanner aviso={aviso} />
        <Outlet />
      </main>
    </div>
  );
}
