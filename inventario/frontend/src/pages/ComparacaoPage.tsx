import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { comparisonService } from '../services/comparison.service';
import { inventoryService } from '../services/inventory.service';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { ErrorState } from '../components/ErrorState';
import { useToast } from '../contexts/ToastContext';
import type { ComparisonResult, ComparisonItem, InventoryList } from '../types';
import { ArrowLeftRight, FileSpreadsheet, FileJson, Warehouse, Info } from 'lucide-react';
import { downloadCSV } from '../utils/csv';
import { ExportDropdown } from '../components/ExportDropdown';
import { downloadExcel, printTable } from '../utils/export';

type Mode = 'matches' | 'transfers' | 'manual';

const modeLabels: Record<Mode, string> = {
  matches: 'Transferencias Contabeis',
  transfers: 'Relatorio de Transferencias',
  manual: 'Analise Manual',
};

const etapaConfig: Record<string, { label: string; color: string }> = {
  ENCERRADO: { label: 'Encerrado', color: 'bg-blue-100 text-blue-700' },
  ANALISADO: { label: 'Analisado', color: 'bg-purple-100 text-purple-700' },
  INTEGRADO: { label: 'Integrado', color: 'bg-emerald-100 text-emerald-700' },
};

function fallbackEtapa(status: string): string {
  if (status === 'CLOSED') return 'INTEGRADO';
  if (status === 'COMPLETED') return 'ENCERRADO';
  return status;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function AnaliseHistoricaBanner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-slate-700 space-y-1">
        <p className="font-medium text-blue-900">Análise Histórica — comparação entre inventários do mesmo armazém</p>
        <p className="text-xs text-slate-600">
          Compara dois inventários do <strong>mesmo armazém</strong> para acompanhar a evolução do processo de
          estoque ao longo do tempo. É <strong>somente análise gerencial</strong> — não gera movimentação no Protheus.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          <strong>Não confunda com Integração Comparativa</strong> (menu <em>Integrações &gt; Nova Integração</em>),
          que compara armazéns <strong>diferentes</strong> (CD ↔ Venda) e gera transferências SD3 + ajustes SB7 no ERP.
        </p>
      </div>
    </div>
  );
}

function cellColor(divergence: number, difFinal: number): string {
  if (Math.abs(difFinal) < 0.01) return 'text-green-600 font-medium';
  if (Math.abs(difFinal) < Math.abs(divergence)) return 'text-yellow-600';
  return 'text-red-600';
}

interface ComparacaoPageProps {
  embedded?: boolean;
}

export default function ComparacaoPage({ embedded = false }: ComparacaoPageProps = {}) {
  const [params, setParams] = useSearchParams();
  const invAId = params.get('inv_a') ?? '';
  const invBId = params.get('inv_b') ?? '';
  const mode = (params.get('mode') as Mode) || 'manual';

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const toast = useToast();

  // For inventory selector when only inv_a is provided
  const [availableInventarios, setAvailableInventarios] = useState<InventoryList[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);

  // Load all comparable inventories
  useEffect(() => {
    if (!invAId || !invBId) {
      setSelectorLoading(true);
      Promise.all([
        inventoryService.listar({ status: 'COMPLETED', size: '50' }).catch(() => ({ items: [] })),
        inventoryService.listar({ status: 'CLOSED', size: '50' }).catch(() => ({ items: [] })),
      ])
        .then(([res1, res2]) => {
          const all = [...(res1.items ?? []), ...(res2.items ?? [])];
          // Análise Histórica: filtra inventários do MESMO armazém de inv_a
          // (transferências entre armazéns diferentes vão pelo wizard /integracoes/nova)
          let filtered = all;
          if (invAId) {
            const invA = all.find((i) => i.id === invAId);
            filtered = all.filter((inv) =>
              inv.id !== invAId && (!invA || inv.warehouse === invA.warehouse)
            );
          }
          setAvailableInventarios(filtered);
        })
        .finally(() => setSelectorLoading(false));
    }
  }, [invAId, invBId]);

  const loadData = useCallback(async () => {
    if (!invAId || !invBId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const data = await comparisonService.comparar(invAId, invBId);
      setResult(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [invAId, invBId]);

  useEffect(() => { if (invAId && invBId) loadData(); }, [loadData]);

  const items = useMemo(() => {
    if (!result) return [];
    if (mode === 'matches') return result.matches ?? [];
    if (mode === 'transfers') return [...(result.matches ?? []), ...(result.manual_review ?? [])];
    return [...(result.matches ?? []), ...(result.manual_review ?? [])];
  }, [result, mode]);

  const sortedItems = useMemo(() =>
    [...items].sort((a, b) => (a.description ?? '').localeCompare(b.description ?? '', 'pt-BR')),
  [items]);

  // Summary for manual mode
  const summary = useMemo(() => {
    if (!result) return null;
    const all = [...(result.matches ?? []), ...(result.manual_review ?? [])];
    let zeroedA = 0, zeroedB = 0, reducedA = 0, reducedB = 0, totalEconomy = 0;
    for (const item of all) {
      if (Math.abs(item.diferenca_final_a) < 0.01) zeroedA++;
      else if (Math.abs(item.diferenca_final_a) < Math.abs(item.divergence_a)) reducedA++;
      if (Math.abs(item.diferenca_final_b) < 0.01) zeroedB++;
      else if (Math.abs(item.diferenca_final_b) < Math.abs(item.divergence_b)) reducedB++;
      totalEconomy += item.transferencia_logica?.economia_estimada ?? 0;
    }
    return { zeroedA, zeroedB, reducedA, reducedB, totalEconomy, total: all.length };
  }, [result]);

  const handleExportCsv = () => {
    const rows = sortedItems.map((item) => [
      item.product_code,
      item.description,
      item.tracking,
      item.lot_number ?? '-',
      item.expected_a,
      item.counted_a,
      item.divergence_a,
      item.transferencia_logica?.quantidade_transferida ?? 0,
      item.saldo_ajustado_a,
      item.diferenca_final_a,
      item.transferencia_logica?.economia_estimada ?? 0,
    ]);
    const header = 'Codigo;Descricao;Rastreio;Lote;Saldo;Contado;Diverg.;Transf.;Estoque Ajust.;Dif. Final;Economia\n';
    downloadCSV(`comparacao_${invAId}_${invBId}.csv`, header, rows.map((r) => r.map(String).join(';')));
    toast.success('CSV exportado.');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `comparacao_${invAId}_${invBId}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exportado.');
  };

  const setMode = (m: Mode) => {
    const next = new URLSearchParams(params);
    next.set('mode', m);
    setParams(next);
  };

  if (!invAId) {
    return (
      <>
        {!embedded && <Header title="Análise Histórica de Inventários" />}
        <div className="p-4 md:p-6 space-y-4">
          <AnaliseHistoricaBanner />
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Selecione o inventário base</h3>
            {selectorLoading ? (
              <p className="text-sm text-slate-400">Carregando inventarios...</p>
            ) : availableInventarios.length === 0 ? (
              <p className="text-sm text-amber-600">
                Nenhum inventario disponivel. Conclua a contagem de pelo menos um inventario antes de comparar.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableInventarios.map((inv) => {
                  const etapa = inv.etapa_atual || fallbackEtapa(inv.status);
                  const ec = etapaConfig[etapa] || { label: etapa, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams();
                        next.set('inv_a', inv.id);
                        setParams(next);
                      }}
                      className="text-left border border-slate-200 hover:border-capul-500 hover:bg-capul-50 rounded-lg p-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ec.color}`}>
                          {ec.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Armazem <strong>{inv.warehouse}</strong> · {inv.total_items} itens
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!invBId) {
    return (
      <>
        {!embedded && <Header title="Análise Histórica de Inventários" />}
        <div className="p-4 md:p-6 space-y-4">
          <AnaliseHistoricaBanner />
          {/* Botao trocar A */}
          <div className="flex justify-end">
            <button
              onClick={() => setParams(new URLSearchParams())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Trocar Inventario Base
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Selecione o inventário para comparar</h3>
            <p className="text-sm text-slate-500">
              Inventário base já escolhido. Listamos abaixo os outros inventários do <strong>mesmo armazém</strong>
              {' '}para você comparar a evolução do processo.
            </p>
            {selectorLoading ? (
              <p className="text-sm text-slate-400">Carregando inventarios...</p>
            ) : availableInventarios.length === 0 ? (
              <p className="text-sm text-amber-600">Nenhum outro inventario disponivel para comparacao.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableInventarios.map((inv) => {
                  const etapa = inv.etapa_atual || fallbackEtapa(inv.status);
                  const ec = etapaConfig[etapa] || { label: etapa, color: 'bg-slate-100 text-slate-700' };
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('inv_b', inv.id);
                        setParams(next);
                      }}
                      className="text-left border border-slate-200 hover:border-capul-500 hover:bg-capul-50 rounded-lg p-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ec.color}`}>
                          {ec.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Armazem <strong>{inv.warehouse}</strong> · {inv.total_items} itens
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {!embedded && <Header title="Análise Histórica de Inventários" />}
      <div className="p-4 md:p-6 space-y-6">
        <AnaliseHistoricaBanner />
        {/* Acao: trocar inventarios — sempre disponivel no topo */}
        <div className="flex justify-end">
          <button
            onClick={() => setParams(new URLSearchParams())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Trocar Inventarios
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar comparacao." onRetry={loadData} />
        ) : result ? (
          <>
            {/* Info cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse className="w-4 h-4 text-blue-500" />
                  <p className="text-xs text-blue-600">Inventario A</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{result.inventory_a?.name ?? invAId}</p>
                <p className="text-xs text-slate-500">{result.inventory_a?.warehouse ?? ''}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Warehouse className="w-4 h-4 text-purple-500" />
                  <p className="text-xs text-purple-600">Inventario B</p>
                </div>
                <p className="text-sm font-semibold text-slate-800">{result.inventory_b?.name ?? invBId}</p>
                <p className="text-xs text-slate-500">{result.inventory_b?.warehouse ?? ''}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Tipo</p>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                  <ArrowLeftRight className="w-4 h-4" /> {modeLabels[mode]}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-1">Total Produtos</p>
                <p className="text-xl font-bold text-slate-800">{sortedItems.length}</p>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit overflow-x-auto scrollbar-hide">
              {(['matches', 'transfers', 'manual'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${mode === m ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>

            {/* Summary cards for manual mode */}
            {mode === 'manual' && summary && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <MiniCard label="Zerados A" value={summary.zeroedA} color="text-green-600" />
                <MiniCard label="Zerados B" value={summary.zeroedB} color="text-green-600" />
                <MiniCard label="Reduzidos A" value={summary.reducedA} color="text-yellow-600" />
                <MiniCard label="Reduzidos B" value={summary.reducedB} color="text-yellow-600" />
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-600">Economia Estimada</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(summary.totalEconomy)}</p>
                </div>
              </div>
            )}

            {/* Export */}
            <div className="flex gap-2">
              <ExportDropdown
                onCSV={handleExportCsv}
                onExcel={() => {
                  downloadExcel(`comparacao_${invAId}_${invBId}`, 'Comparacao',
                    ['Codigo', 'Descricao', 'Rastreio', 'Lote', 'Saldo', 'Contado', 'Diverg.', 'Transf.', 'Estoque Ajust.', 'Dif. Final', 'Economia'],
                    sortedItems.map((item) => [item.product_code, item.description, item.tracking, item.lot_number ?? '-', item.expected_a, item.counted_a, item.divergence_a, item.transferencia_logica?.quantidade_transferida ?? 0, item.saldo_ajustado_a, item.diferenca_final_a, item.transferencia_logica?.economia_estimada ?? 0]),
                  );
                }}
                onPrint={() => {
                  printTable('Comparacao de Inventarios',
                    ['Codigo', 'Descricao', 'Rastreio', 'Lote', 'Saldo', 'Contado', 'Diverg.', 'Transf.', 'Estoque Ajust.', 'Dif. Final', 'Economia'],
                    sortedItems.map((item) => [item.product_code, item.description, item.tracking, item.lot_number ?? '-', item.expected_a, item.counted_a, item.divergence_a, item.transferencia_logica?.quantidade_transferida ?? 0, item.saldo_ajustado_a, item.diferenca_final_a, formatCurrency(item.transferencia_logica?.economia_estimada ?? 0)]),
                  );
                }}
              />
              <button onClick={handleExportJson} className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
                <FileJson className="w-4 h-4" /> JSON
              </button>
            </div>

            {/* Table */}
            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">Nenhum produto na comparacao.</p>
              </div>
            ) : mode === 'transfers' ? (
              <TransfersTable items={sortedItems} />
            ) : mode === 'matches' ? (
              <MatchesTable items={sortedItems} invA={result.inventory_a} invB={result.inventory_b} />
            ) : (
              <ManualTable items={sortedItems} invA={result.inventory_a} invB={result.inventory_b} />
            )}

          </>
        ) : null}
      </div>
    </>
  );
}

function MiniCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TransfersTable({ items }: { items: ComparisonItem[] }) {
  const withTransfer = items.filter((i) => i.transferencia_logica?.quantidade_transferida);
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="py-3 px-3 font-medium text-slate-600">Codigo</th>
            <th className="py-3 px-3 font-medium text-slate-600">Descricao</th>
            <th className="py-3 px-3 font-medium text-slate-600">Origem</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Saldo Antes</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Saldo Depois</th>
            <th className="py-3 px-3 font-medium text-slate-600">Destino</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Saldo Antes</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Saldo Depois</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Qtd Transf.</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right">Economia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {withTransfer.map((item, i) => {
            const t = item.transferencia_logica;
            return (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-2 px-3 font-mono text-xs">{item.product_code}</td>
                <td className="py-2 px-3 max-w-[180px] truncate">{item.description}</td>
                <td className="py-2 px-3 text-xs font-medium">{t.origem}</td>
                <td className="py-2 px-3 text-right">{t.saldo_origem_antes}</td>
                <td className="py-2 px-3 text-right">{t.saldo_origem_depois}</td>
                <td className="py-2 px-3 text-xs font-medium">{t.destino}</td>
                <td className="py-2 px-3 text-right">{t.saldo_destino_antes}</td>
                <td className="py-2 px-3 text-right">{t.saldo_destino_depois}</td>
                <td className="py-2 px-3 text-right font-medium text-blue-600">{t.quantidade_transferida}</td>
                <td className="py-2 px-3 text-right text-green-600">{t.economia_estimada > 0 ? formatCurrency(t.economia_estimada) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchesTable({ items, invA, invB }: { items: ComparisonItem[]; invA: { name: string; warehouse: string }; invB: { name: string; warehouse: string } }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="py-3 px-3 font-medium text-slate-600 text-left" rowSpan={2}>Codigo</th>
            <th className="py-3 px-3 font-medium text-slate-600 text-left" rowSpan={2}>Descricao</th>
            <th className="py-2 px-3 font-medium text-blue-600 text-center border-b border-slate-200" colSpan={3}>
              {invA?.warehouse ?? 'Inv. A'}
            </th>
            <th className="py-2 px-3 font-medium text-purple-600 text-center border-b border-slate-200" colSpan={3}>
              {invB?.warehouse ?? 'Inv. B'}
            </th>
            <th className="py-3 px-3 font-medium text-slate-600 text-right" rowSpan={2}>Ajuste</th>
          </tr>
          <tr className="bg-slate-50 text-xs">
            <th className="py-2 px-3 text-right text-slate-500">Saldo</th>
            <th className="py-2 px-3 text-right text-slate-500">Contado</th>
            <th className="py-2 px-3 text-right text-slate-500">Ajust.</th>
            <th className="py-2 px-3 text-right text-slate-500">Saldo</th>
            <th className="py-2 px-3 text-right text-slate-500">Contado</th>
            <th className="py-2 px-3 text-right text-slate-500">Ajust.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="py-2 px-3 font-mono text-xs">{item.product_code}</td>
              <td className="py-2 px-3 max-w-[160px] truncate">{item.description}</td>
              <td className="py-2 px-3 text-right">{item.expected_a}</td>
              <td className="py-2 px-3 text-right">{item.counted_a}</td>
              <td className="py-2 px-3 text-right text-green-600 font-medium">{item.saldo_ajustado_a}</td>
              <td className="py-2 px-3 text-right">{item.expected_b}</td>
              <td className="py-2 px-3 text-right">{item.counted_b}</td>
              <td className="py-2 px-3 text-right text-green-600 font-medium">{item.saldo_ajustado_b}</td>
              <td className="py-2 px-3 text-right font-medium text-blue-600">
                {item.transferencia_logica?.quantidade_transferida ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualTable({ items, invA, invB }: { items: ComparisonItem[]; invA: { name: string; warehouse: string }; invB: { name: string; warehouse: string } }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="py-3 px-2 font-medium text-slate-600 text-left" rowSpan={2}>Codigo</th>
            <th className="py-3 px-2 font-medium text-slate-600 text-left" rowSpan={2}>Descricao</th>
            <th className="py-2 px-2 font-medium text-blue-600 text-center border-b border-slate-200" colSpan={5}>
              {invA?.warehouse ?? 'Inv. A'}
            </th>
            <th className="py-2 px-2 font-medium text-purple-600 text-center border-b border-slate-200" colSpan={5}>
              {invB?.warehouse ?? 'Inv. B'}
            </th>
            <th className="py-3 px-2 font-medium text-slate-600 text-right" rowSpan={2}>Economia</th>
          </tr>
          <tr className="bg-slate-50 text-xs">
            <th className="py-2 px-2 text-right text-slate-500">Saldo</th>
            <th className="py-2 px-2 text-right text-slate-500">Contado</th>
            <th className="py-2 px-2 text-right text-slate-500">Diverg.</th>
            <th className="py-2 px-2 text-right text-slate-500">Transf.</th>
            <th className="py-2 px-2 text-right text-slate-500">Dif.Final</th>
            <th className="py-2 px-2 text-right text-slate-500">Saldo</th>
            <th className="py-2 px-2 text-right text-slate-500">Contado</th>
            <th className="py-2 px-2 text-right text-slate-500">Diverg.</th>
            <th className="py-2 px-2 text-right text-slate-500">Transf.</th>
            <th className="py-2 px-2 text-right text-slate-500">Dif.Final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, i) => {
            const t = item.transferencia_logica;
            const transferA = t?.origem === invA?.warehouse ? -(t?.quantidade_transferida ?? 0) : (t?.quantidade_transferida ?? 0);
            const transferB = t?.origem === invB?.warehouse ? -(t?.quantidade_transferida ?? 0) : (t?.quantidade_transferida ?? 0);
            const economia = t?.economia_estimada ?? 0;
            return (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-2 px-2 font-mono text-xs">{item.product_code}</td>
                <td className="py-2 px-2 max-w-[140px] truncate text-xs">{item.description}</td>
                <td className="py-2 px-2 text-right text-xs">{item.expected_a}</td>
                <td className="py-2 px-2 text-right text-xs">{item.counted_a}</td>
                <td className={`py-2 px-2 text-right text-xs ${item.divergence_a !== 0 ? 'text-red-600' : ''}`}>{item.divergence_a}</td>
                <td className="py-2 px-2 text-right text-xs text-blue-600">{transferA !== 0 ? (transferA > 0 ? `+${transferA}` : transferA) : '-'}</td>
                <td className={`py-2 px-2 text-right text-xs ${cellColor(item.divergence_a, item.diferenca_final_a)}`}>{item.diferenca_final_a}</td>
                <td className="py-2 px-2 text-right text-xs">{item.expected_b}</td>
                <td className="py-2 px-2 text-right text-xs">{item.counted_b}</td>
                <td className={`py-2 px-2 text-right text-xs ${item.divergence_b !== 0 ? 'text-red-600' : ''}`}>{item.divergence_b}</td>
                <td className="py-2 px-2 text-right text-xs text-blue-600">{transferB !== 0 ? (transferB > 0 ? `+${transferB}` : transferB) : '-'}</td>
                <td className={`py-2 px-2 text-right text-xs ${cellColor(item.divergence_b, item.diferenca_final_b)}`}>{item.diferenca_final_b}</td>
                <td className="py-2 px-2 text-right text-xs text-green-600">{economia > 0 ? formatCurrency(economia) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
