import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { contratoService } from '../services/contrato.service';
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
  Timer,
  AppWindow,
  KeyRound,
  FileText,
  Activity,
  Gauge,
  FolderKanban,
  Server,
  BookMarked,
  Upload,
  Tag,
  Layers,
  AlertTriangle,
  Truck,
  Package,
  Search,
  ListChecks,
  Receipt,
  BarChart3,
  PieChart,
  Globe2,
  Flame,
  Inbox,
  MessageSquareText,
  X,
} from 'lucide-react';

type MenuItem =
  | { section: string; roles?: string[] }
  | {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      path: string;
      roles?: string[];
      /** Workspace Onda 2 C2.5 — item visível só se a funcionalidade está
       *  ativa em pelo menos um depto do user no módulo. ADMIN segue a
       *  mesma regra (consistência com C2.3 guard que não escapa ADMIN). */
      funcionalidade?: string;
    };

const STAFF = ['ADMIN', 'GESTOR', 'SUPORTE'];
const MANAGERS = ['ADMIN', 'GESTOR'];
const CONTRATO_ROLES_STATIC = ['ADMIN', 'GESTOR'];
const CONTRATO_ROLES_DYNAMIC = ['ADMIN', 'GESTOR', 'SUPORTE'];

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/gestao-ti/', funcionalidade: 'DASHBOARD' },
  { label: 'Indicadores', icon: BarChart3, path: '/gestao-ti/indicadores', roles: MANAGERS, funcionalidade: 'INDICADOR_OPERACIONAL' },
  { label: 'Indicadores — Análise', icon: PieChart, path: '/gestao-ti/indicadores-analise', roles: MANAGERS, funcionalidade: 'INDICADOR_OPERACIONAL' },
  { label: 'Monitor', icon: Gauge, path: '/gestao-ti/monitor', roles: STAFF, funcionalidade: 'MONITOR' },
  { label: 'Acompanhamento', icon: Timer, path: '/gestao-ti/acompanhamento', roles: STAFF, funcionalidade: 'ACOMPANHAMENTO' },
  { label: 'Acomp. por Item', icon: Search, path: '/gestao-ti/acompanhamento-item', roles: STAFF, funcionalidade: 'ACOMPANHAMENTO_ITEM' },
  { label: 'Relatorio de OS', icon: FileText, path: '/gestao-ti/relatorio-os', roles: STAFF, funcionalidade: 'OS' },
  { section: 'SUPORTE' },
  { label: 'Chamados', icon: Ticket, path: '/gestao-ti/chamados', funcionalidade: 'CHAMADO' },
  { label: 'Painel de Gestão', icon: Flame, path: '/gestao-ti/painel-chamados', roles: MANAGERS, funcionalidade: 'PAINEL_GESTAO_CHAMADO' },
  { label: 'Ordens de Servico', icon: ClipboardList, path: '/gestao-ti/ordens-servico', roles: STAFF, funcionalidade: 'OS' },
  { label: 'Base de Conhecimento', icon: BookMarked, path: '/gestao-ti/conhecimento', funcionalidade: 'CONHECIMENTO' },
  { section: 'PORTFOLIO', roles: STAFF },
  { label: 'Softwares', icon: AppWindow, path: '/gestao-ti/softwares', roles: STAFF, funcionalidade: 'SOFTWARE' },
  { label: 'Licencas', icon: KeyRound, path: '/gestao-ti/licencas', roles: STAFF, funcionalidade: 'LICENCA' },
  { label: 'Contratos', icon: FileText, path: '/gestao-ti/contratos', roles: CONTRATO_ROLES_STATIC, funcionalidade: 'CONTRATO' },
  { label: 'Notas Fiscais', icon: Receipt, path: '/gestao-ti/notas-fiscais', roles: STAFF, funcionalidade: 'NOTA_FISCAL' },
  { section: 'SUSTENTACAO', roles: STAFF },
  { label: 'Paradas', icon: Activity, path: '/gestao-ti/paradas', roles: STAFF, funcionalidade: 'PARADA' },
  { label: 'Motivos de Parada', icon: AlertTriangle, path: '/gestao-ti/motivos-parada', roles: STAFF, funcionalidade: 'PARADA' },
  { section: 'PROJETOS', roles: [...STAFF, 'USUARIO_CHAVE', 'TERCEIRIZADO'] },
  { label: 'Projetos', icon: FolderKanban, path: '/gestao-ti/projetos', roles: [...STAFF, 'USUARIO_CHAVE', 'TERCEIRIZADO'], funcionalidade: 'PROJETO' },
  { label: 'Painel de Gestão', icon: ListChecks, path: '/gestao-ti/painel-projetos', roles: [...STAFF, 'USUARIO_CHAVE', 'TERCEIRIZADO'], funcionalidade: 'PAINEL_GESTAO_PROJETO' },
  { section: 'INFRAESTRUTURA', roles: STAFF },
  { label: 'Ativos', icon: Server, path: '/gestao-ti/ativos', roles: STAFF, funcionalidade: 'ATIVO' },
  { section: 'SAC', roles: MANAGERS },
  { label: 'Indicadores', icon: PieChart, path: '/gestao-ti/sac-indicadores', roles: MANAGERS },
  { label: 'E-mail de entrada', icon: Inbox, path: '/gestao-ti/sac-email', roles: MANAGERS },
  { label: 'Respostas prontas', icon: MessageSquareText, path: '/gestao-ti/sac-templates', roles: MANAGERS },
  { section: 'CONFIGURACOES', roles: MANAGERS },
  { label: 'Conf. Equipes', icon: Users, path: '/gestao-ti/equipes', roles: MANAGERS, funcionalidade: 'EQUIPE' },
  { label: 'Catalogo de Servicos', icon: BookOpen, path: '/gestao-ti/catalogo', roles: MANAGERS, funcionalidade: 'CATALOGO_SERVICO' },
  { label: 'SLA', icon: Clock, path: '/gestao-ti/sla', roles: MANAGERS, funcionalidade: 'SLA' },
  { label: 'Horarios de Trabalho', icon: Timer, path: '/gestao-ti/horarios-trabalho', roles: MANAGERS, funcionalidade: 'HORARIO_TRABALHO' },
  { label: 'Importar Dados', icon: Upload, path: '/gestao-ti/importar', roles: MANAGERS, funcionalidade: 'IMPORTAR_DADOS' },
  { section: 'CADASTROS', roles: MANAGERS },
  { label: 'Departamentos', icon: Building2, path: '/gestao-ti/departamentos', roles: MANAGERS, funcionalidade: 'CADASTRO_DEPARTAMENTO' },
  { label: 'Centros de Custo', icon: Wallet, path: '/gestao-ti/centros-custo', roles: MANAGERS, funcionalidade: 'CADASTRO_CENTRO_CUSTO' },
  { label: 'Nat. Financeiras', icon: Tag, path: '/gestao-ti/naturezas', roles: MANAGERS, funcionalidade: 'CADASTRO_NATUREZA_FINANCEIRA' },
  { label: 'Tipos de Contrato', icon: Layers, path: '/gestao-ti/tipos-contrato', roles: MANAGERS, funcionalidade: 'CADASTRO_TIPO_CONTRATO' },
  { label: 'Fornecedores', icon: Truck, path: '/gestao-ti/fornecedores', roles: MANAGERS, funcionalidade: 'CADASTRO_FORNECEDOR' },
  { label: 'Produtos', icon: Package, path: '/gestao-ti/produtos', roles: MANAGERS, funcionalidade: 'CADASTRO_PRODUTO' },
  { label: 'Tipos de Produto', icon: Tag, path: '/gestao-ti/tipos-produto', roles: MANAGERS, funcionalidade: 'CADASTRO_TIPO_PRODUTO' },
  { label: 'Tipos de Projeto', icon: FolderKanban, path: '/gestao-ti/tipos-projeto', roles: MANAGERS, funcionalidade: 'CADASTRO_TIPO_PROJETO' },
  { label: 'Cat. Licencas', icon: Tag, path: '/gestao-ti/categorias-licenca', roles: MANAGERS, funcionalidade: 'CADASTRO_CATEGORIA_LICENCA' },
  { label: 'Chamados Externos', icon: Globe2, path: '/gestao-ti/chamados-externos', roles: MANAGERS, funcionalidade: 'CHAMADO_EXTERNO' },
];

/**
 * Workspace S16.1 (27/05) — filtra menu correlacionando role+funcionalidade
 * no MESMO depto. Antes, agregava união de funcionalidades de todos os deptos
 * e o role denormalizado vinha do depto "mais alto" — combinação inconsistente
 * vazava menus de T.I. pra GESTOR de outro depto (incidente Juliana 27/05).
 *
 * Regra agora:
 *   Pra cada item com `funcionalidade` e/ou `roles`, existe MATCH se houver
 *   ALGUM depto do user onde role+funcionalidade ambos batem.
 *   - Item sem `roles` (qualquer perfil aceito): só funcionalidade no depto
 *   - Item sem `funcionalidade` (sem gate de feature): só role no depto
 *   - Item com ambos: role do user NESSE depto deve estar em `roles` E
 *     a funcionalidade deve estar ativa NESSE depto
 *
 * Seções (`section`) seguem o role denormalizado (visual apenas).
 */
type DeptoMenuContext = {
  role: string;
  funcionalidades: ReadonlySet<string>;
};

function itemTemMatchEmAlgumDepto(
  item: { roles?: string[]; funcionalidade?: string },
  deptos: DeptoMenuContext[],
): boolean {
  if (!item.roles && !item.funcionalidade) return true;
  for (const d of deptos) {
    const roleMatch = !item.roles || item.roles.includes(d.role);
    const funcMatch = !item.funcionalidade || d.funcionalidades.has(item.funcionalidade);
    if (roleMatch && funcMatch) return true;
  }
  return false;
}

function filterMenu(
  items: MenuItem[],
  roleDenormalizado: string | null,
  deptos: DeptoMenuContext[],
): MenuItem[] {
  const filtered = items.filter((item) => {
    if ('section' in item) {
      // Sections seguem o role denormalizado — só visual
      if (!item.roles) return true;
      return roleDenormalizado ? item.roles.includes(roleDenormalizado) : false;
    }
    return itemTemMatchEmAlgumDepto(item, deptos);
  });

  // Remove section headers órfãos (sem itens em seguida)
  return filtered.filter((item, idx) => {
    if ('section' in item) {
      const next = filtered[idx + 1];
      return next && !('section' in next);
    }
    return true;
  });
}

interface SidebarProps {
  /** Aberto em mobile. Em md:+ a sidebar fica sempre visível. */
  open?: boolean;
  /** Fecha o sidebar (mobile). Backdrop e clicks em links chamam isso. */
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps = {}) {
  const { usuario, gestaoTiRole, logout } = useAuth();
  const [podeGerirContratos, setPodeGerirContratos] = useState(false);

  useEffect(() => {
    if (gestaoTiRole === 'SUPORTE') {
      contratoService.verificarAcesso().then(setPodeGerirContratos);
    }
  }, [gestaoTiRole]);

  const effectiveItems = menuItems.map((item) => {
    if ('label' in item && item.label === 'Contratos' && gestaoTiRole === 'SUPORTE') {
      return podeGerirContratos ? { ...item, roles: CONTRATO_ROLES_DYNAMIC } : item;
    }
    return item;
  });

  // Workspace S16.1 (27/05) — contexto per-depto (role + funcionalidades).
  // Antes agregava união → vazava menus de T.I. pra GESTOR de outro depto.
  const moduloWS = usuario?.modulos.find((m) => m.codigo === 'WORKSPACE' || m.codigo === 'GESTAO_TI');
  const deptos: DeptoMenuContext[] = (moduloWS?.departamentos ?? []).map((d) => ({
    role: d.role ?? '',
    funcionalidades: new Set(d.funcionalidades ?? []),
  }));

  const visibleItems = filterMenu(effectiveItems, gestaoTiRole, deptos);

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
            <Monitor className="w-6 h-6 text-capul-400" />
            <div>
              <h1 className="text-white font-bold text-sm">Workspace</h1>
              <p className="text-slate-400 text-xs">
                {usuario?.filialAtual?.codigo} - {usuario?.filialAtual?.nome}
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

        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
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
                end={item.path === '/gestao-ti/'}
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
