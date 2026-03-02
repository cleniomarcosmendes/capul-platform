import { inventarioApi } from './api';
import type {
  Integration,
  IntegrationPreviewResult,
  IntegrationSaveResult,
} from '../types';

export const integrationService = {
  async listarCompativeis(inventoryId: string): Promise<unknown[]> {
    const { data } = await inventarioApi.get(`/integration/protheus/compatible-inventories/${inventoryId}`);
    return data;
  },

  async buscarExistente(inventoryId: string): Promise<Integration | null> {
    try {
      const { data } = await inventarioApi.get(`/integration/protheus/existing-integration/${inventoryId}`);
      // Backend retorna { has_integration: bool, integration_info?: { id, status, ... } }
      if (!data?.has_integration || !data?.integration_info) return null;
      return {
        id: data.integration_info.id,
        status: data.integration_info.status,
        integration_type: data.integration_info.integration_type,
        created_at: data.integration_info.created_at,
        sent_at: data.integration_info.sent_at,
        confirmed_at: data.integration_info.confirmed_at,
      } as Integration;
    } catch {
      return null;
    }
  },

  async preview(
    inventoryAId: string,
    inventoryBId?: string,
    viewOnly?: boolean,
  ): Promise<IntegrationPreviewResult> {
    const params: Record<string, string> = { inventory_a_id: inventoryAId };
    if (inventoryBId) params.inventory_b_id = inventoryBId;
    if (viewOnly) params.view_only = 'true';
    const { data } = await inventarioApi.post('/integration/protheus/preview', null, { params });
    return data;
  },

  async salvar(
    inventoryAId: string,
    inventoryBId?: string,
  ): Promise<IntegrationSaveResult> {
    const params: Record<string, string> = { inventory_a_id: inventoryAId };
    if (inventoryBId) params.inventory_b_id = inventoryBId;
    const { data } = await inventarioApi.post('/integration/protheus/save', null, { params });
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
