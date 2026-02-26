import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { countingListService } from '../../services/counting-list.service';
import { CriarListaModal } from './components/CriarListaModal';
import { AddProductsModal } from './components/AddProductsModal';
import { ListaDetalheModal } from './components/ListaDetalheModal';
import { TabAnalise } from './components/TabAnalise';
import { cycleBadgeColor, cycleLabel } from '../../utils/cycles';
import { downloadCSV } from '../../utils/csv';
import {
  ArrowLeft,
  ListChecks,
  BarChart2,
  History,
  Trash2,
  Play,
  Package,
  Plus,
  Shuffle,
  Eye,
  Unlock,
  CheckCircle2,
  Lock,
  MoreVertical,
  Download,
} from 'lucide-react';
import { PageSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/ErrorState';
import { useToast } from '../../contexts/ToastContext';
import type {
  InventoryList,
  InventoryItem,
  CountingList,
  ItemStatus,
  ListStatus,
} from '../../types';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Concluido', color: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Encerrado', color: 'bg-purple-100 text-purple-700' },
};

const listStatusConfig: Record<string, { label: string; color: string }> = {
  PREPARACAO: { label: 'Preparacao', color: 'bg-slate-100 text-slate-700' },
  LIBERADA: { label: 'Liberada', color: 'bg-blue-100 text-blue-700' },
  EM_CONTAGEM: { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-green-100 text-green-700' },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  COUNTED: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  REVIEWED: { label: 'Revisado', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ZERO_CONFIRMED: { label: 'Zero Confirmado', color: 'bg-purple-100 text-purple-700' },
};

type Tab = 'itens' | 'listas' | 'analise' | 'historico';

export function InventarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [itens, setItens] = useState<InventoryItem[]>([]);
  const [listas, setListas] = useState<CountingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('itens');
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [itemStatusFilter, setItemStatusFilter] = useState<ItemStatus | ''>('');
  const [showAddProducts, setShowAddProducts] = useState(false);

  const reloadItens = useCallback(() => {
    if (!id) return;
    const params: Record<string, string> = { page: String(itemsPage), size: '50' };
    if (itemStatusFilter) params.status = itemStatusFilter;
    inventoryService.listarItens(id, params)
      .then((res) => {
        setItens(res.items);
        setItemsTotal(res.total);
        setItemsTotalPages(Math.ceil(res.total / res.size) || 1);
      })
      .catch(() => {});
  }, [id, itemsPage, itemStatusFilter]);

  const reloadListas = useCallback(() => {
    if (!id) return;
    countingListService.listar(id).then(setListas).catch(() => {});
  }, [id]);

  const reloadInventario = useCallback(() => {
    if (!id) return;
    inventoryService.buscarPorId(id).then(setInventario).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      inventoryService.buscarPorId(id),
      inventoryService.listarItens(id, { page: '1', size: '50' }),
      countingListService.listar(id),
    ])
      .then(([inv, itemsRes, listasRes]) => {
        setInventario(inv);
        setItens(itemsRes.items);
        setItemsTotal(itemsRes.total);
        setItemsTotalPages(Math.ceil(itemsRes.total / itemsRes.size) || 1);
        setListas(listasRes);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || activeTab !== 'itens') return;
    const params: Record<string, string> = { page: String(itemsPage), size: '50' };
    if (itemStatusFilter) params.status = itemStatusFilter;
    inventoryService.listarItens(id, params)
      .then((res) => {
        setItens(res.items);
        setItemsTotal(res.total);
        setItemsTotalPages(Math.ceil(res.total / res.size) || 1);
      })
      .catch(() => {});
  }, [id, itemsPage, itemStatusFilter, activeTab]);

  async function handleDelete() {
    if (!id || !inventario) return;
    if (!confirm(`Excluir inventario "${inventario.name}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await inventoryService.excluir(id);
      toast.success('Inventario excluido.');
      navigate('/inventario/inventarios');
    } catch {
      toast.error('Erro ao excluir inventario.');
    }
  }

  async function handleStartCounting() {
    if (!id) return;
    try {
      const updated = await inventoryService.atualizar(id, { status: 'IN_PROGRESS' });
      setInventario(updated);
      toast.success('Inventario iniciado.');
    } catch {
      toast.error('Erro ao iniciar inventario.');
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Inventario" />
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Inventario" />
        <div className="p-4 md:p-6"><ErrorState message="Erro ao carregar inventario." onRetry={() => window.location.reload()} /></div>
      </>
    );
  }

  if (!inventario) {
    return (
      <>
        <Header title="Inventario" />
        <div className="p-6 text-center text-slate-500">Inventario nao encontrado.</div>
      </>
    );
  }

  const sc = statusConfig[inventario.status] || statusConfig.DRAFT;

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'itens', label: `Itens (${itemsTotal})`, icon: Package },
    { key: 'listas', label: `Listas (${listas.length})`, icon: ListChecks },
    { key: 'analise', label: 'Analise', icon: BarChart2 },
    { key: 'historico', label: 'Historico', icon: History },
  ];

  return (
    <>
      <Header title={inventario.name} />
      <div className="p-4 md:p-6 space-y-4">
        {/* Voltar */}
        <button
          onClick={() => navigate('/inventario/inventarios')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para lista
        </button>

        {/* Cabecalho info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">{inventario.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              {inventario.description && (
                <p className="text-sm text-slate-500">{inventario.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {inventario.status === 'DRAFT' && (
                <>
                  <button
                    onClick={handleStartCounting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
                  >
                    <Play className="w-4 h-4" />
                    Iniciar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Armazem</p>
              <p className="text-lg font-bold text-slate-800">{inventario.warehouse}</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Ciclo Atual</p>
              <p className="text-lg font-bold text-slate-800">{inventario.current_cycle}o</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Total Itens</p>
              <p className="text-lg font-bold text-slate-800">{inventario.total_items}</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Contados</p>
              <p className="text-lg font-bold text-green-600">{inventario.counted_items}</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Progresso</p>
              <p className="text-lg font-bold text-capul-600">{Math.round(inventario.progress_percentage)}%</p>
            </div>
          </div>

          {/* Barra progresso */}
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-capul-500 rounded-full transition-all"
              style={{ width: `${inventario.progress_percentage}%` }}
            />
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

        {/* Conteudo tab */}
        {activeTab === 'itens' && (
          <TabItens
            itens={itens}
            page={itemsPage}
            totalPages={itemsTotalPages}
            statusFilter={itemStatusFilter}
            inventoryStatus={inventario.status}
            onPageChange={setItemsPage}
            onStatusChange={(s) => { setItemStatusFilter(s); setItemsPage(1); }}
            onAddProducts={() => setShowAddProducts(true)}
          />
        )}
        {activeTab === 'listas' && (
          <TabListas
            listas={listas}
            inventoryId={id!}
            inventoryStatus={inventario.status}
            onReload={() => { reloadListas(); reloadInventario(); }}
          />
        )}
        {activeTab === 'analise' && <TabAnalise inventoryId={id!} listas={listas} />}
        {activeTab === 'historico' && <TabPlaceholder icon={History} text="Historico sera implementado em breve." />}

        {/* Modal adicionar produtos */}
        {showAddProducts && (
          <AddProductsModal
            inventoryId={id!}
            onClose={() => setShowAddProducts(false)}
            onAdded={() => { reloadItens(); reloadInventario(); }}
          />
        )}
      </div>
    </>
  );
}

// === Tab Itens ===

function TabItens({ itens, page, totalPages, statusFilter, inventoryStatus, onPageChange, onStatusChange, onAddProducts }: {
  itens: InventoryItem[];
  page: number;
  totalPages: number;
  statusFilter: ItemStatus | '';
  inventoryStatus: string;
  onPageChange: (p: number) => void;
  onStatusChange: (s: ItemStatus | '') => void;
  onAddProducts: () => void;
}) {
  const canAdd = inventoryStatus === 'DRAFT' || inventoryStatus === 'IN_PROGRESS';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as ItemStatus | '')}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendentes</option>
          <option value="COUNTED">Contados</option>
          <option value="APPROVED">Aprovados</option>
        </select>

        <div className="flex-1" />

        {itens.length > 0 && (
          <button
            onClick={() => {
              const header = 'Seq;Codigo;Descricao;UN;Esperado;Contado;Variacao;Status\n';
              const rows = itens.map((item) =>
                `${item.sequence};${item.product_code};${item.product_name};${item.product_unit};${item.expected_quantity.toFixed(2)};${item.counted_quantity > 0 ? item.counted_quantity.toFixed(2) : ''};${item.status !== 'PENDING' ? item.variance.toFixed(2) : ''};${item.status}`,
              );
              downloadCSV(`itens_inventario_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        )}

        {canAdd && (
          <button
            onClick={onAddProducts}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
          >
            <Plus className="w-4 h-4" />
            Adicionar Produtos
          </button>
        )}
      </div>

      {itens.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Nenhum item neste inventario.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-3 font-medium text-slate-600 w-12">#</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Codigo</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Descricao</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">UN</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Esperado</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Contado</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-600">Variacao</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const isc = itemStatusConfig[item.status] || itemStatusConfig.PENDING;
                const hasVariance = item.variance !== 0 && item.status !== 'PENDING';
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 ${
                      hasVariance ? 'bg-amber-50' : item.status === 'APPROVED' ? 'bg-green-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{item.sequence}</td>
                    <td className="py-2.5 px-3 font-mono text-sm text-slate-700">{item.product_code}</td>
                    <td className="py-2.5 px-3 text-slate-800 truncate max-w-xs">{item.product_name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{item.product_unit}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{item.expected_quantity.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                      {item.counted_quantity > 0 ? item.counted_quantity.toFixed(2) : '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium ${
                      item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {item.status !== 'PENDING' ? (
                        <>
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                          {item.variance_percentage !== 0 && (
                            <span className="text-xs ml-1">({item.variance_percentage.toFixed(1)}%)</span>
                          )}
                        </>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isc.color}`}>
                        {isc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Pagina {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Proximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// === Tab Listas (Sprint 3 — CRUD completo) ===

function TabListas({ listas, inventoryId, inventoryStatus, onReload }: {
  listas: CountingList[];
  inventoryId: string;
  inventoryStatus: string;
  onReload: () => void;
}) {
  const toast = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detalheLista, setDetalheLista] = useState<CountingList | null>(null);
  const [statusFilter, setStatusFilter] = useState<ListStatus | ''>('');
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = statusFilter
    ? listas.filter((l) => l.list_status === statusFilter)
    : listas;

  const canCreate = inventoryStatus !== 'CLOSED';

  async function handleDistribuir() {
    if (!confirm('Distribuir produtos automaticamente nas listas de contagem?')) return;
    setActionLoading('distribute');
    try {
      await inventoryService.distribuirProdutos(inventoryId);
      onReload();
      toast.success('Produtos distribuidos nas listas.');
    } catch {
      toast.error('Erro ao distribuir produtos.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleLiberar(listId: string) {
    if (!confirm('Liberar esta lista para contagem?')) return;
    setActionLoading(listId);
    try {
      await countingListService.liberar(listId);
      onReload();
      toast.success('Lista liberada para contagem.');
    } catch {
      toast.error('Erro ao liberar lista.');
    } finally {
      setActionLoading(null);
      setActionMenuId(null);
    }
  }

  async function handleFinalizarCiclo(listId: string) {
    if (!confirm('Finalizar o ciclo atual desta lista?')) return;
    setActionLoading(listId);
    try {
      await countingListService.finalizarCiclo(listId);
      onReload();
      toast.success('Ciclo finalizado.');
    } catch {
      toast.error('Erro ao finalizar ciclo.');
    } finally {
      setActionLoading(null);
      setActionMenuId(null);
    }
  }

  async function handleEncerrar(listId: string) {
    if (!confirm('Encerrar esta lista de contagem? Nao sera possivel reabrir.')) return;
    setActionLoading(listId);
    try {
      await countingListService.finalizar(listId);
      onReload();
      toast.success('Lista encerrada.');
    } catch {
      toast.error('Erro ao encerrar lista.');
    } finally {
      setActionLoading(null);
      setActionMenuId(null);
    }
  }

  async function handleExcluir(listId: string, listName: string) {
    if (!confirm(`Excluir a lista "${listName}"?`)) return;
    setActionLoading(listId);
    try {
      await countingListService.excluir(listId);
      onReload();
      toast.success('Lista excluida.');
    } catch {
      toast.error('Erro ao excluir lista.');
    } finally {
      setActionLoading(null);
      setActionMenuId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ListStatus | '')}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos os Status</option>
          <option value="PREPARACAO">Preparacao</option>
          <option value="LIBERADA">Liberada</option>
          <option value="EM_CONTAGEM">Em Contagem</option>
          <option value="ENCERRADA">Encerrada</option>
        </select>

        <div className="flex-1" />

        {canCreate && (
          <>
            <button
              onClick={handleDistribuir}
              disabled={actionLoading === 'distribute'}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              {actionLoading === 'distribute' ? 'Distribuindo...' : 'Distribuir Produtos'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
            >
              <Plus className="w-4 h-4" />
              Nova Lista
            </button>
          </>
        )}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">
            {listas.length === 0
              ? 'Nenhuma lista de contagem criada.'
              : 'Nenhuma lista encontrada com este filtro.'}
          </p>
          {listas.length === 0 && canCreate && (
            <p className="text-slate-400 text-xs mt-1">
              Clique em "Nova Lista" para criar uma lista de contagem.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Nome</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Ciclo</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Status</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Contadores</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Itens</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Criado em</th>
                <th className="text-right py-2.5 px-4 font-medium text-slate-600 w-20">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lista) => {
                const lsc = listStatusConfig[lista.list_status] || listStatusConfig.PREPARACAO;
                const isLoading = actionLoading === lista.id;
                const menuOpen = actionMenuId === lista.id;

                return (
                  <tr key={lista.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <button onClick={() => setDetalheLista(lista)} className="font-medium text-capul-600 hover:underline text-left">
                        {lista.list_name}
                      </button>
                      {lista.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{lista.description}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cycleBadgeColor(lista.current_cycle)}`}>
                        {cycleLabel(lista.current_cycle)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lsc.color}`}>
                        {lsc.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {lista.counter_cycle_1 && <div>C1: {lista.counter_cycle_1}</div>}
                        {lista.counter_cycle_2 && <div>C2: {lista.counter_cycle_2}</div>}
                        {lista.counter_cycle_3 && <div>C3: {lista.counter_cycle_3}</div>}
                        {!lista.counter_cycle_1 && !lista.counter_cycle_2 && !lista.counter_cycle_3 && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      <span className="font-medium">{lista.counted_items ?? 0}</span>
                      <span className="text-slate-400">/{lista.total_items ?? 0}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs">
                      {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isLoading ? (
                        <span className="text-xs text-slate-400">Aguarde...</span>
                      ) : (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuId(menuOpen ? null : lista.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {menuOpen && (
                            <>
                              {/* Overlay para fechar menu */}
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActionMenuId(null)}
                              />
                              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                                {/* Ver Detalhes — sempre disponivel */}
                                <button
                                  onClick={() => { setActionMenuId(null); setDetalheLista(lista); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Eye className="w-4 h-4" />
                                  Ver Detalhes
                                </button>

                                {/* Liberar — apenas PREPARACAO */}
                                {lista.list_status === 'PREPARACAO' && (
                                  <button
                                    onClick={() => handleLiberar(lista.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                                  >
                                    <Unlock className="w-4 h-4" />
                                    Liberar para Contagem
                                  </button>
                                )}

                                {/* Finalizar Ciclo — apenas EM_CONTAGEM */}
                                {(lista.list_status === 'LIBERADA' || lista.list_status === 'EM_CONTAGEM') && (
                                  <button
                                    onClick={() => handleFinalizarCiclo(lista.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Finalizar Ciclo
                                  </button>
                                )}

                                {/* Encerrar — LIBERADA ou EM_CONTAGEM */}
                                {lista.list_status !== 'ENCERRADA' && lista.list_status !== 'PREPARACAO' && (
                                  <button
                                    onClick={() => handleEncerrar(lista.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50"
                                  >
                                    <Lock className="w-4 h-4" />
                                    Encerrar Lista
                                  </button>
                                )}

                                {/* Excluir — apenas PREPARACAO */}
                                {lista.list_status === 'PREPARACAO' && (
                                  <>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                      onClick={() => handleExcluir(lista.id, lista.list_name)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Excluir
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumo */}
      {listas.length > 0 && (
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Total: {listas.length} lista{listas.length !== 1 ? 's' : ''}</span>
          <span>Preparacao: {listas.filter((l) => l.list_status === 'PREPARACAO').length}</span>
          <span>Em Contagem: {listas.filter((l) => l.list_status === 'LIBERADA' || l.list_status === 'EM_CONTAGEM').length}</span>
          <span>Encerradas: {listas.filter((l) => l.list_status === 'ENCERRADA').length}</span>
        </div>
      )}

      {/* Modal criar lista */}
      {showCreateModal && (
        <CriarListaModal
          inventoryId={inventoryId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); onReload(); }}
        />
      )}

      {/* Modal detalhe lista */}
      {detalheLista && (
        <ListaDetalheModal
          lista={detalheLista}
          onClose={() => setDetalheLista(null)}
        />
      )}
    </div>
  );
}

// === Tab Placeholder ===

function TabPlaceholder({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p className="text-slate-500 text-sm">{text}</p>
    </div>
  );
}
