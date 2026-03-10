import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Users,
  ArrowLeft,
  LogOut,
  Monitor,
  Ticket,
  ClipboardList,
  BookOpen,
  Clock,
  AppWindow,
  KeyRound,
  FileText,
  Activity,
  FolderKanban,
  Server,
  BookMarked,
  Upload,
  Tag,
  Layers,
  AlertTriangle,
} from 'lucide-react';

type MenuItem =
  | { section: string; roles?: string[] }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string; roles?: string[] };

const STAFF = ['ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR'];
const MANAGERS = ['ADMIN', 'GESTOR_TI'];

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/gestao-ti/' },
  { section: 'SUPORTE' },
  { label: 'Chamados', icon: Ticket, path: '/gestao-ti/chamados' },
  { label: 'Ordens de Servico', icon: ClipboardList, path: '/gestao-ti/ordens-servico', roles: STAFF },
  { label: 'Base de Conhecimento', icon: BookMarked, path: '/gestao-ti/conhecimento' },
  { section: 'PORTFOLIO', roles: [...STAFF, 'FINANCEIRO'] },
  { label: 'Softwares', icon: AppWindow, path: '/gestao-ti/softwares', roles: [...STAFF, 'FINANCEIRO'] },
  { label: 'Licencas', icon: KeyRound, path: '/gestao-ti/licencas', roles: [...STAFF, 'FINANCEIRO'] },
  { label: 'Contratos', icon: FileText, path: '/gestao-ti/contratos', roles: [...STAFF, 'FINANCEIRO'] },
  { section: 'SUSTENTACAO', roles: STAFF },
  { label: 'Paradas', icon: Activity, path: '/gestao-ti/paradas', roles: STAFF },
  { label: 'Motivos de Parada', icon: AlertTriangle, path: '/gestao-ti/motivos-parada', roles: MANAGERS },
  { section: 'PROJETOS', roles: [...STAFF, 'GERENTE_PROJETO'] },
  { label: 'Projetos', icon: FolderKanban, path: '/gestao-ti/projetos', roles: [...STAFF, 'GERENTE_PROJETO'] },
  { section: 'INFRAESTRUTURA', roles: STAFF },
  { label: 'Ativos', icon: Server, path: '/gestao-ti/ativos', roles: STAFF },
  { section: 'CONFIGURACOES', roles: MANAGERS },
  { label: 'Equipes de T.I.', icon: Users, path: '/gestao-ti/equipes', roles: MANAGERS },
  { label: 'Catalogo de Servicos', icon: BookOpen, path: '/gestao-ti/catalogo', roles: MANAGERS },
  { label: 'SLA', icon: Clock, path: '/gestao-ti/sla', roles: MANAGERS },
  { label: 'Importar Dados', icon: Upload, path: '/gestao-ti/importar', roles: MANAGERS },
  { section: 'CADASTROS', roles: MANAGERS },
  { label: 'Departamentos', icon: Building2, path: '/gestao-ti/departamentos', roles: MANAGERS },
  { label: 'Centros de Custo', icon: Wallet, path: '/gestao-ti/centros-custo', roles: MANAGERS },
  { label: 'Nat. Financeiras', icon: Tag, path: '/gestao-ti/naturezas', roles: MANAGERS },
  { label: 'Tipos de Contrato', icon: Layers, path: '/gestao-ti/tipos-contrato', roles: MANAGERS },
];

function filterMenuByRole(items: MenuItem[], role: string | null): MenuItem[] {
  const filtered = items.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  // Remove section headers that have no items after them
  return filtered.filter((item, idx) => {
    if ('section' in item) {
      const next = filtered[idx + 1];
      return next && !('section' in next);
    }
    return true;
  });
}

export function Sidebar() {
  const { usuario, gestaoTiRole, logout } = useAuth();
  const visibleItems = filterMenuByRole(menuItems, gestaoTiRole);

  return (
    <aside className="w-64 h-screen flex flex-col flex-shrink-0" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Monitor className="w-6 h-6 text-capul-400" />
          <div>
            <h1 className="text-white font-bold text-sm">Gestao de T.I.</h1>
            <p className="text-slate-400 text-xs">
              {usuario?.filialAtual?.codigo} - {usuario?.filialAtual?.nome}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
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
              end={item.path === '/gestao-ti/'}
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
