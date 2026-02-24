import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { dashboardService } from '../services/dashboard.service';
import { coreService } from '../services/core.service';
import { Star, Users, Layers, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { PeriodFilter } from '../components/PeriodFilter';
import type { DashboardCsat, Departamento } from '../types';

const starColors = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-yellow-100 text-yellow-700',
  'bg-lime-100 text-lime-700',
  'bg-green-100 text-green-700',
];

export function DashboardCsatPage() {
  const [data, setData] = useState<DashboardCsat | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    dashboardService.getCsat({ dataInicio, dataFim, departamentoId: filterDepartamento || undefined })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim, filterDepartamento]);

  if (loading) {
    return (
      <>
        <Header title="Satisfacao (CSAT)" />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header title="Satisfacao (CSAT)" />
        <div className="p-6"><p className="text-red-500">Erro ao carregar dados de satisfacao</p></div>
      </>
    );
  }

  const maxDistribuicao = Math.max(...data.distribuicaoNotas.map((d) => d.total), 1);

  return (
    <>
      <Header title="Dashboard de Satisfacao (CSAT)" />
      <div className="p-6">
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

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
          <div className="bg-white rounded-xl border border-slate-200 mb-6">
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
    </>
  );
}
