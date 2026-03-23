import { useEffect, useState, useCallback, useMemo } from 'react';
import { Header } from '../layouts/Header';
import { discrepancyService } from '../services/discrepancy.service';
import { inventoryService } from '../services/inventory.service';
import { integrationService } from '../services/integration.service';
import { countingListService } from '../services/counting-list.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { TabAnalise } from './inventarios/components/TabAnalise';
import type { Discrepancy, ClosedRound, InventoryList, IntegrationPreviewResult, IntegrationAdjustment, IntegrationTransfer, CountingList, SavedAdjustmentItem } from '../types';
import React from 'react';
import { CheckCircle, RotateCcw, Edit3, Filter, ArrowRightLeft, TrendingDown, Search, AlertCircle, BarChart3, ArrowRight, ClipboardList, Send, Package, Layers, ChevronRight, ChevronDown } from 'lucide-react';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';

type Tab = 'divergencias' | 'inventario' | 'simulacao' | 'integracoes';

export default function DivergenciasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('divergencias');
  const [rounds, setRounds] = useState<ClosedRound[]>([]);
  const [selectedRound, setSelectedRound] = useState('');
  const [roundsLoaded, setRoundsLoaded] = useState(false);
  const toast = useToast();
  const { inventarioRole } = useAuth();
  const isStaff = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';

  useEffect(() => {
    discrepancyService.listarRodadas().then((data) => {
      setRounds(data);
      if (data.length > 0) {
        setSelectedRound(data[0].round_key);
      }
      setRoundsLoaded(true);
    }).catch(() => {
      setRoundsLoaded(true);
    });
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'divergencias', label: 'Divergencias', icon: TrendingDown },
    { key: 'inventario', label: 'Inventario Completo', icon: ClipboardList },
    { key: 'simulacao', label: 'Comparacao entre Inventarios', icon: BarChart3 },
    { key: 'integracoes', label: 'Integracoes Protheus', icon: Send },
  ];

  return (
    <>
      <Header title="Analise" />
      <div className="p-4 md:p-6 space-y-6">
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
          !roundsLoaded ? (
            <TableSkeleton rows={6} cols={8} />
          ) : rounds.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="text-sm">Nenhum inventario com contagens encontrado.</p>
            </div>
          ) : (
            <>
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 min-w-[280px]"
                >
                  {rounds.map((r) => (
                    <option key={r.round_key} value={r.round_key}>{r.display_text}</option>
                  ))}
                </select>
              </div>
              <TabDivergencias selectedRound={selectedRound} isStaff={isStaff} toast={toast} />
            </>
          )
        )}
        {activeTab === 'inventario' && <TabInventarioCompleto />}
        {activeTab === 'simulacao' && <TabSimulacao />}
        {activeTab === 'integracoes' && <TabIntegracoes />}
      </div>
    </>
  );
}

// =============================================
// Tab Divergencias
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={total} color="text-slate-800" />
        <StatCard label="Pendentes" value={pending} color="text-yellow-600" />
        <StatCard label="Resolvidas" value={resolved} color="text-green-600" />
        <StatCard label="Diverg. Media" value={`${avgVariance}%`} color="text-red-600" />
      </div>

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
// Tab Simulacao de Comparacao
// =============================================

interface SimLotRow {
  lot_number: string;
  system_a: number; counted_a: number; diff_a: number;
  system_b: number; counted_b: number; diff_b: number;
  adjusted_a: number; adjusted_b: number;
  final_diff_a: number; final_diff_b: number;
}

interface SimulationRow {
  product_code: string;
  product_description: string;
  lot_number: string | null;
  lots: SimLotRow[];
  system_a: number;
  counted_a: number;
  diff_a: number;
  transfer_a: number;
  adjusted_a: number;
  final_diff_a: number;
  system_b: number;
  counted_b: number;
  diff_b: number;
  transfer_b: number;
  adjusted_b: number;
  final_diff_b: number;
  transfer_qty: number;
  transfer_direction: string;
  unit_cost: number;
  transfer_value: number;
}

function buildSimulationRows(preview: IntegrationPreviewResult): SimulationRow[] {
  const adjA = preview.adjustments_a ?? [];
  const adjB = preview.adjustments_b ?? [];
  const transfers = preview.transfers ?? [];

  // Index adjustments by product_code+lot_number
  const keyFn = (code: string, lot: string | null) => `${code}|${lot ?? ''}`;
  const adjAMap = new Map<string, IntegrationAdjustment>();
  const adjBMap = new Map<string, IntegrationAdjustment>();
  const transferMap = new Map<string, IntegrationTransfer>();

  // Lot detail maps por product_code
  const lotAMap = new Map<string, IntegrationAdjustment[]>();
  const lotBMap = new Map<string, IntegrationAdjustment[]>();

  for (const a of adjA) {
    if (a.row_type === 'AGGREGATE' || !a.row_type) {
      adjAMap.set(keyFn(a.product_code, a.lot_number), a);
    } else if (a.row_type === 'LOT_DETAIL' && a.lot_number) {
      if (!lotAMap.has(a.product_code)) lotAMap.set(a.product_code, []);
      lotAMap.get(a.product_code)!.push(a);
    }
  }
  for (const b of adjB) {
    if (b.row_type === 'AGGREGATE' || !b.row_type) {
      adjBMap.set(keyFn(b.product_code, b.lot_number), b);
    } else if (b.row_type === 'LOT_DETAIL' && b.lot_number) {
      if (!lotBMap.has(b.product_code)) lotBMap.set(b.product_code, []);
      lotBMap.get(b.product_code)!.push(b);
    }
  }
  for (const t of transfers) {
    if (t.row_type === 'AGGREGATE' || !t.row_type) {
      transferMap.set(keyFn(t.product_code, t.lot_number), t);
    }
  }

  // All unique product keys
  const allKeys = new Set<string>();
  adjAMap.forEach((_, k) => allKeys.add(k));
  adjBMap.forEach((_, k) => allKeys.add(k));
  transferMap.forEach((_, k) => allKeys.add(k));

  const rows: SimulationRow[] = [];

  for (const key of allKeys) {
    const a = adjAMap.get(key);
    const b = adjBMap.get(key);
    const t = transferMap.get(key);
    const [code, lot] = key.split('|');

    const systemA = a?.expected_qty ?? 0;
    const countedA = a?.counted_qty ?? 0;
    const diffA = countedA - systemA;
    const transferQtyA = a?.transfer_qty ?? 0;
    const adjustedA = a?.adjusted_qty ?? systemA;
    const finalDiffA = a?.adjustment_qty ?? (countedA - adjustedA);

    const systemB = b?.expected_qty ?? 0;
    const countedB = b?.counted_qty ?? 0;
    const diffB = countedB - systemB;
    const transferQtyB = b?.transfer_qty ?? 0;
    const adjustedB = b?.adjusted_qty ?? systemB;
    const finalDiffB = b?.adjustment_qty ?? (countedB - adjustedB);

    const transferQty = t?.quantity ?? 0;
    let transferDir = '';
    if (t && transferQty > 0) {
      transferDir = `${t.source_warehouse} → ${t.target_warehouse}`;
    }

    // Montar lotes combinados A+B
    const lotsA = lotAMap.get(code) ?? [];
    const lotsB = lotBMap.get(code) ?? [];
    const allLotNums = new Set([...lotsA.map(l => l.lot_number!), ...lotsB.map(l => l.lot_number!)]);
    // Buscar transferências por lote (LOT_DETAIL)
    const lotTransfers = (transfers).filter(lt => lt.product_code === code && lt.row_type === 'LOT_DETAIL' && lt.lot_number);
    const lotRows: SimLotRow[] = [];
    for (const ln of allLotNums) {
      const la = lotsA.find(l => l.lot_number === ln);
      const lb = lotsB.find(l => l.lot_number === ln);
      const sysA = la?.expected_qty ?? 0;
      const cntA = la?.counted_qty ?? 0;
      const sysB = lb?.expected_qty ?? 0;
      const cntB = lb?.counted_qty ?? 0;
      const diffA = cntA - sysA;
      const diffB = cntB - sysB;
      // Transferência deste lote
      const lt = lotTransfers.find(x => x.lot_number === ln);
      const ltQty = lt?.quantity ?? 0;
      // Ajustado: se sai de A → A diminui, B aumenta
      let adjA = sysA, adjB = sysB;
      if (ltQty > 0 && lt) {
        if (lt.source_warehouse === (preview?.inventory_a?.warehouse)) {
          adjA = sysA - ltQty;
          adjB = sysB + ltQty;
        } else {
          adjB = sysB - ltQty;
          adjA = sysA + ltQty;
        }
      }
      lotRows.push({
        lot_number: ln,
        system_a: sysA, counted_a: cntA, diff_a: diffA,
        system_b: sysB, counted_b: cntB, diff_b: diffB,
        adjusted_a: adjA, adjusted_b: adjB,
        final_diff_a: cntA - adjA, final_diff_b: cntB - adjB,
      });
    }
    lotRows.sort((x, y) => x.lot_number.localeCompare(y.lot_number));

    rows.push({
      product_code: code,
      product_description: a?.product_description ?? b?.product_description ?? t?.product_description ?? '',
      lot_number: lot || null,
      lots: lotRows,
      system_a: systemA,
      counted_a: countedA,
      diff_a: diffA,
      transfer_a: transferQtyA,
      adjusted_a: adjustedA,
      final_diff_a: finalDiffA,
      system_b: systemB,
      counted_b: countedB,
      diff_b: diffB,
      transfer_b: transferQtyB,
      adjusted_b: adjustedB,
      final_diff_b: finalDiffB,
      transfer_qty: transferQty,
      transfer_direction: transferDir,
      unit_cost: a?.unit_cost ?? b?.unit_cost ?? t?.unit_cost ?? 0,
      transfer_value: transferQty * (t?.unit_cost ?? 0),
    });
  }

  rows.sort((x, y) => x.product_code.localeCompare(y.product_code));
  return rows;
}

function TabSimulacao() {
  const toast = useToast();
  const [inventories, setInventories] = useState<InventoryList[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [invAId, setInvAId] = useState('');
  const [invBId, setInvBId] = useState('');
  const [preview, setPreview] = useState<IntegrationPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSim, setExpandedSim] = useState<Set<string>>(new Set());

  // Load completed/closed inventories, excluindo já integrados
  useEffect(() => {
    (async () => {
      try {
        const [completed, closed, histRes] = await Promise.all([
          inventoryService.listar({ status: 'COMPLETED', size: '100' }),
          inventoryService.listar({ status: 'CLOSED', size: '100' }),
          integrationService.historico(undefined, 200),
        ]);
        // IDs de inventários já integrados (não cancelados)
        const integratedIds = new Set<string>();
        for (const h of histRes.history) {
          if (h.status !== 'CANCELLED') {
            if (h.inventory_a_id) integratedIds.add(h.inventory_a_id);
            if (h.inventory_b_id) integratedIds.add(h.inventory_b_id);
          }
        }
        const all = [...completed.items, ...closed.items].filter((inv) => !integratedIds.has(inv.id));
        all.sort((a, b) => a.name.localeCompare(b.name));
        setInventories(all);
      } catch {
        toast.error('Erro ao carregar inventarios.');
      } finally {
        setLoadingInv(false);
      }
    })();
  }, [toast]);

  const handleSimulate = useCallback(async () => {
    if (!invAId || !invBId) {
      toast.error('Selecione os dois inventarios para comparar.');
      return;
    }
    if (invAId === invBId) {
      toast.error('Selecione inventarios diferentes.');
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const result = await integrationService.preview(invAId, invBId, true);
      setPreview(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao simular comparacao.';
      // Extract backend detail from axios error
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || msg);
    } finally {
      setLoading(false);
    }
  }, [invAId, invBId, toast]);

  const rows = useMemo(() => {
    if (!preview) return [];
    return buildSimulationRows(preview);
  }, [preview]);

  const whA = preview?.inventory_a?.warehouse ?? 'A';
  const whB = preview?.inventory_b?.warehouse ?? 'B';

  const fmt = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(2);
  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalTransferValue = rows.reduce((s, r) => s + r.transfer_value, 0);
  const totalTransfers = rows.filter(r => r.transfer_qty > 0).length;
  const totalAdjA = rows.filter(r => Math.abs(r.final_diff_a) > 0.01).length;
  const totalAdjB = rows.filter(r => Math.abs(r.final_diff_b) > 0.01).length;

  return (
    <>
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Simulacao para analise</p>
          <p>
            Compare dois inventarios para visualizar transferencias e ajustes <strong>sem gravar</strong> nenhuma informacao.
            Para gerar a integracao oficial, utilize a opcao <strong>Envio ao Protheus</strong>.
          </p>
        </div>
      </div>

      {/* Inventory selectors */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Inventario A</label>
            <select
              value={invAId}
              onChange={(e) => { setInvAId(e.target.value); setPreview(null); }}
              disabled={loadingInv}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            >
              <option value="">Selecione...</option>
              {inventories.filter(i => i.id !== invBId).map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} (ARM.{inv.warehouse})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pb-1">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Inventario B</label>
            <select
              value={invBId}
              onChange={(e) => { setInvBId(e.target.value); setPreview(null); }}
              disabled={loadingInv}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            >
              <option value="">Selecione...</option>
              {inventories.filter(i => i.id !== invAId).map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} (ARM.{inv.warehouse})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading || !invAId || !invBId}
            className="flex items-center gap-2 bg-capul-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Simular
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <p className="font-medium">Erro na simulacao</p>
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && <TableSkeleton rows={8} cols={10} />}

      {/* Results */}
      {preview && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Produtos" value={rows.length} color="text-slate-800" />
            <StatCard label="Transferencias" value={totalTransfers} color="text-purple-600" />
            <StatCard label={`Ajustes ${whA}`} value={totalAdjA} color="text-blue-600" />
            <StatCard label={`Ajustes ${whB}`} value={totalAdjB} color="text-orange-600" />
            <StatCard label="Valor Transf." value={fmtCurrency(totalTransferValue)} color="text-green-600" />
          </div>

          {/* Inventory info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <span className="text-xs font-medium text-blue-500">ARM. {whA}</span>
              <p className="text-sm font-medium text-blue-800 mt-0.5">{preview.inventory_a.name}</p>
            </div>
            {preview.inventory_b && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                <span className="text-xs font-medium text-orange-500">ARM. {whB}</span>
                <p className="text-sm font-medium text-orange-800 mt-0.5">{preview.inventory_b.name}</p>
              </div>
            )}
          </div>

          {/* Export */}
          {rows.length > 0 && (
            <div className="flex justify-end">
              <ExportDropdown
                onCSV={() => {
                  const header = `Codigo;Descricao;Lote;Sist ${whA};Cont ${whA};Dif ${whA};Transf ${whA};Ajust ${whA};Dif Final ${whA};Sist ${whB};Cont ${whB};Dif ${whB};Transf ${whB};Ajust ${whB};Dif Final ${whB};Transf Qtd;Direcao;Custo Unit;Valor Transf\n`;
                  const csvRows = rows.map(r =>
                    `${r.product_code};${r.product_description};${r.lot_number || ''};${fmt(r.system_a)};${fmt(r.counted_a)};${fmt(r.diff_a)};${fmt(r.transfer_a)};${fmt(r.adjusted_a)};${fmt(r.final_diff_a)};${fmt(r.system_b)};${fmt(r.counted_b)};${fmt(r.diff_b)};${fmt(r.transfer_b)};${fmt(r.adjusted_b)};${fmt(r.final_diff_b)};${fmt(r.transfer_qty)};${r.transfer_direction};${r.unit_cost.toFixed(2)};${r.transfer_value.toFixed(2)}`
                  );
                  downloadCSV(`simulacao_${new Date().toISOString().slice(0, 10)}.csv`, header, csvRows);
                }}
                onExcel={() => {
                  const headers = ['Codigo', 'Descricao', 'Lote', `Sist ${whA}`, `Cont ${whA}`, `Dif ${whA}`, `Transf ${whA}`, `Ajust ${whA}`, `Dif Final ${whA}`, `Sist ${whB}`, `Cont ${whB}`, `Dif ${whB}`, `Transf ${whB}`, `Ajust ${whB}`, `Dif Final ${whB}`, 'Transf Qtd', 'Direcao', 'Custo Unit', 'Valor Transf'];
                  downloadExcel(`simulacao_${new Date().toISOString().slice(0, 10)}`, 'Simulacao', headers,
                    rows.map(r => [r.product_code, r.product_description, r.lot_number || '', r.system_a, r.counted_a, r.diff_a, r.transfer_a, r.adjusted_a, r.final_diff_a, r.system_b, r.counted_b, r.diff_b, r.transfer_b, r.adjusted_b, r.final_diff_b, r.transfer_qty, r.transfer_direction, r.unit_cost, r.transfer_value]),
                  );
                }}
                onPrint={() => {
                  const headers = ['Codigo', 'Descricao', `Sist ${whA}`, `Cont ${whA}`, `Dif ${whA}`, 'Transf', `Sist ${whB}`, `Cont ${whB}`, `Dif ${whB}`, `Ajust ${whA}`, `Ajust ${whB}`, 'Valor'];
                  printTable(`Simulacao - ${preview.inventory_a.name} x ${preview.inventory_b?.name ?? ''}`, headers,
                    rows.map(r => [r.product_code, r.product_description, r.system_a, r.counted_a, r.diff_a, r.transfer_qty, r.system_b, r.counted_b, r.diff_b, r.adjusted_a, r.adjusted_b, fmtCurrency(r.transfer_value)]),
                  );
                }}
              />
            </div>
          )}

          {/* Comparison table */}
          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="text-sm">Nenhuma divergencia encontrada entre os inventarios.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th colSpan={2} className="py-2 px-3 font-medium text-slate-700 text-left border-b border-slate-200">Produto</th>
                    <th colSpan={5} className="py-2 px-3 font-medium text-blue-700 text-center border-b border-slate-200 bg-blue-50/50">ARM. {whA}</th>
                    <th colSpan={1} className="py-2 px-3 font-medium text-purple-700 text-center border-b border-slate-200 bg-purple-50/50">Transf.</th>
                    <th colSpan={5} className="py-2 px-3 font-medium text-orange-700 text-center border-b border-slate-200 bg-orange-50/50">ARM. {whB}</th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-500 font-medium">
                    <th className="py-2 px-3 text-left">Codigo</th>
                    <th className="py-2 px-3 text-left">Descricao</th>
                    {/* ARM A */}
                    <th className="py-2 px-3 text-right bg-blue-50/30">Sistema</th>
                    <th className="py-2 px-3 text-right bg-blue-50/30">Contado</th>
                    <th className="py-2 px-3 text-right bg-blue-50/30">Diferenca</th>
                    <th className="py-2 px-3 text-right bg-blue-50/30">Ajustado</th>
                    <th className="py-2 px-3 text-right bg-blue-50/20 border-l border-blue-100">Dif Final</th>
                    {/* Transfer */}
                    <th className="py-2 px-3 text-center bg-purple-50/30">Qtd</th>
                    {/* ARM B */}
                    <th className="py-2 px-3 text-right bg-orange-50/30">Sistema</th>
                    <th className="py-2 px-3 text-right bg-orange-50/30">Contado</th>
                    <th className="py-2 px-3 text-right bg-orange-50/30">Diferenca</th>
                    <th className="py-2 px-3 text-right bg-orange-50/30">Ajustado</th>
                    <th className="py-2 px-3 text-right bg-orange-50/20 border-l border-orange-100">Dif Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, idx) => {
                    const hasTransfer = r.transfer_qty > 0;
                    const hasLots = r.lots.length > 0;
                    const isExp = expandedSim.has(r.product_code);
                    const improvedA = hasTransfer && Math.abs(r.final_diff_a) < Math.abs(r.diff_a);
                    const improvedB = hasTransfer && Math.abs(r.final_diff_b) < Math.abs(r.diff_b);
                    const resolvedA = Math.abs(r.final_diff_a) < 0.01;
                    const resolvedB = Math.abs(r.final_diff_b) < 0.01;
                    return (
                      <React.Fragment key={idx}>
                      <tr
                        className={`hover:bg-slate-50 ${hasTransfer ? 'bg-purple-50/20' : ''} ${hasLots ? 'cursor-pointer' : ''}`}
                        onClick={hasLots ? () => setExpandedSim(prev => { const n = new Set(prev); n.has(r.product_code) ? n.delete(r.product_code) : n.add(r.product_code); return n; }) : undefined}
                      >
                        <td className="py-2 px-3 font-mono whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            {hasLots && (isExp ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />)}
                            {r.product_code}
                          </span>
                        </td>
                        <td className="py-2 px-3 max-w-[160px] truncate" title={r.product_description}>
                          {r.product_description}
                          {r.lot_number && <span className="text-slate-400 ml-1">[{r.lot_number}]</span>}
                        </td>
                        {/* ARM A */}
                        <td className="py-2 px-3 text-right tabular-nums bg-blue-50/10">{fmt(r.system_a)}</td>
                        <td className="py-2 px-3 text-right tabular-nums bg-blue-50/10">{fmt(r.counted_a)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-medium bg-blue-50/10 ${r.diff_a > 0 ? 'text-blue-600' : r.diff_a < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {r.diff_a > 0 ? '+' : ''}{fmt(r.diff_a)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums bg-blue-50/10 ${hasTransfer ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{fmt(r.adjusted_a)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold border-l border-blue-100 ${resolvedA ? 'text-green-600 bg-green-50/30' : improvedA ? 'text-yellow-600 bg-yellow-50/20' : r.final_diff_a > 0 ? 'text-blue-600' : r.final_diff_a < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {resolvedA ? '0' : (r.final_diff_a > 0 ? '+' : '') + fmt(r.final_diff_a)}
                        </td>
                        {/* Transfer */}
                        <td className="py-2 px-3 text-center tabular-nums bg-purple-50/10">
                          {hasTransfer ? (
                            <span className="inline-flex items-center gap-0.5 text-purple-700 font-bold">
                              {fmt(r.transfer_qty)}
                              <span className="text-[10px] text-purple-400 ml-0.5">{r.transfer_direction}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {/* ARM B */}
                        <td className="py-2 px-3 text-right tabular-nums bg-orange-50/10">{fmt(r.system_b)}</td>
                        <td className="py-2 px-3 text-right tabular-nums bg-orange-50/10">{fmt(r.counted_b)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-medium bg-orange-50/10 ${r.diff_b > 0 ? 'text-blue-600' : r.diff_b < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {r.diff_b > 0 ? '+' : ''}{fmt(r.diff_b)}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums bg-orange-50/10 ${hasTransfer ? 'font-medium text-slate-700' : 'text-slate-400'}`}>{fmt(r.adjusted_b)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold border-l border-orange-100 ${resolvedB ? 'text-green-600 bg-green-50/30' : improvedB ? 'text-yellow-600 bg-yellow-50/20' : r.final_diff_b > 0 ? 'text-blue-600' : r.final_diff_b < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {resolvedB ? '0' : (r.final_diff_b > 0 ? '+' : '') + fmt(r.final_diff_b)}
                        </td>
                      </tr>
                      {hasLots && isExp && r.lots.map((lot) => {
                        const lotResolvedA = Math.abs(lot.final_diff_a) < 0.01;
                        const lotResolvedB = Math.abs(lot.final_diff_b) < 0.01;
                        return (
                        <tr key={lot.lot_number} className="bg-slate-50/60 text-[11px]">
                          <td className="py-1 px-3 pl-8 font-mono text-slate-500">{lot.lot_number}</td>
                          <td className="py-1 px-3 text-slate-400 italic">Lote</td>
                          {/* ARM A */}
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.system_a)}</td>
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.counted_a)}</td>
                          <td className={`py-1 px-3 text-right tabular-nums ${lot.diff_a > 0 ? 'text-blue-500' : lot.diff_a < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {lot.diff_a > 0 ? '+' : ''}{fmt(lot.diff_a)}
                          </td>
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.adjusted_a)}</td>
                          <td className={`py-1 px-3 text-right tabular-nums font-medium border-l border-blue-100 ${lotResolvedA ? 'text-green-600' : lot.final_diff_a > 0 ? 'text-blue-500' : lot.final_diff_a < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {lotResolvedA ? '0' : (lot.final_diff_a > 0 ? '+' : '') + fmt(lot.final_diff_a)}
                          </td>
                          {/* Transf */}
                          <td className="py-1 px-3"></td>
                          {/* ARM B */}
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.system_b)}</td>
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.counted_b)}</td>
                          <td className={`py-1 px-3 text-right tabular-nums ${lot.diff_b > 0 ? 'text-blue-500' : lot.diff_b < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {lot.diff_b > 0 ? '+' : ''}{fmt(lot.diff_b)}
                          </td>
                          <td className="py-1 px-3 text-right tabular-nums text-slate-500">{fmt(lot.adjusted_b)}</td>
                          <td className={`py-1 px-3 text-right tabular-nums font-medium border-l border-orange-100 ${lotResolvedB ? 'text-green-600' : lot.final_diff_b > 0 ? 'text-blue-500' : lot.final_diff_b < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {lotResolvedB ? '0' : (lot.final_diff_b > 0 ? '+' : '') + fmt(lot.final_diff_b)}
                          </td>
                        </tr>
                        );
                      })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Transfer detail */}
          {totalTransfers > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                Detalhe das Transferencias
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-medium">
                      <th className="py-2 px-3 text-left">Codigo</th>
                      <th className="py-2 px-3 text-left">Descricao</th>
                      <th className="py-2 px-3 text-center">Direcao</th>
                      <th className="py-2 px-3 text-right">Quantidade</th>
                      <th className="py-2 px-3 text-right">Custo Unit.</th>
                      <th className="py-2 px-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.filter(r => r.transfer_qty > 0).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono">{r.product_code}</td>
                        <td className="py-2 px-3 max-w-[200px] truncate">{r.product_description}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                            {r.transfer_direction}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-purple-700">{fmt(r.transfer_qty)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">{fmtCurrency(r.unit_cost)}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium text-green-700">{fmtCurrency(r.transfer_value)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-medium text-sm">
                      <td colSpan={3} className="py-2 px-3 text-right">Total</td>
                      <td className="py-2 px-3 text-right tabular-nums text-purple-700">{totalTransfers} itens</td>
                      <td className="py-2 px-3" />
                      <td className="py-2 px-3 text-right tabular-nums text-green-700">{fmtCurrency(totalTransferValue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state when no simulation yet */}
      {!preview && !loading && !error && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Selecione dois inventarios e clique em Simular</p>
          <p className="text-xs mt-1">O sistema calculara as transferencias e ajustes entre os armazens</p>
        </div>
      )}
    </>
  );
}

// =============================================
// Tab Inventario Completo
// =============================================

function TabInventarioCompleto() {
  const toast = useToast();
  const [inventories, setInventories] = useState<InventoryList[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [selectedInvId, setSelectedInvId] = useState('');
  const [listas, setListas] = useState<CountingList[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [completed, closed] = await Promise.all([
          inventoryService.listar({ status: 'COMPLETED', size: '100' }),
          inventoryService.listar({ status: 'CLOSED', size: '100' }),
        ]);
        const all = [...completed.items, ...closed.items];
        all.sort((a, b) => b.name.localeCompare(a.name));
        setInventories(all);
      } catch {
        toast.error('Erro ao carregar inventarios.');
      } finally {
        setLoadingInv(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (!selectedInvId) {
      setListas([]);
      return;
    }
    setLoadingListas(true);
    countingListService.listar(selectedInvId)
      .then((data) => setListas(data))
      .catch(() => { setListas([]); toast.error('Erro ao carregar listas.'); })
      .finally(() => setLoadingListas(false));
  }, [selectedInvId, toast]);

  const selectedInv = inventories.find(i => i.id === selectedInvId);

  return (
    <>
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={selectedInvId}
          onChange={(e) => setSelectedInvId(e.target.value)}
          disabled={loadingInv}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 min-w-[320px]"
        >
          <option value="">Selecione o inventario...</option>
          {inventories.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.name} (ARM.{inv.warehouse}) — {inv.status === 'CLOSED' ? 'Encerrado' : 'Concluido'}
            </option>
          ))}
        </select>
        {selectedInv && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedInv.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
            {selectedInv.status === 'CLOSED' ? 'Encerrado' : 'Concluido'}
          </span>
        )}
      </div>

      {!selectedInvId && !loadingInv && (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Selecione um inventario para ver a analise completa</p>
          <p className="text-xs mt-1">Todos os itens com contagens por ciclo e resultado final</p>
        </div>
      )}

      {loadingListas && <TableSkeleton rows={6} cols={8} />}

      {selectedInvId && !loadingListas && listas.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Nenhuma lista de contagem encontrada para este inventario.</p>
        </div>
      )}

      {selectedInvId && !loadingListas && listas.length > 0 && (
        <TabAnalise inventoryId={selectedInvId} listas={listas} />
      )}
    </>
  );
}

// =============================================
// Tab Integracoes Protheus
// =============================================

function TabIntegracoes() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);
  const [inventories, setInventories] = useState<InventoryList[]>([]);
  const [selectedInvId, setSelectedInvId] = useState('');
  const [items, setItems] = useState<SavedAdjustmentItem[]>([]);
  const [summary, setSummary] = useState({ adjustments: 0, transfers: 0, total_value: 0 });
  const [filterType, setFilterType] = useState<'ALL' | 'TRANSFER' | 'ADJUSTMENT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Carregar apenas inventários que possuem integração com Protheus
  useEffect(() => {
    (async () => {
      try {
        const [completed, closed, histRes] = await Promise.all([
          inventoryService.listar({ status: 'COMPLETED', size: '100' }),
          inventoryService.listar({ status: 'CLOSED', size: '100' }),
          integrationService.historico(undefined, 200),
        ]);
        // IDs de inventários já integrados (não cancelados)
        const integratedIds = new Set<string>();
        for (const h of histRes.history) {
          if (h.status !== 'CANCELLED') {
            if (h.inventory_a_id) integratedIds.add(h.inventory_a_id);
            if (h.inventory_b_id) integratedIds.add(h.inventory_b_id);
          }
        }
        const all = [...completed.items, ...closed.items].filter((inv) => integratedIds.has(inv.id));
        all.sort((a, b) => b.name.localeCompare(a.name));
        setInventories(all);
        if (all.length > 0) setSelectedInvId(all[0].id);
      } catch { /* ignore */ }
      finally { setLoadingInv(false); }
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    discrepancyService.listarAjustes(selectedInvId || undefined)
      .then((data) => {
        setItems(data.items);
        setSummary(data.summary);
      })
      .catch(() => toast.error('Erro ao carregar integracoes.'))
      .finally(() => setLoading(false));
  }, [toast, selectedInvId]);

  const filtered = useMemo(() => {
    let result = items;
    if (filterType !== 'ALL') {
      result = result.filter(i => i.item_type === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i =>
        i.product_code.toLowerCase().includes(term) ||
        i.product_description.toLowerCase().includes(term) ||
        (i.lot_number && i.lot_number.toLowerCase().includes(term)) ||
        (i.inventory_name && i.inventory_name.toLowerCase().includes(term))
      );
    }
    return result;
  }, [items, filterType, searchTerm]);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Group items: products with lots get grouped, others stay flat
  interface GroupedRow {
    key: string;
    product_code: string;
    product_description: string;
    item_type: 'ADJUSTMENT' | 'TRANSFER';
    warehouse_display: string;
    source_warehouse: string | null;
    target_warehouse: string | null;
    inventory_name: string;
    integration_status: string;
    adjustment_type: string;
    // Aggregated totals
    expected_qty: number;
    counted_qty: number;
    quantity: number;
    total_value: number;
    // Lot children
    lots: SavedAdjustmentItem[];
    has_lot: boolean;
  }

  const grouped = useMemo((): GroupedRow[] => {
    const map = new Map<string, GroupedRow>();
    for (const item of filtered) {
      const isTransfer = item.item_type === 'TRANSFER';
      const wh = isTransfer
        ? `${item.source_warehouse}→${item.target_warehouse}`
        : (item.target_warehouse || item.source_warehouse || '');
      const groupKey = `${item.item_type}|${item.product_code}|${wh}`;

      let group = map.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          product_code: item.product_code,
          product_description: item.product_description,
          item_type: item.item_type as 'ADJUSTMENT' | 'TRANSFER',
          warehouse_display: wh,
          source_warehouse: item.source_warehouse,
          target_warehouse: item.target_warehouse,
          inventory_name: item.inventory_name,
          integration_status: item.integration_status,
          adjustment_type: item.adjustment_type,
          expected_qty: 0,
          counted_qty: 0,
          quantity: 0,
          total_value: 0,
          lots: [],
          has_lot: false,
        };
        map.set(groupKey, group);
      }
      group.expected_qty += item.expected_qty;
      group.counted_qty += item.counted_qty;
      group.quantity += item.quantity;
      group.total_value += Math.abs(item.total_value);
      if (item.lot_number) {
        group.has_lot = true;
        group.lots.push(item);
      }
    }

    const rows = Array.from(map.values());
    rows.sort((a, b) => a.product_code.localeCompare(b.product_code));
    return rows;
  }, [filtered]);

  const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmt = (v: number) => v % 1 === 0 ? v.toString() : v.toFixed(2);

  const invSelector = (
    <div className="flex items-center gap-3">
      <Filter className="w-4 h-4 text-slate-400" />
      <select
        value={selectedInvId}
        onChange={(e) => setSelectedInvId(e.target.value)}
        disabled={loadingInv}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500 min-w-[320px]"
      >
        {inventories.map((inv) => (
          <option key={inv.id} value={inv.id}>
            {inv.name} (ARM.{inv.warehouse})
          </option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return <>{invSelector}<TableSkeleton rows={8} cols={10} /></>;
  }

  if (items.length === 0) {
    return (
      <>
        {invSelector}
        <div className="text-center py-16 text-slate-400">
          <Send className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">Nenhuma integracao registrada para este inventario</p>
          <p className="text-xs mt-1">As integracoes aparecerao aqui apos salvar pelo botao &quot;Integracao Protheus&quot; no detalhe do inventario</p>
        </div>
      </>
    );
  }

  return (
    <>
      {invSelector}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de Itens" value={items.length} color="text-slate-800" />
        <StatCard label="Transferencias" value={summary.transfers} color="text-purple-600" />
        <StatCard label="Ajustes (SB7)" value={summary.adjustments} color="text-blue-600" />
        <StatCard label="Valor Total" value={fmtCurrency(summary.total_value)} color="text-green-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          {([['ALL', 'Todos'], ['TRANSFER', 'Transferencias'], ['ADJUSTMENT', 'Ajustes']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterType === key ? 'bg-capul-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar codigo, descricao, lote..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          />
        </div>
        <ExportDropdown
          onCSV={() => {
            const header = 'Tipo;Codigo;Descricao;Lote;Inventario;Arm Origem;Arm Destino;Qtd Sistema;Qtd Contada;Qtd Ajuste;Custo Unit;Valor;Tipo Ajuste;Status\n';
            const csvRows = filtered.map(i =>
              `${i.item_type};${i.product_code};${i.product_description};${i.lot_number || ''};${i.inventory_name};${i.source_warehouse || ''};${i.target_warehouse || ''};${fmt(i.expected_qty)};${fmt(i.counted_qty)};${fmt(i.quantity)};${i.unit_cost.toFixed(2)};${i.total_value.toFixed(2)};${i.adjustment_type};${i.integration_status}`
            );
            downloadCSV(`integracoes_protheus_${new Date().toISOString().slice(0, 10)}.csv`, header, csvRows);
          }}
          onExcel={() => {
            const headers = ['Tipo', 'Codigo', 'Descricao', 'Lote', 'Inventario', 'Arm Origem', 'Arm Destino', 'Qtd Sistema', 'Qtd Contada', 'Qtd Ajuste', 'Custo Unit', 'Valor', 'Tipo Ajuste', 'Status'];
            downloadExcel(`integracoes_protheus_${new Date().toISOString().slice(0, 10)}`, 'Integracoes', headers,
              filtered.map(i => [i.item_type, i.product_code, i.product_description, i.lot_number || '', i.inventory_name, i.source_warehouse || '', i.target_warehouse || '', i.expected_qty, i.counted_qty, i.quantity, i.unit_cost, i.total_value, i.adjustment_type, i.integration_status]),
            );
          }}
          onPrint={() => {
            const headers = ['Tipo', 'Codigo', 'Descricao', 'Lote', 'Arm Orig', 'Arm Dest', 'Sistema', 'Contado', 'Ajuste', 'Valor', 'Status'];
            printTable('Integracoes Protheus', headers,
              filtered.map(i => [i.item_type === 'TRANSFER' ? 'Transf.' : 'Ajuste', i.product_code, i.product_description, i.lot_number || '-', i.source_warehouse || '-', i.target_warehouse || '-', i.expected_qty, i.counted_qty, i.quantity, fmtCurrency(i.total_value), i.integration_status]),
            );
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="py-2.5 px-3 font-medium text-slate-600">Codigo</th>
              <th className="py-2.5 px-3 font-medium text-slate-600">Descricao</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-center">Tipo</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-center">Armazem</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Sistema</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Contado</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Quantidade</th>
              <th className="py-2.5 px-3 font-medium text-slate-600 text-right">Valor</th>
              <th className="py-2.5 px-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const isTransfer = g.item_type === 'TRANSFER';
              const isExpanded = expandedRows.has(g.key);
              const canExpand = g.has_lot && g.lots.length > 0;
              return (
                <React.Fragment key={g.key}>
                  <tr
                    className={`border-b border-slate-100 ${isTransfer ? 'bg-purple-50/20' : ''} ${canExpand ? 'cursor-pointer hover:bg-slate-50/80' : 'hover:bg-slate-50'}`}
                    onClick={canExpand ? () => toggleExpand(g.key) : undefined}
                  >
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {canExpand && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        )}
                        {g.product_code}
                        {canExpand && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                            <Layers className="w-3 h-3" />{g.lots.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-800" title={g.product_description}>{g.product_description}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isTransfer ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isTransfer ? <><ArrowRightLeft className="w-3 h-3" /> Transf.</> : <><Edit3 className="w-3 h-3" /> Ajuste</>}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isTransfer ? (
                        <span className="inline-flex items-center gap-1 text-purple-600 font-medium">
                          {g.source_warehouse} <ArrowRight className="w-3 h-3" /> {g.target_warehouse}
                        </span>
                      ) : (
                        <span className="font-medium">{g.target_warehouse || g.source_warehouse}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(g.expected_qty)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(g.counted_qty)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                      isTransfer ? 'text-purple-700' : g.quantity > 0 ? 'text-green-600' : g.quantity < 0 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {isTransfer ? fmt(g.quantity) : `${g.quantity > 0 ? '+' : ''}${fmt(g.quantity)}`}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium text-slate-700">{fmtCurrency(g.total_value)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        g.integration_status === 'SENT' || g.integration_status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        g.integration_status === 'DRAFT' || g.integration_status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        g.integration_status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                        g.integration_status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        g.integration_status === 'ERROR' ? 'bg-red-100 text-red-700' :
                        g.integration_status === 'PARTIAL' ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {{ DRAFT: 'Pendente', PENDING: 'Pendente', SENT: 'Enviado', PROCESSING: 'Processando', CONFIRMED: 'Confirmado', PARTIAL: 'Parcial', ERROR: 'Erro', CANCELLED: 'Cancelado' }[g.integration_status] ?? g.integration_status}
                      </span>
                    </td>
                  </tr>
                  {canExpand && isExpanded && g.lots.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 bg-blue-50/30">
                      <td className="py-1.5 px-3 pl-10">
                        <span className="font-mono text-[11px] text-slate-500">{lot.lot_number}</span>
                      </td>
                      <td className="py-1.5 px-3 text-[11px] text-slate-400 italic">Lote</td>
                      <td className="py-1.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                          isTransfer ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {isTransfer ? 'Transf.' : 'Ajuste'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center text-[11px]">
                        {isTransfer ? (
                          <span className="text-purple-500">{lot.source_warehouse} → {lot.target_warehouse}</span>
                        ) : (
                          <span className="text-slate-500">{lot.target_warehouse || lot.source_warehouse}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right text-[11px] tabular-nums text-slate-500">{fmt(lot.expected_qty)}</td>
                      <td className="py-1.5 px-3 text-right text-[11px] tabular-nums text-slate-500">{fmt(lot.counted_qty)}</td>
                      <td className={`py-1.5 px-3 text-right text-[11px] tabular-nums font-medium ${
                        isTransfer ? 'text-purple-600' : lot.quantity > 0 ? 'text-green-600' : lot.quantity < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {isTransfer ? fmt(lot.quantity) : `${lot.quantity > 0 ? '+' : ''}${fmt(lot.quantity)}`}
                      </td>
                      <td className="py-1.5 px-3 text-right text-[11px] tabular-nums text-slate-500">{fmtCurrency(Math.abs(lot.total_value))}</td>
                      <td className="py-1.5 px-3" />
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals row */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-6 text-sm">
        <span className="text-slate-500"><strong className="text-slate-800">{grouped.length}</strong> produtos</span>
        <span className="text-purple-600">Transferencias: <strong>{grouped.filter(g => g.item_type === 'TRANSFER').length}</strong></span>
        <span className="text-blue-600">Ajustes: <strong>{grouped.filter(g => g.item_type === 'ADJUSTMENT').length}</strong></span>
        <span className="text-slate-500">Com lote: <strong>{grouped.filter(g => g.has_lot).length}</strong></span>
      </div>
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
