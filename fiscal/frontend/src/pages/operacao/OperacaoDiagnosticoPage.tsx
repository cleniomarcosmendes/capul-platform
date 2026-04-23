import { NavLink, Outlet } from 'react-router-dom';
import { Settings, ShieldCheck } from 'lucide-react';
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
  { path: 'circuit-breaker', label: 'Circuit Breaker', icon: Settings, minRole: 'GESTOR_FISCAL' },
  { path: 'tls', label: 'Cadeia TLS', icon: ShieldCheck, minRole: 'ADMIN_TI' },
];

/**
 * Hub "Diagnóstico" — telas de troubleshooting (read-only ou quase) para
 * entender "o que está acontecendo" e "por que algo falhou". Separado do
 * hub de Controle (que é action-oriented — liga/desliga/agenda/pausa).
 *
 * Navegação via URL (react-router sub-routes). Rotas antigas
 * (/operacao/circuit-breaker, /operacao/tls) continuam respondendo via
 * Navigate replace no App.tsx.
 */
export function OperacaoDiagnosticoPage() {
  const { fiscalRole } = useAuth();
  const visibleTabs = TABS.filter((t) => hasMinRole(fiscalRole, t.minRole));

  return (
    <PageWrapper title="Diagnóstico Operacional">
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
