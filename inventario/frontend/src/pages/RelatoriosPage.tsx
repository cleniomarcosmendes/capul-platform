import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { inventoryService } from '../services/inventory.service';
import {
  BarChart2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  FileText,
  Layers,
  DollarSign,
  Package,
} from 'lucide-react';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';
import { PageSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import type { InventoryList, FinalReport, FinalReportItem } from '../types';

type Tab = 'divergencias' | 'final' | 'lotes';

const tabConfig: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'divergencias', label: 'Divergencias', icon: AlertTriangle },
  { key: 'final', label: 'Relatorio Final', icon: FileText },
  { key: 'lotes', label: 'Relatorio por Lote', icon: Layers },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedInv, setSelectedInv] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('divergencias');
  const [tolerance, setTolerance] = useState<number>(0);

  // Fonte unificada: final-report para todas as tabs
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  function loadInventarios() {
    setLoading(true);
    setError(false);
    inventoryService.listar({ size: '100' })
      .then((res) => setInventarios(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadInventarios(); }, []);

  // Carregar final-report quando inventário é selecionado (fonte unificada para todas as tabs)
  useEffect(() => {
    if (!selectedInv) { setFinalReport(null); return; }
    setLoadingReport(true);
    inventoryService.gerarRelatorioFinal(selectedInv)
      .then(setFinalReport)
      .catch(() => setFinalReport(null))
      .finally(() => setLoadingReport(false));
  }, [selectedInv]);

  // Divergências derivadas do final-report (sem N+1 queries, sem dependência de counting lists)
  const divergences = useMemo<DivergenceRow[]>(() => {
    if (!finalReport) return [];
    const inv = inventarios.find((i) => i.id === selectedInv);
    if (!inv) return [];

    const rows: DivergenceRow[] = [];
    for (const item of finalReport.items) {
      if (item.status === 'PENDING' && item.counted_quantity === 0) continue;
      const variance = item.variance;
      const variancePct = item.expected_quantity !== 0
        ? (variance / item.expected_quantity) * 100
        : (item.counted_quantity !== 0 ? 100 : 0);
      if (Math.abs(variancePct) > tolerance) {
        rows.push({
          inventoryId: selectedInv,
          inventoryName: inv.name,
          warehouse: inv.warehouse,
          product_code: item.product_code,
          product_name: item.product_name,
          system_qty: item.expected_quantity,
          final_qty: item.counted_quantity,
          variance,
          variance_pct: variancePct,
          count_cycle_1: item.count_cycle_1 ?? null,
          count_cycle_2: item.count_cycle_2 ?? null,
          count_cycle_3: item.count_cycle_3 ?? null,
        });
      }
    }
    rows.sort((a, b) => Math.abs(b.variance_pct) - Math.abs(a.variance_pct));
    return rows;
  }, [finalReport, tolerance, selectedInv, inventarios]);

  // Divergence export
  function handleExportDivCSV() {
    if (divergences.length === 0) return;
    const header = 'Inventario;Armazem;Codigo;Descricao;Saldo Sistema;C1;C2;C3;Qtd Final;Diferenca;Variacao %\n';
    const rows = divergences.map((d) =>
      `${d.inventoryName};${d.warehouse};${d.product_code};${d.product_name};${d.system_qty.toFixed(2)};${d.count_cycle_1?.toFixed(2) ?? ''};${d.count_cycle_2?.toFixed(2) ?? ''};${d.count_cycle_3?.toFixed(2) ?? ''};${d.final_qty.toFixed(2)};${d.variance.toFixed(2)};${d.variance_pct.toFixed(1)}%`,
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio_divergencias_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const totalSobra = divergences.filter((d) => d.variance > 0).length;
  const totalFalta = divergences.filter((d) => d.variance < 0).length;

  // Lot items from final report
  const lotItems = finalReport?.items.filter((it) => it.has_lot) ?? [];

  return (
    <>
      <Header title="Relatorios" />
      <div className="p-4 md:p-6 space-y-4">
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar inventarios." onRetry={loadInventarios} />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit overflow-x-auto scrollbar-hide">
              {tabConfig.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${activeTab === t.key ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Inventory selector */}
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

              {activeTab === 'divergencias' && (
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
              )}
            </div>

            {!selectedInv ? (
              <div className="text-center py-12">
                <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Selecione um inventario para ver os relatorios.</p>
              </div>
            ) : activeTab === 'divergencias' ? (
              <TabDivergencias
                divergences={divergences}
                loading={loadingReport}
                tolerance={tolerance}
                totalSobra={totalSobra}
                totalFalta={totalFalta}
                onExportCSV={handleExportDivCSV}
              />
            ) : activeTab === 'final' ? (
              <TabFinal report={finalReport} loading={loadingReport} />
            ) : (
              <TabLotes items={lotItems} loading={loadingReport} inventoryName={finalReport?.inventory.name ?? ''} />
            )}
          </>
        )}
      </div>
    </>
  );
}

// ==================== TAB DIVERGENCIAS ====================

function TabDivergencias({ divergences, loading, tolerance, totalSobra, totalFalta, onExportCSV }: {
  divergences: DivergenceRow[];
  loading: boolean;
  tolerance: number;
  totalSobra: number;
  totalFalta: number;
  onExportCSV: () => void;
}) {
  if (loading) return <TableSkeleton rows={6} cols={9} />;

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon={AlertTriangle} label="Total Divergencias" value={divergences.length} color="bg-amber-100 text-amber-600" />
        <SummaryCard icon={TrendingUp} label={`Sobras (contado > sistema)`} value={totalSobra} color="bg-green-100 text-green-600" />
        <SummaryCard icon={TrendingDown} label={`Faltas (contado < sistema)`} value={totalFalta} color="bg-red-100 text-red-600" />
      </div>

      {divergences.length > 0 && (
        <div className="flex justify-end">
          <ExportDropdown
            onCSV={onExportCSV}
            onExcel={() => {
              downloadExcel(`relatorio_divergencias_${new Date().toISOString().slice(0, 10)}`, 'Divergencias',
                ['Codigo', 'Descricao', 'Sistema', 'C1', 'C2', 'C3', 'Final', 'Diferenca', 'Var %'],
                divergences.map((d) => [d.product_code, d.product_name, d.system_qty, d.count_cycle_1, d.count_cycle_2, d.count_cycle_3, d.final_qty, d.variance, `${d.variance_pct.toFixed(1)}%`]),
              );
            }}
            onPrint={() => {
              printTable('Relatorio de Divergencias',
                ['Codigo', 'Descricao', 'Sistema', 'C1', 'C2', 'C3', 'Final', 'Diferenca', 'Var %'],
                divergences.map((d) => [d.product_code, d.product_name, d.system_qty.toFixed(2), d.count_cycle_1?.toFixed(2) ?? '', d.count_cycle_2?.toFixed(2) ?? '', d.count_cycle_3?.toFixed(2) ?? '', d.final_qty.toFixed(2), d.variance.toFixed(2), `${d.variance_pct.toFixed(1)}%`]),
              );
            }}
          />
        </div>
      )}

      {divergences.length === 0 ? (
        <div className="text-center py-8 bg-green-50 rounded-xl border border-green-200">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-700 text-sm font-medium">Nenhuma divergencia encontrada!</p>
          <p className="text-green-600 text-xs mt-1">
            {tolerance > 0 ? `Nenhum item com variacao acima de ${tolerance}%.` : 'Todas as contagens conferem.'}
          </p>
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
                <th className="text-left py-2.5 px-3 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {divergences.map((d, i) => (
                <tr
                  key={`${d.product_code}-${i}`}
                  className={`border-b border-slate-100 ${d.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30'}`}
                >
                  <td className="py-2.5 px-3 font-mono text-slate-700">{d.product_code}</td>
                  <td className="py-2.5 px-3 text-slate-800 truncate max-w-[180px]">{d.product_name}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{d.system_qty.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right bg-green-50/20">{d.count_cycle_1 !== null ? d.count_cycle_1.toFixed(2) : '—'}</td>
                  <td className="py-2.5 px-3 text-right bg-amber-50/20">{d.count_cycle_2 !== null ? d.count_cycle_2.toFixed(2) : '—'}</td>
                  <td className="py-2.5 px-3 text-right bg-red-50/20">{d.count_cycle_3 !== null ? d.count_cycle_3.toFixed(2) : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-capul-700">{d.final_qty.toFixed(2)}</td>
                  <td className={`py-2.5 px-3 text-right font-medium ${d.variance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {d.variance > 0 ? '+' : ''}{d.variance.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-medium ${Math.abs(d.variance_pct) > 10 ? 'text-red-600' : 'text-amber-600'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {d.variance > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(d.variance_pct).toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Link to={`/inventario/inventarios/${d.inventoryId}`} className="text-xs text-capul-600 hover:underline">Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ==================== TAB FINAL ====================

function TabFinal({ report, loading }: { report: FinalReport | null; loading: boolean }) {
  if (loading) return <TableSkeleton rows={6} cols={8} />;
  if (!report) return <div className="text-center py-8 text-slate-400 text-sm">Nenhum dado disponivel para este inventario.</div>;

  const s = report.summary;

  return (
    <>
      {/* Summary cards financeiros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Itens</p>
          <p className="text-xl font-bold text-slate-800">{s.total_items}</p>
          <p className="text-xs text-slate-400">{s.completion_percentage.toFixed(0)}% concluido</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs text-slate-500">Valor Esperado</p>
          </div>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(s.total_expected_value)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs text-slate-500">Valor Contado</p>
          </div>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(s.total_counted_value)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Variacao Financeira</p>
          <p className={`text-lg font-bold ${s.variance_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {s.variance_value >= 0 ? '+' : ''}{formatCurrency(s.variance_value)}
          </p>
          <p className={`text-xs ${s.variance_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {s.variance_percentage >= 0 ? '+' : ''}{s.variance_percentage.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Qtd Esperada" value={s.total_expected_qty.toFixed(0)} />
        <MiniStat label="Qtd Contada" value={s.total_counted_qty.toFixed(0)} />
        <MiniStat label="Var. Fisica" value={`${s.qty_variance >= 0 ? '+' : ''}${s.qty_variance.toFixed(0)}`} color={s.qty_variance >= 0 ? 'text-green-600' : 'text-red-600'} />
        <MiniStat label="Divergencias" value={String(s.items_with_discrepancy)} color="text-amber-600" />
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <ExportDropdown
          onCSV={() => {
            const header = 'Seq;Codigo;Descricao;Un;Esperado;Contado;Variacao;Custo Unit.;Valor Esperado;Valor Contado;Var. Valor;Status\n';
            const rows = report.items.map((it) =>
              `${it.sequence};${it.product_code};${it.product_name};${it.unit};${it.expected_quantity.toFixed(2)};${it.counted_quantity.toFixed(2)};${it.variance.toFixed(2)};${it.unit_price.toFixed(2)};${it.expected_value.toFixed(2)};${it.counted_value.toFixed(2)};${it.variance_value.toFixed(2)};${it.status}`,
            );
            downloadCSV(`relatorio_final_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
          }}
          onExcel={() => {
            downloadExcel(`relatorio_final_${new Date().toISOString().slice(0, 10)}`, 'Relatorio Final',
              ['Seq', 'Codigo', 'Descricao', 'Un', 'Esperado', 'Contado', 'Variacao', 'Custo Unit.', 'Valor Esperado', 'Valor Contado', 'Var. Valor', 'Status'],
              report.items.map((it) => [it.sequence, it.product_code, it.product_name, it.unit, it.expected_quantity, it.counted_quantity, it.variance, it.unit_price, it.expected_value, it.counted_value, it.variance_value, it.status]),
            );
          }}
          onPrint={() => {
            printTable(`Relatorio Final — ${report.inventory.name}`,
              ['Seq', 'Codigo', 'Descricao', 'Un', 'Esperado', 'Contado', 'Variacao', 'Custo Un.', 'Val. Esp.', 'Val. Cont.', 'Var. Valor'],
              report.items.map((it) => [it.sequence, it.product_code, it.product_name, it.unit, it.expected_quantity.toFixed(2), it.counted_quantity.toFixed(2), it.variance.toFixed(2), it.unit_price.toFixed(2), it.expected_value.toFixed(2), it.counted_value.toFixed(2), it.variance_value.toFixed(2)]),
            );
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-3 font-medium text-slate-500 w-10">#</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
              <th className="text-center py-2.5 px-2 font-medium text-slate-600 w-10">Un</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Esperado</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Contado</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Var.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Custo Un.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Val. Esp.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Val. Cont.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Var. Valor</th>
            </tr>
          </thead>
          <tbody>
            {report.items.map((it) => {
              const hasDivergence = Math.abs(it.variance) >= 0.01;
              return (
                <tr
                  key={`${it.product_code}-${it.sequence}`}
                  className={`border-b border-slate-100 ${hasDivergence ? (it.variance < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') : ''}`}
                >
                  <td className="py-2 px-3 text-slate-400 text-xs">{it.sequence}</td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-700">{it.product_code}</td>
                  <td className="py-2 px-3 text-slate-800 truncate max-w-[180px]" title={it.product_name}>{it.product_name}</td>
                  <td className="py-2 px-2 text-center text-slate-500 text-xs">{it.unit}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{it.expected_quantity.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{it.counted_quantity.toFixed(2)}</td>
                  <td className={`py-2 px-3 text-right font-medium tabular-nums ${it.variance > 0 ? 'text-green-600' : it.variance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {it.variance > 0 ? '+' : ''}{it.variance.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-500 tabular-nums">{it.unit_price.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{it.expected_value.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{it.counted_value.toFixed(2)}</td>
                  <td className={`py-2 px-3 text-right font-medium tabular-nums ${it.variance_value > 0 ? 'text-green-600' : it.variance_value < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {it.variance_value > 0 ? '+' : ''}{it.variance_value.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
              <td colSpan={4} className="py-2.5 px-3 text-slate-700">Total</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{s.total_expected_qty.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{s.total_counted_qty.toFixed(2)}</td>
              <td className={`py-2.5 px-3 text-right tabular-nums ${s.qty_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {s.qty_variance >= 0 ? '+' : ''}{s.qty_variance.toFixed(2)}
              </td>
              <td className="py-2.5 px-3"></td>
              <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(s.total_expected_value)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{formatCurrency(s.total_counted_value)}</td>
              <td className={`py-2.5 px-3 text-right tabular-nums ${s.variance_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {s.variance_value >= 0 ? '+' : ''}{formatCurrency(s.variance_value)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-right">
        Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')} por {report.generated_by}
        {s.products_with_zero_cost > 0 && ` — ${s.products_with_zero_cost} produto(s) com custo zero`}
      </p>
    </>
  );
}

// ==================== TAB LOTES ====================

function TabLotes({ items, loading, inventoryName }: { items: FinalReportItem[]; loading: boolean; inventoryName: string }) {
  if (loading) return <TableSkeleton rows={6} cols={6} />;

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">Nenhum produto com controle de lote neste inventario.</p>
      </div>
    );
  }

  // Flatten lots per item — cruzar snapshot_lots (saldo sistema) com counted_lots (contagem real)
  const flatRows: { product_code: string; product_name: string; lot_number: string; system_qty: number; counted_qty: number | null; b8_lotefor: string }[] = [];
  for (const it of items) {
    const countedMap = new Map<string, number>();
    for (const cl of (it.counted_lots ?? [])) {
      countedMap.set(cl.lot_number, cl.counted_qty);
    }

    if (it.snapshot_lots.length > 0) {
      for (const lot of it.snapshot_lots) {
        const counted = countedMap.get(lot.lot_number) ?? null;
        flatRows.push({ product_code: it.product_code, product_name: it.product_name, lot_number: lot.lot_number, system_qty: lot.quantity, counted_qty: counted, b8_lotefor: lot.b8_lotefor ?? '' });
        countedMap.delete(lot.lot_number);
      }
    }
    // Lotes contados que não existiam no snapshot (saldo zero no sistema)
    for (const [lotNum, qty] of countedMap) {
      flatRows.push({ product_code: it.product_code, product_name: it.product_name, lot_number: lotNum, system_qty: 0, counted_qty: qty, b8_lotefor: '' });
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <ExportDropdown
          onCSV={() => {
            const header = 'Codigo;Descricao;Lote;Lote Forn.;Saldo Sistema;Qtd Contada;Diferenca\n';
            const rows = flatRows.map((r) => {
              const diff = r.counted_qty !== null ? r.counted_qty - r.system_qty : '';
              return `${r.product_code};${r.product_name};${r.lot_number};${r.b8_lotefor};${r.system_qty.toFixed(2)};${r.counted_qty?.toFixed(2) ?? ''};${typeof diff === 'number' ? diff.toFixed(2) : ''}`;
            });
            downloadCSV(`relatorio_lotes_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
          }}
          onExcel={() => {
            downloadExcel(`relatorio_lotes_${new Date().toISOString().slice(0, 10)}`, 'Lotes',
              ['Codigo', 'Descricao', 'Lote', 'Lote Forn.', 'Saldo Sistema', 'Qtd Contada', 'Diferenca'],
              flatRows.map((r) => {
                const diff = r.counted_qty !== null ? r.counted_qty - r.system_qty : null;
                return [r.product_code, r.product_name, r.lot_number, r.b8_lotefor, r.system_qty, r.counted_qty, diff];
              }),
            );
          }}
          onPrint={() => {
            printTable(`Relatorio por Lote — ${inventoryName}`,
              ['Codigo', 'Descricao', 'Lote', 'Lote Forn.', 'Saldo Sistema', 'Qtd Contada', 'Diferenca'],
              flatRows.map((r) => {
                const diff = r.counted_qty !== null ? r.counted_qty - r.system_qty : null;
                return [r.product_code, r.product_name, r.lot_number, r.b8_lotefor, r.system_qty.toFixed(2), r.counted_qty?.toFixed(2) ?? '', diff !== null ? diff.toFixed(2) : ''];
              }),
            );
          }}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Lote</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Lote Forn.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Saldo Sistema</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Qtd Contada</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Diferenca</th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map((r, i) => {
              const diff = r.counted_qty !== null ? r.counted_qty - r.system_qty : null;
              const hasDiff = diff !== null && Math.abs(diff) >= 0.01;
              return (
                <tr key={`${r.product_code}-${r.lot_number}-${i}`} className={`border-b border-slate-100 ${hasDiff ? (diff! < 0 ? 'bg-red-50/30' : 'bg-amber-50/30') : ''}`}>
                  <td className="py-2 px-3 font-mono text-xs text-slate-700">{r.product_code}</td>
                  <td className="py-2 px-3 text-slate-800 truncate max-w-[180px]">{r.product_name}</td>
                  <td className="py-2 px-3 font-mono text-xs text-slate-600">{r.lot_number}</td>
                  <td className="py-2 px-3 text-slate-500 text-xs">{r.b8_lotefor || '—'}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.system_qty.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.counted_qty !== null ? r.counted_qty.toFixed(2) : '—'}</td>
                  <td className={`py-2 px-3 text-right font-medium tabular-nums ${diff !== null && diff > 0 ? 'text-green-600' : diff !== null && diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-right">{items.length} produto(s) com lote, {flatRows.length} linha(s) de lote</p>
    </>
  );
}

// ==================== SHARED COMPONENTS ====================

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold" style={{ color: 'inherit' }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
