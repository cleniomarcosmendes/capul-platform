import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Loader2, Plus, Printer, Search, X, Pencil, Phone,
} from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { maskTelefone, maskCep, onlyDigits } from '../utils/format';

// Grid de Entregas (padrão workspace — ref. Contrato/NF/Parada do gestão-TI):
// colunas ordenáveis por clique, filtros, status em chip, clique abre/edita.

type Status = 'PENDENTE' | 'EM_VIAGEM' | 'ENTREGUE' | 'NAO_ENTREGUE' | 'CANCELADA';
type Origem = 'PRESENCIAL' | 'TELE_VENDA' | 'OUTRO';

interface Cupom { numeroCupom?: string | null; valor?: string | number | null }
interface EntregaG {
  id: string; numero: number; criadoEm: string;
  destinatarioNome: string; telefone?: string | null; matricula?: string | null;
  endLogradouro: string; endNumero?: string | null; endComplemento?: string | null;
  endBairro?: string | null; endCidade?: string | null; endUf?: string | null; endCep?: string | null;
  endReferencia?: string | null; horario?: string | null; observacoes?: string | null;
  quantidadeVolumes: number; origemVenda?: Origem | null; tentativas?: number;
  status: Status; totalCupons: number; cupons: Cupom[];
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
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [statusSel, setStatusSel] = useState<Status | ''>('');
  const [termo, setTermo] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  // Ordenação (padrão workspace: clique no cabeçalho alterna asc/desc)
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detalhe/edição
  const [aberta, setAberta] = useState<EntregaG | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Partial<EntregaG>>({});
  const [cuponsForm, setCuponsForm] = useState<{ numeroCupom: string; valor: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [reabrindo, setReabrindo] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setMsg(null);
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
      setMsg({ tipo: 'erro', texto: 'Falha ao carregar as entregas.' });
    } finally { setLoading(false); }
  }
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

  const editavel = (e: EntregaG) => e.status === 'PENDENTE' && e.viagemNumero == null;

  function abrir(e: EntregaG) {
    setAberta(e);
    setEditando(false);
    setForm({});
    setCuponsForm(e.cupons.map((c) => ({ numeroCupom: c.numeroCupom ?? '', valor: c.valor != null ? String(c.valor) : '' })));
  }

  function iniciarEdicao() {
    if (!aberta) return;
    setForm({
      destinatarioNome: aberta.destinatarioNome,
      telefone: aberta.telefone ? maskTelefone(aberta.telefone) : '',
      endLogradouro: aberta.endLogradouro, endNumero: aberta.endNumero ?? '',
      endComplemento: aberta.endComplemento ?? '', endBairro: aberta.endBairro ?? '',
      endCidade: aberta.endCidade ?? '', endUf: aberta.endUf ?? 'MG',
      endCep: aberta.endCep ? maskCep(aberta.endCep) : '', endReferencia: aberta.endReferencia ?? '',
      horario: aberta.horario ?? '', observacoes: aberta.observacoes ?? '',
      quantidadeVolumes: aberta.quantidadeVolumes, origemVenda: aberta.origemVenda ?? undefined,
    });
    setEditando(true);
  }

  async function salvar() {
    if (!aberta) return;
    setSalvando(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        telefone: form.telefone ? onlyDigits(String(form.telefone)) : '',
        endCep: form.endCep ? onlyDigits(String(form.endCep)) : '',
        cupons: cuponsForm
          .filter((c) => c.numeroCupom || c.valor)
          .map((c) => ({ numeroCupom: c.numeroCupom || undefined, valor: c.valor ? parseFloat(c.valor) : undefined })),
      };
      const { data } = await logisticaApi.patch<EntregaG>(`/entregas/${aberta.id}`, payload);
      setItens((p) => p.map((x) => (x.id === aberta.id ? { ...x, ...data } : x)));
      setAberta(null);
      setMsg({ tipo: 'ok', texto: `Entrega #${aberta.numero} atualizada.` });
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao salvar.' });
    } finally { setSalvando(false); }
  }

  async function novaTentativa(e: EntregaG) {
    setReabrindo(e.id);
    setMsg(null);
    try {
      await logisticaApi.post(`/entregas/${e.id}/nova-tentativa`, {});
      setMsg({ tipo: 'ok', texto: `Entrega #${e.numero} voltou pra fila (nova tentativa).` });
      setAberta(null);
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao reabrir.' });
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

      {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</div>}

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
                <tr key={e.id} onClick={() => abrir(e)} className="cursor-pointer hover:bg-slate-50">
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

      {/* Modal detalhe/edição */}
      {aberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setAberta(null)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-800">
                Entrega #{aberta.numero}
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_META[aberta.status].cls}`}>{STATUS_META[aberta.status].label}</span>
                {(aberta.tentativas ?? 1) > 1 && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">♻ {aberta.tentativas}ª tentativa</span>}
              </div>
              <button onClick={() => setAberta(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {!editando ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className={lbl}>Destinatário</span><div className="text-slate-700">{aberta.destinatarioNome}</div></div>
                  <div><span className={lbl}>Telefone</span><div className="text-slate-700">{aberta.telefone ? <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" href={`tel:${aberta.telefone}`}><Phone className="h-3 w-3" />{maskTelefone(aberta.telefone)}</a> : '—'}</div></div>
                  <div className="col-span-2"><span className={lbl}>Endereço</span>
                    <div className="text-slate-700">
                      {aberta.endLogradouro}{aberta.endNumero ? `, ${aberta.endNumero}` : ''}{aberta.endComplemento ? ` (${aberta.endComplemento})` : ''}
                      {aberta.endBairro ? ` — ${aberta.endBairro}` : ''} · {aberta.endCidade}/{aberta.endUf}{aberta.endCep ? ` · CEP ${maskCep(aberta.endCep)}` : ''}
                    </div>
                    {aberta.endReferencia && <div className="text-xs text-slate-500">Ref.: {aberta.endReferencia}</div>}
                  </div>
                  <div><span className={lbl}>Volumes</span><div className="text-slate-700">{aberta.quantidadeVolumes}</div></div>
                  <div><span className={lbl}>Origem da venda</span><div className="text-slate-700">{aberta.origemVenda ? ORIGEM_LABEL[aberta.origemVenda] : '—'}</div></div>
                  <div><span className={lbl}>Matrícula</span><div className="text-slate-700">{aberta.matricula ?? '—'}</div></div>
                  <div><span className={lbl}>Viagem</span><div className="text-slate-700">{aberta.viagemNumero ? `#${aberta.viagemNumero}` : '—'}</div></div>
                  {aberta.horario && <div><span className={lbl}>Horário preferido</span><div className="text-slate-700">{aberta.horario}</div></div>}
                  {aberta.observacoes && <div className="col-span-2"><span className={lbl}>Observações</span><div className="text-slate-700">{aberta.observacoes}</div></div>}
                  {aberta.motivoNaoEntrega && <div className="col-span-2"><span className={lbl}>Motivo da não-entrega</span><div className="text-rose-700">{aberta.motivoNaoEntrega}</div></div>}
                </div>
                <div>
                  <span className={lbl}>Cupons / Notas</span>
                  {aberta.cupons.length === 0 ? <div className="text-slate-500">—</div> : (
                    <ul className="mt-1 space-y-0.5">
                      {aberta.cupons.map((c, i) => (
                        <li key={i} className="text-slate-700">{c.numeroCupom || 's/ nº'}{c.valor != null ? ` · R$ ${Number(c.valor).toFixed(2)}` : ''}</li>
                      ))}
                    </ul>
                  )}
                  {aberta.totalCupons > 0 && <div className="mt-1 text-slate-600">Total: <strong>R$ {Number(aberta.totalCupons).toFixed(2)}</strong></div>}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  {aberta.status === 'NAO_ENTREGUE' && (
                    <button onClick={() => void novaTentativa(aberta)} disabled={reabrindo === aberta.id}
                      className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                      ♻ Nova tentativa
                    </button>
                  )}
                  {editavel(aberta) ? (
                    <button onClick={iniciarEdicao}
                      className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {aberta.status === 'PENDENTE' ? 'Em viagem montada — remova da viagem para editar.' : 'Somente entregas pendentes podem ser editadas.'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Destinatário *</label>
                    <input value={String(form.destinatarioNome ?? '')} onChange={(e) => setForm((f) => ({ ...f, destinatarioNome: e.target.value }))} className={inp} /></div>
                  <div><label className={lbl}>Telefone</label>
                    <input value={String(form.telefone ?? '')} onChange={(e) => setForm((f) => ({ ...f, telefone: maskTelefone(e.target.value) }))} className={inp} /></div>
                  <div className="col-span-2 grid grid-cols-6 gap-2">
                    <div className="col-span-2"><label className={lbl}>CEP</label>
                      <input value={String(form.endCep ?? '')} onChange={(e) => setForm((f) => ({ ...f, endCep: maskCep(e.target.value) }))} className={inp} inputMode="numeric" /></div>
                    <div className="col-span-4"><label className={lbl}>Endereço *</label>
                      <input value={String(form.endLogradouro ?? '')} onChange={(e) => setForm((f) => ({ ...f, endLogradouro: e.target.value }))} className={inp} /></div>
                    <div className="col-span-2"><label className={lbl}>Número</label>
                      <input value={String(form.endNumero ?? '')} onChange={(e) => setForm((f) => ({ ...f, endNumero: e.target.value }))} className={inp} /></div>
                    <div className="col-span-4"><label className={lbl}>Complemento</label>
                      <input value={String(form.endComplemento ?? '')} onChange={(e) => setForm((f) => ({ ...f, endComplemento: e.target.value }))} className={inp} /></div>
                    <div className="col-span-3"><label className={lbl}>Bairro</label>
                      <input value={String(form.endBairro ?? '')} onChange={(e) => setForm((f) => ({ ...f, endBairro: e.target.value }))} className={inp} /></div>
                    <div className="col-span-2"><label className={lbl}>Cidade</label>
                      <input value={String(form.endCidade ?? '')} onChange={(e) => setForm((f) => ({ ...f, endCidade: e.target.value }))} className={inp} /></div>
                    <div className="col-span-1"><label className={lbl}>UF</label>
                      <input value={String(form.endUf ?? '')} maxLength={2} onChange={(e) => setForm((f) => ({ ...f, endUf: e.target.value.toUpperCase() }))} className={inp} /></div>
                    <div className="col-span-6"><label className={lbl}>Ponto de referência</label>
                      <input value={String(form.endReferencia ?? '')} onChange={(e) => setForm((f) => ({ ...f, endReferencia: e.target.value }))} className={inp} /></div>
                  </div>
                  <div><label className={lbl}>Volumes</label>
                    <input type="number" min={1} value={Number(form.quantidadeVolumes ?? 1)} onChange={(e) => setForm((f) => ({ ...f, quantidadeVolumes: Math.max(1, parseInt(e.target.value) || 1) }))} className={inp} /></div>
                  <div><label className={lbl}>Horário preferido</label>
                    <input value={String(form.horario ?? '')} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} className={inp} /></div>
                  <div className="col-span-2"><label className={lbl}>Observações</label>
                    <input value={String(form.observacoes ?? '')} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} className={inp} /></div>
                  <div className="col-span-2">
                    <label className={lbl}>Origem da venda</label>
                    <div className="mt-1 flex gap-2">
                      {(['PRESENCIAL', 'TELE_VENDA', 'OUTRO'] as Origem[]).map((o) => (
                        <button type="button" key={o} onClick={() => setForm((f) => ({ ...f, origemVenda: o }))}
                          className={`rounded-lg border px-3 py-1.5 text-sm ${form.origemVenda === o ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600'}`}>
                          {ORIGEM_LABEL[o]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Cupons / Notas</label>
                  <div className="mt-1 space-y-2">
                    {cuponsForm.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input placeholder="Nº cupom / nota" value={c.numeroCupom}
                          onChange={(e) => setCuponsForm((p) => p.map((x, j) => (j === i ? { ...x, numeroCupom: e.target.value } : x)))}
                          className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
                        <input placeholder="Valor" type="number" step="0.01" value={c.valor}
                          onChange={(e) => setCuponsForm((p) => p.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                          className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none" />
                        <button type="button" onClick={() => setCuponsForm((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [{ numeroCupom: '', valor: '' }]))}
                          className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setCuponsForm((p) => [...p, { numeroCupom: '', valor: '' }])}
                      className="text-xs font-medium text-sky-700 hover:underline">+ Adicionar cupom</button>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => setEditando(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button onClick={() => void salvar()} disabled={salvando || !String(form.destinatarioNome ?? '').trim() || !String(form.endLogradouro ?? '').trim()}
                    className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                    {salvando ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
