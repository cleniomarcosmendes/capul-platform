import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  CalendarClock,
  ArrowRight,
  Activity,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Globe2,
  Zap,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Header } from '../layouts/Header';
import { Badge } from '../components/Badge';
import type {
  DashboardOverview,
  StatusSincronizacao,
  TipoSincronizacao,
} from '../types';

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  MOVIMENTO_MEIO_DIA: 'Meio-dia',
  MOVIMENTO_MANHA_SEGUINTE: 'Manhã seguinte',
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

export function DashboardPage() {
  const { usuario, fiscalRole } = useAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: resp } = await fiscalApi.get<DashboardOverview>('/dashboard');
        setData(resp);
      } catch {
        setError('Falha ao carregar dashboard.');
      } finally {
        setLoading(false);
      }
    })();
    const timer = setInterval(async () => {
      try {
        const { data: resp } = await fiscalApi.get<DashboardOverview>('/dashboard');
        setData(resp);
      } catch {
        // silent retry
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6 text-slate-500">Carregando…</div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6">
          <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>{error ?? 'Erro desconhecido.'}</div>
          </div>
        </div>
      </>
    );
  }

  const alertas = buildAlertas(data);

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Bem-vindo, {usuario?.nome}</h1>
          <p className="text-sm text-slate-500">Módulo Fiscal — Role: {fiscalRole}</p>
        </div>

        {/* Alertas no topo — só aparece se houver */}
        {alertas.length > 0 && (
          <div className="mb-6 space-y-2">
            {alertas.map((a, i) => (
              <AlertaRow key={i} tipo={a.tipo} titulo={a.titulo} descricao={a.descricao} cta={a.cta} />
            ))}
          </div>
        )}

        {/* KPIs principais em grid */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ConsumoCard consumo={data.consumoDiario} />
          <DivergenciasCard divergencias={data.divergencias} />
          <AmbienteCard ambiente={data.ambiente} />
          <CertificadoCard cert={data.certificado} />
        </div>

        {/* Segunda linha: scheduler + UFs + próxima execução */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <SchedulerCard scheduler={data.scheduler} pauseSync={data.ambiente.pauseSync} />
          <UfsBloqueadasCard ufs={data.ufsBloqueadas} />
        </div>

        {/* Últimas execuções */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
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
          {data.ultimasExecucoes.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">Nenhuma execução registrada ainda.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.ultimasExecucoes.map((e) => {
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
      </div>
    </>
  );
}

// ----- Cards -----

function ConsumoCard({ consumo }: { consumo: DashboardOverview['consumoDiario'] }) {
  const pct = (consumo.percentual * 100).toFixed(1);
  const cor =
    consumo.nivel === 'critico'
      ? 'red'
      : consumo.nivel === 'vermelho'
        ? 'red'
        : consumo.nivel === 'amarelo'
          ? 'amber'
          : 'emerald';
  return (
    <Link to="/operacao/controle/limites" className="block">
      <Card titulo="Consumo SEFAZ hoje" icone={<Gauge className="h-4 w-4" />} cor={cor}>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${corTextoPorNivel(cor)}`}>{consumo.contador}</span>
          <span className="text-sm text-slate-500">/ {consumo.limite}</span>
        </div>
        <div className="mt-1 text-xs text-slate-600">{pct}% — limite diário</div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full ${
              cor === 'red' ? 'bg-red-500' : cor === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, consumo.percentual * 100)}%` }}
          />
        </div>
      </Card>
    </Link>
  );
}

function DivergenciasCard({
  divergencias,
}: {
  divergencias: DashboardOverview['divergencias'];
}) {
  const total = divergencias.abertasTotal;
  const critALTA = divergencias.porCriticidade.CRITICA + divergencias.porCriticidade.ALTA;
  const cor = critALTA > 0 ? 'red' : total > 0 ? 'amber' : 'slate';
  return (
    <Link to="/divergencias" className="block">
      <Card
        titulo="Divergências abertas"
        icone={<AlertTriangle className="h-4 w-4" />}
        cor={cor}
      >
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${corTextoPorNivel(cor)}`}>{total}</span>
          <span className="text-sm text-slate-500">Protheus × SEFAZ</span>
        </div>
        <div className="mt-1 text-xs text-slate-600">
          {critALTA > 0 ? (
            <span className="text-red-700 font-medium">
              {critALTA} com criticidade ALTA/CRÍTICA
            </span>
          ) : total > 0 ? (
            'Apenas divergências menores'
          ) : (
            'Nenhuma divergência detectada'
          )}
        </div>
      </Card>
    </Link>
  );
}

function AmbienteCard({ ambiente }: { ambiente: DashboardOverview['ambiente'] }) {
  const cor = ambiente.pauseSync ? 'red' : ambiente.ativo === 'PRODUCAO' ? 'emerald' : 'amber';
  return (
    <Link to="/operacao/controle/ambiente" className="block">
      <Card titulo="Ambiente" icone={<Globe2 className="h-4 w-4" />} cor={cor}>
        <div className="flex items-center gap-2">
          <Badge variant={ambiente.ativo === 'PRODUCAO' ? 'green' : 'yellow'}>
            {ambiente.ativo}
          </Badge>
          {ambiente.pauseSync && (
            <Badge variant="red">
              <PauseCircle className="mr-1 inline h-3 w-3" /> Pausado
            </Badge>
          )}
        </div>
        <div className="mt-1 text-xs text-slate-600">
          {ambiente.pauseSync
            ? 'Freio de mão ativo — rotinas automáticas paradas'
            : 'Rotinas automáticas ativas'}
        </div>
      </Card>
    </Link>
  );
}

function CertificadoCard({ cert }: { cert: DashboardOverview['certificado'] }) {
  if (!cert) {
    return (
      <Card titulo="Certificado A1" icone={<ShieldAlert className="h-4 w-4" />} cor="red">
        <div className="text-sm font-medium text-red-700">Nenhum ativo</div>
        <div className="mt-1 text-xs text-slate-600">
          Fazer upload no Configurador antes de consultar SEFAZ
        </div>
      </Card>
    );
  }
  const cor = cert.diasParaVencer <= 7 ? 'red' : cert.diasParaVencer <= 30 ? 'amber' : 'emerald';
  return (
    <Card titulo="Certificado A1" icone={<ShieldCheck className="h-4 w-4" />} cor={cor}>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${corTextoPorNivel(cor)}`}>
          {cert.diasParaVencer}
        </span>
        <span className="text-sm text-slate-500">dias restantes</span>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        CNPJ {cert.cnpj} · vence {new Date(cert.validoAte).toLocaleDateString('pt-BR')}
      </div>
    </Card>
  );
}

function SchedulerCard({
  scheduler,
  pauseSync,
}: {
  scheduler: DashboardOverview['scheduler'];
  pauseSync: boolean;
}) {
  return (
    <Card
      titulo="Próximas corridas automáticas"
      icone={<CalendarClock className="h-4 w-4" />}
      cor={pauseSync ? 'red' : 'slate'}
    >
      {pauseSync && (
        <div className="mb-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
          Freio de mão ativo — corridas automáticas não executarão
        </div>
      )}
      <ul className="space-y-1.5 text-xs">
        {scheduler.meioDia && (
          <li className="flex items-center justify-between">
            <span className="text-slate-700">
              <strong>Meio-dia</strong> — NFs saída 00:00 → 12:00
            </span>
            <span className="font-mono text-slate-600">
              {scheduler.meioDia.proxima
                ? new Date(scheduler.meioDia.proxima).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </li>
        )}
        {scheduler.manhaSeguinte && (
          <li className="flex items-center justify-between">
            <span className="text-slate-700">
              <strong>Manhã seguinte</strong> — NFs saída 12:00 → 23:59
            </span>
            <span className="font-mono text-slate-600">
              {scheduler.manhaSeguinte.proxima
                ? new Date(scheduler.manhaSeguinte.proxima).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </li>
        )}
        {!scheduler.meioDia && !scheduler.manhaSeguinte && (
          <li className="text-slate-500">Scheduler ainda não inicializou.</li>
        )}
      </ul>
    </Card>
  );
}

function UfsBloqueadasCard({ ufs }: { ufs: DashboardOverview['ufsBloqueadas'] }) {
  if (ufs.length === 0) {
    return (
      <Card titulo="Circuit Breaker por UF" icone={<CheckCircle2 className="h-4 w-4" />} cor="emerald">
        <div className="text-sm font-medium text-emerald-700">Todas UFs operando</div>
        <div className="mt-1 text-xs text-slate-600">Nenhum disjuntor aberto</div>
      </Card>
    );
  }
  return (
    <Link to="/operacao/diagnostico/circuit-breaker" className="block">
      <Card titulo="Circuit Breaker por UF" icone={<Zap className="h-4 w-4" />} cor="red">
        <div className="flex flex-wrap gap-1.5">
          {ufs.map((u) => (
            <Badge key={u.uf} variant={u.estado === 'ABERTO' ? 'red' : 'yellow'}>
              {u.uf} {u.estado === 'MEIO_ABERTO' && '↻'}
            </Badge>
          ))}
        </div>
        <div className="mt-2 text-xs text-slate-600">
          {ufs.filter((u) => u.estado === 'ABERTO').length} UF(s) bloqueadas
        </div>
      </Card>
    </Link>
  );
}

// ----- Alertas topo -----

interface AlertaTopo {
  tipo: 'red' | 'amber';
  titulo: string;
  descricao: string;
  cta?: { to: string; label: string };
}

function buildAlertas(d: DashboardOverview): AlertaTopo[] {
  const out: AlertaTopo[] = [];
  if (d.consumoDiario.pausadoAutomatico) {
    out.push({
      tipo: 'red',
      titulo: 'Limite diário SEFAZ atingido — corte automático ativo',
      descricao: 'Consultas SEFAZ pausadas até 00:00. ADMIN_TI pode liberar manualmente.',
      cta: { to: '/operacao/limites', label: 'Liberar' },
    });
  } else if (d.consumoDiario.nivel === 'vermelho') {
    out.push({
      tipo: 'red',
      titulo: 'Consumo SEFAZ atingiu 90% do limite diário',
      descricao: 'Avaliar origem do consumo. Em 10% restantes, a plataforma pausa automaticamente.',
      cta: { to: '/operacao/limites', label: 'Ver detalhes' },
    });
  } else if (d.consumoDiario.nivel === 'amarelo') {
    out.push({
      tipo: 'amber',
      titulo: 'Consumo SEFAZ atingiu 80% do limite diário',
      descricao: 'Monitorar consumo ao longo do dia.',
    });
  }
  if (d.ambiente.pauseSync) {
    out.push({
      tipo: 'red',
      titulo: 'Sincronização automática pausada (freio de mão)',
      descricao: 'Corridas 12:00 / 06:00 não executarão até ser liberado pelo ADMIN_TI.',
      cta: { to: '/operacao/ambiente', label: 'Gerenciar' },
    });
  }
  if (d.certificado && d.certificado.diasParaVencer <= 30) {
    out.push({
      tipo: d.certificado.diasParaVencer <= 7 ? 'red' : 'amber',
      titulo: `Certificado A1 vence em ${d.certificado.diasParaVencer} dia(s)`,
      descricao: `CNPJ ${d.certificado.cnpj} — renovar com a AC e fazer upload no Configurador.`,
    });
  }
  if (d.divergencias.porCriticidade.CRITICA > 0 || d.divergencias.porCriticidade.ALTA > 0) {
    const total = d.divergencias.porCriticidade.CRITICA + d.divergencias.porCriticidade.ALTA;
    out.push({
      tipo: 'amber',
      titulo: `${total} divergência(s) ALTA/CRÍTICA aberta(s)`,
      descricao: 'Diferenças entre cadastro Protheus e dados oficiais SEFAZ.',
      cta: { to: '/divergencias', label: 'Resolver' },
    });
  }
  return out;
}

function AlertaRow({
  tipo,
  titulo,
  descricao,
  cta,
}: {
  tipo: 'red' | 'amber';
  titulo: string;
  descricao: string;
  cta?: { to: string; label: string };
}) {
  const bg = tipo === 'red' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const texto = tipo === 'red' ? 'text-red-900' : 'text-amber-900';
  const sub = tipo === 'red' ? 'text-red-800' : 'text-amber-800';
  const Icon = tipo === 'red' ? AlertCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 ${bg}`}>
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${texto}`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${texto}`}>{titulo}</p>
        <p className={`mt-0.5 text-xs ${sub}`}>{descricao}</p>
      </div>
      {cta && (
        <Link
          to={cta.to}
          className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
            tipo === 'red' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function Card({
  titulo,
  icone,
  cor,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  cor?: 'red' | 'amber' | 'emerald' | 'slate';
  children: React.ReactNode;
}) {
  const borderCor =
    cor === 'red'
      ? 'border-red-200'
      : cor === 'amber'
        ? 'border-amber-200'
        : cor === 'emerald'
          ? 'border-emerald-200'
          : 'border-slate-200';
  return (
    <div
      className={`rounded-lg border ${borderCor} bg-white p-4 shadow-sm transition hover:shadow-md`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {icone}
        {titulo}
      </div>
      {children}
    </div>
  );
}

function corTextoPorNivel(cor?: string): string {
  if (cor === 'red') return 'text-red-700';
  if (cor === 'amber') return 'text-amber-700';
  if (cor === 'emerald') return 'text-emerald-700';
  return 'text-slate-900';
}
