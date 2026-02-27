import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Building,
  Wallet,
  Users,
  ArrowLeft,
  LogOut,
  Settings,
} from 'lucide-react';

type MenuItem =
  | { section: string; roles?: string[] }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string; roles?: string[] };

const ADMINS = ['ADMIN'];

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/configurador/' },
  { section: 'ORGANIZACAO' },
  { label: 'Empresa & Filiais', icon: Building2, path: '/configurador/empresa' },
  { label: 'Departamentos', icon: Building, path: '/configurador/departamentos' },
  { label: 'Centros de Custo', icon: Wallet, path: '/configurador/centros-custo' },
  { section: 'ACESSOS', roles: [...ADMINS, 'GESTOR'] },
  { label: 'Usuarios', icon: Users, path: '/configurador/usuarios', roles: [...ADMINS, 'GESTOR'] },
];

function filterMenuByRole(items: MenuItem[], role: string | null): MenuItem[] {
  const filtered = items.filter((item) => {
    if (!('roles' in item) || !item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return filtered.filter((item, idx) => {
    if ('section' in item) {
      const next = filtered[idx + 1];
      return next && !('section' in next);
    }
    return true;
  });
}

export function Sidebar() {
  const { usuario, configuradorRole, logout } = useAuth();
  const visibleItems = filterMenuByRole(menuItems, configuradorRole);

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-white font-bold text-sm">Configurador</h1>
            <p className="text-slate-400 text-xs">
              {usuario?.filialAtual?.codigo} - {usuario?.filialAtual?.nome}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item, idx) => {
          if ('section' in item) {
            return (
              <p key={idx} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 first:mt-0">
                {item.section}
              </p>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/configurador/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4 space-y-2">
        <a
          href="/"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Hub
        </a>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 truncate">{usuario?.nome}</span>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
