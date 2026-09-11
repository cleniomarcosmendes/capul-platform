import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Printer, Route, Tag, Users, X } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';
import { errMsg } from './frota-utils';
import { DataInput } from '../components/DataInput';
import { papelLabel } from './supervisor-utils';
import { MoedaInput } from '../components/MoedaInput';

// Módulo Supervisores / RDV (Fase 3b): viagem mensal (prestação de contas) +
// catálogos (Atividade de visita) e prestação de contas. Indústria de Ração.

interface Atividade { id: string; nome: string; ativo: boolean; filialId?: string | null }
interface ViagemSup {
  id: string; numero: number; situacao: string; statusPlanejamento?: string | null; mesReferencia?: number | null;
  condutorNome?: string | null; condutorMatricula?: string | null;
  // Quem EXECUTA (papel real, vindo da role no módulo) e quem APROVA — a lista
  // mostrava só o nome, e chamava todo representante de "Supervisor".
  papelRepresentante?: string | null; departamentoNome?: string | null; aprovadorNome?: string | null;
  _count?: { paradas: number; despesas: number };
}

const fmtMes = (m?: number | null) => (m ? `${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}` : '—');

/** "YYYY-MM" de hoje — padrão do mês de referência (o planejamento quase sempre é do
 *  mês em curso). */
const mesCorrente = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Mês de referência em dois selects (mês + ano), no formato "YYYY-MM".
 *
 * Era um `<input type="month">`: o calendarinho nativo só abre clicando no ícone
 * minúsculo à direita — clicar no campo apenas dá foco, e a impressão é de que a tela
 * travou. Fora que o Firefox nem implementa o tipo (degrada para texto livre). Dois
 * selects abrem com um clique em qualquer navegador e não deixam digitar mês inválido.
 */
function MesRefField({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const hoje = new Date();
  const [ano, mes] = value ? value.split('-') : ['', ''];
  const anoAtual = hoje.getFullYear();
  // Janela curta e suficiente: fechamento retroativo do ano passado até o ano que vem.
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];
  const set = (novoAno: string, novoMes: string) => onChange(novoAno && novoMes ? `${novoAno}-${novoMes}` : '');
  return (
    <div className="flex gap-2">
      <select value={mes} onChange={(e) => set(ano || String(anoAtual), e.target.value)} required={required} className={inp} aria-label="Mês">
        <option value="">— mês</option>
        {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome}</option>)}
      </select>
      <select value={ano} onChange={(e) => set(e.target.value, mes || String(hoje.getMonth() + 1).padStart(2, '0'))} required={required} className={inp} aria-label="Ano">
        <option value="">— ano</option>
        {anos.map((a) => <option key={a} value={String(a)}>{a}</option>)}
      </select>
    </div>
  );
}
const brl = (v: unknown) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const th = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;

// Ciclo do planejamento (rótulo + cor).
const STATUS_PLAN: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: 'Em preparação', cls: 'bg-slate-100 text-slate-600' },
  ENVIADO: { label: 'Enviado (aguarda aprovação)', cls: 'bg-amber-100 text-amber-700' },
  APROVADO: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  AJUSTADO: { label: 'Ajustado (revisar)', cls: 'bg-sky-100 text-sky-700' },
  REJEITADO: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
  EM_EXECUCAO: { label: 'Em execução', cls: 'bg-indigo-100 text-indigo-700' },
  CONCLUIDO: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-rose-100 text-rose-700' },
};
const statusPlan = (s?: string | null) => STATUS_PLAN[s ?? ''] ?? { label: s ?? '—', cls: 'bg-slate-100 text-slate-600' };

const TAB_LABEL: Record<string, string> = { viagens: 'Planejamentos', coordenacao: 'Coordenação (aprovar)', fechamento: 'Adiantamentos / RDV', atividades: 'Atividades', equipe: 'Equipe (supervisores)' };
type TabKey = 'viagens' | 'coordenacao' | 'fechamento' | 'atividades' | 'equipe';

// Abas visíveis por perfil (defesa em profundidade — o backend barra as escritas):
// ADMIN + Supervisor de Departamento (admin do RDV) = tudo · Coordenador = Planejamentos
// + Coordenação + Fechamento · Supervisor de Área = Planejamentos + Fechamento (só o SEU:
// ACOMPANHA os adiantamentos e a própria RDV — sem seletor, sem encerrar mês e, desde
// 01/08, sem LANÇAR adiantamento: quem lança é quem aprova).
// Gestores de entrega/frota saíram do RDV (backend os barra) — não recebem abas de admin.
/** Abas do RDV pelo perfil. Multi-role: vale o papel MAIS abrangente que a pessoa
 *  tiver — quem é SUPERVISOR num depto e COORDENADOR noutro vê as abas do coordenador. */
function abasDoPerfil(tem: (...alvos: string[]) => boolean): TabKey[] {
  if (tem('ADMIN', 'SUPERVISOR_FROTA')) return ['viagens', 'coordenacao', 'fechamento', 'atividades', 'equipe'];
  if (tem('COORDENADOR')) return ['viagens', 'coordenacao', 'fechamento'];
  if (tem('SUPERVISOR')) return ['viagens', 'fechamento'];
  return ['viagens'];
}

export function SupervisoresPage() {
  const { temRole } = useAuth();
  const abas = abasDoPerfil(temRole);
  const [tab, setTab] = useState<TabKey>('viagens');
  // Garante que a aba ativa é permitida (ex.: se o perfil muda, cai p/ a 1ª).
  const tabAtiva = abas.includes(tab) ? tab : abas[0];
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-800">Supervisores</h1>
      {/* Não nomear filial aqui. O "— Indústria de Ração" era literal fixo: a tela serve
          as 35 filiais e o ADMIN troca de filial na aba Equipe, então o texto afirmava
          uma filial que a página não tinha como garantir — e, quando a Equipe mudava de
          alvo sozinha, virava rótulo errado. Quem diz a filial é o seletor da aba. */}
      <p className="mb-6 text-sm text-slate-500">Prestação de contas mensal (RDV) e catálogos das visitas.</p>
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
  const { usuario, temRole } = useAuth();
  // Auto-serviço: o próprio supervisor logado cria seu planejamento (identificado
  // pelo login), sem matrícula+senha. Gestor segue informando matrícula+senha.
  // Cria o PRÓPRIO RDV em auto-serviço (login): supervisor de área e coordenador (o RDV
  // do coordenador é aprovado pelo supervisor de departamento). O supervisor de departamento
  // usa a via "por representante" (matrícula+senha) — cria para o time.
  const ehSupervisorLogado = temRole('SUPERVISOR', 'COORDENADOR');
  const navigate = useNavigate();
  const [viagens, setViagens] = useState<ViagemSup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // Mês corrente já preenchido — o planejamento quase sempre é do mês em curso
  // (01/08, pedido do Clenio). Continua editável pelos dois selects.
  const [mes, setMes] = useState(mesCorrente);
  // Gestor/Supervisor de Departamento cria PARA um representante: seleciona pelo nome
  // do time JÁ CADASTRADO (aba Equipe), sem matrícula/senha. O backend valida o escopo.
  const [equipe, setEquipe] = useState<Supervisor[]>([]);
  const [supRegistroId, setSupRegistroId] = useState('');
  /**
   * Filial da aba (ADMIN). Diferente da aba Equipe, aqui o padrão é a **filial do
   * usuário** — decisão do Clenio (01/08): ele troca quando precisar. Sem o seletor, o
   * ADMIN (lotado na matriz) via só o planejamento da matriz e parecia que a tela
   * estava vazia; agora ele VÊ em que filial está.
   *
   * Os demais papéis não veem o seletor e o backend ignora o parâmetro para eles.
   */
  const [filialAlvo, setFilialAlvo] = useState('');
  const filialSessao = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';
  const ehAdminRdv = temRole('ADMIN');
  const filialId = ehAdminRdv ? (filialAlvo || filialSessao) : filialSessao;
  // Mesma regra da aba Equipe (hook único): o ADMIN escolhe entre as filiais do
  // CATÁLOGO. Antes eram `usuario.filiais` + `length > 1`, e o ADMIN de filial única
  // não via seletor nenhum — ficava preso na filial do token sem saber que havia outras.
  const { filiais: filiaisSelecionaveis } = useFiliaisSelecionaveis(ehAdminRdv, usuario?.filiais ?? []);
  // Veículo do planejamento: sugerido a partir de quem é o responsável no cadastro do
  // veículo (Veículos › "Coordenador / Supervisor de Área responsável") e alterável.
  // É ele que as despesas do RDV herdam — sem isso o combustível ficava sem veículo e
  // sumia do custo da frota.
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const registrarFalha = useCallback((chave: string, msg: string | null) => {
    setFalhas((prev) => {
      if (!msg) { if (!(chave in prev)) return prev; const { [chave]: _, ...resto } = prev; return resto; }
      return prev[chave] === msg ? prev : { ...prev, [chave]: msg };
    });
  }, []);
  const [veiculos, setVeiculos] = useState<VeiculoOpc[]>([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [meuCadastro, setMeuCadastro] = useState<{ matricula: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [v, eq, ve, meu] = await Promise.all([
        logisticaApi.get<ViagemSup[]>('/supervisor/viagens', { params: { filialId } }),
        // Só o gestor precisa do time (o supervisor/coordenador cria o próprio, por login).
        ehSupervisorLogado ? Promise.resolve({ data: [] as Supervisor[] }) : logisticaApi.get<Supervisor[]>('/supervisor/supervisores', { params: { filialId } }),
        // Vazia, o seletor de veículo do planejamento fica sem opção — e a despesa de
        // categoria VEÍCULO exige veículo, então a falha só aparece muito depois.
        buscaAcessoria(logisticaApi.get<VeiculoOpc[]>('/veiculos', { params: { filialId } }), [] as VeiculoOpc[], 'veiculos', 'os veículos', registrarFalha),
        // Auto-serviço: preciso da MINHA matrícula para achar o veículo que é meu.
        ehSupervisorLogado
          ? buscaAcessoria(logisticaApi.get<{ matricula: string }>('/supervisor/meu-cadastro'), null as { matricula: string } | null, 'meuCadastro', 'o seu cadastro de representante', registrarFalha)
          : Promise.resolve({ data: null as { matricula: string } | null }),
      ]);
      setViagens(v.data); setEquipe(eq.data); setVeiculos(ve.data ?? []); setMeuCadastro(meu.data);
    } catch (e) { toast('error', errMsg(e, 'Falha ao carregar planejamentos.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialId]);

  const timeAtivo = equipe.filter((s) => s.ativo);

  // Sugere o veículo assim que dá para saber de QUEM é o planejamento: o próprio
  // logado (auto-serviço) ou o representante escolhido pelo gestor. Continua
  // alterável — a sugestão é ponto de partida, não imposição.
  useEffect(() => {
    const matricula = ehSupervisorLogado
      ? meuCadastro?.matricula
      : timeAtivo.find((s) => s.id === supRegistroId)?.matricula;
    setVeiculoId(sugerirVeiculo(veiculos, matricula));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supRegistroId, veiculos, meuCadastro, showForm]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mes) { toast('warning', 'Informe o mês de referência.'); return; }
    if (!ehSupervisorLogado && !supRegistroId) { toast('warning', 'Selecione o supervisor ou coordenador do seu time.'); return; }
    const mesRef = Number(mes.replace('-', '')); // "2026-05" → 202605
    setSalvando(true);
    try {
      const { data } = await logisticaApi.post<{ id: string }>('/supervisor/viagens', {
        mesReferencia: mesRef,
        // Supervisor/coordenador logado: backend identifica pelo JWT (auto-serviço).
        // Gestor: envia o representante selecionado (cadastro), sem senha.
        ...(ehSupervisorLogado ? {} : { supervisorRegistroId: supRegistroId }),
        // Sempre explícito (inclusive '' = sem veículo): o backend só cai na sugestão
        // dele quando o campo vem AUSENTE, de cliente antigo.
        veiculoId,
      }, { params: { filialId } });
      toast('success', 'Planejamento criado — agora inclua os clientes do roteiro.');
      // Mês volta ao corrente (padrão), não a vazio.
      setShowForm(false); setMes(mesCorrente()); setSupRegistroId(''); setVeiculoId('');
      // Abre direto o planejamento (form "Incluir cliente no planejamento" já à mão).
      if (data?.id) { navigate(`/supervisores/viagens/${data.id}`); return; }
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao criar planejamento.')); } finally { setSalvando(false); }
  };


  return (
    <div>
      <AvisoFalhasCarga falhas={falhas} />
      {/* ADMIN opera a aba em qualquer filial sem trocar a da SESSÃO. Padrão = a filial
          dele; ele muda quando precisa (decisão do Clenio). Sem isto ele via só os
          planejamentos da matriz, sem nenhuma pista de por quê. */}
      {ehAdminRdv && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Filial:</label>
          <select value={filialId} onChange={(e) => setFilialAlvo(e.target.value)} className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500">
            {filiaisSelecionaveis.map((f) => <option key={f.id} value={f.id}>{nomeFilial(f)}{f.id === filialSessao ? ' (sua filial)' : ''}</option>)}
          </select>
          {filialId && filialId !== filialSessao ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Você está vendo outra filial — a da sua sessão é {nomeFilial(filiaisSelecionaveis.find((f) => f.id === filialSessao) ?? { id: filialSessao })}
            </span>
          ) : (
            <span className="text-xs text-slate-400">A filial da sua sessão não muda.</span>
          )}
        </div>
      )}

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
              <MesRefField value={mes} onChange={setMes} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Veículo</label>
              <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={inp}>
                <option value="">— sem veículo (carro próprio / carona)</option>
                {veiculos.filter((v) => v.ativo !== false).map((v) => (
                  <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Sugerido a partir do responsável no cadastro do veículo. É o veículo que as
                despesas deste RDV vão herdar — dá para trocar aqui e em cada despesa.
              </p>
            </div>
            {ehSupervisorLogado ? (
            <div className="flex items-end">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">👤 O planejamento (RDV) será criado no seu nome (login). Não precisa de matrícula/senha.</p>
            </div>
            ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Representante (supervisor de área ou coordenador) *</label>
              <select value={supRegistroId} onChange={(e) => setSupRegistroId(e.target.value)} className={inp}>
                <option value="">— selecione pelo nome</option>
                {timeAtivo.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.matricula ? ` · ${s.matricula}` : ''}</option>)}
              </select>
              {timeAtivo.length === 0
                ? <p className="mt-1 text-xs text-amber-700">Nenhum representante no seu time. Cadastre na aba <b>Equipe (supervisores)</b> primeiro.</p>
                : <p className="mt-1 text-xs text-slate-500">Escolha o representante do seu time pelo <b>nome</b> — sem matrícula/senha.</p>}
            </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Criar planejamento'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading && viagens.length === 0 ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : viagens.length === 0 ? (
        <div className="py-12 text-center"><Route className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum planejamento</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            {/* Quem executa (com o papel real) · onde · quem aprova. Antes a lista dizia
                só o nome sob o rótulo fixo "Supervisor", e não dava para saber de quem
                era a vez — nem que o planejamento estava órfão de aprovador. */}
            <thead><tr className="bg-slate-50"><th className={th}>#</th><th className={th}>Mês</th><th className={th}>Quem executa</th><th className={th}>Departamento</th><th className={th}>Aprovação com</th><th className={th}>Visitas / Despesas</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {viagens.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/supervisores/viagens/${v.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-capul-700">{v.numero}</td>
                  <td className="px-4 py-3">{fmtMes(v.mesReferencia)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{v.condutorNome ?? '—'}</span>
                    <span className="block text-xs text-slate-400">{papelLabel(v.papelRepresentante)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.departamentoNome ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {v.aprovadorNome ?? <span className="text-amber-600" title="Sem coordenador nem responsável de departamento — não há para quem enviar">sem aprovador</span>}
                  </td>
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
      {loading && itens.length === 0 ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
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
/** Veículo para o seletor do planejamento. `supervisorAreaMatricula` é quem o cadastro
 *  aponta como responsável — a base da sugestão. */
interface VeiculoOpc { id: string; placa: string; modelo?: string | null; ativo?: boolean; supervisorAreaMatricula?: string | null }
/** Mesma normalização do backend (E+5 dígitos). */
const chapaFe = (m: string) => 'E' + (m || '').replace(/\D/g, '').slice(-5).padStart(5, '0');
/** Veículo cujo responsável é esta matrícula. Dois veículos apontando para a mesma
 *  pessoa não sugerem nada — escolher sozinho mandaria o custo para o carro errado. */
const sugerirVeiculo = (veiculos: VeiculoOpc[], matricula?: string | null) => {
  if (!matricula?.trim()) return '';
  const alvo = chapaFe(matricula);
  const meus = veiculos.filter((v) => v.ativo !== false && v.supervisorAreaMatricula && chapaFe(v.supervisorAreaMatricula) === alvo);
  return meus.length === 1 ? meus[0].id : '';
};

interface Supervisor { id: string; matricula: string; nome: string; departamentoId?: string | null; coordenadorId?: string | null; coordenadorNome?: string | null; papel?: string | null; ativo: boolean; /** Registros de RDV (planejamento/adiantamento/fechamento). >0 impede excluir. */ movimentos?: number }
interface CoreUser { id: string; nome?: string; nomeFantasia?: string; matricula?: string | null; departamento?: { id: string; nome: string } | null; permissoes?: { modulo: { codigo: string }; roleModulo: { codigo: string } }[] }
interface DeptItem { id: string; nome: string }
/** Filial do catálogo (`core.filiais`). O ADMIN é GLOBAL neste módulo — o backend
 *  aceita qualquer `filialId` dele (`supervisor.service.ts:filialAlvo`, que só valida
 *  que a filial existe). Montar o seletor a partir de `usuario.filiais` contradizia
 *  isso: um ADMIN vinculado a UMA filial ficava sem seletor nenhum, e a tela podia
 *  mandá-lo para uma filial que ele não conseguia desfazer. */
interface FilialItem { id: string; codigo?: string; nomeFantasia?: string; nome?: string; status?: string }

/**
 * Busca acessória que NÃO transforma falha em vazio.
 *
 * O padrão `.catch(() => ({ data: [] }))` existe para uma chamada secundária não derrubar
 * a tela inteira — a intenção é boa. O efeito colateral é que 401, 403, 429, timeout e
 * "de fato não há nada" viram a MESMA tela: um seletor vazio, sem uma palavra. Foi por
 * isso que o defeito original ("o sistema não listou o departamento") levou dois dias
 * para ser nomeado: nem o usuário nem eu conseguíamos dizer o que tinha acontecido.
 *
 * Aqui a falha continua não derrubando a tela, mas fica REGISTRADA em `falhas[chave]`,
 * e a tela mostra o que não carregou.
 */
function buscaAcessoria<T>(
  p: Promise<{ data: T }>,
  vazio: T,
  chave: string,
  oQue: string,
  registrar: (chave: string, msg: string | null) => void,
): Promise<{ data: T }> {
  return p
    .then((r) => { registrar(chave, null); return r; })
    .catch((e) => { registrar(chave, errMsg(e, `Não foi possível carregar ${oQue}.`)); return { data: vazio }; });
}

/** Banner do que não carregou. Some sozinho quando a carga seguinte dá certo. */
function AvisoFalhasCarga({ falhas }: { falhas: Record<string, string> }) {
  const msgs = Object.values(falhas).filter(Boolean);
  if (msgs.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">Parte da tela não carregou — o que estiver vazio abaixo pode ser efeito disto, não ausência de dado.</p>
      <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
        {[...new Set(msgs)].map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  );
}

const nomeFilial = (f: { nome?: string; nomeFantasia?: string; codigo?: string; id: string }) =>
  `${f.codigo ? `${f.codigo} · ` : ''}${f.nomeFantasia ?? f.nome ?? f.id}`;

/**
 * Filiais que o seletor desta tela oferece ao ADMIN.
 *
 * Fonte é o CATÁLOGO (`core.filiais`), não `usuario.filiais`: o vínculo diz onde a
 * pessoa trabalha, e o ADMIN opera as 35 (o backend já aceita qualquer `filialId`
 * dele). Com o vínculo, um ADMIN de filial única ficava sem seletor, e filial ainda
 * SEM RDV era inalcançável — nenhuma filial nova saía do zero.
 *
 * Hook, e não cópia em cada aba: a regra estava escrita em DOIS lugares (Planejamentos
 * e Equipe) e as duas tinham o mesmo defeito. `carregado` existe porque quem resolve
 * filial automática precisa esperar a lista — alvo que o seletor não oferece é alvo
 * sem volta.
 */
function useFiliaisSelecionaveis(ehAdmin: boolean, vinculadas: FilialItem[]) {
  const [catalogo, setCatalogo] = useState<FilialItem[] | null>(null);
  const [carregado, setCarregado] = useState(false);
  useEffect(() => {
    if (!ehAdmin) { setCarregado(true); return; }
    coreApi.get<FilialItem[]>('/filiais')
      .then((r) => setCatalogo(r.data ?? []))
      .catch(() => setCatalogo(null)) // degrada para o vínculo, não fica sem nada
      .finally(() => setCarregado(true));
  }, [ehAdmin]);
  const filiais = (catalogo ?? vinculadas)
    .filter((f) => f.status !== 'INATIVO')
    .slice()
    .sort((a, b) => nomeFilial(a).localeCompare(nomeFilial(b), 'pt-BR'));
  return { filiais, carregado };
}
/** Quem responde por um departamento no RDV — antes isso era DERIVADO dos veículos que
 *  a pessoa supervisiona (`veiculo.supervisorId`), campo que existe para dizer quem
 *  responde pelo VEÍCULO. Agora é explícito aqui. */
interface RespDepto {
  departamentoId: string; departamentoNome: string;
  usuarioId: string | null; responsavelNome: string | null;
  representantes: number;
}
// Representantes do RDV cadastráveis na equipe:
// - SUPERVISOR de área  → roteia ao COORDENADOR (campo "Coordenador").
// - COORDENADOR         → roteia ao Supervisor de Departamento POR DEPARTAMENTO
//   (sem coordenador acima); precisa do registro p/ criar o próprio RDV.
const temRoleLogistica = (u: CoreUser, role: string) => (u.permissoes ?? []).some((p) => p.modulo.codigo === 'LOGISTICA' && p.roleModulo.codigo === role);
const ehSupervisorArea = (u: CoreUser) => temRoleLogistica(u, 'SUPERVISOR');
const ehCoordenador = (u: CoreUser) => temRoleLogistica(u, 'COORDENADOR');
const ehRepresentante = (u: CoreUser) => ehSupervisorArea(u) || ehCoordenador(u);

function EquipeTab() {
  const { toast } = useToast();
  const { usuario, temRole } = useAuth();
  const ehAdmin = temRole('ADMIN');
  const filialSessao = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';
  // ADMIN é global por política e a Equipe é tela de CONFIGURAÇÃO: ele escolhe a filial
  // aqui, sem trocar a filial da SESSÃO no Hub (seriam 35 idas e voltas). Os demais
  // papéis não veem o seletor e seguem a filial do token — o backend IGNORA o parâmetro
  // para eles, então isto é conveniência, não porta de escape.
  // Padrão do seletor: a filial onde o RDV realmente acontece — a filial principal do
  // ADMIN é a matriz administrativa, que não tem representante e abriria a tela vazia.
  // Resolvido pelo backend (`filiais-rdv`), não fixo no código: se outra filial começar a
  // usar o RDV, o padrão continua certo sozinho. A última escolha do admin tem
  // precedência (fica no navegador).
  const CHAVE_FILIAL = 'logistica:rdv:equipe:filial';
  const [filialAlvo, setFilialAlvo] = useState('');
  const filialId = ehAdmin ? (filialAlvo || filialSessao) : filialSessao;
  const qFilial = { params: { filialId } };
  const { filiais: filiaisSelecionaveis, carregado: filiaisCarregadas } =
    useFiliaisSelecionaveis(ehAdmin, usuario?.filiais ?? []);
  const [itens, setItens] = useState<Supervisor[]>([]);
  const [usuarios, setUsuarios] = useState<CoreUser[]>([]);
  const [departamentos, setDepartamentos] = useState<DeptItem[]>([]);
  // Falhas das buscas acessórias. Existe para a tela NÃO tratar "a chamada quebrou"
  // igual a "não há dado": eram indistinguíveis, e foi por isso que ninguém conseguia
  // dizer por que o seletor vinha vazio.
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const registrarFalha = useCallback((chave: string, msg: string | null) => {
    setFalhas((prev) => {
      if (!msg) { if (!(chave in prev)) return prev; const { [chave]: _, ...resto } = prev; return resto; }
      return prev[chave] === msg ? prev : { ...prev, [chave]: msg };
    });
  }, []);
  const deptErro = falhas['deptos'] ?? null;
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [usuarioId, setUsuarioId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [coordenadorId, setCoordenadorId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCoord, setEditCoord] = useState('');
  const [editDepto, setEditDepto] = useState('');
  // Amarração departamento → Supervisor de Departamento (fonte da autoridade no RDV).
  const [respDepto, setRespDepto] = useState<RespDepto[]>([]);
  const [editRespId, setEditRespId] = useState<string | null>(null); // departamentoId em edição
  const [editRespUser, setEditRespUser] = useState('');
  const [deptosFilial, setDeptosFilial] = useState<DeptItem[]>([]); // seletor "adicionar departamento"
  const [addDeptoId, setAddDeptoId] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [s, u, d, r, df] = await Promise.all([
        logisticaApi.get<Supervisor[]>('/supervisor/supervisores', qFilial),
        filialId ? coreApi.get<CoreUser[]>('/usuarios', { params: { filialId } }) : Promise.resolve({ data: [] as CoreUser[] }),
        // Departamentos que ESTE usuário pode escolher. Endpoint do RDV, que devolve
        // exatamente o que `assertPodeGerirDepartamento` aceita na escrita.
        // Antes vinha de `/frota/departamentos-filtro`, derivado do VEÍCULO: a tela
        // oferecia o que o POST recusava (403) e esvaziava quando a pessoa perdia o
        // último carro, mesmo com a autoridade do RDV intacta.
        // O erro NÃO vira lista vazia: `deptErro` distingue "não pode/não há" de "falhou".
        buscaAcessoria(logisticaApi.get<DeptItem[]>('/supervisor/departamentos-gerenciaveis', qFilial), [] as DeptItem[], 'deptos', 'os departamentos que você pode escolher', registrarFalha),
        // ⚠️ Esta lista vazia vira a frase "Nenhum departamento participa do RDV nesta
        // filial ainda". Se a chamada falhou, essa frase é MENTIRA — e foi exatamente o
        // que a tela mostrou durante a investigação de 11/09.
        buscaAcessoria(logisticaApi.get<RespDepto[]>('/supervisor/departamentos-responsavel', qFilial), [] as RespDepto[], 'resp', 'quem responde por cada departamento', registrarFalha),
        // Vazia, ESCONDE o seletor "adicionar departamento" — sumiço mudo.
        buscaAcessoria(logisticaApi.get<DeptItem[]>('/supervisor/departamentos-filial', qFilial), [] as DeptItem[], 'deptosFilial', 'os departamentos desta filial', registrarFalha),
      ]);
      setItens(s.data); setUsuarios(u.data); setDepartamentos(d.data); setRespDepto(r.data); setDeptosFilial(df.data);
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
  // Resolve a filial inicial UMA vez (só ADMIN): última escolhida → a filial da sessão
  // se ela tiver RDV → a filial com mais representantes → a da sessão.
  //
  // ⚠️ INVARIANTE: o alvo automático tem de estar entre as filiais que o SELETOR
  // oferece. Sem isso a tela levava o ADMIN para uma filial fora do alcance dele e não
  // havia caminho de volta — medido em 11/09/2026: conta `admin` (só filial 18) aberta
  // na filial 09, porque `filiais-rdv` faz groupBy GLOBAL e não cruza com o usuário. O
  // caminho da preferência salva já validava; o do auto-pick, não. Agora os dois validam
  // contra a mesma lista, e como ela é o catálogo, uma filial ZERADA é alcançável — que
  // era a trava: nenhuma filial nova conseguia sair do zero.
  useEffect(() => {
    if (!ehAdmin || !filiaisCarregadas) return;
    const alcancavel = (id?: string) => !!id && filiaisSelecionaveis.some((f) => f.id === id);
    const salva = localStorage.getItem(CHAVE_FILIAL);
    if (alcancavel(salva ?? undefined)) { setFilialAlvo(salva as string); return; }
    logisticaApi.get<{ filialId: string; representantes: number }[]>('/supervisor/filiais-rdv')
      .then((r) => {
        const comRdv = r.data ?? []; // já vem ordenado por representantes COM departamento
        // A FILIAL DA SESSÃO GANHA quando é alcançável — mudou aqui (11/09/2026).
        // Antes ela só ganhava se tivesse representante COM departamento; senão a tela
        // saltava para "onde o RDV acontece". O salto foi escrito para poupar o ADMIN da
        // matriz (que abria numa tela vazia), mas custava caro no caso oposto: quem
        // estava configurando a PRÓPRIA filial era mandado para outra e configurava sem
        // perceber. Tela de configuração abre onde você está; "vazia" agora se explica
        // sozinha (o bloco de departamentos diz que ninguém participa do RDV ainda) e o
        // seletor está à vista. O salto continua, só que como FALLBACK.
        const sugerida = comRdv.find((f) => alcancavel(f.filialId))?.filialId;
        setFilialAlvo(alcancavel(filialSessao) ? filialSessao : (sugerida ?? filialSessao));
      })
      .catch(() => setFilialAlvo(filialSessao));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdmin, filialSessao, filiaisCarregadas]);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filialId]);

  const nomeUser = (u: CoreUser) => u.nome ?? u.nomeFantasia ?? u.id;
  // Representantes DA FILIAL (SUPERVISOR de área OU COORDENADOR), ordenados por nome,
  // para escolher pelo NOME — quem monta o time (Supervisor de Departamento) sabe o
  // nome, não a matrícula. Matrícula e departamento vêm do cadastro do usuário.
  const representantes = usuarios.filter(ehRepresentante);
  const supSel = usuarios.find((u) => u.id === usuarioId);
  // Coordenador selecionado → roteia POR DEPARTAMENTO (sem coordenador acima).
  const selEhCoordenador = !!supSel && ehCoordenador(supSel);
  const escolherSupervisor = (uid: string) => {
    setUsuarioId(uid);
    const u = usuarios.find((x) => x.id === uid);
    // Coordenador não tem coordenador acima — limpa o vínculo ao selecioná-lo.
    if (u && ehCoordenador(u)) setCoordenadorId('');
    const dep = u?.departamento?.id; // default: o departamento do próprio representante
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
      await logisticaApi.post('/supervisor/supervisores', { matricula: u.matricula.trim(), nome: nomeUser(u), departamentoId: deptId, coordenadorId: coordenadorId || undefined }, qFilial);
      toast('success', 'Supervisor de área cadastrado.');
      setShowForm(false); setUsuarioId(''); setDeptId(''); setCoordenadorId('');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao cadastrar.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async (id: string) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${id}`, { departamentoId: editDepto, coordenadorId: editCoord }, qFilial); toast('success', 'Cadastro atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  // Exclusão definitiva do cadastro. Só chega aqui quem não tem movimento (a API confere
  // de novo). O diálogo diz o que se perde E o que NÃO se perde — o cadastro some, a
  // pessoa e a permissão dela no Configurador ficam intactas.
  const excluir = async (s: Supervisor) => {
    if (!window.confirm(
      `Excluir o cadastro de ${s.nome} (${s.matricula}) no RDV desta filial?\n\n` +
      `Isto apaga o registro do time — a matrícula fica livre para ser cadastrada de novo.\n` +
      `NÃO mexe no usuário nem na permissão dele no Configurador.\n\n` +
      `Se a intenção é só tirar das telas mantendo o histórico, use Inativar.`,
    )) return;
    try { await logisticaApi.delete(`/supervisor/supervisores/${s.id}`, qFilial); toast('success', 'Cadastro excluído.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao excluir.')); }
  };
  const toggle = async (s: Supervisor) => {
    try { await logisticaApi.patch(`/supervisor/supervisores/${s.id}`, { ativo: !s.ativo }, qFilial); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  // Amarração departamento → responsável. Escrita SÓ ADMIN (o backend barra): esta é a
  // fonte da autoridade do Supervisor de Departamento; se ele mesmo editasse,
  // se acrescentaria em qualquer departamento e aprovaria a prestação de contas alheia.
  const salvarResponsavel = async (departamentoId: string) => {
    if (!editRespUser) { toast('warning', 'Selecione o responsável.'); return; }
    try {
      await logisticaApi.put(`/supervisor/departamentos-responsavel/${departamentoId}`, { usuarioId: editRespUser }, qFilial);
      toast('success', 'Responsável pelo departamento definido.');
      setEditRespId(null); setEditRespUser(''); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao definir o responsável.')); }
  };
  const limparResponsavel = async (departamentoId: string) => {
    try {
      await logisticaApi.delete(`/supervisor/departamentos-responsavel/${departamentoId}`, qFilial);
      toast('success', 'Responsável removido — o departamento fica sem aprovador até você definir outro.');
      await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao remover.')); }
  };
  // Candidatos: quem tem o papel Supervisor de Departamento na Logística.
  const candidatosResp = usuarios.filter((u) => temRoleLogistica(u, 'SUPERVISOR_FROTA'));

  return (
    <div>
      <AvisoFalhasCarga falhas={falhas} />
      {/* ADMIN opera a aba em qualquer filial sem trocar a da sessão. As DUAS listas
          (departamentos e representantes) seguem este seletor.
          Renderiza para TODO ADMIN — não mais só quando ele tem >1 filial vinculada.
          Aquela condição escondia o seletor justamente do ADMIN de filial única, que é
          quem não tinha como voltar quando a tela mudava de filial sozinha. */}
      {ehAdmin && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Filial:</label>
          <select value={filialId} onChange={(e) => { setFilialAlvo(e.target.value); localStorage.setItem(CHAVE_FILIAL, e.target.value); }} className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500">
            {filiaisSelecionaveis.map((f) => <option key={f.id} value={f.id}>{nomeFilial(f)}{f.id === filialSessao ? ' (sua filial)' : ''}</option>)}
          </select>
          {/* A tela pode abrir numa filial diferente da sessão (o padrão vai para onde o
              RDV acontece). Isso nunca pode ser SILENCIOSO: sem esta linha o ADMIN
              configurava uma filial achando que era outra. */}
          {filialId && filialId !== filialSessao ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Você está vendo outra filial — a da sua sessão é {nomeFilial(filiaisSelecionaveis.find((f) => f.id === filialSessao) ?? { id: filialSessao })}
            </span>
          ) : (
            <span className="text-xs text-slate-400">A filial da sua sessão não muda.</span>
          )}
        </div>
      )}

      {/* Quem responde por cada departamento no RDV. Antes isso era DEDUZIDO dos veículos
          que a pessoa supervisiona — campo da frota, cujo sentido é "responsável pelo
          veículo". Ficar sem veículo tirava a autoridade sobre o RDV em silêncio.
          Lista só os departamentos que PARTICIPAM do RDV nesta filial (com representante
          ou já com responsável): `core.departamentos` é POR FILIAL e tem nomes repetidos
          — "Agroveterinaria" existe em 16 filiais —, então o catálogo inteiro virava
          dezenas de linhas indistinguíveis e uma parede de "sem responsável". */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Supervisores de Departamento</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Quem aprova a prestação de contas de cada departamento (e o RDV dos coordenadores dele).
          Aparecem os departamentos desta filial com representante cadastrado ou com responsável já definido.
          {ehAdmin ? '' : ' Definido pela administração — aqui é só consulta.'}
        </p>
        {/* A lista vazia só pode virar a AFIRMAÇÃO "nenhum departamento participa" se a
            busca tiver dado certo. Com ela falhando, a frase é uma mentira sobre o banco
            — e foi essa frase que a tela mostrou durante a investigação, mandando
            "cadastre representantes abaixo" numa filial que nem estava carregada. */}
        {falhas['resp'] ? (
          <p className="text-sm text-amber-700">Não deu para saber quais departamentos participam do RDV nesta filial — a consulta falhou (veja o aviso acima). Recarregue antes de concluir que não há nenhum.</p>
        ) : respDepto.length === 0 ? (
          /* O texto anterior mandava "cadastre representantes abaixo" — justamente o
             ato que a API recusa enquanto não existe amarração (403 "Departamento fora
             do seu escopo"). Texto que promete capacidade empurra de volta ao erro com
             a autoridade do sistema. Agora diz o 1º passo REAL, e ele é DIFERENTE por
             perfil: o ADMIN cria a amarração; os demais dependem dela. */
          ehAdmin ? (
            <p className="text-sm text-slate-500">Nenhum departamento participa do RDV nesta filial ainda. Comece <b>abaixo</b>: escolha o departamento e defina quem responde por ele — só depois é possível cadastrar representantes.</p>
          ) : (
            <p className="text-sm text-slate-500">Nenhum departamento participa do RDV nesta filial ainda. Quem define isso é a <b>administração</b>; enquanto não houver, não é possível cadastrar representantes.</p>
          )
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead><tr><th className={th}>Departamento</th><th className={th}>Representantes</th><th className={th}>Responsável</th>{ehAdmin && <th className={th}>Ações</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {respDepto.map((r) => (
                <tr key={r.departamentoId}>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.departamentoNome}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{r.representantes}</td>
                  <td className="px-4 py-3 text-sm">
                    {editRespId === r.departamentoId ? (
                      <select value={editRespUser} onChange={(e) => setEditRespUser(e.target.value)} className={inp}>
                        <option value="">— selecione</option>
                        {candidatosResp.map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}</option>)}
                      </select>
                    ) : r.responsavelNome ? (
                      <span className="text-slate-700">{r.responsavelNome}</span>
                    ) : r.representantes > 0 ? (
                      // Sem aprovador COM gente no departamento: trava a prestação de contas — aí sim é alarme.
                      <span className="text-rose-600">— sem responsável ({r.representantes} representante(s) sem aprovador)</span>
                    ) : (
                      <span className="text-slate-400">— sem responsável</span>
                    )}
                  </td>
                  {ehAdmin && (
                    <td className="px-4 py-3 text-sm">
                      {editRespId === r.departamentoId ? (
                        <div className="flex gap-2">
                          <button onClick={() => void salvarResponsavel(r.departamentoId)} className="text-emerald-600 hover:text-emerald-700" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => { setEditRespId(null); setEditRespUser(''); }} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={() => { setEditRespId(r.departamentoId); setEditRespUser(r.usuarioId ?? ''); }} className="text-xs text-capul-600 hover:underline">{r.usuarioId ? 'Trocar' : 'Definir'}</button>
                          {r.usuarioId && <button onClick={() => void limparResponsavel(r.departamentoId)} className="text-xs text-rose-500 hover:underline">Remover</button>}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Adiantar a amarração de um departamento que ainda não tem representante.
            Só os DESTA filial — o backend recusa departamento de outra. */}
        {ehAdmin && deptosFilial.length > 0 && (
          <div className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
            <div className="w-80">
              <label className="mb-1 block text-xs font-medium text-slate-600">{respDepto.length === 0 ? 'Adicionar o primeiro departamento desta filial' : 'Adicionar outro departamento desta filial'}</label>
              <select value={addDeptoId} onChange={(e) => setAddDeptoId(e.target.value)} className={inp}>
                <option value="">— selecione</option>
                {deptosFilial.filter((d) => !respDepto.some((r) => r.departamentoId === d.id)).map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <button
              onClick={() => {
                if (!addDeptoId) { toast('warning', 'Selecione o departamento.'); return; }
                const dep = deptosFilial.find((d) => d.id === addDeptoId);
                setRespDepto((prev) => [...prev, { departamentoId: addDeptoId, departamentoNome: dep?.nome ?? addDeptoId, usuarioId: null, responsavelNome: null, representantes: 0 }]);
                setEditRespId(addDeptoId); setEditRespUser(''); setAddDeptoId('');
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Adicionar</button>
          </div>
        )}
      </div>

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Monte o time: cadastre os <b>supervisores de área</b> (roteiam ao seu <b>coordenador</b>) e os <b>coordenadores</b> (roteiam ao <b>Supervisor de Departamento</b>, por departamento) — o cadastro é o que permite criar e aprovar planejamentos/despesas.</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700"><Plus className="h-4 w-4" /> Novo cadastro</button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Supervisor de área ou Coordenador *</label>
              <select value={usuarioId} onChange={(e) => escolherSupervisor(e.target.value)} className={inp}>
                <option value="">— selecione pelo nome</option>
                {representantes.map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}{ehCoordenador(u) ? ' (coordenador)' : ''}{u.matricula ? ` · ${u.matricula}` : ''}</option>)}
              </select>
              {representantes.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700">Nenhum usuário com o papel <b>Supervisor de Área</b> ou <b>Coordenador</b> nesta filial. Atribua o papel no Configurador primeiro.</p>
              ) : supSel && !supSel.matricula ? (
                <p className="mt-1 text-xs text-rose-600">Sem matrícula (chapa) no cadastro — ajuste no Configurador para usar no RDV.</p>
              ) : selEhCoordenador ? (
                <p className="mt-1 text-xs text-slate-500"><b>Coordenador</b>: roteia ao Supervisor de Departamento pelo <b>departamento</b> (sem coordenador acima).</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Escolha pelo <b>nome</b>. A matrícula e o departamento vêm do cadastro dele — ajuste o departamento se precisar.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Departamento *</label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inp} disabled={departamentos.length === 0}>
                <option value="">— selecione</option>
                {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              {/* Campo vazio TEM de dizer por quê. Antes ficava só com "— selecione", e
                  falha de rede, 403 e "não há departamento" eram a mesma tela — o motivo
                  pelo qual o defeito original levou dois dias para ser nomeado. */}
              {deptErro ? (
                <p className="mt-1 text-xs text-rose-600">{deptErro}</p>
              ) : departamentos.length === 0 ? (
                ehAdmin ? (
                  <p className="mt-1 text-xs text-amber-700">Esta filial não tem departamento cadastrado. Cadastre em <b>Configurador → Departamentos</b>.</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">Nenhum departamento seu participa do RDV nesta filial. A administração precisa definir você como <b>responsável</b> por um departamento (bloco acima) antes de você montar o time.</p>
                )
              ) : null}
            </div>
            {!selEhCoordenador && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Coordenador</label>
              <select value={coordenadorId} onChange={(e) => { const cid = e.target.value; setCoordenadorId(cid); if (!deptId) { const dep = deptDoCoord(cid); if (dep) setDeptId(dep); } }} className={inp}>
                <option value="">— (sem coordenador)</option>
                {usuarios.filter(ehCoordenador).map((u) => <option key={u.id} value={u.id}>{nomeUser(u)}</option>)}
              </select>
            </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Cadastrar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading && itens.length === 0 ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
        <div className="py-12 text-center"><Users className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">Nenhum supervisor cadastrado</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            {/* O papel não é do cadastro do RDV — vem da role no módulo (Configurador).
                Mostrá-lo aqui é o que dá sentido à coluna Coordenador: supervisor de
                área responde a um coordenador; coordenador responde ao departamento. */}
            <thead><tr className="bg-slate-50"><th className={th}>Matrícula</th><th className={th}>Nome</th><th className={th}>Papel</th><th className={th}>Departamento</th><th className={th}>Coordenador</th><th className={th}>Status</th><th className={th}>Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-700">{s.matricula}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{s.nome}</td>
                  <td className="px-4 py-3 text-slate-500">{papelLabel(s.papel)}</td>
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
                        {/* Excluir aparece SEMPRE; quando não dá, vem desabilitado COM o
                            motivo no title — esconder deixaria o usuário procurando uma
                            saída que existe. Só cadastro sem movimento some de vez; com
                            histórico, a saída é Inativar (a API recusa e explica). */}
                        {(s.movimentos ?? 0) > 0 ? (
                          <span
                            className="cursor-not-allowed text-xs text-slate-300"
                            title={`Não pode ser excluído: já tem ${s.movimentos} ${s.movimentos === 1 ? 'registro' : 'registros'} no RDV. Use Inativar — ele sai das telas e o histórico fica.`}
                          >Excluir</span>
                        ) : (
                          <button onClick={() => void excluir(s)} className="text-xs text-rose-500 hover:underline">Excluir</button>
                        )}
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
      {loading && itens.length === 0 ? <div className="py-12 text-center text-slate-500">Carregando…</div> : itens.length === 0 ? (
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
  const { temRole } = useAuth();
  const navigate = useNavigate();
  // Supervisor de área: auto-serviço — fixa o SEU cadastro (sem seletor, sem encerrar mês).
  const ehSupervisorArea = temRole('SUPERVISOR');
  const [sups, setSups] = useState<SupItem[]>([]);
  // undefined = carregando o próprio cadastro · null = ainda não montado no time.
  const [meuCadastro, setMeuCadastro] = useState<SupItem | null | undefined>(ehSupervisorArea ? undefined : null);
  const [supId, setSupId] = useState('');
  // Mês corrente já selecionado: a aba abria em branco e não carregava nada até o
  // usuário escolher o mês na mão — sendo que o RDV consultado é quase sempre o do mês
  // em curso. Continua editável. (Mesmo padrão do "Novo planejamento".)
  const [mesInput, setMesInput] = useState(mesCorrente);
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
          ? <><b>Seus adiantamentos e a sua RDV do mês.</b> Quem lança o adiantamento é o seu coordenador (ou o supervisor de departamento) — aqui você acompanha. Ao lado, a sua RDV agregada (saldo = adiantamentos − despesas aprovadas). O encerramento do mês também é feito pelo coordenador.</>
          : <>Adiantamentos e RDV do mês, por supervisor. <b>Lance o adiantamento a qualquer momento</b> — antes, durante ou depois da viagem (pode haver vários no mês). Ao lado, a RDV agregada do mês (saldo = adiantamentos − despesas aprovadas) e o <b>encerramento</b> do mês (ao final, trava lançamentos).</>}
      </p>
      {ehSupervisorArea && meuCadastro === null ? (
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">Seu cadastro de supervisor de área ainda não foi montado no time desta filial (ou seu login não tem matrícula). Peça ao Supervisor de Departamento para te cadastrar com um coordenador — depois seus adiantamentos e sua RDV aparecem aqui.</p>
      ) : (
      <>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Representante</label>
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
          <MesRefField value={mesInput} onChange={setMesInput} />
        </div>
      </div>

      {supId && mes ? (
        loading && adiantamentos.length === 0 ? <div className="py-8 text-center text-slate-500">Carregando…</div> : (
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
                        {/* O4: com o mês ENCERRADO a API recusa remover (400) — o link
                            não pode continuar convidando. */}
                        <td className="py-2 text-right">{!ehSupervisorArea && !rdv?.fechado && <button onClick={() => void remover(a.id)} className="text-xs text-rose-600 hover:underline">Remover</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Lançar adiantamento é de quem APROVA o representante (01/08): saiu do app
                  em 27/07 e agora sai do desktop — ninguém lança o próprio. O supervisor
                  de área continua vendo os dele. */}
              {ehSupervisorArea ? (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  O adiantamento é lançado pelo seu coordenador (ou pelo supervisor de departamento) — peça a ele.
                </p>
              ) : rdv?.fechado ? (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-amber-700">
                  🔒 Mês encerrado — para lançar adiantamento, reabra o mês no painel ao lado.
                </p>
              ) : (
              <form onSubmit={lancar} className="mt-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <MoedaInput value={valor} onChange={setValor} placeholder="Valor R$ 0,00" className={inp} />
                  <DataInput value={data} onChange={setData} className={inp} />
                </div>
                <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" maxLength={255} className={`${inp} mt-2`} />
                <button type="submit" className="mt-2 rounded-lg bg-capul-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-capul-700">Lançar adiantamento</button>
              </form>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">RDV do mês (agregada)</h3>
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate(`/supervisores/rdv-mensal/${supId}/${mes}`)} className="inline-flex items-center gap-1 text-xs text-capul-600 hover:underline"><Printer className="h-3.5 w-3.5" /> Imprimir RDV</button>
                  <button onClick={() => navigate(`/supervisores/rdv-mensal/${supId}/${mes}/visitas`)} className="inline-flex items-center gap-1 text-xs text-capul-600 hover:underline"><Printer className="h-3.5 w-3.5" /> Imprimir Visitas</button>
                </div>
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
