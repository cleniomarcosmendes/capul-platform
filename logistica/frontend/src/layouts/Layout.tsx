import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MapPin, Truck, LogOut, ExternalLink, Package, Car, Route, BarChart3, TrendingUp, FileCheck, ClipboardList, Fuel, Banknote, CircleDot, Gauge, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Grupos de role para gatear o menu (o backend é a fonte da verdade do RBAC;
// aqui é só visual). ADMIN vê tudo (tratado no filtro). Espelha a matriz de
// acessos da Fase 2: condutor opera por matrícula+senha no terminal de frota.
const ENTREGA = ['OPERADOR_ENTREGA', 'GESTOR_ENTREGA'];
const FROTA_OP = ['OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA'];
const GESTORES = ['GESTOR_ENTREGA', 'GESTOR_FROTA'];

type NavEntry =
  | { section: string; roles?: string[] }
  | { to: string; label: string; icon: typeof Home; end?: boolean; roles?: string[] };

const navItems: NavEntry[] = [
  { to: '/', label: 'Início', icon: Home, end: true },

  { section: 'GESTÃO', roles: GESTORES },
  { to: '/painel', label: 'Painel', icon: BarChart3, roles: GESTORES },
  { to: '/indicadores', label: 'Indicadores de Entrega', icon: TrendingUp, roles: GESTORES },
  { to: '/analise-entregas', label: 'Análise de Entregas', icon: TrendingUp, roles: GESTORES },
  { to: '/frota/analise', label: 'Análise da Frota', icon: TrendingUp, roles: GESTORES },

  { section: 'ENTREGAS', roles: ENTREGA },
  { to: '/entregas/nova', label: 'Nova Entrega', icon: Package, roles: ENTREGA },
  { to: '/entregas', label: 'Entregas', icon: ClipboardList, end: true, roles: ENTREGA },
  { to: '/viagens', label: 'Rotas de Entrega', icon: Route, roles: ENTREGA },
  { to: '/comprovantes', label: 'Comprovantes', icon: FileCheck, roles: ENTREGA },
  { to: '/clientes', label: 'Endereços', icon: MapPin, roles: ENTREGA },

  { section: 'FROTA', roles: FROTA_OP },
  { to: '/frota', label: 'Saída de Veículos', icon: Fuel, end: true, roles: FROTA_OP },
  { to: '/frota/painel', label: 'Monitor da Frota', icon: CircleDot, roles: GESTORES },
  { to: '/despesas', label: 'Custos da Frota', icon: Banknote, roles: FROTA_OP },
  { to: '/frota/linha-km', label: 'Linha do KM', icon: Gauge, roles: GESTORES },
  { to: '/veiculos', label: 'Veículos', icon: Car, roles: GESTORES },

  { section: 'SUPERVISORES', roles: GESTORES },
  { to: '/supervisores', label: 'Prestação de Contas (RDV)', icon: Users, roles: GESTORES },
];

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, logisticaRole, logout } = useAuth();

  const isAdmin = logisticaRole === 'ADMIN';
  const can = (roles?: string[]) => isAdmin || !roles || (logisticaRole != null && roles.includes(logisticaRole));

  // Filtra por role e remove cabeçalhos de seção que ficaram órfãos (sem item logo abaixo).
  const visible = navItems.filter((item) => can(item.roles)).filter((item, idx, arr) => {
    if (!('section' in item)) return true;
    const next = arr[idx + 1];
    return next != null && !('section' in next);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="flex w-60 flex-col bg-slate-800 text-slate-100 print:hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
          <Truck className="h-6 w-6 text-capul-400" />
          <div>
            <div className="text-sm font-semibold">Logística</div>
            <div className="text-[11px] text-slate-400">Entregas &amp; Frota</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {visible.map((item, idx) => {
            if ('section' in item) {
              return (
                <div key={`s-${item.section}`} className={`px-3 pb-1 ${idx > 0 ? 'mt-4 pt-2 border-t border-slate-700/60' : ''}`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400" style={{ letterSpacing: '0.12em' }}>
                    {item.section}
                  </p>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-capul-600/20 text-capul-300 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
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
              <span className="rounded-full bg-capul-100 px-2 py-0.5 text-xs font-medium text-capul-700">
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
