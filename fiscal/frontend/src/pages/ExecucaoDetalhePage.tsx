import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, RefreshCw, AlertTriangle } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import type {
  AlertaEnviado,
  CadastroSincronizacao,
  StatusSincronizacao,
  TipoSincronizacao,
} from '../types';

interface ExecucaoDetalhe extends CadastroSincronizacao {
  alertas: AlertaEnviado[];
}

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  BOOTSTRAP: 'Bootstrap (carga inicial)',
  SEMANAL_AUTO: 'Semanal automática',
  DIARIA_AUTO: 'Diária automática',
  DIARIA_MANUAL: 'Diária manual',
  PONTUAL: 'Pontual',
  COMPLETA_MANUAL: 'Completa manual',
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

export function ExecucaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { fiscalRole } = useAuth();
  const canReenviar = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const [execucao, setExecucao] = useState<ExecucaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [reenviando, setReenviando] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    if (!id) return;
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<ExecucaoDetalhe>(`/cruzamento/execucoes/${id}`);
      setExecucao(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // auto-refresh se está EM_EXECUCAO
    const interval = setInterval(() => {
      if (execucao?.status === 'EM_EXECUCAO') load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, execucao?.status]);

  async function handleReenviarAlerta(alertaId: string) {
    try {
      setReenviando(alertaId);
      await fiscalApi.post(`/cruzamento/alertas/${alertaId}/reenviar`);
      toast.success('Alerta reenviado', 'O e-mail foi despachado para os destinatários.');
      await load();
    } catch (err) {
      toast.error('Falha ao reenviar alerta', extractApiError(err));
    } finally {
      setReenviando(null);
    }
  }

  if (loading && !execucao) {
    return <div className="text-slate-500">Carregando…</div>;
  }

  if (!execucao) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Execução não encontrada.
      </div>
    );
  }

  const duracaoMin = execucao.finalizadoEm
    ? Math.round(
        (new Date(execucao.finalizadoEm).getTime() -
          new Date(execucao.iniciadoEm).getTime()) /
          60000,
      )
    : null;

  const progresso =
    execucao.totalContribuintes && execucao.totalContribuintes > 0
      ? ((execucao.sucessos + execucao.erros) / execucao.totalContribuintes) * 100
      : 0;

  const errosPorUf = execucao.errosPorUf ?? {};
  const ufsComErro = Object.entries(errosPorUf).filter(([, n]) => n > 0);

  return (
    <>
      <div className="mb-4">
        <Link
          to="/execucoes"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para execuções
        </Link>
      </div>

      <PageHeader
        title={`Execução ${execucao.id.slice(0, 8)}`}
        subtitle={`${TIPO_LABEL[execucao.tipo]} — disparado por ${execucao.disparadoPor ?? 'sistema'}`}
        actions={
          <Badge variant={STATUS_BADGE[execucao.status]}>{STATUS_LABEL[execucao.status]}</Badge>
        }
      />

      {execucao.status === 'EM_EXECUCAO' && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-900">
            <RefreshCw className="h-4 w-4 animate-spin" /> Processando jobs em paralelo
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(progresso, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-blue-800">
            <span>
              {execucao.sucessos + execucao.erros} / {execucao.totalContribuintes ?? '?'} processados
            </span>
            <span>{progresso.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Métricas principais */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <MetricCard
          label="Total processado"
          value={execucao.totalContribuintes?.toLocaleString('pt-BR') ?? '-'}
        />
        <MetricCard
          label="Sucessos"
          value={execucao.sucessos.toLocaleString('pt-BR')}
          color="green"
        />
        <MetricCard
          label="Erros"
          value={execucao.erros.toLocaleString('pt-BR')}
          color={execucao.erros > 0 ? 'red' : 'gray'}
        />
        <MetricCard label="Duração" value={duracaoMin !== null ? `${duracaoMin} min` : 'em curso'} />
      </div>

      {/* Linha do tempo */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Timeline
        </h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row label="Iniciado em" value={new Date(execucao.iniciadoEm).toLocaleString('pt-BR')} />
          <Row
            label="Finalizado em"
            value={
              execucao.finalizadoEm
                ? new Date(execucao.finalizadoEm).toLocaleString('pt-BR')
                : '(em andamento)'
            }
          />
          <Row label="Tipo" value={TIPO_LABEL[execucao.tipo]} />
          <Row label="Disparado por" value={execucao.disparadoPor ?? '-'} />
        </dl>
      </div>

      {/* Erros por UF */}
      {ufsComErro.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/50 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Erros por UF
          </h3>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {ufsComErro.map(([uf, count]) => (
              <div
                key={uf}
                className="flex items-center justify-between rounded bg-white px-3 py-2 font-mono"
              >
                <span className="font-semibold text-amber-900">{uf}</span>
                <span className="text-amber-700">{count} erro(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas enviados */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Mail className="h-4 w-4" /> Alertas enviados
          </h3>
        </div>
        {execucao.alertas.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Nenhum alerta enviado ainda — digest é disparado automaticamente ao final da execução.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {execucao.alertas.map((a) => (
              <li key={a.id} className="p-5">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{a.assunto}</span>
                      {a.fallback && <Badge variant="yellow">Fallback</Badge>}
                      {a.erro && <Badge variant="red">Erro SMTP</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(a.enviadoEm).toLocaleString('pt-BR')} • {a.totalDestinatarios} destinatário(s) •
                      {' '}
                      {a.totalMudancas} mudança(s)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.destinatarios.map((d, i) => (
                        <span
                          key={i}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700"
                        >
                          {d.email}
                        </span>
                      ))}
                    </div>
                    {a.erro && (
                      <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">
                        {a.erro}
                      </div>
                    )}
                  </div>
                  {canReenviar && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReenviarAlerta(a.id)}
                      loading={reenviando === a.id}
                    >
                      Reenviar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: string;
  color?: 'gray' | 'green' | 'red';
}) {
  const valueColor: Record<string, string> = {
    gray: 'text-slate-900',
    green: 'text-emerald-700',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueColor[color]}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}
