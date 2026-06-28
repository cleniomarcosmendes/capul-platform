import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Filter, Loader2, MapPin, Package, RefreshCw, Tag, TrendingUp, Users, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';

// Análise das entregas (apresentação à gestão): nº de entregas do mês AGRUPADO
// por origem/status/motorista/bairro (reconcilia com o total); clicar num grupo
// abre as entregas que o compõem (drill-down). Métrica primária = contagem;
// valor (cupons) aparece por linha no drill. Espelha o "Análise" do Workspace.

interface Grupo { id: string; label: string; qtd: number; valor: number }
interface Analitico {
  totalEntregas: number; valorTotal: number;
  porOrigem: Grupo[]; porStatus: Grupo[]; porMotorista: Grupo[]; porBairro: Grupo[];
}
interface Doc { id: string; principal: string; secundario: string; terciario?: string; data: string | null; valor: number }
interface DrillSel { dimensao: string; titulo: string; grupo: Grupo }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = (v: number) => v.toLocaleString('pt-BR');
const CORES = ['#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];
const ehResiduo = (id: string) => id === '__sem';
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

const ORIGENS: [string, string][] = [['PRESENCIAL', 'Presencial'], ['TELE_VENDA', 'Tele-venda'], ['OUTRO', 'Outro'], ['NAO_INFORMADO', 'Não informado']];
const STATUSES: [string, string][] = [['PENDENTE', 'Pendente'], ['EM_VIAGEM', 'Em viagem'], ['ENTREGUE', 'Entregue'], ['NAO_ENTREGUE', 'Não entregue']];
const selCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 focus:border-capul-500 focus:outline-none';

export function EntregaAnalisePage() {
  const { toast } = useToast();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [data, setData] = useState<Analitico | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<DrillSel | null>(null);
  const [rows, setRows] = useState<Doc[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);

  // Filtros (estreitam o conjunto; total e cards reconciliam com o recorte).
  const [fOrigem, setFOrigem] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fMotorista, setFMotorista] = useState('');
  const [fBairro, setFBairro] = useState('');
  // Opções de motorista/bairro vêm do mês SEM filtro (para não encolherem ao filtrar).
  const [opcoes, setOpcoes] = useState<{ motoristas: Grupo[]; bairros: Grupo[] }>({ motoristas: [], bairros: [] });

  const filtros = useMemo(() => ({
    origem: fOrigem || undefined,
    status: fStatus || undefined,
    motoristaId: fMotorista || undefined,
    bairro: fBairro || undefined,
  }), [fOrigem, fStatus, fMotorista, fBairro]);
  const qtdFiltros = Object.values(filtros).filter(Boolean).length;
  const limparFiltros = () => { setFOrigem(''); setFStatus(''); setFMotorista(''); setFBairro(''); };

  const noMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const passoMes = (delta: number) => { const d = new Date(ano, mes - 1 + delta, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); };

  // Opções estáveis (motorista/bairro do mês inteiro), independentes dos filtros.
  useEffect(() => {
    logisticaApi.get<Analitico>('/painel/indicadores/analitico', { params: { mes, ano } })
      .then((r) => setOpcoes({ motoristas: r.data.porMotorista, bairros: r.data.porBairro }))
      .catch(() => { /* opções são conveniência */ });
  }, [mes, ano]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Analitico>('/painel/indicadores/analitico', { params: { mes, ano, ...filtros } });
      setData(data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar a análise.'));
    } finally { setLoading(false); }
  }, [mes, ano, filtros, toast]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setDrill(null); }, [filtros]); // filtro mudou → fecha drill defasado

  function abrirDrill(dimensao: string, titulo: string, grupo: Grupo) {
    setDrill({ dimensao, titulo, grupo });
    setRows(null); setRowsLoading(true);
    logisticaApi.get<Doc[]>('/painel/indicadores/documentos', { params: { mes, ano, dimensao, chave: grupo.id, ...filtros } })
      .then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setRowsLoading(false));
  }

  const vazio = !data || data.totalEntregas === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-capul-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Análise de Entregas</h2>
            <p className="text-sm text-slate-500">Entregas do mês por origem, status, motorista e bairro — clique para detalhar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => passoMes(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => void carregar()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm p-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter className="h-3.5 w-3.5" /> Filtros</span>
        <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value)} className={selCls}>
          <option value="">Todas as origens</option>
          {ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
          <option value="">Todos os status</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={fMotorista} onChange={(e) => setFMotorista(e.target.value)} className={selCls}>
          <option value="">Todos os motoristas</option>
          {opcoes.motoristas.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <select value={fBairro} onChange={(e) => setFBairro(e.target.value)} className={selCls}>
          <option value="">Todos os bairros</option>
          {opcoes.bairros.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        {qtdFiltros > 0 && (
          <button onClick={limparFiltros} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <X className="h-3.5 w-3.5" /> Limpar ({qtdFiltros})
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
      ) : vazio ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Sem entregas em {MESES[mes - 1]} / {ano}{qtdFiltros > 0 ? ' para os filtros aplicados' : ''}.
          {qtdFiltros > 0 && <button onClick={limparFiltros} className="ml-1 text-capul-600 hover:underline">Limpar filtros</button>}
        </div>
      ) : data && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-capul-200 bg-capul-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-capul-600 p-2.5"><Package className="h-6 w-6 text-white" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-capul-700">Entregas no mês</p>
                <p className="text-3xl font-bold text-slate-800">{NUM(data.totalEntregas)}</p>
                <p className="text-xs text-slate-500">Valor em cupons: {BRL(data.valorTotal)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <CardGrupo titulo="Por origem da venda" dimensao="origem" icone={<Tag className="h-4 w-4 text-capul-600" />} itens={data.porOrigem} total={data.totalEntregas} onSelect={abrirDrill} />
            <CardGrupo titulo="Por status" dimensao="status" icone={<Package className="h-4 w-4 text-capul-600" />} itens={data.porStatus} total={data.totalEntregas} onSelect={abrirDrill} />
            <CardGrupo titulo="Por motorista" dimensao="motorista" icone={<Users className="h-4 w-4 text-capul-600" />} itens={data.porMotorista} total={data.totalEntregas} onSelect={abrirDrill} />
            <CardGrupo titulo="Por bairro" dimensao="bairro" icone={<MapPin className="h-4 w-4 text-capul-600" />} itens={data.porBairro} total={data.totalEntregas} onSelect={abrirDrill} />
          </div>
          <p className="text-xs text-slate-400">Clique num item para ver as entregas que o compõem. A soma reconcilia com o total; linhas em cinza são valores sem a dimensão (ex.: sem motorista / sem bairro).</p>
        </div>
      )}

      {drill && <DrillModal sel={drill} rows={rows} loading={rowsLoading} onClose={() => setDrill(null)} />}
    </div>
  );
}

function CardGrupo({ titulo, dimensao, icone, itens, total, onSelect }: {
  titulo: string; dimensao: string; icone: ReactNode; itens: Grupo[]; total: number;
  onSelect: (dimensao: string, titulo: string, grupo: Grupo) => void;
}) {
  let corIdx = 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{icone} {titulo}</div>
      <ul className="divide-y divide-slate-50 p-2">
        {itens.length === 0 && <li className="px-2 py-3 text-sm text-slate-400">Sem dados.</li>}
        {itens.map((g) => {
          const pct = total > 0 ? (g.qtd / total) * 100 : 0;
          const residuo = ehResiduo(g.id);
          const cor = residuo ? '#cbd5e1' : CORES[corIdx++ % CORES.length];
          return (
            <li key={g.id}>
              <button onClick={() => onSelect(dimensao, titulo, g)} className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50" title="Ver as entregas deste item">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={`truncate ${residuo ? 'italic text-slate-400' : 'text-slate-700'}`} title={g.label}>{g.label}</span>
                  <span className="shrink-0 font-semibold text-slate-800">{NUM(g.qtd)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                  <span className="w-28 shrink-0 text-right text-[11px] text-slate-400">{pct.toFixed(1)}% · {BRL(g.valor)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DrillModal({ sel, rows, loading, onClose }: { sel: DrillSel; rows: Doc[] | null; loading: boolean; onClose: () => void }) {
  const soma = rows ? rows.reduce((s, d) => s + d.valor, 0) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{sel.titulo}</p>
            <p className="text-base font-semibold text-slate-800">{sel.grupo.label}</p>
            <p className="text-sm text-slate-500">{NUM(sel.grupo.qtd)} entrega(s) · {BRL(sel.grupo.valor)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhuma entrega.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-2">Destinatário</th><th className="px-5 py-2">Endereço / origem</th><th className="px-5 py-2">Status</th><th className="px-5 py-2">Data</th><th className="px-5 py-2 text-right">Valor</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-2 font-medium text-slate-700">{d.principal}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600"><span className="block max-w-[24rem] truncate" title={d.secundario}>{d.secundario}</span></td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.terciario ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-right font-semibold text-slate-800">{BRL(d.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={4}>Total ({rows.length})</td><td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{BRL(soma)}</td></tr></tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
