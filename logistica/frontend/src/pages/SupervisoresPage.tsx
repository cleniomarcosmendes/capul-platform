import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, MapPin, Plus, Route, Tag, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { errMsg } from './frota-utils';

// Módulo Supervisores / RDV (Fase 3b): viagem mensal (prestação de contas) +
// catálogos (Atividade de visita, Região N:N com município). Indústria de Ração.

interface Atividade { id: string; nome: string; ativo: boolean; filialId?: string | null }
interface Municipio { municipio: string; uf?: string | null }
interface Regiao { id: string; nome: string; ativo: boolean; municipios: Municipio[] }
interface ViagemSup {
  id: string; numero: number; situacao: string; mesReferencia?: number | null;
  adiantamento?: string | number | null; condutorNome?: string | null; condutorMatricula?: string | null;
  regiao?: { id: string; nome: string } | null;
  _count?: { paradas: number; despesas: number };
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;
const statusPill = (s: string) => `rounded-full px-2 py-1 text-xs font-medium ${s === 'CONCLUIDA' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`;

export function SupervisoresPage() {
  const [tab, setTab] = useState<'viagens' | 'atividades' | 'regioes'>('viagens');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800">Supervisores</h1>
      <p className="mb-6 text-sm text-slate-500">Prestação de contas mensal (RDV) e catálogos das visitas — Indústria de Ração.</p>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {(['viagens', 'atividades', 'regioes'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-capul-600 text-capul-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'viagens' ? 'Viagens mensais' : t === 'atividades' ? 'Atividades' : 'Regiões'}
          </button>
        ))}
      </div>
      {tab === 'viagens' ? <ViagensTab /> : tab === 'atividades' ? <AtividadesTab /> : <RegioesTab />}
    </div>
  );
}

// ---------------- Viagens mensais ----------------
function ViagensTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viagens, setViagens] = useState<ViagemSup[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mes, setMes] = useState('');
  const [regiaoId, setRegiaoId] = useState('');
  const [adiantamento, setAdiantamento] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [v, r] = await Promise.all([
        logisticaApi.get<ViagemSup[]>('/supervisor/viagens'),
        logisticaApi.get<Regiao[]>('/supervisor/regioes', { params: { ativos: true } }),
      ]);
      setViagens(v.data); setRegioes(r.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar viagens.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Valida o supervisor por matrícula+SENHA (loginPortal do Protheus). Responde
  // 200 {valida,nome,motivo} — nunca 401 (não desloga). Mostra o nome se válido.
  const validarSupervisor = async () => {
    const m = matricula.trim();
    if (!m || !senha) { setNome(''); return; }
    setBuscando(true);
    try {
      const { data } = await logisticaApi.post<{ valida: boolean; nome?: string; motivo?: string }>('/frota/condutor/validar', { matricula: m, senha });
      if (data.valida && data.nome) { setNome(data.nome); toast('success', `Supervisor validado: ${data.nome}`); }
      else { setNome(''); toast('warning', data.motivo === 'INDISPONIVEL' ? 'Portal do RH indisponível.' : 'Matrícula ou senha inválidas.'); }
    } catch { setNome(''); toast('error', 'Falha ao validar o supervisor.'); } finally { setBuscando(false); }
  };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mes) { toast('warning', 'Informe o mês de referência.'); return; }
    if (matricula.trim() && !senha) { toast('warning', 'Informe a senha do supervisor (ou limpe a matrícula).'); return; }
    const mesRef = Number(mes.replace('-', '')); // "2026-05" → 202605
    setSalvando(true);
    try {
      await logisticaApi.post('/supervisor/viagens', {
        mesReferencia: mesRef,
        regiaoId: regiaoId || undefined,
        adiantamento: adiantamento ? Number(adiantamento) : undefined,
        supervisorMatricula: matricula.trim() || undefined,
        supervisorSenha: senha || undefined,
      });
      toast('success', 'Viagem mensal criada.');
      setShowForm(false); setMes(''); setRegiaoId(''); setAdiantamento(''); setMatricula(''); setSenha(''); setNome('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao criar viagem.')); } finally { setSalvando(false); }
  };

  const concluir = async (v: ViagemSup) => {
    try { await logisticaApi.patch(`/supervisor/viagens/${v.id}/concluir`); toast('success', 'Viagem concluída.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao concluir.')); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Uma viagem por mês/supervisor, com adiantamento. Ao fechar, gera a RDV.</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">
          <Plus className="h-4 w-4" /> Nova viagem
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mês de referência *</label>
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Região</label>
              <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} className={inp}>
                <option value="">—</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Adiantamento (R$)</label>
              <input type="number" step="0.01" min="0" value={adiantamento} onChange={(e) => setAdiantamento(e.target.value)} placeholder="0,00" className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor (matrícula + senha)</label>
              <div className="flex items-start gap-2">
                <input value={matricula} onChange={(e) => { setMatricula(e.target.value.toUpperCase()); setNome(''); }} placeholder="Matrícula" maxLength={20} className={`${inp} font-mono uppercase`} />
                <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setNome(''); }} placeholder="Senha do portal" autoComplete="off" className={inp} />
                <button type="button" onClick={() => void validarSupervisor()} disabled={buscando || !matricula.trim() || !senha} className="mt-0.5 inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
                </button>
              </div>
              {nome
                ? <p className="mt-1 text-xs font-medium text-emerald-700">👤 {nome} — validado</p>
                : <p className="mt-1 text-xs text-slate-400">O supervisor confirma com a senha do portal (matrícula Protheus).</p>}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Criar viagem'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : viagens.length === 0 ? (
        <div className="py-12 text-center"><Route className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhuma viagem de supervisor</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead><tr className="bg-slate-50"><th className={th}>#</th><th className={th}>Mês</th><th className={th}>Região</th><th className={th}>Supervisor</th><th className={th}>Adiantamento</th><th className={th}>Visitas / Despesas</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {viagens.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/supervisores/viagens/${v.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-capul-700">{v.numero}</td>
                  <td className="px-4 py-3">{fmtMes(v.mesReferencia)}</td>
                  <td className="px-4 py-3">{v.regiao?.nome ?? '—'}</td>
                  <td className="px-4 py-3">{v.condutorNome ?? '—'}</td>
                  <td className="px-4 py-3">{brl(v.adiantamento)}</td>
                  <td className="px-4 py-3 text-slate-500">{v._count?.paradas ?? 0} / {v._count?.despesas ?? 0}</td>
                  <td className="px-4 py-3"><span className={statusPill(v.situacao)}>{v.situacao === 'CONCLUIDA' ? 'Concluída' : 'Em curso'}</span></td>
                  <td className="px-4 py-3">
                    {v.situacao !== 'CONCLUIDA' && <button onClick={(e) => { e.stopPropagation(); void concluir(v); }} className="text-xs text-capul-600 hover:underline">Concluir</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Atividades ----------------
function AtividadesTab() {
  const { toast } = useToast();
  const [itens, setItens] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<Atividade[]>('/supervisor/atividades'); setItens(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar atividades.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try { await logisticaApi.post('/supervisor/atividades', { nome: nome.trim() }); setNome(''); toast('success', 'Atividade criada.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar.')); } finally { setSalvando(false); }
  };
  const salvar = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/supervisor/atividades/${editId}`, { nome: editNome.trim() }); setEditId(null); toast('success', 'Atualizada.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (a: Atividade) => {
    try { await logisticaApi.patch(`/supervisor/atividades/${a.id}`, { ativo: !a.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  return (
    <div>
      <form onSubmit={criar} className="mb-6 flex gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Nova atividade (ex.: VISITA TÉCNICA)" className={`${inp} max-w-md`} />
        <button type="submit" disabled={salvando} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50"><Plus className="h-4 w-4" /> Adicionar</button>
      </form>
      {loading ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhuma atividade</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead><tr className="bg-slate-50"><th className={th}>Atividade</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{editId === a.id ? <input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={80} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /> : <span className="font-medium text-slate-700">{a.nome}</span>}</td>
                  <td className="px-4 py-3"><span className={pill(a.ativo)}>{a.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3">
                    {editId === a.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => void salvar()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setEditId(a.id); setEditNome(a.nome); }} className="text-xs text-capul-600 hover:underline">Editar</button>
                        <button onClick={() => void toggle(a)} className="text-xs text-capul-600 hover:underline">{a.ativo ? 'Inativar' : 'Ativar'}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Regiões ----------------
function RegioesTab() {
  const { toast } = useToast();
  const [itens, setItens] = useState<Regiao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [muns, setMuns] = useState<Municipio[]>([]);
  const [munInput, setMunInput] = useState('');
  const [ufInput, setUfInput] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<Regiao[]>('/supervisor/regioes'); setItens(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar regiões.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => { setShowForm(false); setEditId(null); setNome(''); setMuns([]); setMunInput(''); setUfInput(''); };
  const abrirNovo = () => { reset(); setShowForm(true); };
  const abrirEdicao = (r: Regiao) => { setEditId(r.id); setNome(r.nome); setMuns(r.municipios.map((m) => ({ municipio: m.municipio, uf: m.uf }))); setShowForm(true); };

  const addMun = () => {
    const municipio = munInput.trim();
    if (!municipio) return;
    if (muns.some((m) => m.municipio.toLowerCase() === municipio.toLowerCase())) { setMunInput(''); return; }
    setMuns([...muns, { municipio, uf: ufInput.trim().toUpperCase() || null }]);
    setMunInput(''); setUfInput('');
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome da região.'); return; }
    setSalvando(true);
    const body = { nome: nome.trim(), municipios: muns };
    try {
      if (editId) await logisticaApi.patch(`/supervisor/regioes/${editId}`, body);
      else await logisticaApi.post('/supervisor/regioes', body);
      toast('success', editId ? 'Região atualizada.' : 'Região criada.');
      reset(); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao salvar região.')); } finally { setSalvando(false); }
  };
  const toggle = async (r: Regiao) => {
    try { await logisticaApi.patch(`/supervisor/regioes/${r.id}`, { ativo: !r.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Uma região agrupa vários municípios; um município pode estar em várias regiões.</p>
        <button onClick={abrirNovo} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700"><Plus className="h-4 w-4" /> Nova região</button>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome da região *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus placeholder="ex.: Campo das Vertentes" className={`${inp} max-w-md`} />
          </div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Municípios</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {muns.map((m, i) => (
              <span key={`${m.municipio}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {m.municipio}{m.uf ? `/${m.uf}` : ''}
                <button type="button" onClick={() => setMuns(muns.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {muns.length === 0 && <span className="text-xs text-slate-400">Nenhum município ainda.</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={munInput} onChange={(e) => setMunInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMun(); } }} placeholder="Município" maxLength={120} className={`${inp} max-w-xs`} />
            <input value={ufInput} onChange={(e) => setUfInput(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} className={`${inp} w-16 uppercase`} />
            <button type="button" onClick={addMun} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Adicionar</button>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : editId ? 'Salvar' : 'Criar região'}</button>
            <button type="button" onClick={reset} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><MapPin className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhuma região</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead><tr className="bg-slate-50"><th className={th}>Região</th><th className={th}>Municípios</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.nome}</td>
                  <td className="px-4 py-3 text-slate-500">{r.municipios.length === 0 ? '—' : r.municipios.map((m) => m.municipio + (m.uf ? `/${m.uf}` : '')).join(', ')}</td>
                  <td className="px-4 py-3"><span className={pill(r.ativo)}>{r.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => abrirEdicao(r)} className="text-xs text-capul-600 hover:underline">Editar</button>
                      <button onClick={() => void toggle(r)} className="text-xs text-capul-600 hover:underline">{r.ativo ? 'Inativar' : 'Ativar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
