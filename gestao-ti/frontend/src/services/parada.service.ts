import { gestaoApi } from './api';
import type { RegistroParada, ParadaColaborador, MotivoParada, TipoParada, ImpactoParada, StatusParada } from '../types';
import type { PaginatedResponse } from '../components/Paginator';

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
  page?: number;
  pageSize?: number;
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
  /** Paginado (23/04/2026). */
  async listarPaginado(filters: ParadaFilters = {}): Promise<PaginatedResponse<RegistroParada>> {
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
    params.page = String(filters.page ?? 1);
    params.pageSize = String(filters.pageSize ?? 50);
    const { data } = await gestaoApi.get<PaginatedResponse<RegistroParada>>('/paradas', { params });
    return data;
  },

  /** Compat — retorna só `items`. pageSize=200. */
  async listar(filters: Omit<ParadaFilters, 'page' | 'pageSize'> = {}): Promise<RegistroParada[]> {
    const res = await this.listarPaginado({ ...filters, page: 1, pageSize: 200 });
    return res.items;
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

  // Anexos
  async listarAnexos(paradaId: string): Promise<{ id: string; nomeOriginal: string; mimeType: string; tamanho: number; createdAt: string; usuario: { id: string; nome: string } }[]> {
    const { data } = await gestaoApi.get(`/paradas/${paradaId}/anexos`);
    return data;
  },

  async uploadAnexo(paradaId: string, file: File, descricao?: string): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    if (descricao) formData.append('descricao', descricao);
    await gestaoApi.post(`/paradas/${paradaId}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async downloadAnexo(paradaId: string, anexoId: string, nomeOriginal: string): Promise<void> {
    const { data } = await gestaoApi.get(`/paradas/${paradaId}/anexos/${anexoId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeOriginal;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async abrirAnexo(paradaId: string, anexoId: string, mimeType: string): Promise<void> {
    const { data } = await gestaoApi.get(`/paradas/${paradaId}/anexos/${anexoId}/download?inline=1`, { responseType: 'blob' });
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  async removerAnexo(paradaId: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/paradas/${paradaId}/anexos/${anexoId}`);
  },
};
