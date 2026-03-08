import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { chamadoService } from '../services/chamado.service';
import { coreService } from '../services/core.service';
import { Ticket, Clock, CheckCircle, AlertTriangle, Wrench, Users, AppWindow, KeyRound, DollarSign, FileText, Receipt, Activity, FolderKanban, Timer, Server, BookMarked, Star, MessageSquare, ListChecks, CircleDot } from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import type { DashboardResumo, Chamado, Departamento } from '../types';
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

type TabKey = 'suporte' | 'portfolio' | 'contratos' | 'sustentacao' | 'projetos' | 'infraestrutura';

const STAFF_ROLES = ['ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR'];

const tabsDef: { key: TabKey; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { key: 'suporte', label: 'Suporte', icon: Ticket },
  { key: 'portfolio', label: 'Portfolio', icon: AppWindow, roles: [...STAFF_ROLES, 'FINANCEIRO'] },
  { key: 'contratos', label: 'Contratos', icon: FileText, roles: [...STAFF_ROLES, 'FINANCEIRO'] },
  { key: 'sustentacao', label: 'Sustentacao', icon: Activity, roles: STAFF_ROLES },
  { key: 'projetos', label: 'Projetos', icon: FolderKanban, roles: [...STAFF_ROLES, 'GERENTE_PROJETO'] },
  { key: 'infraestrutura', label: 'Infraestrutura', icon: Server, roles: STAFF_ROLES },
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

  // Chamados ativos (nao fechados/cancelados) ordenados por data
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

        {/* Banner pendentes avaliacao */}
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
            {/* Cards resumo */}
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

            {/* Chamados ativos recentes */}
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

            {/* Acoes rapidas */}
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

// === Dashboard completo para STAFF ===

export function DashboardPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('suporte');
  const [pendentesCount, setPendentesCount] = useState(0);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filterDepartamento, setFilterDepartamento] = useState('');

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

  // Dashboard simplificado para USUARIO_FINAL
  if (gestaoTiRole === 'USUARIO_FINAL') {
    return <DashboardUsuarioFinal usuario={usuario} pendentesCount={pendentesCount} />;
  }

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

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <PeriodFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            onPeriodChange={(inicio, fim) => { setDataInicio(inicio); setDataFim(fim); }}
          />
          <select
            value={filterDepartamento}
            onChange={(e) => setFilterDepartamento(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {tabsDef.filter((t) => !t.roles || (gestaoTiRole && t.roles.includes(gestaoTiRole))).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
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
                              <span className="text-sm text-slate-700">{item.equipe.nome}</span>
                              <span className="text-xs text-slate-400">({item.equipe.sigla})</span>
                            </div>
                            <span className="text-sm font-semibold text-slate-800">{item.total}</span>
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
                  <Link to="/gestao-ti/financeiro" className="text-xs text-capul-600 hover:underline">Ver financeiro</Link>
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
                  <Link to="/gestao-ti/disponibilidade" className="text-xs text-capul-600 hover:underline">Ver disponibilidade</Link>
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
      </div>
    </>
  );
}
