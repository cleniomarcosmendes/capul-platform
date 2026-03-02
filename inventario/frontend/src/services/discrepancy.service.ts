import { inventarioApi } from './api';
import type { Discrepancy, ClosedRound, SavedAdjustmentItem } from '../types';

export const discrepancyService = {
  async listar(roundKey?: string): Promise<Discrepancy[]> {
    const params: Record<string, string> = {};
    if (roundKey) params.round_key = roundKey;
    const { data } = await inventarioApi.get('/discrepancies', { params });
    return Array.isArray(data) ? data : data.discrepancies ?? data.data ?? [];
  },

  async listarRodadas(): Promise<ClosedRound[]> {
    const { data } = await inventarioApi.get('/my-closed-rounds-simple');
    return Array.isArray(data) ? data : [];
  },

  async listarAjustes(inventoryId?: string): Promise<{ items: SavedAdjustmentItem[]; summary: { adjustments: number; transfers: number; total_value: number } }> {
    const params: Record<string, string> = {};
    if (inventoryId) params.inventory_id = inventoryId;
    const { data } = await inventarioApi.get('/discrepancies/adjustments', { params });
    return {
      items: data.items ?? [],
      summary: data.summary ?? { adjustments: 0, transfers: 0, total_value: 0 },
    };
  },

  async resolver(inventoryItemId: string, payload: {
    resolution_type: 'ACCEPT' | 'RECOUNT' | 'ADJUST';
    final_quantity?: number;
    notes?: string;
  }): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/discrepancies/${inventoryItemId}/resolve`, payload);
    return data;
  },
};
