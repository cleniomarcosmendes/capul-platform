import { gestaoApi } from './api';
import type { ArtigoConhecimento } from '../types';

export const conhecimentoService = {
  async listar(filters?: {
    categoria?: string;
    status?: string;
    softwareId?: string;
    equipeTiId?: string;
    search?: string;
  }): Promise<ArtigoConhecimento[]> {
    const { data } = await gestaoApi.get('/conhecimento', { params: filters });
    return data;
  },

  async buscar(id: string): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.get(`/conhecimento/${id}`);
    return data;
  },

  async criar(payload: Record<string, unknown>): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.post('/conhecimento', payload);
    return data;
  },

  async atualizar(id: string, payload: Record<string, unknown>): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.patch(`/conhecimento/${id}`, payload);
    return data;
  },

  async alterarStatus(id: string, status: string): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.patch(`/conhecimento/${id}/status`, { status });
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/conhecimento/${id}`);
  },
};
