import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { projetoService } from '../../services/projeto.service';
import { chamadoService } from '../../services/chamado.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft, Pencil, FolderKanban, Users, Clock, DollarSign, Plus, Trash2, AlertTriangle, Link2, Paperclip, Ticket, ExternalLink, Play, Square, ChevronDown, ChevronRight, Check, X, Edit3, Search, Unlink } from 'lucide-react';
import type {
  Projeto,
  MembroProjeto,
  FaseProjeto,
  AtividadeProjeto,
  CustosConsolidados,
  CotacaoProjeto,
  CustoProjeto,
  RiscoProjeto,
  DependenciaProjeto,
  AnexoProjeto,
  Chamado,
  StatusProjeto,
  StatusCotacao,
  CategoriaCusto,
  ProbabilidadeRisco,
  ImpactoRisco,
  StatusRisco,
  TipoDependencia,
  TipoAnexo,
  PapelRaci,
  StatusFase,
  UsuarioCore,
  RegistroTempo,
} from '../../types';

const statusLabel: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em Andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluido',
  CANCELADO: 'Cancelado',
};

const statusCores: Record<string, string> = {
  PLANEJAMENTO: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  PAUSADO: 'bg-orange-100 text-orange-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-slate-100 text-slate-600',
};

const tipoLabel: Record<string, string> = {
  DESENVOLVIMENTO_INTERNO: 'Desenv. Interno',
  IMPLANTACAO_TERCEIRO: 'Implantacao',
  INFRAESTRUTURA: 'Infraestrutura',
  OUTRO: 'Outro',
};

const modoLabel: Record<string, string> = {
  SIMPLES: 'Simples',
  COMPLETO: 'Completo',
};

const papelLabel: Record<string, string> = {
  RESPONSAVEL: 'Responsavel',
  APROVADOR: 'Aprovador',
  CONSULTADO: 'Consultado',
  INFORMADO: 'Informado',
};

const papelCores: Record<string, string> = {
  RESPONSAVEL: 'bg-capul-100 text-capul-700',
  APROVADOR: 'bg-blue-100 text-blue-700',
  CONSULTADO: 'bg-amber-100 text-amber-700',
  INFORMADO: 'bg-slate-100 text-slate-600',
};

const faseStatusLabel: Record<string, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em Andamento',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
};

const faseStatusCores: Record<string, string> = {
  PENDENTE: 'bg-slate-100 text-slate-600',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  APROVADA: 'bg-green-100 text-green-700',
  REJEITADA: 'bg-red-100 text-red-700',
};

const cotacaoStatusLabel: Record<string, string> = {
  RASCUNHO: 'Rascunho', SOLICITADA: 'Solicitada', RECEBIDA: 'Recebida', APROVADA: 'Aprovada', REJEITADA: 'Rejeitada',
};
const cotacaoStatusCores: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-600', SOLICITADA: 'bg-blue-100 text-blue-700', RECEBIDA: 'bg-yellow-100 text-yellow-700', APROVADA: 'bg-green-100 text-green-700', REJEITADA: 'bg-red-100 text-red-700',
};

const categoriaLabel: Record<string, string> = {
  MAO_DE_OBRA: 'Mao de Obra', INFRAESTRUTURA: 'Infraestrutura', LICENCIAMENTO: 'Licenciamento', CONSULTORIA: 'Consultoria', TREINAMENTO: 'Treinamento', VIAGEM: 'Viagem', MATERIAL: 'Material', OUTRO: 'Outro',
};
const categoriaCores: Record<string, string> = {
  MAO_DE_OBRA: 'bg-capul-100 text-capul-700', INFRAESTRUTURA: 'bg-blue-100 text-blue-700', LICENCIAMENTO: 'bg-cyan-100 text-cyan-700', CONSULTORIA: 'bg-amber-100 text-amber-700', TREINAMENTO: 'bg-green-100 text-green-700', VIAGEM: 'bg-orange-100 text-orange-700', MATERIAL: 'bg-slate-100 text-slate-700', OUTRO: 'bg-slate-100 text-slate-600',
};

const probabilidadeLabel: Record<string, string> = {
  MUITO_BAIXA: 'Muito Baixa', BAIXA: 'Baixa', MEDIA: 'Media', ALTA: 'Alta', MUITO_ALTA: 'Muito Alta',
};
const probabilidadeCores: Record<string, string> = {
  MUITO_BAIXA: 'bg-green-100 text-green-700', BAIXA: 'bg-lime-100 text-lime-700', MEDIA: 'bg-yellow-100 text-yellow-700', ALTA: 'bg-orange-100 text-orange-700', MUITO_ALTA: 'bg-red-100 text-red-700',
};

const impactoLabel: Record<string, string> = {
  MUITO_BAIXO: 'Muito Baixo', BAIXO: 'Baixo', MEDIO: 'Medio', ALTO: 'Alto', MUITO_ALTO: 'Muito Alto',
};
const impactoCores: Record<string, string> = {
  MUITO_BAIXO: 'bg-green-100 text-green-700', BAIXO: 'bg-lime-100 text-lime-700', MEDIO: 'bg-yellow-100 text-yellow-700', ALTO: 'bg-orange-100 text-orange-700', MUITO_ALTO: 'bg-red-100 text-red-700',
};

const riscoStatusLabel: Record<string, string> = {
  IDENTIFICADO: 'Identificado', EM_ANALISE: 'Em Analise', MITIGANDO: 'Mitigando', ACEITO: 'Aceito', RESOLVIDO: 'Resolvido',
};
const riscoStatusCores: Record<string, string> = {
  IDENTIFICADO: 'bg-blue-100 text-blue-700', EM_ANALISE: 'bg-yellow-100 text-yellow-700', MITIGANDO: 'bg-orange-100 text-orange-700', ACEITO: 'bg-slate-100 text-slate-600', RESOLVIDO: 'bg-green-100 text-green-700',
};

const dependenciaLabel: Record<string, string> = {
  BLOQUEIO: 'Bloqueio', PREDECESSOR: 'Predecessor', SUCESSOR: 'Sucessor', RELACIONADO: 'Relacionado',
};
const dependenciaCores: Record<string, string> = {
  BLOQUEIO: 'bg-red-100 text-red-700', PREDECESSOR: 'bg-orange-100 text-orange-700', SUCESSOR: 'bg-blue-100 text-blue-700', RELACIONADO: 'bg-slate-100 text-slate-600',
};

const anexoTipoLabel: Record<string, string> = {
  DOCUMENTO: 'Documento', PLANILHA: 'Planilha', IMAGEM: 'Imagem', LINK: 'Link', OUTRO: 'Outro',
};

const chamadoStatusLabel: Record<string, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente', RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado',
};
const chamadoStatusCores: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700', PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700', FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-700',
};

const prioridadeLabel: Record<string, string> = {
  BAIXA: 'Baixa', MEDIA: 'Media', ALTA: 'Alta', CRITICA: 'Critica',
};

type Tab = 'subprojetos' | 'equipe' | 'atividades' | 'financeiro' | 'riscos' | 'dependencias' | 'anexos' | 'chamados';

export function ProjetoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole, usuario } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const canAddAtividade = ['ADMIN', 'GESTOR_TI', 'TECNICO'].includes(gestaoTiRole || '');

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('subprojetos');
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    if (id) loadProjeto();
  }, [id]);

  async function loadProjeto() {
    setLoading(true);
    try {
      const data = await projetoService.buscar(id!);
      setProjeto(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleStatusChange(newStatus: StatusProjeto) {
    if (!projeto || statusChanging) return;
    setStatusChanging(true);
    try {
      const updated = await projetoService.atualizar(projeto.id, { status: newStatus });
      setProjeto(updated);
    } catch { /* empty */ }
    setStatusChanging(false);
  }

  if (loading) {
    return (
      <>
        <Header title="Projeto" />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  if (!projeto) {
    return (
      <>
        <Header title="Projeto" />
        <div className="p-6"><p className="text-slate-500">Projeto nao encontrado</p></div>
      </>
    );
  }

  const showEquipeTab = projeto.modo === 'COMPLETO' || projeto.nivel === 1;
  const isCompleto = projeto.modo === 'COMPLETO';

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'subprojetos', label: 'Sub-projetos', icon: FolderKanban },
    ...(showEquipeTab ? [{ key: 'equipe' as Tab, label: 'Equipe', icon: Users }] : []),
    { key: 'atividades', label: 'Atividades', icon: Clock },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    ...(isCompleto ? [{ key: 'riscos' as Tab, label: 'Riscos', icon: AlertTriangle }] : []),
    ...(isCompleto ? [{ key: 'dependencias' as Tab, label: 'Dependencias', icon: Link2 }] : []),
    { key: 'anexos', label: 'Anexos', icon: Paperclip },
    { key: 'chamados', label: 'Chamados', icon: Ticket },
  ];

  return (
    <>
      <Header title={`Projeto #${projeto.numero}`} />
      <div className="p-6">
        <button onClick={() => navigate('/gestao-ti/projetos')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-slate-800">{projeto.nome}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCores[projeto.status]}`}>
                  {statusLabel[projeto.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{tipoLabel[projeto.tipo]}</span>
                <span className="bg-capul-50 text-capul-600 px-2 py-0.5 rounded text-xs">{modoLabel[projeto.modo]}</span>
                <span className="text-xs">Nivel {projeto.nivel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && !['CONCLUIDO', 'CANCELADO'].includes(projeto.status) && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleStatusChange(e.target.value as StatusProjeto);
                  }}
                  disabled={statusChanging}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Alterar Status...</option>
                  {Object.entries(statusLabel)
                    .filter(([k]) => k !== projeto.status)
                    .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              {canManage && (
                <Link
                  to={`/gestao-ti/projetos/${projeto.id}/editar`}
                  className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Responsavel</p>
              <p className="text-slate-800 font-medium">{projeto.responsavel.nome}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Software</p>
              <p className="text-slate-800">{projeto.software ? (
                <Link to={`/gestao-ti/softwares/${projeto.software.id}`} className="text-capul-600 hover:underline">
                  {projeto.software.nome}
                </Link>
              ) : '-'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Contrato</p>
              <p className="text-slate-800">{projeto.contrato ? (
                <Link to={`/gestao-ti/contratos/${projeto.contrato.id}`} className="text-capul-600 hover:underline">
                  #{projeto.contrato.numero} - {projeto.contrato.titulo}
                </Link>
              ) : '-'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Periodo</p>
              <p className="text-slate-800">
                {projeto.dataInicio ? new Date(projeto.dataInicio).toLocaleDateString('pt-BR') : '?'}
                {' — '}
                {projeto.dataFimReal
                  ? new Date(projeto.dataFimReal).toLocaleDateString('pt-BR')
                  : projeto.dataFimPrevista
                  ? new Date(projeto.dataFimPrevista).toLocaleDateString('pt-BR') + ' (prev.)'
                  : '?'}
              </p>
            </div>
          </div>

          {projeto.descricao && (
            <p className="mt-4 text-sm text-slate-600">{projeto.descricao}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.key
                    ? 'border-capul-600 text-capul-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {tab === 'subprojetos' && (
          <TabSubProjetos projeto={projeto} canManage={canManage} />
        )}
        {tab === 'equipe' && showEquipeTab && (
          <TabEquipe projetoId={projeto.id} canManage={canManage} />
        )}
        {tab === 'atividades' && (
          <TabCronograma projetoId={projeto.id} isCompleto={isCompleto} canManage={canManage} canAdd={canAddAtividade} userId={usuario?.id || ''} />
        )}
        {tab === 'financeiro' && (
          <TabFinanceiro projetoId={projeto.id} projeto={projeto} canManage={canManage} />
        )}
        {tab === 'riscos' && isCompleto && (
          <TabRiscos projetoId={projeto.id} canManage={canManage} />
        )}
        {tab === 'dependencias' && isCompleto && (
          <TabDependencias projetoId={projeto.id} canManage={canManage} />
        )}
        {tab === 'anexos' && (
          <TabAnexos projetoId={projeto.id} canAdd={canAddAtividade} canManage={canManage} />
        )}
        {tab === 'chamados' && (
          <TabChamados projetoId={projeto.id} canManage={canManage} />
        )}
      </div>
    </>
  );
}

// --- Tab Sub-projetos ---
function TabSubProjetos({ projeto, canManage }: { projeto: Projeto; canManage: boolean }) {
  const subs = projeto.subProjetos || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Sub-projetos ({subs.length})</h4>
        {canManage && projeto.nivel < 3 && (
          <Link
            to={`/gestao-ti/projetos/novo?projetoPaiId=${projeto.id}`}
            className="flex items-center gap-1 text-sm text-capul-600 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Novo Sub-projeto
          </Link>
        )}
      </div>
      {subs.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum sub-projeto</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {subs.map((s) => (
            <div key={s.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">#{s.numero}</span>
                <Link to={`/gestao-ti/projetos/${s.id}`} className="text-sm text-capul-600 hover:underline font-medium">
                  {s.nome}
                </Link>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusCores[s.status]}`}>
                  {statusLabel[s.status]}
                </span>
              </div>
              <span className="text-xs text-slate-400">{modoLabel[s.modo]} — N{s.nivel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Equipe ---
function TabEquipe({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { confirm } = useToast();
  const [membros, setMembros] = useState<MembroProjeto[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [novoUsuarioId, setNovoUsuarioId] = useState('');
  const [novoPapel, setNovoPapel] = useState<PapelRaci>('RESPONSAVEL');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembros();
    coreService.listarUsuarios().then(setUsuarios).catch(() => {});
  }, [projetoId]);

  async function loadMembros() {
    setLoading(true);
    try {
      const data = await projetoService.listarMembros(projetoId);
      setMembros(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleAdd() {
    if (!novoUsuarioId || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarMembro(projetoId, { usuarioId: novoUsuarioId, papel: novoPapel });
      setShowForm(false);
      setNovoUsuarioId('');
      loadMembros();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleRemove(membroId: string) {
    if (!await confirm('Remover Membro', 'Deseja remover este membro do projeto?')) return;
    try {
      await projetoService.removerMembro(projetoId, membroId);
      loadMembros();
    } catch { /* empty */ }
  }

  const membrosIds = new Set(membros.map((m) => m.usuarioId));
  const availableUsers = usuarios.filter((u) => !membrosIds.has(u.id));

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Equipe RACI ({membros.length})</h4>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Adicionar Membro
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end">
          <select value={novoUsuarioId} onChange={(e) => setNovoUsuarioId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Selecione usuario...</option>
            {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as PapelRaci)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {Object.entries(papelLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={handleAdd} disabled={!novoUsuarioId || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
            Adicionar
          </button>
          <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : membros.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum membro</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {membros.map((m) => (
            <div key={m.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700 font-medium">{m.usuario.nome}</span>
                <span className="text-xs text-slate-400">{m.usuario.username}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${papelCores[m.papel]}`}>
                  {papelLabel[m.papel]}
                </span>
              </div>
              {canManage && (
                <button onClick={() => handleRemove(m.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Atividades (Fases + Atividades + Registros de Tempo) ---
function TabCronograma({ projetoId, isCompleto, canManage, canAdd, userId }: { projetoId: string; isCompleto: boolean; canManage: boolean; canAdd: boolean; userId: string }) {
  const { confirm } = useToast();
  const [fases, setFases] = useState<FaseProjeto[]>([]);
  const [atividades, setAtividades] = useState<AtividadeProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  // Fase form
  const [showFaseForm, setShowFaseForm] = useState(false);
  const [novoNomeFase, setNovoNomeFase] = useState('');
  const [novaOrdemFase, setNovaOrdemFase] = useState('');
  // Atividade form
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaFaseId, setNovaFaseId] = useState('');
  const [saving, setSaving] = useState(false);
  // Expanded atividade
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroTempo[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<string | null>(null);
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editObs, setEditObs] = useState('');
  // Fases colapsadas
  const [collapsedFases, setCollapsedFases] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, a] = await Promise.all([
        isCompleto ? projetoService.listarFases(projetoId) : Promise.resolve([]),
        projetoService.listarAtividades(projetoId),
      ]);
      setFases(f);
      setAtividades(a);
    } catch { /* empty */ }
    setLoading(false);
  }, [projetoId, isCompleto]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // --- Fases ---
  async function handleAddFase() {
    if (!novoNomeFase || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarFase(projetoId, { nome: novoNomeFase, ordem: Number(novaOrdemFase) || fases.length + 1 });
      setShowFaseForm(false); setNovoNomeFase(''); setNovaOrdemFase('');
      loadAll();
    } catch { /* empty */ }
    setSaving(false);
  }
  async function handleFaseStatusChange(faseId: string, status: StatusFase) {
    try { await projetoService.atualizarFase(projetoId, faseId, { status } as never); loadAll(); } catch { /* empty */ }
  }
  async function handleRemoveFase(faseId: string) {
    if (!await confirm('Remover Fase', 'Deseja remover esta fase e desassociar suas atividades?', { variant: 'danger' })) return;
    try { await projetoService.removerFase(projetoId, faseId); loadAll(); } catch { /* empty */ }
  }
  function toggleFase(faseId: string) {
    setCollapsedFases((prev) => { const n = new Set(prev); if (n.has(faseId)) n.delete(faseId); else n.add(faseId); return n; });
  }

  // --- Atividades ---
  async function handleAddAtividade() {
    if (!novoTitulo || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarAtividade(projetoId, { titulo: novoTitulo, descricao: novaDescricao || undefined, faseId: novaFaseId || undefined });
      setNovoTitulo(''); setNovaDescricao(''); setNovaFaseId('');
      loadAll();
    } catch { /* empty */ }
    setSaving(false);
  }
  async function handleIniciar(atividadeId: string) {
    try { await projetoService.iniciarTempo(projetoId, atividadeId); loadAll(); if (expandedId === atividadeId) loadRegistros(atividadeId); } catch { /* empty */ }
  }
  async function handleEncerrar(atividadeId: string) {
    try { await projetoService.encerrarTempo(projetoId, atividadeId); loadAll(); if (expandedId === atividadeId) loadRegistros(atividadeId); } catch { /* empty */ }
  }
  async function loadRegistros(atividadeId: string) {
    setLoadingRegistros(true);
    try { setRegistros(await projetoService.listarRegistrosTempo(projetoId, atividadeId)); } catch { setRegistros([]); }
    setLoadingRegistros(false);
  }
  function toggleExpand(atividadeId: string) {
    if (expandedId === atividadeId) { setExpandedId(null); return; }
    setExpandedId(atividadeId); setEditingRegistro(null); loadRegistros(atividadeId);
  }
  function startEdit(r: RegistroTempo) {
    setEditingRegistro(r.id); setEditInicio(r.horaInicio ? r.horaInicio.substring(0, 16) : ''); setEditFim(r.horaFim ? r.horaFim.substring(0, 16) : ''); setEditObs(r.observacoes || '');
  }
  async function handleSaveEdit(registroId: string) {
    try {
      await projetoService.ajustarRegistroTempo(projetoId, registroId, { horaInicio: editInicio ? new Date(editInicio).toISOString() : undefined, horaFim: editFim ? new Date(editFim).toISOString() : undefined, observacoes: editObs || undefined });
      setEditingRegistro(null); if (expandedId) loadRegistros(expandedId); loadAll();
    } catch { /* empty */ }
  }
  async function handleRemoveRegistro(registroId: string) {
    if (!await confirm('Remover Registro', 'Deseja remover este registro de tempo?')) return;
    try { await projetoService.removerRegistroTempo(projetoId, registroId); if (expandedId) loadRegistros(expandedId); loadAll(); } catch { /* empty */ }
  }
  async function handleChangeStatus(atividadeId: string, status: string) {
    try { await projetoService.atualizarAtividade(projetoId, atividadeId, { status }); loadAll(); } catch { /* empty */ }
  }
  async function handleChangeFase(atividadeId: string, faseId: string) {
    try { await projetoService.atualizarAtividade(projetoId, atividadeId, { faseId }); loadAll(); } catch { /* empty */ }
  }
  async function handleRemoveAtividade(atividadeId: string) {
    if (!await confirm('Remover Atividade', 'Deseja remover esta atividade e todos os seus registros de tempo?', { variant: 'danger', confirmLabel: 'Remover' })) return;
    try { await projetoService.removerAtividade(projetoId, atividadeId); loadAll(); } catch { /* empty */ }
  }

  const totalMinutos = registros.reduce((sum, r) => sum + (r.duracaoMinutos ?? 0), 0);

  // Agrupar atividades por fase
  const atividadesPorFase = new Map<string, AtividadeProjeto[]>();
  const atividadesSemFase: AtividadeProjeto[] = [];
  for (const a of atividades) {
    if (a.faseId) {
      const arr = atividadesPorFase.get(a.faseId) || [];
      arr.push(a);
      atividadesPorFase.set(a.faseId, arr);
    } else {
      atividadesSemFase.push(a);
    }
  }

  const statusAtividadeConfig: Record<string, { label: string; color: string; dot: string }> = {
    PENDENTE: { label: 'Pendente', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
    EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    CONCLUIDA: { label: 'Concluida', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  };

  function renderAtividade(a: AtividadeProjeto) {
    const isExpanded = expandedId === a.id;
    const meuRegistroAtivo = a.registrosTempo?.find((r) => r.usuarioId === userId);
    const temRegistros = (a._count?.registrosTempo ?? 0) > 0;
    const cfg = statusAtividadeConfig[a.status] || statusAtividadeConfig.PENDENTE;

    return (
      <div key={a.id} className={`${meuRegistroAtivo ? 'border-l-3 border-green-500 bg-green-50/30' : ''}`}>
        {/* Linha principal */}
        <div className="px-5 py-3 cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => toggleExpand(a.id)}>
          <div className="flex items-start gap-3">
            {/* Indicador de status (dot) */}
            <div className="pt-1.5 flex-shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} title={cfg.label} />
            </div>

            {/* Conteudo principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-800 font-medium">{a.titulo}</span>
                {meuRegistroAtivo && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full animate-pulse">
                    <Play className="w-3 h-3" /> Cronometro ativo
                  </span>
                )}
                {temRegistros && !meuRegistroAtivo && (
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    <Clock className="w-3 h-3 inline -mt-px mr-0.5" />{a._count?.registrosTempo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                <span>{a.usuario.nome}</span>
                <span className="text-slate-300">|</span>
                <span>{new Date(a.dataAtividade).toLocaleDateString('pt-BR')}</span>
                {a.descricao && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="truncate max-w-xs">{a.descricao}</span>
                  </>
                )}
              </div>
            </div>

            {/* Acoes compactas (direita) */}
            <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Status select */}
              {canAdd ? (
                <select
                  value={a.status}
                  onChange={(e) => handleChangeStatus(a.id, e.target.value)}
                  className="text-[11px] font-medium border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="CONCLUIDA">Concluida</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              ) : (
                <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${cfg.color}`}>{cfg.label}</span>
              )}

              {/* Fase select (permite mover entre fases) */}
              {canAdd && fases.length > 0 && (
                <select
                  value={a.faseId || ''}
                  onChange={(e) => handleChangeFase(a.id, e.target.value)}
                  className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer text-slate-600 max-w-[120px]"
                  title="Mover para fase"
                >
                  <option value="">Sem fase</option>
                  {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              )}

              {/* Timer */}
              {canAdd && !meuRegistroAtivo && (
                <button onClick={() => handleIniciar(a.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors" title="Iniciar cronometro">
                  <Play className="w-3 h-3" /> Iniciar
                </button>
              )}
              {canAdd && meuRegistroAtivo && (
                <button onClick={() => handleEncerrar(a.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors" title="Encerrar cronometro">
                  <Square className="w-3 h-3" /> Parar
                </button>
              )}

              {/* Remover */}
              {canAdd && (
                <button onClick={() => handleRemoveAtividade(a.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Remover atividade">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Expand indicator */}
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
          </div>
        </div>

        {/* Registros de Tempo (expandido) */}
        {isExpanded && (
          <div className="bg-slate-50/80 px-5 py-4 border-t border-slate-100 ml-5">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Registros de Tempo
                {totalMinutos > 0 && <span className="ml-2 text-capul-600 normal-case font-medium">Total: {fmtDuracao(totalMinutos)}</span>}
              </h5>
            </div>
            {loadingRegistros ? (
              <p className="text-xs text-slate-400">Carregando...</p>
            ) : registros.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum registro de tempo</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 font-medium">Data</th>
                      <th className="pb-2 font-medium">Inicio</th>
                      <th className="pb-2 font-medium">Fim</th>
                      <th className="pb-2 font-medium">Duracao</th>
                      <th className="pb-2 font-medium">Profissional</th>
                      <th className="pb-2 font-medium">Obs</th>
                      {canAdd && <th className="pb-2 font-medium text-center w-20">Acoes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registros.map((r) => editingRegistro === r.id ? (
                      <tr key={r.id} className="bg-amber-50">
                        <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Inicio</label><input type="datetime-local" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Fim</label><input type="datetime-local" value={editFim} onChange={(e) => setEditFim(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="py-2 pr-2" colSpan={2}><label className="block text-slate-500 mb-0.5">Observacao</label><input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Obs..." className="border border-slate-300 rounded px-2 py-1 text-xs w-full" /></td>
                        <td className="py-2 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => handleSaveEdit(r.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button><button onClick={() => setEditingRegistro(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button></div></td>
                      </tr>
                    ) : (
                      <tr key={r.id} className={`${!r.horaFim ? 'bg-green-50/50' : ''}`}>
                        <td className="py-2 pr-2 text-slate-600">{new Date(r.horaInicio).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2 pr-2 text-slate-700 font-medium">{fmtHora(r.horaInicio)}</td>
                        <td className="py-2 pr-2 text-slate-700 font-medium">{r.horaFim ? fmtHora(r.horaFim) : <span className="text-green-600 animate-pulse">ativo...</span>}</td>
                        <td className="py-2 pr-2 text-slate-700 font-medium">{fmtDuracao(r.duracaoMinutos)}</td>
                        <td className="py-2 pr-2 text-slate-600">{r.usuario.nome}</td>
                        <td className="py-2 pr-2 text-slate-500">{r.observacoes || '-'}</td>
                        {canAdd && (
                          <td className="py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => startEdit(r)} className="text-blue-500 hover:text-blue-700" title="Ajustar"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleRemoveRegistro(r.id)} className="text-red-400 hover:text-red-600" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <p className="text-slate-500 text-sm">Carregando...</p>;

  return (
    <div className="space-y-4">
      {/* Nova Atividade */}
      {canAdd && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Nova Atividade</h4>
          <div className="flex gap-3 items-end flex-wrap">
            <input type="text" placeholder="Titulo da atividade" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
            <input type="text" placeholder="Descricao (opcional)" value={novaDescricao} onChange={(e) => setNovaDescricao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
            {fases.length > 0 && (
              <select value={novaFaseId} onChange={(e) => setNovaFaseId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Sem fase</option>
                {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
            <button onClick={handleAddAtividade} disabled={!novoTitulo || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
          </div>
        </div>
      )}

      {/* Fases com atividades agrupadas (modo COMPLETO) */}
      {isCompleto && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-semibold text-slate-700">Fases ({fases.length})</h4>
            {canManage && !showFaseForm && (
              <button onClick={() => setShowFaseForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline"><Plus className="w-4 h-4" /> Nova Fase</button>
            )}
          </div>
          {showFaseForm && (
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end">
              <input type="text" placeholder="Nome da fase" value={novoNomeFase} onChange={(e) => setNovoNomeFase(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" />
              <input type="number" placeholder="Ordem" value={novaOrdemFase} onChange={(e) => setNovaOrdemFase(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20" />
              <button onClick={handleAddFase} disabled={!novoNomeFase || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
              <button onClick={() => setShowFaseForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          )}
          {fases.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">Nenhuma fase criada</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {fases.map((f) => {
                const faseAtividades = atividadesPorFase.get(f.id) || [];
                const isCollapsed = collapsedFases.has(f.id);
                return (
                  <div key={f.id}>
                    {/* Cabeçalho da Fase — destacado */}
                    <div className="px-5 py-3.5 flex items-center justify-between bg-slate-100/80 cursor-pointer hover:bg-slate-100 border-b border-slate-200" onClick={() => toggleFase(f.id)}>
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                        <span className="text-xs text-slate-400 font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5">{f.ordem}</span>
                        <span className="text-base text-slate-800 font-bold">{f.nome}</span>
                        <span className="text-xs text-slate-400 ml-1">{faseAtividades.length} atividade(s)</span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {canManage ? (
                          <select
                            value={f.status}
                            onChange={(e) => handleFaseStatusChange(f.id, e.target.value as StatusFase)}
                            className={`text-[11px] font-medium border border-slate-200 rounded-lg px-2 py-1 bg-white cursor-pointer`}
                          >
                            {Object.entries(faseStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${faseStatusCores[f.status]}`}>{faseStatusLabel[f.status]}</span>
                        )}
                        {canManage && <button onClick={() => handleRemoveFase(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                    {/* Atividades da Fase — com indentação */}
                    {!isCollapsed && (
                      <div className="ml-8 border-l-2 border-capul-200">
                        {faseAtividades.length === 0 ? (
                          <p className="px-5 py-3 text-xs text-slate-400 italic">Nenhuma atividade nesta fase</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {faseAtividades.map(renderAtividade)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Atividades sem fase (ou todas no modo SIMPLES) */}
      {(atividadesSemFase.length > 0 || !isCompleto) && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-semibold text-slate-700">
              {isCompleto ? `Atividades sem fase (${atividadesSemFase.length})` : `Atividades (${atividades.length})`}
            </h4>
          </div>
          {(isCompleto ? atividadesSemFase : atividades).length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">Nenhuma atividade registrada</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(isCompleto ? atividadesSemFase : atividades).map(renderAtividade)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDuracao(minutos: number | null | undefined): string {
  if (!minutos) return '-';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

function fmtHora(dt: string | null): string {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}


// --- Tab Cotacoes ---
function TabCotacoes({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<CotacaoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moeda, setMoeda] = useState('BRL');

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarCotacoes(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  function formatCurrency(value: number, cur = 'BRL'): string {
    const symbol = cur === 'USD' ? 'US$' : cur === 'EUR' ? '\u20ac' : 'R$';
    return `${symbol} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function handleAdd() {
    if (!fornecedor || !valor || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarCotacao(projetoId, {
        fornecedor, valor: Number(valor), descricao: descricao || undefined, moeda,
      });
      setShowForm(false);
      setFornecedor(''); setValor(''); setDescricao(''); setMoeda('BRL');
      load();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleStatusChange(cotacaoId: string, status: StatusCotacao) {
    try { await projetoService.atualizarCotacao(projetoId, cotacaoId, { status }); load(); } catch { /* empty */ }
  }

  async function handleRemove(cotacaoId: string) {
    if (!await confirm('Remover Cotacao', 'Deseja remover esta cotacao?')) return;
    try { await projetoService.removerCotacao(projetoId, cotacaoId); load(); } catch { /* empty */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Cotacoes ({itens.length})</h4>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Nova Cotacao
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end flex-wrap">
          <input type="text" placeholder="Fornecedor" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
          <input type="number" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32" />
          <select value={moeda} onChange={(e) => setMoeda(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white w-20">
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <input type="text" placeholder="Descricao (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
          <button onClick={handleAdd} disabled={!fornecedor || !valor || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
          <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhuma cotacao</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {itens.map((c) => (
            <div key={c.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cotacaoStatusCores[c.status]}`}>{cotacaoStatusLabel[c.status]}</span>
                <span className="text-sm text-slate-700 font-medium">{c.fornecedor}</span>
                <span className="text-sm text-capul-600 font-bold">{formatCurrency(c.valor, c.moeda)}</span>
                {c.descricao && <span className="text-xs text-slate-400">{c.descricao}</span>}
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) handleStatusChange(c.id, e.target.value as StatusCotacao); }}
                    className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
                  >
                    <option value="">Status...</option>
                    {Object.entries(cotacaoStatusLabel).filter(([k]) => k !== c.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}
                {canManage && (
                  <button onClick={() => handleRemove(c.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Financeiro (Cotações + Custos mesclados) ---
function TabFinanceiro({ projetoId, projeto, canManage }: { projetoId: string; projeto: Projeto; canManage: boolean }) {
  const [subTab, setSubTab] = useState<'resumo' | 'cotacoes' | 'custos'>('resumo');
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex gap-1 px-6 border-b border-slate-200">
          {[
            { key: 'resumo' as const, label: 'Resumo' },
            { key: 'cotacoes' as const, label: 'Cotacoes' },
            { key: 'custos' as const, label: 'Custos Detalhados' },
          ].map((t) => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${subTab === t.key ? 'border-capul-600 text-capul-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {subTab === 'resumo' && <TabCustosResumo projetoId={projetoId} projeto={projeto} />}
      {subTab === 'cotacoes' && <TabCotacoes projetoId={projetoId} canManage={canManage} />}
      {subTab === 'custos' && <TabCustosDetalhados projetoId={projetoId} canManage={canManage} />}
    </div>
  );
}

function TabCustosResumo({ projetoId, projeto: _projeto }: { projetoId: string; projeto: Projeto }) {
  const [custos, setCustos] = useState<CustosConsolidados | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    projetoService.getCustos(projetoId).then(setCustos).catch(() => {}).finally(() => setLoading(false));
  }, [projetoId]);

  function formatCurrency(value: number): string {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (loading) return <p className="text-slate-500 text-sm">Carregando...</p>;
  if (!custos) return <p className="text-slate-400 text-sm">Sem dados</p>;

  const hasSubProjetos = custos.totalSubProjetos > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs text-slate-500 mb-1">Previsto (proprio)</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(custos.custoPrevistoProprio)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Realizado (proprio)</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(custos.custoRealizadoProprio)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Horas Apontadas</p>
          <p className="text-lg font-bold text-slate-800">{custos.totalHoras ?? 0}h</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Variacao</p>
          <p className={`text-lg font-bold ${custos.custoRealizadoProprio > custos.custoPrevistoProprio ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(custos.custoRealizadoProprio - custos.custoPrevistoProprio)}
          </p>
        </div>
      </div>
      {hasSubProjetos && (
        <>
          <hr className="my-6 border-slate-200" />
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Consolidado ({custos.totalSubProjetos} sub-projetos)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Previsto</p>
              <p className="text-xl font-bold text-capul-600">{formatCurrency(custos.custoPrevistoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Realizado</p>
              <p className="text-xl font-bold text-capul-600">{formatCurrency(custos.custoRealizadoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Variacao Total</p>
              <p className={`text-xl font-bold ${custos.custoRealizadoTotal > custos.custoPrevistoTotal ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(custos.custoRealizadoTotal - custos.custoPrevistoTotal)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TabCustosDetalhados({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<CustoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaCusto>('MAO_DE_OBRA');
  const [valorPrevisto, setValorPrevisto] = useState('');
  const [valorRealizado, setValorRealizado] = useState('');

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarCustosDetalhados(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  function formatCurrency(value: number): string {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function handleAdd() {
    if (!descricao || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarCusto(projetoId, { descricao, categoria, valorPrevisto: valorPrevisto ? Number(valorPrevisto) : undefined, valorRealizado: valorRealizado ? Number(valorRealizado) : undefined });
      setShowForm(false); setDescricao(''); setValorPrevisto(''); setValorRealizado('');
      load();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleRemove(custoId: string) {
    if (!await confirm('Remover Custo', 'Deseja remover este custo?')) return;
    try { await projetoService.removerCusto(projetoId, custoId); load(); } catch { /* empty */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Custos Detalhados ({itens.length})</h4>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline"><Plus className="w-4 h-4" /> Novo Custo</button>
        )}
      </div>
      {showForm && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end flex-wrap">
          <input type="text" placeholder="Descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaCusto)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {Object.entries(categoriaLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" placeholder="Previsto" value={valorPrevisto} onChange={(e) => setValorPrevisto(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" />
          <input type="number" placeholder="Realizado" value={valorRealizado} onChange={(e) => setValorRealizado(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" />
          <button onClick={handleAdd} disabled={!descricao || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
          <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
        </div>
      )}
      {loading ? <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p> : itens.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum custo detalhado</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {itens.map((c) => (
            <div key={c.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoriaCores[c.categoria]}`}>{categoriaLabel[c.categoria]}</span>
                <span className="text-sm text-slate-700">{c.descricao}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">Prev: {formatCurrency(c.valorPrevisto ?? 0)}</span>
                <span className="text-xs text-slate-700 font-medium">Real: {formatCurrency(c.valorRealizado ?? 0)}</span>
                {canManage && <button onClick={() => handleRemove(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Riscos ---
function TabRiscos({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<RiscoProjeto[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [probabilidade, setProbabilidade] = useState<ProbabilidadeRisco>('MEDIA');
  const [impacto, setImpacto] = useState<ImpactoRisco>('MEDIO');
  const [planoMitigacao, setPlanoMitigacao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');

  useEffect(() => {
    load();
    coreService.listarUsuarios().then(setUsuarios).catch(() => {});
  }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarRiscos(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  async function handleAdd() {
    if (!titulo || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarRisco(projetoId, {
        titulo, probabilidade, impacto,
        planoMitigacao: planoMitigacao || undefined,
        responsavelId: responsavelId || undefined,
      });
      setShowForm(false);
      setTitulo(''); setPlanoMitigacao(''); setResponsavelId('');
      load();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleStatusChange(riscoId: string, status: StatusRisco) {
    try { await projetoService.atualizarRisco(projetoId, riscoId, { status }); load(); } catch { /* empty */ }
  }

  async function handleRemove(riscoId: string) {
    if (!await confirm('Remover Risco', 'Deseja remover este risco?')) return;
    try { await projetoService.removerRisco(projetoId, riscoId); load(); } catch { /* empty */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Riscos ({itens.length})</h4>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Novo Risco
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <input type="text" placeholder="Titulo do risco" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
            <select value={probabilidade} onChange={(e) => setProbabilidade(e.target.value as ProbabilidadeRisco)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              {Object.entries(probabilidadeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={impacto} onChange={(e) => setImpacto(e.target.value as ImpactoRisco)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              {Object.entries(impactoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Responsavel (opcional)</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <textarea placeholder="Plano de mitigacao (opcional)" value={planoMitigacao} onChange={(e) => setPlanoMitigacao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" rows={2} />
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={!titulo || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum risco identificado</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {itens.map((r) => (
            <div key={r.id} className="px-6 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riscoStatusCores[r.status]}`}>{riscoStatusLabel[r.status]}</span>
                  <span className="text-sm text-slate-700 font-medium">{r.titulo}</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <select value="" onChange={(e) => { if (e.target.value) handleStatusChange(r.id, e.target.value as StatusRisco); }} className="border border-slate-200 rounded px-2 py-1 text-xs bg-white">
                      <option value="">Status...</option>
                      {Object.entries(riscoStatusLabel).filter(([k]) => k !== r.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                  {canManage && (
                    <button onClick={() => handleRemove(r.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className={`px-2 py-0.5 rounded-full ${probabilidadeCores[r.probabilidade]}`}>P: {probabilidadeLabel[r.probabilidade]}</span>
                <span className={`px-2 py-0.5 rounded-full ${impactoCores[r.impacto]}`}>I: {impactoLabel[r.impacto]}</span>
                {r.responsavel && <span className="text-slate-500">Resp: {r.responsavel.nome}</span>}
              </div>
              {r.planoMitigacao && <p className="text-xs text-slate-500 mt-1">{r.planoMitigacao}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Dependencias ---
function TabDependencias({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { confirm } = useToast();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [origem, setOrigem] = useState<DependenciaProjeto[]>([]);
  const [destino, setDestino] = useState<DependenciaProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projetoDestinoId, setProjetoDestinoId] = useState('');
  const [tipo, setTipo] = useState<TipoDependencia>('BLOQUEIO');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    load();
    projetoService.listar().then(setProjetos).catch(() => {});
  }, [projetoId]);

  async function load() {
    setLoading(true);
    try {
      const data = await projetoService.listarDependencias(projetoId);
      setOrigem(data.origem);
      setDestino(data.destino);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function handleAdd() {
    if (!projetoDestinoId || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarDependencia(projetoId, {
        projetoDestinoId, tipo, descricao: descricao || undefined,
      });
      setShowForm(false);
      setProjetoDestinoId(''); setDescricao('');
      load();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleRemove(depId: string) {
    if (!await confirm('Remover Dependencia', 'Deseja remover esta dependencia?')) return;
    try { await projetoService.removerDependencia(projetoId, depId); load(); } catch { /* empty */ }
  }

  const available = projetos.filter((p) => p.id !== projetoId);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-700">Dependencias</h4>
          {canManage && !showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
              <Plus className="w-4 h-4" />
              Nova Dependencia
            </button>
          )}
        </div>

        {showForm && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end flex-wrap">
            <select value={projetoDestinoId} onChange={(e) => setProjetoDestinoId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white flex-1 min-w-48">
              <option value="">Selecione projeto...</option>
              {available.map((p) => <option key={p.id} value={p.id}>#{p.numero} - {p.nome}</option>)}
            </select>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDependencia)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
              {Object.entries(dependenciaLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="text" placeholder="Descricao (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
            <button onClick={handleAdd} disabled={!projetoDestinoId || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        )}

        {loading ? (
          <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Este projeto depende de ({origem.length})</p>
              {origem.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma</p>
              ) : (
                <div className="space-y-2">
                  {origem.map((d) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dependenciaCores[d.tipo]}`}>{dependenciaLabel[d.tipo]}</span>
                        <Link to={`/gestao-ti/projetos/${d.projetoDestino?.id}`} className="text-sm text-capul-600 hover:underline">
                          #{d.projetoDestino?.numero} - {d.projetoDestino?.nome}
                        </Link>
                      </div>
                      {canManage && (
                        <button onClick={() => handleRemove(d.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Dependem deste ({destino.length})</p>
              {destino.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma</p>
              ) : (
                <div className="space-y-2">
                  {destino.map((d) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dependenciaCores[d.tipo]}`}>{dependenciaLabel[d.tipo]}</span>
                        <Link to={`/gestao-ti/projetos/${d.projetoOrigem?.id}`} className="text-sm text-capul-600 hover:underline">
                          #{d.projetoOrigem?.numero} - {d.projetoOrigem?.nome}
                        </Link>
                      </div>
                      {canManage && (
                        <button onClick={() => handleRemove(d.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tab Anexos ---
function TabAnexos({ projetoId, canAdd, canManage }: { projetoId: string; canAdd: boolean; canManage: boolean }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<AnexoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState<TipoAnexo>('DOCUMENTO');
  const [descricao, setDescricao] = useState('');

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarAnexos(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  async function handleAdd() {
    if (!titulo || !url || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarAnexo(projetoId, {
        titulo, url, tipo, descricao: descricao || undefined,
      });
      setShowForm(false);
      setTitulo(''); setUrl(''); setDescricao('');
      load();
    } catch { /* empty */ }
    setSaving(false);
  }

  async function handleRemove(anexoId: string) {
    if (!await confirm('Remover Anexo', 'Deseja remover este anexo?')) return;
    try { await projetoService.removerAnexo(projetoId, anexoId); load(); } catch { /* empty */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Anexos ({itens.length})</h4>
        {canAdd && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Novo Anexo
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end flex-wrap">
          <input type="text" placeholder="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
          <input type="url" placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAnexo)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {Object.entries(anexoTipoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="text" placeholder="Descricao (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-36" />
          <button onClick={handleAdd} disabled={!titulo || !url || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
          <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum anexo</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {itens.map((a) => (
            <div key={a.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{anexoTipoLabel[a.tipo]}</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline font-medium flex items-center gap-1">
                  {a.titulo}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {a.descricao && <span className="text-xs text-slate-400">{a.descricao}</span>}
              </div>
              <div className="flex items-center gap-3">
                {a.usuario && <span className="text-xs text-slate-400">{a.usuario.nome}</span>}
                <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString('pt-BR')}</span>
                {canManage && (
                  <button onClick={() => handleRemove(a.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Chamados ---
function TabChamados({ projetoId, canManage }: { projetoId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [itens, setItens] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVincular, setShowVincular] = useState(false);
  const [buscaTermo, setBuscaTermo] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Chamado[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarChamadosProjeto(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  async function buscarChamados() {
    if (!buscaTermo.trim()) return;
    setBuscando(true);
    try {
      const todos = await chamadoService.listar();
      const vinculadosIds = new Set(itens.map((i) => i.id));
      const filtrados = todos.filter(
        (c) => !c.projetoId && !vinculadosIds.has(c.id) &&
          (c.numero.toString().includes(buscaTermo) || c.titulo.toLowerCase().includes(buscaTermo.toLowerCase())),
      );
      setResultadosBusca(filtrados);
    } catch { /* empty */ }
    setBuscando(false);
  }

  async function handleVincular(chamadoId: string) {
    try {
      await projetoService.vincularChamado(projetoId, chamadoId);
      toast('success', 'Chamado vinculado com sucesso');
      setResultadosBusca((prev) => prev.filter((c) => c.id !== chamadoId));
      load();
    } catch {
      toast('error', 'Erro ao vincular chamado');
    }
  }

  async function handleDesvincular(chamadoId: string) {
    if (!confirm('Desvincular este chamado do projeto?')) return;
    try {
      await projetoService.desvincularChamado(projetoId, chamadoId);
      toast('success', 'Chamado desvinculado');
      load();
    } catch {
      toast('error', 'Erro ao desvincular chamado');
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Chamados Vinculados ({itens.length})</h4>
        <div className="flex items-center gap-3">
          {canManage && (
            <button onClick={() => setShowVincular(!showVincular)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
              <Link2 className="w-4 h-4" />
              Vincular Existente
            </button>
          )}
          <Link
            to={`/gestao-ti/chamados/novo?projetoId=${projetoId}`}
            className="flex items-center gap-1 text-sm text-capul-600 hover:underline"
          >
            <Plus className="w-4 h-4" />
            Novo Chamado
          </Link>
        </div>
      </div>

      {showVincular && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={buscaTermo}
              onChange={(e) => setBuscaTermo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarChamados()}
              placeholder="Buscar por numero ou titulo do chamado..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
            />
            <button onClick={buscarChamados} disabled={buscando} className="px-3 py-2 bg-capul-600 text-white rounded-lg text-sm hover:bg-capul-700 flex items-center gap-1">
              <Search className="w-4 h-4" />
              Buscar
            </button>
          </div>
          {buscando ? (
            <p className="text-sm text-slate-400">Buscando...</p>
          ) : resultadosBusca.length > 0 ? (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto">
              {resultadosBusca.map((c) => (
                <div key={c.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">#{c.numero}</span>
                    <span className="text-sm text-slate-600">{c.titulo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chamadoStatusCores[c.status]}`}>{chamadoStatusLabel[c.status]}</span>
                  </div>
                  <button onClick={() => handleVincular(c.id)} className="text-xs px-3 py-1 bg-capul-600 text-white rounded hover:bg-capul-700">
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          ) : buscaTermo.trim() ? (
            <p className="text-sm text-slate-400">Nenhum chamado disponivel encontrado</p>
          ) : null}
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : itens.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum chamado vinculado</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {itens.map((c) => (
            <div key={c.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link to={`/gestao-ti/chamados/${c.id}`} className="text-sm text-capul-600 hover:underline font-medium">
                  #{c.numero}
                </Link>
                <span className="text-sm text-slate-700">{c.titulo}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${chamadoStatusCores[c.status]}`}>{chamadoStatusLabel[c.status]}</span>
                <span className="text-xs text-slate-400">{prioridadeLabel[c.prioridade]}</span>
              </div>
              <div className="flex items-center gap-3">
                {c.tecnico && <span className="text-xs text-slate-400">{c.tecnico.nome}</span>}
                <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                {canManage && (
                  <button onClick={() => handleDesvincular(c.id)} className="text-slate-400 hover:text-red-500" title="Desvincular chamado">
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
