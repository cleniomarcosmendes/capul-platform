import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import { DollarSign, ChevronLeft, ChevronRight, Building2, Package, Layers, Loader2 } from 'lucide-react';

// Indicadores — Análise (apresentação à direção). Começa pelo INVESTIMENTO do
// mês AGRUPADO por centro de custo, tipo de produto e departamento. O total de
// cada agrupamento RECONCILIA com o KPI manchete (baldes de resíduo no backend).

interface Grupo { id: string; label: string; valor: number; qtd: number }
interface Analitico {
  periodo: { mes: number; ano: number };
  totalInvestimento: number;
  totalNFs: number;
  totalParcelas: number;
  porCentroCusto: Grupo[];
  porTipoProduto: Grupo[];
  porDepartamento: Grupo[];
}

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Resíduos/baldes de reconciliação (cinza); demais ganham cor da paleta.
const RESIDUO = new Set(['__nf_resid', '__parc_resid', '__parc_norateio', '__contrato', '__nc', '__sd']);
const CORES = ['#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];

export function IndicadoresAnalisePage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [data, setData] = useState<Analitico | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    gestaoApi
      .get<Analitico>('/dashboard/investimento-analitico', { params: { mes: String(mes), ano: String(ano) } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [mes, ano]);

  const prevMes = () => (mes === 1 ? (setMes(12), setAno(ano - 1)) : setMes(mes - 1));
  const nextMes = () => (mes === 12 ? (setMes(1), setAno(ano + 1)) : setMes(mes + 1));
  const noMesAtual = ano === now.getFullYear() && mes === now.getMonth() + 1;

  return (
    <>
      <Header title="Indicadores — Análise" />
      <div className="p-6">
        {/* Seletor de mês */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={prevMes} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center min-w-[160px]">
            <p className="text-lg font-bold text-slate-800">{meses[mes - 1]} {ano}</p>
            <p className="text-xs text-slate-500">Investimento agrupado</p>
          </div>
          <button onClick={nextMes} disabled={noMesAtual}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
        ) : data.totalInvestimento === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Sem investimento lançado em {meses[mes - 1]} {ano}.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Manchete */}
            <div className="rounded-2xl border border-capul-200 bg-capul-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-capul-600 p-2.5"><DollarSign className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-capul-700">Investimento total no mês</p>
                  <p className="text-3xl font-bold text-slate-800">{brl(data.totalInvestimento)}</p>
                  <p className="text-xs text-slate-500">
                    Notas fiscais {brl(data.totalNFs)} · Contratos/parcelas {brl(data.totalParcelas)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CardGrupo titulo="Por centro de custo" icone={Building2} itens={data.porCentroCusto} total={data.totalInvestimento} />
              <CardGrupo titulo="Por tipo de produto" icone={Package} itens={data.porTipoProduto} total={data.totalInvestimento} />
              <CardGrupo titulo="Por departamento" icone={Layers} itens={data.porDepartamento} total={data.totalInvestimento} />
            </div>

            <p className="text-xs text-slate-400">
              A soma de cada agrupamento reconcilia com o investimento total do mês. Linhas em cinza
              (ex.: "Não classificado", "Contratos sem rateio") são valores ainda não detalhados na origem.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function CardGrupo({ titulo, icone: Icone, itens, total }: {
  titulo: string; icone: typeof Building2; itens: Grupo[]; total: number;
}) {
  let corIdx = 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
        <Icone className="w-4 h-4 text-capul-600" /> {titulo}
      </div>
      <ul className="divide-y divide-slate-50 p-2">
        {itens.map((g) => {
          const pct = total > 0 ? (g.valor / total) * 100 : 0;
          const residuo = RESIDUO.has(g.id);
          const cor = residuo ? '#cbd5e1' : CORES[corIdx++ % CORES.length];
          return (
            <li key={g.id} className="px-2 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={`truncate ${residuo ? 'text-slate-400 italic' : 'text-slate-700'}`} title={g.label}>{g.label}</span>
                <span className="shrink-0 font-semibold text-slate-800">{brl(g.valor)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] text-slate-400">{pct.toFixed(1)}% · {g.qtd}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
