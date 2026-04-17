import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  PauseCircle,
  CalendarClock,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Header } from '../layouts/Header';
import { Badge } from '../components/Badge';
import { SefazCaStatusCard } from '../components/SefazCaStatusCard';
import type {
  AmbienteStatus,
  CadastroSincronizacao,
  SchedulerStatus,
  StatusSincronizacao,
  TipoSincronizacao,
} from '../types';

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  BOOTSTRAP: 'Bootstrap',
  SEMANAL_AUTO: 'Semanal auto',
  DIARIA_AUTO: 'Diária auto',
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

export function DashboardPage() {
  const [status, setStatus] = useState<AmbienteStatus | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [ultimas, setUltimas] = useState<CadastroSincronizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ambRes, schedRes, execRes] = await Promise.allSettled([
          fiscalApi.get<AmbienteStatus>('/ambiente'),
          fiscalApi.get<SchedulerStatus>('/cruzamento/scheduler/status'),
          fiscalApi.get<CadastroSincronizacao[]>('/cruzamento/execucoes?limit=5'),
        ]);
        if (ambRes.status === 'fulfilled') setStatus(ambRes.value.data);
        else setError('Falha ao carregar ambiente.');
        if (schedRes.status === 'fulfilled') setScheduler(schedRes.value.data);
        if (execRes.status === 'fulfilled') setUltimas(execRes.value.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-slate-500">Carregando…</div>;

  if (error || !status) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>{error}</div>
      </div>
    );
  }

  const { usuario, fiscalRole } = useAuth();

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Bem-vindo, {usuario?.nome}!</h1>
        <p className="text-sm text-slate-500">Módulo Fiscal — Role: {fiscalRole}</p>
      </div>

      <div className="mb-6">
        <SefazCaStatusCard />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Ambiente SEFAZ">
          <div className="flex items-center gap-3">
            <Badge variant={status.ambienteAtivo === 'PRODUCAO' ? 'green' : 'yellow'}>
              {status.ambienteAtivo === 'PRODUCAO' ? 'Produção' : 'Homologação'}
            </Badge>
            {status.ambienteAtivo === 'HOMOLOGACAO' && (
              <span className="text-xs text-slate-500">
                Valores de teste — consultas reais exigem produção
              </span>
            )}
          </div>
        </Card>

        <Card title="Bootstrap inicial">
          <div className="flex items-center gap-3">
            {status.bootstrapConcluido ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-slate-900">Concluído</div>
                  {status.bootstrapConcluidoEm && (
                    <div className="text-xs text-slate-500">
                      {new Date(status.bootstrapConcluidoEm).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <div className="text-sm font-medium text-slate-900">Pendente</div>
                  <div className="text-xs text-slate-500">Cruzamento inicial ainda não executado</div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Sincronização automática">
          <div className="flex items-center gap-3">
            {status.pauseSync ? (
              <>
                <PauseCircle className="h-5 w-5 text-red-600" />
                <div>
                  <div className="text-sm font-medium text-red-700">Pausada</div>
                  <div className="text-xs text-slate-500">Freio de mão ativado pelo ADMIN_TI</div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="text-sm font-medium text-slate-900">Ativa</div>
                  <div className="text-xs text-slate-500">Rotinas agendadas executando</div>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Próximas execuções agendadas">
          {scheduler ? (
            <div className="space-y-2 text-xs">
              {scheduler.semanal && (
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-medium">Semanal:</span>
                  <span className="text-slate-600">
                    {scheduler.semanal.proxima
                      ? new Date(scheduler.semanal.proxima).toLocaleString('pt-BR')
                      : 'não agendada'}
                  </span>
                </div>
              )}
              {scheduler.diaria && (
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-medium">Diária:</span>
                  <span className="text-slate-600">
                    {scheduler.diaria.proxima
                      ? new Date(scheduler.diaria.proxima).toLocaleString('pt-BR')
                      : 'não agendada'}
                  </span>
                </div>
              )}
              {!scheduler.semanal && !scheduler.diaria && (
                <div className="text-xs text-slate-500">Scheduler ainda não inicializou.</div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Indisponível.</div>
          )}
        </Card>
      </div>

      {/* Últimas execuções */}
      <div className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4" /> Últimas 5 execuções
          </h3>
          <Link
            to="/execucoes"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {ultimas.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Nenhuma execução registrada ainda.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimas.map((e) => {
              const duracao = e.finalizadoEm
                ? Math.round(
                    (new Date(e.finalizadoEm).getTime() - new Date(e.iniciadoEm).getTime()) / 60000,
                  )
                : null;
              return (
                <li key={e.id} className="px-5 py-3">
                  <Link to={`/execucoes/${e.id}`} className="block hover:bg-slate-50/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={STATUS_BADGE[e.status]}>{TIPO_LABEL[e.tipo]}</Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(e.iniciadoEm).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-600">
                          Total:{' '}
                          <strong>{e.totalContribuintes?.toLocaleString('pt-BR') ?? '-'}</strong>
                        </span>
                        <span className="text-emerald-700">
                          OK: <strong>{e.sucessos}</strong>
                        </span>
                        {e.erros > 0 && (
                          <span className="text-red-700">
                            Erros: <strong>{e.erros}</strong>
                          </span>
                        )}
                        {duracao !== null && <span className="text-slate-500">{duracao} min</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="mb-1 font-medium">Use cases do módulo</div>
        <ul className="list-inside list-disc space-y-1 text-xs">
          <li>
            <strong>Consulta NF-e/CT-e</strong> — baixe XMLs faltantes do SEFAZ e alimente o
            monitor de entrada de mercadoria do Protheus.
          </li>
          <li>
            <strong>Consulta cadastral</strong> — valide um CNPJ antes de cadastrar um novo
            cliente/fornecedor OU verifique a situação de contribuintes existentes.
          </li>
          <li>
            <strong>Cruzamento SA1/SA2 × SEFAZ</strong> — detecte contribuintes inaptos antes de
            operar com eles, com alertas consolidados por e-mail.
          </li>
        </ul>
      </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}
