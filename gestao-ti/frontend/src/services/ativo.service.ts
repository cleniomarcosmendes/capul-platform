import { gestaoApi } from './api';
import type { Ativo, AtivoSoftwareItem } from '../types';

export const ativoService = {
  async listar(filters?: {
    tipo?: string;
    status?: string;
    filialId?: string;
    search?: string;
  }): Promise<Ativo[]> {
    const { data } = await gestaoApi.get('/ativos', { params: filters });
    return data;
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
