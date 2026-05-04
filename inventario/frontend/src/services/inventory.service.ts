import { inventarioApi } from './api';
import { calcularQuantidadeFinal } from '../utils/cycles';
import type {
  PaginatedResponse,
  InventoryList,
  InventoryListCreate,
  InventoryListUpdate,
  InventoryItem,
  InventoryFilterProductsResponse,
  AssignableItemsResponse,
} from '../types';

export const inventoryService = {
  // === Inventarios ===

  async listar(params?: Record<string, string>): Promise<PaginatedResponse<InventoryList>> {
    const { data } = await inventarioApi.get('/inventory/lists', { params });
    // Backend returns { items: [...], total, page, size }
    return { items: data.items ?? data.data ?? [], total: data.total ?? 0, page: data.page ?? 1, size: data.size ?? 20 };
  },

  async listarDisponiveisIntegracao(): Promise<{ items: InventoryList[]; total: number }> {
    const { data } = await inventarioApi.get('/inventory/lists/available-for-integration');
    return { items: data.items ?? [], total: data.total ?? 0 };
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

  async finalizarInventario(id: string, closureNotes?: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/lists/${id}/finalize-inventory`, {
      closure_notes: closureNotes ?? '',
      finalize_type: 'COMPLETE_INVENTORY',
    });
    return data;
  },

  async marcarAnalisado(id: string): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/lists/${id}/marcar-analisado`);
    return data;
  },

  // === Itens do Inventario ===

  async listarItens(inventoryId: string, params?: Record<string, string>): Promise<PaginatedResponse<InventoryItem>> {
    const { data } = await inventarioApi.get(`/inventory/lists/${inventoryId}/items`, { params });
    // Backend returns { success, data: { items: [...], total_items, ... } }
    const inner = data.data ?? {};
    const rawItems = Array.isArray(inner) ? inner : inner.items ?? [];
    // Compute counted_quantity, variance, variance_percentage from cycle data
    const items: InventoryItem[] = rawItems.map((item: Record<string, unknown>) => {
      const expected = (item.expected_quantity as number) ?? 0;
      const c1 = item.count_cycle_1 as number | null;
      const c2 = item.count_cycle_2 as number | null;
      const c3 = item.count_cycle_3 as number | null;
      const status = item.status as string;
      const counted = status !== 'PENDING' || c1 != null
        ? calcularQuantidadeFinal(c1, c2, c3, expected)
        : 0;
      const variance = counted - expected;
      const variancePct = expected !== 0 ? (variance / expected) * 100 : (counted !== 0 ? 100 : 0);
      return {
        ...item,
        counted_quantity: counted,
        variance,
        variance_percentage: variancePct,
        count_rounds: (c1 != null ? 1 : 0) + (c2 != null ? 1 : 0) + (c3 != null ? 1 : 0),
      } as InventoryItem;
    });
    return { items, total: inner.total_items ?? data.total ?? 0, page: data.page ?? 1, size: data.size ?? 50 };
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

  async adicionarProdutosPorCodigos(
    inventoryId: string,
    productCodes: string[],
  ): Promise<{ success: boolean; message: string; summary: { added_count: number; skipped_duplicates: number; total_selected: number; error_count: number }; details: { duplicates: { code: string; name: string }[]; errors: string[] } }> {
    const { data } = await inventarioApi.post(`/inventory/lists/${inventoryId}/add-products`, {
      product_codes: productCodes,
    });
    // Backend wraps in safe_json_response: { success, data: { success, message, summary... }, timestamp }
    return data.data ?? data;
  },

  // === Filtrar produtos para inventario (com status de inventario) ===

  async filtrarProdutosParaInventario(
    filters: Record<string, unknown>,
  ): Promise<InventoryFilterProductsResponse> {
    const { data } = await inventarioApi.post('/inventory/filter-products', filters);
    return data;
  },

  async filtrarProdutosCodigos(
    filters: Record<string, unknown>,
  ): Promise<{ codes: string[]; total: number }> {
    const { data } = await inventarioApi.post('/inventory/filter-products/codes', filters);
    return data;
  },

  // === Contagem ===

  async registrarContagem(itemId: string, payload: {
    quantity: number;
    lot_number?: string;
    observation?: string;
    lot_counts?: { lot_number: string; quantity: number }[];
  }): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/items/${itemId}/count`, payload);
    return data;
  },

  async buscarLotesSnapshot(itemId: string): Promise<{
    has_lots: boolean;
    lots: { lot_number: string; b8_lotectl: string; b8_lotefor?: string; system_qty: number; counted_qty: number | null; barcode?: string }[];
    product_code?: string;
    product_description?: string;
  }> {
    const { data } = await inventarioApi.get(`/inventory/items/${itemId}/lots-snapshot`);
    return data?.data ?? data;
  },

  async listarContagens(itemId: string): Promise<unknown[]> {
    const { data } = await inventarioApi.get(`/inventory/items/${itemId}/counts`);
    return data;
  },

  async fecharRodada(inventoryId: string, countRound: number): Promise<unknown> {
    const { data } = await inventarioApi.post(`/inventory/lists/${inventoryId}/close-counting-round?count_round=${countRound}`);
    return data;
  },

  // === Itens para atribuicao a listas de contagem ===

  async gerarRelatorioFinal(inventoryId: string): Promise<import('../types').FinalReport> {
    const { data } = await inventarioApi.get(`/inventory/lists/${inventoryId}/final-report`);
    return data;
  },

  // === Historico de contagens ===

  async buscarHistoricoContagem(itemId: string): Promise<import('../types').CountingHistoryResponse> {
    const { data } = await inventarioApi.get(`/counting/item/${itemId}/history`);
    return data;
  },

  // === Zero confirmation ===

  async buscarZerosPendentes(inventoryId: string): Promise<import('../types').PendingZeroResponse> {
    const { data } = await inventarioApi.get(`/inventory/lists/${inventoryId}/pending-zero-expected`);
    return data;
  },

  async confirmarZeros(inventoryId: string): Promise<import('../types').ConfirmZeroResponse> {
    const { data } = await inventarioApi.post(`/inventory/lists/${inventoryId}/confirm-zero-expected`);
    return data;
  },

  // === Itens para atribuicao a listas de contagem ===

  async listarItensParaAtribuicao(
    inventoryId: string,
    params: Record<string, string | number | undefined>,
  ): Promise<AssignableItemsResponse> {
    // Remove undefined values
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') clean[k] = v;
    }
    const { data } = await inventarioApi.get(`/inventories/${inventoryId}/items-for-assignment`, { params: clean });
    return data;
  },

  async listarIdsParaAtribuicao(
    inventoryId: string,
    params: Record<string, string | number | undefined>,
  ): Promise<{ ids: string[]; total: number }> {
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') clean[k] = v;
    }
    const { data } = await inventarioApi.get(`/inventories/${inventoryId}/items-for-assignment/ids`, { params: clean });
    return data;
  },
};
