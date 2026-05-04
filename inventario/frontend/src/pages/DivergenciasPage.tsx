import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { discrepancyService } from '../services/discrepancy.service';
import { inventoryService } from '../services/inventory.service';
import { countingListService } from '../services/counting-list.service';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { PromptDialog } from '../components/PromptDialog';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { TabAnalise } from './inventarios/components/TabAnalise';
import type { Discrepancy, ClosedRound, InventoryList, CountingList } from '../types';
import React from 'react';
import { CheckCircle, RotateCcw, Edit3, Filter, ArrowRightLeft, TrendingDown, ClipboardList, Package, FileText as FileTextIcon } from 'lucide-react';
import ComparacaoPage from './ComparacaoPage';
import { RelatoriosPage } from './RelatoriosPage';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadCSV } from '../utils/csv';
import { downloadExcel, printTable } from '../utils/export';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from '../components/SortableTh';

type Tab = 'divergencias' | 'inventario' | 'historica' | 'relatorios';

const VALID_TABS: Tab[] = ['divergencias', 'inventario', 'historica', 'relatorios'];

export default function DivergenciasPage() {
  const [params] = useSearchParams();
  const initialTab = (params.get('tab') as Tab | null);
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab && VALID_TABS.includes(initialTab) ? initialTab : 'divergencias'
  );
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
    { key: 'divergencias', label: 'Divergências', icon: TrendingDown },
    { key: 'inventario', label: 'Inventário Completo', icon: ClipboardList },
    { key: 'historica', label: 'Análise Histórica', icon: ArrowRightLeft },
    { key: 'relatorios', label: 'Relatórios', icon: FileTextIcon },
  ];

  if (!isStaff) {
    return (
      <>
        <Header title="Analise" />
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-800 font-semibold mb-1">Acesso restrito</p>
            <p className="text-sm text-amber-700">
              A Analise expoe saldo do sistema, divergencias e contagens de outros ciclos —
              quebra a contagem cega. Disponivel apenas para SUPERVISOR e ADMIN.
            </p>
          </div>
        </div>
      </>
    );
  }

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
        {activeTab === 'historica' && <ComparacaoPage embedded />}
        {activeTab === 'relatorios' && <RelatoriosPage embedded tabsAllowed={['final', 'lotes']} />}
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
  const [ajusteAberto, setAjusteAberto] = useState<string | null>(null);

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

  const handleResolve = async (id: string, type: 'ACCEPT' | 'RECOUNT' | 'ADJUST', finalQuantity?: number) => {
    // Para ADJUST, abre modal de input; a propria continuacao vira pelo onConfirm.
    if (type === 'ADJUST' && finalQuantity === undefined) {
      setAjusteAberto(id);
      return;
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
  const { sortedRows: discrepanciesSorted, sortKey, sortDir, handleSort } = useTableSort<Discrepancy>(discrepancies, 'product_name', 'asc');
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
                <SortableTh label="Codigo" sortKey="product_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Descricao" sortKey="product_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Inventario" sortKey="inventory_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Qtd Sistema" sortKey="expected_quantity" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Qtd Contada" sortKey="counted_quantity" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Diferenca" sortKey="variance_quantity" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="%" sortKey="variance_percentage" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                <SortableTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="font-medium py-3 px-4" />
                {isStaff && <th className="py-3 px-4 font-medium text-slate-600">Acoes</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discrepanciesSorted.map((d) => {
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

      <PromptDialog
        open={ajusteAberto !== null}
        title="Ajuste manual da divergencia"
        description="Informe a quantidade final que ficara registrada como resolucao do ajuste."
        label="Quantidade final"
        placeholder="Ex: 12.5"
        inputType="number"
        confirmLabel="Confirmar ajuste"
        validate={(v) => {
          const n = parseFloat(v);
          if (isNaN(n)) return 'Informe um numero valido.';
          if (n < 0) return 'Quantidade nao pode ser negativa.';
          return null;
        }}
        onConfirm={(v) => {
          const id = ajusteAberto;
          const n = parseFloat(v);
          setAjusteAberto(null);
          if (id) handleResolve(id, 'ADJUST', n);
        }}
        onCancel={() => setAjusteAberto(null)}
      />
    </>
  );
}

// =============================================


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
