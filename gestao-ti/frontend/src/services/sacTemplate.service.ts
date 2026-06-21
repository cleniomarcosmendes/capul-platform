import { gestaoApi } from './api';

export interface SacTemplate {
  id: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  ordem: number;
  createdAt: string;
  updatedAt: string;
}

export interface SacTemplatePayload {
  titulo?: string;
  corpo?: string;
  ativo?: boolean;
  ordem?: number;
}

export const sacTemplateService = {
  // Ativos — consumido pelo seletor do card "Responder ao cliente".
  async listarAtivos(): Promise<SacTemplate[]> {
    const { data } = await gestaoApi.get('/sac-templates');
    return data;
  },

  async listarTodos(): Promise<SacTemplate[]> {
    const { data } = await gestaoApi.get('/sac-templates/todos');
    return data;
  },

  async criar(payload: SacTemplatePayload): Promise<SacTemplate> {
    const { data } = await gestaoApi.post('/sac-templates', payload);
    return data;
  },

  async atualizar(id: string, payload: SacTemplatePayload): Promise<SacTemplate> {
    const { data } = await gestaoApi.put(`/sac-templates/${id}`, payload);
    return data;
  },

  async remover(id: string): Promise<{ deleted: boolean }> {
    const { data } = await gestaoApi.delete(`/sac-templates/${id}`);
    return data;
  },
};
