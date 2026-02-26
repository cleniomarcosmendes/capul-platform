import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { inventoryService } from '../services/inventory.service';
import { countingListService } from '../services/counting-list.service';
import { calcularQuantidadeFinal } from '../utils/cycles';
import {
  BarChart2,
  Download,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { PageSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import type { InventoryList, CountingListProduct } from '../types';

interface DivergenceRow {
  inventoryId: string;
  inventoryName: string;
  warehouse: string;
  product_code: string;
  product_name: string;
  system_qty: number;
  final_qty: number;
  variance: number;
  variance_pct: number;
  count_cycle_1: number | null;
  count_cycle_2: number | null;
  count_cycle_3: number | null;
}

export function RelatoriosPage() {
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [divergences, setDivergences] = useState<DivergenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingDivergences, setLoadingDivergences] = useState(false);
  const [selectedInv, setSelectedInv] = useState<string>('');
  const [tolerance, setTolerance] = useState<number>(0);

  function loadInventarios() {
    setLoading(true);
    setError(false);
    inventoryService.listar({ size: '100' })
      .then((res) => setInventarios(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  // Load inventories
  useEffect(() => { loadInventarios(); }, []);

  // Load divergences when inventory is selected
  useEffect(() => {
    if (!selectedInv) {
      setDivergences([]);
      return;
    }

    setLoadingDivergences(true);
    const inv = inventarios.find((i) => i.id === selectedInv);
    if (!inv) return;

    countingListService.listar(selectedInv)
      .then(async (listas) => {
        const allProducts: CountingListProduct[] = [];
        for (const lista of listas) {
          try {
            const res = await countingListService.listarItens(lista.id);
            if (res.data?.products) {
              allProducts.push(...res.data.products);
            }
          } catch { /* skip */ }
        }

        const rows: DivergenceRow[] = [];
        for (const p of allProducts) {
          if (p.status === 'PENDING') continue;
          const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
            p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
          );
          const variance = finalQty - p.system_qty;
          const variancePct = p.system_qty !== 0 ? (variance / p.system_qty) * 100 : (finalQty !== 0 ? 100 : 0);
          if (Math.abs(variancePct) > tolerance) {
            rows.push({
              inventoryId: selectedInv,
              inventoryName: inv.name,
              warehouse: inv.warehouse,
              product_code: p.product_code,
              product_name: p.product_description || p.product_name,
              system_qty: p.system_qty,
              final_qty: finalQty,
              variance,
              variance_pct: variancePct,
              count_cycle_1: p.count_cycle_1,
              count_cycle_2: p.count_cycle_2,
              count_cycle_3: p.count_cycle_3,
            });
          }
        }

        rows.sort((a, b) => Math.abs(b.variance_pct) - Math.abs(a.variance_pct));
        setDivergences(rows);
      })
      .catch(() => setDivergences([]))
      .finally(() => setLoadingDivergences(false));
  }, [selectedInv, tolerance, inventarios]);

  // Export CSV
  function handleExportCSV() {
    if (divergences.length === 0) return;
    const header = 'Inventario;Armazem;Codigo;Descricao;Saldo Sistema;C1;C2;C3;Qtd Final;Diferenca;Variacao %\n';
    const rows = divergences.map((d) =>
      `${d.inventoryName};${d.warehouse};${d.product_code};${d.product_name};${d.system_qty.toFixed(2)};${d.count_cycle_1?.toFixed(2) ?? ''};${d.count_cycle_2?.toFixed(2) ?? ''};${d.count_cycle_3?.toFixed(2) ?? ''};${d.final_qty.toFixed(2)};${d.variance.toFixed(2)};${d.variance_pct.toFixed(1)}%`,
    ).join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_divergencias_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats
  const totalSobra = divergences.filter((d) => d.variance > 0).length;
  const totalFalta = divergences.filter((d) => d.variance < 0).length;

  return (
    <>
      <Header title="Relatorios" />
      <div className="p-6 space-y-4">
        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Divergencias</p>
                <p className="text-xl font-bold text-amber-600">{divergences.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Sobras (contado {'>'} sistema)</p>
                <p className="text-xl font-bold text-green-600">{totalSobra}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Faltas (contado {'<'} sistema)</p>
                <p className="text-xl font-bold text-red-600">{totalFalta}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedInv}
            onChange={(e) => setSelectedInv(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          >
            <option value="">Selecione um inventario</option>
            {inventarios.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.warehouse}) — {inv.status === 'COMPLETED' ? 'Concluido' : inv.status === 'IN_PROGRESS' ? 'Em Andamento' : inv.status}
              </option>
            ))}
          </select>

          <select
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          >
            <option value={0}>Todas as divergencias</option>
            <option value={1}>Variacao {'>'} 1%</option>
            <option value={5}>Variacao {'>'} 5%</option>
            <option value={10}>Variacao {'>'} 10%</option>
            <option value={20}>Variacao {'>'} 20%</option>
          </select>

          <div className="flex-1" />

          {divergences.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>

        {/* Conteudo */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar inventarios." onRetry={loadInventarios} />
        ) : !selectedInv ? (
          <div className="text-center py-12">
            <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Selecione um inventario para ver o relatorio de divergencias.</p>
          </div>
        ) : loadingDivergences ? (
          <TableSkeleton rows={6} cols={9} />
        ) : divergences.length === 0 ? (
          <div className="text-center py-8 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-700 text-sm font-medium">Nenhuma divergencia encontrada!</p>
            <p className="text-green-600 text-xs mt-1">
              {tolerance > 0 ? `Nenhum item com variacao acima de ${tolerance}%.` : 'Todas as contagens conferem.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {divergences.map((d, i) => (
                  <tr
                    key={`${d.product_code}-${i}`}
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
                    <td className="py-2.5 px-3">
                      <Link
                        to={`/inventario/inventarios/${d.inventoryId}`}
                        className="text-xs text-capul-600 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
