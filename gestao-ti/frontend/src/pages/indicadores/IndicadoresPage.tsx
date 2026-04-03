import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import { formatDateBR } from '../../utils/date';
import { DollarSign, KeyRound, Activity, Ticket, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface IndicadoresData {
  periodo: { mes: number; ano: number; diasNoMes: number };
  investimentos: {
    totalParcelas: number;
    totalNFs: number;
    totalInvestimento: number;
    qtdParcelas: number;
    qtdNFs: number;
    detalheParcelas: { id: string; numero: number; valor: number; dataPagamento: string; contrato: { id: string; numero: number; titulo: string } }[];
    detalheNFs: { id: string; numero: string; valorTotal: number; dataLancamento: string; fornecedor: string; qtdItens: number }[];
  };
  licencas: {
    licencasAtivas: number;
    totalSoftwares: number;
    licencasVencendo30: number;
    licencasVencendo60: number;
    licencasVencendo90: number;
  };
  disponibilidade: {
    horasTotais: number;
    horasParada: number;
    disponibilidadePercent: number;
    qtdParadas: number;
    tiposFiltrados: string[];
    porSoftware: {
      softwareId: string;
      softwareNome: string;
      linhas: {
        tipo: string;
        impacto: string;
        qtdParadas: number;
        horasTotal: number;
        paradas: { id: string; titulo: string; motivo: string | null; inicio: string; fim: string | null; horasNoPeriodo: number }[];
      }[];
    }[];
  };
  chamados: {
    abertosNoPeriodo: number;
    resolvidosNoPeriodo: number;
    emAbertoAtual: number;
    tempoMedioResolucaoHoras: number;
  };
  horasDesenvolvimento: {
    totalHoras: number;
    totalApontamentos: number;
    porProjeto: { projeto: { id: string; numero: number; nome: string }; horas: number }[];
    porAnalista: { usuario: { id: string; nome: string }; horas: number }[];
  };
}

type Detalhe = 'investimentos' | 'chamados' | 'horas' | 'disponibilidade' | 'licencas' | null;

const tipoParadaLabel: Record<string, string> = {
  PARADA_NAO_PROGRAMADA: 'Nao Programada',
  PARADA_PROGRAMADA: 'Programada',
  MANUTENCAO_PREVENTIVA: 'Manut. Preventiva',
};

const impactoLabel: Record<string, string> = {
  TOTAL: 'Total',
  PARCIAL: 'Parcial',
};

const impactoCor: Record<string, string> = {
  TOTAL: 'bg-red-100 text-red-700',
  PARCIAL: 'bg-amber-100 text-amber-700',
};

const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmtCurrency(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function IndicadoresPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [tiposParada, setTiposParada] = useState<string[]>(['PARADA_NAO_PROGRAMADA']);
  const [data, setData] = useState<IndicadoresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<Detalhe>(null);

  useEffect(() => {
    loadData();
  }, [mes, ano, tiposParada]);

  async function loadData() {
    setLoading(true);
    try {
      const params: Record<string, string> = { mes: String(mes), ano: String(ano) };
      if (tiposParada.length > 0) params.tiposParada = tiposParada.join(',');
      const { data: d } = await gestaoApi.get('/dashboard/indicadores-estrategicos', { params });
      setData(d);
    } catch { /* empty */ }
    setLoading(false);
  }

  function prevMes() {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  }

  function nextMes() {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  }

  function toggleTipoParada(tipo: string) {
    setTiposParada(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  }

  return (
    <>
      <Header title="Indicadores Estrategicos" />
      <div className="p-6">
        {/* Seletor de periodo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={prevMes} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center min-w-[180px]">
              <p className="text-lg font-bold text-slate-800">{meses[mes - 1]} {ano}</p>
              <p className="text-xs text-slate-500">Planejamento Estrategico - Depto. T.I.</p>
            </div>
            <button onClick={nextMes} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Tipos de parada:</span>
            {Object.entries(tipoParadaLabel).map(([k, v]) => (
              <button key={k} onClick={() => toggleTipoParada(k)}
                className={`px-2 py-1 rounded-full border text-xs transition-colors ${
                  tiposParada.includes(k) ? 'bg-capul-100 border-capul-300 text-capul-700' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando indicadores...</div>
        ) : !data ? (
          <div className="text-center py-12 text-slate-500">Erro ao carregar dados</div>
        ) : (
          <>
            {/* Cards dos indicadores */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              {/* 1. Investimentos */}
              <button onClick={() => setDetalhe(detalhe === 'investimentos' ? null : 'investimentos')}
                className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${detalhe === 'investimentos' ? 'border-capul-500 ring-2 ring-capul-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-100"><DollarSign className="w-4 h-4 text-emerald-600" /></div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Investimentos TI</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{fmtCurrency(data.investimentos.totalInvestimento)}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>{data.investimentos.qtdParcelas} parcela(s) + {data.investimentos.qtdNFs} NF(s)</span>
                </div>
              </button>

              {/* 2. Licencas */}
              <button onClick={() => setDetalhe(detalhe === 'licencas' ? null : 'licencas')}
                className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${detalhe === 'licencas' ? 'border-capul-500 ring-2 ring-capul-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-blue-100"><KeyRound className="w-4 h-4 text-blue-600" /></div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Licencas Ativas</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{data.licencas.licencasAtivas}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>{data.licencas.totalSoftwares} softwares</span>
                  {data.licencas.licencasVencendo30 > 0 && (
                    <span className="text-amber-600 ml-2">({data.licencas.licencasVencendo30} vencendo 30d)</span>
                  )}
                </div>
              </button>

              {/* 3. Disponibilidade */}
              <button onClick={() => setDetalhe(detalhe === 'disponibilidade' ? null : 'disponibilidade')}
                className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${detalhe === 'disponibilidade' ? 'border-capul-500 ring-2 ring-capul-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-purple-100"><Activity className="w-4 h-4 text-purple-600" /></div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Disponibilidade</span>
                </div>
                <p className={`text-xl font-bold ${data.disponibilidade.disponibilidadePercent >= 99 ? 'text-green-600' : data.disponibilidade.disponibilidadePercent >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {data.disponibilidade.disponibilidadePercent}%
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>{data.disponibilidade.qtdParadas} parada(s) | {data.disponibilidade.horasParada}h fora</span>
                </div>
              </button>

              {/* 4. Chamados */}
              <button onClick={() => setDetalhe(detalhe === 'chamados' ? null : 'chamados')}
                className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${detalhe === 'chamados' ? 'border-capul-500 ring-2 ring-capul-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-orange-100"><Ticket className="w-4 h-4 text-orange-600" /></div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Chamados Internos</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{data.chamados.resolvidosNoPeriodo}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>resolvidos | {data.chamados.emAbertoAtual} em aberto</span>
                </div>
              </button>

              {/* 5. Horas Desenvolvimento */}
              <button onClick={() => setDetalhe(detalhe === 'horas' ? null : 'horas')}
                className={`bg-white rounded-xl border p-5 text-left transition-all hover:shadow-md ${detalhe === 'horas' ? 'border-capul-500 ring-2 ring-capul-200' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-indigo-100"><Clock className="w-4 h-4 text-indigo-600" /></div>
                  <span className="text-xs font-medium text-slate-500 uppercase">Horas Desenv.</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{data.horasDesenvolvimento.totalHoras}h</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>{data.horasDesenvolvimento.porProjeto.length} projeto(s)</span>
                </div>
              </button>
            </div>

            {/* Detalhamento */}
            {detalhe === 'investimentos' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Detalhamento - Investimentos em TI</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Parcelas */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-3 uppercase">Parcelas de Contratos ({fmtCurrency(data.investimentos.totalParcelas)})</h4>
                    {data.investimentos.detalheParcelas.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhuma parcela paga no periodo</p>
                    ) : (
                      <div className="space-y-2">
                        {data.investimentos.detalheParcelas.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                            <div>
                              <p className="text-sm font-medium text-slate-700">Contrato #{p.contrato.numero} - {p.contrato.titulo}</p>
                              <p className="text-xs text-slate-500">Parcela #{p.numero} | Pago em {formatDateBR(p.dataPagamento)}</p>
                            </div>
                            <p className="text-sm font-bold text-slate-800">{fmtCurrency(p.valor)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* NFs */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-3 uppercase">Notas Fiscais ({fmtCurrency(data.investimentos.totalNFs)})</h4>
                    {data.investimentos.detalheNFs.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhuma NF no periodo</p>
                    ) : (
                      <div className="space-y-2">
                        {data.investimentos.detalheNFs.map((nf) => (
                          <div key={nf.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                            <div>
                              <p className="text-sm font-medium text-slate-700">NF {nf.numero}</p>
                              <p className="text-xs text-slate-500">{nf.fornecedor} | {nf.qtdItens} itens | {formatDateBR(nf.dataLancamento)}</p>
                            </div>
                            <p className="text-sm font-bold text-slate-800">{fmtCurrency(nf.valorTotal)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {detalhe === 'licencas' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Detalhamento - Licencas e Softwares</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-800">{data.licencas.totalSoftwares}</p>
                    <p className="text-xs text-blue-600 mt-1">Softwares Ativos</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-800">{data.licencas.licencasAtivas}</p>
                    <p className="text-xs text-green-600 mt-1">Licencas Ativas</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${data.licencas.licencasVencendo30 > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${data.licencas.licencasVencendo30 > 0 ? 'text-red-800' : 'text-slate-600'}`}>{data.licencas.licencasVencendo30}</p>
                    <p className="text-xs text-slate-600 mt-1">Vencendo em 30 dias</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${data.licencas.licencasVencendo90 > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${data.licencas.licencasVencendo90 > 0 ? 'text-amber-800' : 'text-slate-600'}`}>{data.licencas.licencasVencendo90}</p>
                    <p className="text-xs text-slate-600 mt-1">Vencendo em 90 dias</p>
                  </div>
                </div>
              </div>
            )}

            {detalhe === 'disponibilidade' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Detalhamento - Disponibilidade de Sistemas</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{data.disponibilidade.horasTotais}h</p>
                    <p className="text-xs text-slate-600 mt-1">Horas no Periodo (24h/dia)</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-800">{data.disponibilidade.horasParada}h</p>
                    <p className="text-xs text-red-600 mt-1">Horas Indisponiveis (tipos selecionados)</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${data.disponibilidade.disponibilidadePercent >= 99 ? 'bg-green-50' : data.disponibilidade.disponibilidadePercent >= 95 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                    <p className={`text-2xl font-bold ${data.disponibilidade.disponibilidadePercent >= 99 ? 'text-green-800' : data.disponibilidade.disponibilidadePercent >= 95 ? 'text-yellow-800' : 'text-red-800'}`}>
                      {data.disponibilidade.disponibilidadePercent}%
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Disponibilidade</p>
                  </div>
                </div>

                {data.disponibilidade.porSoftware.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhuma parada registrada no periodo</p>
                ) : (
                  <div className="space-y-4">
                    {data.disponibilidade.porSoftware.map((sw) => (
                      <div key={sw.softwareId} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-700">{sw.softwareNome}</h4>
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-medium text-slate-500 uppercase">
                              <th className="px-4 py-2">Tipo</th>
                              <th className="px-4 py-2">Impacto</th>
                              <th className="px-4 py-2 text-center">Paradas</th>
                              <th className="px-4 py-2 text-right">Horas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sw.linhas.map((linha, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 text-sm">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    linha.tipo === 'PARADA_NAO_PROGRAMADA' ? 'bg-red-100 text-red-700' :
                                    linha.tipo === 'PARADA_PROGRAMADA' ? 'bg-blue-100 text-blue-700' :
                                    'bg-purple-100 text-purple-700'
                                  }`}>
                                    {tipoParadaLabel[linha.tipo] || linha.tipo}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${impactoCor[linha.impacto] || 'bg-slate-100 text-slate-600'}`}>
                                    {impactoLabel[linha.impacto] || linha.impacto}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-center text-slate-700">{linha.qtdParadas}</td>
                                <td className="px-4 py-2 text-sm text-right font-medium text-red-600">{linha.horasTotal}h</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200">
                              <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-slate-600 text-right">Total {sw.softwareNome}:</td>
                              <td className="px-4 py-2 text-sm font-bold text-right text-red-700">
                                {sw.linhas.reduce((s, l) => s + l.horasTotal, 0).toFixed(1)}h
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detalhe === 'chamados' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Detalhamento - Chamados Internos</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-800">{data.chamados.abertosNoPeriodo}</p>
                    <p className="text-xs text-blue-600 mt-1">Abertos no Periodo</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-800">{data.chamados.resolvidosNoPeriodo}</p>
                    <p className="text-xs text-green-600 mt-1">Resolvidos no Periodo</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${data.chamados.emAbertoAtual > 10 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className="text-2xl font-bold text-slate-800">{data.chamados.emAbertoAtual}</p>
                    <p className="text-xs text-slate-600 mt-1">Em Aberto (atual)</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{data.chamados.tempoMedioResolucaoHoras}h</p>
                    <p className="text-xs text-slate-600 mt-1">Tempo Medio Resolucao</p>
                  </div>
                </div>
              </div>
            )}

            {detalhe === 'horas' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4">Detalhamento - Horas de Desenvolvimento</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-3 uppercase">Por Projeto</h4>
                    {data.horasDesenvolvimento.porProjeto.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum apontamento no periodo</p>
                    ) : (
                      <div className="space-y-2">
                        {data.horasDesenvolvimento.porProjeto.map((p) => (
                          <div key={p.projeto.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-700">#{p.projeto.numero} - {p.projeto.nome}</p>
                            <p className="text-sm font-bold text-indigo-600">{p.horas.toFixed(1)}h</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-3 uppercase">Por Analista</h4>
                    {data.horasDesenvolvimento.porAnalista.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum apontamento no periodo</p>
                    ) : (
                      <div className="space-y-2">
                        {data.horasDesenvolvimento.porAnalista.map((a) => (
                          <div key={a.usuario.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-700">{a.usuario.nome}</p>
                            <p className="text-sm font-bold text-indigo-600">{a.horas.toFixed(1)}h</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
