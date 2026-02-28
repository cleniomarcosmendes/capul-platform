import { useEffect, useState, useCallback, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { inventoryService } from '../../../services/inventory.service';
import { useAuth } from '../../../contexts/AuthContext';
import type { InventoryList, CountingList, CountingListProduct } from '../../../types';
import { getExpectedQty } from '../../../utils/cycles';

export type CountingFilter = 'all' | 'pending' | 'counted' | 'divergent';

/** Helper: get counted qty for a given cycle */
function getCountForCycle(p: CountingListProduct, cycle: number): number | null {
  switch (cycle) {
    case 2: return p.count_cycle_2;
    case 3: return p.count_cycle_3;
    default: return p.count_cycle_1;
  }
}

/** Helper: normalize status to uppercase */
function isStatusPending(status: string): boolean {
  return status === 'PENDING' || status === 'pending';
}

/** Check if user is the counter for a list's current cycle */
function isCounterForCycle(list: CountingList, userId: string): boolean {
  switch (list.current_cycle) {
    case 1: return list.counter_cycle_1 === userId;
    case 2: return list.counter_cycle_2 === userId;
    case 3: return list.counter_cycle_3 === userId;
    default: return false;
  }
}

export function useCountingData(inventoryId: string) {
  const { usuario, inventarioRole } = useAuth();
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [products, setProducts] = useState<CountingListProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CountingFilter>('all');
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [noAssignedList, setNoAssignedList] = useState(false);
  const [listNotReleased, setListNotReleased] = useState(false);

  const userId = usuario?.id ?? '';
  const isAdmin = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';

  // Load inventory and its counting lists, then get items from the user's assigned list
  const loadData = useCallback(async () => {
    setLoading(true);
    setNoAssignedList(false);
    setListNotReleased(false);
    try {
      const [inv, listas] = await Promise.all([
        inventoryService.buscarPorId(inventoryId),
        countingListService.listar(inventoryId),
      ]);
      setInventario(inv);

      // Only EM_CONTAGEM lists are available for counting
      const countingLists = listas.filter((l) => l.list_status === 'EM_CONTAGEM');

      // Find list assigned to current user for the current cycle
      // Somente o contador atribuido ao ciclo pode contar (sem fallback para admin)
      let activeList: CountingList | undefined;

      if (userId) {
        activeList = countingLists.find((l) => isCounterForCycle(l, userId));
      }

      // No EM_CONTAGEM list found — check why
      if (!activeList) {
        // Check if user has assigned lists but they're not released yet
        const allUserLists = listas.filter((l) => l.list_status !== 'ENCERRADA' && isCounterForCycle(l, userId));
        if (allUserLists.length > 0) {
          setListNotReleased(true);
        } else {
          setNoAssignedList(true);
        }
        setProducts([]);
        return;
      }

      if (activeList) {
        setCurrentListId(activeList.id);
        setCurrentCycle(activeList.current_cycle || 1);
        const res = await countingListService.listarItens(activeList.id);
        setProducts(res.data?.products || []);
        // Also update cycle from response if available
        if (res.data?.current_cycle) {
          setCurrentCycle(res.data.current_cycle);
        }
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [inventoryId, userId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reload = useCallback(() => {
    loadData();
  }, [loadData]);

  /** Get counted qty for the current cycle */
  const getCountedQty = useCallback((p: CountingListProduct): number | null => {
    return getCountForCycle(p, currentCycle);
  }, [currentCycle]);

  /** The count_cycle_X key for the current cycle (for local updates) */
  const countCycleKey = useMemo((): 'count_cycle_1' | 'count_cycle_2' | 'count_cycle_3' => {
    switch (currentCycle) {
      case 2: return 'count_cycle_2';
      case 3: return 'count_cycle_3';
      default: return 'count_cycle_1';
    }
  }, [currentCycle]);

  // Filter products
  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return products.filter((p) => isStatusPending(p.status));
      case 'counted':
        return products.filter((p) => !isStatusPending(p.status));
      case 'divergent':
        return products.filter((p) => {
          if (isStatusPending(p.status)) return false;
          const qty = getCountForCycle(p, currentCycle) ?? 0;
          return Math.abs(qty - getExpectedQty(p.system_qty, p.b2_xentpos)) >= 0.01;
        });
      default:
        return products;
    }
  }, [products, filter, currentCycle]);

  // Stats
  const stats = useMemo(() => {
    const total = products.length;
    const counted = products.filter((p) => !isStatusPending(p.status)).length;
    const pending = total - counted;
    const divergent = products.filter((p) => {
      if (isStatusPending(p.status)) return false;
      const qty = getCountForCycle(p, currentCycle) ?? 0;
      return Math.abs(qty - getExpectedQty(p.system_qty, p.b2_xentpos)) >= 0.01;
    }).length;
    const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, pending, divergent, progress };
  }, [products, currentCycle]);

  // Find product by code or barcode
  const findProduct = useCallback((code: string): CountingListProduct | undefined => {
    const normalized = code.trim().toUpperCase();
    return products.find(
      (p) => p.product_code.toUpperCase() === normalized
        || p.product_code.toUpperCase().endsWith(normalized),
    );
  }, [products]);

  // Update a product locally after saving a count
  const updateProduct = useCallback((productId: string, updates: Partial<CountingListProduct>) => {
    setProducts((prev) => prev.map((p) =>
      p.id === productId ? { ...p, ...updates } : p,
    ));
  }, []);

  return {
    inventario,
    products: filtered,
    allProducts: products,
    loading,
    filter,
    setFilter,
    stats,
    currentListId,
    currentCycle,
    getCountedQty,
    countCycleKey,
    findProduct,
    updateProduct,
    reload,
    noAssignedList,
    listNotReleased,
  };
}
