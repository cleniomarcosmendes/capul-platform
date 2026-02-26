import { inventarioApi } from './api';
import type { SyncStatus } from '../types';

export const syncService = {
  async getStatus(): Promise<SyncStatus> {
    try {
      const { data } = await inventarioApi.get('/sync/protheus/status');
      return data;
    } catch {
      // Endpoint may not exist — return default
      return { last_sync: null, status: 'Desconhecido', products_synced: 0, errors: 0 };
    }
  },

  async sincronizarHierarquia(): Promise<unknown> {
    const { data } = await inventarioApi.post('/sync/protheus/hierarchy');
    return data;
  },

  async sincronizarProdutos(): Promise<{ synced: number; errors: number }> {
    const { data } = await inventarioApi.post('/sync/protheus/products');
    return data;
  },

  async sincronizarEstoque(): Promise<{ synced: number; errors: number }> {
    try {
      const { data } = await inventarioApi.post('/sync/protheus/stock');
      return data;
    } catch {
      // Endpoint may not exist — use products sync as fallback
      const { data } = await inventarioApi.post('/sync/protheus/products');
      return data;
    }
  },
};
