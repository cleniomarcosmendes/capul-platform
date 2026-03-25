import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService } from '../../services/dashboard.service';
import { ListChecks, FolderKanban, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { formatDateBR } from '../../utils/date';

type Tab = 'atividades' | 'pendencias';

const statusAtivCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
};
const statusAtivLabel: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em Andamento',
};

const statusPendCores: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  AGUARDANDO_VALIDACAO: 'bg-orange-100 text-orange-700',
};
const statusPendLabel: Record<string, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  AGUARDANDO_VALIDACAO: 'Aguardando Validacao',
};

const prioridadeCores: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
};

export function MinhasPendenciasPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardService.getMinhasPendencias>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('atividades');

  useEffect(() => {
    dashboardService.getMinhasPendencias()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Minhas Pendencias" />
      <div className="p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-500">Erro ao carregar dados.</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Atividades" value={data.resumo.totalAtividades} icon={ListChecks} color="text-blue-600" bg="bg-blue-50" />
              <KpiCard label="Pendencias" value={data.resumo.totalPendencias} icon={FolderKanban} color="text-purple-600" bg="bg-purple-50" />
              <KpiCard label="Vencidas" value={data.resumo.vencidas} icon={Clock} color="text-red-600" bg="bg-red-50" />
              <KpiCard label="Urgentes" value={data.resumo.urgentes} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" />
            </div>

            {data.resumo.totalAtividades === 0 && data.resumo.totalPendencias === 0 ? (
              <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
                <ListChecks className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-green-700 font-medium">Nenhuma pendencia!</p>
                <p className="text-green-600 text-sm mt-1">Voce esta em dia com todas as atividades e pendencias.</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                  <button
                    onClick={() => setTab('atividades')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${tab === 'atividades' ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <ListChecks className="w-4 h-4" /> Atividades ({data.resumo.totalAtividades})
                  </button>
                  <button
                    onClick={() => setTab('pendencias')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${tab === 'pendencias' ? 'bg-white shadow text-capul-700 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <FolderKanban className="w-4 h-4" /> Pendencias ({data.resumo.totalPendencias})
                  </button>
                </div>

                {/* Atividades */}
                {tab === 'atividades' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {data.atividades.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Nenhuma atividade pendente.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Atividade</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Projeto</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Fase</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Prazo</th>
                            <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.atividades.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-800 max-w-[250px] truncate">{a.titulo}</td>
                              <td className="px-4 py-3 text-slate-600 text-xs">
                                <span className="font-mono text-slate-400">P#{a.projeto.numero}</span> {a.projeto.nome}
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs">{a.fase?.nome || '—'}</td>
                              <td className="px-4 py-3 text-xs">
                                {a.dataFimPrevista ? (
                                  <span className={new Date(a.dataFimPrevista) < new Date() ? 'text-red-600 font-medium' : 'text-slate-500'}>
                                    {formatDateBR(a.dataFimPrevista)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusAtivCores[a.status] || ''}`}>{statusAtivLabel[a.status] || a.status}</span>
                              </td>
                              <td className="px-4 py-3">
                                <Link to={`/gestao-ti/projetos/${a.projeto.id}?tab=atividades`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Pendencias */}
                {tab === 'pendencias' && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {data.pendencias.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm">Nenhuma pendencia aberta.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Titulo</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Projeto</th>
                            <th className="text-center px-4 py-3 font-medium text-slate-600">Prioridade</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Prazo</th>
                            <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">Criador</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.pendencias.map((p) => {
                            const vencida = p.dataLimite && new Date(p.dataLimite) < new Date();
                            return (
                              <tr key={p.id} className={`hover:bg-slate-50 ${vencida ? 'bg-red-50/30' : ''}`}>
                                <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{p.numero}</td>
                                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{p.titulo}</td>
                                <td className="px-4 py-3 text-slate-600 text-xs">
                                  <span className="font-mono text-slate-400">P#{p.projeto.numero}</span> {p.projeto.nome}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadeCores[p.prioridade] || ''}`}>{p.prioridade}</span>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                  {p.dataLimite ? (
                                    <span className={vencida ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                      {formatDateBR(p.dataLimite)}
                                      {vencida && ' (vencida)'}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusPendCores[p.status] || ''}`}>{statusPendLabel[p.status] || p.status}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{p.criador.nome}</td>
                                <td className="px-4 py-3">
                                  <Link to={`/gestao-ti/projetos/${p.projeto.id}?tab=pendencias`} className="text-capul-600 hover:text-capul-800" title="Abrir projeto">
                                    <ExternalLink className="w-4 h-4" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: typeof ListChecks; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-xl font-bold ${value > 0 ? color : 'text-slate-800'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
