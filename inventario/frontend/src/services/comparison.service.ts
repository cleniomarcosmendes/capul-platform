import { inventarioApi } from './api';
import type { ComparisonResult, InventoryList } from '../types';

export const comparisonService = {
  async comparar(invAId: string, invBId: string): Promise<ComparisonResult> {
    const { data } = await inventarioApi.post(
      `/inventory/compare?inventory_a_id=${invAId}&inventory_b_id=${invBId}`,
    );
    return data;
  },

  async listarDisponiveis(inventoryId: string): Promise<InventoryList[]> {
    const { data } = await inventarioApi.get(`/inventory/available-for-comparison/${inventoryId}`);
    return Array.isArray(data) ? data : data.inventories ?? [];
  },
};
