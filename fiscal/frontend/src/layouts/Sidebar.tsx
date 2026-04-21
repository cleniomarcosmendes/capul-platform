import { NavLink } from 'react-router-dom';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Truck,
  UserSearch,
  Activity,
  Mail,
  Sliders,
  Stethoscope,
  ArrowLeft,
  LogOut,
  FileSearch,
  AlertTriangle,
} from 'lucide-react';
import type { RoleFiscal } from '../types';

type MenuItem =
  | { section: string; minRole?: RoleFiscal }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string; minRole?: RoleFiscal };

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { section: 'CONSULTAS' },
  { label: 'Consulta NF-e', icon: FileText, path: '/nfe' },
  { label: 'Consulta CT-e', icon: Truck, path: '/cte' },
  { label: 'Consulta Cadastral', icon: UserSearch, path: '/cadastro' },
  { section: 'CRUZAMENTO', minRole: 'ANALISTA_CADASTRO' },
  { label: 'Execucoes', icon: Activity, path: '/execucoes', minRole: 'ANALISTA_CADASTRO' },
  { label: 'Divergencias', icon: AlertTriangle, path: '/divergencias', minRole: 'ANALISTA_CADASTRO' },
  { label: 'Historico de Alertas', icon: Mail, path: '/alertas', minRole: 'GESTOR_FISCAL' },
  { section: 'OPERACAO', minRole: 'OPERADOR_ENTRADA' },
  { label: 'Controle Operacional', icon: Sliders, path: '/operacao/controle', minRole: 'OPERADOR_ENTRADA' },
  { label: 'Diagnóstico', icon: Stethoscope, path: '/operacao/diagnostico', minRole: 'ANALISTA_CADASTRO' },
];

function filterMenuByRole(items: MenuItem[], role: RoleFiscal | null): MenuItem[] {
  const filtered = items.filter((item) => {
    if ('minRole' in item && item.minRole) {
      return hasMinRole(role, item.minRole);
    }
    return true;
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
  const { usuario, fiscalRole, logout } = useAuth();
  const visibleItems = filterMenuByRole(menuItems, fiscalRole);

  return (
    <aside className="w-64 h-screen flex flex-col flex-shrink-0" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-capul-400" />
          <div>
            <h1 className="text-white font-bold text-sm">Módulo Fiscal</h1>
            <p className="text-slate-400 text-xs">
              {usuario?.filialAtual
                ? `${usuario.filialAtual.codigo} - ${usuario.filialAtual.nome}`
                : usuario?.filialCodigo ?? ''}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
        {visibleItems.map((item, idx) => {
          if ('section' in item) {
            return (
              <div key={idx} className={`mx-3 px-1 pt-1 pb-1 ${idx > 0 ? 'mt-4 border-t border-slate-700/60' : ''}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase" style={{ letterSpacing: '0.12em' }}>
                  {item.section}
                </p>
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
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
  );
}
