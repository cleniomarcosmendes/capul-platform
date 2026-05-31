import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, Truck, LogOut, ExternalLink, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/entregas/nova', label: 'Nova Entrega', icon: Package, end: false },
  { to: '/clientes', label: 'Clientes', icon: Users, end: false },
];

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, logisticaRole, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <aside className="flex w-60 flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
          <Truck className="h-6 w-6 text-sky-400" />
          <div>
            <div className="text-sm font-semibold">Logística</div>
            <div className="text-[11px] text-slate-400">Entregas &amp; Frota</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-sky-600/20 text-sky-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <a
          href="/"
          className="flex items-center gap-2 px-5 py-3 text-xs text-slate-400 hover:text-slate-200 border-t border-slate-700"
        >
          <ExternalLink className="h-4 w-4" /> Voltar ao Hub
        </a>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-base font-semibold text-slate-700">Módulo Logística</h1>
          <div className="flex items-center gap-3 text-sm">
            {logisticaRole && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                {logisticaRole}
              </span>
            )}
            <span className="text-slate-600">{usuario?.nome}</span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-700" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
