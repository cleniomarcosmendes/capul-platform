import { coreApi } from './api';
import type { Empresa } from '../types';

export const empresaService = {
  async listar(): Promise<Empresa[]> {
    const { data } = await coreApi.get('/empresas');
    return data;
  },

  async buscar(id: string): Promise<Empresa> {
    const { data } = await coreApi.get(`/empresas/${id}`);
    return data;
  },

  async criar(dto: Partial<Empresa>): Promise<Empresa> {
    const { data } = await coreApi.post('/empresas', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<Empresa>): Promise<Empresa> {
    const { data } = await coreApi.patch(`/empresas/${id}`, dto);
    return data;
  },
};
