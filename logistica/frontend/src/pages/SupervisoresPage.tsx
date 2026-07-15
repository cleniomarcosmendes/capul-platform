import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Plus, Printer, Route, Tag, Users, X } from 'lucide-react';
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
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;

// Ciclo do planejamento (rótulo + cor).
const STATUS_PLAN: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Em preparação', cls: 'bg-slate-100 text-slate-600' },
  ENVIADO: { label: 'Enviado (aguarda coordenador)', cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  AJUSTADO: { label: 'Ajustado (revisar)', cls: 'bg-sky-100 text-sky-700' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
  EM_EXECUCAO: { label: 'Em execução', cls: 'bg-indigo-100 text-indigo-700' },
  CONCLUIDO: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
};
const statusPlan = (s?: string | null) => STATUS_PLAN[s ?? ''] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };

const TAB_LABEL: Record<string, string> = { viagens: 'Planejamentos', coordenacao: 'Coordenação (aprovar)', fechamento: 'Adiantamentos / RDV', atividades: 'Atividades', equipe: 'Equipe (supervisores)' };
type TabKey = 'viagens' | 'coordenacao' | 'fechamento' | 'atividades' | 'equipe';

// Abas visíveis por perfil (defesa em profundidade — o backend barra as escritas):
// ADMIN + Supervisor de Departamento (admin do RDV) = tudo · Coordenador = Planejamentos
// + Coordenação + Fechamento · Supervisor de Área = Planejamentos + Fechamento (só o SEU,
// auto-serviço: lança adiantamento e vê a própria RDV — sem seletor, sem encerrar mês).
// Gestores de entrega/frota saíram do RDV (backend os barra) — não recebem abas de admin.
function abasDoPerfil(role: string | null): TabKey[] {
  if (role === 'ADMIN' || role === 'SUPERVISOR_FROTA') return ['viagens', 'coordenacao', 'fechamento', 'atividades', 'equipe'];
  if (role === 'COORDENADOR') return ['viagens', 'coordenacao', 'fechamento'];
  if (role === 'SUPERVISOR') return ['viagens', 'fechamento'];
  return ['viagens'];
}

export function SupervisoresPage() {
  const { logisticaRole } = useAuth();
  const abas = abasDoPerfil(logisticaRole);
  const [tab, setTab] = useState<TabKey>('viagens');
  // Garante que a aba ativa é permitida (ex.: se o perfil muda, cai p/ a 1ª).
  const tabAtiva = abas.includes(tab) ? tab : abas[0];
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800">Supervisores</h1>
      <p className="mb-6 text-sm text-slate-500">Prestação de contas mensal (RDV) e catálogos das visitas — Indústria de Ração.</p>
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {abas.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tabAtiva === t ? 'border-capul-600 text-capul-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {tabAtiva === 'viagens' ? <ViagensTab /> : tabAtiva === 'coordenacao' ? <CoordenacaoTab /> : tabAtiva === 'fechamento' ? <FechamentoTab /> : tabAtiva === 'atividades' ? <AtividadesTab /> : <EquipeTab />}
    </div>
  );
}

// ---------------- Viagens mensais ----------------
function ViagensTab() {
  const { toast } = useToast();
  const { logisticaRole } = useAuth();
  // Auto-serviço: o próprio supervisor logado cria seu planejamento (identificado
  // pelo login), sem matrícula+senha. Gestor segue informando matrícula+senha.
  const ehSupervisorLogado = logisticaRole === 'SUPERVISOR';
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
  const senhaRef = useRef<HTMLInputElement>(null);

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

  // Enter/blur na matrícula: busca só o NOME (sem senha) e pula o foco pra senha.
  // Espelha a Saída de Veículo (condutor) — confirma quem é antes de pedir a senha.
  const buscarNomeSup = async () => {
    const m = matricula.trim();
    if (!m || nome || buscando) return;
    setBuscando(true);
    try {
      const { data } = await logisticaApi.post<{ matricula: string; nome: string }>('/frota/condutor', { matricula: m });
      setNome(data.nome);
      setTimeout(() => senhaRef.current?.focus(), 0);
    } catch { toast('warning', 'Matrícula não encontrada no Protheus.'); } finally { setBuscando(false); }
  };

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
    if (!ehSupervisorLogado && matricula.trim() && !senha) { toast('warning', 'Informe a senha do supervisor (ou limpe a matrícula).'); return; }
    const mesRef = Number(mes.replace('-', '')); // "2026-05" → 202605
    setSalvando(true);
    try {
      const { data } = await logisticaApi.post<{ id: string }>('/supervisor/viagens', {
        mesReferencia: mesRef,
        // Supervisor logado: backend identifica pelo JWT (sem matrícula+senha).
        ...(ehSupervisorLogado ? {} : { supervisorMatricula: matricula.trim() || undefined, supervisorSenha: senha || undefined }),
      });
      toast('success', 'Planejamento criado — agora inclua os clientes do roteiro.');
      setShowForm(false); setMes(''); setMatricula(''); setSenha(''); setNome('');
      // Abre direto o planejamento (form "Incluir cliente no planejamento" já à mão).
      if (data?.id) { navigate(`/supervisores/viagens/${data.id}`); return; }
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
            {ehSupervisorLogado ? (
            <div className="flex items-end">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">👤 Você é o supervisor — o planejamento será criado no seu nome (login). Não precisa de matrícula/senha.</p>
            </div>
            ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor (matrícula + senha)</label>
              <div className="flex items-start gap-2">
                <input value={matricula} onChange={(e) => { setMatricula(e.target.value.toUpperCase()); setNome(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscarNomeSup(); } }} onBlur={() => void buscarNomeSup()} placeholder="Matrícula" maxLength={20} className={`${inp} font-mono uppercase`} />
                <input ref={senhaRef} type="password" value={senha} onChange={(e) => { setSenha(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void validarSupervisor(); } }} placeholder="Senha do portal" autoComplete="off" className={inp} />
                <button type="button" onClick={() => void validarSupervisor()} disabled={buscando || !matricula.trim() || !senha} className="mt-0.5 inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
                </button>
              </div>
              {nome
                ? <p className="mt-1 text-xs font-medium text-emerald-700">👤 {nome} — confirme com a senha do portal</p>
                : <p className="mt-1 text-xs text-slate-400">Digite a matrícula e tecle Enter — buscamos o nome e o cursor vai pra senha.</p>}
            </div>
            )}
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
interface Supervisor { id: string; matricula: string; nome: string; departamentoId?: string | null; coordenadorId?: string | null; coordenadorNome?: string | null; ativo: boolean }
interface CoreUser { id: string; nome?: string; nomeFantasia?: string; matricula?: string | null; departamento?: { id: string; nome: string } | null; permissoes?: { modulo: { codigo: string }; roleModulo: { codigo: string } }[] }
interface DeptItem { id: string; nome: string }
// Supervisor de área = usuário do sistema com o papel SUPERVISOR no módulo LOGISTICA.
const ehSupervisorArea = (u: CoreUser) => (u.permissoes ?? []).some((p) => p.modulo.codigo === 'LOGISTICA' && p.roleModulo.codigo === 'SUPERVISOR');

function EquipeTab() {
  const { toast } = useToast();
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';
  const [itens, setItens] = useState<Supervisor[]>([]);
  const [usuarios, setUsuarios] = useState<CoreUser[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [usuarioId, setUsuarioId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [coordenadorId, setCoordenadorId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCoord, setEditCoord] = useState('');
  const [editDepto, setEditDepto] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [s, u, d] = await Promise.all([
        logisticaApi.get<Supervisor[]>('/supervisor/supervisores'),
        filialId ? coreApi.get<CoreUser[]>('/usuarios', { params: { filialId } }) : Promise.resolve({ data: [] as CoreUser[] }),
        // Departamentos que ESTE usuário pode escolher: o Supervisor de Departamento vê
        // só os seus; ADMIN vê todos. Mesmo endpoint escopado da Análise de Custos.
        logisticaApi.get<DeptItem[]>('/frota/departamentos-filtro').catch(() => ({ data: [] as DeptItem[] })),
      ]);
      setItens(s.data); setUsuarios(u.data); setDepartamentos(d.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar a equipe.')); } finally { setLoading(false); }
  };
  const deptNome = (id?: string | null) => (id ? (departamentos.find((d) => d.id === id)?.nome ?? id.slice(0, 8)) : null);
  // Departamento sugerido pelo coordenador escolhido (cadastro dele no core) — só vale
  // se estiver na lista que ESTE usuário pode escolher; senão devolve '' (não sugere
  // um departamento fora do escopo do Supervisor de Departamento).
  const deptDoCoord = (cid: string) => {
    const dep = usuarios.find((u) => u.id === cid)?.departamento?.id;
    return dep && departamentos.some((d) => d.id === dep) ? dep : '';
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialId]);

  const nomeUser = (u: CoreUser) => u.nome ?? u.nomeFantasia ?? u.id;
  // Supervisores de área DA FILIAL (usuários com o papel), ordenados por nome, para
  // escolher pelo NOME — quem monta o time (Supervisor de Departamento) sabe o nome,
  // não a matrícula. Matrícula e departamento vêm do cadastro do usuário.
  const supervisoresArea = usuarios.filter(ehSupervisorArea);
  const supSel = usuarios.find((u) => u.id === usuarioId);
  const escolherSupervisor = (uid: string) => {
    setUsuarioId(uid);
    const u = usuarios.find((x) => x.id === uid);
    const dep = u?.departamento?.id; // default: o departamento do próprio supervisor
    if (dep && departamentos.some((d) => d.id === dep)) setDeptId(dep);
  };
  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = usuarios.find((x) => x.id === usuarioId);
    if (!u) { toast('warning', 'Escolha o supervisor de área pelo nome.'); return; }
    if (!u.matricula?.trim()) { toast('warning', 'Este usuário não tem matrícula (chapa) no cadastro — necessária para o RDV. Ajuste no Configurador.'); return; }
    if (!deptId) { toast('warning', 'Selecione o departamento.'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post('/supervisor/supervisores', { matricula: u.matricula.trim(), nome: nomeUser(u), departamentoId: deptId, coordenadorId: coordenadorId || undefined });
      toast('success', 'Supervisor de área cadastrado.');
      setShowForm(false); setUsuarioId(''); setDeptId(''); setCoordenadorId('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao cadastrar.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async (id: string) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${id}`, { departamentoId: editDepto, coordenadorId: editCoord }); toast('success', 'Cadastro atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (s: Supervisor) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${s.id}`, { ativo: !s.ativo }); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Monte o time: cadastre os <b>supervisores de área</b>, informe o <b>departamento</b> de cada um e vincule ao seu <b>coordenador</b> (quem aprova planejamentos e despesas).</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700"><Plus className="h-4 w-4" /> Novo supervisor</button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor de área *</label>
              <select value={usuarioId} onChange={(e) => escolherSupervisor(e.target.value)} className={inp}>
                <option value="">— selecione pelo nome</option>
                {supervisoresArea.map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}{u.matricula ? ` · ${u.matricula}` : ''}</option>)}
              </select>
              {supervisoresArea.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700">Nenhum usuário com o papel <b>Supervisor de Área</b> nesta filial. Atribua o papel no Configurador primeiro.</p>
              ) : supSel && !supSel.matricula ? (
                <p className="mt-1 text-xs text-rose-600">Sem matrícula (chapa) no cadastro — ajuste no Configurador para usar no RDV.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Escolha pelo <b>nome</b>. A matrícula e o departamento vêm do cadastro dele — ajuste o departamento se precisar.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Departamento *</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inp}>
                <option value="">— selecione</option>
                {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Coordenador</label>
              <select value={coordenadorId} onChange={(e) => { const cid = e.target.value; setCoordenadorId(cid); if (!deptId) { const dep = deptDoCoord(cid); if (dep) setDeptId(dep); } }} className={inp}>
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
            <thead><tr className="bg-slate-50"><th className={th}>Matrícula</th><th className={th}>Nome</th><th className={th}>Departamento</th><th className={th}>Coordenador</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">{s.matricula}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.nome}</td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <select value={editDepto} onChange={(e) => setEditDepto(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
                        <option value="">— (sem)</option>
                        {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                      </select>
                    ) : (deptNome(s.departamentoId) ?? <span className="text-slate-400">— sem departamento</span>)}
                  </td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <select value={editCoord} onChange={(e) => { const cid = e.target.value; setEditCoord(cid); const dep = deptDoCoord(cid); if (dep) setEditDepto(dep); }} className="rounded border border-slate-300 px-2 py-1 text-sm">
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
                        <button onClick={() => { setEditId(s.id); setEditCoord(s.coordenadorId ?? ''); setEditDepto(s.departamentoId ?? ''); }} className="text-xs text-capul-600 hover:underline">Editar</button>
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

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<PlanejamentoCoord[]>('/supervisor/coordenador/planejamentos'); setItens(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar planejamentos.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A decisão (Aprovar/Ajustar/Rejeitar) foi movida para o DETALHE do planejamento —
  // com visitas + despesas (valores) + comprovantes à vista. Aqui é só a fila/triagem.
  return (
    <div>
      <p className="mb-6 text-sm text-slate-500">Fila de aprovação. Clique em <b>Revisar e decidir</b> para abrir o planejamento com as visitas e as despesas (valores + comprovantes) e então <b>Aprovar</b>, <b>Ajustar</b> ou <b>Rejeitar</b> — o coordenador vê os seus supervisores; o gestor, os da filial.</p>
      {loading ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><Users className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum planejamento sob sua coordenação</p></div>
      ) : (
        <div className="space-y-3">
          {itens.map((p) => (
            <button key={p.id} onClick={() => navigate(`/supervisores/viagens/${p.id}`)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-capul-300 hover:bg-capul-50/40">
              <span className="font-medium text-capul-700">#{p.numero}</span>
              <span className="text-sm text-slate-600">{fmtMes(p.mesReferencia)}</span>
              <span className="text-sm font-medium text-slate-700">{p.supervisorRegistro?.nome ?? '—'}</span>
              <span className="text-xs text-slate-400">{p._count?.paradas ?? 0} visita(s) · {p._count?.despesas ?? 0} despesa(s)</span>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusPlan(p.statusPlanejamento).cls}`}>{statusPlan(p.statusPlanejamento).label}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-capul-700">{p.statusPlanejamento === 'ENVIADO' ? 'Revisar e decidir' : 'Abrir'} →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Fechamento mensal (adiantamentos + RDV agregada) ----------------
interface SupItem { id: string; nome: string; matricula: string }
interface Adiant { id: string; valor: number | string; dataAdiantamento: string; observacao?: string | null; situacao?: string | null; motivoRejeicao?: string | null }
interface RdvMensal { total: number; totalAdiantamento: number; totalAdiantamentoPendente?: number; saldo: number; planejamentos: number; totaisPorCategoria: { VEICULO: number; INDIVIDUO: number }; fechado?: boolean; fechadoEm?: string | null }
const ADIANT_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
};
const adiantBadge = (s?: string | null) => ADIANT_BADGE[s ?? 'APROVADO'] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };

function FechamentoTab() {
  const { toast } = useToast();
  const { logisticaRole } = useAuth();
  const navigate = useNavigate();
  // Supervisor de área: auto-serviço — fixa o SEU cadastro (sem seletor, sem encerrar mês).
  const ehSupervisorArea = logisticaRole === 'SUPERVISOR';
  const [sups, setSups] = useState<SupItem[]>([]);
  // undefined = carregando o próprio cadastro · null = ainda não montado no time.
  const [meuCadastro, setMeuCadastro] = useState<SupItem | null | undefined>(ehSupervisorArea ? undefined : null);
  const [supId, setSupId] = useState('');
  const [mesInput, setMesInput] = useState('');
  const mes = mesInput ? Number(mesInput.replace('-', '')) : 0;
  const [adiantamentos, setAdiantamentos] = useState<Adiant[]>([]);
  const [rdv, setRdv] = useState<RdvMensal | null>(null);
  const [loading, setLoading] = useState(false);
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (ehSupervisorArea) {
      // Auto-serviço: resolve o próprio cadastro e fixa o supId (sem seletor).
      logisticaApi.get<SupItem | null>('/supervisor/meu-cadastro')
        .then((r) => { setMeuCadastro(r.data ?? null); if (r.data) setSupId(r.data.id); })
        .catch(() => setMeuCadastro(null));
      return;
    }
    logisticaApi.get<SupItem[]>('/supervisor/supervisores', { params: { ativos: true } }).then((r) => setSups(r.data)).catch(() => { /* silencioso */ });
  }, [ehSupervisorArea]);

  const carregar = async () => {
    if (!supId || !mes) { setAdiantamentos([]); setRdv(null); return; }
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        logisticaApi.get<Adiant[]>('/supervisor/adiantamentos', { params: { supervisorId: supId, mes } }),
        logisticaApi.get<RdvMensal>('/supervisor/rdv-mensal', { params: { supervisorId: supId, mes } }),
      ]);
      setAdiantamentos(a.data); setRdv(r.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar o fechamento.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supId, mes]);

  const lancar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supId || !mes) { toast('warning', 'Selecione o supervisor e o mês.'); return; }
    if (!valor || Number(valor) <= 0) { toast('warning', 'Informe o valor do adiantamento.'); return; }
    try {
      await logisticaApi.post('/supervisor/adiantamentos', { supervisorId: supId, mesReferencia: mes, valor: Number(valor), data: data || undefined, observacao: obs.trim() || undefined });
      toast('success', 'Adiantamento lançado.'); setValor(''); setData(''); setObs(''); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao lançar adiantamento.')); }
  };
  const remover = async (aid: string) => {
    try { await logisticaApi.delete(`/supervisor/adiantamentos/${aid}`); toast('success', 'Adiantamento removido.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };
  const encerrarMes = async () => {
    if (!supId || !mes) { toast('warning', 'Selecione o supervisor e o mês.'); return; }
    const acao = rdv?.fechado ? 'reabrir' : 'fechar';
    try {
      await logisticaApi.post(`/supervisor/rdv-mensal/${acao}`, { supervisorId: supId, mesReferencia: mes });
      toast('success', rdv?.fechado ? 'Mês reaberto — lançamentos liberados.' : 'Mês encerrado — despesas/adiantamentos travados.');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao alterar o encerramento do mês.')); }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        {ehSupervisorArea
          ? <><b>Seus adiantamentos e a sua RDV do mês.</b> Lance o adiantamento a qualquer momento — antes, durante ou depois da viagem (pode haver vários no mês). Ao lado, a sua RDV agregada (saldo = adiantamentos − despesas aprovadas). O encerramento do mês é feito pelo coordenador.</>
          : <>Adiantamentos e RDV do mês, por supervisor. <b>Lance o adiantamento a qualquer momento</b> — antes, durante ou depois da viagem (pode haver vários no mês). Ao lado, a RDV agregada do mês (saldo = adiantamentos − despesas aprovadas) e o <b>encerramento</b> do mês (ao final, trava lançamentos).</>}
      </p>
      {ehSupervisorArea && meuCadastro === null ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">Seu cadastro de supervisor de área ainda não foi montado no time desta filial (ou seu login não tem matrícula). Peça ao Supervisor de Departamento para te cadastrar com um coordenador — depois você poderá lançar seus adiantamentos aqui.</p>
      ) : (
      <>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor</label>
          {ehSupervisorArea ? (
            <div className={`${inp} bg-slate-50 text-slate-600`}>{meuCadastro ? `Você — ${meuCadastro.nome} (${meuCadastro.matricula})` : 'Carregando…'}</div>
          ) : (
            <select value={supId} onChange={(e) => setSupId(e.target.value)} className={inp}>
              <option value="">Selecione…</option>
              {sups.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.matricula})</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mês</label>
          <input type="month" value={mesInput} onChange={(e) => setMesInput(e.target.value)} className={inp} />
        </div>
      </div>

      {supId && mes ? (
        loading ? <div className="py-8 text-center text-slate-500">Carregando…</div> : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Adiantamentos do mês</h3>
              {adiantamentos.length === 0 ? <p className="text-sm text-slate-400">Nenhum adiantamento.</p> : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {adiantamentos.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2">{fmtData(a.dataAdiantamento)}</td>
                        <td className="py-2 font-medium">{brl(a.valor)}</td>
                        <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${adiantBadge(a.situacao).cls}`} title={a.situacao === 'REJEITADO' ? (a.motivoRejeicao ?? '') : ''}>{adiantBadge(a.situacao).label}</span></td>
                        <td className="py-2 text-slate-500">{a.observacao ?? ''}</td>
                        <td className="py-2 text-right"><button onClick={() => void remover(a.id)} className="text-xs text-rose-600 hover:underline">Remover</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form onSubmit={lancar} className="mt-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor R$" className={inp} />
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
                </div>
                <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" maxLength={255} className={`${inp} mt-2`} />
                <button type="submit" className="mt-2 rounded-lg bg-capul-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-capul-700">Lançar adiantamento</button>
              </form>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">RDV do mês (agregada)</h3>
                <button onClick={() => navigate(`/supervisores/rdv-mensal/${supId}/${mes}`)} className="inline-flex items-center gap-1 text-xs text-capul-600 hover:underline"><Printer className="h-3.5 w-3.5" /> Imprimir RDV</button>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Planejamentos no mês</dt><dd>{rdv?.planejamentos ?? 0}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Despesas de veículo</dt><dd>{brl(rdv?.totaisPorCategoria.VEICULO ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Despesas de indivíduo</dt><dd>{brl(rdv?.totaisPorCategoria.INDIVIDUO ?? 0)}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-medium"><dt>Total de despesas</dt><dd>{brl(rdv?.total ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Adiantamentos aprovados</dt><dd>{brl(rdv?.totalAdiantamento ?? 0)}</dd></div>
                {(rdv?.totalAdiantamentoPendente ?? 0) > 0 && (
                  <div className="flex justify-between text-amber-700"><dt>Aguardando aprovação</dt><dd>{brl(rdv?.totalAdiantamentoPendente ?? 0)}</dd></div>
                )}
                <div className="flex justify-between rounded-lg bg-slate-50 px-2 py-2 font-semibold"><dt>{(rdv?.saldo ?? 0) >= 0 ? 'A devolver à CAPUL' : 'A reembolsar'}</dt><dd>{brl(Math.abs(rdv?.saldo ?? 0))}</dd></div>
              </dl>
              {rdv?.fechado && (
                <p className="mt-3 rounded-lg bg-amber-50 px-2 py-2 text-xs font-medium text-amber-700">🔒 Mês encerrado — despesas, adiantamentos e visitas travados{ehSupervisorArea ? ' (fale com o coordenador para reabrir)' : ''}.</p>
              )}
              {/* Encerrar/reabrir o mês é do coordenador/Supervisor de Departamento — não do supervisionado. */}
              {!ehSupervisorArea && (
                <button
                  onClick={() => void encerrarMes()}
                  className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium ${rdv?.fechado ? 'border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                >
                  {rdv?.fechado ? '🔓 Reabrir mês' : '🔒 Encerrar mês'}
                </button>
              )}
            </div>
          </div>
        )
      ) : <p className="py-8 text-center text-sm text-slate-400">{ehSupervisorArea ? 'Escolha o mês.' : 'Selecione o supervisor e o mês.'}</p>}
      </>
      )}
    </div>
  );
}
