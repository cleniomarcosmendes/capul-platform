import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService } from '../../services/dashboard.service';
import { softwareService } from '../../services/software.service';
import { coreApi } from '../../services/api';
import { BarChart2, Activity, AlertTriangle, Clock } from 'lucide-react';
import type { DashboardDisponibilidade, Software } from '../../types';

const tipoLabel: Record<string, string> = {
  PARADA_PROGRAMADA: 'Programada',
  PARADA_NAO_PROGRAMADA: 'Nao Programada',
  MANUTENCAO_PREVENTIVA: 'Manut. Preventiva',
};

const impactoLabel: Record<string, string> = {
  TOTAL: 'Total',
  PARCIAL: 'Parcial',
};

const statusLabel: Record<string, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const statusCores: Record<string, string> = {
  EM_ANDAMENTO: 'bg-red-100 text-red-700',
  FINALIZADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
}

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

export function DashboardDisponibilidadePage() {
  const [dados, setDados] = useState<DashboardDisponibilidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);

  const hoje = new Date();
  const d30atras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [dataInicio, setDataInicio] = useState(d30atras.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroFilial, setFiltroFilial] = useState('');

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    coreApi.get('/filiais').then(({ data }) => setFiliais(data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [dataInicio, dataFim, filtroSoftware, filtroFilial]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await dashboardService.getDisponibilidade({
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        softwareId: filtroSoftware || undefined,
        filialId: filtroFilial || undefined,
      });
      setDados(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  const uptimeMedio = dados && dados.disponibilidadePorSoftware.length > 0
    ? +(dados.disponibilidadePorSoftware.reduce((s, d) => s + d.uptimePercent, 0) / dados.disponibilidadePorSoftware.length).toFixed(2)
    : 100;

  return (
    <>
      <Header title="Disponibilidade" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 className="w-6 h-6 text-emerald-500" />
          <h3 className="text-lg font-semibold text-slate-800">Dashboard de Disponibilidade</h3>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Inicio</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <select
            value={filtroSoftware}
            onChange={(e) => setFiltroSoftware(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos Softwares</option>
            {softwares.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select
            value={filtroFilial}
            onChange={(e) => setFiltroFilial(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todas Filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : !dados ? (
          <p className="text-slate-500">Erro ao carregar dados</p>
        ) : (
          <>
            {/* Cards Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              <div className="bg-white rounded-xl border border-slate-200 mb-6">
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
                            <span className={`font-bold ${uptimeColor(sw.uptimePercent)}`}>
                              {sw.uptimePercent}%
                            </span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                        <span className="text-sm text-slate-700">{tipoLabel[item.tipo] || item.tipo}</span>
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
                        <span className="text-sm text-slate-700">{impactoLabel[item.impacto] || item.impacto}</span>
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
                  <Link to="/gestao-ti/paradas" className="text-xs text-capul-600 hover:underline">
                    Ver todas
                  </Link>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[p.status]}`}>
                          {statusLabel[p.status]}
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
    </>
  );
}
