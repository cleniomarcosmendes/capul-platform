import { inventarioApi } from './api';
import type {
  PaginatedResponse,
  InventoryList,
  InventoryListCreate,
  InventoryListUpdate,
  InventoryItem,
} from '../types';

export const inventoryService = {
  // === Inventarios ===

  async listar(params?: Record<string, string>): Promise<PaginatedResponse<InventoryList>> {
    const { data } = await inventarioApi.get('/inventory/lists', { params });
    // Backend returns { success, data: [...], total, page, size, pages }
    return { items: data.data ?? [], total: data.total ?? 0, page: data.page ?? 1, size: data.size ?? 20 };
  },

  async buscarPorId(id: string): Promise<InventoryList> {
    const { data } = await inventarioApi.get(`/inventory/lists/${id}`);
    return data;
  },

  async criar(payload: InventoryListCreate): Promise<InventoryList> {
    const { data } = await inventarioApi.post('/inventory/lists', payload);
    return data;
  },

  async atualizar(id: string, payload: InventoryListUpdate): Promise<InventoryList> {
    const { data } = await inventarioApi.put(`/inventory/lists/${id}`, payload);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await inventarioApi.delete(`/inventory/lists/${id}`);
  },

  // === Itens do Inventario ===

  async listarItens(inventoryId: string, params?: Record<string, string>): Promise<PaginatedResponse<InventoryItem>> {
    const { data } = await inventarioApi.get(`/inventory/lists/${inventoryId}/items`, { params });
    // Backend returns { success, data: [...], total, page, size, pages }
    return { items: data.data ?? [], total: data.total ?? 0, page: data.page ?? 1, size: data.size ?? 50 };
  },

  async adicionarItem(inventoryId: string, payload: { product_id: number; expected_quantity?: number; sequence?: number }): Promise<InventoryItem> {
    const { data } = await inventarioApi.post(`/inventory/lists/${inventoryId}/items`, payload);
    return data;
  },

  async adicionarItensBulk(
    inventoryId: string,
    items: { product_id: number; expected_quantity?: number }[],
  ): Promise<{ added: number; errors: string[] }> {
    const errors: string[] = [];
    let added = 0;
    for (const item of items) {
      try {
        await inventarioApi.post(`/inventory/lists/${inventoryId}/items`, item);
        added++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Erro product_id ${item.product_id}`;
        errors.push(msg);
      }
    }
    return { added, errors };
  },

  // === Contagem ===

  async registrarContagem(itemId: string, payload: { quantity: number; lot_number?: string; observation?: string }): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/items/${itemId}/count`, payload);
    return data;
  },

  async listarContagens(itemId: string): Promise<unknown[]> {
    const { data } = await inventarioApi.get(`/inventory/items/${itemId}/counts`);
    return data;
  },

  async fecharRodada(inventoryId: string, countRound: number): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/lists/${inventoryId}/close-counting-round?count_round=${countRound}`);
    return data;
  },

  // === Distribuicao automatica ===

  async distribuirProdutos(inventoryId: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/${inventoryId}/distribute-products`);
    return data;
  },
};
