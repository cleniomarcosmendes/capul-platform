import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import {
  ClipboardList, TrendingUp, TrendingDown, Minus, Clock,
  MapPin, Users, FileText, BarChart3,
} from 'lucide-react';

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

const statusLabel: Record<string, string> = {
  ABERTA: 'Abertas', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluidas', CANCELADA: 'Canceladas',
};
const statusColor: Record<string, string> = {
  ABERTA: 'bg-blue-500', EM_EXECUCAO: 'bg-yellow-500', CONCLUIDA: 'bg-green-500', CANCELADA: 'bg-red-400',
};

function formatTempo(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function DashboardOsPage() {
  const [data, setData] = useState<OsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    gestaoApi.get('/dashboard/ordens-servico', { params })
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim]);

  if (loading || !data) return <><Header title="Dashboard — Ordens de Servico" /><div className="p-6 text-slate-500">Carregando...</div></>;

  const { resumo, porStatus, porFilial, porTecnico, evolucaoMensal } = data;
  const totalStatus = porStatus.reduce((a, s) => a + s.total, 0) || 1;
  const maxFilial = Math.max(...porFilial.map((f) => f.total), 1);
  const maxTecnico = Math.max(...porTecnico.map((t) => t.totalOs), 1);
  const maxEvolucao = Math.max(...evolucaoMensal.map((e) => e.total), 1);

  return (
    <>
      <Header title="Dashboard — Ordens de Servico" />
      <div className="p-6 space-y-6">
        {/* Filtros */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">De:</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Ate:</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          {(dataInicio || dataFim) && (
            <button onClick={() => { setDataInicio(''); setDataFim(''); }}
              className="text-xs text-teal-600 hover:underline">Limpar</button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={ClipboardList}
            label="Total de OS"
            value={resumo.totalOs}
            variacao={resumo.variacao}
            subtext={`${resumo.totalAnterior} no periodo anterior`}
            color="bg-blue-50 text-blue-600"
          />
          <KpiCard
            icon={FileText}
            label="Chamados Atendidos"
            value={resumo.totalChamadosVinculados}
            subtext={`Media ${resumo.mediaChamadosPorOs} por OS`}
            color="bg-teal-50 text-teal-600"
          />
          <KpiCard
            icon={Clock}
            label="Tempo Medio"
            value={formatTempo(resumo.tempoMedioMinutos)}
            subtext={`${resumo.tempoTotalHoras}h total em campo`}
            color="bg-amber-50 text-amber-600"
          />
          <KpiCard
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
                      <span className="text-slate-600">{statusLabel[s]}</span>
                      <span className="font-medium text-slate-800">{count} <span className="text-slate-400 text-xs">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${statusColor[s]} transition-all`} style={{ width: `${pct}%` }} />
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
    </>
  );
}

function KpiCard({ icon: Icon, label, value, variacao, subtext, color }: {
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
