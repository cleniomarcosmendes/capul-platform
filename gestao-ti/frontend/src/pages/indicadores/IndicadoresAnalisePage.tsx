import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { gestaoApi } from '../../services/api';
import {
  DollarSign, ChevronLeft, ChevronRight, Building2, Package, Layers, Loader2, X,
  FileText, Receipt, Ticket, AlertTriangle, Users, KeyRound, Activity, Clock, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';

// Indicadores — Análise (apresentação à direção). Cada indicador mostra o valor
// do mês AGRUPADO por dimensões (reconciliando com o total); clicar num grupo
// abre os documentos/registros que o compõem (drill-down sob demanda). TODOS por
// WORKSPACE (escopo por departamento, igual aos indicadores estratégicos).

interface Grupo { id: string; label: string; valor: number; qtd: number }
interface AnaliticoInvest {
  totalInvestimento: number; totalNFs: number; totalParcelas: number;
  porCentroCusto: Grupo[]; porTipoProduto: Grupo[]; porDepartamento: Grupo[];
}
interface EvolucaoPonto { ano: number; mes: number; totalInvestimento: number; totalNFs: number; totalParcelas: number }
interface EvolucaoDimSerie { key: string; label: string }
interface EvolucaoDimPonto { ano: number; mes: number; valores: Record<string, number> }
interface EvolucaoDim { dimensao: string; series: EvolucaoDimSerie[]; pontos: EvolucaoDimPonto[] }
type DimChart = 'total' | 'centroCusto' | 'tipoProduto' | 'departamento';
interface AnaliticoChamados { totalAbertos: number; porSetor: Grupo[]; porPrioridade: Grupo[]; porEquipe: Grupo[] }
interface AnaliticoGenerico {
  total: number; metrica: 'contagem' | 'horas'; titulo: string;
  grupos: { dimensao: string; titulo: string; itens: Grupo[] }[];
}
interface DocInvest { tipo: 'NF' | 'PARCELA'; id: string; numero: string; descricao: string; data: string | null; valor: number }
interface DocChamado { id: string; numero: number; titulo: string; status: string; prioridade: string; solicitante: string; data: string | null }
interface DocGenerico { id: string; principal: string; secundario: string; terciario?: string; data: string | null; valor: number }
type DrillRow = DocInvest | DocChamado | DocGenerico;

type Indicador = 'investimento' | 'chamados' | 'licencas' | 'disponibilidade' | 'horasDev';
interface DrillSel { indicador: Indicador; metrica: 'contagem' | 'horas' | 'moeda'; dimensao: string; titulo: string; grupo: Grupo }

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const mesAbrev = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCompacto = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : v.toLocaleString('pt-BR');
const num = (v: number) => v.toLocaleString('pt-BR');
const hrs = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
const RESIDUO = new Set(['__nf_resid', '__parc_resid', '__parc_norateio', '__contrato', '__nc', '__sd', '__se', '__sf', '__ss', '__sc', '__sm']);
const CORES = ['#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];
const PRIO_CLS: Record<string, string> = {
  CRITICA: 'bg-rose-100 text-rose-700', ALTA: 'bg-amber-100 text-amber-700',
  MEDIA: 'bg-sky-100 text-sky-700', BAIXA: 'bg-slate-100 text-slate-600',
};
// Config dos indicadores GENÉRICOS (shape {total,metrica,titulo,grupos}).
const GEN: Record<'licencas' | 'disponibilidade' | 'horasDev', { label: string; icone: typeof KeyRound; endpoint: string; semMes?: boolean }> = {
  licencas: { label: 'Licenças', icone: KeyRound, endpoint: 'licencas-analitico', semMes: true },
  disponibilidade: { label: 'Disponibilidade', icone: Activity, endpoint: 'disponibilidade-analitico' },
  horasDev: { label: 'Horas Dev', icone: Clock, endpoint: 'horas-dev-analitico' },
};
const ICONE_GRUPO: Record<string, typeof Building2> = {
  centroCusto: Building2, tipoProduto: Package, departamento: Layers,
  setor: Building2, prioridade: AlertTriangle, equipe: Users,
  fornecedor: Building2, software: Package, categoria: Layers,
  tipo: AlertTriangle, motivo: AlertTriangle, projeto: Package, analista: Users,
};

export function IndicadoresAnalisePage() {
  const now = new Date();
  const [indicador, setIndicador] = useState<Indicador>('investimento');
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [invest, setInvest] = useState<AnaliticoInvest | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoPonto[] | null>(null);
  const [dimChart, setDimChart] = useState<DimChart>('total');
  const [evolDim, setEvolDim] = useState<EvolucaoDim | null>(null);
  const [evolDimLoading, setEvolDimLoading] = useState(false);
  const [cham, setCham] = useState<AnaliticoChamados | null>(null);
  const [gen, setGen] = useState<AnaliticoGenerico | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<DrillSel | null>(null);
  const [rows, setRows] = useState<DrillRow[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);

  const ehGenerico = indicador !== 'investimento' && indicador !== 'chamados';

  useEffect(() => {
    setLoading(true);
    const params = { mes: String(mes), ano: String(ano) };
    if (indicador === 'investimento') {
      Promise.all([
        gestaoApi.get('/dashboard/investimento-analitico', { params }),
        gestaoApi.get('/dashboard/investimento-evolucao', { params }),
      ]).then(([a, e]) => { setInvest(a.data); setEvolucao(e.data); }).finally(() => setLoading(false));
    } else if (indicador === 'chamados') {
      gestaoApi.get('/dashboard/chamados-analitico', { params }).then((r) => setCham(r.data)).finally(() => setLoading(false));
    } else {
      const cfg = GEN[indicador];
      gestaoApi.get(`/dashboard/${cfg.endpoint}`, { params }).then((r) => setGen(r.data)).finally(() => setLoading(false));
    }
  }, [indicador, mes, ano]);

  // Evolução quebrada por dimensão (gráfico empilhado). 'total' usa a série
  // simples já carregada; as demais buscam o endpoint da dimensão escolhida.
  useEffect(() => {
    if (indicador !== 'investimento' || dimChart === 'total') { setEvolDim(null); return; }
    setEvolDimLoading(true);
    gestaoApi.get('/dashboard/investimento-evolucao-dimensao', { params: { mes: String(mes), ano: String(ano), dimensao: dimChart } })
      .then((r) => setEvolDim(r.data)).finally(() => setEvolDimLoading(false));
  }, [indicador, dimChart, mes, ano]);

  const prevMes = () => (mes === 1 ? (setMes(12), setAno(ano - 1)) : setMes(mes - 1));
  const nextMes = () => (mes === 12 ? (setMes(1), setAno(ano + 1)) : setMes(mes + 1));
  const noMesAtual = ano === now.getFullYear() && mes === now.getMonth() + 1;

  function abrirDrill(dimensao: string, titulo: string, grupo: Grupo) {
    const metrica: DrillSel['metrica'] = indicador === 'investimento' ? 'moeda' : indicador === 'chamados' ? 'contagem' : (gen?.metrica ?? 'contagem');
    setDrill({ indicador, metrica, dimensao, titulo, grupo });
    setRows(null);
    setRowsLoading(true);
    const base =
      indicador === 'investimento' ? '/dashboard/investimento-analitico/documentos'
      : indicador === 'chamados' ? '/dashboard/chamados-analitico/documentos'
      : `/dashboard/${GEN[indicador].endpoint}/documentos`;
    gestaoApi.get<DrillRow[]>(base, { params: { mes: String(mes), ano: String(ano), dimensao, chave: grupo.id } })
      .then((r) => setRows(r.data)).finally(() => setRowsLoading(false));
  }

  const vazio = indicador === 'investimento' ? (!invest || invest.totalInvestimento === 0)
    : indicador === 'chamados' ? (!cham || cham.totalAbertos === 0)
    : (!gen || gen.total === 0);

  return (
    <>
      <Header title="Indicadores — Análise" />
      <div className="p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <TabBtn ativo={indicador === 'investimento'} onClick={() => setIndicador('investimento')} icone={DollarSign} label="Investimento" />
          <TabBtn ativo={indicador === 'chamados'} onClick={() => setIndicador('chamados')} icone={Ticket} label="Chamados" />
          {(['licencas', 'disponibilidade', 'horasDev'] as const).map((k) => (
            <TabBtn key={k} ativo={indicador === k} onClick={() => setIndicador(k)} icone={GEN[k].icone} label={GEN[k].label} />
          ))}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button onClick={prevMes} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center min-w-[160px]">
            <p className="text-lg font-bold text-slate-800">{meses[mes - 1]} {ano}</p>
            <p className="text-xs text-slate-500">{ehGenerico && GEN[indicador as 'licencas'].semMes ? 'Situação atual' : 'Indicador por workspace'}</p>
          </div>
          <button onClick={nextMes} disabled={noMesAtual} className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
        ) : (
        <>
        {indicador === 'investimento' && evolucao && evolucao.length > 0 && (
          <div className="mb-5">
            <EvolucaoInvestimento dados={evolucao} dim={evolDim} dimChart={dimChart} setDimChart={setDimChart}
              dimLoading={evolDimLoading} mesSel={mes} anoSel={ano} onSelecionar={(m, a) => { setMes(m); setAno(a); }} />
          </div>
        )}
        {vazio ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">Sem dados em {meses[mes - 1]} {ano}.</div>
        ) : indicador === 'investimento' && invest ? (
          <div className="space-y-5">
            <Manchete icone={DollarSign} rotulo="Investimento total no mês" valor={brl(invest.totalInvestimento)}
              sub={`Notas fiscais ${brl(invest.totalNFs)} · Contratos/parcelas ${brl(invest.totalParcelas)}`} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CardGrupo titulo="Por centro de custo" dimensao="centroCusto" icone={Building2} itens={invest.porCentroCusto} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
              <CardGrupo titulo="Por tipo de produto" dimensao="tipoProduto" icone={Package} itens={invest.porTipoProduto} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
              <CardGrupo titulo="Por departamento" dimensao="departamento" icone={Layers} itens={invest.porDepartamento} total={invest.totalInvestimento} fmt={brl} sufixoQtd="docs" onSelect={abrirDrill} />
            </div>
            <Nota>Clique num item para ver os documentos (notas/contratos). A soma reconcilia com o total; linhas em cinza são valores não detalhados na origem.</Nota>
          </div>
        ) : indicador === 'chamados' && cham ? (
          <div className="space-y-5">
            <Manchete icone={Ticket} rotulo="Chamados abertos no mês" valor={num(cham.totalAbertos)} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <CardGrupo titulo="Por setor" dimensao="setor" icone={Building2} itens={cham.porSetor} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
              <CardGrupo titulo="Por prioridade" dimensao="prioridade" icone={AlertTriangle} itens={cham.porPrioridade} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
              <CardGrupo titulo="Por equipe" dimensao="equipe" icone={Users} itens={cham.porEquipe} total={cham.totalAbertos} fmt={num} sufixoQtd="" onSelect={abrirDrill} />
            </div>
            <Nota>Setor = departamento de quem abriu; escopo restrito ao workspace. Clique num item para ver os chamados.</Nota>
          </div>
        ) : gen ? (
          <div className="space-y-5">
            <Manchete icone={GEN[indicador as 'licencas'].icone} rotulo={gen.titulo}
              valor={gen.metrica === 'horas' ? hrs(gen.total) : num(gen.total)} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {gen.grupos.map((g) => (
                <CardGrupo key={g.dimensao} titulo={g.titulo} dimensao={g.dimensao} icone={ICONE_GRUPO[g.dimensao] ?? Layers}
                  itens={g.itens} total={gen.total} fmt={gen.metrica === 'horas' ? hrs : num} sufixoQtd="" onSelect={abrirDrill} />
              ))}
            </div>
            <Nota>Clique num item para ver os registros. Escopo restrito ao workspace.</Nota>
          </div>
        ) : null}
        </>
        )}
      </div>

      {drill && <DrillModal sel={drill} rows={rows} loading={rowsLoading} onClose={() => setDrill(null)} />}
    </>
  );
}

// Gráfico de tendência: investimento total nos últimos 12 meses. Cada ponto
// reconcilia com a manchete daquele mês; clicar navega até o mês.
type EvoData = EvolucaoPonto & { rotulo: string; atual: boolean };
const corSerie = (key: string, idx: number) =>
  RESIDUO.has(key) || key === '__outros' ? '#cbd5e1' : CORES[idx % CORES.length];

const cliqueMes = (onSelecionar: (mes: number, ano: number) => void) => (state: unknown) => {
  const p = (state as { activePayload?: { payload: { mes: number; ano: number } }[] })?.activePayload?.[0]?.payload;
  if (p) onSelecionar(p.mes, p.ano);
};

function EvolucaoInvestimento({ dados, dim, dimChart, setDimChart, dimLoading, mesSel, anoSel, onSelecionar }: {
  dados: EvolucaoPonto[]; dim: EvolucaoDim | null; dimChart: DimChart; setDimChart: (d: DimChart) => void;
  dimLoading: boolean; mesSel: number; anoSel: number; onSelecionar: (mes: number, ano: number) => void;
}) {
  const opcoes: { k: DimChart; label: string }[] = [
    { k: 'total', label: 'Total' }, { k: 'centroCusto', label: 'Centro de custo' },
    { k: 'tipoProduto', label: 'Tipo de produto' }, { k: 'departamento', label: 'Departamento' },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <TrendingUp className="h-4 w-4 text-capul-600" /> Evolução do investimento (12 meses)
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {opcoes.map((o) => (
            <button key={o.k} onClick={() => setDimChart(o.k)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${dimChart === o.k ? 'bg-capul-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {dimChart === 'total' ? (
        <GraficoTotal dados={dados} mesSel={mesSel} anoSel={anoSel} onSelecionar={onSelecionar} />
      ) : dimLoading || !dim ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <GraficoEmpilhado dim={dim} mesSel={mesSel} anoSel={anoSel} onSelecionar={onSelecionar} />
      )}
      <p className="mt-2 text-xs text-slate-400">
        {dimChart === 'total' ? 'Linha tracejada = média dos 12 meses. ' : 'Faixas empilhadas somam o total do mês (top 6 + “Outros”). '}
        Clique num mês para abrir o detalhamento.
      </p>
    </div>
  );
}

function GraficoTotal({ dados, mesSel, anoSel, onSelecionar }: {
  dados: EvolucaoPonto[]; mesSel: number; anoSel: number; onSelecionar: (mes: number, ano: number) => void;
}) {
  const data: EvoData[] = dados.map((p) => ({
    ...p, rotulo: `${mesAbrev[p.mes - 1]}/${String(p.ano).slice(2)}`, atual: p.mes === mesSel && p.ano === anoSel,
  }));
  const media = data.length ? data.reduce((s, p) => s + p.totalInvestimento, 0) / data.length : 0;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} onClick={cliqueMes(onSelecionar)} style={{ cursor: 'pointer' }}>
        <defs>
          <linearGradient id="gradInvest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#006838" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#006838" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={brlCompacto} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TooltipInvest />} />
        {media > 0 && <ReferenceLine y={media} stroke="#cbd5e1" strokeDasharray="4 4" />}
        <Area type="monotone" dataKey="totalInvestimento" stroke="#006838" strokeWidth={2}
          fill="url(#gradInvest)" dot={<DotInvest />} activeDot={{ r: 5, fill: '#006838' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function GraficoEmpilhado({ dim, mesSel, anoSel, onSelecionar }: {
  dim: EvolucaoDim; mesSel: number; anoSel: number; onSelecionar: (mes: number, ano: number) => void;
}) {
  let ci = 0;
  const cor: Record<string, string> = {};
  dim.series.forEach((s) => { cor[s.key] = corSerie(s.key, ci); if (!RESIDUO.has(s.key) && s.key !== '__outros') ci++; });
  const data = dim.pontos.map((p) => ({
    rotulo: `${mesAbrev[p.mes - 1]}/${String(p.ano).slice(2)}`, mes: p.mes, ano: p.ano,
    atual: p.mes === mesSel && p.ano === anoSel, ...p.valores,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} onClick={cliqueMes(onSelecionar)} style={{ cursor: 'pointer' }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={brlCompacto} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<TooltipEmpilhado series={dim.series} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        {dim.series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="inv"
            stroke={cor[s.key]} fill={cor[s.key]} fillOpacity={0.85} strokeWidth={1} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TooltipEmpilhado({ active, payload, series }: {
  active?: boolean; payload?: { dataKey: string; value: number; color: string; payload: { rotulo: string } }[]; series: EvolucaoDimSerie[];
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + (e.value || 0), 0);
  const labelOf = (k: string) => series.find((s) => s.key === k)?.label ?? k;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize text-slate-700">{payload[0].payload.rotulo}</p>
      <p className="mb-1 font-bold text-capul-700">Total {brl(total)}</p>
      {payload.slice().reverse().filter((e) => e.value > 0).map((e) => (
        <p key={e.dataKey} className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="truncate">{labelOf(e.dataKey)}</span>
          <span className="ml-auto pl-2 font-medium">{brl(e.value)}</span>
        </p>
      ))}
    </div>
  );
}

function DotInvest({ cx, cy, payload }: { cx?: number; cy?: number; payload?: EvoData }) {
  if (cx == null || cy == null) return null;
  const atual = payload?.atual;
  return <circle cx={cx} cy={cy} r={atual ? 5 : 3} fill={atual ? '#006838' : '#fff'} stroke="#006838" strokeWidth={2} />;
}

function TooltipInvest({ active, payload }: { active?: boolean; payload?: { payload: EvoData }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize text-slate-700">{p.rotulo}</p>
      <p className="font-bold text-capul-700">{brl(p.totalInvestimento)}</p>
      <p className="text-slate-500">NFs {brl(p.totalNFs)} · Contratos {brl(p.totalParcelas)}</p>
    </div>
  );
}

function Manchete({ icone: Icone, rotulo, valor, sub }: { icone: typeof DollarSign; rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-capul-200 bg-capul-50 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-capul-600 p-2.5"><Icone className="w-6 h-6 text-white" /></div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-capul-700">{rotulo}</p>
          <p className="text-3xl font-bold text-slate-800">{valor}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

const Nota = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-slate-400">{children}</p>;

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
        {itens.length === 0 && <li className="px-2 py-3 text-sm text-slate-400">Sem dados.</li>}
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
  const ehChamado = sel.indicador === 'chamados';
  const mostraValor = sel.metrica === 'moeda' || sel.metrica === 'horas';
  const fmtVal = sel.metrica === 'moeda' ? brl : sel.metrica === 'horas' ? hrs : num;
  const soma = mostraValor && rows ? (rows as { valor: number }[]).reduce((s, d) => s + d.valor, 0) : 0;
  const valLabel = ehInvest ? brl(sel.grupo.valor) : sel.metrica === 'horas' ? hrs(sel.grupo.valor) : `${num(sel.grupo.valor)} ${ehChamado ? 'chamado(s)' : 'registro(s)'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{sel.titulo}</p>
            <p className="text-base font-semibold text-slate-800">{sel.grupo.label}</p>
            <p className="text-sm text-slate-500">{valLabel}</p>
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
                  <td className="whitespace-nowrap px-5 py-2"><span className="inline-flex items-center gap-1.5 font-medium text-slate-700">{d.tipo === 'NF' ? <FileText className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : <Receipt className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}{d.tipo === 'NF' ? `NF ${d.numero}` : d.numero}</span></td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600">{d.descricao}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-right font-semibold text-slate-800">{brl(d.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={3}>Total ({rows.length})</td><td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{brl(soma)}</td></tr></tfoot>
          </table>
        ) : ehChamado ? (
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
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={5}>Total: {rows.length} chamado(s)</td></tr></tfoot>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-2">Item</th><th className="px-5 py-2">Detalhe</th><th className="px-5 py-2">Data</th>{mostraValor && <th className="px-5 py-2 text-right">Valor</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(rows as DocGenerico[]).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-2 font-medium text-slate-700">{d.principal}</td>
                  <td className="px-5 py-2 text-slate-600">{d.secundario}{d.terciario ? <span className="text-slate-400"> · {d.terciario}</span> : ''}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                  {mostraValor && <td className="whitespace-nowrap px-5 py-2 text-right font-semibold text-slate-800">{fmtVal(d.valor)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={mostraValor ? 3 : 3}>Total ({rows.length})</td>{mostraValor && <td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{fmtVal(soma)}</td>}</tr></tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
