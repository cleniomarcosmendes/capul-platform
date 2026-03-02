import { useEffect, useState, useCallback } from 'react';
import { Header } from '../layouts/Header';
import { discrepancyService } from '../services/discrepancy.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import type { Discrepancy, ClosedRound, IntegrationAdjustment, AdjustmentsSummary } from '../types';
import { CheckCircle, RotateCcw, Edit3, Filter, ArrowRightLeft, TrendingUp, TrendingDown, Minus, Send } from 'lucide-react';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';

type Tab = 'divergencias' | 'ajustes';

export default function DivergenciasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('divergencias');
  const [rounds, setRounds] = useState<ClosedRound[]>([]);
  const [selectedRound, setSelectedRound] = useState('');
  const toast = useToast();
  const { inventarioRole } = useAuth();
  const isStaff = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';

  // Load rounds once
  useEffect(() => {
    discrepancyService.listarRodadas().then(setRounds).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'divergencias', label: 'Divergencias', icon: TrendingDown },
    { key: 'ajustes', label: 'Ajustes e Transferencias', icon: ArrowRightLeft },
  ];

  return (
    <>
      <Header title="Divergencias" />
      <div className="p-4 md:p-6 space-y-6">
        {/* Filter + Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            >
              <option value="">Todos os Inventarios</option>
              {rounds.map((r) => (
                <option key={r.round_key} value={r.round_key}>{r.display_text}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-capul-600 text-capul-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'divergencias' && (
          <TabDivergencias
            selectedRound={selectedRound}
            isStaff={isStaff}
            toast={toast}
          />
        )}
        {activeTab === 'ajustes' && (
          <TabAjustes selectedRound={selectedRound} />
        )}
      </div>
    </>
  );
}

// =============================================
// Tab Divergencias (existing functionality)
// =============================================

function TabDivergencias({
  selectedRound,
  isStaff,
  toast,
}: {
  selectedRound: string;
  isStaff: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const items = await discrepancyService.listar(selectedRound || undefined);
      setDiscrepancies(items);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRound]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleResolve = async (id: string, type: 'ACCEPT' | 'RECOUNT' | 'ADJUST') => {
    let finalQuantity: number | undefined;
    if (type === 'ADJUST') {
      const input = prompt('Informe a quantidade final ajustada:');
      if (input === null) return;
      finalQuantity = parseFloat(input);
      if (isNaN(finalQuantity)) { toast.error('Quantidade invalida.'); return; }
    }

    setResolvingId(id);
    try {
      await discrepancyService.resolver(id, {
        resolution_type: type,
        final_quantity: finalQuantity,
        notes: type === 'ACCEPT' ? 'Contagem aceita' : type === 'RECOUNT' ? 'Recontagem solicitada' : `Ajuste manual: ${finalQuantity}`,
      });
      toast.success(
        type === 'ACCEPT' ? 'Contagem aceita.' :
        type === 'RECOUNT' ? 'Recontagem solicitada.' :
        'Ajuste manual aplicado.',
      );
      loadData();
    } catch {
      toast.error('Erro ao resolver divergencia.');
    } finally {
      setResolvingId(null);
    }
  };

  const total = discrepancies.length;
  const pending = discrepancies.filter((d) => d.status === 'PENDING').length;
  const resolved = discrepancies.filter((d) => d.status === 'RESOLVED').length;
  const avgVariance = total > 0
    ? (discrepancies.reduce((s, d) => s + Math.abs(d.variance_percentage), 0) / total).toFixed(1)
    : '0.0';

  if (loading) return <TableSkeleton rows={6} cols={8} />;
  if (error) return <ErrorState message="Erro ao carregar divergencias." onRetry={loadData} />;

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={total} color="text-slate-800" />
        <StatCard label="Pendentes" value={pending} color="text-yellow-600" />
        <StatCard label="Resolvidas" value={resolved} color="text-green-600" />
        <StatCard label="Diverg. Media" value={`${avgVariance}%`} color="text-red-600" />
      </div>

      {/* Export */}
      {discrepancies.length > 0 && (
        <div className="flex justify-end">
          <ExportDropdown
            onCSV={() => {
              const header = 'Codigo;Descricao;Inventario;Qtd Sistema;Qtd Contada;Diferenca;%;Status\n';
              const rows = discrepancies.map((d) => {
                const counted = d.counted_quantity ?? (d.expected_quantity + d.variance_quantity);
                return `${d.product_code};${d.product_description};${d.inventory_name};${d.expected_quantity};${counted};${d.variance_quantity};${d.variance_percentage.toFixed(1)}%;${d.status === 'RESOLVED' ? 'Resolvido' : 'Pendente'}`;
              });
              downloadCSV(`divergencias_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
            }}
            onExcel={() => {
              const headers = ['Codigo', 'Descricao', 'Inventario', 'Qtd Sistema', 'Qtd Contada', 'Diferenca', '%', 'Status'];
              downloadExcel(`divergencias_${new Date().toISOString().slice(0, 10)}`, 'Divergencias', headers,
                discrepancies.map((d) => {
                  const counted = d.counted_quantity ?? (d.expected_quantity + d.variance_quantity);
                  return [d.product_code, d.product_description, d.inventory_name, d.expected_quantity, counted, d.variance_quantity, `${d.variance_percentage.toFixed(1)}%`, d.status === 'RESOLVED' ? 'Resolvido' : 'Pendente'];
                }),
              );
            }}
            onPrint={() => {
              const headers = ['Codigo', 'Descricao', 'Inventario', 'Qtd Sistema', 'Qtd Contada', 'Diferenca', '%', 'Status'];
              printTable('Divergencias', headers,
                discrepancies.map((d) => {
                  const counted = d.counted_quantity ?? (d.expected_quantity + d.variance_quantity);
                  return [d.product_code, d.product_description, d.inventory_name, d.expected_quantity, counted, d.variance_quantity, `${d.variance_percentage.toFixed(1)}%`, d.status === 'RESOLVED' ? 'Resolvido' : 'Pendente'];
                }),
              );
            }}
          />
        </div>
      )}

      {/* Table */}
      {discrepancies.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="text-sm">Nenhuma divergencia encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="py-3 px-4 font-medium text-slate-600">Codigo</th>
                <th className="py-3 px-4 font-medium text-slate-600">Descricao</th>
                <th className="py-3 px-4 font-medium text-slate-600">Inventario</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Qtd Sistema</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Qtd Contada</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Diferenca</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">%</th>
                <th className="py-3 px-4 font-medium text-slate-600">Status</th>
                {isStaff && <th className="py-3 px-4 font-medium text-slate-600">Acoes</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discrepancies.map((d) => {
                const counted = d.counted_quantity ?? (d.expected_quantity + d.variance_quantity);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-xs">{d.product_code}</td>
                    <td className="py-2.5 px-4 max-w-[200px] truncate">{d.product_description}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">{d.inventory_name}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{d.expected_quantity}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{counted}</td>
                    <td className={`py-2.5 px-4 text-right font-medium tabular-nums ${d.variance_quantity > 0 ? 'text-blue-600' : d.variance_quantity < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {d.variance_quantity > 0 ? '+' : ''}{d.variance_quantity}
                    </td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${Math.abs(d.variance_percentage) > 10 ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                      {d.variance_percentage.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {d.status === 'RESOLVED' ? 'Resolvido' : 'Pendente'}
                      </span>
                    </td>
                    {isStaff && (
                      <td className="py-2.5 px-4">
                        {d.status === 'PENDING' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleResolve(d.id, 'ACCEPT')} disabled={resolvingId === d.id} className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-50" title="Aceitar contagem"><CheckCircle className="w-4 h-4" /></button>
                            <button onClick={() => handleResolve(d.id, 'RECOUNT')} disabled={resolvingId === d.id} className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50" title="Solicitar recontagem"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => handleResolve(d.id, 'ADJUST')} disabled={resolvingId === d.id} className="p-1.5 rounded hover:bg-orange-50 text-orange-600 disabled:opacity-50" title="Ajuste manual"><Edit3 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// =============================================
// Tab Ajustes e Transferencias
// =============================================

const ADJ_TYPE_LABELS: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  INCREASE: { label: 'Entrada', color: 'text-blue-600', Icon: TrendingUp },
  DECREASE: { label: 'Saida', color: 'text-red-600', Icon: TrendingDown },
  TRANSFER: { label: 'Transferencia', color: 'text-purple-600', Icon: ArrowRightLeft },
  NO_CHANGE: { label: 'Sem alteracao', color: 'text-slate-400', Icon: Minus },
};

const INTEG_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Pendente', className: 'bg-blue-100 text-blue-700' },
  PENDENTE: { label: 'Pendente', className: 'bg-blue-100 text-blue-700' },
  ENVIADO: { label: 'Enviado', className: 'bg-green-100 text-green-700' },
  CONFIRMADO: { label: 'Confirmado', className: 'bg-green-100 text-green-700' },
  ERRO: { label: 'Erro', className: 'bg-red-100 text-red-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600' },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function TabAjustes({ selectedRound }: { selectedRound: string }) {
  const [items, setItems] = useState<IntegrationAdjustment[]>([]);
  const [summary, setSummary] = useState<AdjustmentsSummary>({ adjustments: 0, transfers: 0, total_value: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await discrepancyService.listarAjustes(selectedRound || undefined);
      setItems(result.items);
      setSummary(result.summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRound]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <TableSkeleton rows={6} cols={8} />;
  if (error) return <ErrorState message="Erro ao carregar ajustes." onRetry={loadData} />;

  // Stats
  const increases = items.filter((i) => i.adjustment_type === 'INCREASE').length;
  const decreases = items.filter((i) => i.adjustment_type === 'DECREASE').length;

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Itens" value={items.length} color="text-slate-800" />
        <StatCard label="Ajustes" value={summary.adjustments} color="text-blue-600" />
        <StatCard label="Transferencias" value={summary.transfers} color="text-purple-600" />
        <StatCard label="Valor Total" value={formatCurrency(summary.total_value)} color="text-red-600" />
      </div>

      {/* Sub-stats */}
      {(increases > 0 || decreases > 0) && (
        <div className="flex gap-4 text-xs text-slate-500">
          {increases > 0 && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-blue-500" /> {increases} entrada(s)</span>}
          {decreases > 0 && <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-500" /> {decreases} saida(s)</span>}
        </div>
      )}

      {/* Export */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <ExportDropdown
            onCSV={() => {
              const header = 'Tipo;Codigo;Descricao;Lote;Origem;Destino;Quantidade;Esperado;Contado;Custo Unit;Valor;Status Integracao\n';
              const rows = items.map((i) => {
                const typeLabel = ADJ_TYPE_LABELS[i.adjustment_type]?.label ?? i.adjustment_type;
                const statusLabel = INTEG_STATUS_LABELS[i.integration_status]?.label ?? i.integration_status;
                return `${typeLabel};${i.product_code};${i.product_description};${i.lot_number || ''};${i.source_warehouse || ''};${i.target_warehouse || ''};${i.quantity};${i.expected_qty};${i.counted_qty};${i.unit_cost.toFixed(2)};${i.total_value.toFixed(2)};${statusLabel}`;
              });
              downloadCSV(`ajustes_transferencias_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
            }}
            onExcel={() => {
              const headers = ['Tipo', 'Codigo', 'Descricao', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Esperado', 'Contado', 'Custo Unit', 'Valor', 'Status'];
              downloadExcel(`ajustes_transferencias_${new Date().toISOString().slice(0, 10)}`, 'Ajustes', headers,
                items.map((i) => [
                  ADJ_TYPE_LABELS[i.adjustment_type]?.label ?? i.adjustment_type,
                  i.product_code, i.product_description, i.lot_number || '', i.source_warehouse || '', i.target_warehouse || '',
                  i.quantity, i.expected_qty, i.counted_qty, i.unit_cost.toFixed(2), i.total_value.toFixed(2),
                  INTEG_STATUS_LABELS[i.integration_status]?.label ?? i.integration_status,
                ]),
              );
            }}
            onPrint={() => {
              const headers = ['Tipo', 'Codigo', 'Descricao', 'Qtd', 'Esperado', 'Contado', 'Valor', 'Status'];
              printTable('Ajustes e Transferencias', headers,
                items.map((i) => [
                  ADJ_TYPE_LABELS[i.adjustment_type]?.label ?? i.adjustment_type,
                  i.product_code, i.product_description, i.quantity, i.expected_qty, i.counted_qty,
                  formatCurrency(i.total_value), INTEG_STATUS_LABELS[i.integration_status]?.label ?? i.integration_status,
                ]),
              );
            }}
          />
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Send className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Nenhum ajuste ou transferencia encontrado.</p>
          <p className="text-xs mt-1">Gere uma integracao na pagina de Envio ao Protheus para visualizar os ajustes.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="py-3 px-4 font-medium text-slate-600">Tipo</th>
                <th className="py-3 px-4 font-medium text-slate-600">Codigo</th>
                <th className="py-3 px-4 font-medium text-slate-600">Descricao</th>
                <th className="py-3 px-4 font-medium text-slate-600">Lote</th>
                <th className="py-3 px-4 font-medium text-slate-600">Armazem</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Esperado</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Contado</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Quantidade</th>
                <th className="py-3 px-4 font-medium text-slate-600 text-right">Valor</th>
                <th className="py-3 px-4 font-medium text-slate-600">Integracao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const adjConfig = ADJ_TYPE_LABELS[item.adjustment_type] ?? ADJ_TYPE_LABELS.NO_CHANGE;
                const AdjIcon = adjConfig.Icon;
                const integStatus = INTEG_STATUS_LABELS[item.integration_status] ?? { label: item.integration_status, className: 'bg-slate-100 text-slate-600' };

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${adjConfig.color}`}>
                        <AdjIcon className="w-3.5 h-3.5" />
                        {adjConfig.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">{item.product_code}</td>
                    <td className="py-2.5 px-4 max-w-[180px] truncate">{item.product_description}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{item.lot_number || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      {item.item_type === 'TRANSFER' ? (
                        <span className="flex items-center gap-1">
                          <span className="font-mono">{item.source_warehouse}</span>
                          <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{item.target_warehouse}</span>
                        </span>
                      ) : (
                        <span className="font-mono">{item.target_warehouse || item.source_warehouse || '—'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{item.expected_qty.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{item.counted_qty.toFixed(2)}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums font-medium ${
                      item.quantity > 0 && item.adjustment_type === 'INCREASE' ? 'text-blue-600'
                      : item.quantity > 0 && item.adjustment_type === 'DECREASE' ? 'text-red-600'
                      : item.quantity > 0 && item.adjustment_type === 'TRANSFER' ? 'text-purple-600'
                      : 'text-slate-400'
                    }`}>
                      {item.quantity > 0 ? item.quantity.toFixed(2) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-600">
                      {item.total_value !== 0 ? formatCurrency(item.total_value) : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${integStatus.className}`}>
                        {integStatus.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// =============================================
// Shared components
// =============================================

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
