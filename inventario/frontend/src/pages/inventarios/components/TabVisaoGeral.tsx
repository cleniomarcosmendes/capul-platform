import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ListChecks,
  Unlock,
  BarChart2,
  CheckCircle2,
  Lock,
  Download,
  ArrowRight,
  AlertTriangle,
  Clock,
  ArrowLeftRight,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { inventoryService } from '../../../services/inventory.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import type { InventoryList, CountingList } from '../../../types';
import { ClipboardCheck } from 'lucide-react';

interface Props {
  inventario: InventoryList;
  itensTotal: number;
  listas: CountingList[];
  onNavigateTab: (tab: 'itens' | 'listas' | 'analise') => void;
  onAddProducts: () => void;
  onReload: () => void;
}

export function TabVisaoGeral({
  inventario,
  itensTotal,
  listas,
  onNavigateTab,
  onAddProducts,
  onReload,
}: Props) {
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'finalize' | 'close' | null>(null);

  const status = inventario.status;
  const allListsClosed =
    listas.length > 0 && listas.every((l) => l.list_status === 'ENCERRADA');
  const pending = inventario.total_items - inventario.counted_items;
  const hasNoCounting = inventario.total_items > 0 && inventario.counted_items === 0;

  function handleEncerrar() {
    setConfirmAction('close');
  }

  async function executeConfirmedAction() {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;

    const newStatus = action === 'finalize' ? 'COMPLETED' : 'CLOSED';
    setActionLoading(action === 'finalize' ? 'finalize' : 'close');
    try {
      await inventoryService.atualizar(inventario.id, { status: newStatus });
      onReload();
      toast.success(action === 'finalize' ? 'Inventario finalizado.' : 'Inventario encerrado.');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || (action === 'finalize' ? 'Erro ao finalizar inventario.' : 'Erro ao encerrar inventario.'));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'finalize' ? 'Concluir Contagens' : 'Encerrar sem Integracao'}
        description={
          hasNoCounting
            ? 'ATENCAO: Nenhuma contagem foi realizada neste inventario! Deseja realmente prosseguir?'
            : pending > 0
              ? `Existem ${pending} item(ns) sem contagem de um total de ${inventario.total_items}. Deseja prosseguir?`
              : confirmAction === 'finalize'
                ? 'Todas as contagens foram realizadas. O inventario ficara disponivel para analise e integracao com o Protheus.'
                : 'O inventario sera encerrado definitivamente SEM enviar ao Protheus. Esta acao e irreversivel.'
        }
        details={
          confirmAction === 'finalize'
            ? [
                `Total de itens: ${inventario.total_items}`,
                `Itens contados: ${inventario.counted_items}`,
                `Itens pendentes: ${pending}`,
              ]
            : [
                'O inventario sera bloqueado para alteracoes.',
                'Se precisar integrar ao Protheus, faca ANTES de encerrar.',
                'Use esta opcao apenas se NAO for enviar ao ERP.',
              ]
        }
        variant={hasNoCounting ? 'danger' : confirmAction === 'close' ? 'danger' : pending > 0 ? 'warning' : 'info'}
        confirmLabel={confirmAction === 'finalize' ? 'Concluir Contagens' : 'Encerrar Definitivamente'}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />
      <StatusBanner status={status} />

      {status === 'DRAFT' && (
        <DraftWizard
          itensTotal={itensTotal}
          listas={listas}
          onAddProducts={onAddProducts}
          onNavigateTab={onNavigateTab}
        />
      )}

      {status === 'IN_PROGRESS' && (
        <InProgressPanel
          inventario={inventario}
          listas={listas}
          pending={pending}
          allListsClosed={allListsClosed}
          onNavigateTab={onNavigateTab}
        />
      )}

      {(status === 'COMPLETED' || status === 'CLOSED') && (
        <CompletedSummary
          inventario={inventario}
          listas={listas}
          status={status}
          onNavigateTab={onNavigateTab}
          onEncerrar={handleEncerrar}
          actionLoading={actionLoading}
        />
      )}

      <Timeline inventario={inventario} itensTotal={itensTotal} listas={listas} />
    </div>
  );
}

// === Status Banner ===

function StatusBanner({ status }: { status: string }) {
  const config: Record<string, { title: string; desc: string; color: string; bg: string }> = {
    DRAFT: {
      title: 'Preparacao do Inventario',
      desc: 'Siga os passos abaixo para preparar o inventario para contagem.',
      color: 'text-slate-700',
      bg: 'bg-slate-50 border-slate-200',
    },
    IN_PROGRESS: {
      title: 'Inventario em Andamento',
      desc: 'O inventario esta em fase de contagem. Gerencie as listas e acompanhe o progresso.',
      color: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-200',
    },
    COMPLETED: {
      title: 'Contagens Concluidas',
      desc: 'As contagens foram concluidas. Analise os resultados e envie ao Protheus via Integracao.',
      color: 'text-green-700',
      bg: 'bg-green-50 border-green-200',
    },
    CLOSED: {
      title: 'Inventario Efetivado',
      desc: 'Este inventario foi efetivado e integrado ao Protheus. Nao e possivel realizar alteracoes.',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50 border-emerald-200',
    },
  };

  const c = config[status] || config.DRAFT;

  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <h3 className={`text-base font-semibold ${c.color}`}>{c.title}</h3>
      <p className="text-sm text-slate-500 mt-1">{c.desc}</p>
    </div>
  );
}

// === DRAFT: Wizard 3 Passos ===

function DraftWizard({
  itensTotal,
  listas,
  onAddProducts,
  onNavigateTab,
}: {
  itensTotal: number;
  listas: CountingList[];
  onAddProducts: () => void;
  onNavigateTab: (tab: 'itens' | 'listas' | 'analise') => void;
}) {
  const step1Done = itensTotal > 0;
  const step2Done = listas.length > 0;
  const hasProductsInLists = listas.some((l) => (l.total_items ?? 0) > 0);

  return (
    <div className="space-y-4">
      {/* Passo 1 */}
      <StepCard
        step={1}
        icon={Package}
        title="Adicionar Produtos"
        description="Adicione os produtos do Protheus que serao inventariados neste armazem."
        completed={step1Done}
        badge={
          step1Done
            ? `${itensTotal.toLocaleString('pt-BR')} produtos adicionados`
            : 'Nenhum produto adicionado'
        }
        actions={
          step1Done ? (
            <button
              onClick={() => onNavigateTab('itens')}
              className="flex items-center gap-1.5 text-sm text-capul-600 hover:text-capul-700 font-medium"
            >
              Ver Itens
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onAddProducts}
              className="px-4 py-2 bg-capul-600 text-white text-sm rounded-lg font-medium hover:bg-capul-700 transition-colors"
            >
              Adicionar Produtos
            </button>
          )
        }
        extraAction={
          step1Done ? (
            <button
              onClick={onAddProducts}
              className="px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              Adicionar mais
            </button>
          ) : null
        }
      />

      {/* Passo 2 */}
      <StepCard
        step={2}
        icon={ListChecks}
        title="Criar Listas de Contagem"
        description="Crie listas e distribua os produtos entre os contadores."
        completed={step2Done}
        disabled={!step1Done}
        disabledReason="Adicione produtos primeiro (Passo 1)"
        badge={
          step2Done
            ? `${listas.length} lista${listas.length !== 1 ? 's' : ''} criada${listas.length !== 1 ? 's' : ''}`
            : 'Nenhuma lista criada'
        }
        actions={
          step2Done ? (
            <button
              onClick={() => onNavigateTab('listas')}
              className="flex items-center gap-1.5 text-sm text-capul-600 hover:text-capul-700 font-medium"
            >
              Ver Listas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab('listas')}
              disabled={!step1Done}
              className="px-4 py-2 bg-capul-600 text-white text-sm rounded-lg font-medium hover:bg-capul-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Criar Listas
            </button>
          )
        }
        extraAction={
          step2Done ? (
            <button
              onClick={() => onNavigateTab('listas')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              Gerenciar Listas
            </button>
          ) : null
        }
      />

      {/* Passo 3 */}
      <StepCard
        step={3}
        icon={Unlock}
        title="Liberar Listas para Contagem"
        description="Adicione produtos as listas e libere-as para os contadores iniciarem a contagem."
        completed={false}
        disabled={!step2Done}
        disabledReason="Crie ao menos uma lista de contagem (Passo 2)"
        badge={
          hasProductsInLists
            ? 'Listas prontas — libere na aba Listas'
            : 'Adicione produtos as listas antes de liberar'
        }
        actions={
          <button
            onClick={() => onNavigateTab('listas')}
            disabled={!step2Done}
            className="px-4 py-2 bg-capul-600 text-white text-sm rounded-lg font-medium hover:bg-capul-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ir para Listas
          </button>
        }
      />
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
  completed,
  disabled,
  disabledReason,
  badge,
  actions,
  extraAction,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  completed: boolean;
  disabled?: boolean;
  disabledReason?: string;
  badge: string | null;
  actions: React.ReactNode;
  extraAction?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-shadow ${
        disabled
          ? 'border-slate-100 opacity-60'
          : completed
            ? 'border-green-200 hover:shadow-md'
            : 'border-slate-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            completed
              ? 'bg-green-100 text-green-600'
              : disabled
                ? 'bg-slate-100 text-slate-400'
                : 'bg-capul-100 text-capul-600'
          }`}
        >
          {completed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
            Passo {step}
          </p>
          <h4 className="text-base font-semibold text-slate-800 mb-1">{title}</h4>
          <p className="text-sm text-slate-500 mb-3">{description}</p>

          {badge && (
            <p
              className={`text-xs font-medium mb-3 ${
                completed ? 'text-green-600' : 'text-slate-400'
              }`}
            >
              {completed && <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />}
              {badge}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {actions}
            {extraAction}
          </div>

          {disabled && disabledReason && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {disabledReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// === IN_PROGRESS: Dashboard + Acoes ===

function InProgressPanel({
  inventario,
  listas,
  pending,
  allListsClosed,
  onNavigateTab,
}: {
  inventario: InventoryList;
  listas: CountingList[];
  pending: number;
  allListsClosed: boolean;
  onNavigateTab: (tab: 'itens' | 'listas' | 'analise') => void;
}) {
  const navigate = useNavigate();
  const listasEmContagem = listas.filter(
    (l) => l.list_status === 'LIBERADA' || l.list_status === 'EM_CONTAGEM',
  ).length;

  return (
    <div className="space-y-4">
      {/* Mini Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Total Itens" value={inventario.total_items} color="text-slate-800" />
        <MiniStat label="Contados" value={inventario.counted_items} color="text-green-600" />
        <MiniStat label="Pendentes" value={pending} color="text-amber-600" />
        <MiniStat
          label="Progresso"
          value={`${Math.round(inventario.progress_percentage)}%`}
          color="text-capul-600"
        />
      </div>

      {/* Barra progresso */}
      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-capul-500 rounded-full transition-all duration-500"
          style={{ width: `${inventario.progress_percentage}%` }}
        />
      </div>

      {/* Acoes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon={ClipboardCheck}
          iconColor="bg-capul-100 text-capul-600"
          title="Ir para Contagem"
          description="Acesse a tela de contagem para registrar as quantidades dos produtos."
          actionLabel="Contar Agora"
          onClick={() => navigate(`/inventario/contagem`)}
        />
        <ActionCard
          icon={ListChecks}
          iconColor="bg-blue-100 text-blue-600"
          title="Gerenciar Listas"
          description="Gerencie as listas de contagem e adicione produtos manualmente."
          actionLabel="Ver Listas"
          onClick={() => onNavigateTab('listas')}
          badge={listasEmContagem > 0 ? `${listasEmContagem} em contagem` : undefined}
        />
        <ActionCard
          icon={Lock}
          iconColor="bg-amber-100 text-amber-600"
          title="Encerrar Lista de Contagem"
          description="Acesse a aba Listas para encerrar/avançar uma lista específica."
          actionLabel="Ver Listas"
          onClick={() => onNavigateTab('listas')}
        />
        <ActionCard
          icon={BarChart2}
          iconColor="bg-purple-100 text-purple-600"
          title="Ver Divergencias"
          description="Analise as divergencias encontradas na contagem."
          actionLabel="Ver Analise"
          onClick={() => onNavigateTab('analise')}
        />
      </div>

      {/* Aviso de progresso até as listas encerrarem.
          Quando todas as listas estão encerradas, o banner verde no topo do
          InventarioDetalhePage cobre a ação "Encerrar Inventario" — não duplicamos aqui. */}
      {!allListsClosed && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Próximo passo: Encerrar todas as listas</h4>
                <p className="text-xs text-slate-500">
                  Quando todas as listas estiverem encerradas, o inventario podera ser encerrado
                  e seguir para Análise + Integração Protheus.
                </p>
              </div>
            </div>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Encerre todas as listas antes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  actionLabel,
  onClick,
  disabled,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-capul-300 hover:shadow-sm transition-all group">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          {badge && (
            <span className="text-xs text-blue-600 font-medium">{badge}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-1 text-sm font-medium text-slate-600 group-hover:text-capul-600 transition-colors disabled:opacity-50"
      >
        {actionLabel}
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// === COMPLETED / CLOSED: Resumo ===

function CompletedSummary({
  inventario,
  listas,
  status,
  onNavigateTab,
  onEncerrar,
  actionLoading,
}: {
  inventario: InventoryList;
  listas: CountingList[];
  status: string;
  onNavigateTab: (tab: 'itens' | 'listas' | 'analise') => void;
  onEncerrar: () => void;
  actionLoading: string | null;
}) {
  const navigate = useNavigate();
  const accuracy =
    inventario.total_items > 0
      ? Math.round((inventario.counted_items / inventario.total_items) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Total Itens" value={inventario.total_items} color="text-slate-800" />
        <MiniStat label="Contados" value={inventario.counted_items} color="text-green-600" />
        <MiniStat
          label="Listas"
          value={listas.length}
          color="text-blue-600"
        />
        <MiniStat label="Cobertura" value={`${accuracy}%`} color="text-capul-600" />
      </div>

      {/* Acoes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon={BarChart2}
          iconColor="bg-purple-100 text-purple-600"
          title="Ver Analise Completa"
          description="Consulte o relatorio de divergencias e resultados da contagem."
          actionLabel="Ver Analise"
          onClick={() => onNavigateTab('analise')}
        />
        <ActionCard
          icon={Download}
          iconColor="bg-emerald-100 text-emerald-600"
          title="Exportar Dados"
          description="Exporte os itens do inventario em formato CSV."
          actionLabel="Ver Itens"
          onClick={() => onNavigateTab('itens')}
        />
        <ActionCard
          icon={ArrowLeftRight}
          iconColor="bg-violet-100 text-violet-600"
          title="Comparar Inventarios"
          description="Compare com outro inventario para identificar transferencias logicas."
          actionLabel="Comparar"
          onClick={() => navigate(`/inventario/divergencias?tab=historica&inv_a=${inventario.id}`)}
        />
        <ActionCard
          icon={Send}
          iconColor="bg-green-100 text-green-600"
          title={status === 'CLOSED' ? 'Ver Integracao' : 'Integracao Protheus'}
          description={status === 'CLOSED' ? 'Visualize os dados da integracao enviada ao Protheus.' : 'Envie os resultados do inventario para o ERP Protheus.'}
          actionLabel={status === 'CLOSED' ? 'Ver Detalhes' : 'Ir para Integracao'}
          onClick={() => navigate(status === 'CLOSED' ? '/inventario/integracoes' : `/inventario/integracoes/nova?inv_a=${inventario.id}`)}
        />
      </div>

      {/* Efetivado — apenas CLOSED */}
      {status === 'CLOSED' && (
        <div className="bg-white rounded-xl border-2 border-emerald-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Inventario Efetivado</h4>
              <p className="text-xs text-slate-500">
                Integracao enviada ao Protheus. Este inventario esta bloqueado para alteracoes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Encerrar sem Integracao — apenas COMPLETED (nao-efetivado) */}
      {status === 'COMPLETED' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Encerrar sem Integracao</h4>
                <p className="text-xs text-slate-500">
                  Encerra o inventario SEM enviar ao Protheus. Use apenas se nao for integrar ao ERP.
                </p>
              </div>
            </div>
            <button
              onClick={onEncerrar}
              disabled={actionLoading === 'close'}
              className="px-4 py-2 bg-slate-500 text-white text-sm rounded-lg font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'close' ? 'Encerrando...' : 'Encerrar sem Integracao'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// === Timeline ===

function Timeline({
  inventario,
  itensTotal,
  listas,
}: {
  inventario: InventoryList;
  itensTotal: number;
  listas: CountingList[];
}) {
  const events = [
    {
      label: 'Inventario criado',
      completed: true,
      date: new Date(inventario.created_at).toLocaleString('pt-BR'),
    },
    {
      label: `${itensTotal.toLocaleString('pt-BR')} produtos adicionados`,
      completed: itensTotal > 0,
      date: null,
    },
    {
      label: `${listas.length} lista${listas.length !== 1 ? 's' : ''} de contagem criada${listas.length !== 1 ? 's' : ''}`,
      completed: listas.length > 0,
      date: null,
    },
    {
      label: 'Contagem iniciada',
      completed: inventario.status !== 'DRAFT',
      date: null,
    },
    {
      label: 'Inventario finalizado',
      completed: inventario.status === 'COMPLETED' || inventario.status === 'CLOSED',
      date: null,
    },
    {
      label: 'Inventario efetivado (integrado ao Protheus)',
      completed: inventario.status === 'CLOSED',
      date: null,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">Linha do Tempo</h3>
      </div>
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                  event.completed ? 'bg-green-500' : 'bg-slate-300'
                }`}
              />
              {i < events.length - 1 && (
                <div
                  className={`w-0.5 flex-1 mt-1 min-h-[16px] ${
                    event.completed ? 'bg-green-300' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
            <div className="pb-1">
              <p
                className={`text-sm ${
                  event.completed ? 'text-slate-800 font-medium' : 'text-slate-400'
                }`}
              >
                {event.label}
              </p>
              {event.date && <p className="text-xs text-slate-400">{event.date}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
