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
  | 'PAINEL_GESTAO_PROJETO';

export type FuncionalidadeSecao = 'OPERACAO' | 'EQUIPE' | 'PORTFOLIO' | 'SUSTENTACAO' | 'INDICADORES' | 'PAINEIS';

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
    | 'ListChecks';
}

export const SECOES: { id: FuncionalidadeSecao; rotulo: string }[] = [
  { id: 'OPERACAO', rotulo: 'Operação' },
  { id: 'PAINEIS', rotulo: 'Painéis de Gestão' },
  { id: 'EQUIPE', rotulo: 'Equipe' },
  { id: 'PORTFOLIO', rotulo: 'Portfólio' },
  { id: 'SUSTENTACAO', rotulo: 'Sustentação' },
  { id: 'INDICADORES', rotulo: 'Indicadores' },
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
