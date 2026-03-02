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

  async function handleSend() {
    if (!confirmSend) return;
    setSendLoading(confirmSend.inventoryId);
    setConfirmSend(null);
    try {
      await integrationService.enviar(confirmSend.integrationId);
      // Refresh all inventories' integration status (handles COMPARATIVE with 2 inventories)
      const refreshMap = new Map(integrations);
      for (const inv of inventarios) {
        const existing = await integrationService.buscarExistente(inv.id);
        refreshMap.set(inv.id, existing);
      }
      setIntegrations(refreshMap);
      toast.success('Integracao enviada e inventario(s) efetivado(s) com sucesso.');
    } catch {
      toast.error('Erro ao enviar ao Protheus.');
    } finally {
      setSendLoading(null);
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
      {/* Banner modo simulado */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Modo simulado</p>
          <p className="text-xs text-amber-600 mt-0.5">
            O preview e a preparacao dos dados funcionam normalmente. O envio ao ERP Protheus esta em modo de teste
            — os dados sao salvos e marcados como ENVIADO, mas nao sao transmitidos ao Protheus. A integracao real
            sera ativada quando a API do Protheus estiver configurada.
          </p>
        </div>
      </div>

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
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : integration.status === 'PENDING' || integration.status === 'DRAFT' ? (
                        <button
                          onClick={() => setConfirmSend({
                            integrationId: integration.id,
                            inventoryId: inv.id,
                            inventoryName: inv.name,
                          })}
                          className="flex items-center gap-1 text-sm text-capul-600 hover:underline ml-auto"
                        >
                          <Send className="w-3 h-3" />
                          Enviar
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {integration.sent_at ? new Date(integration.sent_at).toLocaleString('pt-BR') : ''}
                        </span>
                      )}
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
          onClose={() => { setShowPreview(false); setPreviewData(null); }}
        />
      )}

      {/* Send confirmation */}
      <ConfirmDialog
        open={!!confirmSend}
        title="Enviar ao Protheus"
        description="Enviar o resultado ao Protheus? Esta acao e irreversivel."
        details={confirmSend?.inventoryName ? [`Inventario: ${confirmSend.inventoryName}`] : undefined}
        variant="danger"
        confirmLabel="Enviar"
        onConfirm={handleSend}
        onCancel={() => setConfirmSend(null)}
      />
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
