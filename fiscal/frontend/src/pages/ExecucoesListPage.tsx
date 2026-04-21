import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Database,
  ArrowRight,
  Ban,
  CalendarRange,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import type {
  CadastroSincronizacao,
  StatusSincronizacao,
  TipoSincronizacao,
} from '../types';

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  MOVIMENTO_MEIO_DIA: 'Movimento meio-dia',
  MOVIMENTO_MANHA_SEGUINTE: 'Movimento manhã seguinte',
  MANUAL: 'Manual',
  PONTUAL: 'Pontual',
};

const STATUS_BADGE: Record<StatusSincronizacao, 'gray' | 'blue' | 'yellow' | 'green' | 'red'> = {
  AGENDADA: 'gray',
  EM_EXECUCAO: 'blue',
  CONCLUIDA: 'green',
  CONCLUIDA_COM_ERROS: 'yellow',
  FALHADA: 'red',
  CANCELADA: 'gray',
};

const STATUS_LABEL: Record<StatusSincronizacao, string> = {
  AGENDADA: 'Agendada',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDA: 'Concluída',
  CONCLUIDA_COM_ERROS: 'Concluída com erros',
  FALHADA: 'Falhada',
  CANCELADA: 'Cancelada',
};

export function ExecucoesListPage() {
  const { fiscalRole } = useAuth();
  const canTrigger = hasMinRole(fiscalRole, 'ANALISTA_CADASTRO');
  const canCompleta = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const canCancelar = hasMinRole(fiscalRole, 'ADMIN_TI');
  const [execucoes, setExecucoes] = useState<CadastroSincronizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoSincronizacao | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [modalManualPeriodo, setModalManualPeriodo] = useState(false);
  const confirm = useConfirm();

  async function load() {
    try {
      setLoading(true);
      const params = filtroTipo ? `?tipo=${filtroTipo}` : '';
      const { data } = await fiscalApi.get<CadastroSincronizacao[]>(
        `/cruzamento/execucoes${params}`,
      );
      setExecucoes(data);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar execuções.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo]);

  async function handleTrigger(
    tipo: 'manual' | 'movimento-meio-dia' | 'movimento-manha-seguinte',
    janela?: { dataInicio: string; dataFim: string },
  ) {
    try {
      setTriggering(tipo);
      setError(null);
      await fiscalApi.post('/cruzamento/sincronizar', {
        tipo,
        ...(janela ?? {}),
      });
      await load();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao disparar sincronização.'));
    } finally {
      setTriggering(null);
    }
  }

  async function handleManualSimples() {
    const ok = await confirm({
      title: 'Disparar cruzamento manual (últimas 24h)?',
      description:
        'Vai consultar no Protheus todos os CNPJs que tiveram movimento fiscal nas últimas 24 horas ' +
        'e comparar a situação cadastral de cada um com a última consulta à SEFAZ. ' +
        'Tempo estimado: alguns minutos, dependendo do volume. ' +
        'Consome cota diária SEFAZ — cada CNPJ novo ou com mais de 24h conta como 1 consulta.',
      variant: 'warning',
      confirmLabel: 'Disparar últimas 24h',
    });
    if (ok) handleTrigger('manual');
  }

  async function handleCancelar(e: CadastroSincronizacao) {
    const ok = await confirm({
      title: 'Cancelar execução em andamento?',
      description:
        `Tem certeza de que deseja cancelar a execução ${TIPO_LABEL[e.tipo]} iniciada em ${new Date(e.iniciadoEm).toLocaleString('pt-BR')}? ` +
        'A execução será marcada como CANCELADA e os jobs pendentes serão removidos da fila. Jobs já em processamento não podem ser abortados.',
      confirmLabel: 'Cancelar execução',
      cancelLabel: 'Voltar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setCancelando(e.id);
      setError(null);
      await fiscalApi.post(`/cruzamento/execucoes/${e.id}/cancelar`);
      await load();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao cancelar execução.'));
    } finally {
      setCancelando(null);
    }
  }

  const resumo = execucoes.reduce(
    (acc, e) => {
      acc.total++;
      if (e.status === 'EM_EXECUCAO') acc.emExecucao++;
      if (e.status === 'CONCLUIDA') acc.concluidas++;
      if (e.status === 'CONCLUIDA_COM_ERROS') acc.comErros++;
      if (e.status === 'FALHADA') acc.falhadas++;
      return acc;
    },
    { total: 0, emExecucao: 0, concluidas: 0, comErros: 0, falhadas: 0 },
  );

  return (
    <PageWrapper title="Execuções de Cruzamento">
      {canTrigger && (
        <div className="mb-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Play className="h-4 w-4" />}
            onClick={handleManualSimples}
            loading={triggering === 'manual'}
          >
            Disparar manual (24h)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<CalendarRange className="h-4 w-4" />}
            onClick={() => setModalManualPeriodo(true)}
            loading={triggering === 'manual'}
          >
            Manual (período)
          </Button>
          {canCompleta && (
            <>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Database className="h-4 w-4" />}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Antecipar corrida do meio-dia?',
                    description:
                      'Simula a corrida automática das 12:00 agora mesmo. ' +
                      'Vai consultar no Protheus os CNPJs com movimento desde 00:00 de hoje ' +
                      'e cruzar com a SEFAZ (CCC/Sintegra). ' +
                      'Use somente para recuperar uma corrida atrasada — se a automática das 12:00 já rodou, ' +
                      'estará duplicando consumo da cota SEFAZ.',
                    variant: 'warning',
                    confirmLabel: 'Disparar meio-dia',
                  });
                  if (ok) handleTrigger('movimento-meio-dia');
                }}
                loading={triggering === 'movimento-meio-dia'}
              >
                Corrida meio-dia
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Database className="h-4 w-4" />}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Antecipar corrida da manhã seguinte?',
                    description:
                      'Simula a corrida automática das 06:00 agora mesmo. ' +
                      'Vai processar CNPJs com movimento no período ontem 12:00 → 23:59 ' +
                      '(ainda dentro da janela de 24h de cancelamento NF-e). ' +
                      'Use somente se a corrida automática da manhã falhou — caso contrário, ' +
                      'você estará duplicando consumo SEFAZ.',
                    variant: 'warning',
                    confirmLabel: 'Disparar manhã seguinte',
                  });
                  if (ok) handleTrigger('movimento-manha-seguinte');
                }}
                loading={triggering === 'movimento-manha-seguinte'}
              >
                Corrida manhã seguinte
              </Button>
            </>
          )}
        </div>
      )}

      {modalManualPeriodo && (
        <ModalManualPeriodo
          onConfirm={async (dataInicio, dataFim) => {
            setModalManualPeriodo(false);
            await handleTrigger('manual', { dataInicio, dataFim });
          }}
          onCancel={() => setModalManualPeriodo(false)}
          loading={triggering === 'manual'}
        />
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        <StatCard label="Total" value={resumo.total} icon={<Database className="h-4 w-4" />} />
        <StatCard
          label="Em execução"
          value={resumo.emExecucao}
          icon={<Clock className="h-4 w-4 text-blue-600" />}
          color="blue"
        />
        <StatCard
          label="Concluídas"
          value={resumo.concluidas}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          color="green"
        />
        <StatCard
          label="Com erros"
          value={resumo.comErros}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          color="yellow"
        />
        <StatCard
          label="Falhadas"
          value={resumo.falhadas}
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          color="red"
        />
      </div>

      {/* Filtro */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-medium text-slate-700">Filtrar por tipo:</label>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo((e.target.value || '') as TipoSincronizacao | '')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:ring-slate-500"
        >
          <option value="">Todos</option>
          {(Object.keys(TIPO_LABEL) as TipoSincronizacao[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Carregando…</div>
        ) : execucoes.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            Nenhuma execução encontrada.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Iniciado</th>
                <th className="px-4 py-2">Duração</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Sucessos</th>
                <th className="px-4 py-2 text-right">Erros</th>
                <th className="px-4 py-2">Disparado por</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {execucoes.map((e) => {
                const duracao = e.finalizadoEm
                  ? Math.round(
                      (new Date(e.finalizadoEm).getTime() - new Date(e.iniciadoEm).getTime()) /
                        60000,
                    )
                  : null;
                return (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{TIPO_LABEL[e.tipo]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(e.iniciadoEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {duracao !== null ? `${duracao} min` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {e.totalContribuintes?.toLocaleString('pt-BR') ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-emerald-700">
                      {e.sucessos.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <span className={e.erros > 0 ? 'text-red-700' : 'text-slate-400'}>
                        {e.erros.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {e.disparadoPor ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canCancelar && e.status === 'EM_EXECUCAO' && (
                          <button
                            onClick={() => handleCancelar(e)}
                            disabled={cancelando === e.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                            title="Cancelar execução em andamento"
                          >
                            <Ban className="h-3 w-3" />
                            {cancelando === e.id ? 'Cancelando…' : 'Cancelar'}
                          </button>
                        )}
                        <Link
                          to={`/execucoes/${e.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                        >
                          Detalhes <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = 'gray',
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'yellow' | 'red';
}) {
  const borderColor: Record<string, string> = {
    gray: 'border-slate-200',
    blue: 'border-blue-200 bg-blue-50/30',
    green: 'border-emerald-200 bg-emerald-50/30',
    yellow: 'border-amber-200 bg-amber-50/30',
    red: 'border-red-200 bg-red-50/30',
  };
  return (
    <div className={`rounded-lg border bg-white p-4 ${borderColor[color]}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString('pt-BR')}</div>
    </div>
  );
}

/**
 * Modal de disparo manual com janela de datas personalizada.
 * Usuario escolhe dataInicio e dataFim (formato YYYY-MM-DD), sistema
 * valida no backend e dispara a execucao.
 *
 * Limitacao atual (21/04/2026): a API Protheus `comMovimentoDesde` so
 * aceita data inicial — `dataFim` e gravada no registro de sincronizacao
 * para documentacao, mas nao filtra CNPJs que movimentaram depois.
 */
function ModalManualPeriodo({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (dataInicio: string, dataFim: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const ontem = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(ontem);
  const [dataFim, setDataFim] = useState(hoje);

  const dataInicioDate = new Date(dataInicio);
  const dataFimDate = new Date(dataFim);
  const janelaValida = dataInicio && dataFim && dataInicioDate <= dataFimDate;
  const diasJanela = Math.round((dataFimDate.getTime() - dataInicioDate.getTime()) / 86_400_000) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <CalendarRange className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                Disparar cruzamento — período personalizado
              </h3>
              <p className="text-white/80 text-sm">
                Escolha a janela temporal a processar
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Data início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                max={hoje}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Data fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                max={hoje}
                min={dataInicio}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
              />
            </div>
          </div>

          {/* Resumo da janela */}
          {janelaValida && (
            <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
              <p className="font-medium mb-1">Janela selecionada</p>
              <p>
                {new Date(`${dataInicio}T00:00:00`).toLocaleDateString('pt-BR')} até{' '}
                {new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')} ({diasJanela}{' '}
                {diasJanela === 1 ? 'dia' : 'dias'})
              </p>
            </div>
          )}

          {/* Aviso sobre limitação da API Protheus */}
          <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-medium mb-1">Limitação atual da API Protheus</p>
              <p>
                A API atualmente filtra apenas por <strong>data início</strong> (
                <code>comMovimentoDesde</code>). A data fim serve como documentação da janela
                desejada, mas a consulta traz CNPJs com movimento desde a data início até agora.
                Para janelas curtas (1-3 dias), o impacto é mínimo. Solicitação do parâmetro
                <code> comMovimentoAte</code> à equipe Protheus já está no backlog de melhorias.
              </p>
            </div>
          </div>

          {/* Aviso de custo SEFAZ */}
          <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>
              Consome cota diária SEFAZ (2.000 consultas). Cada CNPJ único no período conta
              como 1 consulta. Tempo estimado:{' '}
              <strong>~1 min por 100 CNPJs</strong> dependendo do throttle ativo.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(dataInicio, dataFim)}
            disabled={loading || !janelaValida}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Disparando…
              </>
            ) : (
              <>
                <CalendarRange className="h-4 w-4" /> Disparar período
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
