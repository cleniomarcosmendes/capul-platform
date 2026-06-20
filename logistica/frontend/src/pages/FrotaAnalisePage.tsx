import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Banknote, Building2, Car, ChevronLeft, ChevronRight, Gauge, KeyRound, Layers, Loader2, RefreshCw, Tag, Target, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';

// Análise das despesas da frota (apresentação à gestão): custo do mês AGRUPADO
// por veículo/tipo/fornecedor/departamento (reconcilia com o total); clicar num
// grupo abre as despesas que o compõem (drill-down). Espelha o "Indicadores —
// Análise" do Workspace. Read-only.

interface Grupo { id: string; label: string; valor: number; qtd: number }
interface Analitico {
  total: number;
  anormal: { valor: number; qtd: number };
  porVeiculo: Grupo[]; porTipo: Grupo[]; porFornecedor: Grupo[]; porDepartamento: Grupo[]; porPropriedade: Grupo[];
  porPorte: Grupo[]; porFinalidade: Grupo[]; porNormalidade: Grupo[];
}
interface Doc { id: string; principal: string; secundario: string; terciario?: string; data: string | null; valor: number }
interface DrillSel { dimensao: string; titulo: string; grupo: Grupo }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CORES = ['#0ea5e9', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#22c55e', '#eab308'];
const ehResiduo = (id: string) => id === '__sem';
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};

export function FrotaAnalisePage() {
  const { toast } = useToast();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [data, setData] = useState<Analitico | null>(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState<DrillSel | null>(null);
  const [rows, setRows] = useState<Doc[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);

  const noMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const passoMes = (delta: number) => { const d = new Date(ano, mes - 1 + delta, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); };

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Analitico>('/despesas/indicadores/analitico', { params: { mes, ano } });
      setData(data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar a análise.'));
    } finally { setLoading(false); }
  }, [mes, ano, toast]);
  useEffect(() => { void carregar(); }, [carregar]);

  function abrirDrill(dimensao: string, titulo: string, grupo: Grupo) {
    setDrill({ dimensao, titulo, grupo });
    setRows(null); setRowsLoading(true);
    logisticaApi.get<Doc[]>('/despesas/indicadores/documentos', { params: { mes, ano, dimensao, chave: grupo.id } })
      .then((r) => setRows(r.data)).catch(() => setRows([])).finally(() => setRowsLoading(false));
  }

  const vazio = !data || data.total === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Banknote className="h-6 w-6 text-sky-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Análise da Frota</h2>
            <p className="text-sm text-slate-500">Custo do mês por veículo, tipo, fornecedor e departamento — clique para detalhar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => passoMes(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => void carregar()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
      ) : vazio ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">Sem despesas aprovadas em {MESES[mes - 1]} / {ano}.</div>
      ) : data && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-600 p-2.5"><Banknote className="h-6 w-6 text-white" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Custo total no mês</p>
                <p className="text-3xl font-bold text-slate-800">{BRL(data.total)}</p>
                {data.anormal && data.anormal.valor > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    <AlertTriangle className="h-3 w-3" /> dos quais {BRL(data.anormal.valor)} em anormalidades ({data.anormal.qtd})
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <CardGrupo titulo="Por veículo" dimensao="veiculo" icone={<Car className="h-4 w-4 text-sky-600" />} itens={data.porVeiculo} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por tipo de despesa" dimensao="tipo" icone={<Tag className="h-4 w-4 text-sky-600" />} itens={data.porTipo} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por fornecedor" dimensao="fornecedor" icone={<Building2 className="h-4 w-4 text-sky-600" />} itens={data.porFornecedor} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por departamento solicitante" dimensao="departamento" icone={<Layers className="h-4 w-4 text-sky-600" />} itens={data.porDepartamento} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por porte (pesado × leve)" dimensao="porte" icone={<Gauge className="h-4 w-4 text-sky-600" />} itens={data.porPorte} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por finalidade (entrega × passeio × serviço)" dimensao="finalidade" icone={<Target className="h-4 w-4 text-sky-600" />} itens={data.porFinalidade} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Normal × Anormalidade (mau uso)" dimensao="normalidade" icone={<AlertTriangle className="h-4 w-4 text-sky-600" />} itens={data.porNormalidade} total={data.total} onSelect={abrirDrill} />
            <CardGrupo titulo="Por tipo de veículo (próprio × alugado)" dimensao="propriedade" icone={<KeyRound className="h-4 w-4 text-sky-600" />} itens={data.porPropriedade} total={data.total} onSelect={abrirDrill} />
          </div>
          <p className="text-xs text-slate-400">Clique num item para ver as despesas que o compõem. A soma reconcilia com o total; linhas em cinza são valores sem a dimensão (ex.: sem departamento).</p>
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
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{icone} {titulo}</div>
      <ul className="divide-y divide-slate-50 p-2">
        {itens.length === 0 && <li className="px-2 py-3 text-sm text-slate-400">Sem dados.</li>}
        {itens.map((g) => {
          const pct = total > 0 ? (g.valor / total) * 100 : 0;
          const residuo = ehResiduo(g.id);
          const cor = residuo ? '#cbd5e1' : CORES[corIdx++ % CORES.length];
          return (
            <li key={g.id}>
              <button onClick={() => onSelect(dimensao, titulo, g)} className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50" title="Ver as despesas deste item">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={`truncate ${residuo ? 'italic text-slate-400' : 'text-slate-700'}`} title={g.label}>{g.label}</span>
                  <span className="shrink-0 font-semibold text-slate-800">{BRL(g.valor)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-[11px] text-slate-400">{pct.toFixed(1)}% · {g.qtd} desp.</span>
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
            <p className="text-sm text-slate-500">{BRL(sel.grupo.valor)} · {sel.grupo.qtd} despesa(s)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : !rows || rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhuma despesa.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-5 py-2">Tipo</th><th className="px-5 py-2">Veículo / fornecedor</th><th className="px-5 py-2">Data</th><th className="px-5 py-2 text-right">Valor</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-2 font-medium text-slate-700">{d.principal}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-600"><span className="block max-w-[28rem] truncate" title={`${d.secundario}${d.terciario ? ` · ${d.terciario}` : ''}`}>{d.secundario}{d.terciario ? <span className="text-slate-400"> · {d.terciario}</span> : ''}</span></td>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{d.data ? new Date(d.data).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2 text-right font-semibold text-slate-800">{BRL(d.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50"><tr><td className="px-5 py-2 text-sm font-semibold text-slate-700" colSpan={3}>Total ({rows.length})</td><td className="px-5 py-2 text-right text-sm font-bold text-slate-800">{BRL(soma)}</td></tr></tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
