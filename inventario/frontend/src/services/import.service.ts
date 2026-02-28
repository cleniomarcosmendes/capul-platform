import { inventarioApi } from './api';

// === Tipos ===

export interface TableSyncStats {
  inserted: number;
  updated: number;
  deleted: number;
  unchanged: number;
  total_api: number;
  total_db_after: number;
}

export interface HierarchySyncResult {
  success: boolean;
  timestamp: string;
  duration_seconds: number;
  tables: Record<string, TableSyncStats>;
  totals: { inserted: number; updated: number; deleted: number; unchanged: number };
  user?: { username: string; role: string };
}

export interface ProductImportStats {
  total_produtos: number;
  sb1_inserted: number;
  sb1_updated: number;
  sb2_inserted: number;
  sb2_updated: number;
  sb2_deleted: number;
  sb8_inserted: number;
  sb8_updated: number;
  sb8_deleted: number;
  sbz_inserted: number;
  sbz_updated: number;
  slk_inserted: number;
  slk_updated: number;
  errors: string[];
}

export interface ProductImportResult {
  success: boolean;
  message: string;
  armazens_processados: string[];
  armazens_com_erro: string[];
  stats: ProductImportStats;
}

export interface SimpleWarehouse {
  code: string;
  name: string;
}

// === Serviço ===

export const importService = {
  async syncHierarchy(): Promise<HierarchySyncResult> {
    const { data } = await inventarioApi.post('/sync/protheus/hierarchy');
    return data;
  },

  async getWarehouses(): Promise<SimpleWarehouse[]> {
    const { data } = await inventarioApi.get('/warehouses/simple');
    return data;
  },

  async importProducts(filial: string, armazens: string[]): Promise<ProductImportResult> {
    const params = new URLSearchParams();
    params.append('filial', filial);
    armazens.forEach((a) => params.append('armazem', a));
    const { data } = await inventarioApi.post(`/import-produtos?${params.toString()}`);
    return data;
  },
};
