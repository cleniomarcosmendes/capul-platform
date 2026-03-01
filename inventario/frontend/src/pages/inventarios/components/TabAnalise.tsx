import { useEffect, useState, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { calcularQuantidadeFinal } from '../../../utils/cycles';
import { BarChart2, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Download, Clock } from 'lucide-react';
import type { CountingList, CountingListProduct } from '../../../types';

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

export function TabAnalise({ inventoryId, listas }: Props) {
  const [allProducts, setAllProducts] = useState<CountingListProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('cycle1');

  // Load all products from all counting lists
  useEffect(() => {
    if (listas.length === 0) {
      setAllProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(listas.map((l) => countingListService.listarItens(l.id, true)))
      .then((responses) => {
        const products: CountingListProduct[] = [];
        for (const res of responses) {
          if (res.data?.products) {
            products.push(...res.data.products);
          }
        }
        setAllProducts(products);
      })
      .catch(() => setAllProducts([]))
      .finally(() => setLoading(false));
  }, [listas, inventoryId]);

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

  if (loading) {
    return <div className="text-center py-8 text-slate-500">Carregando analise...</div>;
  }

  if (allProducts.length === 0) {
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

// === Cycle Analysis (per cycle) ===

function CycleAnalysis({ products, cycleNumber }: { products: CountingListProduct[]; cycleNumber: number }) {
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
      };
    }).sort((a, b) => {
      // Not counted first, then divergent, then OK
      if (!a.counted && b.counted) return -1;
      if (a.counted && !b.counted) return 1;
      if (a.is_divergent && !b.is_divergent) return -1;
      if (!a.is_divergent && b.is_divergent) return 1;
      return Math.abs(b.variance_pct) - Math.abs(a.variance_pct);
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

  function handleExportCSV() {
    const header = `Codigo;Descricao;Saldo Sistema;Contagem ${cycleNumber}o Ciclo;Diferenca;Variacao %;Situacao\n`;
    const rows = analyzed.map((a) =>
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
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Sistema</th>
                <th className={`text-right py-2.5 px-3 font-medium ${colors.bg.replace('border-', 'text-').replace('500', '700')}`}>
                  {cycleNumber}o Ciclo
                </th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Diferenca</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Var %</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600">Situacao</th>
              </tr>
            </thead>
            <tbody>
              {analyzed.map((a) => (
                <tr
                  key={a.product_code}
                  className={`border-b border-slate-100 ${
                    !a.counted ? 'bg-red-50/40' :
                    a.is_divergent ? (a.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') :
                    'bg-green-50/20'
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono text-slate-700">{a.product_code}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// === Final Analysis (current behavior - all cycles combined) ===

function FinalAnalysis({ products }: { products: CountingListProduct[] }) {
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
      };
    }).sort((a, b) => {
      if (!a.has_count && b.has_count) return -1;
      if (a.has_count && !b.has_count) return 1;
      if (a.is_divergent && !b.is_divergent) return -1;
      if (!a.is_divergent && b.is_divergent) return 1;
      return Math.abs(b.variance_pct) - Math.abs(a.variance_pct);
    });
  }, [products]);

  function handleExportCSV() {
    const header = 'Codigo;Descricao;Saldo Sistema;C1;C2;C3;Qtd Final;Diferenca;Variacao %;Situacao\n';
    const rows = items.map((d) =>
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
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Sistema</th>
                <th className="text-right py-2.5 px-3 font-medium text-green-700 bg-green-50/50">C1</th>
                <th className="text-right py-2.5 px-3 font-medium text-amber-700 bg-amber-50/50">C2</th>
                <th className="text-right py-2.5 px-3 font-medium text-red-700 bg-red-50/50">C3</th>
                <th className="text-right py-2.5 px-3 font-medium text-capul-700">Final</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Diferenca</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Var %</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600">Situacao</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.product_code}
                  className={`border-b border-slate-100 ${
                    !d.has_count ? 'bg-red-50/40' :
                    d.is_divergent ? (d.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') :
                    'bg-green-50/20'
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono text-slate-700">{d.product_code}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
