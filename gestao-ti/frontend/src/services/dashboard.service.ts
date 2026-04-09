import { gestaoApi } from './api';
import type {
  DashboardResumo, DashboardFinanceiro, DashboardDisponibilidade, DashboardExecutivo, DashboardCsat,
  AcompanhamentoData, TecnicoResumo,
  ChamadoBusca, AcompanhamentoChamadoData,
  AtividadeBusca, ProjetoResumo, AcompanhamentoAtividadeData,
  RelatorioOsData, RelatorioChamadoData, RelatorioProjetoData,
} from '../types';

export const dashboardService = {
  async getResumo(params?: { dataInicio?: string; dataFim?: string; departamentoId?: string }): Promise<DashboardResumo> {
    const { data } = await gestaoApi.get('/dashboard', { params });
    return data;
  },

  async getDisponibilidade(params?: {
    dataInicio?: string;
    dataFim?: string;
    softwareId?: string;
    filialId?: string;
  }): Promise<DashboardDisponibilidade> {
    const { data } = await gestaoApi.get('/dashboard/disponibilidade', { params });
    return data;
  },

  async getFinanceiro(params?: { dataInicio?: string; dataFim?: string }): Promise<DashboardFinanceiro> {
    const { data } = await gestaoApi.get('/dashboard/financeiro', { params });
    return data;
  },

  async getExecutivo(params?: { dataInicio?: string; dataFim?: string }): Promise<DashboardExecutivo> {
    const { data } = await gestaoApi.get('/dashboard/executivo', { params });
    return data;
  },

  async getCsat(params?: { dataInicio?: string; dataFim?: string; departamentoId?: string }): Promise<DashboardCsat> {
    const { data } = await gestaoApi.get('/dashboard/csat', { params });
    return data;
  },

  async getAcompanhamento(params?: { usuarioId?: string; dataInicio?: string; dataFim?: string }): Promise<AcompanhamentoData> {
    const tzOffset = new Date().getTimezoneOffset();
    const { data } = await gestaoApi.get('/dashboard/acompanhamento', {
      params: { ...params, tzOffset },
    });
    return data;
  },

  async getTecnicos(): Promise<TecnicoResumo[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento/tecnicos');
    return data;
  },

  // Acompanhamento por Chamado
  async listarEquipes(): Promise<{ id: string; nome: string; sigla: string }[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-chamado/equipes');
    return data;
  },

  async buscarChamados(params?: { q?: string; status?: string; prioridade?: string; equipeId?: string; tecnicoId?: string; dataInicio?: string; dataFim?: string }): Promise<ChamadoBusca[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-chamado/buscar', { params });
    return data;
  },

  async getAcompanhamentoChamado(chamadoId: string): Promise<AcompanhamentoChamadoData> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-chamado', { params: { chamadoId } });
    return data;
  },

  // Acompanhamento por Atividade
  async listarProjetosAtivos(): Promise<ProjetoResumo[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-atividade/projetos');
    return data;
  },

  async buscarAtividades(params?: { q?: string; projetoId?: string; status?: string; dataInicio?: string; dataFim?: string; responsavelId?: string; faseId?: string }): Promise<AtividadeBusca[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-atividade/buscar', { params });
    return data;
  },

  async listarFasesAtivas(): Promise<{ id: string; nome: string }[]> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-atividade/fases');
    return data;
  },

  async getAcompanhamentoAtividade(atividadeId: string): Promise<AcompanhamentoAtividadeData> {
    const { data } = await gestaoApi.get('/dashboard/acompanhamento-atividade', { params: { atividadeId } });
    return data;
  },

  async getRelatorioOs(params: { tecnicoId: string; dataInicio: string; dataFim: string }): Promise<RelatorioOsData> {
    const { data } = await gestaoApi.get('/dashboard/relatorio-os', { params });
    return data;
  },

  async getRelatorioChamado(chamadoId: string): Promise<RelatorioChamadoData> {
    const { data } = await gestaoApi.get('/dashboard/relatorio-chamado', { params: { chamadoId } });
    return data;
  },

  async getRelatorioProjeto(projetoId: string): Promise<RelatorioProjetoData> {
    const { data } = await gestaoApi.get('/dashboard/relatorio-projeto', { params: { projetoId } });
    return data;
  },

  async getMinhasPendencias(): Promise<{
    atividades: { id: string; titulo: string; status: string; dataFimPrevista: string | null; projeto: { id: string; numero: number; nome: string }; fase: { id: string; nome: string } | null }[];
    pendencias: { id: string; numero: number; titulo: string; status: string; prioridade: string; dataLimite: string | null; createdAt: string; projeto: { id: string; numero: number; nome: string }; fase: { id: string; nome: string } | null; criador: { id: string; nome: string } }[];
    resumo: { totalAtividades: number; totalPendencias: number; vencidas: number; urgentes: number };
  }> {
    const { data } = await gestaoApi.get('/dashboard/minhas-pendencias');
    return data;
  },
};
