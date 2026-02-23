import { gestaoApi } from './api';
import type { SlaDefinicao } from '../types';

interface CreateSlaPayload {
  nome: string;
  prioridade: string;
  horasResposta: number;
  horasResolucao: number;
  equipeId: string;
}

export const slaService = {
  async listar(equipeId?: string): Promise<SlaDefinicao[]> {
    const params: Record<string, string> = {};
    if (equipeId) params.equipeId = equipeId;
    const { data } = await gestaoApi.get('/sla', { params });
    return data;
  },

  async buscar(id: string): Promise<SlaDefinicao> {
    const { data } = await gestaoApi.get(`/sla/${id}`);
    return data;
  },

  async criar(payload: CreateSlaPayload): Promise<SlaDefinicao> {
    const { data } = await gestaoApi.post('/sla', payload);
    return data;
  },

  async atualizar(id: string, payload: Partial<CreateSlaPayload>): Promise<SlaDefinicao> {
    const { data } = await gestaoApi.patch(`/sla/${id}`, payload);
    return data;
  },

  async atualizarStatus(id: string, status: 'ATIVO' | 'INATIVO'): Promise<SlaDefinicao> {
    const { data } = await gestaoApi.patch(`/sla/${id}/status`, { status });
    return data;
  },
};
