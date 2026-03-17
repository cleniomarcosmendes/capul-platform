import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboard.service';
import {
  Clock, Ticket, FolderKanban, Users, Search, AlertTriangle, CheckCircle,
  Timer, ArrowRight, MessageSquare, Paperclip, Star, ClipboardList,
  Calendar, User, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  ChamadoBusca, AcompanhamentoChamadoData,
  AtividadeBusca, ProjetoResumo, AcompanhamentoAtividadeData,
} from '../../types';

function formatMin(min: number): string {
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700', CONCLUIDA: 'bg-green-100 text-green-700',
  PLANEJAMENTO: 'bg-blue-100 text-blue-700', PAUSADO: 'bg-orange-100 text-orange-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
};

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
  EM_ANDAMENTO: 'Em Andamento', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
  PLANEJAMENTO: 'Planejamento', PAUSADO: 'Pausado', CONCLUIDO: 'Concluido',
};

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700', ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700', BAIXA: 'bg-green-100 text-green-700',
};

const historicoIcons: Record<string, { icon: LucideIcon; color: string }> = {
  ABERTURA: { icon: Ticket, color: 'text-blue-500' },
  ASSUMIDO: { icon: User, color: 'text-green-500' },
  TRANSFERENCIA_EQUIPE: { icon: Users, color: 'text-purple-500' },
  TRANSFERENCIA_TECNICO: { icon: ArrowRight, color: 'text-purple-500' },
  COMENTARIO: { icon: MessageSquare, color: 'text-slate-500' },
  RESOLVIDO: { icon: CheckCircle, color: 'text-green-600' },
  FECHADO: { icon: CheckCircle, color: 'text-slate-600' },
  CANCELADO: { icon: AlertTriangle, color: 'text-red-500' },
  REABERTO: { icon: AlertTriangle, color: 'text-orange-500' },
  AVALIADO: { icon: Star, color: 'text-yellow-500' },
};

const slaColors: Record<string, string> = {
  no_prazo: 'bg-green-100 text-green-700',
  em_risco: 'bg-yellow-100 text-yellow-700',
  estourado: 'bg-red-100 text-red-700',
  sem_sla: 'bg-slate-100 text-slate-500',
};

const slaLabels: Record<string, string> = {
  no_prazo: 'No Prazo', em_risco: 'Em Risco', estourado: 'SLA Estourado', sem_sla: 'Sem SLA',
};

type Tab = 'chamado' | 'atividade';

export function AcompanhamentoItemPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const [searchParams] = useSearchParams();
  const paramTipo = searchParams.get('tipo');
  const paramId = searchParams.get('id');

  const isManager = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(paramTipo === 'atividade' ? 'atividade' : 'chamado');
  const [autoLoaded, setAutoLoaded] = useState(false);

  // Limpar query params da URL ao voltar para busca
  const voltarParaBusca = (tipo: 'chamado' | 'atividade') => {
    if (tipo === 'chamado') setChamadoData(null);
    else setAtividadeData(null);
    if (paramId) navigate('/gestao-ti/acompanhamento-item', { replace: true });
  };

  // Chamado state
  const [buscaChamado, setBuscaChamado] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrioridade, setFilterPrioridade] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterTecnico, setFilterTecnico] = useState('');
  const [equipes, setEquipes] = useState<{ id: string; nome: string; sigla: string }[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string; username: string }[]>([]);
  const [chamadosResultado, setChamadosResultado] = useState<ChamadoBusca[]>([]);
  const [chamadoData, setChamadoData] = useState<AcompanhamentoChamadoData | null>(null);
  const [loadingChamado, setLoadingChamado] = useState(false);

  // Atividade state
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [projetoId, setProjetoId] = useState('');
  const [buscaAtividade, setBuscaAtividade] = useState('');
  const [filterStatusAtiv, setFilterStatusAtiv] = useState('');
  const [atividadesResultado, setAtividadesResultado] = useState<AtividadeBusca[]>([]);
  const [atividadeData, setAtividadeData] = useState<AcompanhamentoAtividadeData | null>(null);
  const [loadingAtividade, setLoadingAtividade] = useState(false);

  useEffect(() => {
    dashboardService.listarProjetosAtivos().then(setProjetos).catch(() => {});
    dashboardService.listarEquipes().then(setEquipes).catch(() => {});
    dashboardService.getTecnicos().then(setTecnicos).catch(() => {});
  }, []);

  // Auto-load item from query params (?tipo=chamado&id=xxx)
  useEffect(() => {
    if (autoLoaded || !paramId) return;
    setAutoLoaded(true);
    if (paramTipo === 'chamado') {
      selecionarChamado(paramId);
    } else if (paramTipo === 'atividade') {
      selecionarAtividade(paramId);
    }
  }, [paramTipo, paramId, autoLoaded]);

  // Buscar chamados — não-managers veem apenas seus chamados
  const buscarChamados = useCallback(() => {
    const tecnico = !isManager && usuario?.id ? usuario.id : (filterTecnico || undefined);
    dashboardService.buscarChamados({
      q: buscaChamado || undefined,
      status: filterStatus || undefined,
      prioridade: filterPrioridade || undefined,
      equipeId: filterEquipe || undefined,
      tecnicoId: tecnico,
    }).then(setChamadosResultado).catch(() => {});
  }, [buscaChamado, filterStatus, filterPrioridade, filterEquipe, filterTecnico, isManager, usuario]);

  useEffect(() => {
    if (tab === 'chamado') buscarChamados();
  }, [tab, buscarChamados]);

  const selecionarChamado = (id: string) => {
    setLoadingChamado(true);
    dashboardService.getAcompanhamentoChamado(id).then(setChamadoData).catch(() => {}).finally(() => setLoadingChamado(false));
  };

  // Buscar atividades
  const buscarAtividades = useCallback(() => {
    dashboardService.buscarAtividades({
      q: buscaAtividade || undefined,
      projetoId: projetoId || undefined,
      status: filterStatusAtiv || undefined,
    }).then(setAtividadesResultado).catch(() => {});
  }, [buscaAtividade, projetoId, filterStatusAtiv]);

  useEffect(() => {
    if (tab === 'atividade') buscarAtividades();
  }, [tab, buscarAtividades]);

  const selecionarAtividade = (id: string) => {
    setLoadingAtividade(true);
    dashboardService.getAcompanhamentoAtividade(id).then(setAtividadeData).catch(() => {}).finally(() => setLoadingAtividade(false));
  };

  return (
    <>
      <Header title="Acompanhamento por Item" />
      <main className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('chamado'); setChamadoData(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'chamado' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Ticket className="w-4 h-4" /> Chamado
          </button>
          <button
            onClick={() => { setTab('atividade'); setAtividadeData(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'atividade' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FolderKanban className="w-4 h-4" /> Atividade de Projeto
          </button>
        </div>

        {/* ===== CHAMADO ===== */}
        {tab === 'chamado' && (
          <>
            {/* Busca + Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              {/* Busca */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Buscar (numero ou titulo)</label>
                <div className="flex gap-2">
                  <input
                    type="text" value={buscaChamado} onChange={(e) => setBuscaChamado(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarChamados()}
                    placeholder="Ex: 71 ou 'problema cupom'"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                  />
                  <button onClick={buscarChamados} className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Filtros */}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Todos</option>
                    <option value="ABERTO">Aberto</option>
                    <option value="EM_ATENDIMENTO">Em Atendimento</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="RESOLVIDO">Resolvido</option>
                    <option value="FECHADO">Fechado</option>
                    <option value="CANCELADO">Cancelado</option>
                    <option value="REABERTO">Reaberto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>
                  <select value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Todas</option>
                    <option value="CRITICA">Critica</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAIXA">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Equipe</label>
                  <select value={filterEquipe} onChange={(e) => setFilterEquipe(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]">
                    <option value="">Todas</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>{e.sigla} — {e.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tecnico</label>
                  <select value={filterTecnico} onChange={(e) => setFilterTecnico(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]">
                    <option value="">Todos</option>
                    {tecnicos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resultados */}
              {chamadosResultado.length > 0 && !chamadoData && (
                <div className="mt-3 min-h-[calc(100vh-380px)] max-h-[calc(100vh-380px)] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-100">
                        <th className="py-2 px-2 font-medium w-12">#</th>
                        <th className="py-2 px-2 font-medium">Titulo</th>
                        <th className="py-2 px-2 font-medium w-20">Equipe</th>
                        <th className="py-2 px-2 font-medium w-32">Tecnico</th>
                        <th className="py-2 px-2 font-medium w-24 text-center">Status</th>
                        <th className="py-2 px-2 font-medium w-16 text-center">Prior.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chamadosResultado.map((c) => (
                        <tr key={c.id} onClick={() => selecionarChamado(c.id)}
                          className="cursor-pointer hover:bg-orange-50 transition-colors border-b border-slate-50">
                          <td className="py-2 px-2 font-mono text-orange-600 font-bold">#{c.numero}</td>
                          <td className="py-2 px-2 text-slate-700 truncate max-w-0">{c.titulo}</td>
                          <td className="py-2 px-2 text-slate-400">{c.equipeAtual.sigla}</td>
                          <td className="py-2 px-2 text-slate-400 truncate">{c.tecnico?.nome || '—'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[c.status] || ''}`}>
                              {statusLabels[c.status] || c.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${prioridadeColors[c.prioridade] || ''}`}>
                              {c.prioridade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {loadingChamado && <div className="text-center text-slate-500 py-8">Carregando...</div>}

            {/* Dados do Chamado */}
            {chamadoData && !loadingChamado && (
              <>
                {/* Header do chamado */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold text-orange-600">#{chamadoData.chamado.numero}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[chamadoData.chamado.status] || ''}`}>
                          {statusLabels[chamadoData.chamado.status] || chamadoData.chamado.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${prioridadeColors[chamadoData.chamado.prioridade] || ''}`}>
                          {chamadoData.chamado.prioridade}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${slaColors[chamadoData.resumo.slaStatus]}`}>
                          {slaLabels[chamadoData.resumo.slaStatus]}
                          {chamadoData.resumo.slaPercentual !== null && ` (${chamadoData.resumo.slaPercentual}%)`}
                        </span>
                      </div>
                      <h2 className="text-base font-semibold text-slate-800">{chamadoData.chamado.titulo}</h2>
                    </div>
                    <div className="flex gap-2">
                      {chamadoData.chamado.tecnico && (
                        <a href={`/gestao-ti/acompanhamento?tecnico=${chamadoData.chamado.tecnico.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg">
                          Acomp. Tecnico
                        </a>
                      )}
                      <a href={`/gestao-ti/chamados/${chamadoData.chamado.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-capul-600 hover:text-capul-800 border border-capul-200 px-3 py-1.5 rounded-lg">
                        Abrir Chamado
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                    <div><span className="text-slate-400">Solicitante:</span> {chamadoData.chamado.solicitante.nome}</div>
                    <div><span className="text-slate-400">Tecnico:</span> {chamadoData.chamado.tecnico?.nome || 'Nao atribuido'}</div>
                    <div><span className="text-slate-400">Equipe:</span> {chamadoData.chamado.equipeAtual.nome}</div>
                    <div><span className="text-slate-400">Aberto em:</span> {formatDataHora(chamadoData.chamado.createdAt)}</div>
                    {chamadoData.chamado.software && <div><span className="text-slate-400">Software:</span> {chamadoData.chamado.software.nome}</div>}
                    {chamadoData.chamado.ativo && <div><span className="text-slate-400">Ativo:</span> {chamadoData.chamado.ativo.nome}</div>}
                    {chamadoData.chamado.catalogoServico && <div><span className="text-slate-400">Servico:</span> {chamadoData.chamado.catalogoServico.nome}</div>}
                    {chamadoData.chamado.dataLimiteSla && <div><span className="text-slate-400">SLA limite:</span> {formatDataHora(chamadoData.chamado.dataLimiteSla)}</div>}
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <KpiCard label="Tempo Trabalhado" value={chamadoData.resumo.totalHorasTrabalhadas + 'h'}
                    sub={`${chamadoData.resumo.totalSessoes} sessoes`} icon={Clock} color="text-blue-600" />
                  <KpiCard label="Tecnicos Envolvidos" value={chamadoData.resumo.tecnicosEnvolvidos}
                    sub={chamadoData.resumo.tempoMedioPorSessaoFormatado + '/sessao'} icon={Users} color="text-purple-600" />
                  <KpiCard label="Tempo Resposta" value={chamadoData.resumo.tempoRespostaFormatado || 'N/A'}
                    sub="Abertura → Assumido" icon={Timer} color="text-orange-600" />
                  <KpiCard label="Tempo Resolucao" value={chamadoData.resumo.tempoResolucaoFormatado || 'N/A'}
                    sub="Abertura → Resolvido" icon={CheckCircle} color="text-green-600" />
                  <KpiCard label="Transferencias" value={chamadoData.resumo.totalTransferencias}
                    sub="Entre equipes/tecnicos" icon={ArrowRight} color="text-slate-500" />
                  <KpiCard label="Anexos" value={chamadoData.resumo.totalAnexos}
                    sub="Arquivos vinculados" icon={Paperclip} color="text-slate-500" />
                </div>

                {/* Esforço por Técnico */}
                {chamadoData.porTecnico.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Esforco por Tecnico
                    </h3>
                    <div className="space-y-2">
                      {chamadoData.porTecnico.map((t) => {
                        const pct = chamadoData.resumo.totalMinutosTrabalhados > 0
                          ? Math.round((t.minutos / chamadoData.resumo.totalMinutosTrabalhados) * 100) : 0;
                        return (
                          <div key={t.usuarioId} className="flex items-center gap-3">
                            <span className="text-xs text-slate-700 w-32 truncate font-medium">{t.nome}</span>
                            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-600 w-20 text-right">{t.horas}h ({t.sessoes}x)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Registros de Tempo */}
                {chamadoData.registrosTempo.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Sessoes de Trabalho
                    </h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {chamadoData.registrosTempo.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-xs">
                          <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                          <span className="text-slate-400 w-20">{formatDataHora(r.horaInicio)}</span>
                          <span className="text-slate-400">—</span>
                          <span className="text-slate-400 w-12">{r.horaFim ? formatHora(r.horaFim) : '...'}</span>
                          <span className="text-slate-700 flex-1">{r.usuario.nome}</span>
                          <span className="text-slate-500 w-14 text-right">{r.duracaoMinutos ? formatMin(r.duracaoMinutos) : 'ativo'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lifecycle Timeline */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Ciclo de Vida
                  </h3>
                  <div className="space-y-0.5 max-h-80 overflow-y-auto">
                    {chamadoData.historicos.map((h) => {
                      const iconInfo = historicoIcons[h.tipo] || { icon: FileText, color: 'text-slate-400' };
                      const Icon = iconInfo.icon;
                      return (
                        <div key={h.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 text-xs">
                          <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconInfo.color}`} />
                          <span className="text-slate-400 w-28 flex-shrink-0">{formatDataHora(h.createdAt)}</span>
                          <div className="flex-1">
                            <span className="font-medium text-slate-700">{h.tipo.replace(/_/g, ' ')}</span>
                            {h.descricao && <span className="text-slate-500 ml-2">— {h.descricao}</span>}
                            {h.equipeOrigem && h.equipeDestino && (
                              <span className="text-purple-600 ml-2">{h.equipeOrigem.sigla} → {h.equipeDestino.sigla}</span>
                            )}
                          </div>
                          <span className="text-slate-400">{h.usuario.nome}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* OS Vinculadas */}
                {chamadoData.osVinculadas.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Ordens de Servico Vinculadas
                    </h3>
                    <div className="space-y-1">
                      {chamadoData.osVinculadas.map((os) => (
                        <div key={os.id} className="flex items-center gap-3 p-2 text-xs">
                          <span className="font-mono text-capul-600 font-bold">OS #{os.numero}</span>
                          <span className="flex-1 text-slate-700">{os.titulo}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[os.status] || ''}`}>
                            {statusLabels[os.status] || os.status}
                          </span>
                          <a href={`/gestao-ti/ordens-servico`} target="_blank" rel="noopener noreferrer"
                            className="text-capul-600 hover:text-capul-800">Ver</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CSAT */}
                {chamadoData.chamado.notaSatisfacao && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" /> Avaliacao do Solicitante
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-5 h-5 ${n <= (chamadoData.chamado.notaSatisfacao ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{chamadoData.chamado.notaSatisfacao}/5</span>
                      {chamadoData.chamado.comentarioSatisfacao && (
                        <span className="text-xs text-slate-500 italic">"{chamadoData.chamado.comentarioSatisfacao}"</span>
                      )}
                    </div>
                  </div>
                )}

                <button onClick={() => voltarParaBusca('chamado')} className="text-sm text-capul-600 hover:text-capul-800">
                  ← Voltar para busca
                </button>
              </>
            )}
          </>
        )}

        {/* ===== ATIVIDADE ===== */}
        {tab === 'atividade' && (
          <>
            {/* Busca + Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-56">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Projeto</label>
                  <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                    <option value="">Todos os projetos</option>
                    {projetos.map((p) => (
                      <option key={p.id} value={p.id}>#{p.numero} — {p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select value={filterStatusAtiv} onChange={(e) => setFilterStatusAtiv(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Todos</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDA">Concluida</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Buscar atividade</label>
                  <div className="flex gap-2">
                    <input type="text" value={buscaAtividade} onChange={(e) => setBuscaAtividade(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && buscarAtividades()}
                      placeholder="Titulo da atividade..."
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
                    <button onClick={buscarAtividades} className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {atividadesResultado.length > 0 && !atividadeData && (
                <div className="mt-3 min-h-[calc(100vh-380px)] max-h-[calc(100vh-380px)] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-100">
                        <th className="py-2 px-2 font-medium w-6"></th>
                        <th className="py-2 px-2 font-medium">Titulo</th>
                        <th className="py-2 px-2 font-medium w-36">Projeto</th>
                        <th className="py-2 px-2 font-medium w-28">Responsavel</th>
                        <th className="py-2 px-2 font-medium w-20">Fase</th>
                        <th className="py-2 px-2 font-medium w-20 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atividadesResultado.map((a) => (
                        <tr key={a.id} onClick={() => selecionarAtividade(a.id)}
                          className="cursor-pointer hover:bg-purple-50 transition-colors border-b border-slate-50">
                          <td className="py-2 px-2"><FolderKanban className="w-3.5 h-3.5 text-purple-500" /></td>
                          <td className="py-2 px-2 text-slate-700 truncate max-w-0">{a.titulo}</td>
                          <td className="py-2 px-2 text-slate-400 truncate">{a.projeto.nome}</td>
                          <td className="py-2 px-2 text-slate-400 truncate">{a.usuario.nome}</td>
                          <td className="py-2 px-2 text-slate-400 truncate">{a.fase?.nome || '—'}</td>
                          <td className="py-2 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[a.status] || ''}`}>
                              {statusLabels[a.status] || a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {loadingAtividade && <div className="text-center text-slate-500 py-8">Carregando...</div>}

            {/* Dados da Atividade */}
            {atividadeData && !loadingAtividade && (
              <>
                {/* Header */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <FolderKanban className="w-5 h-5 text-purple-500" />
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[atividadeData.atividade.status] || ''}`}>
                          {statusLabels[atividadeData.atividade.status] || atividadeData.atividade.status}
                        </span>
                      </div>
                      <h2 className="text-base font-semibold text-slate-800">{atividadeData.atividade.titulo}</h2>
                      {atividadeData.atividade.descricao && (
                        <p className="text-xs text-slate-500 mt-1">{atividadeData.atividade.descricao}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a href={`/gestao-ti/acompanhamento?tecnico=${atividadeData.atividade.usuario.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-purple-500 hover:text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg">
                        Acomp. Responsavel
                      </a>
                      <a href={`/gestao-ti/projetos/${atividadeData.atividade.projeto.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-capul-600 hover:text-capul-800 border border-capul-200 px-3 py-1.5 rounded-lg">
                        Abrir Projeto
                      </a>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
                    <div><span className="text-slate-400">Projeto:</span> #{atividadeData.atividade.projeto.numero} — {atividadeData.atividade.projeto.nome}</div>
                    <div><span className="text-slate-400">Responsavel:</span> {atividadeData.atividade.usuario.nome}</div>
                    {atividadeData.atividade.fase && <div><span className="text-slate-400">Fase:</span> {atividadeData.atividade.fase.nome}</div>}
                    <div><span className="text-slate-400">Criada em:</span> {formatData(atividadeData.atividade.createdAt)}</div>
                    {atividadeData.atividade.dataInicio && <div><span className="text-slate-400">Inicio:</span> {formatData(atividadeData.atividade.dataInicio)}</div>}
                    {atividadeData.atividade.dataFimPrevista && <div><span className="text-slate-400">Previsao:</span> {formatData(atividadeData.atividade.dataFimPrevista)}</div>}
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <KpiCard label="Tempo Trabalhado" value={atividadeData.resumo.totalHorasTrabalhadas + 'h'}
                    sub={`${atividadeData.resumo.totalSessoes} sessoes`} icon={Clock} color="text-blue-600" />
                  <KpiCard label="Participantes" value={atividadeData.resumo.participantes}
                    sub={atividadeData.resumo.tempoMedioPorSessaoFormatado + '/sessao'} icon={Users} color="text-purple-600" />
                  <KpiCard label="Dias Previstos" value={atividadeData.resumo.diasPrevistos ?? 'N/A'}
                    sub={atividadeData.resumo.diasEmAndamento ? `${atividadeData.resumo.diasEmAndamento} dias decorridos` : undefined}
                    icon={Calendar} color="text-orange-600" />
                  <KpiCard label="Comentarios" value={atividadeData.resumo.totalComentarios}
                    sub="Interacoes na atividade" icon={MessageSquare} color="text-slate-500" />
                  <KpiCard label="Chamados Vinculados" value={atividadeData.chamadosVinculados.length}
                    sub="No projeto" icon={Ticket} color="text-orange-500" />
                </div>

                {/* Esforço por Participante */}
                {atividadeData.porParticipante.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Esforco por Participante
                    </h3>
                    <div className="space-y-2">
                      {atividadeData.porParticipante.map((p) => {
                        const pct = atividadeData.resumo.totalMinutosTrabalhados > 0
                          ? Math.round((p.minutos / atividadeData.resumo.totalMinutosTrabalhados) * 100) : 0;
                        return (
                          <div key={p.usuarioId} className="flex items-center gap-3">
                            <span className="text-xs text-slate-700 w-32 truncate font-medium">{p.nome}</span>
                            <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-600 w-20 text-right">{p.horas}h ({p.sessoes}x)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sessões de Trabalho */}
                {atividadeData.registrosTempo.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Sessoes de Trabalho
                    </h3>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {atividadeData.registrosTempo.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-xs">
                          <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                          <span className="text-slate-400 w-20">{formatDataHora(r.horaInicio)}</span>
                          <span className="text-slate-400">—</span>
                          <span className="text-slate-400 w-12">{r.horaFim ? formatHora(r.horaFim) : '...'}</span>
                          <span className="text-slate-700 flex-1">{r.usuario.nome}</span>
                          <span className="text-slate-500 w-14 text-right">{r.duracaoMinutos ? formatMin(r.duracaoMinutos) : 'ativo'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comentários */}
                {atividadeData.comentarios.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Comentarios
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {atividadeData.comentarios.map((c) => (
                        <div key={c.id} className="p-3 bg-slate-50 rounded-lg text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-700">{c.usuario.nome}</span>
                            <span className="text-slate-400">{formatDataHora(c.createdAt)}</span>
                          </div>
                          <p className="text-slate-600">{c.texto}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chamados Vinculados */}
                {atividadeData.chamadosVinculados.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Ticket className="w-4 h-4" /> Chamados do Projeto
                    </h3>
                    <div className="space-y-1">
                      {atividadeData.chamadosVinculados.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 text-xs hover:bg-slate-50 rounded-lg">
                          <span className="font-mono text-orange-600 font-bold">#{c.numero}</span>
                          <span className="flex-1 truncate text-slate-700">{c.titulo}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[c.status] || ''}`}>
                            {statusLabels[c.status] || c.status}
                          </span>
                          <a href={`/gestao-ti/chamados/${c.id}`} target="_blank" rel="noopener noreferrer"
                            className="text-capul-600 hover:text-capul-800">Ver</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => voltarParaBusca('atividade')} className="text-sm text-capul-600 hover:text-capul-800">
                  ← Voltar para busca
                </button>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
