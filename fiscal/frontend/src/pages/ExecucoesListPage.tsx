import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Database,
  ArrowRight,
  Ban,
  CalendarRange,
  Loader2,
  ShieldAlert,
  Play,
  Plus,
  Sun,
  Sunrise,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
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

/** Estado consolidado por tipo retornado pelo endpoint do backend. */
interface StatusTipo {
  tipo: 'MOVIMENTO_MEIO_DIA' | 'MOVIMENTO_MANHA_SEGUINTE' | 'MANUAL';
  cooldownMinutos: number;
  emCurso: { id: string; iniciadoEm: string; disparadoPor: string | null } | null;
  ultimaConcluida: {
    id: string;
    finalizadoEm: string;
    totalContribuintes: number | null;
    sucessos: number;
    erros: number;
  } | null;
  disponivelEm: string | null;
  bloqueadoPor: 'EM_CURSO' | 'COOLDOWN' | null;
}

interface AmbienteSnapshot {
  ambienteAtivo: 'PRODUCAO' | 'HOMOLOGACAO';
  pauseSync: boolean;
}

export function ExecucoesListPage() {
  const { fiscalRole } = useAuth();
  const canTrigger = hasMinRole(fiscalRole, 'ANALISTA_CADASTRO');
  const canCompleta = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const canCancelar = hasMinRole(fiscalRole, 'ADMIN_TI');
  const toast = useToast();
  const confirm = useConfirm();

  const [execucoes, setExecucoes] = useState<CadastroSincronizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTipos, setStatusTipos] = useState<StatusTipo[]>([]);
  const [ambiente, setAmbiente] = useState<AmbienteSnapshot | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoSincronizacao | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [modalNovaExecucaoAberto, setModalNovaExecucaoAberto] = useState(false);
  const [modalManualPeriodo, setModalManualPeriodo] = useState(false);

  const loadList = useCallback(async () => {
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
  }, [filtroTipo]);

  const loadStatusTipos = useCallback(async () => {
    try {
      const [{ data: st }, { data: amb }] = await Promise.all([
        fiscalApi.get<StatusTipo[]>('/cruzamento/status-execucao-tipos'),
        fiscalApi.get<AmbienteSnapshot>('/ambiente'),
      ]);
      setStatusTipos(st);
      setAmbiente(amb);
    } catch {
      // Silencioso — banner vai só sumir se falhar, não é bloqueante.
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStatusTipos();
    // Refresh automático a cada 30s para refletir cooldown expirando e
    // execuções concluindo sem precisar recarregar a página.
    const timer = setInterval(loadStatusTipos, 30_000);
    return () => clearInterval(timer);
  }, [loadStatusTipos]);

  async function handleTrigger(
    tipo: 'manual' | 'movimento-meio-dia' | 'movimento-manha-seguinte',
    janela?: { dataInicio: string; dataFim: string },
  ) {
    try {
      setTriggering(true);
      setError(null);
      await fiscalApi.post('/cruzamento/sincronizar', {
        tipo,
        ...(janela ?? {}),
      });
      toast.success('Execução disparada', 'Acompanhe o progresso na lista abaixo.');
      await Promise.all([loadList(), loadStatusTipos()]);
    } catch (err) {
      toast.error('Falha ao disparar', extractApiError(err));
      setError(extractApiError(err, 'Falha ao disparar sincronização.'));
    } finally {
      setTriggering(false);
    }
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
      toast.success('Execução cancelada');
      await Promise.all([loadList(), loadStatusTipos()]);
    } catch (err) {
      toast.error('Falha ao cancelar', extractApiError(err));
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
      {/* Banner de status por tipo + freio de mão — fica sempre visível */}
      {statusTipos.length > 0 && (
        <StatusBanner statusTipos={statusTipos} ambiente={ambiente} />
      )}

      {canTrigger && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setModalNovaExecucaoAberto(true)}
            disabled={ambiente?.pauseSync}
          >
            Nova execução
          </Button>
        </div>
      )}

      {modalNovaExecucaoAberto && (
        <ModalNovaExecucao
          statusTipos={statusTipos}
          ambiente={ambiente}
          canCompleta={canCompleta}
          onSelecionarManualPeriodo={() => {
            setModalNovaExecucaoAberto(false);
            setModalManualPeriodo(true);
          }}
          onDispararCorrida={async (tipo) => {
            setModalNovaExecucaoAberto(false);
            await handleTrigger(tipo);
          }}
          onCancel={() => setModalNovaExecucaoAberto(false)}
          triggering={triggering}
        />
      )}

      {modalManualPeriodo && (
        <ModalManualPeriodo
          onConfirm={async (dataInicio, dataFim) => {
            setModalManualPeriodo(false);
            await handleTrigger('manual', { dataInicio, dataFim });
          }}
          onCancel={() => setModalManualPeriodo(false)}
          loading={triggering}
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
          <div className="p-10 text-center text-slate-500">Nenhuma execução encontrada.</div>
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
                    <td className="px-4 py-3 text-xs text-slate-600">{e.disparadoPor ?? '-'}</td>
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

/**
 * Banner de status fica acima da tabela — mostra em 1 glance:
 * - Se o freio de mão está ativo (bloqueia tudo)
 * - Última execução concluída de cada tipo automático (meio-dia / manhã seguinte)
 * - Se tem alguma em curso
 * - Cooldown expirando
 */
function StatusBanner({
  statusTipos,
  ambiente,
}: {
  statusTipos: StatusTipo[];
  ambiente: AmbienteSnapshot | null;
}) {
  const meioDia = statusTipos.find((s) => s.tipo === 'MOVIMENTO_MEIO_DIA');
  const manhaSeg = statusTipos.find((s) => s.tipo === 'MOVIMENTO_MANHA_SEGUINTE');

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
      {ambiente?.pauseSync ? (
        <div className="md:col-span-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <strong>Freio de mão ATIVO</strong> — todas as rotinas automáticas estão pausadas. Nenhuma
            execução pode ser disparada. Desative em{' '}
            <Link to="/operacao/controle/freio" className="underline hover:text-red-700">
              Operação → Freio de Mão
            </Link>
            .
          </div>
        </div>
      ) : null}

      <StatusTipoCard status={meioDia} icon={<Sun className="h-4 w-4" />} label="Corrida meio-dia" />
      <StatusTipoCard
        status={manhaSeg}
        icon={<Sunrise className="h-4 w-4" />}
        label="Corrida manhã seguinte"
      />
      <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <div className="mb-1 flex items-center gap-2 text-slate-500">
          <Database className="h-4 w-4" />
          <span className="font-medium uppercase tracking-wider">Ambiente SEFAZ</span>
        </div>
        {ambiente ? (
          <p className="text-sm">
            Consultas usando <strong>{ambiente.ambienteAtivo}</strong>.
          </p>
        ) : (
          <p className="text-slate-400">—</p>
        )}
      </div>
    </div>
  );
}

function StatusTipoCard({
  status,
  icon,
  label,
}: {
  status: StatusTipo | undefined;
  icon: React.ReactNode;
  label: string;
}) {
  if (!status) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-400">
        {label} — carregando…
      </div>
    );
  }

  if (status.emCurso) {
    const inicio = new Date(status.emCurso.iniciadoEm);
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <div className="mb-1 flex items-center gap-2">
          {icon} <span className="font-medium uppercase tracking-wider">{label}</span>
          <Loader2 className="ml-auto h-3 w-3 animate-spin" />
        </div>
        <p className="text-sm">
          <strong>Em execução</strong> desde {inicio.toLocaleTimeString('pt-BR')}
        </p>
      </div>
    );
  }

  if (status.ultimaConcluida) {
    const fim = new Date(status.ultimaConcluida.finalizadoEm);
    const hoje = new Date().toDateString() === fim.toDateString();
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
        <div className="mb-1 flex items-center gap-2">
          {icon} <span className="font-medium uppercase tracking-wider">{label}</span>
          <CheckCircle2 className="ml-auto h-3 w-3" />
        </div>
        <p className="text-sm">
          {hoje ? 'Hoje' : fim.toLocaleDateString('pt-BR')} às{' '}
          {fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} —{' '}
          {status.ultimaConcluida.totalContribuintes ?? 0} CNPJs, {status.ultimaConcluida.erros} erros
        </p>
        {status.disponivelEm && (
          <p className="mt-0.5 text-[11px] text-emerald-700">
            Disponível novamente após{' '}
            {new Date(status.disponivelEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="mb-1 flex items-center gap-2 text-slate-500">
        {icon} <span className="font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm text-slate-500">Sem execuções concluídas ainda.</p>
    </div>
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
 * Modal "Nova execução" — entry point único para disparar qualquer tipo de
 * execução, substituindo os 4 botões separados que estavam no topo.
 *
 * Cada opção mostra seu próprio estado (disponível / em curso / em cooldown)
 * derivado de `statusTipos`, desabilitando o botão e explicando o motivo.
 * Isso protege contra duplo-clique e disparos desnecessários que duplicariam
 * consumo SEFAZ (a mesma proteção existe no backend como fonte de verdade —
 * a UI aqui só antecipa a UX evitando o 409).
 */
function ModalNovaExecucao({
  statusTipos,
  ambiente,
  canCompleta,
  onSelecionarManualPeriodo,
  onDispararCorrida,
  onCancel,
  triggering,
}: {
  statusTipos: StatusTipo[];
  ambiente: AmbienteSnapshot | null;
  canCompleta: boolean;
  onSelecionarManualPeriodo: () => void;
  onDispararCorrida: (tipo: 'movimento-meio-dia' | 'movimento-manha-seguinte') => void | Promise<void>;
  onCancel: () => void;
  triggering: boolean;
}) {
  const meioDia = statusTipos.find((s) => s.tipo === 'MOVIMENTO_MEIO_DIA');
  const manhaSeg = statusTipos.find((s) => s.tipo === 'MOVIMENTO_MANHA_SEGUINTE');
  const freioAtivo = !!ambiente?.pauseSync;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Nova execução de cruzamento</h3>
              <p className="text-white/80 text-sm">Escolha o tipo — cada um tem sua janela e custo SEFAZ</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3">
          {freioAtivo && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>
                Freio de mão ativo — nenhuma opção pode ser disparada até ele ser desativado.
              </span>
            </div>
          )}

          <OpcaoExecucao
            icon={<CalendarRange className="h-5 w-5 text-indigo-600" />}
            titulo="Manual (período personalizado)"
            descricao="Escolha uma janela de datas específica para reprocessar. Use para backfill ou correção."
            status={null}
            disabled={freioAtivo || triggering}
            onClick={onSelecionarManualPeriodo}
            ctaLabel="Escolher período"
          />

          {canCompleta ? (
            <>
              <OpcaoExecucao
                icon={<Sun className="h-5 w-5 text-amber-600" />}
                titulo="Antecipar corrida meio-dia"
                descricao="Simula a corrida automática das 12:00 agora — movimento hoje 00:00 → 12:00."
                status={meioDia}
                disabled={freioAtivo || triggering}
                onClick={() => onDispararCorrida('movimento-meio-dia')}
                ctaLabel="Disparar meio-dia"
              />
              <OpcaoExecucao
                icon={<Sunrise className="h-5 w-5 text-rose-600" />}
                titulo="Antecipar corrida manhã seguinte"
                descricao="Simula a corrida automática das 06:00 — movimento ontem 12:00 → 23:59 (ainda dentro das 24h de cancelamento NF-e)."
                status={manhaSeg}
                disabled={freioAtivo || triggering}
                onClick={() => onDispararCorrida('movimento-manha-seguinte')}
                ctaLabel="Disparar manhã seguinte"
              />
            </>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              As corridas automáticas (meio-dia / manhã seguinte) exigem role{' '}
              <strong>GESTOR_FISCAL</strong> ou <strong>ADMIN_TI</strong>.
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Uma opção do modal "Nova execução". Reflete o estado atual do tipo:
 * disponível, em curso, em cooldown — desabilitando o CTA e explicando
 * visualmente quando for o caso. Se `status` for null, a opção é genérica
 * (ex: Manual período — que sempre exige escolher janela depois).
 */
function OpcaoExecucao({
  icon,
  titulo,
  descricao,
  status,
  disabled,
  onClick,
  ctaLabel,
}: {
  icon: React.ReactNode;
  titulo: string;
  descricao: string;
  status: StatusTipo | null | undefined;
  disabled: boolean;
  onClick: () => void;
  ctaLabel: string;
}) {
  const bloqueadoPor = status?.bloqueadoPor;
  const isDisabled = disabled || bloqueadoPor != null;

  let statusNode: React.ReactNode = null;
  if (bloqueadoPor === 'EM_CURSO' && status?.emCurso) {
    statusNode = (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Em execução desde{' '}
        {new Date(status.emCurso.iniciadoEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    );
  } else if (bloqueadoPor === 'COOLDOWN' && status?.disponivelEm) {
    statusNode = (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
        <Clock className="h-3 w-3" />
        Em cooldown — disponível novamente às{' '}
        {new Date(status.disponivelEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    );
  } else if (status?.ultimaConcluida) {
    const fim = new Date(status.ultimaConcluida.finalizadoEm);
    const hoje = new Date().toDateString() === fim.toDateString();
    statusNode = (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        Última: {hoje ? 'hoje' : fim.toLocaleDateString('pt-BR')} às{' '}
        {fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} —{' '}
        {status.ultimaConcluida.totalContribuintes ?? 0} CNPJs
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-4 ${
        isDisabled ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex-shrink-0 pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-900">{titulo}</h4>
        <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{descricao}</p>
        {statusNode}
      </div>
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isDisabled
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {ctaLabel}
      </button>
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
  const diasJanela =
    Math.round((dataFimDate.getTime() - dataInicioDate.getTime()) / 86_400_000) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <CalendarRange className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                Disparar cruzamento — período personalizado
              </h3>
              <p className="text-white/80 text-sm">Escolha a janela temporal a processar</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Data início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                max={hoje}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Data fim</label>
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

          <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <span>
              Consome cota diária SEFAZ (2.000 consultas). Cada CNPJ único no período conta como 1
              consulta. Tempo estimado: <strong>~1 min por 100 CNPJs</strong> dependendo do
              throttle ativo.
            </span>
          </div>
        </div>

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
