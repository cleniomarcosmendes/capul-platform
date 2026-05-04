import React, { useEffect, useState, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { calcularQuantidadeFinal } from '../../../utils/cycles';
import { BarChart2, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Download, Clock, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import type { CountingList, CountingListProduct } from '../../../types';
import { useTableSort } from '../../../hooks/useTableSort';
import { SortableTh } from '../../../components/SortableTh';

interface Props {
  inventoryId: string;
  listas: CountingList[];
}

type SubTab = 'cycle1' | 'cycle2' | 'cycle3' | 'final';

const cycleColors: Record<number, { badge: string; bg: string }> = {
  1: { badge: 'bg-green-100 text-green-700 border-green-300', bg: 'border-green-500' },
  2: { badge: 'bg-amber-100 text-amber-700 border-amber-300', bg: 'border-amber-500' },
  3: { badge: 'bg-red-100 text-red-700 border-red-300', bg: 'border-red-500' },
};

// Produto enriquecido com referência à lista de origem (analise filtrada por lista)
type AnalysisProduct = CountingListProduct & { _list_id: string; _list_name: string };

export function TabAnalise({ inventoryId, listas }: Props) {
  const [rawProducts, setRawProducts] = useState<AnalysisProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('cycle1');
  // Filtro por lista — null = todas as listas (agregado)
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Load all products from all counting lists (anota lista de origem em cada produto)
  useEffect(() => {
    if (listas.length === 0) {
      setRawProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(listas.map((l) =>
      countingListService.listarItens(l.id, true)
        .then((res) => ({ list: l, products: res.data?.products || [] }))
    ))
      .then((responses) => {
        const enriched: AnalysisProduct[] = responses.flatMap((r) =>
          r.products.map((p) => ({ ...p, _list_id: r.list.id, _list_name: r.list.list_name }))
        );
        setRawProducts(enriched);
      })
      .catch(() => setRawProducts([]))
      .finally(() => setLoading(false));
  }, [listas, inventoryId]);

  // Aplica filtro por lista
  const allProducts: AnalysisProduct[] = useMemo(() => {
    if (!selectedListId) return rawProducts;
    return rawProducts.filter((p) => p._list_id === selectedListId);
  }, [rawProducts, selectedListId]);

  // Lista selecionada (para mostrar ciclo/status no header) ou null
  const selectedLista = useMemo(() => listas.find((l) => l.id === selectedListId) || null, [listas, selectedListId]);

  // Determine max cycle with data
  const maxCycleWithData = useMemo(() => {
    let max = 0;
    for (const p of allProducts) {
      if (p.count_cycle_3 != null) { max = 3; break; }
      if (p.count_cycle_2 != null && max < 2) max = 2;
      if (p.count_cycle_1 != null && max < 1) max = 1;
    }
    return max;
  }, [allProducts]);

  // Items per cycle:
  // Cycle 1: all items (all start in cycle 1)
  // Cycle 2: items that needed recount (had c1 divergent from system, or have c2 data)
  // Cycle 3: items that needed tiebreak (had c2 divergent, or have c3 data)
  const cycleItems = useMemo(() => {
    const cycle1 = allProducts;

    const cycle2 = allProducts.filter((p) =>
      p.count_cycle_2 != null ||
      (p.count_cycle_1 != null && Math.abs(p.count_cycle_1 - p.system_qty) >= 0.01) ||
      p.needs_count_cycle_2,
    );

    const cycle3 = allProducts.filter((p) =>
      p.count_cycle_3 != null ||
      (p.count_cycle_2 != null && p.count_cycle_1 != null && Math.abs(p.count_cycle_2 - p.count_cycle_1) >= 0.01 && Math.abs(p.count_cycle_2 - p.system_qty) >= 0.01) ||
      p.needs_count_cycle_3,
    );

    return { cycle1, cycle2, cycle3 };
  }, [allProducts]);

  // Auto-select the most relevant tab
  useEffect(() => {
    if (maxCycleWithData >= 3) setActiveSubTab('final');
    else if (maxCycleWithData === 2) setActiveSubTab('cycle2');
    else setActiveSubTab('cycle1');
  }, [maxCycleWithData]);

  // Conta itens por lista para o seletor (usa rawProducts pra mostrar o real, não o filtrado)
  const listOptions = useMemo(() => listas.map((l) => ({
    id: l.id,
    name: l.list_name,
    cycle: l.current_cycle,
    status: l.list_status,
    total: rawProducts.filter((p) => p._list_id === l.id).length,
  })), [listas, rawProducts]);

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Carregando analise...</div>;
  }

  if (rawProducts.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">Nenhum produto para analisar.</p>
        <p className="text-slate-400 text-xs mt-1">Adicione produtos e realize contagens primeiro.</p>
      </div>
    );
  }

  const subTabs: { key: SubTab; label: string; count: number; show: boolean }[] = [
    { key: 'cycle1', label: '1o Ciclo', count: cycleItems.cycle1.length, show: true },
    { key: 'cycle2', label: '2o Ciclo', count: cycleItems.cycle2.length, show: maxCycleWithData >= 2 },
    { key: 'cycle3', label: '3o Ciclo', count: cycleItems.cycle3.length, show: maxCycleWithData >= 3 },
    { key: 'final', label: 'Resultado Final', count: allProducts.length, show: maxCycleWithData >= 1 },
  ];

  return (
    <div className="space-y-4">
      {/* Seletor de lista — listas podem estar em ciclos/status diferentes */}
      {listas.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Analisar:</span>
          <button
            onClick={() => setSelectedListId(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              selectedListId === null
                ? 'bg-capul-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas as listas <span className="opacity-70">({rawProducts.length})</span>
          </button>
          {listOptions.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedListId(l.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                selectedListId === l.id
                  ? 'bg-capul-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={`Lista ${l.name} — ${l.cycle}o ciclo, status ${l.status}`}
            >
              <span>{l.name}</span>
              <span className="opacity-70">({l.total})</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                selectedListId === l.id ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
              }`}>
                C{l.cycle}
              </span>
            </button>
          ))}
          {selectedLista && (
            <span className="text-xs text-slate-500 ml-auto">
              Status: <strong className="text-slate-700">{selectedLista.list_status}</strong>
            </span>
          )}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {subTabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === tab.key
                ? 'border-capul-600 text-capul-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-slate-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'final' ? (
        <FinalAnalysis products={allProducts} />
      ) : (
        <CycleAnalysis
          products={
            activeSubTab === 'cycle1' ? cycleItems.cycle1 :
            activeSubTab === 'cycle2' ? cycleItems.cycle2 :
            cycleItems.cycle3
          }
          cycleNumber={activeSubTab === 'cycle1' ? 1 : activeSubTab === 'cycle2' ? 2 : 3}
        />
      )}
    </div>
  );
}

// === Lot divergence helper ===

interface LotDetail {
  lot_number: string;
  b8_lotefor: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
}

function buildLotDetails(product: CountingListProduct, cycleNumber?: number): LotDetail[] {
  const snapshotLots = product.snapshot_lots ?? [];
  const countings = product.countings ?? [];

  // Build counted map from countings (highest cycle or specific cycle)
  const countedMap = new Map<string, number>();
  for (const c of countings) {
    if (!c.lot_number) continue;
    if (cycleNumber != null && c.count_number !== cycleNumber) continue;
    const existing = countedMap.get(c.lot_number);
    if (existing === undefined || (cycleNumber == null && c.count_number > 0)) {
      countedMap.set(c.lot_number, c.quantity ?? 0);
    }
  }

  const lots: LotDetail[] = [];
  // From snapshot (system data)
  for (const sl of snapshotLots) {
    const lotNum = sl.lot_number || sl.b8_lotectl;
    const counted = countedMap.get(lotNum) ?? null;
    const sysQty = sl.system_qty ?? (sl as any).quantity ?? 0;
    lots.push({
      lot_number: lotNum,
      b8_lotefor: sl.b8_lotefor ?? '',
      system_qty: sysQty,
      counted_qty: counted,
      variance: counted !== null ? counted - sysQty : null,
    });
    countedMap.delete(lotNum);
  }
  // Lots counted but not in snapshot
  for (const [lotNum, qty] of countedMap) {
    lots.push({
      lot_number: lotNum,
      b8_lotefor: '',
      system_qty: 0,
      counted_qty: qty,
      variance: qty,
    });
  }

  return lots;
}

// === Final analysis lot detail (per-cycle) ===

interface LotDetailFinal {
  lot_number: string;
  b8_lotefor: string;
  system_qty: number;
  counted_c1: number | null;
  counted_c2: number | null;
  counted_c3: number | null;
  final_qty: number;
  variance: number;
  variance_pct: number;
  has_count: boolean;
  is_divergent: boolean;
}

function buildLotDetailsFinal(product: CountingListProduct): LotDetailFinal[] {
  const snapshotLots = product.snapshot_lots ?? [];
  const countings = product.countings ?? [];

  const countedMapC1 = new Map<string, number>();
  const countedMapC2 = new Map<string, number>();
  const countedMapC3 = new Map<string, number>();

  for (const c of countings) {
    if (!c.lot_number) continue;
    if (c.count_number === 1) countedMapC1.set(c.lot_number, c.quantity ?? 0);
    else if (c.count_number === 2) countedMapC2.set(c.lot_number, c.quantity ?? 0);
    else if (c.count_number === 3) countedMapC3.set(c.lot_number, c.quantity ?? 0);
  }

  const snapshotMap = new Map<string, { system_qty: number; b8_lotefor: string }>();
  const allLotNumbers = new Set<string>();
  for (const sl of snapshotLots) {
    const lotNum = sl.lot_number || sl.b8_lotectl;
    allLotNumbers.add(lotNum);
    snapshotMap.set(lotNum, {
      system_qty: sl.system_qty ?? (sl as any).quantity ?? 0,
      b8_lotefor: sl.b8_lotefor ?? '',
    });
  }
  for (const c of countings) {
    if (c.lot_number) allLotNumbers.add(c.lot_number);
  }

  const lots: LotDetailFinal[] = [];
  for (const lotNum of allLotNumbers) {
    const snap = snapshotMap.get(lotNum);
    const sysQty = snap?.system_qty ?? 0;
    const c1 = countedMapC1.get(lotNum) ?? null;
    const c2 = countedMapC2.get(lotNum) ?? null;
    const c3 = countedMapC3.get(lotNum) ?? null;
    const hasCount = c1 != null || c2 != null || c3 != null;
    const finalQty = hasCount ? calcularQuantidadeFinal(c1, c2, c3, sysQty) : 0;
    const variance = hasCount ? finalQty - sysQty : 0;
    const variancePct = hasCount && sysQty !== 0 ? (variance / sysQty) * 100 : (hasCount && finalQty !== 0 ? 100 : 0);

    lots.push({
      lot_number: lotNum,
      b8_lotefor: snap?.b8_lotefor ?? '',
      system_qty: sysQty,
      counted_c1: c1,
      counted_c2: c2,
      counted_c3: c3,
      final_qty: finalQty,
      variance,
      variance_pct: variancePct,
      has_count: hasCount,
      is_divergent: hasCount && Math.abs(variance) >= 0.01,
    });
  }

  return lots;
}

// === Cycle lot sub-rows (inline, matching cycle table columns) ===

function CycleLotSubRows({ lots }: { lots: LotDetail[] }) {
  return (
    <>
      {lots.map((l, i) => {
        const isDiv = l.variance !== null && Math.abs(l.variance) >= 0.01;
        const variancePct = l.variance !== null && l.system_qty !== 0
          ? (l.variance / l.system_qty) * 100
          : (l.counted_qty !== null && l.counted_qty !== 0 ? 100 : 0);
        return (
          <tr key={`lot-${l.lot_number}-${i}`} className="border-b border-slate-100 bg-blue-50/30">
            <td className="py-1.5 px-3 pl-10">
              <span className="font-mono text-xs text-slate-500">{l.lot_number}</span>
              {l.b8_lotefor && <span className="ml-1.5 text-[10px] text-slate-400">({l.b8_lotefor})</span>}
            </td>
            <td className="py-1.5 px-3 text-xs text-slate-400 italic">Lote</td>
            <td className="py-1.5 px-3 text-right text-xs tabular-nums text-slate-500">{l.system_qty.toFixed(2)}</td>
            <td className="py-1.5 px-3 text-right text-xs tabular-nums">
              {l.counted_qty !== null ? l.counted_qty.toFixed(2) : '—'}
            </td>
            <td className={`py-1.5 px-3 text-right text-xs font-medium tabular-nums ${
              !isDiv ? 'text-slate-400' : l.variance! > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {l.variance !== null ? `${l.variance > 0 ? '+' : ''}${l.variance.toFixed(2)}` : '—'}
            </td>
            <td className={`py-1.5 px-3 text-right text-xs font-medium ${
              !isDiv ? 'text-slate-400' : Math.abs(variancePct) > 10 ? 'text-red-600' : 'text-amber-600'
            }`}>
              {l.counted_qty !== null && isDiv ? `${Math.abs(variancePct).toFixed(1)}%` : l.counted_qty !== null ? '0.0%' : '—'}
            </td>
            <td className="py-1.5 px-3 text-center">
              {l.counted_qty === null ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">N/C</span>
              ) : isDiv ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Divergente</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// === Final lot sub-rows (inline, matching final table 10 columns) ===

function FinalLotSubRows({ lots }: { lots: LotDetailFinal[] }) {
  return (
    <>
      {lots.map((l, i) => (
        <tr key={`lot-${l.lot_number}-${i}`} className="border-b border-slate-100 bg-blue-50/30">
          <td className="py-1.5 px-3 pl-10">
            <span className="font-mono text-xs text-slate-500">{l.lot_number}</span>
            {l.b8_lotefor && <span className="ml-1.5 text-[10px] text-slate-400">({l.b8_lotefor})</span>}
          </td>
          <td className="py-1.5 px-3 text-xs text-slate-400 italic">Lote</td>
          <td className="py-1.5 px-3 text-right text-xs tabular-nums text-slate-500">{l.system_qty.toFixed(2)}</td>
          <td className="py-1.5 px-3 text-right text-xs tabular-nums bg-green-50/20">
            {l.counted_c1 != null ? l.counted_c1.toFixed(2) : '—'}
          </td>
          <td className="py-1.5 px-3 text-right text-xs tabular-nums bg-amber-50/20">
            {l.counted_c2 != null ? l.counted_c2.toFixed(2) : '—'}
          </td>
          <td className="py-1.5 px-3 text-right text-xs tabular-nums bg-red-50/20">
            {l.counted_c3 != null ? l.counted_c3.toFixed(2) : '—'}
          </td>
          <td className={`py-1.5 px-3 text-right text-xs font-bold ${l.has_count ? 'text-capul-700' : 'text-red-400'}`}>
            {l.has_count ? l.final_qty.toFixed(2) : 'N/C'}
          </td>
          <td className={`py-1.5 px-3 text-right text-xs font-medium ${
            !l.has_count ? 'text-slate-300' : l.variance > 0 ? 'text-green-600' : l.variance < 0 ? 'text-red-600' : 'text-slate-400'
          }`}>
            {l.has_count ? `${l.variance > 0 ? '+' : ''}${l.variance.toFixed(2)}` : '—'}
          </td>
          <td className={`py-1.5 px-3 text-right text-xs font-medium ${
            !l.has_count ? 'text-slate-300' : Math.abs(l.variance_pct) > 10 ? 'text-red-600' : l.is_divergent ? 'text-amber-600' : 'text-slate-400'
          }`}>
            {l.has_count && l.is_divergent ? `${Math.abs(l.variance_pct).toFixed(1)}%` : l.has_count ? '0.0%' : '—'}
          </td>
          <td className="py-1.5 px-3 text-center">
            {!l.has_count ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">N/C</span>
            ) : l.is_divergent ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Divergente</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

// === Cycle Analysis (per cycle) ===

function CycleAnalysis({ products, cycleNumber }: { products: CountingListProduct[]; cycleNumber: number }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (code: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const getCycleQty = (p: CountingListProduct): number | null => {
    if (cycleNumber === 1) return p.count_cycle_1;
    if (cycleNumber === 2) return p.count_cycle_2;
    return p.count_cycle_3;
  };

  const analyzed = useMemo(() => {
    return products.map((p) => {
      const cycleQty = getCycleQty(p);
      const counted = cycleQty != null;
      const variance = counted ? cycleQty - p.system_qty : 0;
      const variancePct = counted && p.system_qty !== 0
        ? (variance / p.system_qty) * 100
        : (counted && cycleQty !== 0 ? 100 : 0);
      const isDivergent = counted && Math.abs(variance) >= 0.01;
      const isOk = counted && !isDivergent;
      const hasLot = p.has_lot === true || p.requires_lot === true;
      const lotDetails = hasLot ? buildLotDetails(p, cycleNumber) : [];

      return {
        product_code: p.product_code,
        product_name: p.product_description || p.product_name,
        system_qty: p.system_qty,
        cycle_qty: cycleQty,
        counted,
        variance,
        variance_pct: variancePct,
        is_divergent: isDivergent,
        is_ok: isOk,
        has_lot: hasLot,
        lot_details: lotDetails,
      };
    }).sort((a, b) => {
      // Ordenacao estavel por codigo do produto — mesma ordem em todos os ciclos
      // (criticidade fica visivel pelas colunas Variacao % e Situacao).
      return a.product_code.localeCompare(b.product_code, 'pt-BR', { numeric: true });
    });
  }, [products, cycleNumber]);

  const stats = useMemo(() => {
    const total = analyzed.length;
    const counted = analyzed.filter((a) => a.counted).length;
    const notCounted = total - counted;
    const ok = analyzed.filter((a) => a.is_ok).length;
    const divergent = analyzed.filter((a) => a.is_divergent).length;
    const positiveVar = analyzed.filter((a) => a.is_divergent && a.variance > 0).length;
    const negativeVar = analyzed.filter((a) => a.is_divergent && a.variance < 0).length;
    return { total, counted, notCounted, ok, divergent, positiveVar, negativeVar };
  }, [analyzed]);

  const colors = cycleColors[cycleNumber] || cycleColors[1];

  const { sortedRows: analyzedSorted, sortKey, sortDir, handleSort } = useTableSort(analyzed, null, null);

  function handleExportCSV() {
    const header = `Codigo;Descricao;Saldo Sistema;Contagem ${cycleNumber}o Ciclo;Diferenca;Variacao %;Situacao\n`;
    const rows = analyzedSorted.map((a) =>
      `${a.product_code};${a.product_name};${a.system_qty.toFixed(2)};${a.counted ? a.cycle_qty!.toFixed(2) : 'NAO CONTADO'};${a.counted ? a.variance.toFixed(2) : ''};${a.counted ? a.variance_pct.toFixed(1) + '%' : ''};${!a.counted ? 'Nao Contado' : a.is_divergent ? 'Divergente' : 'OK'}`,
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analise_ciclo${cycleNumber}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const countedPct = stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total no Ciclo</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400">{countedPct}% contados</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-xs text-slate-500">Conferem</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          <p className="text-xs text-slate-400">contagem = sistema</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-slate-500">Divergentes</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.divergent}</p>
          <div className="flex gap-2 text-xs mt-1">
            <span className="text-green-600">+{stats.positiveVar} sobra</span>
            <span className="text-red-600">-{stats.negativeVar} falta</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500">Nao Contados</p>
          </div>
          <p className={`text-2xl font-bold ${stats.notCounted > 0 ? 'text-red-600' : 'text-slate-400'}`}>{stats.notCounted}</p>
          <p className="text-xs text-slate-400">aguardando contagem</p>
        </div>
      </div>

      {/* Barra distribuicao */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700 mb-3">Distribuicao — {cycleNumber}o Ciclo</p>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
          {stats.ok > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${(stats.ok / stats.total) * 100}%` }} title={`OK: ${stats.ok}`} />
          )}
          {stats.divergent > 0 && (
            <div className="bg-amber-500 transition-all" style={{ width: `${(stats.divergent / stats.total) * 100}%` }} title={`Divergentes: ${stats.divergent}`} />
          )}
          {stats.notCounted > 0 && (
            <div className="bg-red-300 transition-all" style={{ width: `${(stats.notCounted / stats.total) * 100}%` }} title={`Nao contados: ${stats.notCounted}`} />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> OK ({stats.ok})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Divergentes ({stats.divergent})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300" /> Nao Contados ({stats.notCounted})</span>
        </div>
      </div>

      {/* Tabela */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            Todos os itens — {cycleNumber}o Ciclo ({stats.total})
          </h3>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <SortableTh label="Codigo" sortKey="product_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Descricao" sortKey="product_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Sistema" sortKey="system_qty" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label={`${cycleNumber}o Ciclo`} sortKey="cycle_qty" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className={`font-medium py-2.5 px-3 ${colors.bg.replace('border-', '!text-').replace('500', '700')}`} />
                <SortableTh label="Diferenca" sortKey="variance" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Var %" sortKey="variance_pct" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Situacao" sortKey="is_divergent" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {analyzedSorted.map((a) => {
                const isExpanded = expandedRows.has(a.product_code);
                const canExpand = a.has_lot && a.lot_details.length > 0;
                return (
                  <React.Fragment key={a.product_code}>
                    <tr
                      className={`border-b border-slate-100 ${
                        !a.counted ? 'bg-red-50/40' :
                        a.is_divergent ? (a.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') :
                        'bg-green-50/20'
                      } ${canExpand ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
                      onClick={canExpand ? () => toggleExpand(a.product_code) : undefined}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {canExpand && (
                            isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          {a.product_code}
                          {canExpand && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                              <Layers className="w-3 h-3" />{a.lot_details.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 truncate max-w-[200px]">{a.product_name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{a.system_qty.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${a.counted ? 'text-slate-800' : 'text-red-400 italic'}`}>
                        {a.counted ? a.cycle_qty!.toFixed(2) : 'Nao contado'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        !a.counted ? 'text-slate-300' :
                        a.variance > 0 ? 'text-green-600' : a.variance < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {a.counted ? `${a.variance > 0 ? '+' : ''}${a.variance.toFixed(2)}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        !a.counted ? 'text-slate-300' :
                        Math.abs(a.variance_pct) > 10 ? 'text-red-600' : a.is_divergent ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {a.counted && a.is_divergent ? (
                          <div className="flex items-center justify-end gap-1">
                            {a.variance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(a.variance_pct).toFixed(1)}%
                          </div>
                        ) : a.counted ? '0.0%' : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!a.counted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                            <Clock className="w-3 h-3" /> Nao contado
                          </span>
                        ) : a.is_divergent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            <AlertTriangle className="w-3 h-3" /> Divergente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                    {canExpand && isExpanded && <CycleLotSubRows lots={a.lot_details} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === Final Analysis (current behavior - all cycles combined) ===

function FinalAnalysis({ products }: { products: CountingListProduct[] }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (code: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const stats = useMemo(() => {
    const total = products.length;
    let counted = 0;
    let divergent = 0;
    let positiveVar = 0;
    let negativeVar = 0;

    for (const p of products) {
      const hasAnyCount = p.count_cycle_1 != null || p.count_cycle_2 != null || p.count_cycle_3 != null;
      if (!hasAnyCount) continue;
      counted++;
      const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty);
      const diff = finalQty - p.system_qty;
      if (Math.abs(diff) >= 0.01) {
        divergent++;
        if (diff > 0) positiveVar++;
        else negativeVar++;
      }
    }

    return { total, counted, pending: total - counted, divergent, positiveVar, negativeVar };
  }, [products]);

  const items = useMemo(() => {
    return products.map((p) => {
      const hasAnyCount = p.count_cycle_1 != null || p.count_cycle_2 != null || p.count_cycle_3 != null;
      const finalQty = hasAnyCount
        ? (p.finalQuantity ?? calcularQuantidadeFinal(p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty))
        : 0;
      const variance = hasAnyCount ? finalQty - p.system_qty : 0;
      const variancePct = hasAnyCount && p.system_qty !== 0 ? (variance / p.system_qty) * 100 : (hasAnyCount && finalQty !== 0 ? 100 : 0);
      const hasLot = p.has_lot === true || p.requires_lot === true;
      const lotDetails = hasLot ? buildLotDetailsFinal(p) : [];

      return {
        product_code: p.product_code,
        product_name: p.product_description || p.product_name,
        system_qty: p.system_qty,
        count_cycle_1: p.count_cycle_1,
        count_cycle_2: p.count_cycle_2,
        count_cycle_3: p.count_cycle_3,
        final_qty: finalQty,
        variance,
        variance_pct: variancePct,
        has_count: hasAnyCount,
        is_divergent: hasAnyCount && Math.abs(variance) >= 0.01,
        has_lot: hasLot,
        lot_details: lotDetails,
      };
    }).sort((a, b) =>
      // Ordem default por codigo de produto — usuário pode reordenar via cabeçalho
      a.product_code.localeCompare(b.product_code, 'pt-BR', { numeric: true })
    );
  }, [products]);

  const { sortedRows: itemsSorted, sortKey, sortDir, handleSort } = useTableSort(items, null, null);

  function handleExportCSV() {
    const header = 'Codigo;Descricao;Saldo Sistema;C1;C2;C3;Qtd Final;Diferenca;Variacao %;Situacao\n';
    const rows = itemsSorted.map((d) =>
      `${d.product_code};${d.product_name};${d.system_qty.toFixed(2)};${d.count_cycle_1?.toFixed(2) ?? ''};${d.count_cycle_2?.toFixed(2) ?? ''};${d.count_cycle_3?.toFixed(2) ?? ''};${d.has_count ? d.final_qty.toFixed(2) : 'NAO CONTADO'};${d.has_count ? d.variance.toFixed(2) : ''};${d.has_count ? d.variance_pct.toFixed(1) + '%' : ''};${!d.has_count ? 'Nao Contado' : d.is_divergent ? 'Divergente' : 'OK'}`,
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado_final_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const countedPct = stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0;
  const okPct = stats.counted > 0 ? Math.round(((stats.counted - stats.divergent) / stats.counted) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Produtos</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-xs text-slate-400">{countedPct}% contados</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-xs text-slate-500">Sem Divergencia</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.counted - stats.divergent}</p>
          <p className="text-xs text-slate-400">{okPct}% acuracia</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-slate-500">Divergencias</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.divergent}</p>
          <div className="flex gap-2 text-xs mt-1">
            <span className="text-green-600">+{stats.positiveVar} sobra</span>
            <span className="text-red-600">-{stats.negativeVar} falta</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500">Nao Contados</p>
          </div>
          <p className={`text-2xl font-bold ${stats.pending > 0 ? 'text-red-600' : 'text-slate-400'}`}>{stats.pending}</p>
          <p className="text-xs text-slate-400">sem contagem registrada</p>
        </div>
      </div>

      {/* Barra distribuicao */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700 mb-3">Distribuicao — Resultado Final</p>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
          {stats.counted - stats.divergent > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${((stats.counted - stats.divergent) / stats.total) * 100}%` }} />
          )}
          {stats.divergent > 0 && (
            <div className="bg-amber-500 transition-all" style={{ width: `${(stats.divergent / stats.total) * 100}%` }} />
          )}
          {stats.pending > 0 && (
            <div className="bg-red-300 transition-all" style={{ width: `${(stats.pending / stats.total) * 100}%` }} />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> OK ({stats.counted - stats.divergent})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Divergentes ({stats.divergent})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300" /> Nao Contados ({stats.pending})</span>
        </div>
      </div>

      {/* Tabela */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            Todos os itens — Resultado Final ({items.length})
          </h3>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <SortableTh label="Codigo" sortKey="product_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Descricao" sortKey="product_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Sistema" sortKey="system_qty" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="C1" sortKey="count_cycle_1" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3 !text-green-700 bg-green-50/50" />
                <SortableTh label="C2" sortKey="count_cycle_2" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3 !text-amber-700 bg-amber-50/50" />
                <SortableTh label="C3" sortKey="count_cycle_3" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3 !text-red-700 bg-red-50/50" />
                <SortableTh label="Final" sortKey="final_qty" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3 !text-capul-700" />
                <SortableTh label="Diferenca" sortKey="variance" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Var %" sortKey="variance_pct" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
                <SortableTh label="Situacao" sortKey="is_divergent" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {itemsSorted.map((d) => {
                const isExpanded = expandedRows.has(d.product_code);
                const canExpand = d.has_lot && d.lot_details.length > 0;
                return (
                  <React.Fragment key={d.product_code}>
                    <tr
                      className={`border-b border-slate-100 ${
                        !d.has_count ? 'bg-red-50/40' :
                        d.is_divergent ? (d.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') :
                        'bg-green-50/20'
                      } ${canExpand ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
                      onClick={canExpand ? () => toggleExpand(d.product_code) : undefined}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {canExpand && (
                            isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          {d.product_code}
                          {canExpand && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                              <Layers className="w-3 h-3" />{d.lot_details.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 truncate max-w-[180px]">{d.product_name}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{d.system_qty.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right bg-green-50/20">
                        {d.count_cycle_1 != null ? d.count_cycle_1.toFixed(2) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right bg-amber-50/20">
                        {d.count_cycle_2 != null ? d.count_cycle_2.toFixed(2) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right bg-red-50/20">
                        {d.count_cycle_3 != null ? d.count_cycle_3.toFixed(2) : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${d.has_count ? 'text-capul-700' : 'text-red-400 italic'}`}>
                        {d.has_count ? d.final_qty.toFixed(2) : 'N/C'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        !d.has_count ? 'text-slate-300' :
                        d.variance > 0 ? 'text-green-600' : d.variance < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {d.has_count ? `${d.variance > 0 ? '+' : ''}${d.variance.toFixed(2)}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-medium ${
                        !d.has_count ? 'text-slate-300' :
                        Math.abs(d.variance_pct) > 10 ? 'text-red-600' : d.is_divergent ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {d.has_count && d.is_divergent ? (
                          <div className="flex items-center justify-end gap-1">
                            {d.variance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(d.variance_pct).toFixed(1)}%
                          </div>
                        ) : d.has_count ? '0.0%' : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!d.has_count ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                            <Clock className="w-3 h-3" /> N/C
                          </span>
                        ) : d.is_divergent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                            <AlertTriangle className="w-3 h-3" /> Divergente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                    {canExpand && isExpanded && <FinalLotSubRows lots={d.lot_details} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
