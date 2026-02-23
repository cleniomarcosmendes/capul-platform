import { gestaoApi } from './api';
import type { OrdemServico, StatusOS } from '../types';

interface CreateOsPayload {
  titulo: string;
  descricao?: string;
  filialId: string;
  tecnicoId: string;
  dataAgendamento?: string;
  chamadoId?: string;
  observacoes?: string;
}

interface UpdateOsPayload {
  titulo?: string;
  descricao?: string;
  status?: StatusOS;
  dataAgendamento?: string;
  dataExecucao?: string;
  observacoes?: string;
}

export const ordemServicoService = {
  async listar(status?: StatusOS, filialId?: string): Promise<OrdemServico[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (filialId) params.filialId = filialId;
    const { data } = await gestaoApi.get('/ordens-servico', { params });
    return data;
  },

  async buscar(id: string): Promise<OrdemServico> {
    const { data } = await gestaoApi.get(`/ordens-servico/${id}`);
    return data;
  },

  async criar(payload: CreateOsPayload): Promise<OrdemServico> {
    const { data } = await gestaoApi.post('/ordens-servico', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateOsPayload): Promise<OrdemServico> {
    const { data } = await gestaoApi.patch(`/ordens-servico/${id}`, payload);
    return data;
  },
};
