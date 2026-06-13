import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import {
  DollarSign, ChevronLeft, ChevronRight, Building2, Package, Layers, Loader2, X,
  FileText, Receipt, Ticket, AlertTriangle, Users,
} from 'lucide-react';

// Indicadores — Análise (apresentação à direção). Cada indicador mostra o valor
// do mês AGRUPADO por dimensões, reconciliando com o total; clicar num grupo
// abre os documentos/registros que o compõem (drill-down sob demanda).

interface Grupo { id: string; label: string; valor: number; qtd: number }
interface AnaliticoInvest {
  totalInvestimento: number; totalNFs: number; totalParcelas: number;
  porCentroCusto: Grupo[]; porTipoProduto: Grupo[]; porDepartamento: Grupo[];
}
interface AnaliticoChamados {
  totalAbertos: number; porSetor: Grupo[]; porPrioridade: Grupo[]; porEquipe: Grupo[];
}
interface DocInvest { tipo: 'NF' | 'PARCELA'; id: string; numero: string; descricao: string; data: string | null; valor: number }
interface DocChamado { id: string; numero: number; titulo: string; status: string; prioridade: string; solicitante: string; data: string | null }
type DrillRow = DocInvest | DocChamado;

type Indicador = 'investimento' | 'chamados';
interface DrillSel { indicador: Indicador; dimensao: string; titulo: string; grupo: Grupo }

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => v.toLocaleString('pt-BR');
const RESIDUO = new Set(['__nf_resid', '__parc_resid', '__parc_norateio', '__contrato', '__nc', '__sd', '__se']);
const CORES = ['#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];
const PRIO_CLS: Record<string, string> = {
  CRITICA: 'bg-rose-100 text-rose-700', ALTA: 'bg-amber-100 text-amber-700',
  MEDIA: 'bg-sky-100 text-sky-700', BAIXA: 'bg-slate-100 text-slate-600',
};

export function IndicadoresAnalisePage() {
  const now = new Date();
  const [indicador, setIndicador] = useState<Indicador>('investimento');
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [invest, setInvest] = useState<AnaliticoInvest | null>(null);
  const [cham, setCham] = useState<AnaliticoChamados | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<DrillSel | null>(null);
  const [rows, setRows] = useState<DrillRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = { mes: String(mes), ano: String(ano) };
    const url = indicador === 'investimento' ? '/dashboard/investimento-analitico' : '/dashboard/chamados-analitico';
    gestaoApi.get(url, { params })
      .then((r) => (indicador === 'investimento' ? setInvest(r.data) : setCham(r.data)))
      .finally(() => setLoading(false));
  }, [indicador, mes, ano]);

  const prevMes = () => (mes === 1 ? (setMes(12), setAno(ano - 1)) : setMes(mes - 1));
  const nextMes = () => (mes === 12 ? (setMes(1), setAno(ano + 1)) : setMes(mes + 1));
  const noMesAtual = ano === now.getFullYear() && mes === now.getMonth() + 1;

  function abrirDrill(dimensao: string, titulo: string, grupo: Grupo) {
    setDrill({ indicador, dimensao, titulo, grupo });
    setRows(null);
    setRowsLoading(true);
    const base = indicador === 'investimento'
      ? '/dashboard/investimento-analitico/documentos'
      : '/dashboard/chamados-analitico/documentos';
    gestaoApi.get<DrillRow[]>(base, { params: { mes: String(mes), ano: String(ano), dimensao, chave: grupo.id } })
      .then((r) => setRows(r.data))
      .finally(() => setRowsLoading(false));
  }

  const dadosVazios = indicador === 'investimento'
    ? !invest || invest.totalInvestimento === 0
    : !cham || cham.totalAbertos === 0;

  return (
    <>
      <Header title="Indicadores — Análise" />
      <div className="p-6">
        {/* Seletor de indicador */}
        <div className="mb-5 flex flex-wrap gap-2">
          <TabBtn ativo={indicador === 'investimento'} onClick={() => setIndicador('investimento')} icone={DollarSign} label="Investimento" />
          <TabBtn ativo={indicador === 'chamados'} onClick={() => setIndicador('chamados')} icone={Ticket} label="Chamados" />
        </div>

        {/* Seletor de mês */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={prevMes} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center min-w-[160px]">
            <p className="text-lg font-bold text-slate-800">{meses[mes - 1]} {ano}</p>
            <p className="text-xs text-slate-500">{indicador === 'investimento' ? 'Investimento agrupado' : 'Chamados abertos no mês'}</p>
          </div>
          <button onClick={nextMes} disabled={noMesAtual} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
        ) : dadosVazios ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Sem {indicador === 'investimento' ? 'investimento lançado' : 'chamados abertos'} em {meses[mes - 1]} {ano}.
          </div>
        ) : indicador === 'investimento' && invest ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-capul-200 bg-capul-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-capul-600 p-2.5"><DollarSign className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-capul-700">Investimento total no mês</p>
                  <p className="text-3xl font-bold text-slate-800">{brl(invest.totalInvestimento)}</p>
                  <p className="text-xs text-slate-500">Notas fiscais {brl(invest.totalNFs)} · Contratos/parcelas {brl(invest.totalParcelas)}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CardGrupo titulo="Por centro de custo" dimensao="centroCusto" icone={Building2} itens={invest.porCentroCusto} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
              <CardGrupo titulo="Por tipo de produto" dimensao="tipoProduto" icone={Package} itens={invest.porTipoProduto} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
              <CardGrupo titulo="Por departamento" dimensao="departamento" icone={Layers} itens={invest.porDepartamento} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
            </div>
            <p className="text-xs text-slate-400">Clique num item para ver os documentos (notas/contratos). A soma de cada agrupamento reconcilia com o total; linhas em cinza são valores ainda não detalhados na origem.</p>
          </div>
        ) : cham ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-capul-200 bg-capul-50 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-capul-600 p-2.5"><Ticket className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-capul-700">Chamados abertos no mês</p>
                  <p className="text-3xl font-bold text-slate-800">{num(cham.totalAbertos)}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CardGrupo titulo="Por setor" dimensao="setor" icone={Building2} itens={cham.porSetor} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
              <CardGrupo titulo="Por prioridade" dimensao="prioridade" icone={AlertTriangle} itens={cham.porPrioridade} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
              <CardGrupo titulo="Por equipe" dimensao="equipe" icone={Users} itens={cham.porEquipe} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
            </div>
            <p className="text-xs text-slate-400">Clique num item para ver os chamados que o compõem. A soma de cada agrupamento é igual ao total de chamados abertos no mês.</p>
          </div>
        ) : null}
      </div>

      {drill && <DrillModal sel={drill} rows={rows} loading={rowsLoading} onClose={() => setDrill(null)} />}
    </>
  );
}

function TabBtn({ ativo, onClick, icone: Icone, label }: { ativo: boolean; onClick: () => void; icone: typeof DollarSign; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${ativo ? 'bg-capul-600 text-white shadow-sm' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
      <Icone className="w-4 h-4" /> {label}
    </button>
  );
}

function CardGrupo({ titulo, dimensao, icone: Icone, itens, total, fmt, sufixoQtd, onSelect }: {
  titulo: string; dimensao: string; icone: typeof Building2; itens: Grupo[]; total: number;
  fmt: (n: number) => string; sufixoQtd: string; onSelect: (dimensao: string, titulo: string, grupo: Grupo) => void;
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
                className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50" title="Ver detalhes deste item">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={`truncate ${residuo ? 'text-slate-400 italic' : 'text-slate-700'}`} title={g.label}>{g.label}</span>
                  <span className="shrink-0 font-semibold text-slate-800">{fmt(g.valor)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] text-slate-400">{pct.toFixed(1)}%{sufixoQtd ? ` · ${g.qtd} ${sufixoQtd}` : ''}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DrillModal({ sel, rows, loading, onClose }: { sel: DrillSel; rows: DrillRow[] | null; loading: boolean; onClose: () => void }) {
  const ehInvest = sel.indicador === 'investimento';
  const soma = ehInvest && rows ? (rows as DocInvest[]).reduce((s, d) => s + d.valor, 0) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{sel.titulo}</p>
            <p className="text-base font-semibold text-slate-800">{sel.grupo.label}</p>
            <p className="text-sm text-slate-500">{ehInvest ? brl(sel.grupo.valor) : `${num(sel.grupo.valor)} chamado(s)`}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum registro.</div>
        ) : ehInvest ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-2">Documento</th><th className="px-5 py-2">Origem</th><th className="px-5 py-2">Data</th><th className="px-5 py-2 text-right">Valor</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(rows as DocInvest[]).map((d) => (
                <tr key={`${d.tipo}-${d.id}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-2">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      {d.tipo === 'NF' ? <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : <Receipt className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                      {d.tipo === 'NF' ? `NF ${d.numero}` : d.numero}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600">{d.descricao}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-right font-semibold text-slate-800">{brl(d.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={3}>Total ({rows.length})</td><td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{brl(soma)}</td></tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-2">Chamado</th><th className="px-5 py-2">Título</th><th className="px-5 py-2">Solicitante</th><th className="px-5 py-2">Prioridade</th><th className="px-5 py-2">Data</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(rows as DocChamado[]).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-2 font-medium text-slate-700">#{c.numero}</td>
                  <td className="px-5 py-2 text-slate-700">{c.titulo}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600">{c.solicitante}</td>
                  <td className="whitespace-nowrap px-5 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIO_CLS[c.prioridade] ?? 'bg-slate-100 text-slate-600'}`}>{c.prioridade}</span></td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{c.data ? new Date(c.data).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={5}>Total: {rows.length} chamado(s)</td></tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
