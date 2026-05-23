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
  | 'INDICADOR_ESTRATEGICO';

export const TODAS_FUNCIONALIDADES: { codigo: FuncionalidadeWorkspace; rotulo: string }[] = [
  { codigo: 'CHAMADO', rotulo: 'Chamados' },
  { codigo: 'PROJETO', rotulo: 'Projetos' },
  { codigo: 'OS', rotulo: 'Ordens de Serviço' },
  { codigo: 'EQUIPE', rotulo: 'Equipes' },
  { codigo: 'CONTRATO', rotulo: 'Contratos' },
  { codigo: 'NOTA_FISCAL', rotulo: 'Notas Fiscais' },
  { codigo: 'SOFTWARE', rotulo: 'Softwares' },
  { codigo: 'LICENCA', rotulo: 'Licenças' },
  { codigo: 'ATIVO', rotulo: 'Ativos' },
  { codigo: 'PARADA', rotulo: 'Paradas' },
  { codigo: 'INDICADOR_OPERACIONAL', rotulo: 'Indicadores Operacionais' },
  { codigo: 'INDICADOR_ESTRATEGICO', rotulo: 'Indicadores Estratégicos' },
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
