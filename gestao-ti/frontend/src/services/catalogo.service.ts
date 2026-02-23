import { gestaoApi } from './api';
import type { CatalogoServico } from '../types';

interface CreateCatalogoPayload {
  nome: string;
  descricao?: string;
  equipeId: string;
  prioridadePadrao?: string;
  slaPadraoHoras?: number;
  ordem?: number;
}

export const catalogoService = {
  async listar(equipeId?: string, status?: string): Promise<CatalogoServico[]> {
    const params: Record<string, string> = {};
    if (equipeId) params.equipeId = equipeId;
    if (status) params.status = status;
    const { data } = await gestaoApi.get('/catalogo-servicos', { params });
    return data;
  },

  async buscar(id: string): Promise<CatalogoServico> {
    const { data } = await gestaoApi.get(`/catalogo-servicos/${id}`);
    return data;
  },

  async criar(payload: CreateCatalogoPayload): Promise<CatalogoServico> {
    const { data } = await gestaoApi.post('/catalogo-servicos', payload);
    return data;
  },

  async atualizar(id: string, payload: Partial<CreateCatalogoPayload>): Promise<CatalogoServico> {
    const { data } = await gestaoApi.patch(`/catalogo-servicos/${id}`, payload);
    return data;
  },

  async atualizarStatus(id: string, status: 'ATIVO' | 'INATIVO'): Promise<CatalogoServico> {
    const { data } = await gestaoApi.patch(`/catalogo-servicos/${id}/status`, { status });
    return data;
  },
};
