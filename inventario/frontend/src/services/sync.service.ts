import { inventarioApi } from './api';
import type { SyncStatus } from '../types';

// Sync com Protheus pode levar minutos (millhares de produtos). Override
// timeout default de 30s pra 5min — alinhado com nginx proxy_read_timeout 300s
// em /api/v1/sync/ (audit Frente 6 #A2 — 10/05/2026).
const SYNC_TIMEOUT = 300_000;

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
    const { data } = await inventarioApi.post('/sync/protheus/hierarchy', undefined, { timeout: SYNC_TIMEOUT });
    return data;
  },

  async sincronizarProdutos(): Promise<{ synced: number; errors: number }> {
    const { data } = await inventarioApi.post('/sync/protheus/products', undefined, { timeout: SYNC_TIMEOUT });
    return data;
  },

  async sincronizarEstoque(): Promise<{ synced: number; errors: number }> {
    try {
      const { data } = await inventarioApi.post('/sync/protheus/stock', undefined, { timeout: SYNC_TIMEOUT });
      return data;
    } catch {
      // Endpoint may not exist — use products sync as fallback
      const { data } = await inventarioApi.post('/sync/protheus/products', undefined, { timeout: SYNC_TIMEOUT });
      return data;
    }
  },
};
