import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { countingListService } from '../../services/counting-list.service';
import { CriarListaModal } from './components/CriarListaModal';
import { AddProductsModal } from './components/AddProductsModal';
import { ListaDetalheModal } from './components/ListaDetalheModal';
import { AtribuirProdutosModal } from './components/AtribuirProdutosModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TabAnalise } from './components/TabAnalise';
import { TabVisaoGeral } from './components/TabVisaoGeral';
import { cycleBadgeColor, cycleLabel } from '../../utils/cycles';
import { downloadCSV } from '../../utils/csv';
import { ExportDropdown } from '../../components/ExportDropdown';
import { downloadExcel, printTable } from '../../utils/export';
import {
  ArrowLeft,
  LayoutDashboard,
  ListChecks,
  BarChart2,
  Trash2,
  Package,
  Plus,
  Eye,
  Unlock,
  CheckCircle2,
  Lock,
  UserCog,
  Loader2,
  Send,
  ArrowLeftRight,
  ShieldCheck,
  ScanLine,
} from 'lucide-react';
import { PageSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/ErrorState';
import { useToast } from '../../contexts/ToastContext';
import type {
  InventoryList,
  InventoryItem,
  CountingList,
  CountingListCreate,
  ItemStatus,
  ListStatus,
} from '../../types';

const listStatusConfig: Record<string, { label: string; color: string }> = {
  PREPARACAO: { label: 'Preparacao', color: 'bg-slate-100 text-slate-700' },
  ABERTA: { label: 'Aberta', color: 'bg-sky-100 text-sky-700' },
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

type Tab = 'visao-geral' | 'itens' | 'listas' | 'analise';

export function InventarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [itens, setItens] = useState<InventoryItem[]>([]);
  const [listas, setListas] = useState<CountingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('visao-geral');
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleDeleteConfirmed() {
    if (!id) return;
    setShowDeleteConfirm(false);
    try {
      await inventoryService.excluir(id);
      toast.success('Inventario excluido.');
      navigate('/inventario/inventarios');
    } catch {
      toast.error('Erro ao excluir inventario.');
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

  // Derivar ciclo atual e status real a partir das counting lists (inventory_lists pode estar desatualizado)
  const realCycle = listas.length > 0
    ? Math.max(...listas.map((l) => l.current_cycle || 1))
    : inventario.current_cycle;

  const allListsClosed = listas.length > 0 && listas.every((l) => l.list_status === 'ENCERRADA');
  const anyListCounting = listas.some((l) => l.list_status === 'EM_CONTAGEM');
  const derivedListStatus = allListsClosed
    ? 'ENCERRADA'
    : anyListCounting
      ? 'EM_CONTAGEM'
      : listas.length > 0
        ? listas[0].list_status
        : inventario.list_status;
  const lsc = listStatusConfig[derivedListStatus] || listStatusConfig.PREPARACAO;

  const isEfetivado = inventario.status === 'CLOSED';

  // Labels amigáveis para o status do inventário
  const statusLabel: Record<string, string> = {
    DRAFT: 'Em Preparacao',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluido',
    CLOSED: 'Efetivado',
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'visao-geral', label: 'Visao Geral', icon: LayoutDashboard },
    { key: 'itens', label: `Itens (${itemsTotal})`, icon: Package },
    { key: 'listas', label: `Listas (${listas.length})`, icon: ListChecks },
    { key: 'analise', label: 'Analise', icon: BarChart2 },
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

        {/* Banner Efetivado */}
        {isEfetivado && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Inventario Efetivado</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Este inventario foi efetivado e integrado ao Protheus. Nao e possivel realizar alteracoes.
                Voce pode visualizar relatorios, comparar com outros inventarios e exportar dados normalmente.
              </p>
            </div>
          </div>
        )}

        {/* Cabecalho info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">{inventario.name}</h2>
                {isEfetivado ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    Efetivado
                  </span>
                ) : (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${lsc.color}`}>
                    {lsc.label}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  {statusLabel[inventario.status] ?? inventario.status}
                </span>
              </div>
              {inventario.description && (
                <p className="text-sm text-slate-500">{inventario.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {(inventario.status === 'COMPLETED' || isEfetivado) && (
                <Link
                  to={`/inventario/comparacao?inv_a=${id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 text-purple-600 text-sm rounded-lg hover:bg-purple-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Comparar
                </Link>
              )}
              {(inventario.status === 'COMPLETED' || isEfetivado) && (
                <Link
                  to={`/inventario/sincronizacao`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Send className="w-4 h-4" />
                  Integracao Protheus
                </Link>
              )}
              {inventario.status === 'DRAFT' && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
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
              <p className="text-lg font-bold text-slate-800">{realCycle}o</p>
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
        {activeTab === 'visao-geral' && (
          <TabVisaoGeral
            inventario={inventario}
            itensTotal={itemsTotal}
            listas={listas}
            onNavigateTab={setActiveTab}
            onAddProducts={() => setShowAddProducts(true)}
            onReload={() => { reloadItens(); reloadListas(); reloadInventario(); }}
          />
        )}
        {activeTab === 'itens' && (
          <TabItens
            itens={itens}
            page={itemsPage}
            totalPages={itemsTotalPages}
            statusFilter={itemStatusFilter}
            inventoryStatus={inventario.status}
            inventoryId={id!}
            onPageChange={setItemsPage}
            onStatusChange={(s) => { setItemStatusFilter(s); setItemsPage(1); }}
            onAddProducts={() => setShowAddProducts(true)}
            onReloadItens={reloadItens}
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

        {/* Modal adicionar produtos */}
        {showAddProducts && (
          <AddProductsModal
            inventoryId={id!}
            warehouse={inventario?.warehouse}
            onClose={() => setShowAddProducts(false)}
            onAdded={() => { reloadItens(); reloadInventario(); }}
          />
        )}

        {/* Confirm dialog exclusao inventario */}
        <ConfirmDialog
          open={showDeleteConfirm}
          title="Excluir Inventario"
          description={`O inventario "${inventario.name}" sera removido permanentemente. Esta acao nao pode ser desfeita.`}
          details={[`Armazem: ${inventario.warehouse}`]}
          variant="danger"
          confirmLabel="Excluir"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    </>
  );
}

// === Tab Itens ===

function TabItens({ itens, page, totalPages, statusFilter, inventoryStatus, inventoryId, onPageChange, onStatusChange, onAddProducts, onReloadItens }: {
  itens: InventoryItem[];
  page: number;
  totalPages: number;
  statusFilter: ItemStatus | '';
  inventoryStatus: string;
  inventoryId: string;
  onPageChange: (p: number) => void;
  onStatusChange: (s: ItemStatus | '') => void;
  onAddProducts: () => void;
  onReloadItens: () => void;
}) {
  const toast = useToast();
  const canAdd = inventoryStatus === 'DRAFT' || inventoryStatus === 'IN_PROGRESS';
  const [pendingZeros, setPendingZeros] = useState(0);
  const [confirmingZeros, setConfirmingZeros] = useState(false);
  const [showConfirmZeros, setShowConfirmZeros] = useState(false);

  // Check pending zeros
  useEffect(() => {
    inventoryService.buscarZerosPendentes(inventoryId)
      .then((res) => setPendingZeros(res.data?.pending_count ?? 0))
      .catch(() => {});
  }, [inventoryId, itens]);

  async function handleConfirmZeros() {
    setShowConfirmZeros(false);
    setConfirmingZeros(true);
    try {
      const res = await inventoryService.confirmarZeros(inventoryId);
      toast.success(res.message || `${res.total_confirmed} itens confirmados.`);
      setPendingZeros(0);
      onReloadItens();
    } catch {
      toast.error('Erro ao confirmar itens com saldo zero.');
    } finally {
      setConfirmingZeros(false);
    }
  }

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

        {pendingZeros > 0 && (
          <button
            onClick={() => setShowConfirmZeros(true)}
            disabled={confirmingZeros}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
          >
            {confirmingZeros ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Confirmar Zeros
            <span className="px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-800 text-xs font-bold">
              {pendingZeros}
            </span>
          </button>
        )}

        <div className="flex-1" />

        {itens.length > 0 && (
          <ExportDropdown
            onCSV={() => {
              const header = 'Seq;Codigo;Descricao;Local;Saldo Estoque;Entregas Post;Grupo;Grupo Inv;Categoria;Subcategoria;Segmento;Local 1;Local 2;Local 3;Lote;Esperado;Contado;Variacao;Status\n';
              const rows = itens.map((item) =>
                `${item.sequence};${item.product_code};${item.product_name};${item.warehouse || ''};${(item.product_estoque ?? 0).toFixed(2)};${(item.product_entregas_post ?? 0).toFixed(2)};${item.product_grupo || ''};${item.product_grupo_inv || ''};${item.product_categoria || ''};${item.product_subcategoria || ''};${item.product_segmento || ''};${item.product_local1 || ''};${item.product_local2 || ''};${item.product_local3 || ''};${item.product_lote || ''};${item.expected_quantity.toFixed(2)};${item.counted_quantity > 0 ? item.counted_quantity.toFixed(2) : ''};${item.status !== 'PENDING' ? item.variance.toFixed(2) : ''};${item.status}`,
              );
              downloadCSV(`itens_inventario_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
            }}
            onExcel={() => {
              downloadExcel(`itens_inventario_${new Date().toISOString().slice(0, 10)}`, 'Itens',
                ['Seq', 'Codigo', 'Descricao', 'Local', 'Saldo Estoque', 'Entregas Post', 'Grupo', 'Grupo Inv', 'Categoria', 'Subcategoria', 'Segmento', 'Local 1', 'Local 2', 'Local 3', 'Lote', 'Esperado', 'Contado', 'Variacao', 'Status'],
                itens.map((item) => [item.sequence, item.product_code, item.product_name, item.warehouse || '', item.product_estoque ?? 0, item.product_entregas_post ?? 0, item.product_grupo || '', item.product_grupo_inv || '', item.product_categoria || '', item.product_subcategoria || '', item.product_segmento || '', item.product_local1 || '', item.product_local2 || '', item.product_local3 || '', item.product_lote || '', item.expected_quantity, item.counted_quantity > 0 ? item.counted_quantity : null, item.status !== 'PENDING' ? item.variance : null, item.status]),
              );
            }}
            onPrint={() => {
              printTable('Itens do Inventario',
                ['Seq', 'Codigo', 'Descricao', 'Saldo', 'Esperado', 'Contado', 'Variacao', 'Status'],
                itens.map((item) => [item.sequence, item.product_code, item.product_name, (item.product_estoque ?? 0).toFixed(2), item.expected_quantity.toFixed(2), item.counted_quantity > 0 ? item.counted_quantity.toFixed(2) : '', item.status !== 'PENDING' ? item.variance.toFixed(2) : '', item.status]),
              );
            }}
          />
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
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] w-10">SEQ</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Codigo</th>
                <th className="text-left py-2 px-2 font-medium text-slate-600 text-[11px]">Descricao</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Arm.</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Localizacao</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Saldo Est.</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Ent. Post.</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Grupo</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Grp. Inv</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Categoria</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Subcateg.</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Segmento</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 1</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 2</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Loc 3</th>
                <th className="text-center py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Lote</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Esperado</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Contado</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600 text-[11px] whitespace-nowrap">Variacao</th>
                <th className="text-left py-2 px-1 font-medium text-slate-600 text-[11px] whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => {
                const isc = itemStatusConfig[item.status] || itemStatusConfig.PENDING;
                const hasVariance = item.variance !== 0 && item.status !== 'PENDING';
                const loteDisplay = item.product_lote === 'L' ? 'Sim' : item.product_lote === 'S' ? 'Serie' : '';
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 ${
                      hasVariance ? 'bg-amber-50' : item.status === 'APPROVED' ? 'bg-green-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-1 text-center text-[11px] tabular-nums text-slate-400">{item.sequence}</td>
                    <td className="py-2 px-2 font-mono text-[11px] text-slate-700 whitespace-nowrap">{item.product_code}</td>
                    <td className="py-2 px-2 text-[11px] text-slate-800 truncate max-w-[180px]" title={item.product_name}>{item.product_name}</td>
                    <td className="py-2 px-1 text-center text-[11px] font-mono text-slate-600">{item.warehouse || '—'}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_location || '—'}</td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {(item.product_estoque ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {(item.product_entregas_post ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_grupo || '—'}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_grupo_inv || '—'}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_categoria || '—'}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_subcategoria || '—'}</td>
                    <td className="py-2 px-1 text-[11px] text-slate-600">{item.product_segmento || '—'}</td>
                    <td className="py-2 px-1 text-center text-[11px] font-mono text-slate-600">{item.product_local1 || '—'}</td>
                    <td className="py-2 px-1 text-center text-[11px] font-mono text-slate-600">{item.product_local2 || '—'}</td>
                    <td className="py-2 px-1 text-center text-[11px] font-mono text-slate-600">{item.product_local3 || '—'}</td>
                    <td className="py-2 px-1 text-center text-[11px] text-slate-600">{loteDisplay || '—'}</td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">{item.expected_quantity.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono tabular-nums font-medium text-slate-800 whitespace-nowrap">
                      {item.counted_quantity > 0 ? item.counted_quantity.toFixed(2) : '—'}
                    </td>
                    <td className={`py-2 px-2 text-right text-[11px] font-mono tabular-nums font-medium whitespace-nowrap ${
                      item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {item.status !== 'PENDING' ? (
                        <>
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                          {item.variance_percentage !== 0 && (
                            <span className="text-[10px] ml-0.5">({item.variance_percentage.toFixed(1)}%)</span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${isc.color}`}>
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

      <ConfirmDialog
        open={showConfirmZeros}
        title="Confirmar Itens com Saldo Zero"
        description={`Confirmar automaticamente ${pendingZeros} produto${pendingZeros !== 1 ? 's' : ''} com quantidade esperada = 0?`}
        details={['Os itens serao marcados como ZERO_CONFIRMED', 'Contagens zeradas serao registradas automaticamente']}
        variant="info"
        confirmLabel="Confirmar Zeros"
        onConfirm={handleConfirmZeros}
        onCancel={() => setShowConfirmZeros(false)}
      />
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
  const navigate = useNavigate();
  const toast = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detalheLista, setDetalheLista] = useState<CountingList | null>(null);
  const [statusFilter, setStatusFilter] = useState<ListStatus | ''>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [atribuirLista, setAtribuirLista] = useState<CountingList | null>(null);
  const [changeCounterList, setChangeCounterList] = useState<CountingList | null>(null);
  const [newCounterId, setNewCounterId] = useState('');
  const [availableCounters, setAvailableCounters] = useState<{ user_id: string; full_name: string; username: string }[]>([]);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    details?: string[];
    variant: 'warning' | 'danger' | 'info';
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Mapa de UUID → nome para exibir nomes dos contadores
  const [counterNames, setCounterNames] = useState<Record<string, string>>({});

  useEffect(() => {
    countingListService.listarContadoresDisponiveis(inventoryId)
      .then((counters) => {
        const map: Record<string, string> = {};
        counters.forEach((c) => {
          map[c.user_id] = c.full_name || c.username;
        });
        setCounterNames(map);
        setAvailableCounters(counters.map((c) => ({ user_id: c.user_id, full_name: c.full_name, username: c.username })));
      })
      .catch(() => {});
  }, [inventoryId]);

  const filtered = statusFilter
    ? listas.filter((l) => l.list_status === statusFilter)
    : listas;

  const canCreate = inventoryStatus !== 'CLOSED';

  function handleLiberar(listId: string) {
    const lista = listas.find((l) => l.id === listId);
    setConfirmDialog({
      title: 'Liberar Lista para Contagem',
      description: 'Ao liberar, os contadores atribuidos poderao iniciar a contagem dos produtos desta lista.',
      details: lista ? [`Lista: ${lista.list_name}`, `Itens: ${lista.total_items ?? 0} produtos`] : undefined,
      variant: 'info',
      confirmLabel: 'Liberar',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(listId);
        try {
          await countingListService.liberar(listId);
          onReload();
          toast.success('Lista liberada para contagem.');
        } catch (err: unknown) {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(detail || 'Erro ao liberar lista.');
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  function handleFinalizarCiclo(listId: string) {
    const lista = listas.find((l) => l.id === listId);
    setConfirmDialog({
      title: 'Finalizar Ciclo de Contagem',
      description: 'O ciclo atual sera encerrado. Produtos com divergencia poderao ser recontados no proximo ciclo.',
      details: lista ? [`Lista: ${lista.list_name}`, `Ciclo atual: ${lista.current_cycle}o`] : undefined,
      variant: 'warning',
      confirmLabel: 'Finalizar Ciclo',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(listId);
        try {
          const result = await countingListService.finalizarCiclo(listId) as { auto_closed?: boolean; message?: string };
          onReload();
          if (result?.auto_closed) {
            toast.success(result.message || 'Lista encerrada automaticamente (sem divergencias).');
          } else {
            toast.success(result?.message || 'Ciclo finalizado com sucesso.');
          }
        } catch (err: unknown) {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(detail || 'Erro ao finalizar ciclo.');
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  function handleEncerrar(listId: string) {
    const lista = listas.find((l) => l.id === listId);
    setConfirmDialog({
      title: 'Encerrar Lista de Contagem',
      description: 'Esta acao e irreversivel. A lista sera encerrada permanentemente e nao podera ser reaberta para novas contagens.',
      details: lista ? [`Lista: ${lista.list_name}`] : undefined,
      variant: 'danger',
      confirmLabel: 'Encerrar Lista',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(listId);
        try {
          await countingListService.finalizar(listId);
          onReload();
          toast.success('Lista encerrada.');
        } catch (err: unknown) {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(detail || 'Erro ao encerrar lista.');
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  function handleExcluir(listId: string, listName: string) {
    setConfirmDialog({
      title: 'Excluir Lista de Contagem',
      description: 'A lista e todos os seus itens serao removidos permanentemente. Esta acao nao pode ser desfeita.',
      details: [`Lista: ${listName}`],
      variant: 'danger',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(listId);
        try {
          await countingListService.excluir(listId);
          onReload();
          toast.success('Lista excluida.');
        } catch (err: unknown) {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          toast.error(detail || 'Erro ao excluir lista.');
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  function handleOpenChangeCounter(lista: CountingList) {
    const cycleKey = `counter_cycle_${lista.current_cycle}` as keyof CountingList;
    setNewCounterId((lista[cycleKey] as string) || '');
    setChangeCounterList(lista);
  }

  async function handleSaveCounter() {
    if (!changeCounterList || !newCounterId) return;
    setActionLoading(changeCounterList.id);
    try {
      const cycleKey = `counter_cycle_${changeCounterList.current_cycle}`;
      await countingListService.atualizar(changeCounterList.id, {
        [cycleKey]: newCounterId,
      } as Partial<CountingListCreate>);
      onReload();
      toast.success(`Contador do ${changeCounterList.current_cycle}o ciclo atualizado.`);
      setChangeCounterList(null);
      setNewCounterId('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao alterar contador.');
    } finally {
      setActionLoading(null);
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
          <option value="ABERTA">Aberta</option>
          <option value="LIBERADA">Liberada</option>
          <option value="EM_CONTAGEM">Em Contagem</option>
          <option value="ENCERRADA">Encerrada</option>
        </select>

        <div className="flex-1" />

        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
          >
            <Plus className="w-4 h-4" />
            Nova Lista
          </button>
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
        <div className="bg-white rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Nome</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600 w-20">Ciclo</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600 w-24">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-600">Contadores</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600 w-16">Itens</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600 w-24">Criado em</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-600">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lista) => {
                const lsc = listStatusConfig[lista.list_status] || listStatusConfig.PREPARACAO;
                const isLoading = actionLoading === lista.id;
                const isPrepOrAberta = lista.list_status === 'PREPARACAO' || lista.list_status === 'ABERTA';

                return (
                  <tr key={lista.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button onClick={() => setDetalheLista(lista)} className="font-medium text-capul-600 hover:underline text-left">
                        {lista.list_name}
                      </button>
                      {lista.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{lista.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cycleBadgeColor(lista.current_cycle)}`}>
                        {cycleLabel(lista.current_cycle)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lsc.color}`}>
                        {lsc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {lista.counter_cycle_1 && <div>C1: {counterNames[lista.counter_cycle_1] || lista.counter_cycle_1.slice(0, 8)}</div>}
                        {lista.counter_cycle_2 && <div>C2: {counterNames[lista.counter_cycle_2] || lista.counter_cycle_2.slice(0, 8)}</div>}
                        {lista.counter_cycle_3 && <div>C3: {counterNames[lista.counter_cycle_3] || lista.counter_cycle_3.slice(0, 8)}</div>}
                        {!lista.counter_cycle_1 && !lista.counter_cycle_2 && !lista.counter_cycle_3 && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      <span className="font-medium">{lista.counted_items ?? 0}</span>
                      <span className="text-slate-400">/{lista.total_items ?? 0}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 text-xs">
                      {new Date(lista.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-3">
                      {isLoading ? (
                        <span className="text-xs text-slate-400">Aguarde...</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            onClick={() => setDetalheLista(lista)}
                            title="Ver Detalhes"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detalhes
                          </button>

                          {lista.list_status === 'PREPARACAO' && (
                            <button
                              onClick={() => setAtribuirLista(lista)}
                              title="Adicionar Produtos"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                            >
                              <Package className="w-3.5 h-3.5" />
                              Produtos
                            </button>
                          )}

                          {lista.list_status === 'ABERTA' && (
                            <button
                              onClick={() => handleOpenChangeCounter(lista)}
                              title="Alterar Contador"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                              Contador
                            </button>
                          )}

                          {isPrepOrAberta && (lista.total_items ?? 0) > 0 && (
                            <button
                              onClick={() => handleLiberar(lista.id)}
                              title="Liberar para Contagem"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              Liberar
                            </button>
                          )}

                          {(lista.list_status === 'LIBERADA' || lista.list_status === 'EM_CONTAGEM') && (
                            <button
                              onClick={() => navigate(`/inventario/contagem/${inventoryId}/desktop`)}
                              title="Abrir tela de contagem"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-capul-600 rounded-md hover:bg-capul-700 transition-colors"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              Contar
                            </button>
                          )}

                          {(lista.list_status === 'LIBERADA' || lista.list_status === 'EM_CONTAGEM') && (
                            lista.current_cycle >= 3 ? (
                              <button
                                onClick={() => handleEncerrar(lista.id)}
                                title="Encerrar Lista (ultimo ciclo)"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                Encerrar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleFinalizarCiclo(lista.id)}
                                title="Finalizar Ciclo"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Fin. Ciclo
                              </button>
                            )
                          )}

                          {lista.list_status !== 'ENCERRADA' && lista.list_status !== 'PREPARACAO' && lista.current_cycle < 3 && (
                            <button
                              onClick={() => handleEncerrar(lista.id)}
                              title="Encerrar Lista"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Encerrar
                            </button>
                          )}

                          {isPrepOrAberta && (
                            <button
                              onClick={() => handleExcluir(lista.id, lista.list_name)}
                              title="Excluir"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
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

      {/* Modal atribuir produtos a lista */}
      {atribuirLista && (
        <AtribuirProdutosModal
          inventoryId={inventoryId}
          listId={atribuirLista.id}
          listName={atribuirLista.list_name}
          onClose={() => setAtribuirLista(null)}
          onAdded={() => onReload()}
        />
      )}

      {/* Modal alterar contador */}
      {changeCounterList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Alterar Contador</h3>
              <p className="text-sm text-slate-500 mt-1">
                Selecione o contador para o <strong>{changeCounterList.current_cycle}o ciclo</strong> da lista <strong>{changeCounterList.list_name}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contador do {changeCounterList.current_cycle}o Ciclo
              </label>
              <select
                value={newCounterId}
                onChange={(e) => setNewCounterId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
              >
                <option value="">Selecione um contador...</option>
                {availableCounters.map((c) => (
                  <option key={c.user_id} value={c.user_id}>
                    {c.full_name || c.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Info dos outros ciclos */}
            <div className="text-xs text-slate-500 space-y-1 bg-slate-50 rounded-lg p-3">
              {changeCounterList.counter_cycle_1 && (
                <div>C1: <strong>{counterNames[changeCounterList.counter_cycle_1] || changeCounterList.counter_cycle_1.slice(0, 8)}</strong></div>
              )}
              {changeCounterList.counter_cycle_2 && changeCounterList.current_cycle !== 2 && (
                <div>C2: <strong>{counterNames[changeCounterList.counter_cycle_2] || changeCounterList.counter_cycle_2.slice(0, 8)}</strong></div>
              )}
              {changeCounterList.counter_cycle_3 && changeCounterList.current_cycle !== 3 && (
                <div>C3: <strong>{counterNames[changeCounterList.counter_cycle_3] || changeCounterList.counter_cycle_3.slice(0, 8)}</strong></div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setChangeCounterList(null); setNewCounterId(''); }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCounter}
                disabled={!newCounterId || actionLoading === changeCounterList.id}
                className="px-4 py-2 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
              >
                {actionLoading === changeCounterList.id ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog generico (listas) */}
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description}
        details={confirmDialog?.details}
        variant={confirmDialog?.variant ?? 'warning'}
        confirmLabel={confirmDialog?.confirmLabel ?? 'Confirmar'}
        onConfirm={() => { if (confirmDialog?.onConfirm) confirmDialog.onConfirm(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
