/**
 * Workspace Multi-Departamento — espelho da lista de menus do Sidebar.tsx
 * do gestao-ti-frontend, usado pra calcular "o que esse user vê" sem
 * abrir o módulo Workspace.
 *
 * **MANTER SINCRONIZADO** com `gestao-ti/frontend/src/layouts/Sidebar.tsx`.
 * Cada item segue o mesmo formato (label, roles?, funcionalidade?).
 * Quando o admin alterar a sidebar do gestao-ti, esta lista também precisa
 * mudar. Em troca, o Configurador consegue mostrar "Resumo de Acesso" sem
 * importar o gestao-ti como dependência.
 *
 * Onda 2 C2.5/C2.8/B.1 — Configurador.
 */

export const STAFF = ['ADMIN', 'GESTOR', 'SUPORTE'] as const;
export const MANAGERS = ['ADMIN', 'GESTOR'] as const;
export const PROJ_ROLES = [...STAFF, 'USUARIO_CHAVE', 'TERCEIRIZADO'] as const;

export type WorkspaceMenuItem =
  | { section: string; roles?: readonly string[] }
  | {
      label: string;
      path: string;
      roles?: readonly string[];
      /** Funcionalidade exigida no depto (D32). */
      funcionalidade?: string;
    };

export const WORKSPACE_MENUS: WorkspaceMenuItem[] = [
  { label: 'Dashboard', path: '/gestao-ti/' },
  { label: 'Indicadores', path: '/gestao-ti/indicadores', roles: MANAGERS },
  { label: 'Monitor', path: '/gestao-ti/monitor', roles: STAFF },
  { label: 'Acompanhamento', path: '/gestao-ti/acompanhamento', roles: STAFF },
  { label: 'Acomp. por Item', path: '/gestao-ti/acompanhamento-item', roles: STAFF },
  { label: 'Relatorio de OS', path: '/gestao-ti/relatorio-os', roles: STAFF, funcionalidade: 'OS' },
  { section: 'SUPORTE' },
  { label: 'Chamados', path: '/gestao-ti/chamados', funcionalidade: 'CHAMADO' },
  { label: 'Ordens de Servico', path: '/gestao-ti/ordens-servico', roles: STAFF, funcionalidade: 'OS' },
  { label: 'Base de Conhecimento', path: '/gestao-ti/conhecimento', funcionalidade: 'CHAMADO' },
  { section: 'PORTFOLIO', roles: STAFF },
  { label: 'Softwares', path: '/gestao-ti/softwares', roles: STAFF, funcionalidade: 'SOFTWARE' },
  { label: 'Licencas', path: '/gestao-ti/licencas', roles: STAFF, funcionalidade: 'LICENCA' },
  { label: 'Contratos', path: '/gestao-ti/contratos', roles: MANAGERS, funcionalidade: 'CONTRATO' },
  { label: 'Notas Fiscais', path: '/gestao-ti/notas-fiscais', roles: STAFF, funcionalidade: 'NOTA_FISCAL' },
  { section: 'SUSTENTACAO', roles: STAFF },
  { label: 'Paradas', path: '/gestao-ti/paradas', roles: STAFF, funcionalidade: 'PARADA' },
  { label: 'Motivos de Parada', path: '/gestao-ti/motivos-parada', roles: STAFF, funcionalidade: 'PARADA' },
  { section: 'PROJETOS', roles: PROJ_ROLES },
  { label: 'Projetos', path: '/gestao-ti/projetos', roles: PROJ_ROLES, funcionalidade: 'PROJETO' },
  { label: 'Minhas Pendencias', path: '/gestao-ti/minhas-pendencias', roles: PROJ_ROLES, funcionalidade: 'PROJETO' },
  { section: 'INFRAESTRUTURA', roles: STAFF },
  { label: 'Ativos', path: '/gestao-ti/ativos', roles: STAFF, funcionalidade: 'ATIVO' },
  { section: 'CONFIGURACOES', roles: MANAGERS },
  { label: 'Equipes', path: '/gestao-ti/equipes', roles: MANAGERS, funcionalidade: 'EQUIPE' },
  { label: 'Catalogo de Servicos', path: '/gestao-ti/catalogo', roles: MANAGERS, funcionalidade: 'CHAMADO' },
  { label: 'SLA', path: '/gestao-ti/sla', roles: MANAGERS, funcionalidade: 'CHAMADO' },
  { label: 'Horarios de Trabalho', path: '/gestao-ti/horarios-trabalho', roles: MANAGERS, funcionalidade: 'CHAMADO' },
  { label: 'Importar Dados', path: '/gestao-ti/importar', roles: MANAGERS },
  { section: 'CADASTROS', roles: MANAGERS },
  { label: 'Departamentos', path: '/gestao-ti/departamentos', roles: MANAGERS },
  { label: 'Centros de Custo', path: '/gestao-ti/centros-custo', roles: MANAGERS },
  { label: 'Nat. Financeiras', path: '/gestao-ti/naturezas', roles: MANAGERS },
  { label: 'Tipos de Contrato', path: '/gestao-ti/tipos-contrato', roles: MANAGERS },
  { label: 'Fornecedores', path: '/gestao-ti/fornecedores', roles: MANAGERS },
  { label: 'Produtos', path: '/gestao-ti/produtos', roles: MANAGERS },
  { label: 'Tipos de Produto', path: '/gestao-ti/tipos-produto', roles: MANAGERS },
  { label: 'Tipos de Projeto', path: '/gestao-ti/tipos-projeto', roles: MANAGERS },
  { label: 'Cat. Licencas', path: '/gestao-ti/categorias-licenca', roles: MANAGERS },
  { label: 'Chamados Externos', path: '/gestao-ti/chamados-externos', roles: MANAGERS, funcionalidade: 'INDICADOR_ESTRATEGICO' },
];

/**
 * Pra cada item de menu, decide se um perfil (depto × role) o enxerga.
 * Junta as regras de role do menu com a funcionalidade ativa no depto.
 */
export function perfilEnxerga(
  item: Extract<WorkspaceMenuItem, { label: string }>,
  perfilRole: string,
  funcionalidadesAtivasNoDepto: Set<string>,
): boolean {
  if (item.roles && !item.roles.includes(perfilRole)) return false;
  if (item.funcionalidade && !funcionalidadesAtivasNoDepto.has(item.funcionalidade)) return false;
  return true;
}
