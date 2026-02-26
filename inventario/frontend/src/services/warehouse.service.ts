import { inventarioApi } from './api';
import type { Warehouse, WarehouseSimple } from '../types';

export const warehouseService = {
  async listar(params?: Record<string, string>): Promise<Warehouse[]> {
    const { data } = await inventarioApi.get('/warehouses/', { params });
    return data;
  },

  async listarSimples(): Promise<WarehouseSimple[]> {
    const { data } = await inventarioApi.get('/warehouses/simple');
    return data;
  },

  async buscarPorId(id: string): Promise<Warehouse> {
    const { data } = await inventarioApi.get(`/warehouses/${id}`);
    return data;
  },

  async criar(payload: Record<string, unknown>): Promise<Warehouse> {
    const { data } = await inventarioApi.post('/warehouses/', payload);
    return data;
  },

  async atualizar(id: string, payload: Record<string, unknown>): Promise<Warehouse> {
    const { data } = await inventarioApi.put(`/warehouses/${id}`, payload);
    return data;
  },
};
