import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Filter, Loader2 } from 'lucide-react';
import { inventoryService } from '../../../services/inventory.service';
import { productService } from '../../../services/product.service';
import { countingListService } from '../../../services/counting-list.service';
import { useToast } from '../../../contexts/ToastContext';
import type { AssignableItem, ProductFilterOptions, FilterOption } from '../../../types';

interface Props {
  inventoryId: string;
  listId: string;
  listName: string;
  onClose: () => void;
  onAdded: () => void;
}

type AssignmentFilter = '' | 'AVAILABLE' | 'IN_LIST' | 'IN_OTHER_LIST';

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

function isRangeInvalid(r: RangeFilter): boolean {
  if (!r.from || !r.to) return false;
  return r.from > r.to;
}

function getInvalidRanges(f: AdvancedFilters): (keyof AdvancedFilters)[] {
  const invalid: (keyof AdvancedFilters)[] = [];
  for (const [key, val] of Object.entries(f)) {
    if (isRangeInvalid(val as RangeFilter)) invalid.push(key as keyof AdvancedFilters);
  }
  return invalid;
}

const statusConfig: Record<string, { label: string; rowClass: string; badgeClass: string }> = {
  AVAILABLE: { label: 'Disponivel', rowClass: '', badgeClass: 'bg-emerald-100 text-emerald-700' },
  IN_LIST: { label: 'Nesta lista', rowClass: 'bg-green-50/60', badgeClass: 'bg-green-100 text-green-700' },
  IN_OTHER_LIST: { label: 'Outra lista', rowClass: 'bg-sky-50/60', badgeClass: 'bg-sky-100 text-sky-700' },
};

const PAGE_SIZE = 50;
const COL_COUNT = 17; // checkbox + 16 data columns

export function AtribuirProdutosModal({ inventoryId, listId, listName, onClose, onAdded }: Props) {
  const toast = useToast();
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

  // Data
  const [items, setItems] = useState<AssignableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [totalInList, setTotalInList] = useState(0);
  const [totalInOther, setTotalInOther] = useState(0);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<AssignmentFilter>('');

  // Selection — persists across pages
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Saving
  const [saving, setSaving] = useState(false);

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

  const loadItems = useCallback(() => {
    setLoading(true);

    const params: Record<string, string | number | undefined> = {
      list_id: listId,
      assignment_status: statusFilter || undefined,
      page,
      size: PAGE_SIZE,
    };

    // Basic text search
    if (!isAdvancedMode && search) {
      params.search = search;
    }

    // Advanced range filters
    if (isAdvancedMode) {
      const f = appliedFilters;
      if (f.grupo.from) params.grupo_de = f.grupo.from;
      if (f.grupo.to) params.grupo_ate = f.grupo.to;
      if (f.categoria.from) params.categoria_de = f.categoria.from;
      if (f.categoria.to) params.categoria_ate = f.categoria.to;
      if (f.subcategoria.from) params.subcategoria_de = f.subcategoria.from;
      if (f.subcategoria.to) params.subcategoria_ate = f.subcategoria.to;
      if (f.segmento.from) params.segmento_de = f.segmento.from;
      if (f.segmento.to) params.segmento_ate = f.segmento.to;
      if (f.grupoInv.from) params.grupo_inv_de = f.grupoInv.from;
      if (f.grupoInv.to) params.grupo_inv_ate = f.grupoInv.to;
      if (f.local1.from) params.local1_from = f.local1.from;
      if (f.local1.to) params.local1_to = f.local1.to;
      if (f.local2.from) params.local2_from = f.local2.from;
      if (f.local2.to) params.local2_to = f.local2.to;
      if (f.local3.from) params.local3_from = f.local3.from;
      if (f.local3.to) params.local3_to = f.local3.to;
    }

    inventoryService.listarItensParaAtribuicao(inventoryId, params)
      .then((res) => {
        setItems(res.items || []);
        setTotalCount(res.total);
        setTotalPages(res.total_pages);
        setTotalAvailable(res.total_available);
        setTotalInList(res.total_in_list);
        setTotalInOther(res.total_in_other);
      })
      .catch(() => {
        setItems([]);
        setTotalCount(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [inventoryId, listId, search, isAdvancedMode, appliedFilters, statusFilter, page]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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
  }

  const hasInvalidRanges = getInvalidRanges(filters).length > 0;

  function handleClearFilters() {
    const empty = emptyFilters();
    setFilters(empty);
    setAppliedFilters(empty);
    setIsAdvancedMode(false);
    setPage(1);
  }

  // Selection — only AVAILABLE items can be selected
  const selectableItems = items.filter((i) => i.assignment_status === 'AVAILABLE');

  function toggleSelect(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.assignment_status !== 'AVAILABLE') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectableItems.every((i) => selected.has(i.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableItems.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        selectableItems.forEach((i) => next.add(i.id));
        return next;
      });
    }
  }

  const allOnPageSelected = selectableItems.length > 0 && selectableItems.every((i) => selected.has(i.id));

  // === Select all from filter (all pages) ===
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  function buildFilterParams(): Record<string, string | number | undefined> {
    const params: Record<string, string | number | undefined> = {
      list_id: listId,
      assignment_status: statusFilter || 'AVAILABLE',
    };
    if (!isAdvancedMode && search) params.search = search;
    if (isAdvancedMode) {
      const f = appliedFilters;
      if (f.grupo.from) params.grupo_de = f.grupo.from;
      if (f.grupo.to) params.grupo_ate = f.grupo.to;
      if (f.categoria.from) params.categoria_de = f.categoria.from;
      if (f.categoria.to) params.categoria_ate = f.categoria.to;
      if (f.subcategoria.from) params.subcategoria_de = f.subcategoria.from;
      if (f.subcategoria.to) params.subcategoria_ate = f.subcategoria.to;
      if (f.segmento.from) params.segmento_de = f.segmento.from;
      if (f.segmento.to) params.segmento_ate = f.segmento.to;
      if (f.grupoInv.from) params.grupo_inv_de = f.grupoInv.from;
      if (f.grupoInv.to) params.grupo_inv_ate = f.grupoInv.to;
      if (f.local1.from) params.local1_from = f.local1.from;
      if (f.local1.to) params.local1_to = f.local1.to;
      if (f.local2.from) params.local2_from = f.local2.from;
      if (f.local2.to) params.local2_to = f.local2.to;
      if (f.local3.from) params.local3_from = f.local3.from;
      if (f.local3.to) params.local3_to = f.local3.to;
    }
    return params;
  }

  async function handleSelectAllFromFilter() {
    setLoadingAllIds(true);
    try {
      const res = await inventoryService.listarIdsParaAtribuicao(inventoryId, buildFilterParams());
      if (res.ids.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of res.ids) next.add(id);
          return next;
        });
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAllIds(false);
    }
  }

  // Add products to counting list
  async function handleAdd() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await countingListService.adicionarItens(listId, Array.from(selected));
      toast.success(`${selected.size} produto${selected.size !== 1 ? 's' : ''} adicionado${selected.size !== 1 ? 's' : ''} a "${listName}"`);
      setSelected(new Set());
      onAdded();
      loadItems();
    } catch {
      toast.error('Erro ao adicionar produtos a lista.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const activeFilterCount = countActiveFilters(appliedFilters);
  const skeletonRows = Array.from({ length: 15 }, (_, i) => i);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible ? 'bg-black/40' : 'bg-transparent'}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`absolute inset-4 md:inset-6 lg:inset-8 bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Adicionar Produtos a Lista</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selected.size > 0
                ? <><span className="font-medium text-capul-600">{selected.size}</span> produto{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''} para <span className="font-medium">"{listName}"</span></>
                : <>Selecione os produtos do inventario para adicionar a <span className="font-medium">"{listName}"</span></>}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + filter toggle + status */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0 space-y-2">
          <div className="flex gap-2">
            <form onSubmit={handleBasicSearch} className="flex gap-2 flex-1">
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

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AssignmentFilter); setPage(1); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 bg-white min-w-[160px]"
            >
              <option value="">Todos os status</option>
              <option value="AVAILABLE">Disponiveis ({totalAvailable})</option>
              <option value="IN_LIST">Nesta lista ({totalInList})</option>
              <option value="IN_OTHER_LIST">Em outra lista ({totalInOther})</option>
            </select>
          </div>

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
                    disabled={loading || selectableItems.length === 0}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap w-10">SEQ</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Codigo</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px]">Descricao</th>
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
                <th className="text-center py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Status</th>
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
                    <td className="py-2 px-2"><div className="w-20 h-5 bg-slate-200 rounded animate-pulse mx-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="py-16 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Nenhum item encontrado.</p>
                    {(statusFilter || isAdvancedMode) && (
                      <p className="text-slate-400 text-xs mt-1">Tente ajustar os filtros.</p>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isAvailable = item.assignment_status === 'AVAILABLE';
                  const isInList = item.assignment_status === 'IN_LIST';
                  const isInOther = item.assignment_status === 'IN_OTHER_LIST';
                  const sc = statusConfig[item.assignment_status];
                  const seq = (page - 1) * PAGE_SIZE + idx + 1;
                  const dimClass = isAvailable ? 'text-slate-600' : 'text-slate-400';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`border-b border-slate-100 transition-colors ${
                        isInList
                          ? `${sc.rowClass} cursor-default`
                          : isInOther
                            ? `${sc.rowClass} cursor-default`
                            : selected.has(item.id)
                              ? 'bg-capul-50 hover:bg-capul-100 cursor-pointer'
                              : 'hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!isAvailable}
                          className="rounded border-slate-300 disabled:opacity-30"
                        />
                      </td>
                      <td className={`py-2 px-1 text-center text-[11px] tabular-nums ${dimClass}`}>{seq}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`font-mono text-[11px] ${isAvailable ? 'text-slate-700' : 'text-slate-400'}`}>
                          {item.product_code}
                        </span>
                      </td>
                      <td className={`py-2 px-2 text-[11px] truncate max-w-[200px] ${isAvailable ? 'text-slate-800' : 'text-slate-400'}`} title={item.product_name}>
                        {item.product_name}
                      </td>
                      <td className={`py-2 px-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap ${isAvailable ? 'text-slate-700' : 'text-slate-400'}`}>
                        {item.product_estoque?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00'}
                      </td>
                      <td className={`py-2 px-2 text-right text-[11px] font-mono tabular-nums whitespace-nowrap ${dimClass}`}>
                        {item.entregas_post?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0,00'}
                      </td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{item.grupo || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{item.grupo_inv || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{item.categoria || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{item.subcategoria || '—'}</td>
                      <td className={`py-2 px-1 text-[11px] ${dimClass}`}>{item.segmento || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{item.local1 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{item.local2 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] font-mono ${dimClass}`}>{item.local3 || '—'}</td>
                      <td className={`py-2 px-1 text-center text-[11px] ${dimClass}`}>{item.lote || '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.badgeClass}`}>
                          {isInOther && item.assigned_list_name
                            ? item.assigned_list_name
                            : sc.label}
                        </span>
                      </td>
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
            <span>{totalCount} ite{totalCount !== 1 ? 'ns' : 'm'}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 tabular-nums">{page} / {totalPages}</span>
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
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
                <span className="text-xs text-slate-500">Disponivel</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                <span className="text-xs text-slate-500">Nesta lista</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-sky-100 border border-sky-300" />
                <span className="text-xs text-slate-500">Outra lista</span>
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
            ) : totalAvailable > 0 ? (
              <button
                onClick={handleSelectAllFromFilter}
                disabled={loadingAllIds || loading}
                className="px-3 py-2 text-sm text-capul-700 bg-capul-50 border border-capul-200 rounded-lg hover:bg-capul-100 disabled:opacity-50"
              >
                {loadingAllIds ? 'Carregando...' : `Selecionar Todos (${totalAvailable.toLocaleString('pt-BR')})`}
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
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adicionando...
                </span>
              ) : (
                `Adicionar${selected.size > 0 ? ` (${selected.size})` : ''}`
              )}
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
