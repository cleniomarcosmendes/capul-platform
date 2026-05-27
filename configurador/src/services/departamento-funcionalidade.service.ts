import { coreApi } from './api';

export type FuncionalidadeWorkspace =
  | 'CHAMADO'
  | 'PROJETO'
  | 'OS'
  | 'EQUIPE'
  | 'CONTRATO'
  | 'NOTA_FISCAL'
  | 'SOFTWARE'
  | 'LICENCA'
  | 'ATIVO'
  | 'PARADA'
  | 'INDICADOR_OPERACIONAL'
  | 'INDICADOR_ESTRATEGICO'
  | 'PAINEL_GESTAO_CHAMADO'
  | 'PAINEL_GESTAO_PROJETO'
  // S16.4 (27/05) — Cadastros operacionais (taxonomias shared, menu per-depto)
  | 'CADASTRO_DEPARTAMENTO'
  | 'CADASTRO_CENTRO_CUSTO'
  | 'CADASTRO_NATUREZA_FINANCEIRA'
  | 'CADASTRO_TIPO_CONTRATO'
  | 'CADASTRO_FORNECEDOR'
  | 'CADASTRO_PRODUTO'
  | 'CADASTRO_TIPO_PRODUTO'
  | 'CADASTRO_TIPO_PROJETO'
  | 'CADASTRO_CATEGORIA_LICENCA';

export type FuncionalidadeSecao = 'OPERACAO' | 'EQUIPE' | 'PORTFOLIO' | 'SUSTENTACAO' | 'INDICADORES' | 'PAINEIS' | 'CADASTROS';

export interface FuncionalidadeMeta {
  codigo: FuncionalidadeWorkspace;
  rotulo: string;
  descricao: string;
  secao: FuncionalidadeSecao;
  /** Nome do ícone lucide-react (componente importado pelo consumidor). */
  icone:
    | 'Ticket'
    | 'FolderKanban'
    | 'ClipboardList'
    | 'Users'
    | 'FileText'
    | 'Receipt'
    | 'AppWindow'
    | 'KeyRound'
    | 'Server'
    | 'Activity'
    | 'BarChart3'
    | 'TrendingUp'
    | 'Flame'
    | 'ListChecks'
    // S16.4 — ícones dos cadastros
    | 'Building2'
    | 'Wallet'
    | 'Tag'
    | 'Layers'
    | 'Truck'
    | 'Package';
}

export const SECOES: { id: FuncionalidadeSecao; rotulo: string }[] = [
  { id: 'OPERACAO', rotulo: 'Operação' },
  { id: 'PAINEIS', rotulo: 'Painéis de Gestão' },
  { id: 'EQUIPE', rotulo: 'Equipe' },
  { id: 'PORTFOLIO', rotulo: 'Portfólio' },
  { id: 'SUSTENTACAO', rotulo: 'Sustentação' },
  { id: 'INDICADORES', rotulo: 'Indicadores' },
  { id: 'CADASTROS', rotulo: 'Cadastros' },
];

export const TODAS_FUNCIONALIDADES: FuncionalidadeMeta[] = [
  // Operação
  { codigo: 'CHAMADO', rotulo: 'Chamados', descricao: 'Abertura e atendimento de tickets', secao: 'OPERACAO', icone: 'Ticket' },
  { codigo: 'PROJETO', rotulo: 'Projetos', descricao: 'Gestão de projetos com atividades e pendências', secao: 'OPERACAO', icone: 'FolderKanban' },
  { codigo: 'OS', rotulo: 'Ordens de Serviço', descricao: 'OS técnicas com agendamento', secao: 'OPERACAO', icone: 'ClipboardList' },
  // Equipe
  { codigo: 'EQUIPE', rotulo: 'Equipes', descricao: 'Cadastro e gestão de equipes que atendem chamados', secao: 'EQUIPE', icone: 'Users' },
  // Portfólio
  { codigo: 'CONTRATO', rotulo: 'Contratos', descricao: 'Contratos com fornecedores e parcelas', secao: 'PORTFOLIO', icone: 'FileText' },
  { codigo: 'NOTA_FISCAL', rotulo: 'Notas Fiscais', descricao: 'Alocação de despesa via NF', secao: 'PORTFOLIO', icone: 'Receipt' },
  { codigo: 'SOFTWARE', rotulo: 'Softwares', descricao: 'Catálogo de softwares do depto', secao: 'PORTFOLIO', icone: 'AppWindow' },
  { codigo: 'LICENCA', rotulo: 'Licenças', descricao: 'Licenças de software e renovações', secao: 'PORTFOLIO', icone: 'KeyRound' },
  // Sustentação
  { codigo: 'ATIVO', rotulo: 'Ativos', descricao: 'Inventário de ativos (hardware/dispositivos)', secao: 'SUSTENTACAO', icone: 'Server' },
  { codigo: 'PARADA', rotulo: 'Paradas', descricao: 'Registro de paradas operacionais', secao: 'SUSTENTACAO', icone: 'Activity' },
  // Painéis de Gestão (foco em "o que devo entregar" — SLA crítico, atribuídos, atrasos, marcos)
  { codigo: 'PAINEL_GESTAO_CHAMADO', rotulo: 'Painel de Gestão (Chamado)', descricao: 'Visão pessoal de SLA crítico, atribuídos a mim e aguardando resposta. Requer Chamados.', secao: 'PAINEIS', icone: 'Flame' },
  { codigo: 'PAINEL_GESTAO_PROJETO', rotulo: 'Painel de Gestão (Projeto)', descricao: 'Visão pessoal de atividades, pendências, projetos atrasados e marcos próximos. Requer Projetos.', secao: 'PAINEIS', icone: 'ListChecks' },
  // Indicadores
  { codigo: 'INDICADOR_OPERACIONAL', rotulo: 'Indicadores Operacionais', descricao: 'KPIs do dia a dia (SLA, CSAT, etc.)', secao: 'INDICADORES', icone: 'BarChart3' },
  { codigo: 'INDICADOR_ESTRATEGICO', rotulo: 'Indicadores Estratégicos', descricao: 'KPIs de planejamento (investimentos, disponibilidade)', secao: 'INDICADORES', icone: 'TrendingUp' },
  // Cadastros (S16.4 — taxonomias shared, menu per-depto)
  { codigo: 'CADASTRO_DEPARTAMENTO', rotulo: 'Departamentos', descricao: 'Cadastro de departamentos da plataforma (admin)', secao: 'CADASTROS', icone: 'Building2' },
  { codigo: 'CADASTRO_CENTRO_CUSTO', rotulo: 'Centros de Custo', descricao: 'Cadastro de centros de custo financeiros', secao: 'CADASTROS', icone: 'Wallet' },
  { codigo: 'CADASTRO_NATUREZA_FINANCEIRA', rotulo: 'Naturezas Financeiras', descricao: 'Classificação de receitas/despesas', secao: 'CADASTROS', icone: 'Tag' },
  { codigo: 'CADASTRO_TIPO_CONTRATO', rotulo: 'Tipos de Contrato', descricao: 'Tipologia de contratos com fornecedores', secao: 'CADASTROS', icone: 'Layers' },
  { codigo: 'CADASTRO_FORNECEDOR', rotulo: 'Fornecedores', descricao: 'Cadastro de fornecedores compartilhado', secao: 'CADASTROS', icone: 'Truck' },
  { codigo: 'CADASTRO_PRODUTO', rotulo: 'Produtos', descricao: 'Catálogo de produtos comprados', secao: 'CADASTROS', icone: 'Package' },
  { codigo: 'CADASTRO_TIPO_PRODUTO', rotulo: 'Tipos de Produto', descricao: 'Tipologia de produtos', secao: 'CADASTROS', icone: 'Tag' },
  { codigo: 'CADASTRO_TIPO_PROJETO', rotulo: 'Tipos de Projeto', descricao: 'Tipologia de projetos', secao: 'CADASTROS', icone: 'FolderKanban' },
  { codigo: 'CADASTRO_CATEGORIA_LICENCA', rotulo: 'Categorias de Licença', descricao: 'Classificação de licenças de software', secao: 'CADASTROS', icone: 'Tag' },
];

export interface FuncionalidadeStatus {
  funcionalidade: FuncionalidadeWorkspace;
  ativo: boolean;
  ativadoEm: string | null;
  ativadoPorId: string | null;
  desativadoEm: string | null;
  desativadoPorId: string | null;
}

export const departamentoFuncionalidadeService = {
  async listar(departamentoId: string): Promise<FuncionalidadeStatus[]> {
    const { data } = await coreApi.get(`/departamentos/${departamentoId}/funcionalidades`);
    return data;
  },

  async atualizar(
    departamentoId: string,
    funcionalidades: { funcionalidade: FuncionalidadeWorkspace; ativo: boolean }[],
  ): Promise<FuncionalidadeStatus[]> {
    const { data } = await coreApi.patch(
      `/departamentos/${departamentoId}/funcionalidades`,
      { funcionalidades },
    );
    return data;
  },
};
