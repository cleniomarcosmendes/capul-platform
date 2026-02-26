import { inventarioApi } from './api';
import type { CountingList, CountingListCreate, CountingListProductsResponse } from '../types';

export const countingListService = {
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

  async listarItens(listId: string): Promise<CountingListProductsResponse> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}/items`);
    // Backend returns { success, data: { items, total_items, list_info: { list_id, list_name, current_cycle } } }
    // Frontend expects { data: { products, current_cycle, list_id, list_name } }
    const inner = data?.data ?? data;
    return {
      data: {
        products: inner?.items ?? inner?.products ?? [],
        current_cycle: inner?.list_info?.current_cycle ?? inner?.current_cycle ?? 1,
        list_id: inner?.list_info?.list_id ?? inner?.list_id ?? '',
        list_name: inner?.list_info?.list_name ?? inner?.list_name ?? '',
      },
    };
  },

  async listarMeusItens(listId: string): Promise<unknown> {
    const { data } = await inventarioApi.get(`/counting-lists/${listId}/my-items`);
    return data;
  },

  async liberar(listId: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/counting-lists/${listId}/release`);
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
};
