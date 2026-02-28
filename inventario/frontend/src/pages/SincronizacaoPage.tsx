import { useEffect, useState } from 'react';
import { Header } from '../layouts/Header';
import { syncService } from '../services/sync.service';
import { integrationService } from '../services/integration.service';
import { inventoryService } from '../services/inventory.service';
import type { Integration } from '../services/integration.service';
import type { InventoryList, SyncStatus } from '../types';
import {
  Send,
  History,
  Package,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

function TabEnvio() {
  const toast = useToast();
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Map<string, Integration | null>>(new Map());
  const [confirmAction, setConfirmAction] = useState<{
    type: 'preview' | 'send';
    inventoryId: string;
    integrationId?: string;
    inventoryName?: string;
  } | null>(null);

  useEffect(() => {
    inventoryService.listar({ status: 'COMPLETED', size: '50' })
      .then(async (res) => {
        setInventarios(res.items);
        const map = new Map<string, Integration | null>();
        for (const inv of res.items) {
          const existing = await integrationService.buscarExistente(inv.id);
          map.set(inv.id, existing);
        }
        setIntegrations(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function doPreviewAndSave(inventoryId: string) {
    setActionLoading(inventoryId);
    try {
      const integration = await integrationService.salvar(inventoryId);
      setIntegrations((prev) => new Map(prev).set(inventoryId, integration));
      toast.success('Integracao criada com sucesso.');
    } catch {
      toast.error('Erro ao criar integracao.');
    } finally {
      setActionLoading(null);
    }
  }

  async function doSend(integrationId: string, inventoryId: string) {
    setActionLoading(inventoryId);
    try {
      await integrationService.enviar(integrationId);
      const updated = await integrationService.buscarPorId(integrationId);
      setIntegrations((prev) => new Map(prev).set(inventoryId, updated));
      toast.success('Enviado ao Protheus com sucesso.');
    } catch {
      toast.error('Erro ao enviar ao Protheus.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === 'preview') {
      doPreviewAndSave(confirmAction.inventoryId);
    } else if (confirmAction.integrationId) {
      doSend(confirmAction.integrationId, confirmAction.inventoryId);
    }
    setConfirmAction(null);
  }

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
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left py-2.5 px-4 font-medium text-slate-600">Inventario</th>
            <th className="text-left py-2.5 px-4 font-medium text-slate-600">Armazem</th>
            <th className="text-left py-2.5 px-4 font-medium text-slate-600">Itens</th>
            <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status Integracao</th>
            <th className="text-right py-2.5 px-4 font-medium text-slate-600">Acao</th>
          </tr>
        </thead>
        <tbody>
          {inventarios.map((inv) => {
            const integration = integrations.get(inv.id);
            const isLoading = actionLoading === inv.id;

            return (
              <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-4 font-medium text-slate-800">{inv.name}</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">{inv.warehouse}</td>
                <td className="py-2.5 px-4 text-slate-600">{inv.total_items}</td>
                <td className="py-2.5 px-4">
                  {integration ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      integration.status === 'ENVIADO' || integration.status === 'CONFIRMADO'
                        ? 'bg-green-100 text-green-700'
                        : integration.status === 'ERRO'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {integration.status}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Nao criada</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                  ) : !integration ? (
                    <button
                      onClick={() => setConfirmAction({ type: 'preview', inventoryId: inv.id, inventoryName: inv.name })}
                      className="text-sm text-capul-600 hover:underline"
                    >
                      Preparar Envio
                    </button>
                  ) : integration.status === 'PENDENTE' ? (
                    <button
                      onClick={() => setConfirmAction({ type: 'send', inventoryId: inv.id, integrationId: integration.id, inventoryName: inv.name })}
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

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.type === 'preview' ? 'Preparar Envio' : 'Enviar ao Protheus'}
        description={
          confirmAction?.type === 'preview'
            ? 'Gerar preview e salvar a integracao para este inventario?'
            : 'Enviar o resultado ao Protheus? Esta acao e irreversivel.'
        }
        details={confirmAction?.inventoryName ? [`Inventario: ${confirmAction.inventoryName}`] : undefined}
        variant={confirmAction?.type === 'send' ? 'danger' : 'info'}
        confirmLabel={confirmAction?.type === 'preview' ? 'Preparar' : 'Enviar'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
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
