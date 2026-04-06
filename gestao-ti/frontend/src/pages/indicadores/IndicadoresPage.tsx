import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import { formatDateBR } from '../../utils/date';
import { DollarSign, KeyRound, Activity, Ticket, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface LicencaDetalhe {
  id: string; nome: string | null; modeloLicenca: string | null; quantidade: number | null;
  dataVencimento: string | null; status: string;
  software: { id: string; nome: string } | null;
  categoria: { id: string; nome: string } | null;
}

interface ChamadoDetalhe {
  id: string; numero: number; titulo: string; status: string; prioridade: string;
  createdAt: string; updatedAt: string;
  solicitante: { id: string; nome: string } | null;
  tecnico: { id: string; nome: string } | null;
  equipeAtual: { id: string; sigla: string } | null;
}

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
    detalheSoftwares: { id: string; nome: string; fabricante: string | null; tipo: string | null; criticidade: string | null; versaoAtual: string | null; _count: { licencas: number; modulos: number } }[];
    detalheLicencasAtivas: LicencaDetalhe[];
    detalheLicencasVencendo30: LicencaDetalhe[];
    detalheLicencasVencendo90: LicencaDetalhe[];
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
    detalheAbertos: ChamadoDetalhe[];
    detalheResolvidos: ChamadoDetalhe[];
    detalheEmAberto: ChamadoDetalhe[];
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
  const [subDetalhe, setSubDetalhe] = useState<string | null>(null);

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
              <button onClick={() => { setDetalhe(detalhe === 'investimentos' ? null : 'investimentos'); setSubDetalhe(null); }}
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
              <button onClick={() => { setDetalhe(detalhe === 'licencas' ? null : 'licencas'); setSubDetalhe(null); }}
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
              <button onClick={() => { setDetalhe(detalhe === 'disponibilidade' ? null : 'disponibilidade'); setSubDetalhe(null); }}
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
              <button onClick={() => { setDetalhe(detalhe === 'chamados' ? null : 'chamados'); setSubDetalhe(null); }}
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
              <button onClick={() => { setDetalhe(detalhe === 'horas' ? null : 'horas'); setSubDetalhe(null); }}
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
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <button onClick={() => setSubDetalhe(subDetalhe === 'softwares' ? null : 'softwares')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'softwares' ? 'bg-blue-100 ring-2 ring-blue-300' : 'bg-blue-50'}`}>
                    <p className="text-2xl font-bold text-blue-800">{data.licencas.totalSoftwares}</p>
                    <p className="text-xs text-blue-600 mt-1">Softwares Ativos</p>
                  </button>
                  <button onClick={() => setSubDetalhe(subDetalhe === 'lic-ativas' ? null : 'lic-ativas')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'lic-ativas' ? 'bg-green-100 ring-2 ring-green-300' : 'bg-green-50'}`}>
                    <p className="text-2xl font-bold text-green-800">{data.licencas.licencasAtivas}</p>
                    <p className="text-xs text-green-600 mt-1">Licencas Ativas</p>
                  </button>
                  <button onClick={() => setSubDetalhe(subDetalhe === 'lic-30' ? null : 'lic-30')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'lic-30' ? 'ring-2 ring-red-300 bg-red-100' : data.licencas.licencasVencendo30 > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${data.licencas.licencasVencendo30 > 0 ? 'text-red-800' : 'text-slate-600'}`}>{data.licencas.licencasVencendo30}</p>
                    <p className="text-xs text-slate-600 mt-1">Vencendo em 30 dias</p>
                  </button>
                  <button onClick={() => setSubDetalhe(subDetalhe === 'lic-90' ? null : 'lic-90')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'lic-90' ? 'ring-2 ring-amber-300 bg-amber-100' : data.licencas.licencasVencendo90 > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className={`text-2xl font-bold ${data.licencas.licencasVencendo90 > 0 ? 'text-amber-800' : 'text-slate-600'}`}>{data.licencas.licencasVencendo90}</p>
                    <p className="text-xs text-slate-600 mt-1">Vencendo em 90 dias</p>
                  </button>
                </div>
                {subDetalhe === 'softwares' && (
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase">Softwares Ativos ({data.licencas.detalheSoftwares.length})</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left">Nome</th>
                            <th className="px-4 py-2 text-left">Fabricante</th>
                            <th className="px-4 py-2 text-left">Tipo</th>
                            <th className="px-4 py-2 text-left">Criticidade</th>
                            <th className="px-4 py-2 text-left">Versao</th>
                            <th className="px-4 py-2 text-center">Modulos</th>
                            <th className="px-4 py-2 text-center">Licencas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.licencas.detalheSoftwares.map((sw) => (
                            <tr key={sw.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-700">{sw.nome}</td>
                              <td className="px-4 py-2 text-slate-600">{sw.fabricante || '-'}</td>
                              <td className="px-4 py-2 text-slate-600">{sw.tipo || '-'}</td>
                              <td className="px-4 py-2 text-slate-600">{sw.criticidade || '-'}</td>
                              <td className="px-4 py-2 text-slate-600">{sw.versaoAtual || '-'}</td>
                              <td className="px-4 py-2 text-center text-slate-600">{sw._count.modulos}</td>
                              <td className="px-4 py-2 text-center text-slate-600">{sw._count.licencas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {(subDetalhe === 'lic-ativas' || subDetalhe === 'lic-30' || subDetalhe === 'lic-90') && (() => {
                  const lista = subDetalhe === 'lic-ativas' ? data.licencas.detalheLicencasAtivas
                    : subDetalhe === 'lic-30' ? data.licencas.detalheLicencasVencendo30
                    : data.licencas.detalheLicencasVencendo90;
                  const titulo = subDetalhe === 'lic-ativas' ? 'Licencas Ativas' : subDetalhe === 'lic-30' ? 'Vencendo em 30 dias' : 'Vencendo em 90 dias';
                  return (
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase">{titulo} ({lista.length})</h4>
                      {lista.length === 0 ? <p className="text-sm text-slate-400">Nenhuma licenca</p> : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                              <tr>
                                <th className="px-4 py-2 text-left">Software / Licenca</th>
                                <th className="px-4 py-2 text-left">Categoria</th>
                                <th className="px-4 py-2 text-center">Qtde</th>
                                <th className="px-4 py-2 text-left">Vencimento</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lista.map((lic) => (
                                <tr key={lic.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-2">
                                    <p className="font-medium text-slate-700">{lic.software?.nome || '-'}</p>
                                    {lic.nome && <p className="text-xs text-slate-400">{lic.nome}</p>}
                                  </td>
                                  <td className="px-4 py-2 text-slate-600">{lic.categoria?.nome || '-'}</td>
                                  <td className="px-4 py-2 text-center text-slate-600">{lic.quantidade || '-'}</td>
                                  <td className="px-4 py-2 text-slate-600">{lic.dataVencimento ? formatDateBR(lic.dataVencimento) : 'Sem vencimento'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                        <table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-[35%]" />
                            <col className="w-[25%]" />
                            <col className="w-[20%]" />
                            <col className="w-[20%]" />
                          </colgroup>
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
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <button onClick={() => setSubDetalhe(subDetalhe === 'ch-abertos' ? null : 'ch-abertos')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'ch-abertos' ? 'bg-blue-100 ring-2 ring-blue-300' : 'bg-blue-50'}`}>
                    <p className="text-2xl font-bold text-blue-800">{data.chamados.abertosNoPeriodo}</p>
                    <p className="text-xs text-blue-600 mt-1">Abertos no Periodo</p>
                  </button>
                  <button onClick={() => setSubDetalhe(subDetalhe === 'ch-resolvidos' ? null : 'ch-resolvidos')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'ch-resolvidos' ? 'bg-green-100 ring-2 ring-green-300' : 'bg-green-50'}`}>
                    <p className="text-2xl font-bold text-green-800">{data.chamados.resolvidosNoPeriodo}</p>
                    <p className="text-xs text-green-600 mt-1">Resolvidos no Periodo</p>
                  </button>
                  <button onClick={() => setSubDetalhe(subDetalhe === 'ch-aberto' ? null : 'ch-aberto')}
                    className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${subDetalhe === 'ch-aberto' ? 'ring-2 ring-amber-300 bg-amber-100' : data.chamados.emAbertoAtual > 10 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <p className="text-2xl font-bold text-slate-800">{data.chamados.emAbertoAtual}</p>
                    <p className="text-xs text-slate-600 mt-1">Em Aberto (atual)</p>
                  </button>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{data.chamados.tempoMedioResolucaoHoras}h</p>
                    <p className="text-xs text-slate-600 mt-1">Tempo Medio Resolucao</p>
                  </div>
                </div>
                {(subDetalhe === 'ch-abertos' || subDetalhe === 'ch-resolvidos' || subDetalhe === 'ch-aberto') && (() => {
                  const lista = subDetalhe === 'ch-abertos' ? data.chamados.detalheAbertos
                    : subDetalhe === 'ch-resolvidos' ? data.chamados.detalheResolvidos
                    : data.chamados.detalheEmAberto;
                  const titulo = subDetalhe === 'ch-abertos' ? 'Abertos no Periodo' : subDetalhe === 'ch-resolvidos' ? 'Resolvidos no Periodo' : 'Em Aberto (atual)';
                  const prioridadeCores: Record<string, string> = {
                    CRITICA: 'bg-red-100 text-red-700', ALTA: 'bg-orange-100 text-orange-700',
                    MEDIA: 'bg-yellow-100 text-yellow-700', BAIXA: 'bg-green-100 text-green-700',
                  };
                  const statusCoresCh: Record<string, string> = {
                    ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
                    PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700',
                    FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-600',
                    REABERTO: 'bg-purple-100 text-purple-700',
                  };
                  return (
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-slate-500 mb-2 uppercase">{titulo} ({lista.length})</h4>
                      {lista.length === 0 ? <p className="text-sm text-slate-400">Nenhum chamado</p> : (
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                              <tr>
                                <th className="px-4 py-2 text-left">#</th>
                                <th className="px-4 py-2 text-left">Titulo</th>
                                <th className="px-4 py-2 text-left">Equipe</th>
                                <th className="px-4 py-2 text-left">Tecnico</th>
                                <th className="px-4 py-2 text-center">Prioridade</th>
                                <th className="px-4 py-2 text-center">Status</th>
                                <th className="px-4 py-2 text-left">Data</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lista.map((ch) => (
                                <tr key={ch.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 text-slate-500">{ch.numero}</td>
                                  <td className="px-4 py-2 font-medium text-slate-700 max-w-[300px] truncate">{ch.titulo}</td>
                                  <td className="px-4 py-2 text-slate-600">{ch.equipeAtual?.sigla || '-'}</td>
                                  <td className="px-4 py-2 text-slate-600">{ch.tecnico?.nome || '-'}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadeCores[ch.prioridade] || 'bg-slate-100 text-slate-600'}`}>{ch.prioridade}</span>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusCoresCh[ch.status] || 'bg-slate-100 text-slate-600'}`}>{ch.status}</span>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateBR(ch.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
