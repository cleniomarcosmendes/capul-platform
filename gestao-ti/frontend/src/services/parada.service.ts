import { gestaoApi } from './api';
import type { RegistroParada, TipoParada, ImpactoParada, StatusParada } from '../types';

interface ParadaFilters {
  softwareId?: string;
  moduloId?: string;
  filialId?: string;
  tipo?: TipoParada;
  impacto?: ImpactoParada;
  status?: StatusParada;
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
  chamadoId?: string;
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
  chamadoId?: string;
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
};
