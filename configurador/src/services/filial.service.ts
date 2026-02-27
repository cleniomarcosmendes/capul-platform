import { coreApi } from './api';
import type { Filial } from '../types';

export const filialService = {
  async listar(empresaId?: string): Promise<Filial[]> {
    const params = empresaId ? { empresaId } : {};
    const { data } = await coreApi.get('/filiais', { params });
    return data;
  },

  async buscar(id: string): Promise<Filial> {
    const { data } = await coreApi.get(`/filiais/${id}`);
    return data;
  },

  async criar(dto: Partial<Filial>): Promise<Filial> {
    const { data } = await coreApi.post('/filiais', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<Filial>): Promise<Filial> {
    const { data } = await coreApi.patch(`/filiais/${id}`, dto);
    return data;
  },
};
