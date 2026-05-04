import { inventarioApi } from './api';
import type {
  Integration,
  IntegrationHistory,
  IntegrationPreviewResult,
  IntegrationSaveResult,
  SendResult,
  SendAllResult,
  SendLogsResult,
} from '../types';

export type ProtheusError = {
  product_code: string | null;
  lot_number: string | null;
  warehouse: string | null;
  quantity: number | null;
  message: string | null;
};

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
        inventory_a_id: data.integration_info.inventory_a_id,
        inventory_b_id: data.integration_info.inventory_b_id,
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

  async detalhe(integrationId: string): Promise<{
    integration: Record<string, unknown>;
    items: unknown[];
    no_change_items?: unknown[];
    protheus_errors?: ProtheusError[];
  }> {
    const { data } = await inventarioApi.get(`/integration/protheus/${integrationId}`);
    return data;
  },

  async resetarErros(integrationId: string): Promise<{ success: boolean; reset_count: number; products: string[]; message: string }> {
    const { data } = await inventarioApi.post(`/integration/protheus/${integrationId}/reset-errors`);
    return data;
  },

  async cancelar(integrationId: string, reason: string): Promise<unknown> {
    const { data } = await inventarioApi.patch(`/integration/protheus/${integrationId}/cancel`, null, {
      params: { reason },
    });
    return data;
  },

  // === Envio para Protheus ===

  async enviarTransferencias(integrationId: string): Promise<SendResult> {
    const { data } = await inventarioApi.post(`/integration/protheus/send/${integrationId}/transferencias`);
    return data;
  },

  async enviarDigitacao(integrationId: string): Promise<SendResult> {
    const { data } = await inventarioApi.post(`/integration/protheus/send/${integrationId}/digitacao`);
    return data;
  },

  async enviarHistorico(integrationId: string): Promise<SendResult> {
    const { data } = await inventarioApi.post(`/integration/protheus/send/${integrationId}/historico`);
    return data;
  },

  async enviarTudo(integrationId: string): Promise<SendAllResult> {
    const { data } = await inventarioApi.post(`/integration/protheus/send/${integrationId}/enviar-tudo`);
    return data;
  },

  async historico(status?: string, limit?: number): Promise<{ history: IntegrationHistory[]; total: number }> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (limit) params.limit = String(limit);
    const { data } = await inventarioApi.get('/integration/protheus/history', { params });
    return data;
  },

  async buscarLogs(integrationId: string, endpoint?: string, status?: string): Promise<SendLogsResult> {
    const params: Record<string, string> = {};
    if (endpoint) params.endpoint = endpoint;
    if (status) params.status = status;
    const { data } = await inventarioApi.get(`/integration/protheus/send/${integrationId}/logs`, { params });
    return data;
  },
};
