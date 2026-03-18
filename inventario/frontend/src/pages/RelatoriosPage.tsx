import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { inventoryService } from '../services/inventory.service';
import { comparisonService } from '../services/comparison.service';
import { integrationService } from '../services/integration.service';
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
  ArrowRightLeft,
} from 'lucide-react';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';
import { PageSkeleton, TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import type { InventoryList, FinalReport, FinalReportItem, ComparisonResult, IntegrationHistory, IntegrationDetailItem } from '../types';

type Tab = 'divergencias' | 'final' | 'lotes' | 'transferencias';

const tabConfig: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'divergencias', label: 'Divergencias', icon: AlertTriangle },
  { key: 'final', label: 'Relatorio Final', icon: FileText },
  { key: 'lotes', label: 'Relatorio por Lote', icon: Layers },
  { key: 'transferencias', label: 'Transferencias', icon: ArrowRightLeft },
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

            {/* Inventory selector - oculto na aba transferencias */}
            {activeTab !== 'transferencias' && (
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
                      {inv.name} ({inv.warehouse}) — {{ DRAFT: 'Em Preparacao', IN_PROGRESS: 'Em Andamento', COMPLETED: 'Concluido', CLOSED: 'Efetivado' }[inv.status] ?? inv.status}
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
            )}

            {activeTab === 'transferencias' ? (
              <TabTransferencias inventarios={inventarios} />
            ) : !selectedInv ? (
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

// ==================== TAB TRANSFERENCIAS ====================

type TransfSubTab = 'integradas' | 'simulacao';

function TabTransferencias({ inventarios }: { inventarios: InventoryList[] }) {
  const [subTab, setSubTab] = useState<TransfSubTab>('integradas');
  const [integratedInvIds, setIntegratedInvIds] = useState<Set<string>>(new Set());

  // Carregar IDs de inventários já integrados (para filtrar na simulação)
  useEffect(() => {
    integrationService.historico(undefined, 200)
      .then((res) => {
        const ids = new Set<string>();
        for (const h of res.history) {
          if (h.status !== 'CANCELLED') {
            if (h.inventory_a_id) ids.add(h.inventory_a_id);
            if (h.inventory_b_id) ids.add(h.inventory_b_id);
          }
        }
        setIntegratedInvIds(ids);
      })
      .catch(() => {});
  }, []);

  // Inventários não integrados
  const nonIntegratedInvs = useMemo(() =>
    inventarios.filter((inv) => !integratedInvIds.has(inv.id)),
  [inventarios, integratedInvIds]);

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSubTab('integradas')}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${subTab === 'integradas' ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Integradas (Protheus)
        </button>
        <button
          onClick={() => setSubTab('simulacao')}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${subTab === 'simulacao' ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Simulacao
        </button>
      </div>

      {subTab === 'integradas' ? (
        <SubTabIntegradas />
      ) : (
        <SubTabSimulacao inventarios={nonIntegratedInvs} />
      )}
    </>
  );
}

// ---- Sub-tab: Integrações reais (Protheus) ----

function SubTabIntegradas() {
  const [history, setHistory] = useState<IntegrationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ items: IntegrationDetailItem[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<{ endpoint: string; status: string; detalhes: { codigo: string; lote: string; status: string; mensagem: string }[] }[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setLoading(true);
    integrationService.historico(undefined, 100)
      .then((res) => setHistory(res.history))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  // Carregar detalhes ao selecionar
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    integrationService.buscarPorId(selectedId)
      .then((res) => {
        // O endpoint retorna { integration: {...}, items: [...] }
        const data = res as unknown as { items: IntegrationDetailItem[] };
        setDetail(data);
      })
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  // Filtrar apenas COMPARATIVE com transferencias
  const comparativeHistory = history.filter((h) => h.integration_type === 'COMPARATIVE');
  // Filtrar transferencias reais (qty > 0 e com lote — excluir linhas agregadas)
  const transferItems = (detail?.items ?? []).filter((i) =>
    i.item_type === 'TRANSFER' && i.quantity > 0 && i.lot_number
  );

  const statusLabel: Record<string, { text: string; color: string }> = {
    DRAFT: { text: 'Rascunho', color: 'bg-slate-100 text-slate-600' },
    SENT: { text: 'Enviada', color: 'bg-blue-100 text-blue-700' },
    CONFIRMED: { text: 'Confirmada', color: 'bg-green-100 text-green-700' },
    PARTIAL: { text: 'Parcial', color: 'bg-amber-100 text-amber-700' },
    ERROR: { text: 'Erro', color: 'bg-red-100 text-red-700' },
    CANCELLED: { text: 'Cancelada', color: 'bg-slate-100 text-slate-500' },
  };

  if (loading) return <TableSkeleton rows={4} cols={6} />;

  if (comparativeHistory.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
        <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-600 text-sm font-medium">Nenhuma integracao comparativa realizada.</p>
        <p className="text-slate-400 text-xs mt-1">As transferencias aparecerao aqui apos serem salvas na pagina de Envio ao Protheus.</p>
      </div>
    );
  }

  const selectedIntegration = comparativeHistory.find((h) => h.id === selectedId);

  return (
    <>
      {/* Lista de integrações */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Inventarios</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Armazens</th>
              <th className="text-center py-2.5 px-3 font-medium text-slate-600">Status</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Transf.</th>
              <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Transf.</th>
              <th className="text-left py-2.5 px-3 font-medium text-slate-600">Data</th>
              <th className="py-2.5 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparativeHistory.map((h) => {
              const st = statusLabel[h.status] ?? { text: h.status, color: 'bg-slate-100 text-slate-600' };
              const isSelected = selectedId === h.id;
              return (
                <tr key={h.id} className={isSelected ? 'bg-capul-50' : 'hover:bg-slate-50'}>
                  <td className="py-2 px-3">
                    <p className="text-xs text-slate-700 font-medium">{h.inventory_a_name}</p>
                    {h.inventory_b_name && <p className="text-xs text-slate-500">{h.inventory_b_name}</p>}
                  </td>
                  <td className="py-2 px-3 text-xs text-slate-600">
                    {h.warehouse_a} ↔ {h.warehouse_b ?? '—'}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.text}</span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-700">{h.summary?.total_transfers ?? 0}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-700">{formatCurrency(h.summary?.total_transfer_value ?? 0)}</td>
                  <td className="py-2 px-3 text-xs text-slate-500">
                    {h.sent_at ? new Date(h.sent_at).toLocaleDateString('pt-BR') : h.created_at ? new Date(h.created_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => setSelectedId(isSelected ? null : h.id)}
                      className="text-xs text-capul-600 hover:underline font-medium"
                    >
                      {isSelected ? 'Fechar' : 'Ver itens'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detalhes da integração selecionada */}
      {selectedId && selectedIntegration && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">
              Transferencias — {selectedIntegration.warehouse_a} ↔ {selectedIntegration.warehouse_b}
            </h4>
            {transferItems.length > 0 && (
              <ExportDropdown
                onCSV={() => {
                  const header = 'Codigo;Descricao;Lote;Origem;Destino;Quantidade;Custo Un.;Valor Total;Status\n';
                  const rows = transferItems.map((i) =>
                    `${i.product_code};${i.product_description};${i.lot_number ?? ''};${i.source_warehouse};${i.target_warehouse ?? ''};${i.quantity};${i.unit_cost};${i.total_value};${i.item_status}`
                  );
                  downloadCSV(`transferencias_protheus_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
                }}
                onExcel={() => {
                  downloadExcel(`transferencias_protheus_${new Date().toISOString().slice(0, 10)}`, 'Transferencias',
                    ['Codigo', 'Descricao', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Custo Un.', 'Valor Total', 'Status'],
                    transferItems.map((i) => [i.product_code, i.product_description, i.lot_number ?? '', i.source_warehouse, i.target_warehouse ?? '', i.quantity, i.unit_cost, i.total_value, i.item_status]),
                  );
                }}
                onPrint={() => {
                  printTable(`Transferencias Protheus — ${selectedIntegration.warehouse_a} ↔ ${selectedIntegration.warehouse_b}`,
                    ['Codigo', 'Descricao', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Custo Un.', 'Valor Total'],
                    transferItems.map((i) => [i.product_code, i.product_description, i.lot_number ?? '', i.source_warehouse, i.target_warehouse ?? '', i.quantity.toFixed(2), i.unit_cost.toFixed(2), i.total_value.toFixed(2)]),
                  );
                }}
              />
            )}
          </div>

          {loadingDetail ? (
            <TableSkeleton rows={5} cols={7} />
          ) : transferItems.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">Nenhum item de transferencia nesta integracao.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                    <th className="text-left py-2.5 px-3 font-medium text-slate-600">Lote</th>
                    <th className="text-center py-2.5 px-3 font-medium text-blue-600">Origem</th>
                    <th className="text-center py-2.5 px-3 font-medium text-purple-600">Destino</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Quantidade</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Custo Un.</th>
                    <th className="text-right py-2.5 px-3 font-medium text-slate-600">Valor Total</th>
                    <th className="text-center py-2.5 px-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transferItems.map((item, i) => {
                    const itemSt = item.item_status === 'SENT' || item.item_status === 'CONFIRMED'
                      ? { text: 'OK', color: 'bg-green-100 text-green-700' }
                      : item.item_status === 'ERROR'
                        ? { text: 'Erro', color: 'bg-red-100 text-red-700' }
                        : { text: item.item_status, color: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={i} className={`hover:bg-slate-50 ${item.item_status === 'ERROR' ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2 px-3 font-mono text-xs text-slate-700">{item.product_code}</td>
                        <td className="py-2 px-3 text-slate-800 truncate max-w-[180px]">{item.product_description}</td>
                        <td className="py-2 px-3 text-xs text-slate-500">{item.lot_number || '—'}</td>
                        <td className="py-2 px-3 text-center text-xs font-medium text-blue-600">{item.source_warehouse}</td>
                        <td className="py-2 px-3 text-center text-xs font-medium text-purple-600">{item.target_warehouse || '—'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-blue-600 tabular-nums">{item.quantity.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-500 tabular-nums">{item.unit_cost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-700 tabular-nums">{formatCurrency(item.total_value)}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${itemSt.color}`}>{itemSt.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
                    <td colSpan={5} className="py-2.5 px-3 text-slate-700">Total ({transferItems.length} itens)</td>
                    <td className="py-2.5 px-3 text-right text-blue-700 tabular-nums">
                      {transferItems.reduce((s, i) => s + i.quantity, 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right text-slate-700 tabular-nums">
                      {formatCurrency(transferItems.reduce((s, i) => s + i.total_value, 0))}
                    </td>
                    <td className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Botão ver logs de envio */}
          {selectedIntegration.status === 'PARTIAL' || selectedIntegration.status === 'ERROR' ? (
            <div>
              <button
                onClick={() => {
                  if (showLogs) { setShowLogs(false); return; }
                  setLoadingLogs(true);
                  setShowLogs(true);
                  integrationService.buscarLogs(selectedId)
                    .then((res) => {
                      // Agrupar logs com detalhes de erro do response_payload
                      const parsed = res.logs
                        .filter((l) => l.endpoint !== '/INVENTARIO/historico')
                        .map((l) => {
                          const resp = l.response_payload as { detalhes?: { codigo: string; lote: string; status: string; mensagem: string }[] } | null;
                          return {
                            endpoint: l.endpoint,
                            status: l.status,
                            detalhes: (resp?.detalhes ?? []).filter((d) => d.status === 'ERRO'),
                          };
                        })
                        .filter((l) => l.detalhes.length > 0);
                      setLogs(parsed);
                    })
                    .catch(() => setLogs([]))
                    .finally(() => setLoadingLogs(false));
                }}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {showLogs ? 'Ocultar erros do Protheus' : 'Ver erros do Protheus'}
              </button>

              {showLogs && (
                <div className="mt-2">
                  {loadingLogs ? (
                    <p className="text-xs text-slate-400">Carregando logs...</p>
                  ) : logs.length === 0 ? (
                    <p className="text-xs text-green-600">Nenhum erro encontrado nos logs.</p>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                      <p className="text-xs text-amber-700 font-medium">Erros retornados pelo Protheus:</p>
                      {logs.map((log, li) => (
                        <div key={li}>
                          <p className="text-xs text-slate-600 font-medium mb-1">
                            {log.endpoint === '/inventario/transferencia' ? 'Transferencia (SD3)' : 'Digitacao (SB7)'}
                          </p>
                          <div className="space-y-1">
                            {log.detalhes.map((d, di) => (
                              <div key={di} className="flex items-start gap-2 text-xs bg-white rounded px-2 py-1.5 border border-amber-100">
                                <span className="font-mono text-slate-600 shrink-0">{d.codigo}</span>
                                {d.lote && <span className="text-slate-400 shrink-0">Lote: {d.lote || 'vazio'}</span>}
                                <span className="text-red-600">{d.mensagem.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

// ---- Sub-tab: Simulação (comparação livre) ----

function SubTabSimulacao({ inventarios }: { inventarios: InventoryList[] }) {
  const [invAId, setInvAId] = useState('');
  const [invBId, setInvBId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [compatibleInvs, setCompatibleInvs] = useState<InventoryList[]>([]);
  const [loadingCompat, setLoadingCompat] = useState(false);

  useEffect(() => {
    setInvBId('');
    setResult(null);
    setCompatibleInvs([]);
    if (!invAId) return;

    setLoadingCompat(true);
    comparisonService.listarDisponiveis(invAId)
      .then((list) => {
        setCompatibleInvs(list.length > 0 ? list : inventarios.filter((i) => i.id !== invAId));
      })
      .catch(() => {
        setCompatibleInvs(inventarios.filter((i) => i.id !== invAId));
      })
      .finally(() => setLoadingCompat(false));
  }, [invAId, inventarios]);

  useEffect(() => {
    if (!invAId || !invBId) { setResult(null); return; }
    setLoading(true);
    comparisonService.comparar(invAId, invBId)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [invAId, invBId]);

  const withTransfer = useMemo(() => {
    if (!result) return [];
    const all = [...(result.matches ?? []), ...(result.manual_review ?? [])];
    return all.filter((i) => i.transferencia_logica?.quantidade_transferida);
  }, [result]);

  const totalEconomia = withTransfer.reduce((sum, i) => sum + (i.transferencia_logica?.economia_estimada ?? 0), 0);
  const totalTransferido = withTransfer.reduce((sum, i) => sum + (i.transferencia_logica?.quantidade_transferida ?? 0), 0);

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-700">
          <strong>Simulacao:</strong> esta visao permite comparar inventarios livremente. Para dados oficiais integrados com o Protheus, use a aba "Integradas".
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Inventario A</label>
          <select
            value={invAId}
            onChange={(e) => setInvAId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          >
            <option value="">Selecione...</option>
            {inventarios.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.warehouse})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Inventario B (comparar)</label>
          <select
            value={invBId}
            onChange={(e) => setInvBId(e.target.value)}
            disabled={!invAId || loadingCompat}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 disabled:opacity-50"
          >
            <option value="">{loadingCompat ? 'Carregando...' : 'Selecione...'}</option>
            {compatibleInvs.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name} ({inv.warehouse})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!invAId || !invBId ? (
        <div className="text-center py-10">
          <ArrowRightLeft className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Selecione dois inventarios para simular transferencias.</p>
        </div>
      ) : loading ? (
        <TableSkeleton rows={6} cols={8} />
      ) : !result ? (
        <ErrorState message="Erro ao carregar comparacao." />
      ) : withTransfer.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600 text-sm font-medium">Nenhuma transferencia logica identificada.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Produtos Transferidos</p>
              <p className="text-xl font-bold text-slate-800">{withTransfer.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Qtd Total Transferida</p>
              <p className="text-xl font-bold text-blue-600">{totalTransferido.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Zerados A / B</p>
              <p className="text-xl font-bold text-green-600">{result.summary.zeroed_a} / {result.summary.zeroed_b}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 mb-1">Economia Estimada</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(totalEconomia)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <ExportDropdown
              onCSV={() => {
                const header = 'Codigo;Descricao;Origem;Saldo Antes;Saldo Depois;Destino;Saldo Antes;Saldo Depois;Qtd Transf.;Economia\n';
                const rows = withTransfer.map((i) => {
                  const t = i.transferencia_logica;
                  return `${i.product_code};${i.description};${t.origem};${t.saldo_origem_antes};${t.saldo_origem_depois};${t.destino};${t.saldo_destino_antes};${t.saldo_destino_depois};${t.quantidade_transferida};${t.economia_estimada.toFixed(2)}`;
                });
                downloadCSV(`simulacao_transferencias_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
              }}
              onExcel={() => {
                downloadExcel(`simulacao_transferencias_${new Date().toISOString().slice(0, 10)}`, 'Simulacao',
                  ['Codigo', 'Descricao', 'Origem', 'Saldo Antes', 'Saldo Depois', 'Destino', 'Saldo Antes', 'Saldo Depois', 'Qtd Transf.', 'Economia'],
                  withTransfer.map((i) => {
                    const t = i.transferencia_logica;
                    return [i.product_code, i.description, t.origem, t.saldo_origem_antes, t.saldo_origem_depois, t.destino, t.saldo_destino_antes, t.saldo_destino_depois, t.quantidade_transferida, t.economia_estimada];
                  }),
                );
              }}
              onPrint={() => {
                printTable('Simulacao de Transferencias Logicas',
                  ['Codigo', 'Descricao', 'Origem', 'Antes', 'Depois', 'Destino', 'Antes', 'Depois', 'Qtd Transf.', 'Economia'],
                  withTransfer.map((i) => {
                    const t = i.transferencia_logica;
                    return [i.product_code, i.description, t.origem, t.saldo_origem_antes.toFixed(2), t.saldo_origem_depois.toFixed(2), t.destino, t.saldo_destino_antes.toFixed(2), t.saldo_destino_depois.toFixed(2), t.quantidade_transferida.toFixed(2), formatCurrency(t.economia_estimada)];
                  }),
                );
              }}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600" rowSpan={2}>Codigo</th>
                  <th className="text-left py-2.5 px-3 font-medium text-slate-600" rowSpan={2}>Descricao</th>
                  <th className="py-2 px-3 font-medium text-blue-600 text-center border-b border-slate-200" colSpan={2}>Origem</th>
                  <th className="py-2 px-3 font-medium text-purple-600 text-center border-b border-slate-200" colSpan={2}>Destino</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600" rowSpan={2}>Qtd Transf.</th>
                  <th className="text-right py-2.5 px-3 font-medium text-slate-600" rowSpan={2}>Economia</th>
                </tr>
                <tr className="bg-slate-50 text-xs">
                  <th className="py-2 px-3 text-right text-slate-500">Antes</th>
                  <th className="py-2 px-3 text-right text-slate-500">Depois</th>
                  <th className="py-2 px-3 text-right text-slate-500">Antes</th>
                  <th className="py-2 px-3 text-right text-slate-500">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withTransfer.map((item, i) => {
                  const t = item.transferencia_logica;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-xs text-slate-700">{item.product_code}</td>
                      <td className="py-2 px-3 text-slate-800 truncate max-w-[180px]">{item.description}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span className="text-xs text-blue-600 font-medium">{t.origem}</span>{' '}{t.saldo_origem_antes.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{t.saldo_origem_depois.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span className="text-xs text-purple-600 font-medium">{t.destino}</span>{' '}{t.saldo_destino_antes.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{t.saldo_destino_depois.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-blue-600 tabular-nums">{t.quantidade_transferida.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-green-600 tabular-nums">
                        {t.economia_estimada > 0 ? formatCurrency(t.economia_estimada) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
                  <td colSpan={6} className="py-2.5 px-3 text-slate-700">Total ({withTransfer.length} produtos)</td>
                  <td className="py-2.5 px-3 text-right text-blue-700 tabular-nums">{totalTransferido.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-green-700 tabular-nums">{formatCurrency(totalEconomia)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
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
