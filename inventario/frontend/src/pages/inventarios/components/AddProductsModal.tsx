import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Filter, Loader2 } from 'lucide-react';
import { productService } from '../../../services/product.service';
import { inventoryService } from '../../../services/inventory.service';
import type { ProductFilterOptions, FilteredProduct, FilterOption } from '../../../types';

interface Props {
  inventoryId: string;
  warehouse?: string;
  onClose: () => void;
  onAdded: () => void;
}

// === Unified display product ===
type InventoryStatus = 'AVAILABLE' | 'IN_CURRENT_INVENTORY' | 'IN_OTHER_INVENTORY';

interface DisplayProduct {
  code: string;
  description: string;
  local: string;
  estoque: number;
  entregasPost: number;
  grupo: string;
  grupoInv: string;
  categoria: string;
  subcategoria: string;
  segmento: string;
  local1: string;
  local2: string;
  local3: string;
  lote: string;
  inventoryStatus: InventoryStatus;
  otherInventoryName?: string;
}

function fromFiltered(p: FilteredProduct, warehouse?: string): DisplayProduct {
  return {
    code: (p.b1_cod || '').trim(),
    description: p.b1_desc,
    local: warehouse || '',
    estoque: p.current_quantity,
    entregasPost: p.b2_xentpos || 0,
    grupo: p.b1_grupo,
    grupoInv: p.b1_xgrinve || '',
    categoria: p.b1_xcatgor,
    subcategoria: p.b1_xsubcat || '',
    segmento: p.b1_xsegmen || '',
    local1: p.local1 || '',
    local2: p.local2 || '',
    local3: p.local3 || '',
    lote: p.b1_rastro === 'L' ? 'Sim' : p.b1_rastro === 'S' ? 'Serie' : '',
    inventoryStatus: p.inventory_status || 'AVAILABLE',
    otherInventoryName: p.other_inventory_name || undefined,
  };
}

// === Range filter state ===
interface RangeFilter {
  from: string;
  to: string;
}

const emptyRange = (): RangeFilter => ({ from: '', to: '' });

interface AdvancedFilters {
  grupo: RangeFilter;
  categoria: RangeFilter;
  subcategoria: RangeFilter;
  segmento: RangeFilter;
  grupoInv: RangeFilter;
  local1: RangeFilter;
  local2: RangeFilter;
  local3: RangeFilter;
}

const emptyFilters = (): AdvancedFilters => ({
  grupo: emptyRange(),
  categoria: emptyRange(),
  subcategoria: emptyRange(),
  segmento: emptyRange(),
  grupoInv: emptyRange(),
  local1: emptyRange(),
  local2: emptyRange(),
  local3: emptyRange(),
});

function countActiveFilters(f: AdvancedFilters): number {
  let count = 0;
  for (const val of Object.values(f)) {
    if ((val as RangeFilter).from || (val as RangeFilter).to) count++;
  }
  return count;
}

/** Returns true if range has DE > ATE (invalid) */
function isRangeInvalid(r: RangeFilter): boolean {
  if (!r.from || !r.to) return false;
  return r.from > r.to;
}

/** Returns keys of filters that have invalid ranges */
function getInvalidRanges(f: AdvancedFilters): (keyof AdvancedFilters)[] {
  const invalid: (keyof AdvancedFilters)[] = [];
  for (const [key, val] of Object.entries(f)) {
    if (isRangeInvalid(val as RangeFilter)) invalid.push(key as keyof AdvancedFilters);
  }
  return invalid;
}

// === Status config ===
const statusConfig: Record<InventoryStatus, { label: string; rowClass: string; badgeClass: string }> = {
  AVAILABLE: { label: 'Disponivel', rowClass: '', badgeClass: '' },
  IN_CURRENT_INVENTORY: { label: 'Ja adicionado', rowClass: 'bg-blue-50/60', badgeClass: 'bg-blue-100 text-blue-700' },
  IN_OTHER_INVENTORY: { label: 'Em outro inventario', rowClass: 'bg-amber-50/60', badgeClass: 'bg-amber-100 text-amber-700' },
};

export function AddProductsModal({ inventoryId, warehouse, onClose, onAdded }: Props) {
  const [visible, setVisible] = useState(false);

  // Search mode
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);

  // Basic search
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Advanced filters
  const [filters, setFilters] = useState<AdvancedFilters>(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(emptyFilters());
  const [filterOptions, setFilterOptions] = useState<ProductFilterOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const filterOptionsLoaded = useRef(false);

  // Products
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Save
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    added: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const PAGE_SIZE = 50;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Load filter options lazily when panel first opens
  useEffect(() => {
    if (showAdvancedPanel && !filterOptionsLoaded.current) {
      filterOptionsLoaded.current = true;
      setLoadingOptions(true);
      productService.obterOpcoesFiltro()
        .then(setFilterOptions)
        .catch(() => {})
        .finally(() => setLoadingOptions(false));
    }
  }, [showAdvancedPanel]);

  // Load products — ALWAYS uses POST /inventory/filter-products for inventory status
  const loadProducts = useCallback(() => {
    setLoading(true);
    const body: Record<string, unknown> = {
      page,
      size: PAGE_SIZE,
      inventory_id: inventoryId,
    };
    if (warehouse) body.local = warehouse;

    // Basic text search
    if (!isAdvancedMode && search) {
      body.descricao = search;
    }

    // Advanced range filters
    if (isAdvancedMode) {
      const f = appliedFilters;
      if (f.grupo.from) body.grupo_de = f.grupo.from;
      if (f.grupo.to) body.grupo_ate = f.grupo.to;
      if (f.categoria.from) body.categoria_de = f.categoria.from;
      if (f.categoria.to) body.categoria_ate = f.categoria.to;
      if (f.subcategoria.from) body.subcategoria_de = f.subcategoria.from;
      if (f.subcategoria.to) body.subcategoria_ate = f.subcategoria.to;
      if (f.segmento.from) body.segmento_de = f.segmento.from;
      if (f.segmento.to) body.segmento_ate = f.segmento.to;
      if (f.grupoInv.from) body.grupo_inv_de = f.grupoInv.from;
      if (f.grupoInv.to) body.grupo_inv_ate = f.grupoInv.to;
      if (f.local1.from) body.local1_from = f.local1.from;
      if (f.local1.to) body.local1_to = f.local1.to;
      if (f.local2.from) body.local2_from = f.local2.from;
      if (f.local2.to) body.local2_to = f.local2.to;
      if (f.local3.from) body.local3_from = f.local3.from;
      if (f.local3.to) body.local3_to = f.local3.to;
    }

    inventoryService.filtrarProdutosParaInventario(body)
      .then((res) => {
        setProducts((res.produtos || []).map((p) => fromFiltered(p, warehouse)));
        setTotalCount(res.total_count || 0);
        setTotalPages(res.total_pages || 1);
      })
      .catch(() => {
        setProducts([]);
        setTotalCount(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [page, search, isAdvancedMode, appliedFilters, inventoryId, warehouse]);

  // Trigger data load on mode/page/search change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // === Search handlers ===
  function handleBasicSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleApplyFilters() {
    const invalidKeys = getInvalidRanges(filters);
    if (invalidKeys.length > 0) return;
    setAppliedFilters({ ...filters });
    setIsAdvancedMode(true);
    setPage(1);
    setResult(null);
  }

  const hasInvalidRanges = getInvalidRanges(filters).length > 0;

  function handleClearFilters() {
    const empty = emptyFilters();
    setFilters(empty);
    setAppliedFilters(empty);
    setIsAdvancedMode(false);
    setPage(1);
    setResult(null);
  }

  // === Selection (skip products already in current inventory) ===
  const selectableProducts = products.filter((p) => p.inventoryStatus !== 'IN_CURRENT_INVENTORY');

  function toggleSelect(code: string) {
    const p = products.find((x) => x.code === code);
    if (p && p.inventoryStatus === 'IN_CURRENT_INVENTORY') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectableProducts.every((p) => selected.has(p.code))) {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableProducts.forEach((p) => next.delete(p.code));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableProducts.forEach((p) => next.add(p.code));
        return next;
      });
    }
  }

  const allOnPageSelected = selectableProducts.length > 0 && selectableProducts.every((p) => selected.has(p.code));

  // === Select all from filter (all pages) ===
  const [loadingAllCodes, setLoadingAllCodes] = useState(false);

  function buildFilterBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { inventory_id: inventoryId };
    if (warehouse) body.local = warehouse;
    if (!isAdvancedMode && search) body.descricao = search;
    if (isAdvancedMode) {
      const f = appliedFilters;
      if (f.grupo.from) body.grupo_de = f.grupo.from;
      if (f.grupo.to) body.grupo_ate = f.grupo.to;
      if (f.categoria.from) body.categoria_de = f.categoria.from;
      if (f.categoria.to) body.categoria_ate = f.categoria.to;
      if (f.subcategoria.from) body.subcategoria_de = f.subcategoria.from;
      if (f.subcategoria.to) body.subcategoria_ate = f.subcategoria.to;
      if (f.segmento.from) body.segmento_de = f.segmento.from;
      if (f.segmento.to) body.segmento_ate = f.segmento.to;
      if (f.grupoInv.from) body.grupo_inv_de = f.grupoInv.from;
      if (f.grupoInv.to) body.grupo_inv_ate = f.grupoInv.to;
      if (f.local1.from) body.local1_from = f.local1.from;
      if (f.local1.to) body.local1_to = f.local1.to;
      if (f.local2.from) body.local2_from = f.local2.from;
      if (f.local2.to) body.local2_to = f.local2.to;
      if (f.local3.from) body.local3_from = f.local3.from;
      if (f.local3.to) body.local3_to = f.local3.to;
    }
    return body;
  }

  async function handleSelectAllFromFilter() {
    setLoadingAllCodes(true);
    try {
      const res = await inventoryService.filtrarProdutosCodigos(buildFilterBody());
      if (res.codes.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const code of res.codes) next.add(code.trim());
          return next;
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAllCodes(false);
    }
  }

  // === Add products ===
  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    setResult(null);

    try {
      const res = await inventoryService.adicionarProdutosPorCodigos(
        inventoryId,
        Array.from(selected),
      );
      const summary = res.summary || { added_count: 0, skipped_duplicates: 0, error_count: 0 };
      setResult({
        success: res.success,
        message: res.message || '',
        added: summary.added_count,
        skipped: summary.skipped_duplicates,
        errors: summary.error_count,
      });
      if (summary.added_count > 0) {
        setSelected(new Set());
        onAdded();
        // Reload to update inventory status
        loadProducts();
      }
    } catch {
      setResult({ success: false, message: 'Erro inesperado ao adicionar produtos.', added: 0, skipped: 0, errors: 1 });
    } finally {
      setSaving(false);
    }
  }

  // === Close ===
  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const activeFilterCount = countActiveFilters(appliedFilters);
  const skeletonRows = Array.from({ length: 20 }, (_, i) => i);
  const colCount = 16;

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible ? 'bg-black/40' : 'bg-transparent'}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`absolute inset-4 md:inset-6 lg:inset-8 bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Adicionar Produtos</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.size > 0
                ? `${selected.size} produto${selected.size !== 1 ? 's' : ''} selecionado${selected.size !== 1 ? 's' : ''}`
                : `Selecione os produtos para adicionar ao inventario${warehouse ? ` (Armazem ${warehouse})` : ''}`}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + filter toggle */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 space-y-2">
          <form onSubmit={handleBasicSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por codigo ou descricao..."
                disabled={isAdvancedMode}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={isAdvancedMode}
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              Buscar
            </button>
          </form>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-capul-600 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filtro Avancado</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-capul-100 text-capul-700 text-xs font-medium rounded-full">
                  {activeFilterCount}
                </span>
              )}
              {showAdvancedPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isAdvancedMode && (
              <p className="text-xs text-amber-600">
                Filtros avancados ativos — busca textual desabilitada.
              </p>
            )}
          </div>
        </div>

        {/* Advanced filter panel (collapsible) */}
        {showAdvancedPanel && (
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            {loadingOptions ? (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando opcoes de filtro...
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FilterRangeSelect
                    label="Grupo"
                    options={filterOptions?.grupos || []}
                    value={filters.grupo}
                    onChange={(v) => setFilters((prev) => ({ ...prev, grupo: v }))}
                    error={isRangeInvalid(filters.grupo)}
                  />
                  <FilterRangeSelect
                    label="Categoria"
                    options={filterOptions?.categorias || []}
                    value={filters.categoria}
                    onChange={(v) => setFilters((prev) => ({ ...prev, categoria: v }))}
                    error={isRangeInvalid(filters.categoria)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FilterRangeSelect
                    label="Subcategoria"
                    options={filterOptions?.subcategorias || []}
                    value={filters.subcategoria}
                    onChange={(v) => setFilters((prev) => ({ ...prev, subcategoria: v }))}
                    error={isRangeInvalid(filters.subcategoria)}
                  />
                  <FilterRangeSelect
                    label="Segmento"
                    options={filterOptions?.segmentos || []}
                    value={filters.segmento}
                    onChange={(v) => setFilters((prev) => ({ ...prev, segmento: v }))}
                    error={isRangeInvalid(filters.segmento)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FilterRangeInput
                    label="Grupo Inventario"
                    value={filters.grupoInv}
                    onChange={(v) => setFilters((prev) => ({ ...prev, grupoInv: v }))}
                    error={isRangeInvalid(filters.grupoInv)}
                  />
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs text-slate-500 mb-2">Localizacao (opcional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FilterRangeInput
                      label="Local 1"
                      value={filters.local1}
                      onChange={(v) => setFilters((prev) => ({ ...prev, local1: v }))}
                      error={isRangeInvalid(filters.local1)}
                    />
                    <FilterRangeInput
                      label="Local 2"
                      value={filters.local2}
                      onChange={(v) => setFilters((prev) => ({ ...prev, local2: v }))}
                      error={isRangeInvalid(filters.local2)}
                    />
                    <FilterRangeInput
                      label="Local 3"
                      value={filters.local3}
                      onChange={(v) => setFilters((prev) => ({ ...prev, local3: v }))}
                      error={isRangeInvalid(filters.local3)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-white"
                  >
                    Limpar Filtros
                  </button>
                  <button
                    onClick={handleApplyFilters}
                    disabled={hasInvalidRanges}
                    className="px-4 py-1.5 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result message */}
        {result && (
          <div className={`mx-5 mt-3 p-3 rounded-lg text-sm shrink-0 ${
            result.success && result.added > 0
              ? 'bg-green-50 border border-green-200 text-green-700'
              : result.skipped > 0 && result.errors === 0
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {result.message}
            {result.added > 0 && result.skipped > 0 && (
              <span className="block text-xs mt-1 opacity-75">
                {result.added} adicionado{result.added !== 1 ? 's' : ''}, {result.skipped} ja existia{result.skipped !== 1 ? 'm' : ''} no inventario.
              </span>
            )}
          </div>
        )}

        {/* Table area */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || selectableProducts.length === 0}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap w-10">SEQ</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Codigo</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px]">Descricao</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Local</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Saldo Est.</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Ent. Post.</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Grupo</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Grp. Inv</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Categoria</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Subcateg.</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Segmento</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 1</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 2</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 3</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Lote</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows.map((i) => (
                  <tr key={`skel-${i}`} className="border-b border-slate-100">
                    <td className="py-2 px-2"><div className="w-4 h-4 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-6 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-2"><div className="w-16 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-2"><div className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: `${50 + (i % 4) * 15}%` }} /></td>
                    <td className="py-2 px-1"><div className="w-6 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-2"><div className="w-14 h-3 bg-slate-200 rounded animate-pulse ml-auto" /></td>
                    <td className="py-2 px-2"><div className="w-14 h-3 bg-slate-200 rounded animate-pulse ml-auto" /></td>
                    <td className="py-2 px-1"><div className="w-10 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-10 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-10 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-10 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-10 h-3 bg-slate-200 rounded animate-pulse" /></td>
                    <td className="py-2 px-1"><div className="w-8 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-1"><div className="w-8 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-1"><div className="w-8 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                    <td className="py-2 px-1"><div className="w-8 h-3 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Nenhum produto encontrado.</p>
                    {isAdvancedMode && (
                      <p className="text-slate-400 text-xs mt-1">Tente ajustar os filtros avancados.</p>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => {
                  const isCurrent = p.inventoryStatus === 'IN_CURRENT_INVENTORY';
                  const isOther = p.inventoryStatus === 'IN_OTHER_INVENTORY';
                  const sc = statusConfig[p.inventoryStatus];
                  const seq = (page - 1) * PAGE_SIZE + idx + 1;
                  const dimClass = isCurrent ? 'text-slate-400' : 'text-slate-600';

                  return (
                    <tr
                      key={p.code}
                      onClick={() => toggleSelect(p.code)}
                      className={`border-b border-slate-100 transition-colors ${
                        isCurrent
                          ? `${sc.rowClass} cursor-default`
                          : selected.has(p.code)
                            ? 'bg-capul-50 hover:bg-capul-100 cursor-pointer'
                            : isOther
                              ? `${sc.rowClass} cursor-pointer`
                              : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                      title={isOther ? `Em outro inventario: ${p.otherInventoryName}` : isCurrent ? 'Ja adicionado neste inventario' : ''}
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.code)}
                          onChange={() => toggleSelect(p.code)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isCurrent}
                          className="rounded border-slate-300 disabled:opacity-30"
                        />
                      </td>
                      <td className={`py-2 px-1 text-center text-[11px] tabular-nums ${dimClass}`}>{seq}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-[11px] ${isCurrent ? 'text-slate-400' : 'text-slate-700'}`}>{p.code}</span>
                          {(isCurrent || isOther) && (
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${sc.badgeClass}`}>
                              {sc.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 px-2 text-[11px] truncate max-w-[200px] ${isCurrent ? 'text-slate-400' : 'text-slate-800'}`} title={p.description}>{p.description}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{p.local || '—'}</td>
                      <td className={`py-2 px-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap ${isCurrent ? 'text-slate-400' : 'text-slate-700'}`}>
                        {p.estoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00'}
                      </td>
                      <td className={`py-2 px-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap ${dimClass}`}>
                        {p.entregasPost?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00'}
                      </td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{p.grupo}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{p.grupoInv || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{p.categoria || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{p.subcategoria || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{p.segmento || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{p.local1 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{p.local2 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{p.local3 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] ${dimClass}`}>{p.lote || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 shrink-0 bg-white rounded-b-xl">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{totalCount.toLocaleString('pt-BR')} produto{totalCount !== 1 ? 's' : ''}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 tabular-nums">{page} / {totalPages.toLocaleString('pt-BR')}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-3 ml-4 border-l border-slate-200 pl-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
                <span className="text-xs text-slate-500">Ja adicionado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                <span className="text-xs text-slate-500">Em outro inventario</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 ? (
              <button
                onClick={() => setSelected(new Set())}
                className="px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                Desmarcar Todos ({selected.size.toLocaleString('pt-BR')})
              </button>
            ) : totalCount > 0 ? (
              <button
                onClick={handleSelectAllFromFilter}
                disabled={loadingAllCodes || loading}
                className="px-3 py-2 text-sm text-capul-700 bg-capul-50 border border-capul-200 rounded-lg hover:bg-capul-100 disabled:opacity-50"
              >
                {loadingAllCodes ? 'Carregando...' : `Selecionar Todos (${totalCount.toLocaleString('pt-BR')})`}
              </button>
            ) : null}
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Fechar
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              className="px-4 py-2 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
            >
              {saving
                ? 'Adicionando...'
                : `Adicionar${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Sub-components ===

function FilterRangeSelect({ label, options, value, onChange, error }: {
  label: string;
  options: FilterOption[];
  value: RangeFilter;
  onChange: (v: RangeFilter) => void;
  error?: boolean;
}) {
  const borderClass = error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-300';
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-xs font-medium text-slate-600">{label}</label>
        {error && <span className="text-[10px] text-red-500">De maior que Ate</span>}
      </div>
      <div className="flex gap-2">
        <select
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className={`flex-1 ${borderClass} border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white`}
        >
          <option value="">De (todos)</option>
          {options.map((o) => (
            <option key={`from-${o.codigo}`} value={o.codigo}>
              {o.codigo} - {o.descricao}
            </option>
          ))}
        </select>
        <select
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className={`flex-1 ${borderClass} border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white`}
        >
          <option value="">Ate (todos)</option>
          {options.map((o) => (
            <option key={`to-${o.codigo}`} value={o.codigo}>
              {o.codigo} - {o.descricao}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FilterRangeInput({ label, value, onChange, error }: {
  label: string;
  value: RangeFilter;
  onChange: (v: RangeFilter) => void;
  error?: boolean;
}) {
  const borderClass = error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-300';
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-xs font-medium text-slate-600">{label}</label>
        {error && <span className="text-[10px] text-red-500">De maior que Ate</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value.toUpperCase() })}
          placeholder="De"
          className={`flex-1 ${borderClass} border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capul-500`}
        />
        <input
          type="text"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value.toUpperCase() })}
          placeholder="Ate"
          className={`flex-1 ${borderClass} border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capul-500`}
        />
      </div>
    </div>
  );
}
