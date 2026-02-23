import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { dashboardService } from '../services/dashboard.service';
import {
  Ticket, FileText, Activity, FolderKanban, AppWindow, Server, BookMarked,
} from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import type { DashboardExecutivo, TipoAtivo } from '../types';
import type { LucideIcon } from 'lucide-react';

const tipoAtivoLabel: Record<TipoAtivo, string> = {
  SERVIDOR: 'Servidores', ESTACAO_TRABALHO: 'Estacoes', NOTEBOOK: 'Notebooks',
  IMPRESSORA: 'Impressoras', SWITCH: 'Switches', ROTEADOR: 'Roteadores',
  STORAGE: 'Storage', OUTRO: 'Outros',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface KpiCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

function KpiCard({ label, value, color = 'text-slate-800', sub }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

type TabKey = 'suporte' | 'contratos' | 'sustentacao' | 'projetos' | 'portfolio' | 'infraestrutura';

const tabsDef: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'suporte', label: 'Suporte', icon: Ticket },
  { key: 'contratos', label: 'Contratos', icon: FileText },
  { key: 'sustentacao', label: 'Sustentacao', icon: Activity },
  { key: 'projetos', label: 'Projetos', icon: FolderKanban },
  { key: 'portfolio', label: 'Portfolio', icon: AppWindow },
  { key: 'infraestrutura', label: 'Infraestrutura', icon: Server },
];

export function DashboardExecutivoPage() {
  const [data, setData] = useState<DashboardExecutivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('suporte');

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(inicioMes.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    dashboardService.getExecutivo({ dataInicio, dataFim })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim]);

  return (
    <>
      <Header title="Dashboard Executivo" />
      <div className="p-6">
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          onPeriodChange={(inicio, fim) => { setDataInicio(inicio); setDataFim(fim); }}
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {tabsDef.map((t) => {
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
          <p className="text-slate-500">Carregando...</p>
        ) : !data ? (
          <p className="text-slate-400">Erro ao carregar dados</p>
        ) : (
          <>
            {/* Tab Suporte */}
            {tab === 'suporte' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Suporte</h4>
                  </div>
                  <Link to="/gestao-ti/chamados" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <KpiCard label="Abertos" value={data.chamados.abertos} color="text-blue-600" />
                  <KpiCard label="Em Atendimento" value={data.chamados.emAtendimento} color="text-amber-600" />
                  <KpiCard label="Pendentes" value={data.chamados.pendentes} color="text-orange-600" />
                  <KpiCard label="Fechados/Periodo" value={data.chamados.fechadosMes} color="text-green-600" />
                  <KpiCard label="SLA Estourado" value={data.chamados.slaEstourado} color={data.chamados.slaEstourado > 0 ? 'text-red-600' : 'text-green-600'} />
                  <KpiCard label="Tempo Medio" value={`${data.chamados.tempoMedioResolucaoHoras}h`} color="text-slate-700" sub="Resolucao" />
                  <KpiCard label="SLA Compliance" value={`${data.chamados.slaCompliancePercent}%`} color={data.chamados.slaCompliancePercent >= 90 ? 'text-green-600' : 'text-red-600'} />
                </div>
              </section>
            )}

            {/* Tab Contratos */}
            {tab === 'contratos' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Contratos</h4>
                  </div>
                  <Link to="/gestao-ti/contratos" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Ativos" value={data.contratos.totalAtivos} color="text-indigo-600" />
                  <KpiCard label="Valor Comprometido" value={formatCurrency(data.contratos.valorComprometido)} color="text-slate-700" />
                  <KpiCard label="Vencendo 30d" value={data.contratos.vencendo30d} color={data.contratos.vencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <KpiCard label="Parcelas Atrasadas" value={data.contratos.parcelasAtrasadas} color={data.contratos.parcelasAtrasadas > 0 ? 'text-red-600' : 'text-green-600'} />
                </div>
              </section>
            )}

            {/* Tab Sustentacao */}
            {tab === 'sustentacao' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Sustentacao</h4>
                  </div>
                  <Link to="/gestao-ti/disponibilidade" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard label="Paradas Ativas" value={data.sustentacao.paradasEmAndamento} color={data.sustentacao.paradasEmAndamento > 0 ? 'text-red-600' : 'text-green-600'} />
                  <KpiCard label="Paradas/Periodo" value={data.sustentacao.totalParadasMes} color="text-slate-700" />
                  <KpiCard label="MTTR" value={data.sustentacao.mttrFormatado || '—'} color="text-slate-700" sub="Mean Time to Recovery" />
                </div>
              </section>
            )}

            {/* Tab Projetos */}
            {tab === 'projetos' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-capul-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Projetos</h4>
                  </div>
                  <Link to="/gestao-ti/projetos" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KpiCard label="Ativos" value={data.projetos.totalAtivos} color="text-capul-600" />
                  <KpiCard label="Em Andamento" value={data.projetos.emAndamento} color="text-blue-600" />
                  <KpiCard label="Custo Previsto" value={formatCurrency(data.projetos.custoPrevistoTotal)} color="text-slate-700" />
                  <KpiCard label="Custo Realizado" value={formatCurrency(data.projetos.custoRealizadoTotal)} color="text-slate-700" />
                  <KpiCard label="Riscos Abertos" value={data.projetos.riscosAbertos} color={data.projetos.riscosAbertos > 0 ? 'text-amber-600' : 'text-green-600'} />
                </div>
              </section>
            )}

            {/* Tab Portfolio */}
            {tab === 'portfolio' && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AppWindow className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Portfolio</h4>
                  </div>
                  <Link to="/gestao-ti/softwares" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="Softwares" value={data.portfolio.totalSoftwares} color="text-emerald-600" />
                  <KpiCard label="Licencas Ativas" value={data.portfolio.licencasAtivas} color="text-green-600" />
                  <KpiCard label="Vencendo 30d" value={data.portfolio.licencasVencendo30d} color={data.portfolio.licencasVencendo30d > 0 ? 'text-amber-600' : 'text-green-600'} />
                  <KpiCard label="Custo Licencas" value={formatCurrency(data.portfolio.custoLicencas)} color="text-slate-700" />
                </div>
              </section>
            )}

            {/* Tab Infraestrutura */}
            {tab === 'infraestrutura' && (
              <section className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-teal-500" />
                      <h4 className="text-sm font-semibold text-slate-700">Ativos de TI</h4>
                    </div>
                    <Link to="/gestao-ti/ativos" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <KpiCard label="Total Ativos" value={data.ativos.totalAtivos} color="text-teal-600" />
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <p className="text-xs text-slate-500 mb-2">Por Tipo</p>
                      <div className="flex flex-wrap gap-2">
                        {data.ativos.porTipo.map((t) => (
                          <span key={t.tipo} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">
                            {tipoAtivoLabel[t.tipo] || t.tipo}: <strong>{t.total}</strong>
                          </span>
                        ))}
                        {data.ativos.porTipo.length === 0 && <span className="text-xs text-slate-400">Nenhum ativo</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-amber-500" />
                      <h4 className="text-sm font-semibold text-slate-700">Conhecimento</h4>
                    </div>
                    <Link to="/gestao-ti/conhecimento" className="text-xs text-capul-600 hover:underline">Ver detalhes</Link>
                  </div>
                  <div className="grid grid-cols-1 gap-3 max-w-xs">
                    <KpiCard label="Artigos Publicados" value={data.conhecimento.totalArtigosPublicados} color="text-amber-600" />
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
