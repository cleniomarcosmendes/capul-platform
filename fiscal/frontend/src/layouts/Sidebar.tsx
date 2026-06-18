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
  Network,
  Users,
  Building2,
  X,
} from 'lucide-react';
import type { RoleFiscal } from '../types';

type MenuItem =
  | { section: string; minRole?: RoleFiscal }
  | { label: string; icon: React.ComponentType<{ className?: string }>; path: string; minRole?: RoleFiscal; requireSocioCap?: boolean };

// Regra 23/04/2026, revista 19/05/2026: OPERADOR_ENTRADA só usa NF-e, CT-e
// e Consulta Cadastral. ANALISTA_CADASTRO também acessa as telas de
// análise cadastral RFB (Inteligência Cadastral, Busca por Sócio, Base
// RFB — Empresas) — consulta read-only, zero certificado/SEFAZ, é o
// trabalho do papel. Cruzamento operacional (Execuções/Divergências/
// Alertas), Operação e Dashboard seguem GESTOR_FISCAL+ (ações pesadas
// e KPIs sensíveis). Export CSV do cruzamento = GESTOR_FISCAL+ (LGPD —
// extração em massa). Rodar cruzamento/Importar base RFB = ADMIN_TI.
const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', minRole: 'GESTOR_FISCAL' },
  { section: 'DOCUMENTOS FISCAIS' },
  { label: 'Consulta NF-e', icon: FileText, path: '/nfe' },
  { label: 'Busca de NF-e', icon: FileSearch, path: '/nfe/busca' },
  { label: 'Pendências NF-e', icon: AlertTriangle, path: '/nfe/pendencias' },
  // /cte aponta para CteRecebidosPage (listagem dos CT-es baixados via distNSU).
  // /cte/consulta-por-chave fica como rota secundaria (limitada pelo Nacional).
  { label: 'Consulta CT-e', icon: Truck, path: '/cte' },
  // Cadastro fica em secao separada (09/05/2026) — consulta CCC/Sintegra/Receita,
  // nao e documento fiscal. Operadores entendem melhor com a divisao.
  { section: 'CADASTRO' },
  { label: 'Consulta Cadastral', icon: UserSearch, path: '/cadastro' },
  { label: 'Inteligência Cadastral', icon: Network, path: '/rfb/cruzamento', minRole: 'ANALISTA_CADASTRO' },
  { label: 'Busca por Sócio', icon: Users, path: '/rfb/socios', minRole: 'ANALISTA_CADASTRO', requireSocioCap: true },
  { label: 'Base RFB — Empresas', icon: Building2, path: '/rfb/empresas', minRole: 'ANALISTA_CADASTRO' },
  { section: 'CRUZAMENTO', minRole: 'GESTOR_FISCAL' },
  { label: 'Execucoes', icon: Activity, path: '/execucoes', minRole: 'GESTOR_FISCAL' },
  { label: 'Divergencias', icon: AlertTriangle, path: '/divergencias', minRole: 'GESTOR_FISCAL' },
  { label: 'Historico de Alertas', icon: Mail, path: '/alertas', minRole: 'GESTOR_FISCAL' },
  { section: 'OPERACAO', minRole: 'GESTOR_FISCAL' },
  { label: 'Controle Operacional', icon: Sliders, path: '/operacao/controle', minRole: 'GESTOR_FISCAL' },
  { label: 'Diagnóstico', icon: Stethoscope, path: '/operacao/diagnostico', minRole: 'GESTOR_FISCAL' },
];

function filterMenuByRole(
  items: MenuItem[],
  role: RoleFiscal | null,
  socioPermitido: boolean | null,
): MenuItem[] {
  const filtered = items.filter((item) => {
    // Capability LGPD (sócio): só mostra com permissão explícita
    // (null = ainda resolvendo → esconde p/ não piscar).
    if ('requireSocioCap' in item && item.requireSocioCap && socioPermitido !== true) {
      return false;
    }
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

interface SidebarProps {
  /** Aberto em mobile. Em md:+ a sidebar fica sempre visível (estático). */
  open?: boolean;
  /** Fecha o sidebar (mobile). Backdrop e clicks em links chamam isso. */
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps = {}) {
  const { usuario, fiscalRole, socioPermitido, logout } = useAuth();
  const visibleItems = filterMenuByRole(menuItems, fiscalRole, socioPermitido);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:flex-shrink-0`}
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
      >
        <div className="p-4 border-b border-slate-700 flex items-start justify-between">
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
          {/* Fechar (mobile only) */}
          <button
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-white p-1"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
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
