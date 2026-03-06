import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { dashboardService } from '../../services/dashboard.service';
import { BarChart3, AlertTriangle, Receipt, PieChart } from 'lucide-react';
import { PeriodFilter } from '../../components/PeriodFilter';
import type { DashboardFinanceiro } from '../../types';

const statusCores: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-700', ATIVO: 'bg-green-100 text-green-700', SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700', RENOVADO: 'bg-blue-100 text-blue-700', CANCELADO: 'bg-slate-200 text-slate-500',
};

export function DashboardFinanceiroPage() {
  const [data, setData] = useState<DashboardFinanceiro | null>(null);
  const [loading, setLoading] = useState(true);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(inicioMes.toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    dashboardService.getFinanceiro({ dataInicio, dataFim })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim]);

  if (loading) return <><Header title="Financeiro" /><div className="p-6"><p className="text-slate-500">Carregando...</p></div></>;
  if (!data) return <><Header title="Financeiro" /><div className="p-6"><p className="text-red-500">Erro ao carregar dados financeiros</p></div></>;

  const totalGeral = data.contratosPorTipo.reduce((s, t) => s + t.valorTotal, 0);

  return (
    <>
      <Header title="Dashboard Financeiro" />
      <div className="p-6">
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          onPeriodChange={(inicio, fim) => { setDataInicio(inicio); setDataFim(fim); }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Contratos por Tipo */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Contratos Ativos por Tipo
              </h4>
            </div>
            <div className="px-6 py-4">
              {data.contratosPorTipo.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum contrato ativo</p>
              ) : (
                <div className="space-y-3">
                  {data.contratosPorTipo.map((item, idx) => {
                    const pct = totalGeral > 0 ? (item.valorTotal / totalGeral) * 100 : 0;
                    return (
                      <div key={item.tipoContratoId || idx}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-700">{item.tipoNome || 'Sem tipo'} ({item.total})</span>
                          <span className="font-medium text-slate-800">R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div className="bg-capul-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-semibold text-slate-800">
                    <span>Total</span>
                    <span>R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Despesas por CC */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Despesas por Centro de Custo
              </h4>
            </div>
            <div className="divide-y divide-slate-100">
              {data.despesasPorCentroCusto.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-400">Nenhum rateio configurado</p>
              ) : (
                data.despesasPorCentroCusto.map((item) => (
                  <div key={item.centroCusto.id} className="px-6 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-700">{item.centroCusto.codigo} - {item.centroCusto.nome}</span>
                    <span className="text-sm font-semibold text-slate-800">
                      R$ {item.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Contratos por Status */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-700">Contratos por Status</h4>
            </div>
            <div className="px-6 py-4 flex flex-wrap gap-3">
              {data.contratosPorStatus.map((item) => (
                <div key={item.status} className={`px-4 py-2 rounded-lg text-sm ${statusCores[item.status] || 'bg-slate-100 text-slate-700'}`}>
                  <span className="font-semibold text-lg mr-1">{item.total}</span>
                  <span>{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Parcelas Proximas */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Parcelas no Periodo
              </h4>
            </div>
            <div className="divide-y divide-slate-100">
              {data.parcelasProximas.length === 0 ? (
                <p className="px-6 py-4 text-sm text-slate-400">Nenhuma parcela proxima</p>
              ) : (
                data.parcelasProximas.slice(0, 10).map((p) => {
                  const vencido = new Date(p.dataVencimento) < new Date();
                  return (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <Link to={`/gestao-ti/contratos/${p.contrato.id}`} className="text-sm text-capul-600 hover:underline">
                          #{p.contrato.numero} - {p.contrato.titulo}
                        </Link>
                        <p className="text-xs text-slate-400">Parcela #{p.numero} | {p.contrato.fornecedor}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-800">
                          R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs ${vencido ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                          {vencido && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {new Date(p.dataVencimento).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Contratos vencendo */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Contratos Vencendo no Periodo
            </h4>
          </div>
          {data.contratosVencendo.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">Nenhum contrato vencendo no periodo selecionado</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Fornecedor</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Software</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Dias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.contratosVencendo.map((c) => {
                  const dias = Math.ceil((new Date(c.dataFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500">{c.numero}</td>
                      <td className="px-4 py-2.5">
                        <Link to={`/gestao-ti/contratos/${c.id}`} className="text-capul-600 hover:underline">{c.titulo}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{c.fornecedor}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.software?.nome || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{new Date(c.dataFim).toLocaleDateString('pt-BR')}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${dias <= 30 ? 'text-red-600' : dias <= 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                        {dias}d
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
