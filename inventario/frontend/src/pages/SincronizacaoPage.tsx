import { useEffect, useState } from 'react';
import { Header } from '../layouts/Header';
import { syncService } from '../services/sync.service';
import { integrationService } from '../services/integration.service';
import { inventoryService } from '../services/inventory.service';
import type { Integration } from '../services/integration.service';
import type { InventoryList, SyncStatus } from '../types';
import {
  RefreshCw,
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

type Tab = 'sync' | 'envio' | 'historico';

export function SincronizacaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sync');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    syncService.getStatus().then(setSyncStatus).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'sync', label: 'Sincronizacao', icon: RefreshCw },
    { key: 'envio', label: 'Envio ao Protheus', icon: Send },
    { key: 'historico', label: 'Historico', icon: History },
  ];

  return (
    <>
      <Header title="Integracao Protheus" />
      <div className="p-6 space-y-4">
        {/* Cards resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-blue-600" />
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
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
        {activeTab === 'sync' && <TabSync onSyncComplete={() => syncService.getStatus().then(setSyncStatus).catch(() => {})} />}
        {activeTab === 'envio' && <TabEnvio />}
        {activeTab === 'historico' && <TabHistorico syncStatus={syncStatus} />}
        {/* Toast available via useToast() in sub-components */}
      </div>
    </>
  );
}

// === Tab Sincronizacao ===

function TabSync({ onSyncComplete }: { onSyncComplete: () => void }) {
  const [syncingHierarchy, setSyncingHierarchy] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [resultHierarchy, setResultHierarchy] = useState<string | null>(null);
  const [resultStock, setResultStock] = useState<string | null>(null);

  async function handleSyncHierarchy() {
    setSyncingHierarchy(true);
    setResultHierarchy(null);
    try {
      await syncService.sincronizarHierarquia();
      setResultHierarchy('Hierarquia sincronizada com sucesso!');
      onSyncComplete();
    } catch {
      setResultHierarchy('Erro ao sincronizar hierarquia.');
    } finally {
      setSyncingHierarchy(false);
    }
  }

  async function handleSyncStock() {
    setSyncingStock(true);
    setResultStock(null);
    try {
      const res = await syncService.sincronizarEstoque();
      setResultStock(`Saldos sincronizados: ${res.synced} registros, ${res.errors} erros.`);
      onSyncComplete();
    } catch {
      setResultStock('Erro ao sincronizar saldos.');
    } finally {
      setSyncingStock(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Hierarquia */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Hierarquia Mercadologica</h3>
            <p className="text-sm text-slate-500 mt-1">
              Produtos, grupos, categorias, subcategorias, segmentos, localizacoes, codigos de barras e precos.
            </p>
            <p className="text-xs text-slate-400 mt-1">Tabelas: SB1, SBM, SZD, SZE, SZF, SBZ, SLK, DA1</p>
          </div>
          <button
            onClick={handleSyncHierarchy}
            disabled={syncingHierarchy}
            className="flex items-center gap-2 px-4 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700 disabled:opacity-50 shrink-0"
          >
            {syncingHierarchy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncingHierarchy ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        </div>
        {resultHierarchy && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            resultHierarchy.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {resultHierarchy}
          </div>
        )}
      </div>

      {/* Saldos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Saldos e Lotes</h3>
            <p className="text-sm text-slate-500 mt-1">
              Saldos de estoque e controle de lotes do Protheus.
            </p>
            <p className="text-xs text-slate-400 mt-1">Tabelas: SB2, SB8</p>
          </div>
          <button
            onClick={handleSyncStock}
            disabled={syncingStock}
            className="flex items-center gap-2 px-4 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700 disabled:opacity-50 shrink-0"
          >
            {syncingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {syncingStock ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        </div>
        {resultStock && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            resultStock.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            {resultStock}
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>A sincronizacao pode levar alguns minutos. Nao feche esta pagina durante o processo.</span>
      </div>
    </div>
  );
}

// === Tab Envio ao Protheus ===

function TabEnvio() {
  const toast = useToast();
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Map<string, Integration | null>>(new Map());

  useEffect(() => {
    inventoryService.listar({ status: 'COMPLETED', size: '50' })
      .then(async (res) => {
        setInventarios(res.items);
        // Check existing integrations for each inventory
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

  async function handlePreviewAndSave(inventoryId: string) {
    if (!confirm('Gerar preview e salvar integracao para este inventario?')) return;
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

  async function handleSend(integrationId: string, inventoryId: string) {
    if (!confirm('Enviar resultado ao Protheus? Esta acao e irreversivel.')) return;
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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                      onClick={() => handlePreviewAndSave(inv.id)}
                      className="text-sm text-capul-600 hover:underline"
                    >
                      Preparar Envio
                    </button>
                  ) : integration.status === 'PENDENTE' ? (
                    <button
                      onClick={() => handleSend(integration.id, inv.id)}
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
