import { useAuth } from '../contexts/AuthContext';
import { useSidebarToggle } from './MainLayout';
import { User, Menu } from 'lucide-react';

export function Header({ title }: { title: string }) {
  const { usuario, inventarioRole } = useAuth();
  const { toggleSidebar } = useSidebarToggle();

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-1 text-slate-500 hover:text-slate-700"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 truncate">{title}</h2>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline text-xs px-2 py-1 rounded-full bg-capul-100 text-capul-700 font-medium">
          {inventarioRole}
        </span>
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {usuario?.nome}
        </div>
      </div>
    </header>
  );
}
