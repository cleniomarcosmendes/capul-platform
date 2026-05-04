import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { integrationService } from '../services/integration.service';
import type { IntegrationDetailItem } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ErrorState } from '../components/ErrorState';
import { PageSkeleton } from '../components/LoadingSkeleton';
import { ArrowLeft, Ban, ArrowLeftRight, Package, FileText, Loader2, Send, Activity, RefreshCw, Search, ChevronLeft, ChevronRight, Download, AlertTriangle, RotateCcw } from 'lucide-react';
import { downloadExcel } from '../utils/export';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from '../components/SortableTh';

const PAGE_SIZE = 50;

type NoChangeItem = {
  product_code: string | null;
  product_description: string | null;
  warehouse: string | null;
  expected_qty: number | null;
  counted_qty: number | null;
};

type ProtheusErrorItem = {
  product_code: string | null;
  lot_number: string | null;
  warehouse: string | null;
  quantity: number | null;
  message: string | null;
};

function filterItems(items: IntegrationDetailItem[], q: string): IntegrationDetailItem[] {
  const term = q.trim().toLowerCase();
  if (!term) return items;
  return items.filter((it) => {
    const code = (it.product_code || '').toLowerCase();
    const desc = (it.product_description || '').toLowerCase();
    const lot = (it.lot_number || '').toLowerCase();
    return code.includes(term) || desc.includes(term) || lot.includes(term);
  });
}

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Aguardando Envio', color: 'bg-slate-100 text-slate-700' },
  PENDING:    { label: 'Pendente',     color: 'bg-amber-100 text-amber-700' },
  SENT:       { label: 'Enviado',      color: 'bg-blue-100 text-blue-700' },
  PROCESSING: { label: 'Processando',  color: 'bg-indigo-100 text-indigo-700' },
  CONFIRMED:  { label: 'Confirmado',   color: 'bg-emerald-100 text-emerald-700' },
  PARTIAL:    { label: 'Parcial',      color: 'bg-orange-100 text-orange-700' },
  ERROR:      { label: 'Erro',         color: 'bg-red-100 text-red-700' },
  CANCELLED:  { label: 'Cancelada',    color: 'bg-slate-100 text-slate-500' },
};

const CANCELLABLE = ['DRAFT', 'PENDING', 'ERROR', 'PARTIAL'];
const SENDABLE = ['DRAFT', 'ERROR', 'PARTIAL'];

const adjustmentTypeLabel: Record<string, string> = {
  INCREASE:  'Aumento',
  DECREASE:  'Redução',
  NO_CHANGE: 'Sem alteração',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TabName = 'transfers' | 'adjustments' | 'no_change' | 'logs';
const VALID_TABS: ReadonlyArray<TabName> = ['transfers', 'adjustments', 'no_change', 'logs'];

export default function IntegracaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabName) || 'adjustments';
  const toast = useToast();
  const [integration, setIntegration] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<IntegrationDetailItem[]>([]);
  const [noChangeItems, setNoChangeItems] = useState<NoChangeItem[]>([]);
  const [protheusErrors, setProtheusErrors] = useState<ProtheusErrorItem[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resettingErrors, setResettingErrors] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>(
    VALID_TABS.includes(initialTab) ? initialTab : 'adjustments'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [transfersSearch, setTransfersSearch] = useState('');
  const [transfersPage, setTransfersPage] = useState(1);
  const [adjustmentsSearch, setAdjustmentsSearch] = useState('');
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);

  useEffect(() => { setTransfersPage(1); }, [transfersSearch]);
  useEffect(() => { setAdjustmentsPage(1); }, [adjustmentsSearch]);

  // Auto-carrega logs ao ativar a aba (uma vez por sessão)
  useEffect(() => {
    if (activeTab === 'logs' && !logsLoaded && !logsLoading) {
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Hooks devem ser chamados antes de qualquer early return — derivam das listas filtradas por tipo
  const transfersFiltered = useMemo(
    () => filterItems(items.filter((i) => i.item_type === 'TRANSFER'), transfersSearch),
    [items, transfersSearch],
  );
  const adjustmentsFiltered = useMemo(
    () => filterItems(items.filter((i) => i.item_type === 'ADJUSTMENT'), adjustmentsSearch),
    [items, adjustmentsSearch],
  );

  // Sort hooks — devem ficar acima de qualquer early return (Rules of Hooks)
  const transfersSort = useTableSort(transfersFiltered, null, null, () => setTransfersPage(1));
  const adjustmentsSort = useTableSort(adjustmentsFiltered, 'product_description', 'asc', () => setAdjustmentsPage(1));
  const noChangeSort = useTableSort(noChangeItems, 'product_description', 'asc');

  const loadLogs = useCallback(async () => {
    if (!id) return;
    setLogsLoading(true);
    try {
      const res = (await integrationService.buscarLogs(id)) as unknown as { logs?: Record<string, unknown>[] };
      setLogs(res.logs ?? []);
      setLogsLoaded(true);
    } catch {
      setLogs([]);
      setLogsLoaded(true);
    } finally {
      setLogsLoading(false);
    }
  }, [id]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    integrationService.detalhe(id)
      .then((res) => {
        setIntegration(res.integration);
        setItems(res.items as unknown as IntegrationDetailItem[]);
        setNoChangeItems((res.no_change_items as unknown as NoChangeItem[]) || []);
        setProtheusErrors((res.protheus_errors as unknown as ProtheusErrorItem[]) || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  async function handleResetErrors() {
    if (!id) return;
    setResettingErrors(true);
    try {
      const res = await integrationService.resetarErros(id);
      toast.success(res.message || `${res.reset_count} item(ns) prontos para reenvio.`);
      setShowResetDialog(false);
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao resetar itens com erro.');
    } finally {
      setResettingErrors(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function handleEnviar() {
    if (!id) return;
    setSending(true);
    try {
      const res = await integrationService.enviarTudo(id) as { success?: boolean; status?: string; total_enviados?: number; total_erros?: number };
      setShowSendDialog(false);
      if (res?.success) {
        toast.success(`Envio concluído. ${res.total_enviados ?? 0} enviados${res.total_erros ? `, ${res.total_erros} com erro` : ''}.`);
      } else {
        toast.warning(`Envio finalizado com status ${res?.status ?? 'desconhecido'}. Veja os logs.`);
      }
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao enviar ao Protheus.');
    } finally {
      setSending(false);
    }
  }

  async function handleCancelar() {
    if (!id) return;
    if (!cancelReason || cancelReason.trim().length < 5) {
      toast.warning('Informe um motivo (pelo menos 5 caracteres).');
      return;
    }
    setCancelling(true);
    try {
      await integrationService.cancelar(id, cancelReason.trim());
      toast.success('Integração cancelada.');
      setShowCancelDialog(false);
      setCancelReason('');
      load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao cancelar integração.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Integração Protheus" />
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </>
    );
  }

  if (error || !integration) {
    return (
      <>
        <Header title="Integração Protheus" />
        <div className="p-4 md:p-6">
          <ErrorState message="Integração não encontrada ou erro ao carregar." onRetry={load} />
        </div>
      </>
    );
  }

  const status = String(integration.status || '');
  const stat = statusConfig[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
  const integrationType = String(integration.integration_type || '');
  const isCancellable = CANCELLABLE.includes(status);
  const isSendable = SENDABLE.includes(status);
  const summary = (integration.summary as Record<string, unknown> | null) || {};
  const protheusResp = (integration.protheus_response as Record<string, unknown> | null) || null;

  // Extrações tipadas para evitar 'unknown' direto no JSX
  const versionStr = String(integration.version ?? '—');
  const idStr = String(integration.id ?? '');
  const createdAtStr = (integration.created_at as string | null) ?? null;
  const sentAtStr = (integration.sent_at as string | null) ?? null;
  const confirmedAtStr = (integration.confirmed_at as string | null) ?? null;
  const cancelledAtStr = (integration.cancelled_at as string | null) ?? null;
  const docTransfers = (integration.protheus_doc_transfers as string | null) ?? null;
  const docInventory = (integration.protheus_doc_inventory as string | null) ?? null;
  const cancellationReason = (integration.cancellation_reason as string | null) ?? null;
  const errorMessage = (integration.error_message as string | null) ?? null;
  const totalTransfers = Number(summary.total_transfers ?? 0);
  const totalAdjustments = Number(summary.total_adjustments ?? 0);
  const totalNoChange = Number(summary.total_no_change ?? 0);
  const totalTransferValue = Number(summary.total_transfer_value ?? 0);
  const totalAdjustmentValue = Number(summary.total_adjustment_value ?? 0);
  const invAId = (integration.inventory_a_id as string | null) ?? null;
  const invAName = (integration.inventory_a_name as string | null) ?? null;
  const invBId = (integration.inventory_b_id as string | null) ?? null;
  const invBName = (integration.inventory_b_name as string | null) ?? null;

  const transfers = items.filter((i) => i.item_type === 'TRANSFER');
  const adjustments = items.filter((i) => i.item_type === 'ADJUSTMENT');

  // Derivados de paginação (puros)
  const transfersSorted = transfersSort.sortedRows;
  const transfersTotalPages = Math.max(1, Math.ceil(transfersSorted.length / PAGE_SIZE));
  const transfersPageSafe = Math.min(transfersPage, transfersTotalPages);
  const transfersPaged = transfersSorted.slice(
    (transfersPageSafe - 1) * PAGE_SIZE,
    transfersPageSafe * PAGE_SIZE,
  );
  const adjustmentsSorted = adjustmentsSort.sortedRows;
  const adjustmentsTotalPages = Math.max(1, Math.ceil(adjustmentsSorted.length / PAGE_SIZE));
  const adjustmentsPageSafe = Math.min(adjustmentsPage, adjustmentsTotalPages);
  const adjustmentsPaged = adjustmentsSorted.slice(
    (adjustmentsPageSafe - 1) * PAGE_SIZE,
    adjustmentsPageSafe * PAGE_SIZE,
  );
  const noChangeSorted = noChangeSort.sortedRows;

  // Export Excel da aba ativa — só os filtrados, com cabeçalhos amigáveis
  const handleExport = () => {
    const baseName = `integracao_v${versionStr}`;
    if (activeTab === 'transfers') {
      const headers = ['Código', 'Descrição', 'Lote', 'Origem', 'Destino', 'Quantidade', 'Valor (R$)'];
      const rows = transfersSorted.map((t) => [
        t.product_code || '', t.product_description || '', t.lot_number || '',
        t.source_warehouse || '', t.target_warehouse || '',
        Number(t.quantity ?? 0), Number(t.total_value ?? 0),
      ]);
      downloadExcel(`${baseName}_transferencias.xlsx`, 'Transferências', headers, rows);
      return;
    }
    if (activeTab === 'adjustments') {
      const headers = ['Código', 'Descrição', 'Lote', 'Armazém', 'Esperado', 'Após Transf.', 'Contado', 'Ajuste', 'Tipo'];
      const rows = adjustmentsSorted.map((a) => [
        a.product_code || '', a.product_description || '', a.lot_number || '',
        a.target_warehouse || a.source_warehouse || '',
        Number(a.expected_qty ?? 0),
        Number(a.adjusted_qty ?? 0) !== Number(a.expected_qty ?? 0) ? Number(a.adjusted_qty ?? 0) : '',
        Number(a.counted_qty ?? 0),
        Number(a.quantity ?? 0),
        a.adjustment_type ? (adjustmentTypeLabel[a.adjustment_type] || a.adjustment_type) : '',
      ]);
      downloadExcel(`${baseName}_com_divergencia.xlsx`, 'Com divergência', headers, rows);
      return;
    }
    if (activeTab === 'no_change') {
      const headers = ['Código', 'Descrição', 'Armazém', 'Esperado', 'Contado'];
      const rows = noChangeSorted.map((n) => [
        n.product_code || '', n.product_description || '', n.warehouse || '',
        Number(n.expected_qty ?? 0), Number(n.counted_qty ?? 0),
      ]);
      downloadExcel(`${baseName}_sem_divergencia.xlsx`, 'Sem divergência', headers, rows);
      return;
    }
    if (activeTab === 'logs') {
      const headers = ['Quando', 'Endpoint', 'Tipo', 'Produto', 'Status', 'Duração (ms)', 'Erro'];
      const rows = logs.map((l) => [
        l.created_at ? new Date(l.created_at as string).toLocaleString('pt-BR') : '',
        String(l.endpoint ?? ''), String(l.item_type ?? ''), String(l.product_code ?? ''),
        String(l.status ?? ''), Number(l.duration_ms ?? 0), String(l.error_message ?? ''),
      ]);
      downloadExcel(`${baseName}_logs.xlsx`, 'Logs', headers, rows);
      return;
    }
  };

  return (
    <>
      <Header title="Integração Protheus" />
      <div className="p-4 md:p-6 space-y-4">
        <button
          onClick={() => navigate('/inventario/integracoes')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Integrações
        </button>

        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-slate-800">Integração #{versionStr}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${stat.color}`}>
                  {stat.label}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 flex items-center gap-1">
                  {integrationType === 'COMPARATIVE' ? <ArrowLeftRight className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                  {integrationType === 'COMPARATIVE' ? 'Comparativa' : 'Simples'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">{idStr}</p>
            </div>
            <div className="flex gap-2">
              {isCancellable && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar
                </button>
              )}
              {isSendable && (
                <button
                  onClick={() => setShowSendDialog(true)}
                  disabled={sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {status === 'ERROR' || status === 'PARTIAL' ? 'Reenviar ao Protheus' : 'Enviar ao Protheus'}
                </button>
              )}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-xs">
            <div>
              <p className="text-slate-400">Criado em</p>
              <p className="text-slate-700 font-medium">{formatDate(createdAtStr)}</p>
            </div>
            <div>
              <p className="text-slate-400">Enviado em</p>
              <p className="text-slate-700 font-medium">{formatDate(sentAtStr)}</p>
            </div>
            <div>
              <p className="text-slate-400">Confirmado em</p>
              <p className="text-slate-700 font-medium">{formatDate(confirmedAtStr)}</p>
            </div>
            <div>
              <p className="text-slate-400">Cancelado em</p>
              <p className="text-slate-700 font-medium">{formatDate(cancelledAtStr)}</p>
            </div>
          </div>

          {/* Inventários envolvidos (clicáveis para abrir o detalhe) */}
          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
            {invAId && (
              <button
                onClick={() => navigate(`/inventario/inventarios/${invAId}`)}
                className="text-left border border-slate-200 hover:border-capul-500 hover:bg-capul-50 rounded-lg p-3 transition-colors"
              >
                <p className="text-xs text-slate-400">Inventário A (base)</p>
                <p className="font-medium text-slate-800 text-sm">{invAName || invAId}</p>
                <p className="text-xs text-capul-600 mt-1">Abrir inventário →</p>
              </button>
            )}
            {invBId && (
              <button
                onClick={() => navigate(`/inventario/inventarios/${invBId}`)}
                className="text-left border border-slate-200 hover:border-purple-500 hover:bg-purple-50 rounded-lg p-3 transition-colors"
              >
                <p className="text-xs text-slate-400">Inventário B (comparativo)</p>
                <p className="font-medium text-slate-800 text-sm">{invBName || invBId}</p>
                <p className="text-xs text-purple-600 mt-1">Abrir inventário →</p>
              </button>
            )}
          </div>

          {/* Documentos Protheus */}
          {(docTransfers || docInventory) && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
              {docTransfers && (
                <div>
                  <p className="text-slate-400">Documento de Transferência (SD3)</p>
                  <p className="font-mono text-slate-700">{docTransfers}</p>
                </div>
              )}
              {docInventory && (
                <div>
                  <p className="text-slate-400">Documento de Inventário (SB7)</p>
                  <p className="font-mono text-slate-700">{docInventory}</p>
                </div>
              )}
            </div>
          )}

          {/* Cancelamento */}
          {cancellationReason && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-400">Motivo do cancelamento</p>
              <p className="text-sm text-slate-700">{cancellationReason}</p>
            </div>
          )}

          {/* Erro */}
          {errorMessage && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-red-500">Mensagem de erro</p>
              <p className="text-sm text-red-700 font-mono whitespace-pre-wrap break-all">
                {errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Painel de erros do Protheus — só aparece em PARTIAL/ERROR com erros detalhados */}
        {protheusErrors.length > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-red-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">
                  Produtos recusados pelo Protheus ({protheusErrors.length})
                </h3>
              </div>
              {(status === 'PARTIAL' || status === 'ERROR') && (
                <button
                  onClick={() => setShowResetDialog(true)}
                  disabled={resettingErrors}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                >
                  {resettingErrors ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Marcar erros para reenvio
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-100/50 border-b border-red-200">
                  <tr>
                    <th className="text-left py-2 px-3 text-red-700 font-medium">Código</th>
                    <th className="text-left py-2 px-3 text-red-700 font-medium">Lote</th>
                    <th className="text-center py-2 px-3 text-red-700 font-medium">Armazém</th>
                    <th className="text-right py-2 px-3 text-red-700 font-medium">Qtd</th>
                    <th className="text-left py-2 px-3 text-red-700 font-medium">Mensagem do Protheus</th>
                  </tr>
                </thead>
                <tbody>
                  {protheusErrors.map((e, idx) => (
                    <tr key={`${e.product_code}-${idx}`} className="border-b border-red-100">
                      <td className="py-2 px-3 font-mono text-slate-800">{e.product_code || '—'}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{e.lot_number || '—'}</td>
                      <td className="py-2 px-3 text-center text-slate-600">{e.warehouse || '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{formatNumber(e.quantity)}</td>
                      <td className="py-2 px-3 text-red-700 font-medium">{e.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-red-200 text-xs text-red-700/80">
              💡 Resolva o problema no Protheus (ex.: desbloquear produto, corrigir cadastro) e depois clique em
              <strong> "Marcar erros para reenvio"</strong>. Em seguida, clique em <strong>"Reenviar ao Protheus"</strong> —
              o sistema vai mandar <strong>apenas os itens corrigidos</strong>, sem duplicar os já gravados.
            </div>
          </div>
        )}

        {/* Resumo (summary) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Transferências</p>
            <p className="text-2xl font-bold text-slate-800">{totalTransfers}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Ajustes de Estoque</p>
            <p className="text-2xl font-bold text-slate-800">{totalAdjustments}</p>
            {totalNoChange > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                +{totalNoChange} sem divergência
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Valor Transferências</p>
            <p className="text-lg font-semibold text-slate-700">R$ {formatNumber(totalTransferValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Valor Ajustes</p>
            <p className="text-lg font-semibold text-slate-700">R$ {formatNumber(totalAdjustmentValue)}</p>
          </div>
        </div>

        {/* Tabs nav */}
        <div className="bg-white rounded-xl border border-slate-200 px-2 flex items-center flex-wrap">
          {transfers.length > 0 && (
            <button
              onClick={() => setActiveTab('transfers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'transfers'
                  ? 'border-capul-500 text-capul-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Transferências ({totalTransfers})
            </button>
          )}
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'adjustments'
                ? 'border-capul-500 text-capul-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Com divergência ({totalAdjustments})
          </button>
          {noChangeItems.length > 0 && (
            <button
              onClick={() => setActiveTab('no_change')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'no_change'
                  ? 'border-capul-500 text-capul-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Sem divergência ({noChangeItems.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-capul-500 text-capul-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Logs{logsLoaded && ` (${logs.length})`}
            </span>
          </button>
          <button
            onClick={handleExport}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Excel
          </button>
        </div>

        {/* Itens (Transferências) */}
        {activeTab === 'transfers' && transfers.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium text-slate-700">Transferências ({totalTransfers})</p>
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={transfersSearch}
                  onChange={(e) => setTransfersSearch(e.target.value)}
                  placeholder="Buscar por código, descrição ou lote..."
                  className="pl-7 pr-2 py-1 text-xs border border-slate-300 rounded w-64 focus:outline-none focus:ring-1 focus:ring-capul-500"
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {transfersFiltered.length === transfers.length
                  ? `${transfers.length} itens`
                  : `${transfersFiltered.length} de ${transfers.length}`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <SortableTh label="Código" sortKey="product_code" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Descrição" sortKey="product_description" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Lote" sortKey="lot_number" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Origem" sortKey="source_warehouse" align="center" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Destino" sortKey="target_warehouse" align="center" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Quantidade" sortKey="quantity" align="right" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                    <SortableTh label="Valor (R$)" sortKey="total_value" align="right" currentKey={transfersSort.sortKey} currentDir={transfersSort.sortDir} onSort={transfersSort.handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {transfersPaged.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-mono text-slate-700">{it.product_code}</td>
                      <td className="py-2 px-2 text-slate-800 truncate max-w-xs" title={it.product_description}>
                        {it.product_description}
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-600">{it.lot_number || '—'}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{it.source_warehouse}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{it.target_warehouse || '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatNumber(it.quantity)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatNumber(it.total_value)}</td>
                    </tr>
                  ))}
                  {transfersFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                        Nenhum item encontrado para "{transfersSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {transfersTotalPages > 1 && (
              <div className="px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="tabular-nums">
                  Mostrando {(transfersPageSafe - 1) * PAGE_SIZE + 1}–
                  {Math.min(transfersPageSafe * PAGE_SIZE, transfersFiltered.length)} de {transfersFiltered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTransfersPage((p) => Math.max(1, p - 1))}
                    disabled={transfersPageSafe <= 1}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 tabular-nums">
                    {transfersPageSafe} / {transfersTotalPages}
                  </span>
                  <button
                    onClick={() => setTransfersPage((p) => Math.min(transfersTotalPages, p + 1))}
                    disabled={transfersPageSafe >= transfersTotalPages}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Itens (Ajustes) */}
        {activeTab === 'adjustments' && adjustments.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-3 flex-wrap">
              <p className="text-sm font-medium text-slate-700">Ajustes ({totalAdjustments})</p>
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={adjustmentsSearch}
                  onChange={(e) => setAdjustmentsSearch(e.target.value)}
                  placeholder="Buscar por código, descrição ou lote..."
                  className="pl-7 pr-2 py-1 text-xs border border-slate-300 rounded w-64 focus:outline-none focus:ring-1 focus:ring-capul-500"
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {adjustmentsFiltered.length === adjustments.length
                  ? `${adjustments.length} itens`
                  : `${adjustmentsFiltered.length} de ${adjustments.length}`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <SortableTh label="Código" sortKey="product_code" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Descrição" sortKey="product_description" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Lote" sortKey="lot_number" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Armazém" sortKey="target_warehouse" align="center" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Esperado" sortKey="expected_qty" align="right" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Após Transf." sortKey="adjusted_qty" align="right" title="Saldo após transferências lógicas (SD3)" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Contado" sortKey="counted_qty" align="right" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Ajuste" sortKey="quantity" align="right" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                    <SortableTh label="Tipo" sortKey="adjustment_type" currentKey={adjustmentsSort.sortKey} currentDir={adjustmentsSort.sortDir} onSort={adjustmentsSort.handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {adjustmentsPaged.map((it) => (
                    <tr key={it.id} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-mono text-slate-700">{it.product_code}</td>
                      <td className="py-2 px-2 text-slate-800 truncate max-w-xs" title={it.product_description}>
                        {it.product_description}
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-600">{it.lot_number || '—'}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{it.target_warehouse || it.source_warehouse || '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-600">{formatNumber(it.expected_qty)}</td>
                      <td className={`py-2 px-2 text-right tabular-nums ${
                        Number(it.adjusted_qty) !== Number(it.expected_qty) ? 'text-purple-700 font-medium' : 'text-slate-300'
                      }`}>
                        {Number(it.adjusted_qty) !== Number(it.expected_qty) ? formatNumber(it.adjusted_qty) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatNumber(it.counted_qty)}</td>
                      <td className={`py-2 px-2 text-right tabular-nums font-medium ${
                        it.quantity > 0 ? 'text-green-600' : it.quantity < 0 ? 'text-red-600' : 'text-slate-400'
                      }`}>
                        {it.quantity > 0 ? '+' : ''}{formatNumber(it.quantity)}
                      </td>
                      <td className="py-2 px-2 text-slate-600">
                        {it.adjustment_type ? (adjustmentTypeLabel[it.adjustment_type] || it.adjustment_type) : '—'}
                      </td>
                    </tr>
                  ))}
                  {adjustmentsFiltered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-4 text-center text-xs text-slate-400">
                        Nenhum item encontrado para "{adjustmentsSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {adjustmentsTotalPages > 1 && (
              <div className="px-4 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span className="tabular-nums">
                  Mostrando {(adjustmentsPageSafe - 1) * PAGE_SIZE + 1}–
                  {Math.min(adjustmentsPageSafe * PAGE_SIZE, adjustmentsFiltered.length)} de {adjustmentsFiltered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAdjustmentsPage((p) => Math.max(1, p - 1))}
                    disabled={adjustmentsPageSafe <= 1}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 tabular-nums">
                    {adjustmentsPageSafe} / {adjustmentsTotalPages}
                  </span>
                  <button
                    onClick={() => setAdjustmentsPage((p) => Math.min(adjustmentsTotalPages, p + 1))}
                    disabled={adjustmentsPageSafe >= adjustmentsTotalPages}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Produtos sem divergência (informativo — não vão ao Protheus) */}
        {activeTab === 'no_change' && noChangeItems.length > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">
                Produtos sem divergência ({noChangeItems.length})
              </p>
              <span className="text-[11px] text-slate-500">
                — contados, sem ajuste a enviar ao Protheus
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <SortableTh label="Código" sortKey="product_code" currentKey={noChangeSort.sortKey} currentDir={noChangeSort.sortDir} onSort={noChangeSort.handleSort} />
                    <SortableTh label="Descrição" sortKey="product_description" currentKey={noChangeSort.sortKey} currentDir={noChangeSort.sortDir} onSort={noChangeSort.handleSort} />
                    <SortableTh label="Armazém" sortKey="warehouse" align="center" currentKey={noChangeSort.sortKey} currentDir={noChangeSort.sortDir} onSort={noChangeSort.handleSort} />
                    <SortableTh label="Esperado" sortKey="expected_qty" align="right" currentKey={noChangeSort.sortKey} currentDir={noChangeSort.sortDir} onSort={noChangeSort.handleSort} />
                    <SortableTh label="Contado" sortKey="counted_qty" align="right" currentKey={noChangeSort.sortKey} currentDir={noChangeSort.sortDir} onSort={noChangeSort.handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {noChangeSorted.map((it, idx) => (
                    <tr key={`${it.product_code}-${idx}`} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-mono text-slate-700">{it.product_code || '—'}</td>
                      <td className="py-2 px-2 text-slate-800 truncate max-w-xs" title={it.product_description || ''}>
                        {it.product_description || '—'}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600">{it.warehouse || '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-600">{formatNumber(it.expected_qty)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatNumber(it.counted_qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs de envio (sob demanda) */}
        {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-800">Logs de envio ao Protheus</h3>
              {logsLoaded && <span className="text-xs text-slate-500">({logs.length})</span>}
            </div>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {logsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {logsLoaded ? 'Recarregar' : 'Carregar logs'}
            </button>
          </div>

          {logsLoaded && logs.length === 0 && (
            <p className="text-xs text-slate-400 mt-3">Nenhum log de envio para esta integração ainda.</p>
          )}

          {logs.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <th className="text-left py-2 px-2 text-slate-500 whitespace-nowrap">Quando</th>
                    <th className="text-left py-2 px-2 text-slate-500">Endpoint</th>
                    <th className="text-left py-2 px-2 text-slate-500">Tipo</th>
                    <th className="text-left py-2 px-2 text-slate-500">Produto</th>
                    <th className="text-center py-2 px-2 text-slate-500">Status</th>
                    <th className="text-right py-2 px-2 text-slate-500">Duração</th>
                    <th className="text-left py-2 px-2 text-slate-500">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const logStatus = String(log.status ?? '');
                    const statusColor = logStatus === 'OK' || logStatus === 'SUCCESS' || logStatus === 'SENT'
                      ? 'bg-emerald-100 text-emerald-700'
                      : logStatus === 'PARTIAL'
                        ? 'bg-orange-100 text-orange-700'
                        : logStatus === 'ERROR'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600';
                    const createdAt = log.created_at as string | null;
                    const errMsg = log.error_message as string | null;
                    const duration = log.duration_ms;
                    return (
                      <tr key={String(log.id)} className="border-b border-slate-100 align-top">
                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                          {createdAt ? new Date(createdAt).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="py-2 px-2 font-mono text-slate-700">{String(log.endpoint ?? '—')}</td>
                        <td className="py-2 px-2 text-slate-600">{String(log.item_type ?? '—')}</td>
                        <td className="py-2 px-2 font-mono text-slate-700">{String(log.product_code ?? '—')}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor}`}>
                            {logStatus || '—'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 tabular-nums">
                          {duration ? `${duration}ms` : '—'}
                        </td>
                        <td className="py-2 px-2 text-red-700 max-w-md break-words">
                          {errMsg ? (
                            <details>
                              <summary className="cursor-pointer">{errMsg.slice(0, 80)}{errMsg.length > 80 ? '…' : ''}</summary>
                              <pre className="text-[10px] whitespace-pre-wrap mt-1 bg-red-50 p-2 rounded">{errMsg}</pre>
                            </details>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Resposta Protheus (raw) */}
        {protheusResp && (
          <details className="bg-white rounded-xl border border-slate-200 p-4">
            <summary className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Resposta do Protheus (debug)
            </summary>
            <pre className="mt-3 text-xs bg-slate-50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-96">
              {JSON.stringify(protheusResp, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Modal confirmar reset de erros */}
      {showResetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Marcar erros para reenvio</h3>
              <p className="text-sm text-slate-500 mt-1">
                <strong>{protheusErrors.length} item(ns)</strong> serão marcados como pendentes de envio.
                Itens já gravados com sucesso no Protheus permanecem intocados.
              </p>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                ⚠ <strong>Antes de continuar</strong>, certifique-se de que o problema no Protheus foi resolvido
                (ex.: produtos desbloqueados, cadastros corrigidos). Caso contrário, o reenvio falhará novamente.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetDialog(false)}
                disabled={resettingErrors}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetErrors}
                disabled={resettingErrors}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {resettingErrors ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar envio ao Protheus */}
      {showSendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Enviar ao Protheus</h3>
              <p className="text-sm text-slate-500 mt-1">
                Esta ação grava as movimentações no ERP Protheus. <strong>Não pode ser desfeita pelo sistema</strong> —
                eventual reversão exige ajuste manual no Protheus.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <div>Transferências (SD3): <strong>{totalTransfers}</strong> · R$ {formatNumber(totalTransferValue)}</div>
              <div>Ajustes (SB7): <strong>{totalAdjustments}</strong> · R$ {formatNumber(totalAdjustmentValue)}</div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSendDialog(false)}
                disabled={sending}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleEnviar}
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando...' : 'Confirmar Envio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cancelar com motivo */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cancelar Integração</h3>
              <p className="text-sm text-slate-500 mt-1">
                Esta ação libera os inventários para uma nova integração. Informe o motivo do cancelamento.
              </p>
            </div>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo (mínimo 5 caracteres)..."
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelling || cancelReason.trim().length < 5}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
