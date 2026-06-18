import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Banknote, Check, Loader2, Paperclip, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';

// Despesas da frota (Fase 2) com governança em 3 níveis. Padrão workspace:
// grid + formulários inline (sem modal). Lançamento direto (supervisor/gestor)
// já entra APROVADA; lançamento do motorista (matrícula+senha, na tela de Frota)
// entra PENDENTE e exige validação aqui.

interface TipoDespesa { id: string; nome: string; descricao?: string | null; ativo: boolean }
interface FornecedorDespesa { id: string; nome: string; ativo: boolean }
interface LocalParada { id: string; nome: string; ativo: boolean }
interface VeiculoItem { id: string; placa: string; modelo?: string | null }
interface Despesa {
  id: string; situacao: string; placa: string; modelo?: string | null; veiculoId: string;
  tipo: string; valor: number; dataDespesa: string; fornecedor?: string | null;
  observacao?: string | null; autorNome?: string | null; aprovadoEm?: string | null;
  motivoContestacao?: string | null; temComprovante?: boolean;
}
const SIT_META: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  CONTESTADA: { label: 'Contestada', cls: 'bg-rose-100 text-rose-700' },
};
const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};
const hoje = new Date();

export function DespesasPage() {
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';
  const [tab, setTab] = useState<'despesas' | 'tipos' | 'fornecedores' | 'locais'>('despesas');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Banknote className="h-6 w-6 text-sky-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Despesas da Frota</h2>
          <p className="text-sm text-slate-500">Custos por veículo, com validação do supervisor / gestor de frota.</p>
        </div>
      </div>

      {ehGestor && (
        <div className="flex gap-1 border-b border-slate-200">
          {(['despesas', 'tipos', 'fornecedores', 'locais'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'despesas' ? 'Despesas' : t === 'tipos' ? 'Tipos de despesa' : t === 'fornecedores' ? 'Fornecedores' : 'Locais de parada'}
            </button>
          ))}
        </div>
      )}

      {tab === 'despesas' ? <DespesasTab /> : tab === 'tipos' ? <TiposTab /> : tab === 'fornecedores' ? <FornecedoresTab /> : <LocaisTab />}
    </div>
  );
}

// ---- Aba Despesas ----
function DespesasTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [situacao, setSituacao] = useState('');
  const [veiculoFiltro, setVeiculoFiltro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (mes) { params.mes = mes; params.ano = ano; } // mes 0 = Todos os meses
      if (situacao) params.situacao = situacao;
      if (veiculoFiltro) params.veiculoId = veiculoFiltro;
      const [d, v] = await Promise.all([
        logisticaApi.get<Despesa[]>('/despesas', { params }),
        logisticaApi.get<VeiculoItem[]>('/veiculos'),
      ]);
      setDespesas(d.data); setVeiculos(v.data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar despesas.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, [mes, ano, situacao, veiculoFiltro]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value={0}>Todos os meses</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}</option>)}
        </select>
        <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} disabled={!mes}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400" />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todas situações</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="APROVADA">Aprovadas</option>
          <option value="CONTESTADA">Contestadas</option>
        </select>
        <select value={veiculoFiltro} onChange={(e) => setVeiculoFiltro(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos veículos</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
        </select>
        <div className="ml-auto">
          <button onClick={() => navigate('/despesas/nova')} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">
            <Plus className="h-4 w-4" /> Lançar despesa
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
        ) : despesas.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Nenhuma despesa no período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Veículo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2">Fornecedor</th>
                <th className="px-4 py-2">Autor</th>
                <th className="px-4 py-2">Situação</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {despesas.map((d) => (
                <LinhaDespesa key={d.id} d={d} onChanged={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LinhaDespesa({ d, onChanged }: { d: Despesa; onChanged: () => void }) {
  const { toast, confirm } = useToast();
  const navigate = useNavigate();
  const sit = SIT_META[d.situacao] ?? { label: d.situacao, cls: 'bg-slate-100 text-slate-600' };
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const aprovar = async () => {
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/aprovar`); toast('success', 'Despesa aprovada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao aprovar.')); } finally { setBusy(false); }
  };
  const excluir = async () => {
    const ok = await confirm('Excluir despesa', `Excluir a despesa de ${BRL(d.valor)} (${d.tipo} · ${d.placa})? Esta ação não pode ser desfeita.`, { confirmLabel: 'Excluir', variant: 'danger' });
    if (!ok) return;
    setBusy(true);
    try { await logisticaApi.delete(`/despesas/${d.id}`); toast('success', 'Despesa excluída.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao excluir.')); } finally { setBusy(false); }
  };
  const contestar = async () => {
    if (!motivo.trim()) { toast('warning', 'Informe o motivo da contestação.'); return; }
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/contestar`, { motivo: motivo.trim() }); toast('success', 'Despesa contestada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao contestar.')); } finally { setBusy(false); }
  };
  const verRecibo = async () => {
    setBusy(true);
    try {
      const { data } = await logisticaApi.get(`/despesas/${d.id}/comprovante`, { responseType: 'blob' });
      window.open(URL.createObjectURL(data as Blob), '_blank', 'noopener');
    } catch (e) { toast('error', errMsg(e, 'Falha ao abrir o recibo.')); } finally { setBusy(false); }
  };

  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/despesas/${d.id}/editar`)} title="Clique para editar">
        <td className="px-4 py-2 text-slate-600">{fmtDate(d.dataDespesa)}</td>
        <td className="px-4 py-2">{d.placa}{d.modelo ? <span className="text-slate-400"> · {d.modelo}</span> : null}</td>
        <td className="px-4 py-2">{d.tipo}</td>
        <td className="px-4 py-2 text-right tabular-nums">{BRL(d.valor)}</td>
        <td className="px-4 py-2 text-slate-600">
          <div className="flex items-center gap-2">
            <span className="block max-w-[12rem] truncate" title={d.fornecedor ?? ''}>{d.fornecedor ?? '—'}</span>
            {d.temComprovante && (
              <button onClick={(e) => { e.stopPropagation(); void verRecibo(); }} disabled={busy} title="Ver recibo" className="inline-flex shrink-0 items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-100 disabled:opacity-50">
                <Paperclip className="h-3 w-3" /> Recibo
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-slate-600"><span className="block max-w-[12rem] truncate" title={d.autorNome ?? ''}>{d.autorNome ?? '—'}</span></td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span>
          {d.situacao === 'CONTESTADA' && d.motivoContestacao && <span className="ml-1 text-xs text-rose-500" title={d.motivoContestacao}>ⓘ</span>}
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            {d.situacao === 'PENDENTE' && (
              <>
                <button onClick={(e) => { e.stopPropagation(); void aprovar(); }} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </button>
                <button onClick={(e) => { e.stopPropagation(); setContestando((s) => !s); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">
                  <X className="h-3.5 w-3.5" /> Contestar
                </button>
              </>
            )}
            <button onClick={(e) => { e.stopPropagation(); navigate(`/despesas/${d.id}/editar`); }} disabled={busy} title="Editar" className="inline-flex items-center rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); void excluir(); }} disabled={busy} title="Excluir" className="inline-flex items-center rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {contestando && d.situacao === 'PENDENTE' && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da contestação" maxLength={255} className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              <button onClick={() => void contestar()} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">Confirmar contestação</button>
              <button onClick={() => setContestando(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Ícone de ordenação (padrão workspace).
function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
  return dir === 'asc' ? <ArrowUp className="h-3 w-3 text-sky-600" /> : <ArrowDown className="h-3 w-3 text-sky-600" />;
}
const thCad = 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const btnSortCad = 'flex items-center gap-1 hover:text-slate-700';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;

// ---- Aba Fornecedores (gestor de frota) — padrão de cadastro do workspace ----
function FornecedoresTab() {
  const { toast } = useToast();
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores'); setFornecedores(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar fornecedores.')); } finally { setLoading(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/fornecedores', { nome: nome.trim() }); setNome(''); setShowForm(false); toast('success', 'Fornecedor criado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar fornecedor.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/despesas/fornecedores/${editId}`, { nome: editNome.trim() }); toast('success', 'Fornecedor atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (f: FornecedorDespesa) => {
    try { await logisticaApi.patch(`/despesas/fornecedores/${f.id}`, { ativo: !f.ativo }); toast('success', f.ativo ? 'Fornecedor inativado.' : 'Fornecedor ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [fornecedores, sortDir]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Fornecedores usados nas despesas da frota (postos, oficinas, etc.).</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoFocus placeholder="ex.: Posto Ipiranga Centro"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : fornecedores.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum fornecedor cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  {editId === f.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={120} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><span className={pill(f.ativo)}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(f.id); setEditNome(f.nome); }} className="text-left font-medium text-sky-700 hover:underline">{f.nome}</button>
                      </td>
                      <td className="px-6 py-4"><span className={pill(f.ativo)}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(f.id); setEditNome(f.nome); }} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(f)} className="text-xs text-sky-600 hover:underline">{f.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Aba Tipos de despesa (gestor de frota) — padrão de cadastro do workspace ----
// ---- Aba Locais de parada (gestor de frota) — pick-list do planejamento ----
function LocaisTab() {
  const { toast } = useToast();
  const [locais, setLocais] = useState<LocalParada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<LocalParada[]>('/frota/locais'); setLocais(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar locais.')); } finally { setLoading(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/frota/locais', { nome: nome.trim() }); setNome(''); setShowForm(false); toast('success', 'Local criado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar local.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/frota/locais/${editId}`, { nome: editNome.trim() }); toast('success', 'Local atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (l: LocalParada) => {
    try { await logisticaApi.patch(`/frota/locais/${l.id}`, { ativo: !l.ativo }); toast('success', l.ativo ? 'Local inativado.' : 'Local ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...locais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [locais, sortDir]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Locais/pontos de parada frequentes — aparecem como atalho ao planejar a rota da viagem.</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Novo Local
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoFocus placeholder="ex.: Matriz CAPUL, Banco Centro, Fornecedor X"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : locais.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum local cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  {editId === l.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={120} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><span className={pill(l.ativo)}>{l.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} className="text-left font-medium text-sky-700 hover:underline">{l.nome}</button>
                      </td>
                      <td className="px-6 py-4"><span className={pill(l.ativo)}>{l.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(l)} className="text-xs text-sky-600 hover:underline">{l.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TiposTab() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<TipoDespesa[]>('/despesas/tipos'); setTipos(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar tipos.')); } finally { setLoading(false); }
  };
  useEffect(() => { void carregar(); /* eslint-disable-next-line */ }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/tipos', { nome: nome.trim(), descricao: descricao.trim() || undefined }); setNome(''); setDescricao(''); setShowForm(false); toast('success', 'Tipo de despesa criado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar tipo.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/despesas/tipos/${editId}`, { nome: editNome.trim(), descricao: editDescricao.trim() || undefined }); toast('success', 'Tipo atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (t: TipoDespesa) => {
    try { await logisticaApi.patch(`/despesas/tipos/${t.id}`, { ativo: !t.ativo }); toast('success', t.ativo ? 'Tipo inativado.' : 'Tipo ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...tipos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [tipos, sortDir]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Classificação das despesas (Combustível, Manutenção, Pedágio, IPVA, etc.).</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
          <Plus className="h-4 w-4" /> Novo Tipo
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={60} autoFocus placeholder="ex.: Lavagem"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descrição (opcional)</label>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={255}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : tipos.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum tipo de despesa cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Descrição</th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  {editId === t.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={60} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} maxLength={255} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><span className={pill(t.ativo)}>{t.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditDescricao(t.descricao ?? ''); }} className="text-left font-medium text-sky-700 hover:underline">{t.nome}</button>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{t.descricao ?? '—'}</td>
                      <td className="px-6 py-4"><span className={pill(t.ativo)}>{t.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditDescricao(t.descricao ?? ''); }} className="flex items-center gap-1 text-xs text-sky-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(t)} className="text-xs text-sky-600 hover:underline">{t.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
