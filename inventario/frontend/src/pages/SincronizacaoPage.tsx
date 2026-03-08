import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { syncService } from '../services/sync.service';
import { integrationService } from '../services/integration.service';
import { inventoryService } from '../services/inventory.service';
import type {
  InventoryList,
  SyncStatus,
  Integration,
  IntegrationPreviewResult,
  SendAllResult,
  SendLogsResult,
} from '../types';
import {
  Send,
  History,
  Package,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ArrowRightLeft,
  Eye,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IntegracaoPreviewModal } from './inventarios/components/IntegracaoPreviewModal';

type Tab = 'envio' | 'historico';

export function SincronizacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('envio');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    syncService.getStatus().then(setSyncStatus).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'envio', label: 'Envio ao Protheus', icon: Send },
    { key: 'historico', label: 'Historico', icon: History },
  ];

  return (
    <>
      <Header title="Envio ao Protheus" />
      <div className="p-6 space-y-4">
        {/* Cards resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Produtos Sync</p>
                <p className="text-xl font-bold text-slate-800">
                  {syncStatus?.products_synced?.toLocaleString('pt-BR') ?? '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-sm font-bold text-slate-800">{syncStatus?.status ?? '—'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Erros</p>
                <p className="text-xl font-bold text-amber-600">{syncStatus?.errors ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Ultima Sync</p>
                <p className="text-sm font-bold text-slate-800">
                  {syncStatus?.last_sync
                    ? new Date(syncStatus.last_sync).toLocaleString('pt-BR')
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
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

        {/* Tab content */}
        {activeTab === 'envio' && <TabEnvio />}
        {activeTab === 'historico' && <TabHistorico syncStatus={syncStatus} />}
      </div>
    </>
  );
}

// === Tab Envio ao Protheus ===

type IntegrationMode = 'SIMPLES' | 'COMPARATIVO';

function TabEnvio() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Map<string, Integration | null>>(new Map());

  // Mode selection — pre-fill from query params
  const qMode = searchParams.get('mode')?.toUpperCase() as IntegrationMode | undefined;
  const qInvA = searchParams.get('inv_a') ?? '';
  const qInvB = searchParams.get('inv_b') ?? '';
  const [mode, setMode] = useState<IntegrationMode>(qMode === 'COMPARATIVO' ? 'COMPARATIVO' : 'SIMPLES');
  const [selectedA, setSelectedA] = useState<string>(qInvA);
  const [selectedB, setSelectedB] = useState<string>(qInvB);

  // Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<IntegrationPreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Send confirmation
  const [confirmSend, setConfirmSend] = useState<{
    integrationId: string;
    inventoryId: string;
    inventoryName: string;
  } | null>(null);
  const [sendLoading, setSendLoading] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendAllResult | null>(null);
  const [logsData, setLogsData] = useState<SendLogsResult | null>(null);
  const [logsLoading, setLogsLoading] = useState<string | null>(null);

  useEffect(() => {
    // Buscar inventários COMPLETED e CLOSED (efetivados) em paralelo
    Promise.all([
      inventoryService.listar({ status: 'COMPLETED', size: '50' }),
      inventoryService.listar({ status: 'CLOSED', size: '50' }),
    ])
      .then(async ([completedRes, closedRes]) => {
        // Mesclar sem duplicados
        const allItems = [...completedRes.items, ...closedRes.items];
        const unique = Array.from(new Map(allItems.map((i) => [i.id, i])).values());
        setInventarios(unique);
        const map = new Map<string, Integration | null>();
        for (const inv of unique) {
          const existing = await integrationService.buscarExistente(inv.id);
          map.set(inv.id, existing);
        }
        setIntegrations(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Clean query params after reading
    if (searchParams.has('mode') || searchParams.has('inv_a') || searchParams.has('inv_b')) {
      const cleanParams = new URLSearchParams();
      setSearchParams(cleanParams, { replace: true });
    }
  }, []);

  async function handlePreview() {
    if (!selectedA) return;
    setPreviewLoading(true);
    try {
      const result = await integrationService.preview(
        selectedA,
        mode === 'COMPARATIVO' ? selectedB || undefined : undefined,
        true,
      );
      setPreviewData(result);
      setShowPreview(true);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao gerar preview da integracao.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSaveFromPreview() {
    if (!selectedA) return;
    setSaveLoading(true);
    try {
      const result = await integrationService.salvar(
        selectedA,
        mode === 'COMPARATIVO' ? selectedB || undefined : undefined,
      );
      toast.success(`Integracao ${result.action === 'created' ? 'criada' : 'atualizada'} com sucesso.`);
      setShowPreview(false);
      setPreviewData(null);
      const savedA = selectedA;
      const savedB = mode === 'COMPARATIVO' ? selectedB : '';
      setSelectedA('');
      setSelectedB('');
      // Refresh integrations for both A and B
      const existingA = await integrationService.buscarExistente(savedA);
      setIntegrations((prev) => {
        const next = new Map(prev);
        next.set(savedA, existingA);
        return next;
      });
      if (savedB) {
        const existingB = await integrationService.buscarExistente(savedB);
        setIntegrations((prev) => {
          const next = new Map(prev);
          next.set(savedB, existingB);
          return next;
        });
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao salvar integracao.');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSaveAndSend() {
    if (!selectedA) return;
    setSaveLoading(true);
    setSendResult(null);
    try {
      // 1. Salvar
      const result = await integrationService.salvar(
        selectedA,
        mode === 'COMPARATIVO' ? selectedB || undefined : undefined,
      );
      toast.success(`Integracao ${result.action === 'created' ? 'criada' : 'atualizada'}. Enviando ao Protheus...`);

      // 2. Enviar
      const sendRes = await integrationService.enviarTudo(result.integration_id);
      setSendResult(sendRes);

      setShowPreview(false);
      setPreviewData(null);
      setSelectedA('');
      setSelectedB('');

      // Refresh integrations
      const refreshMap = new Map(integrations);
      for (const inv of inventarios) {
        const existing = await integrationService.buscarExistente(inv.id);
        refreshMap.set(inv.id, existing);
      }
      setIntegrations(refreshMap);

      if (sendRes.success) {
        toast.success(`Envio completo: ${sendRes.total_enviados} itens enviados com sucesso.`);
      } else {
        toast.warning(`Envio parcial: ${sendRes.total_enviados} OK, ${sendRes.total_erros} erros.`);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao salvar/enviar integracao.');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSend() {
    if (!confirmSend) return;
    const { integrationId, inventoryId } = confirmSend;
    setSendLoading(inventoryId);
    setSendResult(null);
    setConfirmSend(null);
    try {
      const result = await integrationService.enviarTudo(integrationId);
      setSendResult(result);
      // Refresh all inventories' integration status
      const refreshMap = new Map(integrations);
      for (const inv of inventarios) {
        const existing = await integrationService.buscarExistente(inv.id);
        refreshMap.set(inv.id, existing);
      }
      setIntegrations(refreshMap);
      if (result.success) {
        toast.success(`Envio completo: ${result.total_enviados} itens enviados com sucesso.`);
      } else {
        toast.warning(`Envio parcial: ${result.total_enviados} OK, ${result.total_erros} erros.`);
      }
    } catch {
      toast.error('Erro ao enviar ao Protheus.');
    } finally {
      setSendLoading(null);
    }
  }

  async function handleViewLogs(integrationId: string) {
    setLogsLoading(integrationId);
    try {
      const logs = await integrationService.buscarLogs(integrationId);
      setLogsData(logs);
    } catch {
      toast.error('Erro ao carregar logs de envio.');
    } finally {
      setLogsLoading(null);
    }
  }

  // Inventarios without integration (available for selection) — only COMPLETED, not CLOSED
  const availableForSelection = inventarios.filter((inv) => {
    if (inv.status === 'CLOSED') return false; // Efetivados nao podem gerar nova integracao
    const integ = integrations.get(inv.id);
    return !integ || integ.status === 'CANCELLED' || integ.status === 'DRAFT';
  });

  // Inventarios with integration (table rows)
  const withIntegration = inventarios.filter((inv) => integrations.get(inv.id));

  if (loading) {
    return <TableSkeleton rows={4} cols={5} />;
  }

  if (inventarios.length === 0) {
    return (
      <div className="text-center py-8">
        <Send className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">Nenhum inventario finalizado para enviar.</p>
        <p className="text-slate-400 text-xs mt-1">Conclua um inventario para enviar os resultados ao Protheus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Send result banner */}
      {sendResult && (() => {
        const r = sendResult.resultados;
        const totalProdutos = r?.digitacao?.total || r?.historico?.total || 0;
        const transfOk = r?.transferencias?.enviados ?? 0;
        const transfTotal = r?.transferencias?.total ?? 0;
        const transfErros = r?.transferencias?.erros ?? 0;
        const digitOk = r?.digitacao?.enviados ?? 0;
        const digitTotal = r?.digitacao?.total ?? 0;
        const digitErros = r?.digitacao?.erros ?? 0;
        const histOk = r?.historico?.enviados ?? 0;
        const histTotal = r?.historico?.total ?? 0;
        const histErros = r?.historico?.erros ?? 0;
        const hasTransf = transfTotal > 0;

        return (
          <div className={`rounded-xl border overflow-hidden ${
            sendResult.success ? 'border-green-200' : 'border-amber-200'
          }`}>
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${
              sendResult.success ? 'bg-green-50' : 'bg-amber-50'
            }`}>
              <div className="flex items-center gap-2">
                {sendResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                <span className={`text-sm font-semibold ${sendResult.success ? 'text-green-800' : 'text-amber-800'}`}>
                  {sendResult.success ? 'Envio concluido com sucesso' : 'Envio concluido com erros'}
                </span>
              </div>
              <button onClick={() => setSendResult(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>

            {/* Body — cards por etapa */}
            <div className="bg-white px-4 py-4">
              <div className={`grid gap-3 ${hasTransf ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
                {/* Total de Produtos */}
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Total Produtos</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{totalProdutos}</p>
                </div>

                {/* Transferencias (se houver) */}
                {hasTransf && (
                  <div className={`rounded-lg border p-3 text-center ${
                    transfErros > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'
                  }`}>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide">Transferencias</p>
                    <p className="text-2xl font-bold mt-1">
                      <span className={transfErros > 0 ? 'text-amber-700' : 'text-green-700'}>{transfOk}</span>
                      <span className="text-slate-400 text-base font-normal">/{transfTotal}</span>
                    </p>
                    {transfErros > 0 && <p className="text-[10px] text-red-500 mt-0.5">{transfErros} erro(s)</p>}
                  </div>
                )}

                {/* Inventario SB7 (Digitacao) */}
                <div className={`rounded-lg border p-3 text-center ${
                  digitErros > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'
                }`}>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Inventario SB7</p>
                  <p className="text-2xl font-bold mt-1">
                    <span className={digitErros > 0 ? 'text-amber-700' : 'text-green-700'}>{digitOk}</span>
                    <span className="text-slate-400 text-base font-normal">/{digitTotal}</span>
                  </p>
                  {digitErros > 0 && <p className="text-[10px] text-red-500 mt-0.5">{digitErros} erro(s)</p>}
                </div>

                {/* Historico */}
                <div className={`rounded-lg border p-3 text-center ${
                  histErros > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'
                }`}>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide">Historico</p>
                  <p className="text-2xl font-bold mt-1">
                    <span className={histErros > 0 ? 'text-amber-700' : 'text-green-700'}>{histOk}</span>
                    <span className="text-slate-400 text-base font-normal">/{histTotal}</span>
                  </p>
                  {histErros > 0 && <p className="text-[10px] text-red-500 mt-0.5">{histErros} erro(s)</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mode selection + Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Nova Integracao</h3>

        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 mr-2">Modo:</span>
          <button
            onClick={() => { setMode('SIMPLES'); setSelectedB(''); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              mode === 'SIMPLES'
                ? 'bg-capul-50 border-capul-300 text-capul-700'
                : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            Simples
          </button>
          <button
            onClick={() => setMode('COMPARATIVO')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              mode === 'COMPARATIVO'
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Comparativo
          </button>
        </div>

        {/* Selectors */}
        <div className={`grid gap-4 ${mode === 'COMPARATIVO' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              {mode === 'COMPARATIVO' ? 'Inventario A' : 'Inventario'}
            </label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500"
            >
              <option value="">Selecione um inventario...</option>
              {availableForSelection.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} ({inv.warehouse}) — {inv.total_items} itens
                </option>
              ))}
            </select>
          </div>

          {mode === 'COMPARATIVO' && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Inventario B
              </label>
              <select
                value={selectedB}
                onChange={(e) => setSelectedB(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-capul-500 focus:border-capul-500"
              >
                <option value="">Selecione o segundo inventario...</option>
                {availableForSelection
                  .filter((inv) => inv.id !== selectedA)
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.warehouse}) — {inv.total_items} itens
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Preview button */}
        <div className="flex justify-end">
          <button
            onClick={handlePreview}
            disabled={!selectedA || (mode === 'COMPARATIVO' && !selectedB) || previewLoading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Visualizar Preview
          </button>
        </div>
      </div>

      {/* Existing integrations table */}
      {withIntegration.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Integracoes Existentes</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Inventario</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Armazem</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Itens</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-600">Acao</th>
              </tr>
            </thead>
            <tbody>
              {withIntegration.map((inv) => {
                const integration = integrations.get(inv.id)!;
                const isLoading = sendLoading === inv.id;

                return (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800">{inv.name}</span>
                      {inv.status === 'CLOSED' && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">Efetivado</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{inv.warehouse}</td>
                    <td className="py-2.5 px-4 text-slate-600">{inv.total_items}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        integration.status === 'SENT' || integration.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : integration.status === 'ERROR'
                          ? 'bg-red-100 text-red-700'
                          : integration.status === 'PARTIAL'
                          ? 'bg-orange-100 text-orange-700'
                          : integration.status === 'CANCELLED'
                          ? 'bg-slate-100 text-slate-600'
                          : integration.status === 'PROCESSING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {{ DRAFT: 'Pendente', PENDING: 'Pendente', SENT: 'Enviado', PROCESSING: 'Processando', CONFIRMED: 'Confirmado', PARTIAL: 'Parcial', ERROR: 'Erro', CANCELLED: 'Cancelado' }[integration.status] ?? integration.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : ['PENDING', 'DRAFT', 'ERROR', 'PARTIAL'].includes(integration.status) ? (
                          <button
                            onClick={() => setConfirmSend({
                              integrationId: integration.id,
                              inventoryId: inv.id,
                              inventoryName: inv.name,
                            })}
                            className="flex items-center gap-1 text-sm text-capul-600 hover:underline"
                          >
                            <Send className="w-3 h-3" />
                            {['ERROR', 'PARTIAL'].includes(integration.status) ? 'Reenviar' : 'Enviar'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {integration.sent_at ? new Date(integration.sent_at).toLocaleString('pt-BR') : ''}
                          </span>
                        )}
                        {['SENT', 'ERROR', 'PARTIAL', 'CONFIRMED'].includes(integration.status) && (
                          <button
                            onClick={() => handleViewLogs(integration.id)}
                            disabled={logsLoading === integration.id}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                          >
                            {logsLoading === integration.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <History className="w-3 h-3" />
                            )}
                            Logs
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {previewData && (
        <IntegracaoPreviewModal
          open={showPreview}
          preview={previewData}
          saving={saveLoading}
          onSave={handleSaveFromPreview}
          onSaveAndSend={handleSaveAndSend}
          onClose={() => { setShowPreview(false); setPreviewData(null); }}
        />
      )}

      {/* Send confirmation */}
      <ConfirmDialog
        open={!!confirmSend}
        title="Enviar ao Protheus"
        description="Enviar transferencias, digitacao e historico ao Protheus?"
        details={confirmSend?.inventoryName ? [`Inventario: ${confirmSend.inventoryName}`, 'Serao enviados: transferencias, digitacao de balanco e historico de contagem.'] : undefined}
        variant="danger"
        confirmLabel="Enviar ao Protheus"
        onConfirm={handleSend}
        onCancel={() => setConfirmSend(null)}
      />

      {/* Logs modal */}
      {logsData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="font-semibold text-slate-800">Logs de Envio</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {logsData.ok} OK, {logsData.errors} erros — {logsData.total} total
                </p>
              </div>
              <button onClick={() => setLogsData(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {logsData.logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum log de envio encontrado.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Endpoint</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Tipo</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Produto</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Status</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-600">Tempo</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsData.logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-xs">{log.endpoint}</td>
                        <td className="py-2 px-3 text-xs">{log.item_type}</td>
                        <td className="py-2 px-3 font-mono text-xs">{log.product_code || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            log.status === 'OK' ? 'bg-green-100 text-green-700'
                              : log.status === 'ERROR' ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status}
                          </span>
                          {log.error_message && (
                            <p className="text-[10px] text-red-500 mt-0.5 max-w-[200px] truncate" title={log.error_message}>
                              {log.error_message}
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-500">{log.duration_ms}ms</td>
                        <td className="py-2 px-3 text-xs text-slate-500">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Tab Historico ===

function TabHistorico({ syncStatus }: { syncStatus: SyncStatus | null }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Informacoes de Sincronizacao</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Clock className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm text-slate-700">Ultima Sincronizacao</p>
              <p className="text-xs text-slate-500">
                {syncStatus?.last_sync
                  ? new Date(syncStatus.last_sync).toLocaleString('pt-BR')
                  : 'Nenhuma sincronizacao realizada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm text-slate-700">Produtos Sincronizados</p>
              <p className="text-xs text-slate-500">
                {syncStatus?.products_synced?.toLocaleString('pt-BR') ?? '0'} registros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Database className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-slate-700">Status</p>
              <p className="text-xs text-slate-500">{syncStatus?.status ?? 'Desconhecido'}</p>
            </div>
          </div>
          {(syncStatus?.errors ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-red-700">Erros na Ultima Sync</p>
                <p className="text-xs text-red-500">{syncStatus?.errors} erros encontrados</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
