import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, Plus, Printer, Search } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';


// Grid de Entregas (padrão workspace — ref. Contrato/NF/Parada do gestão-TI):
// colunas ordenáveis por clique, filtros, status em chip, clique abre/edita.

type Status = 'PENDENTE' | 'EM_VIAGEM' | 'ENTREGUE' | 'NAO_ENTREGUE' | 'CANCELADA';
type Origem = 'PRESENCIAL' | 'TELE_VENDA' | 'OUTRO';

interface EntregaG {
  id: string; numero: number; criadoEm: string;
  destinatarioNome: string; telefone?: string | null; matricula?: string | null;
  endLogradouro: string; endNumero?: string | null; endComplemento?: string | null;
  endBairro?: string | null; endCidade?: string | null; endUf?: string | null; endCep?: string | null;
  endReferencia?: string | null; horario?: string | null; observacoes?: string | null;
  quantidadeVolumes: number; origemVenda?: Origem | null; tentativas?: number;
  status: Status; totalCupons: number;
  viagemNumero?: number | null; motivoNaoEntrega?: string | null; dataHoraEntrega?: string | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-sky-100 text-sky-700' },
  EM_VIAGEM: { label: 'Em viagem', cls: 'bg-amber-100 text-amber-700' },
  ENTREGUE: { label: 'Entregue', cls: 'bg-emerald-100 text-emerald-700' },
  NAO_ENTREGUE: { label: 'Não entregue', cls: 'bg-rose-100 text-rose-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};
const ORIGEM_LABEL: Record<Origem, string> = {
  PRESENCIAL: 'Presencial', TELE_VENDA: 'Tele-venda', OUTRO: 'Outro',
};

type SortKey = 'numero' | 'criadoEm' | 'destinatarioNome' | 'endBairro' | 'quantidadeVolumes' | 'totalCupons' | 'origemVenda' | 'status' | 'viagemNumero';
type SortDir = 'asc' | 'desc';

export function EntregasPage() {
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [itens, setItens] = useState<EntregaG[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Filtros
  const [statusSel, setStatusSel] = useState<Status | ''>('');
  const [termo, setTermo] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  // Ordenação (padrão workspace: clique no cabeçalho alterna asc/desc)
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [reabrindo, setReabrindo] = useState<string | null>(null);
  const navigate = useNavigate();

  async function carregar() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filialId) params.filialId = filialId;
      if (statusSel) params.status = statusSel;
      if (termo.trim()) params.termo = termo.trim();
      if (de) params.de = de;
      if (ate) params.ate = ate;
      const { data } = await logisticaApi.get<EntregaG[]>('/entregas/grid', { params });
      setItens(data);
    } catch {
      toast('error', 'Falha ao carregar as entregas.');
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void carregar(); }, [filialId, statusSel]); // termo/datas via botão Buscar

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-600" /> : <ArrowDown className="h-3 w-3 text-sky-600" />;
  };

  const ordenadas = useMemo(() => {
    const arr = [...itens];
    arr.sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      let cmp: number;
      if (typeof va === 'number' || typeof vb === 'number') cmp = (Number(va ?? -Infinity)) - (Number(vb ?? -Infinity));
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [itens, sortKey, sortDir]);

  async function novaTentativa(e: EntregaG) {
    setReabrindo(e.id);
    try {
      await logisticaApi.post(`/entregas/${e.id}/nova-tentativa`, {});
      toast('success', `Entrega #${e.numero} voltou pra fila (nova tentativa).`);
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao reabrir.');
    } finally { setReabrindo(null); }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';
  const th = 'px-3 py-2.5';
  const btnSort = 'flex items-center gap-1 hover:text-slate-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Entregas</h2>
          <p className="text-sm text-slate-500">Todas as entregas da filial — clique numa linha para ver/editar.</p>
        </div>
        <Link to="/entregas/nova" className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Nova entrega
        </Link>
      </div>

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatusSel('')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusSel === '' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Todas
          </button>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <button key={s} onClick={() => setStatusSel(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusSel === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className={lbl}>Busca (nome, telefone, matrícula, bairro ou nº)</label>
            <input value={termo} onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void carregar(); }}
              className={inp} placeholder="Ex.: Maria, 38999…, E01047, Centro, 18" />
          </div>
          <div>
            <label className={lbl}>De</label>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inp} />
          </div>
          <button onClick={() => void carregar()} disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-sky-600 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50">
            <Search className="h-4 w-4" /> Buscar
          </button>
        </div>
      </div>


      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>
        ) : ordenadas.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhuma entrega com esses filtros.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className={th}><button onClick={() => toggleSort('numero')} className={btnSort}>Nº <SortIcon col="numero" /></button></th>
                <th className={th}><button onClick={() => toggleSort('criadoEm')} className={btnSort}>Criada <SortIcon col="criadoEm" /></button></th>
                <th className={th}><button onClick={() => toggleSort('destinatarioNome')} className={btnSort}>Destinatário <SortIcon col="destinatarioNome" /></button></th>
                <th className={th}><button onClick={() => toggleSort('endBairro')} className={btnSort}>Endereço <SortIcon col="endBairro" /></button></th>
                <th className={th}><button onClick={() => toggleSort('quantidadeVolumes')} className={btnSort}>Vol. <SortIcon col="quantidadeVolumes" /></button></th>
                <th className={th}><button onClick={() => toggleSort('totalCupons')} className={btnSort}>Valor <SortIcon col="totalCupons" /></button></th>
                <th className={th}><button onClick={() => toggleSort('origemVenda')} className={btnSort}>Origem <SortIcon col="origemVenda" /></button></th>
                <th className={th}><button onClick={() => toggleSort('viagemNumero')} className={btnSort}>Viagem <SortIcon col="viagemNumero" /></button></th>
                <th className={th}><button onClick={() => toggleSort('status')} className={btnSort}>Status <SortIcon col="status" /></button></th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenadas.map((e) => (
                <tr key={e.id} onClick={() => navigate(`/entregas/${e.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">
                    #{e.numero}
                    {(e.tentativas ?? 1) > 1 && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700">♻{e.tentativas}ª</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{new Date(e.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-2 text-slate-700">{e.destinatarioNome}</td>
                  <td className="px-3 py-2 text-slate-500">{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''}{e.endBairro ? ` — ${e.endBairro}` : ''}</td>
                  <td className="px-3 py-2 text-slate-600">{e.quantidadeVolumes}</td>
                  <td className="px-3 py-2 text-slate-600">{e.totalCupons ? `R$ ${Number(e.totalCupons).toFixed(2)}` : '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{e.origemVenda ? ORIGEM_LABEL[e.origemVenda] : '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{e.viagemNumero ? `#${e.viagemNumero}` : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_META[e.status].cls}`} title={e.motivoNaoEntrega ?? undefined}>
                      {STATUS_META[e.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {e.status === 'NAO_ENTREGUE' && (
                        <button onClick={() => void novaTentativa(e)} disabled={reabrindo === e.id}
                          title="Volta pra fila para nova viagem"
                          className="rounded border border-amber-400 px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                          {reabrindo === e.id ? '…' : '♻'}
                        </button>
                      )}
                      <a href={`/entregas/etiquetas/entrega/${e.id}`} target="_blank" rel="noopener" title="Etiqueta"
                        className="text-slate-300 hover:text-sky-600"><Printer className="h-4 w-4" /></a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400">{ordenadas.length} entrega{ordenadas.length === 1 ? '' : 's'} · clique no cabeçalho para ordenar</p>

    </div>
  );
}
