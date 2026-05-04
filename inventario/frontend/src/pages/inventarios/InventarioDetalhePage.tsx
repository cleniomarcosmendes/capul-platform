import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/inventory.service';
import { countingListService } from '../../services/counting-list.service';
import { CriarListaModal } from './components/CriarListaModal';
import { AddProductsModal } from './components/AddProductsModal';
import { ListaDetalheModal } from './components/ListaDetalheModal';
import { AtribuirProdutosModal } from './components/AtribuirProdutosModal';
import { DevolverListaModal } from './components/DevolverListaModal';
import { HistoricoHandoffModal } from './components/HistoricoHandoffModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EtapaStepper, ETAPAS_INVENTARIO } from '../../components/EtapaStepper';
import { TabAnalise } from './components/TabAnalise';
import { TabVisaoGeral } from './components/TabVisaoGeral';
import { cycleBadgeColor, cycleLabel } from '../../utils/cycles';
import { downloadCSV } from '../../utils/csv';
import { ExportDropdown } from '../../components/ExportDropdown';
import { downloadExcel, printTable } from '../../utils/export';
import { useTableSort } from '../../hooks/useTableSort';
import { SortableTh } from '../../components/SortableTh';
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
  RotateCcw,
  Clock,
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
  AGUARDANDO_REVISAO: { label: 'Aguarda revisao', color: 'bg-purple-100 text-purple-700' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-green-100 text-green-700' },
};

// Onda 3 — etapa derivada do ciclo de vida do inventario
const etapaConfig: Record<string, { label: string; color: string }> = {
  EM_PREPARACAO: { label: 'Em Preparacao', color: 'bg-slate-100 text-slate-700' },
  EM_CONTAGEM:   { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700' },
  ENCERRADO:     { label: 'Encerrado', color: 'bg-blue-100 text-blue-700' },
  ANALISADO:     { label: 'Analisado', color: 'bg-purple-100 text-purple-700' },
  INTEGRADO:     { label: 'Integrado', color: 'bg-emerald-100 text-emerald-700' },
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
  const { inventarioRole } = useAuth();
  const isStaff = inventarioRole === 'ADMIN' || inventarioRole === 'SUPERVISOR';
  // Fallback: OPERATOR só acessa Visao Geral — força fallback se cair em outra
  useEffect(() => {
    if (!isStaff && activeTab !== 'visao-geral') {
      setActiveTab('visao-geral');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);
  const [inventario, setInventario] = useState<InventoryList | null>(null);
  const [itens, setItens] = useState<InventoryItem[]>([]);
  const [listas, setListas] = useState<CountingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('Erro ao carregar inventario.');
  const [errorIsForbidden, setErrorIsForbidden] = useState(false);
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
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        if (status === 403) {
          setErrorIsForbidden(true);
          setErrorMessage(detail || 'Você não tem permissão para acessar este inventário.');
        } else if (status === 404) {
          setErrorMessage('Inventário não encontrado.');
        } else {
          setErrorMessage(detail || 'Erro ao carregar inventário. Verifique sua conexão e tente novamente.');
        }
        setError(true);
      })
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
  const [showFinalizarInventarioConfirm, setShowFinalizarInventarioConfirm] = useState(false);
  const [finalizarInventarioLoading, setFinalizarInventarioLoading] = useState(false);
  const [showMarcarAnalisadoConfirm, setShowMarcarAnalisadoConfirm] = useState(false);
  const [marcarAnalisadoLoading, setMarcarAnalisadoLoading] = useState(false);

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

  async function handleFinalizarInventarioConfirmed() {
    if (!id) return;
    setShowFinalizarInventarioConfirm(false);
    setFinalizarInventarioLoading(true);
    try {
      await inventoryService.finalizarInventario(id);
      toast.success('Inventario encerrado. Acesse Análise para revisar divergências antes de enviar ao Protheus.');
      reloadInventario();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao encerrar inventario.');
    } finally {
      setFinalizarInventarioLoading(false);
    }
  }

  async function handleMarcarAnalisadoConfirmed() {
    if (!id) return;
    setShowMarcarAnalisadoConfirm(false);
    setMarcarAnalisadoLoading(true);
    try {
      await inventoryService.marcarAnalisado(id);
      toast.success('Analise marcada como concluida. Pode enviar ao Protheus.');
      reloadInventario();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao marcar analise como concluida.');
    } finally {
      setMarcarAnalisadoLoading(false);
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
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          {errorIsForbidden ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3">
              <h2 className="text-lg font-bold text-amber-900">Acesso restrito</h2>
              <p className="text-sm text-amber-800">{errorMessage}</p>
              <p className="text-xs text-amber-700">
                Esta tela mostra dados completos do inventário (saldos do sistema, divergências) que ficam ocultos
                ao contador para preservar a contagem cega. Acesse <strong>Contagem</strong> no menu lateral para
                ver suas listas atribuídas.
              </p>
              <button
                onClick={() => navigate('/inventario/contagem')}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Ir para Minhas Listas de Contagem
              </button>
            </div>
          ) : (
            <ErrorState message={errorMessage} onRetry={() => window.location.reload()} />
          )}
        </div>
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
  const isEfetivado = inventario.status === 'CLOSED';

  // Itens/Listas/Análise expõem saldo do sistema, divergências e contagens de outros ciclos —
  // restritas a SUPERVISOR/ADMIN para preservar a contagem cega do OPERATOR.
  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'visao-geral', label: 'Visao Geral', icon: LayoutDashboard },
    ...(isStaff
      ? [
          { key: 'itens' as Tab, label: `Itens (${itemsTotal})`, icon: Package },
          { key: 'listas' as Tab, label: `Listas (${listas.length})`, icon: ListChecks },
          { key: 'analise' as Tab, label: 'Analise', icon: BarChart2 },
        ]
      : []),
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

        {/* Banner: todas as listas encerradas, falta encerrar o inventario */}
        {!isEfetivado && allListsClosed && inventario.list_status !== 'ENCERRADA' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Todas as listas estao encerradas</p>
              <p className="text-xs text-green-700 mt-0.5">
                Encerre o inventario para liberar as etapas seguintes (Análise e Integração Protheus).
              </p>
            </div>
            <button
              onClick={() => setShowFinalizarInventarioConfirm(true)}
              disabled={finalizarInventarioLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
            >
              {finalizarInventarioLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Encerrar Inventario
            </button>
          </div>
        )}

        {/* Banner Onda 3: etapa ENCERRADO → próximo passo é Analisar */}
        {!isEfetivado && inventario.etapa_atual === 'ENCERRADO' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <BarChart2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">Inventario encerrado — proxima etapa: Analise</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Revise as divergencias na aba Analise (e, opcionalmente, compare com outros inventarios).
                Quando terminar, marque a analise como concluida para liberar o envio ao Protheus.
              </p>
            </div>
            <button
              onClick={() => setShowMarcarAnalisadoConfirm(true)}
              disabled={marcarAnalisadoLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
            >
              {marcarAnalisadoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Marcar Analise Concluida
            </button>
          </div>
        )}

        {/* Banner Onda 3: etapa ANALISADO → próximo passo é criar integração ao Protheus */}
        {!isEfetivado && inventario.etapa_atual === 'ANALISADO' && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
            <Send className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-800">Analise concluida — proxima etapa: Integracao com Protheus</p>
              <p className="text-xs text-purple-700 mt-0.5">
                O inventario esta pronto. Crie uma integracao (Simples ou Comparativa) para enviar ao Protheus.
              </p>
            </div>
            <Link
              to={`/inventario/integracoes/nova?inv_a=${inventario.id}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              Criar Integracao
            </Link>
          </div>
        )}

        {/* Cabecalho info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800">{inventario.name}</h2>
                {inventario.etapa_atual && etapaConfig[inventario.etapa_atual] && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${etapaConfig[inventario.etapa_atual].color}`}
                    title={inventario.proximo_passo ? `Proximo passo: ${inventario.proximo_passo}` : undefined}
                  >
                    {etapaConfig[inventario.etapa_atual].label}
                  </span>
                )}
                {inventario.proximo_passo && !isEfetivado && (
                  <span className="text-xs text-slate-500 italic">
                    → {inventario.proximo_passo}
                  </span>
                )}
              </div>
              {inventario.description && (
                <p className="text-sm text-slate-500">{inventario.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {(inventario.status === 'COMPLETED' || isEfetivado) && (
                <Link
                  to={`/inventario/divergencias?tab=historica&inv_a=${id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 text-purple-600 text-sm rounded-lg hover:bg-purple-50"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Comparar
                </Link>
              )}
              {(inventario.status === 'COMPLETED' || isEfetivado) && (
                <Link
                  to={isEfetivado ? '/inventario/integracoes' : `/inventario/integracoes/nova?inv_a=${inventario.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Send className="w-4 h-4" />
                  {isEfetivado ? 'Ver Integracoes' : 'Integracao Protheus'}
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

          {/* Stepper de etapas do inventário */}
          {inventario.etapa_atual && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <EtapaStepper steps={ETAPAS_INVENTARIO} currentStep={inventario.etapa_atual} />
            </div>
          )}

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
        {activeTab === 'itens' && isStaff && (
          <TabItens
            itens={itens}
            page={itemsPage}
            totalPages={itemsTotalPages}
            statusFilter={itemStatusFilter}
            inventoryStatus={inventario.status}
            inventoryId={id!}
            listas={listas}
            onPageChange={setItemsPage}
            onStatusChange={(s) => { setItemStatusFilter(s); setItemsPage(1); }}
            onAddProducts={() => setShowAddProducts(true)}
            onReloadItens={reloadItens}
          />
        )}
        {activeTab === 'listas' && isStaff && (
          <TabListas
            listas={listas}
            inventoryId={id!}
            inventoryStatus={inventario.status}
            onReload={() => { reloadListas(); reloadInventario(); }}
          />
        )}
        {activeTab === 'analise' && isStaff && <TabAnalise inventoryId={id!} listas={listas} />}

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

        {/* Confirm dialog encerrar inventario */}
        <ConfirmDialog
          open={showFinalizarInventarioConfirm}
          title="Encerrar Inventario"
          description="Apos encerrar, o inventario fica pronto para Análise e Integração Protheus. Esta acao consolida o resultado de todas as listas."
          details={[`Inventario: ${inventario.name}`, `Total de itens: ${inventario.total_items}`]}
          variant="info"
          confirmLabel="Encerrar Inventario"
          onConfirm={handleFinalizarInventarioConfirmed}
          onCancel={() => setShowFinalizarInventarioConfirm(false)}
        />

        {/* Confirm dialog marcar análise concluída */}
        <ConfirmDialog
          open={showMarcarAnalisadoConfirm}
          title="Marcar Analise Concluida"
          description="Voce confirma que revisou as divergencias e o inventario esta pronto para envio ao Protheus? O envio so e liberado apos esta marcacao."
          details={[`Inventario: ${inventario.name}`]}
          variant="info"
          confirmLabel="Marcar Concluida"
          onConfirm={handleMarcarAnalisadoConfirmed}
          onCancel={() => setShowMarcarAnalisadoConfirm(false)}
        />
      </div>
    </>
  );
}

// === Tab Itens ===

function TabItens({ itens, page, totalPages, statusFilter, inventoryStatus, inventoryId, listas, onPageChange, onStatusChange, onAddProducts, onReloadItens }: {
  itens: InventoryItem[];
  page: number;
  totalPages: number;
  statusFilter: ItemStatus | '';
  inventoryStatus: string;
  inventoryId: string;
  listas: CountingList[];
  onPageChange: (p: number) => void;
  onStatusChange: (s: ItemStatus | '') => void;
  onAddProducts: () => void;
  onReloadItens: () => void;
}) {
  const toast = useToast();
  const hasActiveList = listas.some((l) =>
    l.list_status === 'LIBERADA' || l.list_status === 'EM_CONTAGEM' || l.list_status === 'ENCERRADA'
  );
  const inventoryEditable = inventoryStatus === 'DRAFT' || inventoryStatus === 'IN_PROGRESS';
  const canAdd = inventoryEditable && !hasActiveList;
  const [pendingZeros, setPendingZeros] = useState(0);
  const [confirmingZeros, setConfirmingZeros] = useState(false);
  const { sortedRows, sortKey, sortDir, handleSort } = useTableSort<InventoryItem>(itens, null, null);
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

        {inventoryEditable && (
          canAdd ? (
            <button
              onClick={onAddProducts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produtos
            </button>
          ) : (
            <button
              disabled
              title="Nao e possivel adicionar produtos: existe lista de contagem liberada. Adicione produtos antes de liberar a primeira lista."
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-400 text-sm rounded-lg cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produtos
            </button>
          )
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
                <SortableTh label="SEQ" sortKey="sequence" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 w-10" />
                <SortableTh label="Codigo" sortKey="product_code" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Descricao" sortKey="product_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2" />
                <SortableTh label="Arm." sortKey="warehouse" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Localizacao" sortKey="product_local1" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Saldo Est." sortKey="product_estoque" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Ent. Post." sortKey="product_entregas_post" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Grupo" sortKey="product_grupo" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Grp. Inv" sortKey="product_grupo_inv" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Categoria" sortKey="product_categoria" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Subcateg." sortKey="product_subcategoria" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Segmento" sortKey="product_segmento" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Loc 1" sortKey="product_local1" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Loc 2" sortKey="product_local2" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Loc 3" sortKey="product_local3" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Lote" sortKey="product_lote" align="center" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
                <SortableTh label="Esperado" sortKey="expected_quantity" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Contado" sortKey="counted_quantity" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Variacao" sortKey="variance" align="right" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-2 whitespace-nowrap" />
                <SortableTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-[11px] font-medium py-2 px-1 whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((item) => {
                const wasCounted = (item.count_rounds ?? 0) > 0;
                // PENDING + já contou = divergência aguardando ciclo seguinte
                const isDivergent = item.status === 'PENDING' && wasCounted;
                const isc = isDivergent
                  ? { label: 'Divergente', color: 'bg-amber-100 text-amber-700' }
                  : (itemStatusConfig[item.status] || itemStatusConfig.PENDING);
                const hasVariance = item.variance !== 0 && wasCounted;
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
                      {wasCounted ? (
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
  const aguardandoRevisaoCount = listas.filter((l) => l.list_status === 'AGUARDANDO_REVISAO').length;
  const aguardandoToastShown = useRef(false);

  // Toast informativo: ao montar a tab, avisa supervisor de listas pendentes (uma vez)
  useEffect(() => {
    if (aguardandoToastShown.current) return;
    if (aguardandoRevisaoCount > 0) {
      toast.info(`${aguardandoRevisaoCount} lista${aguardandoRevisaoCount > 1 ? 's' : ''} aguardando sua revisao.`);
      aguardandoToastShown.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aguardandoRevisaoCount]);

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

  // Modal "Liberar Lista" com escolha de visibilidade e ordenação
  const [liberarDialog, setLiberarDialog] = useState<CountingList | null>(null);
  const [liberarShowPrev, setLiberarShowPrev] = useState(false);
  type SortOrder = 'ORIGINAL' | 'PRODUCT_CODE' | 'PRODUCT_DESCRIPTION' | 'LOCAL1' | 'LOCAL2' | 'LOCAL3';
  const [liberarSortOrder, setLiberarSortOrder] = useState<SortOrder>('ORIGINAL');

  // Modal "Devolver lista" (supervisor → contador)
  const [devolverDialog, setDevolverDialog] = useState<CountingList | null>(null);

  // Modal "Histórico de handoffs"
  const [historicoDialog, setHistoricoDialog] = useState<CountingList | null>(null);

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
    if (!lista) return;
    setLiberarShowPrev(false); // sempre default false a cada liberação
    setLiberarSortOrder('ORIGINAL'); // sort_order default a cada liberação
    setLiberarDialog(lista);
  }

  async function handleLiberarConfirmed() {
    if (!liberarDialog) return;
    const listId = liberarDialog.id;
    setLiberarDialog(null);
    setActionLoading(listId);
    try {
      await countingListService.liberar(listId, liberarShowPrev, liberarSortOrder);
      onReload();
      toast.success('Lista liberada para contagem.');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao liberar lista.');
    } finally {
      setActionLoading(null);
    }
  }

  function handleDevolver(lista: CountingList) {
    setDevolverDialog(lista);
  }

  async function handleDevolverConfirmed(motivo: string, itemIds: string[], sortOrder?: SortOrder) {
    if (!devolverDialog) return;
    const listId = devolverDialog.id;
    setDevolverDialog(null);
    setActionLoading(listId);
    try {
      const res = await countingListService.devolverAoContador(
        listId,
        motivo || undefined,
        itemIds.length > 0 ? itemIds : undefined,
        sortOrder,
      );
      onReload();
      const total = res.itens_marcados || 0;
      toast.success(
        res.parcial
          ? `Lista devolvida — ${total} item(ns) marcado(s) para revisao.`
          : `Lista devolvida — ${total} item(ns) marcado(s) para revisao (todos os contados).`
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao devolver lista.');
    } finally {
      setActionLoading(null);
    }
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
          <option value="AGUARDANDO_REVISAO">
            Aguarda revisao{aguardandoRevisaoCount > 0 ? ` (${aguardandoRevisaoCount})` : ''}
          </option>
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

      {/* Banner: listas avançaram para próximo ciclo, aguardando liberação */}
      {(() => {
        const advancedLists = listas.filter((l) => l.list_status === 'ABERTA' && (l.current_cycle ?? 1) > 1);
        if (advancedLists.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
            <UserCog className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-800">
                {advancedLists.length} lista(s) avancaram para o proximo ciclo.
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Antes de liberar, revise o contador atribuido para o ciclo atual de cada lista.
                Use o botao <strong>Contador</strong> se precisar trocar.
              </p>
            </div>
          </div>
        );
      })()}

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

                          <button
                            onClick={() => setHistoricoDialog(lista)}
                            title="Historico de entregas e devolucoes"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Historico
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

                          {(lista.list_status === 'ABERTA' || lista.list_status === 'PREPARACAO') && (
                            <button
                              onClick={() => handleOpenChangeCounter(lista)}
                              title="Alterar Contador"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                              Contador
                            </button>
                          )}

                          {isPrepOrAberta && (
                            (lista.total_items ?? 0) > 0 ? (
                              <button
                                onClick={() => handleLiberar(lista.id)}
                                title="Marca a lista como pronta para contagem (exige contador atribuído)"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                Liberar
                              </button>
                            ) : (
                              <button
                                disabled
                                title="Adicione produtos a esta lista antes de liberar"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md cursor-not-allowed"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                Liberar
                              </button>
                            )
                          )}

                          {(lista.list_status === 'LIBERADA' || lista.list_status === 'EM_CONTAGEM') && (
                            <button
                              onClick={() => navigate(`/inventario/contagem/${inventoryId}/desktop?list=${lista.id}`)}
                              title="Abrir tela de contagem"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-capul-600 rounded-md hover:bg-capul-700 transition-colors"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              Contar
                            </button>
                          )}

                          {lista.list_status === 'AGUARDANDO_REVISAO' && (
                            <button
                              onClick={() => handleDevolver(lista)}
                              title="Devolver a lista ao contador para nova contagem"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Devolver
                            </button>
                          )}

                          {(lista.list_status === 'LIBERADA' || lista.list_status === 'EM_CONTAGEM' || lista.list_status === 'AGUARDANDO_REVISAO') && (
                            lista.current_cycle >= 3 ? (
                              <button
                                onClick={() => handleEncerrar(lista.id)}
                                title="Encerra a lista no 3º ciclo (último ciclo permitido)"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                Encerrar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleFinalizarCiclo(lista.id)}
                                title="Avança para o próximo ciclo se houver divergências; encerra a lista se nenhum produto precisar recontagem"
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
                              title="Encerra a lista no ciclo atual (use quando a contagem do ciclo já for suficiente)"
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

      {/* Modal Liberar Lista (com escolha de visibilidade C1/C2) */}
      {liberarDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Liberar Lista para Contagem</h3>
              <p className="text-sm text-slate-500 mt-1">
                Ao liberar, o contador atribuido podera iniciar a contagem.
              </p>
            </div>

            <div className="text-xs bg-slate-50 rounded-lg p-3 space-y-1">
              <div><span className="text-slate-500">Lista:</span> <strong className="text-slate-800">{liberarDialog.list_name}</strong></div>
              <div><span className="text-slate-500">Ciclo:</span> <strong className="text-slate-800">{liberarDialog.current_cycle}o</strong></div>
              <div><span className="text-slate-500">Itens:</span> <strong className="text-slate-800">{liberarDialog.total_items ?? 0}</strong></div>
            </div>

            {/* Checkbox visibilidade — controla saldo do sistema + contagens anteriores */}
            <label className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={liberarShowPrev}
                onChange={(e) => setLiberarShowPrev(e.target.checked)}
                className="mt-0.5"
              />
              <div className="flex-1 text-sm">
                <p className="font-medium text-slate-800">Permitir ao contador ver o saldo do sistema e contagens anteriores</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Por padrao a contagem e cega. Marque apenas se for necessario (ex: contagem-piloto,
                  validacao rapida pelo supervisor{liberarDialog.current_cycle >= 2 ? `, resolucao de divergencias C1${liberarDialog.current_cycle === 3 ? '/C2' : ''}` : ''}).
                </p>
              </div>
            </label>

            {/* Ordenação dos produtos para o contador */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Ordem dos produtos para o contador</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define a sequência em que os produtos aparecem na contagem (mobile e desktop).
                </p>
              </div>
              <select
                value={liberarSortOrder}
                onChange={(e) => setLiberarSortOrder(e.target.value as SortOrder)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-capul-500"
              >
                <option value="ORIGINAL">Ordem original (sequência da lista)</option>
                <option value="LOCAL1">Localização 1 ⭐ (ordem física das prateleiras — recomendado)</option>
                <option value="LOCAL2">Localização 2 (ordem física das prateleiras)</option>
                <option value="LOCAL3">Localização 3 (ordem física das prateleiras)</option>
                <option value="PRODUCT_CODE">Código do produto</option>
                <option value="PRODUCT_DESCRIPTION">Descrição (alfabético)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Produtos sem o campo escolhido vão pro fim da lista. Imutável durante a contagem
                — pode ser alterado quando supervisor re-liberar após devolução.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setLiberarDialog(null)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleLiberarConfirmed}
                disabled={actionLoading === liberarDialog.id}
                className="px-4 py-2 text-sm text-white bg-capul-600 rounded-lg hover:bg-capul-700 disabled:opacity-50"
              >
                {actionLoading === liberarDialog.id ? 'Liberando...' : 'Liberar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver lista ao contador (com selecao parcial e re-escolha de ordenação) */}
      {devolverDialog && (
        <DevolverListaModal
          lista={devolverDialog}
          loading={actionLoading === devolverDialog.id}
          onCancel={() => setDevolverDialog(null)}
          onConfirm={handleDevolverConfirmed}
          currentSortOrder={(devolverDialog.sort_order as SortOrder | undefined) || 'ORIGINAL'}
        />
      )}

      {/* Modal Historico de handoffs */}
      {historicoDialog && (
        <HistoricoHandoffModal
          lista={historicoDialog}
          onClose={() => setHistoricoDialog(null)}
        />
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
