import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  ArrowLeft,
  LogOut,
  ClipboardList,
  Package,
  Warehouse,
  RefreshCw,
  Send,
  BarChart2,
  ScanLine,
  Activity,
  AlertTriangle,
} from 'lucide-react';

type MenuItem =
  | { section: string; roles?: string[] }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string; roles?: string[] };

const STAFF = ['ADMIN', 'SUPERVISOR'];
const ALL = ['ADMIN', 'SUPERVISOR', 'OPERATOR'];

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/inventario/' },
  { section: 'INVENTARIO' },
  { label: 'Inventarios', icon: ClipboardList, path: '/inventario/inventarios', roles: ALL },
  { label: 'Contagem', icon: ScanLine, path: '/inventario/contagem', roles: ALL },
  { label: 'Produtos', icon: Package, path: '/inventario/produtos', roles: ALL },
  { label: 'Armazens', icon: Warehouse, path: '/inventario/armazens', roles: STAFF },
  { section: 'OPERACOES', roles: STAFF },
  { label: 'Importacao Protheus', icon: RefreshCw, path: '/inventario/importacao', roles: STAFF },
  { label: 'Envio Protheus', icon: Send, path: '/inventario/sincronizacao', roles: STAFF },
  { label: 'Relatorios', icon: BarChart2, path: '/inventario/relatorios', roles: STAFF },
  { label: 'Monitoramento', icon: Activity, path: '/inventario/monitoramento', roles: STAFF },
  { label: 'Divergencias', icon: AlertTriangle, path: '/inventario/divergencias', roles: STAFF },
];

function filterMenuByRole(items: MenuItem[], role: string | null): MenuItem[] {
  const filtered = items.filter((item) => {
    if (!item.roles) return true;
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

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { usuario, inventarioRole, logout } = useAuth();
  const visibleItems = filterMenuByRole(menuItems, inventarioRole);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
      >
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-capul-400" />
            <div>
              <h1 className="text-white font-bold text-sm">Inventario</h1>
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
                end={item.path === '/inventario/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-capul-600/20 text-capul-300 font-medium'
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
    </>
  );
}
