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
  BOOTSTRAP: 'Bootstrap',
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

export function ExecucoesListPage() {
  const { fiscalRole } = useAuth();
  const canTrigger = hasMinRole(fiscalRole, 'ANALISTA_CADASTRO');
  const canCompleta = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const [execucoes, setExecucoes] = useState<CadastroSincronizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoSincronizacao | ''>('');
  const [error, setError] = useState<string | null>(null);
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

  async function handleTrigger(tipo: 'diaria-manual' | 'completa-manual' | 'bootstrap') {
    try {
      setTriggering(tipo);
      setError(null);
      await fiscalApi.post('/cruzamento/sincronizar', { tipo });
      await load();
    } catch (err) {
      setError(extractApiError(err, 'Falha ao disparar sincronização.'));
    } finally {
      setTriggering(null);
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
            onClick={() => handleTrigger('diaria-manual')}
            loading={triggering === 'diaria-manual'}
          >
            Disparar diária
          </Button>
          {canCompleta && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Database className="h-4 w-4" />}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Disparar carga completa?',
                  description:
                    'Isso vai re-consultar TODOS os contribuintes cadastrados nas SEFAZ de todas as UFs. O processo pode levar várias horas e consumirá cota significativa de chamadas SEFAZ. Use apenas quando necessário (bootstrap ou recuperação após incidente).',
                  variant: 'warning',
                  confirmLabel: 'Disparar carga completa',
                });
                if (ok) handleTrigger('completa-manual');
              }}
              loading={triggering === 'completa-manual'}
            >
              Carga completa
            </Button>
          )}
        </div>
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
                      <Link
                        to={`/execucoes/${e.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                      >
                        Detalhes <ArrowRight className="h-3 w-3" />
                      </Link>
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
