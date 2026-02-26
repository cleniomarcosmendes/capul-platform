// === Auth types (compartilhados com plataforma) ===

export interface ModuloUsuario {
  codigo: string;
  nome: string;
  icone: string;
  cor: string;
  url: string;
  role: string;
  roleNome: string;
}

export interface FilialUsuario {
  id: string;
  codigo: string;
  nome: string;
}

export interface UsuarioLogado {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  departamento: { id: string; nome: string };
  filialAtual: FilialUsuario;
  modulos: ModuloUsuario[];
}

// === Paginated response wrapper ===

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// === Enums ===

export type InventoryStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
export type ListStatus = 'PREPARACAO' | 'LIBERADA' | 'EM_CONTAGEM' | 'ENCERRADA';
export type ItemStatus = 'PENDING' | 'COUNTED' | 'REVIEWED' | 'APPROVED' | 'ZERO_CONFIRMED';

// === Inventory List ===

export interface InventoryList {
  id: string;
  name: string;
  description: string;
  warehouse: string;
  status: InventoryStatus;
  list_status: string;
  current_cycle: number;
  reference_date: string | null;
  count_deadline: string | null;
  store_id: string;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  created_by_name: string;
  store_name: string;
  total_items: number;
  counted_items: number;
  pending_items?: number;
  progress_percentage: number;
}

export interface InventoryListCreate {
  name: string;
  description?: string;
  warehouse: string;
  reference_date?: string;
  count_deadline?: string;
  product_filters?: Record<string, unknown>;
}

export interface InventoryListUpdate {
  name?: string;
  description?: string;
  status?: InventoryStatus;
  list_status?: string;
  reference_date?: string;
  count_deadline?: string;
}

// === Inventory Item ===

export interface InventoryItem {
  id: string;
  inventory_list_id: string;
  product_id: string;
  sequence: number;
  expected_quantity: number;
  status: ItemStatus;
  last_counted_at: string | null;
  last_counted_by: string | null;
  created_at: string;
  product_code: string;
  product_name: string;
  product_unit: string;
  counted_quantity: number;
  variance: number;
  variance_percentage: number;
  count_rounds: number;
}

// === Counting List ===

export interface CountingList {
  id: string;
  inventory_id: string;
  list_name: string;
  description: string | null;
  current_cycle: number;
  list_status: ListStatus;
  counter_cycle_1: string | null;
  counter_cycle_2: string | null;
  counter_cycle_3: string | null;
  released_at: string | null;
  released_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  total_items?: number;
  counted_items?: number;
  pending_items?: number;
}

export interface CountingListCreate {
  list_name: string;
  description?: string;
  counter_cycle_1?: string;
  counter_cycle_2?: string;
  counter_cycle_3?: string;
}

// === Counting List Item (detail view) ===

export interface CountingListItem {
  id: string;
  product_code: string;
  product_description: string;
  expected_quantity: number;
  system_qty: number;
  counted_qty: number | null;
  status: string;
  count_cycle_1: number | null;
  count_cycle_2: number | null;
  count_cycle_3: number | null;
  needs_recount_cycle_1: boolean;
  needs_recount_cycle_2: boolean;
  needs_recount_cycle_3: boolean;
  last_counted_at: string | null;
  last_counted_by: string | null;
}

// === Counting (registro de contagem) ===

export interface Counting {
  id: string;
  inventory_item_id: string;
  quantity: number;
  lot_number: string;
  serial_number: string;
  observation: string;
  counted_by: string;
  count_number: number;
  created_at: string;
  updated_at: string | null;
}

export interface CountingCreate {
  quantity: number;
  lot_number?: string;
  serial_number?: string;
  observation?: string;
  location?: string;
}

// === Warehouse ===

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  store_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface WarehouseSimple {
  code: string;
  name: string;
}

// === Product ===

export interface Product {
  id: string;
  code: string;
  description: string;
  barcode: string | null;
  unit: string;
  expected_quantity: number;
  category: string | null;
  warehouse_id: string | null;
  store_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === Store ===

export interface Store {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === Protheus Product (from /api/v1/products) ===

export interface ProtheusProduct {
  id: string;
  b1_cod: string;
  b1_desc: string;
  b1_grupo: string;
  grupo_desc: string;
  b1_xcatgor: string;
  categoria_desc: string;
  b1_xsubcat: string;
  subcategoria_desc: string;
  b1_xsegmen: string;
  segmento_desc: string;
  b1_rastro: string;
  total_stock: number;
}

export interface ProtheusProductResponse {
  products: ProtheusProduct[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

// === Counting List Products Response ===

export interface CountingListProduct {
  id: string;
  product_code: string;
  product_name: string;
  product_description: string;
  warehouse: string;
  expected_quantity: number;
  system_qty: number;
  count_cycle_1: number | null;
  count_cycle_2: number | null;
  count_cycle_3: number | null;
  needs_count_cycle_1: boolean;
  needs_count_cycle_2: boolean;
  needs_count_cycle_3: boolean;
  status: string;
  last_counted_at: string | null;
  last_counted_by: string | null;
  sequence: number;
  created_at: string;
  finalQuantity: number | null;
}

export interface CountingListProductsResponse {
  data: {
    current_cycle: number;
    list_id: string;
    list_name: string;
    products: CountingListProduct[];
  };
}

// === Dashboard ===

export interface DashboardData {
  total_products: number;
  total_inventories: number;
  active_inventories: number;
  in_progress: number;
  completed_inventories: number;
  counted_items: number;
  pending_items: number;
  countings_today: number;
  countings_yesterday: number;
  divergences: number;
  progress: number;
  history: { date: string; count: number }[];
}

// === Sync ===

export interface SyncStatus {
  last_sync: string | null;
  status: string;
  products_synced: number;
  errors: number;
}
