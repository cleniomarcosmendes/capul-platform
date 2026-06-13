import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import { DollarSign, ChevronLeft, ChevronRight, Building2, Package, Layers, Loader2, X, FileText, Receipt } from 'lucide-react';

// Indicadores — Análise (apresentação à direção). Começa pelo INVESTIMENTO do
// mês AGRUPADO por centro de custo, tipo de produto e departamento. O total de
// cada agrupamento RECONCILIA com o KPI manchete (baldes de resíduo no backend).

interface Grupo { id: string; label: string; valor: number; qtd: number }
type Dimensao = 'centroCusto' | 'tipoProduto' | 'departamento';
interface DocInvest { tipo: 'NF' | 'PARCELA'; id: string; numero: string; descricao: string; data: string | null; valor: number }
interface DrillSel { dimensao: Dimensao; titulo: string; grupo: Grupo }
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
  // Drill-down: documentos do grupo selecionado (carregados sob demanda).
  const [drill, setDrill] = useState<DrillSel | null>(null);
  const [docs, setDocs] = useState<DocInvest[] | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    gestaoApi
      .get<Analitico>('/dashboard/investimento-analitico', { params: { mes: String(mes), ano: String(ano) } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [mes, ano]);

  function abrirDrill(dimensao: Dimensao, titulo: string, grupo: Grupo) {
    setDrill({ dimensao, titulo, grupo });
    setDocs(null);
    setDocsLoading(true);
    gestaoApi
      .get<DocInvest[]>('/dashboard/investimento-analitico/documentos', {
        params: { mes: String(mes), ano: String(ano), dimensao, chave: grupo.id },
      })
      .then((r) => setDocs(r.data))
      .finally(() => setDocsLoading(false));
  }

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
              <CardGrupo titulo="Por centro de custo" dimensao="centroCusto" icone={Building2} itens={data.porCentroCusto} total={data.totalInvestimento} onSelect={abrirDrill} />
              <CardGrupo titulo="Por tipo de produto" dimensao="tipoProduto" icone={Package} itens={data.porTipoProduto} total={data.totalInvestimento} onSelect={abrirDrill} />
              <CardGrupo titulo="Por departamento" dimensao="departamento" icone={Layers} itens={data.porDepartamento} total={data.totalInvestimento} onSelect={abrirDrill} />
            </div>

            <p className="text-xs text-slate-400">
              Clique num item para ver os documentos (notas/contratos) que geraram o valor. A soma de cada
              agrupamento reconcilia com o investimento total do mês; linhas em cinza ("Não classificado",
              "Contratos sem rateio") são valores ainda não detalhados na origem.
            </p>
          </div>
        )}
      </div>

      {drill && (
        <DrillModal
          sel={drill}
          docs={docs}
          loading={docsLoading}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}

function DrillModal({ sel, docs, loading, onClose }: {
  sel: DrillSel; docs: DocInvest[] | null; loading: boolean; onClose: () => void;
}) {
  const soma = docs ? docs.reduce((s, d) => s + d.valor, 0) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{sel.titulo}</p>
            <p className="text-base font-semibold text-slate-800">{sel.grupo.label}</p>
            <p className="text-sm text-slate-500">{brl(sel.grupo.valor)} · {sel.grupo.qtd} lançamento(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos…</div>
        ) : !docs || docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum documento.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-2">Documento</th>
                  <th className="px-5 py-2">Origem</th>
                  <th className="px-5 py-2">Data</th>
                  <th className="px-5 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((d) => (
                  <tr key={`${d.tipo}-${d.id}`} className="hover:bg-slate-50">
                    <td className="px-5 py-2">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        {d.tipo === 'NF' ? <FileText className="h-3.5 w-3.5 text-sky-600" /> : <Receipt className="h-3.5 w-3.5 text-indigo-600" />}
                        {d.tipo === 'NF' ? `NF ${d.numero}` : d.numero}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-slate-600">{d.descricao}</td>
                    <td className="px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-5 py-2 text-right font-semibold text-slate-800">{brl(d.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={3}>Total ({docs.length})</td>
                  <td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{brl(soma)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function CardGrupo({ titulo, dimensao, icone: Icone, itens, total, onSelect }: {
  titulo: string; dimensao: Dimensao; icone: typeof Building2; itens: Grupo[]; total: number;
  onSelect: (dimensao: Dimensao, titulo: string, grupo: Grupo) => void;
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
            <li key={g.id}>
              <button onClick={() => onSelect(dimensao, titulo, g)}
                className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                title="Ver documentos deste item">
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
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
