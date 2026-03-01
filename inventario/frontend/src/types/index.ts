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
export type ListStatus = 'PREPARACAO' | 'ABERTA' | 'LIBERADA' | 'EM_CONTAGEM' | 'ENCERRADA';
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
  product_grupo?: string;
  product_categoria?: string;
  product_subcategoria?: string;
  product_segmento?: string;
  product_grupo_inv?: string;
  product_lote?: string;
  product_estoque?: number;
  product_entregas_post?: number;
  product_local1?: string;
  product_local2?: string;
  product_local3?: string;
  warehouse?: string;
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

// === Product Filter Options (from /api/v1/products/filters) ===

export interface FilterOption {
  codigo: string;
  descricao: string;
}

export interface ProductFilterOptions {
  grupos: FilterOption[];
  categorias: FilterOption[];
  subcategorias: FilterOption[];
  segmentos: FilterOption[];
  armazens: FilterOption[];
}

// === Filtered Product (from /api/v1/products/filter) ===

export interface FilteredProduct {
  b1_cod: string;
  b1_desc: string;
  b1_tipo: string;
  b1_um: string;
  b1_grupo: string;
  b1_xcatgor: string;
  b1_xsubcat: string;
  b1_xsegmen: string;
  b1_xgrinve: string;
  b1_rastro: string;
  b2_qatu: number;
  b2_xentpos: number;
  current_quantity: number;
  local1: string | null;
  local2: string | null;
  local3: string | null;
  has_lot: boolean;
  // Inventory status fields (from POST /inventory/filter-products)
  inventory_status?: 'AVAILABLE' | 'IN_CURRENT_INVENTORY' | 'IN_OTHER_INVENTORY';
  other_inventory_name?: string | null;
  is_in_other_inventory?: boolean;
  is_in_current_inventory?: boolean;
}

export interface FilteredProductResponse {
  products: FilteredProduct[];
  total: number;
  total_count: number;
  page: number;
  total_pages: number;
  limit: number;
  offset: number;
  filters_applied: Record<string, string | null>;
}

export interface InventoryFilterProductsResponse {
  produtos: FilteredProduct[];
  total: number;
  total_count: number;
  page: number;
  total_pages: number;
  size: number;
  has_next: boolean;
  has_prev: boolean;
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
  b2_xentpos: number;
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
  requires_lot?: boolean;
  has_lot?: boolean;
  snapshot_lots?: SnapshotLot[];
  location?: string | null;
}

export interface SnapshotLot {
  lot_number: string;
  b8_lotectl: string;
  b8_lotefor?: string;
  system_qty: number;
  counted_qty: number | null;
  barcode?: string;
}

export interface LotCount {
  lot_number: string;
  quantity: number;
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

// === Monitoring ===

export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface MonitoringHealth {
  status: string;
  active_inventories: number;
}

export interface MonitoringAnomaly {
  title: string;
  description: string;
  severity: AnomalySeverity;
  inventory_name?: string;
  counting_list_code?: string;
  affected_products?: number;
  detected_at: string;
}

export interface MonitoringAnomaliesResponse {
  summary: {
    total_anomalies: number;
    estimated_financial_risk: number;
    by_severity: Record<AnomalySeverity, number>;
  };
  anomalies: MonitoringAnomaly[];
}

// === Discrepancy ===

export interface Discrepancy {
  id: string;
  product_code: string;
  product_description: string;
  expected_quantity: number;
  counted_quantity?: number;
  variance_quantity: number;
  variance_percentage: number;
  tolerance_exceeded: boolean;
  status: 'PENDING' | 'RESOLVED';
  observation: string;
  inventory_name: string;
  created_at: string;
}

export interface ClosedRound {
  round_key: string;
  display_text: string;
}

// === Comparison ===

export interface ComparisonItem {
  product_code: string;
  description: string;
  tracking: string;
  lot_number: string | null;
  lot_supplier: string | null;
  expected_a: number;
  expected_b: number;
  counted_a: number;
  counted_b: number;
  divergence_a: number;
  divergence_b: number;
  saldo_ajustado_a: number;
  saldo_ajustado_b: number;
  diferenca_final_a: number;
  diferenca_final_b: number;
  transferencia_logica: {
    quantidade_transferida: number;
    origem: string;
    destino: string;
    economia_estimada: number;
    saldo_origem_antes: number;
    saldo_origem_depois: number;
    saldo_destino_antes: number;
    saldo_destino_depois: number;
  };
}

export interface ComparisonResult {
  matches: ComparisonItem[];
  manual_review: ComparisonItem[];
  transfers: ComparisonItem[];
  summary: {
    total_products: number;
    total_economy: number;
    zeroed_a: number;
    zeroed_b: number;
    reduced_a: number;
    reduced_b: number;
  };
  inventory_a: { id: string; name: string; warehouse: string };
  inventory_b: { id: string; name: string; warehouse: string };
}

// === Assignable Item (for counting list product assignment) ===

export interface AssignableItem {
  id: string;
  product_code: string;
  product_name: string;
  product_estoque: number;
  entregas_post: number;
  warehouse: string;
  grupo: string;
  categoria: string;
  subcategoria: string;
  segmento: string;
  grupo_inv: string;
  local1: string;
  local2: string;
  local3: string;
  lote: string;
  assignment_status: 'AVAILABLE' | 'IN_LIST' | 'IN_OTHER_LIST';
  assigned_list_name?: string | null;
}

export interface AssignableItemsResponse {
  items: AssignableItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
  total_available: number;
  total_in_list: number;
  total_in_other: number;
}
