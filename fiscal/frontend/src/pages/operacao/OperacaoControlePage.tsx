import { NavLink, Outlet } from 'react-router-dom';
import { Globe, Clock, ShieldAlert, Gauge } from 'lucide-react';
import { PageWrapper } from '../../components/PageWrapper';
import { useAuth, hasMinRole } from '../../contexts/AuthContext';
import type { RoleFiscal } from '../../types';

interface TabDef {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: RoleFiscal;
}

const TABS: TabDef[] = [
  { path: 'ambiente', label: 'Ambiente', icon: Globe, minRole: 'GESTOR_FISCAL' },
  { path: 'agendamentos', label: 'Agendamentos', icon: Clock, minRole: 'GESTOR_FISCAL' },
  { path: 'freio', label: 'Freio de Mão', icon: ShieldAlert, minRole: 'GESTOR_FISCAL' },
  { path: 'limites', label: 'Limites SEFAZ', icon: Gauge, minRole: 'GESTOR_FISCAL' },
];

/**
 * Hub "Controle Operacional" — reúne em abas as configurações que antes
 * estavam espalhadas em 4 páginas separadas (Ambiente PROD/HOM, Agendamentos,
 * Freio de Mão — antes embutido no Ambiente — e Limites SEFAZ).
 *
 * Navegação via URL (react-router sub-routes) — bookmarks e deep-link funcionam
 * apontando diretamente para a aba, ex: /operacao/controle/limites. Cada aba é
 * autocontida e faz seus próprios fetches apenas quando montada.
 *
 * Rotas antigas (/operacao/ambiente, /operacao/agendamentos, /operacao/limites)
 * continuam respondendo via Navigate replace no App.tsx, preservando bookmarks.
 */
export function OperacaoControlePage() {
  const { fiscalRole } = useAuth();
  const visibleTabs = TABS.filter((t) => hasMinRole(fiscalRole, t.minRole));

  return (
    <PageWrapper title="Controle Operacional">
      <div className="mb-4 border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-capul-600 text-capul-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </PageWrapper>
  );
}
