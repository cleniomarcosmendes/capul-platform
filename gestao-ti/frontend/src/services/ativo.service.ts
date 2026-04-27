import { gestaoApi } from './api';
import type { Ativo, AtivoSoftwareItem } from '../types';
import type { PaginatedResponse } from '../components/Paginator';

interface AtivoListFilters {
  tipo?: string;
  status?: string;
  filialId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const ativoService = {
  /**
   * Listagem paginada (23/04/2026). Retorna `{ items, total, page, pageSize }`.
   */
  async listarPaginado(filters: AtivoListFilters = {}): Promise<PaginatedResponse<Ativo>> {
    const params: Record<string, string> = {};
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.status) params.status = filters.status;
    if (filters.filialId) params.filialId = filters.filialId;
    if (filters.search) params.search = filters.search;
    params.page = String(filters.page ?? 1);
    params.pageSize = String(filters.pageSize ?? 50);
    const { data } = await gestaoApi.get<PaginatedResponse<Ativo>>('/ativos', { params });
    return data;
  },

  /**
   * Compatibilidade — retorna só `items`. Puxa até 200 por chamada.
   */
  async listar(filters?: Omit<AtivoListFilters, 'page' | 'pageSize'>): Promise<Ativo[]> {
    const res = await this.listarPaginado({ ...(filters ?? {}), page: 1, pageSize: 200 });
    return res.items;
  },

  async buscar(id: string): Promise<Ativo> {
    const { data } = await gestaoApi.get(`/ativos/${id}`);
    return data;
  },

  async criar(payload: Record<string, unknown>): Promise<Ativo> {
    const { data } = await gestaoApi.post('/ativos', payload);
    return data;
  },

  async atualizar(id: string, payload: Record<string, unknown>): Promise<Ativo> {
    const { data } = await gestaoApi.patch(`/ativos/${id}`, payload);
    return data;
  },

  async alterarStatus(id: string, status: string): Promise<Ativo> {
    const { data } = await gestaoApi.patch(`/ativos/${id}/status`, { status });
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/ativos/${id}`);
  },

  async listarSoftwares(ativoId: string): Promise<AtivoSoftwareItem[]> {
    const { data } = await gestaoApi.get(`/ativos/${ativoId}/softwares`);
    return data;
  },

  async adicionarSoftware(ativoId: string, payload: {
    softwareId: string;
    versaoInstalada?: string;
    dataInstalacao?: string;
    observacoes?: string;
  }): Promise<AtivoSoftwareItem> {
    const { data } = await gestaoApi.post(`/ativos/${ativoId}/softwares`, payload);
    return data;
  },

  async removerSoftware(ativoId: string, softwareId: string): Promise<void> {
    await gestaoApi.delete(`/ativos/${ativoId}/softwares/${softwareId}`);
  },
};
