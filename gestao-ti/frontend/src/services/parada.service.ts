import { gestaoApi } from './api';
import type { RegistroParada, ParadaColaborador, MotivoParada, TipoParada, ImpactoParada, StatusParada } from '../types';

interface ParadaFilters {
  softwareId?: string;
  moduloId?: string;
  filialId?: string;
  tipo?: TipoParada;
  impacto?: ImpactoParada;
  status?: StatusParada;
  motivoParadaId?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface CreateParadaPayload {
  titulo: string;
  tipo: TipoParada;
  impacto: ImpactoParada;
  inicio: string;
  fim?: string;
  softwareId: string;
  softwareModuloId?: string;
  motivoParadaId?: string;
  filialIds: string[];
  descricao?: string;
  observacoes?: string;
}

interface UpdateParadaPayload {
  titulo?: string;
  tipo?: TipoParada;
  impacto?: ImpactoParada;
  inicio?: string;
  softwareId?: string;
  softwareModuloId?: string;
  motivoParadaId?: string;
  filialIds?: string[];
  descricao?: string;
  observacoes?: string;
}

export const paradaService = {
  async listar(filters: ParadaFilters = {}): Promise<RegistroParada[]> {
    const params: Record<string, string> = {};
    if (filters.softwareId) params.softwareId = filters.softwareId;
    if (filters.moduloId) params.moduloId = filters.moduloId;
    if (filters.filialId) params.filialId = filters.filialId;
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.impacto) params.impacto = filters.impacto;
    if (filters.status) params.status = filters.status;
    if (filters.motivoParadaId) params.motivoParadaId = filters.motivoParadaId;
    if (filters.dataInicio) params.dataInicio = filters.dataInicio;
    if (filters.dataFim) params.dataFim = filters.dataFim;
    const { data } = await gestaoApi.get('/paradas', { params });
    return data;
  },

  async buscar(id: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.get(`/paradas/${id}`);
    return data;
  },

  async criar(payload: CreateParadaPayload): Promise<RegistroParada> {
    const { data } = await gestaoApi.post('/paradas', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateParadaPayload): Promise<RegistroParada> {
    const { data } = await gestaoApi.patch(`/paradas/${id}`, payload);
    return data;
  },

  async finalizar(id: string, payload?: { fim?: string; observacoes?: string }): Promise<RegistroParada> {
    const { data } = await gestaoApi.post(`/paradas/${id}/finalizar`, payload || {});
    return data;
  },

  async cancelar(id: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.post(`/paradas/${id}/cancelar`);
    return data;
  },

  async vincularChamado(paradaId: string, chamadoId: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.post(`/paradas/${paradaId}/chamados`, { chamadoId });
    return data;
  },

  async desvincularChamado(paradaId: string, chamadoId: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.delete(`/paradas/${paradaId}/chamados/${chamadoId}`);
    return data;
  },

  // Motivos de Parada
  async listarMotivos(): Promise<MotivoParada[]> {
    const { data } = await gestaoApi.get('/paradas/motivos');
    return data;
  },

  async criarMotivo(payload: { nome: string; descricao?: string }): Promise<MotivoParada> {
    const { data } = await gestaoApi.post('/paradas/motivos', payload);
    return data;
  },

  async atualizarMotivo(id: string, payload: { nome?: string; descricao?: string; ativo?: boolean }): Promise<MotivoParada> {
    const { data } = await gestaoApi.patch(`/paradas/motivos/${id}`, payload);
    return data;
  },

  async excluirMotivo(id: string): Promise<void> {
    await gestaoApi.delete(`/paradas/motivos/${id}`);
  },

  async listarColaboradores(paradaId: string): Promise<ParadaColaborador[]> {
    const { data } = await gestaoApi.get(`/paradas/${paradaId}/colaboradores`);
    return data;
  },

  async adicionarColaborador(paradaId: string, usuarioId: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.post(`/paradas/${paradaId}/colaboradores`, { usuarioId });
    return data;
  },

  async removerColaborador(paradaId: string, colaboradorId: string): Promise<RegistroParada> {
    const { data } = await gestaoApi.delete(`/paradas/${paradaId}/colaboradores/${colaboradorId}`);
    return data;
  },
};
