import { useEffect, useState, useCallback, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { inventoryService } from '../../../services/inventory.service';
import { useAuth } from '../../../contexts/AuthContext';
import type { InventoryList, CountingList, CountingListProduct } from '../../../types';
import { getExpectedQty } from '../../../utils/cycles';

export type CountingFilter = 'all' | 'pending' | 'counted' | 'divergent' | 'revisar';

/** Helper: get counted qty for a given cycle */
function getCountForCycle(p: CountingListProduct, cycle: number): number | null {
  switch (cycle) {
    case 2: return p.count_cycle_2;
    case 3: return p.count_cycle_3;
    default: return p.count_cycle_1;
  }
}

/** Sinaliza se o item ainda PRECISA ser recontado no ciclo */
function getNeedsRecountForCycle(p: CountingListProduct, cycle: number): boolean {
  if (cycle === 2) return p.needs_count_cycle_2;
  if (cycle === 3) return p.needs_count_cycle_3;
  return p.needs_count_cycle_1;
}

/**
 * Resolvido no ciclo: ou recontou agora, ou já bateu antes (não precisa recontar neste ciclo).
 * Crítico para que itens "OK" do ciclo anterior não fiquem como pendentes no atual,
 * fazendo a tela de "Concluído" nunca disparar.
 */
function isCountedForCycle(p: CountingListProduct, cycle: number): boolean {
  if (getCountForCycle(p, cycle) !== null) return true;
  if (cycle > 1 && !getNeedsRecountForCycle(p, cycle)) return true;
  return false;
}

/** Contou e a qty difere do esperado (divergente) */
function isDivergentForCycle(p: CountingListProduct, cycle: number): boolean {
  const qty = getCountForCycle(p, cycle);
  if (qty === null) return false;
  return Math.abs(qty - getExpectedQty(p.system_qty, p.b2_xentpos)) >= 0.01;
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

export function useCountingData(inventoryId: string, listIdHint?: string) {
  const { usuario, inventarioRole } = useAuth();
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [products, setProducts] = useState<CountingListProduct[]>([]);
  const [allLists, setAllLists] = useState<CountingList[]>([]);
  const [assignedLists, setAssignedLists] = useState<CountingList[]>([]);
  const [counterNames, setCounterNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CountingFilter>('all');
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentListName, setCurrentListName] = useState<string>('');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [showPreviousCounts, setShowPreviousCounts] = useState(false);
  const [noAssignedList, setNoAssignedList] = useState(false);
  const [listNotReleased, setListNotReleased] = useState(false);
  // Quando listIdHint aponta para uma lista da qual o usuário NÃO é contador no ciclo atual.
  // Mostra erro claro em vez de cair em fallback silencioso pra própria lista do user.
  const [notCounterOfRequested, setNotCounterOfRequested] = useState<{
    listName: string;
    counterCycle: number;
    counterId: string | null;
  } | null>(null);

  const userId = usuario?.id ?? '';
  const isAdmin = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';

  // Load inventory and its counting lists, then get items from the user's assigned list
  const loadData = useCallback(async () => {
    setLoading(true);
    setNoAssignedList(false);
    setListNotReleased(false);
    setNotCounterOfRequested(null);
    try {
      const [inv, listas, counters] = await Promise.all([
        inventoryService.buscarPorId(inventoryId),
        countingListService.listar(inventoryId),
        countingListService.listarContadoresDisponiveis(inventoryId).catch(() => []),
      ]);
      setInventario(inv);
      setAllLists(listas);

      // Mapa UUID → nome para resolver responsáveis das listas
      const namesMap: Record<string, string> = {};
      counters.forEach((c) => { namesMap[c.user_id] = c.full_name || c.username; });
      setCounterNames(namesMap);

      // Only EM_CONTAGEM lists are available for counting
      const countingLists = listas.filter((l) => l.list_status === 'EM_CONTAGEM');

      // Listas atribuidas ao usuario atual no ciclo corrente — o caller usa pra montar
      // tela de selecao quando ha mais de uma e nao ha listIdHint.
      const userLists = userId
        ? countingLists.filter((l) => isCounterForCycle(l, userId))
        : [];
      setAssignedLists(userLists);

      // Find list assigned to current user for the current cycle
      // Somente o contador atribuido ao ciclo pode contar (sem fallback para admin)
      // Se listIdHint informado (botão "Contar" de uma lista específica), prefere essa lista
      // — desde que o usuário seja contador dela. Senão:
      //   - 1 lista atribuída → auto-seleciona
      //   - 2+ listas atribuídas → não auto-seleciona (caller mostra tela de seleção)
      let activeList: CountingList | undefined;

      if (userId) {
        if (listIdHint) {
          // Procura pela lista solicitada — se existe E user é contador, ativa
          activeList = countingLists.find((l) => l.id === listIdHint && isCounterForCycle(l, userId));

          // Se a lista existe mas o user NÃO é contador, bloqueia com mensagem clara
          // (não cai em fallback silencioso para a própria lista do user)
          if (!activeList) {
            const requested = listas.find((l) => l.id === listIdHint);
            if (requested) {
              const cycle = requested.current_cycle || 1;
              const counterField = `counter_cycle_${cycle}` as 'counter_cycle_1' | 'counter_cycle_2' | 'counter_cycle_3';
              setNotCounterOfRequested({
                listName: requested.list_name || 'Lista',
                counterCycle: cycle,
                counterId: (requested[counterField] as string | null) || null,
              });
              setProducts([]);
              setCurrentListId(null);
              setCurrentListName('');
              return;
            }
          }
        }
        if (!activeList && userLists.length === 1) {
          activeList = userLists[0];
        }
      }

      // Sem activeList — pode ser por: (a) usuario tem 2+ listas e precisa escolher,
      // (b) tem listas atribuidas mas nenhuma liberada, (c) nao tem listas.
      if (!activeList) {
        if (userLists.length >= 2) {
          // Caller (page) le `assignedLists` e mostra selecao. Nao seta noAssignedList aqui.
          setProducts([]);
          setCurrentListId(null);
          setCurrentListName('');
          return;
        }
        // Usuario tem 0 listas em EM_CONTAGEM — descobrir se tem listas nao liberadas
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
        setCurrentListName(activeList.list_name || '');
        setCurrentCycle(activeList.current_cycle || 1);
        const res = await countingListService.listarItens(activeList.id);
        setProducts(res.data?.products || []);
        // Also update cycle from response if available
        if (res.data?.current_cycle) {
          setCurrentCycle(res.data.current_cycle);
        }
        if (res.data?.list_name) {
          setCurrentListName(res.data.list_name);
        }
        setShowPreviousCounts(Boolean(res.data?.show_previous_counts));
      } else {
        setProducts([]);
        setCurrentListName('');
        setShowPreviousCounts(false);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [inventoryId, userId, isAdmin, listIdHint]);

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

  // Detecta "modo revisão parcial": supervisor devolveu a lista marcando APENAS alguns itens
  // pra revisão (revisar_no_ciclo=true em SOME produtos, não em todos).
  // Devolução total marca TODOS itens contados — não é o caso aqui.
  // Modo 1ª contagem não tem nenhum revisar=true.
  const partialReviewMode = useMemo(() => {
    if (products.length === 0) return false;
    const marcados = products.filter((p) => p.revisar_no_ciclo === true).length;
    return marcados > 0 && marcados < products.length;
  }, [products]);

  // Quando entra em modo revisão parcial, força o filtro pra mostrar SÓ os marcados.
  // Evita contador editar item já aprovado pelo supervisor por engano.
  useEffect(() => {
    if (partialReviewMode) {
      setFilter('revisar');
    }
  }, [partialReviewMode]);

  // Filter products — derivado da count_cycle real, não do status (que pode ficar PENDING após divergência)
  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return products.filter((p) => !isCountedForCycle(p, currentCycle));
      case 'counted':
        return products.filter((p) => isCountedForCycle(p, currentCycle));
      case 'divergent':
        return products.filter((p) => isDivergentForCycle(p, currentCycle));
      case 'revisar':
        return products.filter((p) => p.revisar_no_ciclo === true);
      default:
        return products;
    }
  }, [products, filter, currentCycle]);

  // Stats — counted/pending/divergent/revisar baseados em count_cycle, não em status
  const stats = useMemo(() => {
    const total = products.length;
    const counted = products.filter((p) => isCountedForCycle(p, currentCycle)).length;
    const pending = total - counted;
    const divergent = products.filter((p) => isDivergentForCycle(p, currentCycle)).length;
    const revisar = products.filter((p) => p.revisar_no_ciclo === true).length;
    const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, pending, divergent, revisar, progress };
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
    currentListName,
    currentCycle,
    getCountedQty,
    countCycleKey,
    findProduct,
    updateProduct,
    reload,
    noAssignedList,
    listNotReleased,
    notCounterOfRequested,
    partialReviewMode,
    allLists,
    assignedLists,
    counterNames,
    showPreviousCounts,
  };
}
