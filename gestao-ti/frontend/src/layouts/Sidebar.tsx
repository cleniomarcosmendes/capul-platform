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
  BarChart3,
  Activity,
  BarChart2,
  FolderKanban,
  PieChart,
  Server,
  BookMarked,
  Upload,
} from 'lucide-react';

type MenuItem =
  | { section: string }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string };

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/gestao-ti/' },
  { label: 'Executivo', icon: PieChart, path: '/gestao-ti/executivo' },
  { section: 'SUPORTE' },
  { label: 'Chamados', icon: Ticket, path: '/gestao-ti/chamados' },
  { label: 'Ordens de Servico', icon: ClipboardList, path: '/gestao-ti/ordens-servico' },
  { label: 'Base de Conhecimento', icon: BookMarked, path: '/gestao-ti/conhecimento' },
  { section: 'PORTFOLIO' },
  { label: 'Softwares', icon: AppWindow, path: '/gestao-ti/softwares' },
  { label: 'Licencas', icon: KeyRound, path: '/gestao-ti/licencas' },
  { label: 'Contratos', icon: FileText, path: '/gestao-ti/contratos' },
  { label: 'Financeiro', icon: BarChart3, path: '/gestao-ti/financeiro' },
  { section: 'SUSTENTACAO' },
  { label: 'Paradas', icon: Activity, path: '/gestao-ti/paradas' },
  { label: 'Disponibilidade', icon: BarChart2, path: '/gestao-ti/disponibilidade' },
  { section: 'PROJETOS' },
  { label: 'Projetos', icon: FolderKanban, path: '/gestao-ti/projetos' },
  { section: 'INFRAESTRUTURA' },
  { label: 'Ativos', icon: Server, path: '/gestao-ti/ativos' },
  { section: 'CONFIGURACOES' },
  { label: 'Equipes de T.I.', icon: Users, path: '/gestao-ti/equipes' },
  { label: 'Catalogo de Servicos', icon: BookOpen, path: '/gestao-ti/catalogo' },
  { label: 'SLA', icon: Clock, path: '/gestao-ti/sla' },
  { label: 'Importar Dados', icon: Upload, path: '/gestao-ti/importar' },
  { section: 'CADASTROS' },
  { label: 'Departamentos', icon: Building2, path: '/gestao-ti/departamentos' },
  { label: 'Centros de Custo', icon: Wallet, path: '/gestao-ti/centros-custo' },
];

export function Sidebar() {
  const { usuario, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
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

      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item, idx) => {
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
