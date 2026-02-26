import { useEffect, useState, useCallback, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { inventoryService } from '../../../services/inventory.service';
import type { InventoryList, CountingListProduct } from '../../../types';

export type CountingFilter = 'all' | 'pending' | 'counted' | 'divergent';

export function useCountingData(inventoryId: string) {
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [products, setProducts] = useState<CountingListProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CountingFilter>('all');
  const [currentListId, setCurrentListId] = useState<string | null>(null);

  // Load inventory and its counting lists, then get items from the first active list
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, listas] = await Promise.all([
        inventoryService.buscarPorId(inventoryId),
        countingListService.listar(inventoryId),
      ]);
      setInventario(inv);

      // Find active counting list (EM_CONTAGEM or LIBERADA preferred)
      const activeList = listas.find((l) => l.list_status === 'EM_CONTAGEM' || l.list_status === 'LIBERADA')
        || listas.find((l) => l.list_status !== 'ENCERRADA')
        || listas[0];

      if (activeList) {
        setCurrentListId(activeList.id);
        const res = await countingListService.listarItens(activeList.id);
        setProducts(res.data?.products || []);
      } else {
        setProducts([]);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reload = useCallback(() => {
    loadData();
  }, [loadData]);

  // Filter products
  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return products.filter((p) => p.status === 'PENDING');
      case 'counted':
        return products.filter((p) => p.status !== 'PENDING');
      case 'divergent':
        return products.filter((p) => {
          if (p.status === 'PENDING') return false;
          const finalQty = p.count_cycle_1 ?? 0;
          return Math.abs(finalQty - p.system_qty) >= 0.01;
        });
      default:
        return products;
    }
  }, [products, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = products.length;
    const counted = products.filter((p) => p.status !== 'PENDING').length;
    const pending = total - counted;
    const divergent = products.filter((p) => {
      if (p.status === 'PENDING') return false;
      const finalQty = p.count_cycle_1 ?? 0;
      return Math.abs(finalQty - p.system_qty) >= 0.01;
    }).length;
    const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, pending, divergent, progress };
  }, [products]);

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
    findProduct,
    updateProduct,
    reload,
  };
}
