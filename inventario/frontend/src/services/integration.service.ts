import { inventarioApi } from './api';

export interface IntegrationPreview {
  inventory_id: string;
  inventory_name: string;
  warehouse: string;
  total_items: number;
  items: Array<{
    product_code: string;
    product_name: string;
    expected_quantity: number;
    counted_quantity: number;
    variance: number;
  }>;
}

export interface Integration {
  id: string;
  inventory_id: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  items_count: number;
}

export const integrationService = {
  async listarCompativeis(inventoryId: string): Promise<unknown[]> {
    const { data } = await inventarioApi.get(`/integration/protheus/compatible-inventories/${inventoryId}`);
    return data;
  },

  async buscarExistente(inventoryId: string): Promise<Integration | null> {
    try {
      const { data } = await inventarioApi.get(`/integration/protheus/existing-integration/${inventoryId}`);
      return data;
    } catch {
      return null;
    }
  },

  async preview(inventoryId: string): Promise<IntegrationPreview> {
    const { data } = await inventarioApi.post('/integration/protheus/preview', { inventory_id: inventoryId });
    return data;
  },

  async salvar(inventoryId: string): Promise<Integration> {
    const { data } = await inventarioApi.post('/integration/protheus/save', { inventory_id: inventoryId });
    return data;
  },

  async enviar(integrationId: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/integration/protheus/send/${integrationId}`);
    return data;
  },

  async buscarPorId(integrationId: string): Promise<Integration> {
    const { data } = await inventarioApi.get(`/integration/protheus/${integrationId}`);
    return data;
  },

  async cancelar(integrationId: string): Promise<unknown> {
    const { data } = await inventarioApi.patch(`/integration/protheus/${integrationId}/cancel`);
    return data;
  },
};
