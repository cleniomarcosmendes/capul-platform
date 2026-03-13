import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { chamadoService } from '../services/chamado.service';
import { coreService } from '../services/core.service';
import { softwareService } from '../services/software.service';
import { gestaoApi, coreApi } from '../services/api';
import {
  Ticket, Clock, CheckCircle, AlertTriangle, Wrench, Users, AppWindow, KeyRound, DollarSign,
  FileText, Receipt, Activity, FolderKanban, Timer, Server, BookMarked, Star, MessageSquare,
  ListChecks, CircleDot, TrendingUp, TrendingDown, Minus, Layers, BarChart3, ClipboardList,
  MapPin, PieChart, BarChart2,
} from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import type { DashboardResumo, DashboardExecutivo, DashboardCsat, DashboardFinanceiro, DashboardDisponibilidade, Chamado, Departamento, Software, TipoAtivo } from '../types';
import type { LucideIcon } from 'lucide-react';

const prioridadeCores: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em Atendimento',
  PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
  REABERTO: 'Reaberto',
};

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700',
  RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
};

const tipoAtivoLabel: Record<TipoAtivo, string> = {
  SERVIDOR: 'Servidores', ESTACAO_TRABALHO: 'Estacoes', NOTEBOOK: 'Notebooks',
  IMPRESSORA: 'Impressoras', SWITCH: 'Switches', ROTEADOR: 'Roteadores',
  STORAGE: 'Storage', OUTRO: 'Outros',
};

const starColors = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-yellow-100 text-yellow-700',
  'bg-lime-100 text-lime-700',
  'bg-green-100 text-green-700',
];

const osStatusLabel: Record<string, string> = {
  ABERTA: 'Abertas', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluidas', CANCELADA: 'Canceladas',
};
const osStatusColor: Record<string, string> = {
  ABERTA: 'bg-blue-500', EM_EXECUCAO: 'bg-yellow-500', CONCLUIDA: 'bg-green-500', CANCELADA: 'bg-red-400',
};

type TabKey = 'suporte' | 'portfolio' | 'contratos' | 'sustentacao' | 'projetos' | 'infraestrutura' | 'executivo' | 'csat' | 'metricas_os' | 'financeiro' | 'disponibilidade';

const STAFF_ROLES = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
const MANAGERS = ['ADMIN', 'GESTOR_TI'];

const tabsDef: { key: TabKey; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { key: 'suporte', label: 'Suporte', icon: Ticket },
  { key: 'portfolio', label: 'Portfolio', icon: AppWindow, roles: STAFF_ROLES },
  { key: 'contratos', label: 'Contratos', icon: FileText, roles: STAFF_ROLES },
  { key: 'sustentacao', label: 'Sustentacao', icon: Activity, roles: STAFF_ROLES },
  { key: 'projetos', label: 'Projetos', icon: FolderKanban, roles: STAFF_ROLES },
  { key: 'infraestrutura', label: 'Infraestrutura', icon: Server, roles: STAFF_ROLES },
  { key: 'executivo', label: 'Executivo', icon: PieChart, roles: MANAGERS },
  { key: 'csat', label: 'Satisfacao (CSAT)', icon: Star, roles: MANAGERS },
  { key: 'metricas_os', label: 'Metricas OS', icon: ClipboardList, roles: MANAGERS },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign, roles: STAFF_ROLES },
  { key: 'disponibilidade', label: 'Disponibilidade', icon: BarChart2, roles: STAFF_ROLES },
];

interface CardItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

function CardGrid({ cards, cols = 'grid-cols-2 md:grid-cols-4' }: { cards: CardItem[]; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-200">
            <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}


function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTempo(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// === OS Dashboard types ===
interface OsDashboardData {
  periodo: { inicio: string; fim: string };
  resumo: {
    totalOs: number;
    totalAnterior: number;
    variacao: number | null;
    totalChamadosVinculados: number;
    mediaChamadosPorOs: number;
    concluidas: number;
    tempoMedioMinutos: number;
    tempoTotalHoras: number;
  };
  porStatus: { status: string; total: number }[];
  porFilial: { filialId: string; filialNome: string; total: number }[];
  porTecnico: { tecnicoId: string; tecnicoNome: string; totalOs: number }[];
  evolucaoMensal: { mes: string; total: number; concluidas: number; chamados: number }[];
}

// === Dashboard simplificado para USUARIO_FINAL ===

function DashboardUsuarioFinal({ usuario, pendentesCount }: { usuario: { nome: string } | null; pendentesCount: number }) {
  const [meusChamados, setMeusChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chamadoService.listar({})
      .then(setMeusChamados)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const abertos = meusChamados.filter((c) => c.status === 'ABERTO').length;
  const emAtendimento = meusChamados.filter((c) => c.status === 'EM_ATENDIMENTO').length;
  const pendentes = meusChamados.filter((c) => c.status === 'PENDENTE').length;
  const resolvidos = meusChamados.filter((c) => c.status === 'RESOLVIDO').length;
  const fechados = meusChamados.filter((c) => c.status === 'FECHADO').length;
  const reabertos = meusChamados.filter((c) => c.status === 'REABERTO').length;

  const ativos = meusChamados
    .filter((c) => !['FECHADO', 'CANCELADO'].includes(c.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <>
      <Header title="Meus Chamados" />
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800">
            Bem-vindo, {usuario?.nome}!
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Acompanhe seus chamados de T.I.
          </p>
        </div>

        {pendentesCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Voce tem {pendentesCount} chamado(s) pendente(s) de avaliacao
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Sua opiniao e importante para melhorar o atendimento
                </p>
              </div>
            </div>
            <Link
              to="/gestao-ti/chamados?pendentes=1"
              className="flex items-center gap-1.5 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 transition-colors"
            >
              <Star className="w-4 h-4" /> Avaliar
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : (
          <>
            <CardGrid
              cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
              cards={[
                { label: 'Abertos', value: abertos, icon: Ticket, color: 'bg-blue-100 text-blue-600' },
                { label: 'Em Atendimento', value: emAtendimento, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
                { label: 'Pendentes', value: pendentes, icon: AlertTriangle, color: 'bg-orange-100 text-orange-600' },
                { label: 'Resolvidos', value: resolvidos, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
                { label: 'Fechados', value: fechados, icon: CheckCircle, color: 'bg-slate-100 text-slate-600' },
                { label: 'Reabertos', value: reabertos, icon: MessageSquare, color: 'bg-purple-100 text-purple-600' },
              ]}
            />

            <div className="mt-6 bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Chamados em Andamento
                </h4>
                <Link to="/gestao-ti/chamados" className="text-xs text-capul-600 hover:underline">
                  Ver todos
                </Link>
              </div>
              {ativos.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-slate-400">Nenhum chamado em andamento</p>
                  <Link
                    to="/gestao-ti/chamados/novo"
                    className="inline-flex items-center gap-2 mt-3 text-sm text-capul-600 hover:underline"
                  >
                    <Ticket className="w-4 h-4" /> Abrir novo chamado
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {ativos.map((c) => (
                    <Link
                      key={c.id}
                      to={`/gestao-ti/chamados/${c.id}`}
                      className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-slate-400 font-mono">#{c.numero}</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{c.titulo}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[c.status]}`}>
                          {statusLabels[c.status]}
                        </span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${prioridadeCores[c.prioridade]}`}>
                          {c.prioridade}
                        </span>
                        <span className="text-xs text-slate-400">
                          {c.tecnico?.nome || 'Sem tecnico'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/gestao-ti/chamados/novo"
                className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-5 hover:border-capul-300 hover:bg-capul-50/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-capul-100 text-capul-600 flex items-center justify-center">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Abrir Novo Chamado</p>
                  <p className="text-xs text-slate-500 mt-0.5">Solicitar suporte ou reportar um problema</p>
                </div>
              </Link>
              <Link
                to="/gestao-ti/conhecimento"
                className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <BookMarked className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Base de Conhecimento</p>
                  <p className="text-xs text-slate-500 mt-0.5">Consultar artigos e tutoriais</p>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// === Tab Content: Executivo ===
function ExecSection({ icon: Icon, title, link, linkLabel, color, children }: {
  icon: typeof Ticket; title: string; link: string; linkLabel?: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{title}</h4>
        </div>
        <Link to={link} className="text-xs text-capul-600 hover:underline">{linkLabel || 'Ver'}</Link>
      </div>
      {children}
    </div>
  );
}

function ExecKpi({ label, value, color = 'text-slate-800' }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-400 leading-tight">{label}</p>
    </div>
  );
}

function TabExecutivo({ data }: { data: DashboardExecutivo }) {
  return (
    <div className="space-y-4">
      {/* Linha 1: Suporte (destaque, ocupa toda a largura) */}
      <ExecSection icon={Ticket} title="Suporte" link="/gestao-ti/chamados" color="bg-blue-100 text-blue-600">
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-4">
          <ExecKpi label="Abertos" value={data.chamados.abertos} color="text-blue-600" />
          <ExecKpi label="Em Atendimento" value={data.chamados.emAtendimento} color="text-amber-600" />
          <ExecKpi label="Pendentes" value={data.chamados.pendentes} color="text-orange-600" />
          <ExecKpi label="Fechados/Periodo" value={data.chamados.fechadosMes} color="text-green-600" />
          <ExecKpi label="SLA Estourado" value={data.chamados.slaEstourado} color={data.chamados.slaEstourado > 0 ? 'text-red-600' : 'text-green-600'} />
          <ExecKpi label="Tempo Medio" value={`${data.chamados.tempoMedioResolucaoHoras}h`} />
          <ExecKpi label="SLA Compliance" value={`${data.chamados.slaCompliancePercent}%`} color={data.chamados.slaCompliancePercent >= 90 ? 'text-green-600' : 'text-red-600'} />
        </div>
      </ExecSection>

      {/* Linha 2: Grid 2 colunas — Contratos + Sustentacao */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExecSection icon={FileText} title="Contratos" link="/gestao-ti/contratos" color="bg-indigo-100 text-indigo-600">
          <div className="grid grid-cols-2 gap-4">
            <ExecKpi label="Ativos" value={data.contratos.totalAtivos} color="text-indigo-600" />
            <ExecKpi label="Valor Comprometido" value={formatCurrency(data.contratos.valorComprometido)} />
            <ExecKpi label="Vencendo 30d" value={data.contratos.vencendo30d} color={data.contratos.vencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
            <ExecKpi label="Parcelas Atrasadas" value={data.contratos.parcelasAtrasadas} color={data.contratos.parcelasAtrasadas > 0 ? 'text-red-600' : 'text-green-600'} />
          </div>
        </ExecSection>

        <ExecSection icon={Activity} title="Sustentacao" link="/gestao-ti/paradas" color="bg-rose-100 text-rose-600">
          <div className="grid grid-cols-3 gap-4">
            <ExecKpi label="Paradas Ativas" value={data.sustentacao.paradasEmAndamento} color={data.sustentacao.paradasEmAndamento > 0 ? 'text-red-600' : 'text-green-600'} />
            <ExecKpi label="Paradas/Periodo" value={data.sustentacao.totalParadasMes} />
            <ExecKpi label="MTTR" value={data.sustentacao.mttrFormatado || '—'} />
          </div>
        </ExecSection>
      </div>

      {/* Linha 3: Projetos (toda largura) */}
      <ExecSection icon={FolderKanban} title="Projetos" link="/gestao-ti/projetos" color="bg-capul-100 text-capul-600">
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
          <ExecKpi label="Ativos" value={data.projetos.totalAtivos} color="text-capul-600" />
          <ExecKpi label="Em Andamento" value={data.projetos.emAndamento} color="text-blue-600" />
          <ExecKpi label="Custo Previsto" value={formatCurrency(data.projetos.custoPrevistoTotal)} />
          <ExecKpi label="Custo Realizado" value={formatCurrency(data.projetos.custoRealizadoTotal)} />
          <ExecKpi label="Riscos Abertos" value={data.projetos.riscosAbertos} color={data.projetos.riscosAbertos > 0 ? 'text-amber-600' : 'text-green-600'} />
        </div>
      </ExecSection>

      {/* Linha 4: Grid 2 colunas — Portfolio + Infraestrutura */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExecSection icon={AppWindow} title="Portfolio" link="/gestao-ti/softwares" color="bg-emerald-100 text-emerald-600">
          <div className="grid grid-cols-2 gap-4">
            <ExecKpi label="Softwares" value={data.portfolio.totalSoftwares} color="text-emerald-600" />
            <ExecKpi label="Licencas Ativas" value={data.portfolio.licencasAtivas} color="text-green-600" />
            <ExecKpi label="Vencendo 30d" value={data.portfolio.licencasVencendo30d} color={data.portfolio.licencasVencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
            <ExecKpi label="Custo Licencas" value={formatCurrency(data.portfolio.custoLicencas)} />
          </div>
        </ExecSection>

        <div className="space-y-4">
          <ExecSection icon={Server} title="Ativos de TI" link="/gestao-ti/ativos" color="bg-teal-100 text-teal-600">
            <div className="flex items-center gap-6">
              <ExecKpi label="Total Ativos" value={data.ativos.totalAtivos} color="text-teal-600" />
              <div className="flex flex-wrap gap-1.5">
                {data.ativos.porTipo.map((t) => (
                  <span key={t.tipo} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                    {tipoAtivoLabel[t.tipo] || t.tipo}: <strong>{t.total}</strong>
                  </span>
                ))}
              </div>
            </div>
          </ExecSection>

          <ExecSection icon={BookMarked} title="Conhecimento" link="/gestao-ti/conhecimento" color="bg-amber-100 text-amber-600">
            <ExecKpi label="Artigos Publicados" value={data.conhecimento.totalArtigosPublicados} color="text-amber-600" />
          </ExecSection>
        </div>
      </div>
    </div>
  );
}

// === Tab Content: CSAT ===
function TabCsat({ data }: { data: DashboardCsat }) {
  const maxDistribuicao = Math.max(...data.distribuicaoNotas.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.totalFechados}</p>
          <p className="text-xs text-slate-500 mt-1">Total Fechados</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <Star className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.totalAvaliados}</p>
          <p className="text-xs text-slate-500 mt-1">Total Avaliados</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.taxaResposta}%</p>
          <p className="text-xs text-slate-500 mt-1">Taxa de Resposta</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center mb-3">
            <Star className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.csatMedio}</p>
          <p className="text-xs text-slate-500 mt-1">CSAT Medio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuicao de Notas */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <Star className="w-4 h-4" /> Distribuicao de Notas
            </h4>
          </div>
          <div className="px-6 py-4 space-y-3">
            {data.distribuicaoNotas.map((d) => (
              <div key={d.nota} className="flex items-center gap-3">
                <span className={`text-sm font-medium w-20 px-2 py-1 rounded-full text-center ${starColors[d.nota - 1]}`}>
                  {d.nota} estrela{d.nota > 1 ? 's' : ''}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-4">
                  <div
                    className="bg-amber-400 h-4 rounded-full transition-all"
                    style={{ width: `${(d.total / maxDistribuicao) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 w-8 text-right">{d.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evolucao Mensal */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Evolucao Mensal (6 meses)
            </h4>
          </div>
          <div className="px-6 py-4">
            {data.evolucaoMensal.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum dado disponivel</p>
            ) : (
              <div className="space-y-3">
                {data.evolucaoMensal.map((item) => (
                  <div key={item.mes} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 w-20">{item.mes}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(item.media) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-10">{item.media}</span>
                      <span className="text-xs text-slate-400">({item.total})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por Tecnico */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <Users className="w-4 h-4" /> Ranking por Tecnico
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {data.porTecnico.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">Nenhum dado</p>
            ) : (
              data.porTecnico.map((item) => (
                <div key={item.tecnico.id} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.tecnico.nome}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-3 h-3 ${n <= Math.round(item.media) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{item.media}</span>
                    <span className="text-xs text-slate-400">({item.total})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Por Equipe */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Por Equipe
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {data.porEquipe.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">Nenhum dado</p>
            ) : (
              data.porEquipe.map((item) => (
                <div key={item.equipe.id} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.equipe.sigla} - {item.equipe.nome}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-3 h-3 ${n <= Math.round(item.media) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{item.media}</span>
                    <span className="text-xs text-slate-400">({item.total})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Por Categoria/Servico */}
      {data.porCategoria.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700">Por Categoria de Servico (conforme catalogo)</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {data.porCategoria.map((item, idx) => (
              <div key={idx} className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-700">{item.servico?.nome || 'Sem servico'}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3 h-3 ${n <= Math.round(item.media) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{item.media}</span>
                  <span className="text-xs text-slate-400">({item.total} avaliacoes)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chamados Nota Baixa */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Chamados com Nota Baixa (1-2)
          </h4>
        </div>
        {data.chamadosNotaBaixa.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-slate-400">Nenhum chamado com nota baixa no periodo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Nota</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Solicitante</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Tecnico</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Equipe</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Comentario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.chamadosNotaBaixa.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">#{c.numero}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/gestao-ti/chamados/${c.id}`} className="text-capul-600 hover:underline">
                        {c.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= c.notaSatisfacao ? 'text-red-400 fill-red-400' : 'text-slate-300'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.solicitante.nome}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.tecnico?.nome || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.equipeAtual.sigla}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">
                      {c.comentarioSatisfacao || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// === Tab Content: Metricas OS ===
function TabMetricasOs({ data }: { data: OsDashboardData }) {
  const { resumo, porStatus, porFilial, porTecnico, evolucaoMensal } = data;
  const totalStatus = porStatus.reduce((a, s) => a + s.total, 0) || 1;
  const maxFilial = Math.max(...porFilial.map((f) => f.total), 1);
  const maxTecnico = Math.max(...porTecnico.map((t) => t.totalOs), 1);
  const maxEvolucao = Math.max(...evolucaoMensal.map((e) => e.total), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <OsKpiCard
          icon={ClipboardList}
          label="Total de OS"
          value={resumo.totalOs}
          variacao={resumo.variacao}
          subtext={`${resumo.totalAnterior} no periodo anterior`}
          color="bg-blue-50 text-blue-600"
        />
        <OsKpiCard
          icon={FileText}
          label="Chamados Atendidos"
          value={resumo.totalChamadosVinculados}
          subtext={`Media ${resumo.mediaChamadosPorOs} por OS`}
          color="bg-teal-50 text-teal-600"
        />
        <OsKpiCard
          icon={Clock}
          label="Tempo Medio"
          value={formatTempo(resumo.tempoMedioMinutos)}
          subtext={`${resumo.tempoTotalHoras}h total em campo`}
          color="bg-amber-50 text-amber-600"
        />
        <OsKpiCard
          icon={BarChart3}
          label="Taxa de Conclusao"
          value={resumo.totalOs > 0 ? `${Math.round((resumo.concluidas / resumo.totalOs) * 100)}%` : '—'}
          subtext={`${resumo.concluidas} de ${resumo.totalOs} concluidas`}
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Eficiencia card */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-6 text-white">
        <h3 className="text-sm font-medium opacity-80 mb-2">Indicador de Eficiencia da Visita</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-3xl font-bold">{resumo.mediaChamadosPorOs}</p>
            <p className="text-sm opacity-80">chamados por visita</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{resumo.tempoMedioMinutos > 0 && resumo.mediaChamadosPorOs > 0
              ? formatTempo(Math.round(resumo.tempoMedioMinutos / resumo.mediaChamadosPorOs)) : '—'}</p>
            <p className="text-sm opacity-80">tempo medio por chamado</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{resumo.tempoTotalHoras}h</p>
            <p className="text-sm opacity-80">investidas em visitas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Distribuicao por Status
          </h3>
          <div className="space-y-3">
            {['ABERTA', 'EM_EXECUCAO', 'CONCLUIDA', 'CANCELADA'].map((s) => {
              const item = porStatus.find((ps) => ps.status === s);
              const count = item?.total || 0;
              const pct = Math.round((count / totalStatus) * 100);
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">{osStatusLabel[s]}</span>
                    <span className="font-medium text-slate-800">{count} <span className="text-slate-400 text-xs">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${osStatusColor[s]} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Evolucao mensal */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Evolucao Mensal
          </h3>
          <div className="flex items-end gap-2 h-40">
            {evolucaoMensal.map((e) => (
              <div key={e.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '120px' }}>
                  <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                    <div className="w-3 bg-blue-400 rounded-t transition-all" title={`Total: ${e.total}`}
                      style={{ height: `${(e.total / maxEvolucao) * 100}%`, minHeight: e.total > 0 ? '4px' : '0' }} />
                    <div className="w-3 bg-green-400 rounded-t transition-all" title={`Concluidas: ${e.concluidas}`}
                      style={{ height: `${(e.concluidas / maxEvolucao) * 100}%`, minHeight: e.concluidas > 0 ? '4px' : '0' }} />
                    <div className="w-3 bg-teal-400 rounded-t transition-all" title={`Chamados: ${e.chamados}`}
                      style={{ height: `${(e.chamados / maxEvolucao) * 100}%`, minHeight: e.chamados > 0 ? '4px' : '0' }} />
                  </div>
                </div>
                <span className="text-xs text-slate-500">{e.mes}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400" /> Total OS</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400" /> Concluidas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-400" /> Chamados</span>
          </div>
        </div>

        {/* Top filiais */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Ranking de Filiais (mais visitadas)
          </h3>
          {porFilial.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados no periodo</p>
          ) : (
            <div className="space-y-3">
              {porFilial.sort((a, b) => b.total - a.total).slice(0, 10).map((f, i) => (
                <div key={f.filialId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">
                      <span className="text-slate-400 font-mono mr-2">#{i + 1}</span>
                      {f.filialNome}
                    </span>
                    <span className="font-medium text-slate-800">{f.total} OS</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-indigo-400 transition-all"
                      style={{ width: `${(f.total / maxFilial) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top tecnicos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Participacao por Tecnico
          </h3>
          {porTecnico.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Sem dados no periodo</p>
          ) : (
            <div className="space-y-3">
              {porTecnico.sort((a, b) => b.totalOs - a.totalOs).slice(0, 10).map((t, i) => (
                <div key={t.tecnicoId}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">
                      <span className="text-slate-400 font-mono mr-2">#{i + 1}</span>
                      {t.tecnicoNome}
                    </span>
                    <span className="font-medium text-slate-800">{t.totalOs} OS</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-purple-400 transition-all"
                      style={{ width: `${(t.totalOs / maxTecnico) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OsKpiCard({ icon: Icon, label, value, variacao, subtext, color }: {
  icon: typeof ClipboardList;
  label: string;
  value: string | number;
  variacao?: number | null;
  subtext: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
        {variacao !== undefined && variacao !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${variacao > 0 ? 'text-green-600' : variacao < 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {variacao > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : variacao < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {variacao > 0 ? '+' : ''}{variacao}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>
    </div>
  );
}

// === Tab Content: Financeiro ===
const finStatusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700', SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700', RENOVADO: 'bg-blue-100 text-blue-700', CANCELADO: 'bg-slate-200 text-slate-500',
};

function TabFinanceiro({ data }: { data: DashboardFinanceiro }) {
  const totalGeral = data.contratosPorTipo.reduce((s, t) => s + t.valorTotal, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos por Tipo */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Contratos Ativos por Tipo
            </h4>
          </div>
          <div className="px-6 py-4">
            {data.contratosPorTipo.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum contrato ativo</p>
            ) : (
              <div className="space-y-3">
                {data.contratosPorTipo.map((item, idx) => {
                  const pct = totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0;
                  return (
                    <div key={item.tipoContratoId || idx}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700">{item.tipoNome || 'Sem tipo'} ({item.total})</span>
                        <span className="font-medium text-slate-800">R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-capul-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-semibold text-slate-800">
                  <span>Total</span>
                  <span>R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Despesas por CC */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <PieChart className="w-4 h-4" /> Despesas por Centro de Custo
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {data.despesasPorCentroCusto.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">Nenhum rateio configurado</p>
            ) : (
              data.despesasPorCentroCusto.map((item) => (
                <div key={item.centroCusto.id} className="px-6 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-700">{item.centroCusto.codigo} - {item.centroCusto.nome}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contratos por Status */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700">Contratos por Status</h4>
          </div>
          <div className="px-6 py-4 flex flex-wrap gap-3">
            {data.contratosPorStatus.map((item) => (
              <div key={item.status} className={`px-4 py-2 rounded-lg text-sm ${finStatusCores[item.status] || 'bg-slate-100 text-slate-700'}`}>
                <span className="font-semibold text-lg mr-1">{item.total}</span>
                <span>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Parcelas Proximas */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Parcelas no Periodo
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {data.parcelasProximas.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400">Nenhuma parcela proxima</p>
            ) : (
              data.parcelasProximas.slice(0, 10).map((p) => {
                const vencido = new Date(p.dataVencimento) < new Date();
                return (
                  <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <Link to={`/gestao-ti/contratos/${p.contrato.id}`} className="text-sm text-capul-600 hover:underline">
                        #{p.contrato.numero} - {p.contrato.titulo}
                      </Link>
                      <p className="text-xs text-slate-400">Parcela #{p.numero} | {p.contrato.fornecedor}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-800">
                        R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className={`text-xs ${vencido ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        {vencido && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {new Date(p.dataVencimento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Contratos vencendo */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Contratos Vencendo no Periodo
          </h4>
        </div>
        {data.contratosVencendo.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-400">Nenhum contrato vencendo no periodo selecionado</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Titulo</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Fornecedor</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Software</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
                <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
                <th className="text-right px-4 py-2 font-medium text-slate-600">Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.contratosVencendo.map((c) => {
                const dias = Math.ceil((new Date(c.dataFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{c.numero}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/gestao-ti/contratos/${c.id}`} className="text-capul-600 hover:underline">{c.titulo}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{c.fornecedor}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.software?.nome || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                      R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{new Date(c.dataFim).toLocaleDateString('pt-BR')}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${dias <= 30 ? 'text-red-600' : dias <= 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {dias}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// === Tab Content: Disponibilidade ===
const dispTipoLabel: Record<string, string> = {
  PARADA_PROGRAMADA: 'Programada', PARADA_NAO_PROGRAMADA: 'Nao Programada', MANUTENCAO_PREVENTIVA: 'Manut. Preventiva',
};
const dispImpactoLabel: Record<string, string> = { TOTAL: 'Total', PARCIAL: 'Parcial' };
const dispStatusLabel: Record<string, string> = { EM_ANDAMENTO: 'Em Andamento', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada' };
const dispStatusCores: Record<string, string> = { EM_ANDAMENTO: 'bg-red-100 text-red-700', FINALIZADA: 'bg-green-100 text-green-700', CANCELADA: 'bg-slate-100 text-slate-600' };

function formatDuracao(minutos: number | null): string {
  if (minutos == null || minutos === 0) return '-';
  if (minutos < 1) return '< 1m';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function uptimeColor(pct: number): string {
  if (pct >= 99.9) return 'text-green-600';
  if (pct >= 99) return 'text-lime-600';
  if (pct >= 95) return 'text-yellow-600';
  return 'text-red-600';
}

interface FilialOption { id: string; codigo: string; nomeFantasia: string; }

function TabDisponibilidade({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const [dados, setDados] = useState<DashboardDisponibilidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroFilial, setFiltroFilial] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    coreApi.get('/filiais').then(({ data }) => setFiliais(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    dashboardService.getDisponibilidade({
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      softwareId: filtroSoftware || undefined,
      filialId: filtroFilial || undefined,
    })
      .then(setDados)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim, filtroSoftware, filtroFilial]);

  const uptimeMedio = dados && dados.disponibilidadePorSoftware.length > 0
    ? +(dados.disponibilidadePorSoftware.reduce((s, d) => s + d.uptimePercent, 0) / dados.disponibilidadePorSoftware.length).toFixed(2)
    : 100;

  return (
    <div className="space-y-6">
      {/* Filtros extras */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <select value={filtroSoftware} onChange={(e) => setFiltroSoftware(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todos Softwares</option>
          {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Todas Filiais</option>
          {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : !dados ? (
        <p className="text-slate-500">Erro ao carregar dados</p>
      ) : (
        <>
          {/* Cards Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-3">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-red-600">{dados.resumo.paradasEmAndamento}</p>
              <p className="text-xs text-slate-500 mt-1">Em Andamento</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{dados.resumo.totalParadasPeriodo}</p>
              <p className="text-xs text-slate-500 mt-1">Total no Periodo</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{dados.resumo.mttrFormatado}</p>
              <p className="text-xs text-slate-500 mt-1">MTTR</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <BarChart2 className="w-5 h-5" />
              </div>
              <p className={`text-2xl font-bold ${uptimeColor(uptimeMedio)}`}>{uptimeMedio}%</p>
              <p className="text-xs text-slate-500 mt-1">Uptime Medio</p>
            </div>
          </div>

          {/* Disponibilidade por Software */}
          {dados.disponibilidadePorSoftware.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700">Uptime por Software</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-3 font-medium text-slate-600">Software</th>
                      <th className="px-4 py-3 font-medium text-slate-600">Criticidade</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-right">Uptime %</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-right">Downtime</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-right">Paradas</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-right">Total</th>
                      <th className="px-4 py-3 font-medium text-slate-600 text-right">Parcial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dados.disponibilidadePorSoftware.map((sw) => (
                      <tr key={sw.software.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">{sw.software.nome}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{sw.software.criticidade || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${uptimeColor(sw.uptimePercent)}`}>{sw.uptimePercent}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{sw.downtimeHoras}h</td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium">{sw.totalParadas}</td>
                        <td className="px-4 py-3 text-right text-red-600">{sw.paradasTotal}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{sw.paradasParcial}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paradas por tipo e impacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700">Paradas por Tipo</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {dados.paradasPorTipo.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-slate-400">Nenhum dado</p>
                ) : (
                  dados.paradasPorTipo.map((item) => (
                    <div key={item.tipo} className="px-6 py-3 flex items-center justify-between">
                      <span className="text-sm text-slate-700">{dispTipoLabel[item.tipo] || item.tipo}</span>
                      <span className="text-sm font-semibold text-slate-800">{item.total}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700">Paradas por Impacto</h4>
              </div>
              <div className="divide-y divide-slate-100">
                {dados.paradasPorImpacto.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-slate-400">Nenhum dado</p>
                ) : (
                  dados.paradasPorImpacto.map((item) => (
                    <div key={item.impacto} className="px-6 py-3 flex items-center justify-between">
                      <span className="text-sm text-slate-700">{dispImpactoLabel[item.impacto] || item.impacto}</span>
                      <span className="text-sm font-semibold text-slate-800">{item.total}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Paradas Recentes */}
          {dados.paradasRecentes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="font-semibold text-slate-700">Paradas Recentes</h4>
                <Link to="/gestao-ti/paradas" className="text-xs text-capul-600 hover:underline">Ver todas</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {dados.paradasRecentes.map((p) => (
                  <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${p.status === 'EM_ANDAMENTO' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                      <div>
                        <Link to={`/gestao-ti/paradas/${p.id}`} className="text-sm text-capul-600 hover:underline font-medium">
                          {p.titulo}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {p.software.nome}{p.softwareModulo ? ` / ${p.softwareModulo.nome}` : ''} — {new Date(p.inicio).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dispStatusCores[p.status]}`}>
                        {dispStatusLabel[p.status]}
                      </span>
                      <span className="text-xs text-slate-500">{formatDuracao(p.duracaoMinutos)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// === Dashboard completo para STAFF ===

export function DashboardPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('suporte');
  const [pendentesCount, setPendentesCount] = useState(0);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filterDepartamento, setFilterDepartamento] = useState('');

  // Extra data for consolidated tabs
  const [executivoData, setExecutivoData] = useState<DashboardExecutivo | null>(null);
  const [executivoLoading, setExecutivoLoading] = useState(false);
  const [csatData, setCsatData] = useState<DashboardCsat | null>(null);
  const [csatLoading, setCsatLoading] = useState(false);
  const [osData, setOsData] = useState<OsDashboardData | null>(null);
  const [osLoading, setOsLoading] = useState(false);
  const [finData, setFinData] = useState<DashboardFinanceiro | null>(null);
  const [finLoading, setFinLoading] = useState(false);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(inicioMes.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  useEffect(() => {
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
  }, []);

  useEffect(() => {
    if (gestaoTiRole === 'USUARIO_FINAL') {
      chamadoService.listar({ pendentesAvaliacao: true })
        .then((list) => setPendentesCount(list.length))
        .catch(() => {});
    } else {
      setLoading(true);
      dashboardService
        .getResumo({ dataInicio, dataFim, departamentoId: filterDepartamento || undefined })
        .then(setResumo)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [gestaoTiRole, dataInicio, dataFim, filterDepartamento]);

  // Load executivo data lazily
  useEffect(() => {
    if (tab === 'executivo') {
      setExecutivoLoading(true);
      dashboardService.getExecutivo({ dataInicio, dataFim })
        .then(setExecutivoData)
        .catch(() => {})
        .finally(() => setExecutivoLoading(false));
    }
  }, [tab, dataInicio, dataFim]);

  // Load CSAT data lazily
  useEffect(() => {
    if (tab === 'csat') {
      setCsatLoading(true);
      dashboardService.getCsat({ dataInicio, dataFim, departamentoId: filterDepartamento || undefined })
        .then(setCsatData)
        .catch(() => {})
        .finally(() => setCsatLoading(false));
    }
  }, [tab, dataInicio, dataFim, filterDepartamento]);

  // Load financeiro data lazily
  useEffect(() => {
    if (tab === 'financeiro') {
      setFinLoading(true);
      dashboardService.getFinanceiro({ dataInicio, dataFim })
        .then(setFinData)
        .catch(() => {})
        .finally(() => setFinLoading(false));
    }
  }, [tab, dataInicio, dataFim]);

  // Load OS data lazily
  useEffect(() => {
    if (tab === 'metricas_os') {
      setOsLoading(true);
      gestaoApi.get('/dashboard/ordens-servico', { params: { dataInicio, dataFim } })
        .then(({ data }) => setOsData(data))
        .catch(() => {})
        .finally(() => setOsLoading(false));
    }
  }, [tab, dataInicio, dataFim]);

  // Dashboard simplificado para USUARIO_FINAL
  if (gestaoTiRole === 'USUARIO_FINAL') {
    return <DashboardUsuarioFinal usuario={usuario} pendentesCount={pendentesCount} />;
  }

  const isMetricTab = tab === 'executivo' || tab === 'csat' || tab === 'metricas_os' || tab === 'financeiro' || tab === 'disponibilidade';

  // Dashboard completo para STAFF
  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800">
            Bem-vindo, {usuario?.nome}!
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            Modulo Gestao de T.I. — Role: {gestaoTiRole}
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <PeriodFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            onPeriodChange={(inicio, fim) => { setDataInicio(inicio); setDataFim(fim); }}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Departamento:</label>
            <select
              value={filterDepartamento}
              onChange={(e) => setFilterDepartamento(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]"
            >
              <option value="">Todos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
          {tabsDef.filter((t) => !t.roles || (gestaoTiRole && t.roles.includes(gestaoTiRole))).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  tab === t.key
                    ? 'border-capul-600 text-capul-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Main dashboard tabs (use resumo data) */}
        {!isMetricTab && (
          <>
            {loading ? (
              <p className="text-slate-500">Carregando metricas...</p>
            ) : resumo ? (
              <>
                {/* Tab Suporte */}
                {tab === 'suporte' && (
                  <div className="space-y-6">
                    <CardGrid
                      cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
                      cards={[
                        { label: 'Abertos', value: resumo.chamados.abertos, icon: Ticket, color: 'bg-blue-100 text-blue-600' },
                        { label: 'Em Atendimento', value: resumo.chamados.emAtendimento, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
                        { label: 'Pendentes', value: resumo.chamados.pendentes, icon: AlertTriangle, color: 'bg-orange-100 text-orange-600' },
                        { label: 'Resolvidos', value: resumo.chamados.resolvidos, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
                        { label: 'Fechados', value: resumo.chamados.fechados, icon: CheckCircle, color: 'bg-slate-100 text-slate-600' },
                        { label: 'OS Abertas', value: resumo.ordensServico.abertas, icon: Wrench, color: 'bg-capul-100 text-capul-600' },
                      ]}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Chamados por Equipe
                          </h4>
                          <Link to="/gestao-ti/chamados" className="text-xs text-capul-600 hover:underline">
                            Ver todos
                          </Link>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {resumo.porEquipe.length === 0 ? (
                            <p className="px-6 py-4 text-sm text-slate-400">Nenhum chamado ativo</p>
                          ) : (
                            resumo.porEquipe.map((item) => (
                              <div key={item.equipe.id} className="px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.equipe.cor || '#006838' }}
                                  />
                                  <Link to={`/gestao-ti/chamados?equipeId=${item.equipe.id}`} className="text-sm text-slate-700 hover:text-capul-600 hover:underline">{item.equipe.nome}</Link>
                                  <span className="text-xs text-slate-400">({item.equipe.sigla})</span>
                                </div>
                                <Link to={`/gestao-ti/chamados?equipeId=${item.equipe.id}`} className="text-sm font-semibold text-slate-800 hover:text-capul-600">{item.total}</Link>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200">
                          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Chamados por Prioridade
                          </h4>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {resumo.porPrioridade.length === 0 ? (
                            <p className="px-6 py-4 text-sm text-slate-400">Nenhum chamado ativo</p>
                          ) : (
                            resumo.porPrioridade.map((item) => (
                              <div key={item.prioridade} className="px-6 py-3 flex items-center justify-between">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridadeCores[item.prioridade] || 'bg-slate-100 text-slate-600'}`}>
                                  {item.prioridade}
                                </span>
                                <span className="text-sm font-semibold text-slate-800">{item.total}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Portfolio */}
                {tab === 'portfolio' && resumo.portfolio && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Portfolio de Aplicacoes</h4>
                      <Link to="/gestao-ti/softwares" className="text-xs text-capul-600 hover:underline">Ver softwares</Link>
                    </div>
                    <CardGrid cards={[
                      { label: 'Softwares', value: resumo.portfolio.totalSoftwares, icon: AppWindow, color: 'bg-indigo-100 text-indigo-600' },
                      { label: 'Licencas Ativas', value: resumo.portfolio.totalLicencasAtivas, icon: KeyRound, color: 'bg-teal-100 text-teal-600' },
                      { label: 'Vencendo 30d', value: resumo.portfolio.licencasVencendo30d, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
                      { label: 'Custo Licencas', value: `R$ ${resumo.portfolio.custoAnualLicencas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
                    ]} />
                  </div>
                )}

                {/* Tab Contratos */}
                {tab === 'contratos' && resumo.contratos && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contratos</h4>
                      <Link to="/gestao-ti/contratos" className="text-xs text-capul-600 hover:underline">Ver contratos</Link>
                    </div>
                    <CardGrid cards={[
                      { label: 'Contratos Ativos', value: resumo.contratos.totalAtivos, icon: FileText, color: 'bg-sky-100 text-sky-600' },
                      { label: 'Valor Comprometido', value: `R$ ${resumo.contratos.valorTotalComprometido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-cyan-100 text-cyan-600' },
                      { label: 'Vencendo 30d', value: resumo.contratos.vencendo30d, icon: AlertTriangle, color: 'bg-rose-100 text-rose-600' },
                      { label: 'Parcelas Pendentes', value: resumo.contratos.parcelasPendentes, icon: Receipt, color: 'bg-orange-100 text-orange-600' },
                    ]} />
                  </div>
                )}

                {/* Tab Sustentacao */}
                {tab === 'sustentacao' && resumo.sustentacao && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sustentacao</h4>
                      <Link to="/gestao-ti/paradas" className="text-xs text-capul-600 hover:underline">Ver paradas</Link>
                    </div>
                    <CardGrid cards={[
                      { label: 'Paradas Ativas', value: resumo.sustentacao.paradasEmAndamento, icon: Activity, color: 'bg-red-100 text-red-600' },
                      { label: 'Paradas no Periodo', value: resumo.sustentacao.totalParadasMes, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
                    ]} />
                  </div>
                )}

                {/* Tab Projetos */}
                {tab === 'projetos' && resumo.projetos && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Projetos</h4>
                      <Link to="/gestao-ti/projetos" className="text-xs text-capul-600 hover:underline">Ver projetos</Link>
                    </div>
                    <CardGrid cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-3" cards={[
                      { label: 'Projetos Ativos', value: resumo.projetos.totalAtivos, icon: FolderKanban, color: 'bg-capul-100 text-capul-600' },
                      { label: 'Em Andamento', value: resumo.projetos.emAndamento, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
                      { label: 'Riscos Abertos', value: resumo.projetos.riscosAbertos, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
                    ]} />
                    {resumo.projetos.atividades && (
                      <>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-4">Atividades dos Projetos</h4>
                        <CardGrid cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-3" cards={[
                          { label: 'Pendentes', value: resumo.projetos.atividades.pendentes, icon: ListChecks, color: 'bg-slate-100 text-slate-600' },
                          { label: 'Em Andamento', value: resumo.projetos.atividades.emAndamento, icon: CircleDot, color: 'bg-blue-100 text-blue-600' },
                          { label: 'Concluidas', value: resumo.projetos.atividades.concluidas, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
                        ]} />
                      </>
                    )}
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-4">Financeiro</h4>
                    <CardGrid cols="grid-cols-2 md:grid-cols-3 lg:grid-cols-3" cards={[
                      { label: 'Custo Previsto', value: `R$ ${resumo.projetos.custoPrevistoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-cyan-100 text-cyan-600' },
                      { label: 'Custo Realizado', value: `R$ ${resumo.projetos.custoRealizadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-emerald-100 text-emerald-600' },
                      { label: 'Horas Apontadas', value: resumo.projetos.totalHorasApontadas, icon: Timer, color: 'bg-blue-100 text-blue-600' },
                    ]} />
                  </div>
                )}

                {/* Tab Infraestrutura */}
                {tab === 'infraestrutura' && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Infraestrutura & Conhecimento</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {resumo.ativos && (
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center mb-3">
                            <Server className="w-5 h-5" />
                          </div>
                          <p className="text-2xl font-bold text-slate-800">{resumo.ativos.totalAtivos}</p>
                          <p className="text-xs text-slate-500 mt-1">Ativos de TI</p>
                        </div>
                      )}
                      {resumo.conhecimento && (
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                            <BookMarked className="w-5 h-5" />
                          </div>
                          <p className="text-2xl font-bold text-slate-800">{resumo.conhecimento.totalArtigosPublicados}</p>
                          <p className="text-xs text-slate-500 mt-1">Artigos Publicados</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500">Erro ao carregar metricas</p>
            )}
          </>
        )}

        {/* Executivo tab */}
        {tab === 'executivo' && (
          executivoLoading ? (
            <p className="text-slate-500">Carregando metricas executivas...</p>
          ) : executivoData ? (
            <TabExecutivo data={executivoData} />
          ) : (
            <p className="text-slate-500">Erro ao carregar dados executivos</p>
          )
        )}

        {/* CSAT tab */}
        {tab === 'csat' && (
          csatLoading ? (
            <p className="text-slate-500">Carregando metricas CSAT...</p>
          ) : csatData ? (
            <TabCsat data={csatData} />
          ) : (
            <p className="text-slate-500">Erro ao carregar dados de satisfacao</p>
          )
        )}

        {/* Metricas OS tab */}
        {tab === 'metricas_os' && (
          osLoading ? (
            <p className="text-slate-500">Carregando metricas de OS...</p>
          ) : osData ? (
            <TabMetricasOs data={osData} />
          ) : (
            <p className="text-slate-500">Erro ao carregar dados de OS</p>
          )
        )}

        {/* Financeiro tab */}
        {tab === 'financeiro' && (
          finLoading ? (
            <p className="text-slate-500">Carregando dados financeiros...</p>
          ) : finData ? (
            <TabFinanceiro data={finData} />
          ) : (
            <p className="text-slate-500">Erro ao carregar dados financeiros</p>
          )
        )}

        {/* Disponibilidade tab */}
        {tab === 'disponibilidade' && (
          <TabDisponibilidade dataInicio={dataInicio} dataFim={dataFim} />
        )}
      </div>
    </>
  );
}
