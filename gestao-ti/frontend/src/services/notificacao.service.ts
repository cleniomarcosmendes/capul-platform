import { gestaoApi } from './api';
import type { Notificacao } from '../types';

export const notificacaoService = {
  async listar(lida?: boolean): Promise<Notificacao[]> {
    const params: Record<string, string> = {};
    if (lida !== undefined) params.lida = String(lida);
    const { data } = await gestaoApi.get('/notificacoes', { params });
    return data;
  },

  async contarNaoLidas(): Promise<{ count: number }> {
    const { data } = await gestaoApi.get('/notificacoes/count');
    return data;
  },

  async marcarLida(id: string): Promise<Notificacao> {
    const { data } = await gestaoApi.patch(`/notificacoes/${id}/lida`);
    return data;
  },

  async marcarTodasLidas(): Promise<{ marcadas: number }> {
    const { data } = await gestaoApi.patch('/notificacoes/ler-todas');
    return data;
  },

  async remover(id: string): Promise<void> {
    await gestaoApi.delete(`/notificacoes/${id}`);
  },
};
