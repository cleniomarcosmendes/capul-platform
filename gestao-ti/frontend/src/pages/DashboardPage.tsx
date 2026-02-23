import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { Ticket, Clock, CheckCircle, AlertTriangle, Wrench, Users, AppWindow, KeyRound, DollarSign, FileText, Receipt, Activity, FolderKanban, Timer, Server, BookMarked } from 'lucide-react';
import type { DashboardResumo } from '../types';

const prioridadeCores: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

export function DashboardPage() {
  const { usuario, gestaoTiRole } = useAuth();
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService
      .getResumo()
      .then(setResumo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = resumo
    ? [
        { label: 'Abertos', value: resumo.chamados.abertos, icon: Ticket, color: 'bg-blue-100 text-blue-600' },
        { label: 'Em Atendimento', value: resumo.chamados.emAtendimento, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
        { label: 'Pendentes', value: resumo.chamados.pendentes, icon: AlertTriangle, color: 'bg-orange-100 text-orange-600' },
        { label: 'Resolvidos', value: resumo.chamados.resolvidos, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
        { label: 'Fechados', value: resumo.chamados.fechados, icon: CheckCircle, color: 'bg-slate-100 text-slate-600' },
        { label: 'OS Abertas', value: resumo.ordensServico.abertas, icon: Wrench, color: 'bg-capul-100 text-capul-600' },
      ]
    : [];

  const contratosCards = resumo?.contratos
    ? [
        { label: 'Contratos Ativos', value: resumo.contratos.totalAtivos, icon: FileText, color: 'bg-sky-100 text-sky-600' },
        {
          label: 'Valor Comprometido',
          value: `R$ ${resumo.contratos.valorTotalComprometido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: 'bg-cyan-100 text-cyan-600',
        },
        { label: 'Vencendo 30d', value: resumo.contratos.vencendo30d, icon: AlertTriangle, color: 'bg-rose-100 text-rose-600' },
        { label: 'Parcelas Pendentes', value: resumo.contratos.parcelasPendentes, icon: Receipt, color: 'bg-orange-100 text-orange-600' },
      ]
    : [];

  const sustentacaoCards = resumo?.sustentacao
    ? [
        { label: 'Paradas Ativas', value: resumo.sustentacao.paradasEmAndamento, icon: Activity, color: 'bg-red-100 text-red-600' },
        { label: 'Paradas no Mes', value: resumo.sustentacao.totalParadasMes, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
      ]
    : [];

  const projetosCards = resumo?.projetos
    ? [
        { label: 'Projetos Ativos', value: resumo.projetos.totalAtivos, icon: FolderKanban, color: 'bg-capul-100 text-capul-600' },
        { label: 'Em Andamento', value: resumo.projetos.emAndamento, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
        {
          label: 'Custo Previsto',
          value: `R$ ${resumo.projetos.custoPrevistoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: 'bg-cyan-100 text-cyan-600',
        },
        {
          label: 'Custo Realizado',
          value: `R$ ${resumo.projetos.custoRealizadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: 'bg-emerald-100 text-emerald-600',
        },
        { label: 'Horas Apontadas', value: resumo.projetos.totalHorasApontadas, icon: Timer, color: 'bg-blue-100 text-blue-600' },
        { label: 'Riscos Abertos', value: resumo.projetos.riscosAbertos, icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
      ]
    : [];

  const portfolioCards = resumo?.portfolio
    ? [
        { label: 'Softwares', value: resumo.portfolio.totalSoftwares, icon: AppWindow, color: 'bg-indigo-100 text-indigo-600' },
        { label: 'Licencas Ativas', value: resumo.portfolio.totalLicencasAtivas, icon: KeyRound, color: 'bg-teal-100 text-teal-600' },
        { label: 'Vencendo 30d', value: resumo.portfolio.licencasVencendo30d, icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
        {
          label: 'Custo Licencas',
          value: `R$ ${resumo.portfolio.custoAnualLicencas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
          icon: DollarSign,
          color: 'bg-emerald-100 text-emerald-600',
        },
      ]
    : [];

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

        {loading ? (
          <p className="text-slate-500">Carregando metricas...</p>
        ) : resumo ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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

            {portfolioCards.length > 0 && (
              <div className="mt-8">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Portfolio de Aplicacoes</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {portfolioCards.map((card) => {
                    const PIcon = card.icon;
                    return (
                      <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-200">
                        <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                          <PIcon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {contratosCards.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Contratos</h4>
                  <Link to="/gestao-ti/financeiro" className="text-xs text-capul-600 hover:underline">
                    Ver financeiro
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {contratosCards.map((card) => {
                    const CIcon = card.icon;
                    return (
                      <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-200">
                        <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                          <CIcon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {sustentacaoCards.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Sustentacao</h4>
                  <Link to="/gestao-ti/disponibilidade" className="text-xs text-capul-600 hover:underline">
                    Ver disponibilidade
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {sustentacaoCards.map((card) => {
                    const SIcon = card.icon;
                    return (
                      <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-200">
                        <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                          <SIcon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {projetosCards.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Projetos</h4>
                  <Link to="/gestao-ti/projetos" className="text-xs text-capul-600 hover:underline">
                    Ver projetos
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {projetosCards.map((card) => {
                    const PrIcon = card.icon;
                    return (
                      <div key={card.label} className="bg-white rounded-xl p-4 border border-slate-200">
                        <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                          <PrIcon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(resumo.ativos || resumo.conhecimento) && (
              <div className="mt-8">
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
