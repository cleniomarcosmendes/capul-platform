import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Plus, Route, Tag, Users, X } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';
import { errMsg } from './frota-utils';

// Módulo Supervisores / RDV (Fase 3b): viagem mensal (prestação de contas) +
// catálogos (Atividade de visita) e prestação de contas. Indústria de Ração.

interface Atividade { id: string; nome: string; ativo: boolean; filialId?: string | null }
interface ViagemSup {
  id: string; numero: number; situacao: string; statusPlanejamento?: string | null; mesReferencia?: number | null;
  condutorNome?: string | null; condutorMatricula?: string | null;
  _count?: { paradas: number; despesas: number };
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;

// Ciclo do planejamento (rótulo + cor).
const STATUS_PLAN: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  ENVIADO: { label: 'Enviado (aguarda coordenador)', cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  AJUSTADO: { label: 'Ajustado (revisar)', cls: 'bg-sky-100 text-sky-700' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
  EM_EXECUCAO: { label: 'Em execução', cls: 'bg-indigo-100 text-indigo-700' },
  CONCLUIDO: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
};
const statusPlan = (s?: string | null) => STATUS_PLAN[s ?? ''] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };

const TAB_LABEL: Record<string, string> = { viagens: 'Planejamentos', coordenacao: 'Coordenação (aprovar)', atividades: 'Atividades', equipe: 'Equipe (supervisores)' };

export function SupervisoresPage() {
  const [tab, setTab] = useState<'viagens' | 'coordenacao' | 'atividades' | 'equipe'>('viagens');
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800">Supervisores</h1>
      <p className="mb-6 text-sm text-slate-500">Prestação de contas mensal (RDV) e catálogos das visitas — Indústria de Ração.</p>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {(['viagens', 'coordenacao', 'atividades', 'equipe'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? 'border-capul-600 text-capul-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tab === 'viagens' ? <ViagensTab /> : tab === 'coordenacao' ? <CoordenacaoTab /> : tab === 'atividades' ? <AtividadesTab /> : <EquipeTab />}
    </div>
  );
}

// ---------------- Viagens mensais ----------------
function ViagensTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [viagens, setViagens] = useState<ViagemSup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mes, setMes] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const v = await logisticaApi.get<ViagemSup[]>('/supervisor/viagens');
      setViagens(v.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar planejamentos.')); } finally { setLoading(false); }
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
        supervisorMatricula: matricula.trim() || undefined,
        supervisorSenha: senha || undefined,
      });
      toast('success', 'Planejamento criado.');
      setShowForm(false); setMes(''); setMatricula(''); setSenha(''); setNome('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao criar planejamento.')); } finally { setSalvando(false); }
  };


  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">O supervisor cria o planejamento (visitas) e envia ao coordenador para aprovação; depois executa e presta contas.</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">
          <Plus className="h-4 w-4" /> Novo planejamento
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor (matrícula + senha)</label>
              <div className="flex items-start gap-2">
                <input value={matricula} onChange={(e) => { setMatricula(e.target.value.toUpperCase()); setNome(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void validarSupervisor(); } }} placeholder="Matrícula" maxLength={20} className={`${inp} font-mono uppercase`} />
                <input type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setNome(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void validarSupervisor(); } }} placeholder="Senha do portal" autoComplete="off" className={inp} />
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
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Criar planejamento'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : viagens.length === 0 ? (
        <div className="py-12 text-center"><Route className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum planejamento</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead><tr className="bg-slate-50"><th className={th}>#</th><th className={th}>Mês</th><th className={th}>Supervisor</th><th className={th}>Visitas / Despesas</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {viagens.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/supervisores/viagens/${v.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-capul-700">{v.numero}</td>
                  <td className="px-4 py-3">{fmtMes(v.mesReferencia)}</td>
                  <td className="px-4 py-3">{v.condutorNome ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{v._count?.paradas ?? 0} / {v._count?.despesas ?? 0}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPlan(v.statusPlanejamento).cls}`}>{statusPlan(v.statusPlanejamento).label}</span></td>
                  <td className="px-4 py-3 text-xs text-capul-600">Abrir →</td>
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

// ---------------- Equipe (supervisores + vínculo com coordenador) ----------------
interface Supervisor { id: string; matricula: string; nome: string; coordenadorId?: string | null; coordenadorNome?: string | null; ativo: boolean }
interface CoreUser { id: string; nome?: string; nomeFantasia?: string }

function EquipeTab() {
  const { toast } = useToast();
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';
  const [itens, setItens] = useState<Supervisor[]>([]);
  const [usuarios, setUsuarios] = useState<CoreUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [coordenadorId, setCoordenadorId] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCoord, setEditCoord] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        logisticaApi.get<Supervisor[]>('/supervisor/supervisores'),
        filialId ? coreApi.get<CoreUser[]>('/usuarios', { params: { filialId } }) : Promise.resolve({ data: [] as CoreUser[] }),
      ]);
      setItens(s.data); setUsuarios(u.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar a equipe.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialId]);

  const nomeUser = (u: CoreUser) => u.nome ?? u.nomeFantasia ?? u.id;
  const buscarNome = async () => {
    const m = matricula.trim();
    if (!m) { setNome(''); return; }
    setBuscando(true);
    try { const { data } = await logisticaApi.post<{ matricula: string; nome: string }>('/frota/condutor', { matricula: m }); setNome(data.nome); }
    catch { setNome(''); toast('warning', 'Matrícula não encontrada no Protheus.'); } finally { setBuscando(false); }
  };
  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula.trim() || !nome.trim()) { toast('warning', 'Informe a matrícula e busque o nome.'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post('/supervisor/supervisores', { matricula: matricula.trim(), nome: nome.trim(), coordenadorId: coordenadorId || undefined });
      toast('success', 'Supervisor cadastrado.');
      setShowForm(false); setMatricula(''); setNome(''); setCoordenadorId('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao cadastrar.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async (id: string) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${id}`, { coordenadorId: editCoord }); toast('success', 'Vínculo atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (s: Supervisor) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${s.id}`, { ativo: !s.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Cadastre os supervisores de área e vincule cada um ao seu <b>coordenador</b> (quem aprova planejamentos e despesas).</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700"><Plus className="h-4 w-4" /> Novo supervisor</button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Matrícula (Protheus) *</label>
              <div className="flex gap-2">
                <input value={matricula} onChange={(e) => { setMatricula(e.target.value.toUpperCase()); setNome(''); }} onBlur={() => void buscarNome()} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscarNome(); } }} placeholder="ex.: E05222" maxLength={20} className={`${inp} font-mono uppercase`} />
                <button type="button" onClick={() => void buscarNome()} disabled={buscando || !matricula.trim()} className="mt-1 shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">{buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}</button>
              </div>
              {nome && <p className="mt-1 text-xs font-medium text-emerald-700">👤 {nome}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Coordenador</label>
              <select value={coordenadorId} onChange={(e) => setCoordenadorId(e.target.value)} className={inp}>
                <option value="">— (sem coordenador)</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Cadastrar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><Users className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum supervisor cadastrado</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead><tr className="bg-slate-50"><th className={th}>Matrícula</th><th className={th}>Nome</th><th className={th}>Coordenador</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">{s.matricula}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.nome}</td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <select value={editCoord} onChange={(e) => setEditCoord(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        <option value="">— (sem)</option>
                        {usuarios.map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}</option>)}
                      </select>
                    ) : (s.coordenadorNome ?? <span className="text-slate-400">— sem coordenador</span>)}
                  </td>
                  <td className="px-4 py-3"><span className={pill(s.ativo)}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => void salvarEdicao(s.id)} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setEditId(s.id); setEditCoord(s.coordenadorId ?? ''); }} className="text-xs text-capul-600 hover:underline">Vincular/editar</button>
                        <button onClick={() => void toggle(s)} className="text-xs text-capul-600 hover:underline">{s.ativo ? 'Inativar' : 'Ativar'}</button>
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

// ---------------- Coordenação (aprovar/ajustar/rejeitar planejamentos) ----------------
interface PlanejamentoCoord {
  id: string; numero: number; mesReferencia?: number | null; statusPlanejamento?: string | null;
  supervisorRegistro?: { nome: string; matricula: string } | null;
  _count?: { paradas: number; despesas: number };
}
function CoordenacaoTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [itens, setItens] = useState<PlanejamentoCoord[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidindo, setDecidindo] = useState<{ id: string; tipo: 'AJUSTADO' | 'REJEITADO' } | null>(null);
  const [comentario, setComentario] = useState('');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<PlanejamentoCoord[]>('/supervisor/coordenador/planejamentos'); setItens(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar planejamentos.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decidir = async (id: string, decisao: 'APROVADO' | 'AJUSTADO' | 'REJEITADO', coment?: string) => {
    try {
      await logisticaApi.patch(`/supervisor/viagens/${id}/decidir`, { decisao, comentario: coment });
      toast('success', decisao === 'APROVADO' ? 'Planejamento aprovado.' : decisao === 'AJUSTADO' ? 'Devolvido para ajuste.' : 'Planejamento rejeitado.');
      setDecidindo(null); setComentario(''); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao decidir.')); }
  };

  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">Planejamentos dos seus supervisores. Aprove, <b>ajuste</b> (devolve com um comentário) ou rejeite os que estão <b>Enviados</b>.</p>
      {loading ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><Users className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum planejamento sob sua coordenação</p></div>
      ) : (
        <div className="space-y-3">
          {itens.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button onClick={() => navigate(`/supervisores/viagens/${p.id}`)} className="font-medium text-capul-700 hover:underline">#{p.numero}</button>
                <span className="text-sm text-slate-600">{fmtMes(p.mesReferencia)}</span>
                <span className="text-sm font-medium text-slate-700">{p.supervisorRegistro?.nome ?? '—'}</span>
                <span className="text-xs text-slate-400">{p._count?.paradas ?? 0} visita(s) · {p._count?.despesas ?? 0} despesa(s)</span>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPlan(p.statusPlanejamento).cls}`}>{statusPlan(p.statusPlanejamento).label}</span>
                {p.statusPlanejamento === 'ENVIADO' && (
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => void decidir(p.id, 'APROVADO')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Aprovar</button>
                    <button onClick={() => { setDecidindo({ id: p.id, tipo: 'AJUSTADO' }); setComentario(''); }} className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">Ajustar</button>
                    <button onClick={() => { setDecidindo({ id: p.id, tipo: 'REJEITADO' }); setComentario(''); }} className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100">Rejeitar</button>
                  </div>
                )}
              </div>
              {decidindo?.id === p.id && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Comentário para o supervisor ({decidindo.tipo === 'AJUSTADO' ? 'ajuste' : 'rejeição'}) *</label>
                  <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Explique o que ajustar / o motivo…" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => { if (!comentario.trim()) { toast('warning', 'Informe o comentário.'); return; } void decidir(p.id, decidindo.tipo, comentario.trim()); }} className="rounded-lg bg-capul-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-capul-700">Confirmar {decidindo.tipo === 'AJUSTADO' ? 'ajuste' : 'rejeição'}</button>
                    <button onClick={() => { setDecidindo(null); setComentario(''); }} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
