import { useEffect, useState, useMemo } from 'react';
import { countingListService } from '../../../services/counting-list.service';
import { calcularQuantidadeFinal } from '../../../utils/cycles';
import { BarChart2, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import type { CountingList, CountingListProduct } from '../../../types';

interface Props {
  inventoryId: string;
  listas: CountingList[];
}

interface DivergenceItem {
  product_code: string;
  product_name: string;
  system_qty: number;
  count_cycle_1: number | null;
  count_cycle_2: number | null;
  count_cycle_3: number | null;
  final_qty: number;
  variance: number;
  variance_pct: number;
  status: string;
}

export function TabAnalise({ inventoryId, listas }: Props) {
  const [allProducts, setAllProducts] = useState<CountingListProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all products from all counting lists
  useEffect(() => {
    if (listas.length === 0) {
      setAllProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(listas.map((l) => countingListService.listarItens(l.id)))
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

  // Stats
  const stats = useMemo(() => {
    const total = allProducts.length;
    const counted = allProducts.filter((p) => p.status !== 'PENDING').length;
    const pending = total - counted;
    const approved = allProducts.filter((p) => p.status === 'APPROVED').length;

    let divergent = 0;
    let positiveVar = 0;
    let negativeVar = 0;

    for (const p of allProducts) {
      if (p.status === 'PENDING') continue;
      const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
        p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
      );
      const diff = finalQty - p.system_qty;
      if (Math.abs(diff) >= 0.01) {
        divergent++;
        if (diff > 0) positiveVar++;
        else negativeVar++;
      }
    }

    return { total, counted, pending, approved, divergent, positiveVar, negativeVar };
  }, [allProducts]);

  // Divergence items sorted by variance %
  const divergences = useMemo((): DivergenceItem[] => {
    return allProducts
      .filter((p) => p.status !== 'PENDING')
      .map((p) => {
        const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
          p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
        );
        const variance = finalQty - p.system_qty;
        const variancePct = p.system_qty !== 0 ? (variance / p.system_qty) * 100 : (finalQty !== 0 ? 100 : 0);
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
          status: p.status,
        };
      })
      .filter((d) => Math.abs(d.variance) >= 0.01)
      .sort((a, b) => Math.abs(b.variance_pct) - Math.abs(a.variance_pct));
  }, [allProducts]);

  // Export CSV
  function handleExportCSV() {
    if (divergences.length === 0) return;
    const header = 'Codigo;Descricao;Saldo Sistema;C1;C2;C3;Qtd Final;Diferenca;Variacao %\n';
    const rows = divergences.map((d) =>
      `${d.product_code};${d.product_name};${d.system_qty.toFixed(2)};${d.count_cycle_1?.toFixed(2) ?? ''};${d.count_cycle_2?.toFixed(2) ?? ''};${d.count_cycle_3?.toFixed(2) ?? ''};${d.final_qty.toFixed(2)};${d.variance.toFixed(2)};${d.variance_pct.toFixed(1)}%`,
    ).join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `divergencias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  const countedPct = stats.total > 0 ? Math.round((stats.counted / stats.total) * 100) : 0;
  const okPct = stats.counted > 0 ? Math.round(((stats.counted - stats.divergent) / stats.counted) * 100) : 0;

  return (
    <div className="space-y-6">
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
          <p className="text-xs text-slate-500 mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-slate-500">{stats.pending}</p>
          <p className="text-xs text-slate-400">aguardando contagem</p>
        </div>
      </div>

      {/* Barra distribuicao de status */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-700 mb-3">Distribuicao de Status</p>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-200">
          {stats.counted - stats.divergent > 0 && (
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${((stats.counted - stats.divergent) / stats.total) * 100}%` }}
              title={`OK: ${stats.counted - stats.divergent}`}
            />
          )}
          {stats.divergent > 0 && (
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${(stats.divergent / stats.total) * 100}%` }}
              title={`Divergentes: ${stats.divergent}`}
            />
          )}
          {stats.pending > 0 && (
            <div
              className="bg-slate-300 transition-all"
              style={{ width: `${(stats.pending / stats.total) * 100}%` }}
              title={`Pendentes: ${stats.pending}`}
            />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> OK ({stats.counted - stats.divergent})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Divergentes ({stats.divergent})</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Pendentes ({stats.pending})</span>
        </div>
      </div>

      {/* Tabela de divergencias */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-700">
            Divergencias ({divergences.length})
          </h3>
          {divergences.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>

        {divergences.length === 0 ? (
          <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-700 text-sm font-medium">Nenhuma divergencia encontrada!</p>
            <p className="text-green-600 text-xs mt-1">Todas as contagens conferem com o sistema.</p>
          </div>
        ) : (
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
                </tr>
              </thead>
              <tbody>
                {divergences.map((d) => (
                  <tr
                    key={d.product_code}
                    className={`border-b border-slate-100 ${
                      d.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-700">{d.product_code}</td>
                    <td className="py-2.5 px-3 text-slate-800 truncate max-w-[180px]">{d.product_name}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{d.system_qty.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right bg-green-50/20">
                      {d.count_cycle_1 !== null ? d.count_cycle_1.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right bg-amber-50/20">
                      {d.count_cycle_2 !== null ? d.count_cycle_2.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right bg-red-50/20">
                      {d.count_cycle_3 !== null ? d.count_cycle_3.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-capul-700">{d.final_qty.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${
                      d.variance > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {d.variance > 0 ? '+' : ''}{d.variance.toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${
                      Math.abs(d.variance_pct) > 10 ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      <div className="flex items-center justify-end gap-1">
                        {d.variance > 0
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(d.variance_pct).toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
