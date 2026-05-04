import { inventarioApi } from './api';
import type { CountingList, CountingListCreate, CountingListProductsResponse } from '../types';

export interface AvailableCounter {
  user_id: string;
  username: string;
  full_name: string;
  role: string;
  is_current_user: boolean;
}

export const countingListService = {
  async listarContadoresDisponiveis(inventoryId: string): Promise<AvailableCounter[]> {
    const { data } = await inventarioApi.get(`/inventory/lists/${inventoryId}/available-counters`);
    return data.available_counters ?? [];
  },

  async listar(inventoryId: string): Promise<CountingList[]> {
    const { data } = await inventarioApi.get(`/inventories/${inventoryId}/counting-lists`);
    // Backend returns total_products/counted_items; frontend expects total_items/counted_items
    const lists = Array.isArray(data) ? data : [];
    return lists.map((l: Record<string, unknown>) => ({
      ...l,
      total_items: l.total_products ?? l.total_items ?? 0,
    })) as CountingList[];
  },

  async buscarPorId(listId: string): Promise<CountingList> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}`);
    return data;
  },

  async criar(inventoryId: string, payload: CountingListCreate): Promise<CountingList> {
    const { data } = await inventarioApi.post(`/inventories/${inventoryId}/counting-lists`, payload);
    return data;
  },

  async atualizar(listId: string, payload: Partial<CountingListCreate>): Promise<CountingList> {
    const { data } = await inventarioApi.put(`/counting-lists/${listId}`, payload);
    return data;
  },

  async atualizarStatus(listId: string, listStatus: string): Promise<CountingList> {
    const { data } = await inventarioApi.put(`/counting-lists/${listId}/status`, { list_status: listStatus });
    return data;
  },

  async adicionarItens(listId: string, itemIds: string[]): Promise<unknown> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/items`, itemIds);
    return data;
  },

  async listarItens(listId: string, showAll = false): Promise<CountingListProductsResponse> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}/products`, {
      params: { show_all: showAll },
    });
    // Backend returns { success, data: { products, current_cycle, list_id, list_name, show_previous_counts } }
    const inner = data?.data ?? data;
    return {
      data: {
        products: inner?.products ?? inner?.items ?? [],
        current_cycle: inner?.current_cycle ?? inner?.list_info?.current_cycle ?? 1,
        list_id: inner?.list_id ?? inner?.list_info?.list_id ?? '',
        list_name: inner?.list_name ?? inner?.list_info?.list_name ?? '',
        show_previous_counts: Boolean(inner?.show_previous_counts),
      },
    };
  },

  async listarMeusItens(listId: string): Promise<unknown> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}/my-items`);
    return data;
  },

  async listarMinhasListas(): Promise<{
    items: Array<{
      id: string;
      list_name: string;
      current_cycle: number;
      list_status: string;
      sort_order: string;
      show_previous_counts: boolean;
      inventory_id: string;
      inventory_name: string;
      warehouse: string;
      count_deadline: string | null;
      reference_date: string | null;
      total_items: number;
      counted_items: number;
      pending_items: number;
      progress_percentage: number;
    }>;
    total: number;
  }> {
    const { data } = await inventarioApi.get('/counting-lists/me');
    return data;
  },

  async liberar(
    listId: string,
    showPreviousCounts = false,
    sortOrder: 'ORIGINAL' | 'PRODUCT_CODE' | 'PRODUCT_DESCRIPTION' | 'LOCAL1' | 'LOCAL2' | 'LOCAL3' = 'ORIGINAL',
  ): Promise<unknown> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/release`, {
      show_previous_counts: showPreviousCounts,
      sort_order: sortOrder,
    });
    return data;
  },

  async finalizarCiclo(listId: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/finalize-cycle`);
    return data;
  },

  async finalizar(listId: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/finalizar`);
    return data;
  },

  async excluir(listId: string): Promise<void> {
    await inventarioApi.delete(`/counting-lists/${listId}`);
  },

  async liberarParaSupervisor(listId: string): Promise<{ status: string; zerados: number }> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/handoff`);
    return data;
  },

  async devolverAoContador(
    listId: string,
    motivo?: string,
    itemIds?: string[],
    sortOrder?: 'ORIGINAL' | 'PRODUCT_CODE' | 'PRODUCT_DESCRIPTION' | 'LOCAL1' | 'LOCAL2' | 'LOCAL3',
  ): Promise<{ status: string; itens_marcados: number; parcial: boolean }> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/return`, {
      motivo: motivo || undefined,
      item_ids: itemIds && itemIds.length > 0 ? itemIds : undefined,
      sort_order: sortOrder,
    });
    return data;
  },

  async historicoHandoffs(listId: string): Promise<HandoffEvent[]> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}/handoff-history`);
    return Array.isArray(data) ? data : [];
  },

  async contarAguardandoRevisao(): Promise<number> {
    try {
      const { data } = await inventarioApi.get('/counting-lists/aguardando-revisao/count');
      return Number(data?.count || 0);
    } catch {
      return 0;
    }
  },
};

export interface HandoffEvent {
  id: string;
  evento: 'ENTREGUE' | 'DEVOLVIDA' | 'FINALIZADA' | 'ENCERRADA';
  ciclo: number;
  ator_id: string;
  ator_nome: string;
  observacao: string | null;
  itens_devolvidos: string[] | null;
  created_at: string | null;
}
