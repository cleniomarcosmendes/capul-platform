import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { projetoService } from '../../services/projeto.service';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft, Pencil, FolderKanban, Users, Clock, DollarSign, Plus, Trash2, AlertTriangle, Link2, Paperclip, Ticket, ExternalLink, Play, Square, ChevronDown, ChevronRight, Check, X, Edit3, Search, Unlink, MessageSquare, KeyRound, ClipboardList, Download, Eye, Upload, Copy } from 'lucide-react';
import { formatDateBR } from '../../utils/date';
import { MentionInput } from '../../components/MentionInput';
import { MultiSelectDropdown } from '../../components/MultiSelectDropdown';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
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
  PapelRaci,
  StatusFase,
  UsuarioCore,
  RegistroTempo,
  ComentarioTarefa,
  EquipeTI,
  UsuarioChaveProjeto,
  PendenciaProjeto,
  PrioridadePendencia,
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
  DOCUMENTO: 'Documento', PLANILHA: 'Planilha', IMAGEM: 'Imagem', LINK: 'Link', OUTRO: 'Outro', ARQUIVO: 'Arquivo',
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

type Tab = 'subprojetos' | 'equipe' | 'atividades' | 'financeiro' | 'riscos' | 'dependencias' | 'anexos' | 'chamados' | 'usuariosChave' | 'pendencias';

const pendenciaStatusLabel: Record<string, string> = {
  ABERTA: 'Aberta', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_VALIDACAO: 'Aguardando Validacao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
};
const pendenciaStatusCores: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700', AGUARDANDO_VALIDACAO: 'bg-orange-100 text-orange-700', CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-slate-100 text-slate-600',
};
const pendenciaPrioridadeLabel: Record<string, string> = {
  BAIXA: 'Baixa', MEDIA: 'Media', ALTA: 'Alta', URGENTE: 'Urgente',
};
const pendenciaPrioridadeCores: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700', MEDIA: 'bg-yellow-100 text-yellow-700', ALTA: 'bg-orange-100 text-orange-700', URGENTE: 'bg-red-100 text-red-700',
};

export function ProjetoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { gestaoTiRole, usuario } = useAuth();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  // canManage: usuario deve ser membro/responsavel do projeto (ou ADMIN/GESTOR_TI)
  const isMembro = (projeto as unknown as Record<string, unknown>)?.isMembro === true;
  const isGestorOrAdmin = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';
  const canManage = (isGestorOrAdmin || isMembro) && Boolean(gestaoTiRole);
  const canAddAtividade = canManage;

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('subprojetos');
  const [statusChanging, setStatusChanging] = useState(false);

  // Rastrear estado de edicao dos sub-componentes
  const [childEditing, setChildEditing] = useState(false);
  const { ConfirmDialog: ParentConfirmDialog, guardedNavigate } = useUnsavedChanges(childEditing);

  // Ler aba da URL se especificada (ex: ?tab=atividades)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as Tab | null;
    if (tabParam) setTab(tabParam);
  }, [searchParams]);

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
      await projetoService.atualizar(projeto.id, { status: newStatus });
      await loadProjeto();
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

  const showEquipeTab = true;
  const isCompleto = true; // Modo SIMPLES removido - todos projetos são COMPLETO
  const isRestrictedRole = gestaoTiRole === 'USUARIO_CHAVE' || gestaoTiRole === 'TERCEIRIZADO';

  const allTabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'subprojetos', label: 'Sub-projetos', icon: FolderKanban },
    ...(showEquipeTab ? [{ key: 'equipe' as Tab, label: 'Equipe', icon: Users }] : []),
    { key: 'atividades', label: 'Atividades', icon: Clock },
    { key: 'pendencias' as Tab, label: 'Pendencias', icon: ClipboardList },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
    ...(isCompleto ? [{ key: 'riscos' as Tab, label: 'Riscos', icon: AlertTriangle }] : []),
    ...(isCompleto ? [{ key: 'dependencias' as Tab, label: 'Dependencias', icon: Link2 }] : []),
    { key: 'anexos', label: 'Anexos', icon: Paperclip },
    { key: 'chamados', label: 'Chamados', icon: Ticket },
    { key: 'usuariosChave' as Tab, label: 'Usuarios-Chave', icon: KeyRound },
  ];

  // USUARIO_CHAVE e TERCEIRIZADO: apenas Sub-projetos e Pendencias
  const restrictedTabs: Tab[] = ['subprojetos', 'pendencias'];
  const tabs = isRestrictedRole ? allTabs.filter(t => restrictedTabs.includes(t.key)) : allTabs;

  // Navegacao: voltar para projeto pai se existir, senao para lista
  const handleVoltar = () => {
    const dest = projeto.projetoPai
      ? `/gestao-ti/projetos/${projeto.projetoPai.id}`
      : '/gestao-ti/projetos';
    guardedNavigate(dest);
  };

  return (
    <>
      {ParentConfirmDialog}
      <Header title={`Projeto #${projeto.numero}`} />
      <div className="p-6">
        {/* Breadcrumbs - Navegacao Hierarquica */}
        <nav className="flex items-center gap-2 text-sm mb-4">
          <Link to="/gestao-ti/projetos" className="text-slate-500 hover:text-capul-600">
            Projetos
          </Link>
          {projeto.projetoPai && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <Link to={`/gestao-ti/projetos/${projeto.projetoPai.id}`} className="text-slate-500 hover:text-capul-600">
                #{projeto.projetoPai.numero} {projeto.projetoPai.nome}
              </Link>
            </>
          )}
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700 font-medium">#{projeto.numero} {projeto.nome}</span>
        </nav>

        <button onClick={handleVoltar} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          {projeto.projetoPai ? `Voltar para #${projeto.projetoPai.numero}` : 'Voltar para lista'}
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
                <>
                  <Link
                    to={`/gestao-ti/projetos/${projeto.id}/editar`}
                    className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Link>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Duplicar projeto "${projeto.nome}"?\n\nSera criada uma copia com equipe, fases, custos, riscos e cotacoes. Status sera PLANEJAMENTO.`)) return;
                      try {
                        const novo = await projetoService.duplicar(projeto.id);
                        navigate(`/gestao-ti/projetos/${novo.id}`);
                      } catch {
                        alert('Erro ao duplicar projeto');
                      }
                    }}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm hover:bg-blue-100"
                  >
                    <Copy className="w-4 h-4" />
                    Duplicar
                  </button>
                </>
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
                <a href={`/gestao-ti/softwares/${projeto.software.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">
                  {projeto.software.nome}
                </a>
              ) : '-'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Contrato</p>
              <p className="text-slate-800">{projeto.contrato ? (
                <a href={`/gestao-ti/contratos/${projeto.contrato.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">
                  #{projeto.contrato.numero} - {projeto.contrato.titulo}
                </a>
              ) : '-'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Periodo</p>
              <p className="text-slate-800">
                {formatDateBR(projeto.dataInicio) || '?'}
                {' — '}
                {projeto.dataFimReal
                  ? formatDateBR(projeto.dataFimReal)
                  : projeto.dataFimPrevista
                  ? formatDateBR(projeto.dataFimPrevista) + ' (prev.)'
                  : '?'}
              </p>
            </div>
          </div>

          {projeto.descricao && (
            <p className="mt-4 text-sm text-slate-600">{projeto.descricao}</p>
          )}

          {projeto.observacoes && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="text-xs font-semibold text-amber-700 uppercase">Observacoes</span>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{projeto.observacoes}</p>
            </div>
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
          <TabSubProjetos projeto={projeto} canManage={canManage} isRestrictedRole={isRestrictedRole} />
        )}
        {tab === 'equipe' && showEquipeTab && (
          <TabEquipe projetoId={projeto.id} canManage={canManage} onEditingChange={setChildEditing} />
        )}
        {tab === 'atividades' && (
          <TabCronograma projetoId={projeto.id} isCompleto={isCompleto} canManage={canManage} canAdd={canAddAtividade} userId={usuario?.id || ''} isGestor={gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI'} onEditingChange={setChildEditing} />
        )}
        {tab === 'financeiro' && (
          <TabFinanceiro projetoId={projeto.id} projeto={projeto} canManage={canManage} onEditingChange={setChildEditing} />
        )}
        {tab === 'riscos' && isCompleto && (
          <TabRiscos projetoId={projeto.id} canManage={canManage} onEditingChange={setChildEditing} />
        )}
        {tab === 'dependencias' && isCompleto && (
          <TabDependencias projetoId={projeto.id} canManage={canManage} onEditingChange={setChildEditing} />
        )}
        {tab === 'anexos' && (
          <TabAnexos projetoId={projeto.id} canAdd={canAddAtividade} canManage={canManage} />
        )}
        {tab === 'chamados' && (
          <TabChamados projetoId={projeto.id} canManage={canManage} />
        )}
        {tab === 'usuariosChave' && (
          <TabUsuariosChave projetoId={projeto.id} canManage={canManage} onEditingChange={setChildEditing} />
        )}
        {tab === 'pendencias' && (
          <TabPendencias
            projetoId={projeto.id}
            projetoNumero={projeto.numero}
            isSubProjeto={!!projeto.projetoPai}
            onEditingChange={setChildEditing}
          />
        )}
      </div>
    </>
  );
}

// --- Tab Sub-projetos ---
function TabSubProjetos({ projeto, canManage, isRestrictedRole }: { projeto: Projeto; canManage: boolean; isRestrictedRole?: boolean }) {
  const subs = projeto.subProjetos || [];
  // USUARIO_CHAVE e TERCEIRIZADO nao podem criar sub-projetos
  const canCreateSubProjeto = canManage && !isRestrictedRole && projeto.nivel < 3;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">
          {isRestrictedRole ? 'Sub-projetos vinculados' : 'Sub-projetos'} ({subs.length})
        </h4>
        {canCreateSubProjeto && (
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
        <p className="px-6 py-4 text-sm text-slate-400">
          {isRestrictedRole ? 'Voce nao esta vinculado a nenhum sub-projeto' : 'Nenhum sub-projeto'}
        </p>
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
              <span className="text-xs text-slate-400">N{s.nivel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab Equipe ---
function TabEquipe({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
  const { confirm } = useToast();
  const [membros, setMembros] = useState<MembroProjeto[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [novoUsuarioId, setNovoUsuarioId] = useState('');
  const [novoPapel, setNovoPapel] = useState<PapelRaci>('RESPONSAVEL');
  const [saving, setSaving] = useState(false);
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

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
    <>
    {/* protecao via pai */}
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
    </>
  );
}

// --- Tab Atividades (Fases + Atividades + Registros de Tempo) ---
function TabCronograma({ projetoId, isCompleto, canManage, canAdd, userId, isGestor, onEditingChange }: { projetoId: string; isCompleto: boolean; canManage: boolean; canAdd: boolean; userId: string; isGestor: boolean; onEditingChange?: (editing: boolean) => void }) {
  const { confirm } = useToast();
  const [fases, setFases] = useState<FaseProjeto[]>([]);
  const [atividades, setAtividades] = useState<AtividadeProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  // Fase form
  const [showFaseForm, setShowFaseForm] = useState(false);
  const [novoNomeFase, setNovoNomeFase] = useState('');
  const [novaOrdemFase, setNovaOrdemFase] = useState('');
  const [novaFaseDataInicio, setNovaFaseDataInicio] = useState('');
  const [novaFaseDataFimPrevista, setNovaFaseDataFimPrevista] = useState('');
  const [editingFaseId, setEditingFaseId] = useState<string | null>(null);
  const [editFaseNome, setEditFaseNome] = useState('');
  const [editFaseOrdem, setEditFaseOrdem] = useState('');
  const [editFaseDataInicio, setEditFaseDataInicio] = useState('');
  const [editFaseDataFimPrevista, setEditFaseDataFimPrevista] = useState('');
  // Atividade form
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaFaseId, setNovaFaseId] = useState('');
  const [novaDataInicio, setNovaDataInicio] = useState('');
  const [novaDataFimPrevista, setNovaDataFimPrevista] = useState('');
  const [novosResponsavelIds, setNovosResponsavelIds] = useState<string[]>([]);
  const [membrosEquipe, setMembrosEquipe] = useState<MembroProjeto[]>([]);
  const [saving, setSaving] = useState(false);
  // Expanded atividade
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroTempo[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<string | null>(null);
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');
  const [editObs, setEditObs] = useState('');
  // Comentarios
  const [comentarios, setComentarios] = useState<ComentarioTarefa[]>([]);
  const [loadingComentarios, setLoadingComentarios] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [novoComentarioVisivel, setNovoComentarioVisivel] = useState(false);
  const [savingComentario, setSavingComentario] = useState(false);
  // Fases colapsadas
  const [collapsedFases, setCollapsedFases] = useState<Set<string>>(new Set());
  // Edicao de atividade
  const [editingAtividade, setEditingAtividade] = useState<AtividadeProjeto | null>(null);
  const [editAtivTitulo, setEditAtivTitulo] = useState('');
  const [editAtivDescricao, setEditAtivDescricao] = useState('');
  const [editAtivDataInicio, setEditAtivDataInicio] = useState('');
  const [editAtivDataFimPrevista, setEditAtivDataFimPrevista] = useState('');
  const [editAtivFaseId, setEditAtivFaseId] = useState('');
  const [editAtivResponsavelIds, setEditAtivResponsavelIds] = useState<string[]>([]);
  const [savingAtividade, setSavingAtividade] = useState(false);
  // Edicao de notas
  const [editingComentario, setEditingComentario] = useState<string | null>(null);
  const [editComentarioTexto, setEditComentarioTexto] = useState('');
  const [editComentarioVisivel, setEditComentarioVisivel] = useState(false);
  const isEditingCronograma = Boolean(
    showFaseForm || editingFaseId || editingAtividade || editingRegistro ||
    (novoComentario && novoComentario.trim()) || editingComentario ||
    novoTitulo.trim() || novaDescricao.trim()
  );

  useEffect(() => {
    onEditingChange?.(isEditingCronograma);
    return () => onEditingChange?.(false);
  }, [isEditingCronograma, onEditingChange]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, a, m] = await Promise.all([
        isCompleto ? projetoService.listarFases(projetoId) : Promise.resolve([]),
        projetoService.listarAtividades(projetoId),
        projetoService.listarMembros(projetoId),
      ]);
      setFases(f);
      setAtividades(a);
      setMembrosEquipe(m);
    } catch { /* empty */ }
    setLoading(false);
  }, [projetoId, isCompleto]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // --- Fases ---
  async function handleAddFase() {
    if (!novoNomeFase || saving) return;
    setSaving(true);
    try {
      await projetoService.adicionarFase(projetoId, {
        nome: novoNomeFase,
        ordem: Number(novaOrdemFase) || fases.length + 1,
        dataInicio: novaFaseDataInicio ? new Date(novaFaseDataInicio).toISOString() : undefined,
        dataFimPrevista: novaFaseDataFimPrevista ? new Date(novaFaseDataFimPrevista).toISOString() : undefined,
      });
      setShowFaseForm(false); setNovoNomeFase(''); setNovaOrdemFase('');
      setNovaFaseDataInicio(''); setNovaFaseDataFimPrevista('');
      loadAll();
    } catch { /* empty */ }
    setSaving(false);
  }
  async function handleFaseStatusChange(faseId: string, status: StatusFase) {
    try { await projetoService.atualizarFase(projetoId, faseId, { status } as never); loadAll(); } catch { /* empty */ }
  }
  function startEditFase(f: FaseProjeto) {
    setEditingFaseId(f.id);
    setEditFaseNome(f.nome);
    setEditFaseOrdem(String(f.ordem));
    setEditFaseDataInicio(f.dataInicio ? f.dataInicio.substring(0, 10) : '');
    setEditFaseDataFimPrevista(f.dataFimPrevista ? f.dataFimPrevista.substring(0, 10) : '');
  }
  async function handleSaveEditFase() {
    if (!editingFaseId || !editFaseNome || saving) return;
    setSaving(true);
    try {
      await projetoService.atualizarFase(projetoId, editingFaseId, {
        nome: editFaseNome,
        ordem: Number(editFaseOrdem) || undefined,
        dataInicio: editFaseDataInicio ? new Date(editFaseDataInicio).toISOString() : undefined,
        dataFimPrevista: editFaseDataFimPrevista ? new Date(editFaseDataFimPrevista).toISOString() : undefined,
      } as never);
      setEditingFaseId(null);
      loadAll();
    } catch { /* empty */ }
    setSaving(false);
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
      await projetoService.adicionarAtividade(projetoId, {
        titulo: novoTitulo,
        descricao: novaDescricao || undefined,
        faseId: novaFaseId || undefined,
        responsavelIds: novosResponsavelIds.length > 0 ? novosResponsavelIds : undefined,
        dataInicio: novaDataInicio ? new Date(novaDataInicio).toISOString() : undefined,
        dataFimPrevista: novaDataFimPrevista ? new Date(novaDataFimPrevista).toISOString() : undefined,
      });
      setNovoTitulo(''); setNovaDescricao(''); setNovaFaseId('');
      setNovaDataInicio(''); setNovaDataFimPrevista(''); setNovosResponsavelIds([]);
      loadAll();
    } catch { /* empty */ }
    setSaving(false);
  }
  async function handleIniciar(atividadeId: string) {
    // Verificar se ha outro timer ativo do MESMO usuario (em qualquer atividade deste projeto)
    const outraAtiva = atividades.find((a) =>
      a.id !== atividadeId && a.registrosTempo?.some((r) => r.usuarioId === userId),
    );
    if (outraAtiva) {
      const ok = await confirm(
        'Cronometro ativo',
        `Voce ja possui um cronometro ativo na atividade "${outraAtiva.titulo}". Ao continuar, o cronometro anterior sera encerrado automaticamente.`,
        { variant: 'warning', confirmLabel: 'Continuar', cancelLabel: 'Cancelar' },
      );
      if (!ok) return;
    }

    // Verificar se OUTRO usuario esta trabalhando nesta atividade
    const estaAtividade = atividades.find((a) => a.id === atividadeId);
    const outrosUsuarios = (estaAtividade?.registrosTempo ?? [])
      .filter((r) => r.usuarioId !== userId)
      .map((r) => (r as { usuario?: { nome: string } }).usuario?.nome || 'Outro usuario');
    if (outrosUsuarios.length > 0) {
      const nomes = [...new Set(outrosUsuarios)].join(', ');
      const ok = await confirm(
        'Atividade em andamento',
        `${nomes} ja esta trabalhando nesta atividade. Deseja iniciar mesmo assim?`,
        { variant: 'default', confirmLabel: 'Iniciar', cancelLabel: 'Cancelar' },
      );
      if (!ok) return;
    }

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
  async function loadComentarios(atividadeId: string) {
    setLoadingComentarios(true);
    try { setComentarios(await projetoService.listarComentarios(projetoId, atividadeId)); } catch { setComentarios([]); }
    setLoadingComentarios(false);
  }
  function toggleExpand(atividadeId: string) {
    if (expandedId === atividadeId) { setExpandedId(null); return; }
    setExpandedId(atividadeId); setEditingRegistro(null); loadRegistros(atividadeId); loadComentarios(atividadeId);
  }
  function toLocalDatetimeStr(iso: string): string {
    // Converte ISO UTC para formato datetime-local (YYYY-MM-DDTHH:MM) em hora local
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function startEdit(r: RegistroTempo) {
    setEditingRegistro(r.id);
    setEditInicio(r.horaInicio ? toLocalDatetimeStr(r.horaInicio) : '');
    setEditFim(r.horaFim ? toLocalDatetimeStr(r.horaFim) : '');
    setEditObs(r.observacoes || '');
  }
  async function handleSaveEdit(registroId: string) {
    try {
      await projetoService.ajustarRegistroTempo(projetoId, registroId, { horaInicio: editInicio ? new Date(editInicio).toISOString() : undefined, horaFim: editFim ? new Date(editFim).toISOString() : undefined, observacoes: editObs || undefined });
      setEditingRegistro(null); if (expandedId) loadRegistros(expandedId);
    } catch { /* empty */ }
  }
  async function handleRemoveRegistro(registroId: string) {
    if (!await confirm('Remover Registro', 'Deseja remover este registro de tempo?')) return;
    try { await projetoService.removerRegistroTempo(projetoId, registroId); if (expandedId) loadRegistros(expandedId); } catch { /* empty */ }
  }
  async function handleChangeStatus(atividadeId: string, status: string) {
    try { await projetoService.atualizarAtividade(projetoId, atividadeId, { status }); loadAll(); } catch { /* empty */ }
  }
  async function handleChangeFase(atividadeId: string, faseId: string) {
    try { await projetoService.atualizarAtividade(projetoId, atividadeId, { faseId }); loadAll(); } catch { /* empty */ }
  }
  async function handleRemoveAtividade(atividadeId: string) {
    if (!await confirm('Remover Tarefa', 'Deseja remover esta tarefa e todos os seus registros de tempo?', { variant: 'danger', confirmLabel: 'Remover' })) return;
    try { await projetoService.removerAtividade(projetoId, atividadeId); loadAll(); } catch { /* empty */ }
  }

  function openEditAtividade(a: AtividadeProjeto) {
    setEditingAtividade(a);
    setEditAtivTitulo(a.titulo);
    setEditAtivDescricao(a.descricao || '');
    setEditAtivDataInicio(a.dataInicio ? a.dataInicio.substring(0, 10) : '');
    setEditAtivDataFimPrevista(a.dataFimPrevista ? a.dataFimPrevista.substring(0, 10) : '');
    setEditAtivFaseId(a.faseId || '');
    setEditAtivResponsavelIds(a.responsaveis?.map((r) => r.usuarioId) || []);
  }

  function closeEditAtividade() {
    setEditingAtividade(null);
    setEditAtivTitulo('');
    setEditAtivDescricao('');
    setEditAtivDataInicio('');
    setEditAtivDataFimPrevista('');
    setEditAtivFaseId('');
    setEditAtivResponsavelIds([]);
  }

  async function handleSaveAtividade() {
    if (!editingAtividade || !editAtivTitulo.trim() || savingAtividade) return;
    setSavingAtividade(true);
    try {
      await projetoService.atualizarAtividade(projetoId, editingAtividade.id, {
        titulo: editAtivTitulo.trim(),
        descricao: editAtivDescricao.trim() || undefined,
        dataInicio: editAtivDataInicio || undefined,
        dataFimPrevista: editAtivDataFimPrevista || undefined,
        faseId: editAtivFaseId || undefined,
        responsavelIds: editAtivResponsavelIds,
      });
      closeEditAtividade();
      loadAll();
    } catch { /* empty */ }
    setSavingAtividade(false);
  }

  async function handleAddComentario() {
    if (!novoComentario.trim() || !expandedId || savingComentario) return;
    setSavingComentario(true);
    try {
      await projetoService.adicionarComentario(projetoId, expandedId, novoComentario.trim(), novoComentarioVisivel || undefined);
      setNovoComentario('');
      setNovoComentarioVisivel(false);
      loadComentarios(expandedId);
      loadAll();
    } catch { /* empty */ }
    setSavingComentario(false);
  }

  async function handleRemoveComentario(comentarioId: string) {
    if (!await confirm('Remover Nota', 'Deseja remover esta nota?')) return;
    try {
      await projetoService.removerComentario(projetoId, comentarioId);
      if (expandedId) loadComentarios(expandedId);
      loadAll();
    } catch { /* empty */ }
  }

  function startEditComentario(c: { id: string; texto: string; visivelPendencia?: boolean }) {
    setEditingComentario(c.id);
    setEditComentarioTexto(c.texto);
    setEditComentarioVisivel(c.visivelPendencia ?? false);
  }

  async function handleSaveComentario(comentarioId: string) {
    if (!editComentarioTexto.trim() || savingComentario) return;
    setSavingComentario(true);
    try {
      await projetoService.atualizarComentario(projetoId, comentarioId, editComentarioTexto.trim(), editComentarioVisivel || undefined);
      setEditingComentario(null);
      setEditComentarioTexto('');
      setEditComentarioVisivel(false);
      if (expandedId) loadComentarios(expandedId);
      loadAll();
    } catch { /* empty */ }
    setSavingComentario(false);
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
    const isEditing = editingAtividade?.id === a.id;

    // Formulario de edicao inline
    if (isEditing) {
      return (
        <div key={a.id} className="mx-3 my-2">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
            <h5 className="text-sm font-semibold text-slate-700 mb-4">Editar Tarefa</h5>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Titulo *</label>
                <input type="text" placeholder="Titulo da tarefa" value={editAtivTitulo} onChange={(e) => setEditAtivTitulo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Data Inicio</label>
                  <input type="date" value={editAtivDataInicio} onChange={(e) => setEditAtivDataInicio(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Data Fim Prevista</label>
                  <input type="date" value={editAtivDataFimPrevista} min={editAtivDataInicio || undefined} onChange={(e) => setEditAtivDataFimPrevista(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                {fases.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Fase</label>
                    <select value={editAtivFaseId} onChange={(e) => setEditAtivFaseId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Sem fase</option>
                      {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {membrosEquipe.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Responsaveis</label>
                  <MultiSelectDropdown
                    options={membrosEquipe.map((m) => ({ value: m.usuarioId, label: m.usuario.nome }))}
                    selected={editAtivResponsavelIds}
                    onChange={setEditAtivResponsavelIds}
                    placeholder="Selecione os responsaveis"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Descricao</label>
                <textarea placeholder="Descricao da tarefa (opcional) - detalhe o que precisa ser feito, parametros, configuracoes..." value={editAtivDescricao} onChange={(e) => setEditAtivDescricao(e.target.value)} rows={10} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeEditAtividade} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
                <button onClick={handleSaveAtividade} disabled={savingAtividade || !editAtivTitulo.trim()} className="bg-capul-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                  {savingAtividade ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={a.id} className="mx-3 my-2">
        <div className={`rounded-lg border ${meuRegistroAtivo ? 'border-green-300 bg-green-50/50 shadow-sm shadow-green-100' : isExpanded ? 'border-capul-300 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'} transition-all`}>
        {/* Linha principal */}
        <div className="px-4 py-3 cursor-pointer" onClick={() => toggleExpand(a.id)}>
          <div className="flex items-start gap-3">
            {/* Indicador de status (barra lateral) */}
            <div className="pt-0.5 flex-shrink-0">
              <div className={`w-1.5 h-12 rounded-full ${cfg.dot}`} />
            </div>

            {/* Conteudo principal */}
            <div className="flex-1 min-w-0">
              {/* Titulo + badges */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-[13px] font-bold leading-tight ${a.status === 'CANCELADA' ? 'text-slate-400 line-through' : a.status === 'CONCLUIDA' ? 'text-green-700' : 'text-slate-900'}`}>{a.titulo}</span>
                {meuRegistroAtivo && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full animate-pulse">
                    <Play className="w-3.5 h-3.5" /> Ativo
                  </span>
                )}
              </div>
              {/* Meta info */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {a.responsaveis && a.responsaveis.length > 0
                    ? a.responsaveis.map((r) => r.usuario.nome).join(', ')
                    : a.usuario.nome}
                </span>
                <span className="text-[11px] text-slate-400">{formatDateBR(a.dataAtividade)}</span>
                {(a.dataInicio || a.dataFimPrevista) && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {a.dataInicio ? formatDateBR(a.dataInicio) : '?'}
                    {' → '}
                    {a.dataFimPrevista ? formatDateBR(a.dataFimPrevista) : '?'}
                  </span>
                )}
                {temRegistros && !meuRegistroAtivo && (
                  <span className="text-[11px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{a._count?.registrosTempo}
                  </span>
                )}
                {(a._count?.comentarios ?? 0) > 0 && (
                  <span className="text-[11px] text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <MessageSquare className="w-3 h-3" />{a._count?.comentarios}
                  </span>
                )}
                {a.pendencia && (
                  <span className="text-[11px] text-purple-600 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <ClipboardList className="w-3 h-3" /> P#{a.pendencia.numero}
                  </span>
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
                <button onClick={() => handleIniciar(a.id)} className="inline-flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors" title="Iniciar cronometro">
                  <Play className="w-3.5 h-3.5" /> Iniciar
                </button>
              )}
              {canAdd && meuRegistroAtivo && (
                <button onClick={() => handleEncerrar(a.id)} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors" title="Encerrar cronometro">
                  <Square className="w-3.5 h-3.5" /> Encerrar
                </button>
              )}

              {/* Editar */}
              {canAdd && (
                <button onClick={() => openEditAtividade(a)} className="text-slate-300 hover:text-capul-600 transition-colors p-1" title="Editar tarefa">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Remover */}
              {canAdd && (
                <button onClick={() => handleRemoveAtividade(a.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Remover tarefa">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Expand indicator */}
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
            </div>
          </div>
          {/* Descricao — largura total, fora do flex row */}
          {a.descricao && (
            <div className="px-4 pb-3">
              <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2" style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{a.descricao}</p>
            </div>
          )}
        </div>

        {/* Registros de Tempo (expandido) */}
        {isExpanded && (
          <div className="bg-slate-50/80 px-5 py-4 border-t border-slate-200 rounded-b-lg">
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
                        {canAdd && (() => {
                          const isMeu = r.usuarioId === userId;
                          const timerAtivo = !r.horaFim;
                          const limiteD2 = new Date(); limiteD2.setDate(limiteD2.getDate() - 2); limiteD2.setHours(0, 0, 0, 0);
                          const foraDoPrazo = new Date(r.horaInicio) < limiteD2;
                          const podeEditar = !timerAtivo && (isMeu || isGestor) && (!foraDoPrazo || isGestor);
                          const motivo = timerAtivo ? 'Cronometro ativo' : !isMeu && !isGestor ? 'Registro de outro usuario' : foraDoPrazo && !isGestor ? 'Registro com mais de 2 dias' : '';
                          return (
                            <td className="py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => podeEditar && startEdit(r)} disabled={!podeEditar} className={podeEditar ? 'text-blue-500 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Ajustar'}><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => podeEditar && handleRemoveRegistro(r.id)} disabled={!podeEditar} className={podeEditar ? 'text-red-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Remover'}><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Comentarios */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Notas ({comentarios.length})
              </h5>

              {/* Form novo comentario */}
              <div className="mb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <MentionInput
                      value={novoComentario}
                      onChange={setNovoComentario}
                      usuarios={membrosEquipe.map((m) => ({ id: m.usuarioId, nome: m.usuario.nome, username: m.usuario.username }))}
                      placeholder="Adicionar nota... (use @usuario para mencionar)"
                      rows={8}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    onClick={handleAddComentario}
                    disabled={!novoComentario.trim() || savingComentario}
                    className="self-end bg-capul-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50"
                  >
                    {savingComentario ? '...' : 'Enviar'}
                  </button>
                </div>
                {a.pendencia && (
                  <label className="flex items-center gap-2 text-xs text-slate-500 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novoComentarioVisivel}
                      onChange={(e) => setNovoComentarioVisivel(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Visivel na Pendencia #{a.pendencia.numero}
                  </label>
                )}
              </div>

              {loadingComentarios ? (
                <p className="text-xs text-slate-400">Carregando...</p>
              ) : comentarios.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhuma nota</p>
              ) : (
                <div className="space-y-2">
                  {comentarios.map((c) => editingComentario === c.id ? (
                    <div key={c.id} className="bg-amber-50 rounded-lg border border-amber-300 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs mb-3">
                        <span className="font-medium text-slate-700">{c.usuario.nome}</span>
                        <span className="text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')} {new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <MentionInput
                        value={editComentarioTexto}
                        onChange={setEditComentarioTexto}
                        usuarios={membrosEquipe.map((m) => ({ id: m.usuarioId, nome: m.usuario.nome, username: m.usuario.username }))}
                        rows={8}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs mb-3"
                        placeholder="Editar nota... (use @usuario para mencionar)"
                      />
                      {a.pendencia && (
                        <label className="flex items-center gap-2 text-xs text-slate-500 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editComentarioVisivel}
                            onChange={(e) => setEditComentarioVisivel(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Visivel na Pendencia #{a.pendencia.numero}
                        </label>
                      )}
                      <div className="flex justify-end gap-3">
                        <button onClick={() => { setEditingComentario(null); setEditComentarioTexto(''); }} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
                        <button onClick={() => handleSaveComentario(c.id)} disabled={!editComentarioTexto.trim() || savingComentario} className="bg-capul-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50">
                          {savingComentario ? '...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-slate-700">{c.usuario.nome}</span>
                          <span className="text-slate-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')} {new Date(c.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {(canManage || c.usuarioId === userId) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEditComentario(c)} className="text-slate-300 hover:text-capul-600 transition-colors" title="Editar">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleRemoveComentario(c.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Remover">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.texto}</p>
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

  if (loading) return <p className="text-slate-500 text-sm">Carregando...</p>;

  return (
    <>
    {/* protecao via pai */}
    <div className="space-y-4">
      {/* Nova Atividade */}
      {canAdd && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Nova Tarefa</h4>
          <div className="space-y-3">
            <div className="flex gap-3 items-end flex-wrap">
              <input type="text" placeholder="Titulo da tarefa" value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
              <input type="date" placeholder="Inicio" value={novaDataInicio} onChange={(e) => setNovaDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-36" title="Data inicio" />
              <input type="date" placeholder="Fim previsto" value={novaDataFimPrevista} min={novaDataInicio || undefined} onChange={(e) => setNovaDataFimPrevista(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-36" title="Data fim prevista" />
              {fases.length > 0 && (
                <select value={novaFaseId} onChange={(e) => setNovaFaseId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Sem fase</option>
                  {fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              )}
              <div className="min-w-48">
                <MultiSelectDropdown
                  options={membrosEquipe.map((m) => ({ value: m.usuarioId, label: m.usuario.nome }))}
                  selected={novosResponsavelIds}
                  onChange={setNovosResponsavelIds}
                  placeholder="Responsaveis (eu)"
                />
              </div>
            </div>
            <textarea
              placeholder="Descricao da tarefa (opcional) — detalhe o que precisa ser feito, parametros, configuracoes..."
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-y"
            />
            <div className="flex justify-end">
              <button onClick={handleAddAtividade} disabled={!novoTitulo || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Adicionar</button>
            </div>
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
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 items-end flex-wrap">
              <input type="text" placeholder="Nome da fase" value={novoNomeFase} onChange={(e) => setNovoNomeFase(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
              <input type="number" placeholder="Ordem" value={novaOrdemFase} onChange={(e) => setNovaOrdemFase(e.target.value)} onKeyDown={(e) => ['e','E','+','-','.'].includes(e.key) && e.preventDefault()} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20" />
              <input type="date" value={novaFaseDataInicio} onChange={(e) => setNovaFaseDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data inicio" />
              <input type="date" value={novaFaseDataFimPrevista} min={novaFaseDataInicio || undefined} onChange={(e) => setNovaFaseDataFimPrevista(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data fim prevista" />
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
                    <div className="px-5 py-4 flex items-center justify-between bg-gradient-to-r from-capul-50 to-slate-50 cursor-pointer hover:from-capul-100 hover:to-slate-100 border-b border-slate-200 border-l-4 border-l-capul-500" onClick={() => toggleFase(f.id)}>
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronRight className="w-5 h-5 text-capul-600" /> : <ChevronDown className="w-5 h-5 text-capul-600" />}
                        <div className="flex items-center gap-2 bg-capul-600 text-white rounded-lg px-2.5 py-1">
                          <FolderKanban className="w-4 h-4" />
                          <span className="text-xs font-bold">FASE {f.ordem}</span>
                        </div>
                        <span className="text-base text-slate-900 font-bold tracking-tight">{f.nome}</span>
                        <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 font-medium">{faseAtividades.length} tarefa(s)</span>
                        {(f.dataInicio || f.dataFimPrevista) && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                            <Clock className="w-3 h-3" />
                            {f.dataInicio ? formatDateBR(f.dataInicio) : '?'}
                            {' → '}
                            {f.dataFimPrevista ? formatDateBR(f.dataFimPrevista) : '?'}
                          </span>
                        )}
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
                        {canManage && <button onClick={() => startEditFase(f)} className="text-slate-400 hover:text-capul-600" title="Editar fase"><Pencil className="w-4 h-4" /></button>}
                        {canManage && <button onClick={() => handleRemoveFase(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                    {/* Form edição inline da fase */}
                    {editingFaseId === f.id && (
                      <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex gap-3 items-end flex-wrap">
                        <input type="text" placeholder="Nome da fase" value={editFaseNome} onChange={(e) => setEditFaseNome(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48" />
                        <input type="number" placeholder="Ordem" value={editFaseOrdem} onChange={(e) => setEditFaseOrdem(e.target.value)} onKeyDown={(e) => ['e','E','+','-','.'].includes(e.key) && e.preventDefault()} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20" />
                        <input type="date" value={editFaseDataInicio} onChange={(e) => setEditFaseDataInicio(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data inicio" />
                        <input type="date" value={editFaseDataFimPrevista} min={editFaseDataInicio || undefined} onChange={(e) => setEditFaseDataFimPrevista(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data fim prevista" />
                        <button onClick={handleSaveEditFase} disabled={!editFaseNome || saving} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">Salvar</button>
                        <button onClick={() => setEditingFaseId(null)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                      </div>
                    )}
                    {/* Atividades da Fase — com indentação */}
                    {!isCollapsed && (
                      <div className="ml-6">
                        {faseAtividades.length === 0 ? (
                          <p className="px-5 py-3 text-xs text-slate-400 italic">Nenhuma tarefa nesta fase</p>
                        ) : (
                          <div className="py-1">
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
              {isCompleto ? `Tarefas sem fase (${atividadesSemFase.length})` : `Tarefas (${atividades.length})`}
            </h4>
          </div>
          {(isCompleto ? atividadesSemFase : atividades).length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">Nenhuma tarefa registrada</p>
          ) : (
            <div className="py-1">
              {(isCompleto ? atividadesSemFase : atividades).map(renderAtividade)}
            </div>
          )}
        </div>
      )}

    </div>
    </>
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
function TabCotacoes({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<CotacaoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fornecedor, setFornecedor] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [moeda, setMoeda] = useState('BRL');
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

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
    <>
    {/* protecao via pai */}
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
          <input type="number" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => ['e','E','+','-'].includes(e.key) && e.preventDefault()} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32" />
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
    </>
  );
}

// --- Tab Financeiro (Cotações + Custos mesclados) ---
function TabFinanceiro({ projetoId, projeto, canManage, onEditingChange }: { projetoId: string; projeto: Projeto; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
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
      {subTab === 'cotacoes' && <TabCotacoes projetoId={projetoId} canManage={canManage} onEditingChange={onEditingChange} />}
      {subTab === 'custos' && <TabCustosDetalhados projetoId={projetoId} canManage={canManage} onEditingChange={onEditingChange} />}
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

function TabCustosDetalhados({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
  const { confirm } = useToast();
  const [itens, setItens] = useState<CustoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaCusto>('MAO_DE_OBRA');
  const [valorPrevisto, setValorPrevisto] = useState('');
  const [valorRealizado, setValorRealizado] = useState('');
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

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
    <>
    {/* protecao via pai */}
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
          <input type="number" placeholder="Previsto" value={valorPrevisto} onChange={(e) => setValorPrevisto(e.target.value)} onKeyDown={(e) => ['e','E','+','-'].includes(e.key) && e.preventDefault()} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" />
          <input type="number" placeholder="Realizado" value={valorRealizado} onChange={(e) => setValorRealizado(e.target.value)} onKeyDown={(e) => ['e','E','+','-'].includes(e.key) && e.preventDefault()} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" />
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
    </>
  );
}

// --- Tab Riscos ---
function TabRiscos({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
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
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

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
    <>
    {/* protecao via pai */}
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
            <div>
              <label className="block text-xs text-slate-500 mb-1">Probabilidade</label>
              <select value={probabilidade} onChange={(e) => setProbabilidade(e.target.value as ProbabilidadeRisco)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {Object.entries(probabilidadeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Impacto</label>
              <select value={impacto} onChange={(e) => setImpacto(e.target.value as ImpactoRisco)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {Object.entries(impactoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
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
    </>
  );
}

// --- Tab Dependencias ---
function TabDependencias({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
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
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

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
    <>
    {/* protecao via pai */}
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
                        <a href={`/gestao-ti/projetos/${d.projetoDestino?.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline">
                          #{d.projetoDestino?.numero} - {d.projetoDestino?.nome}
                        </a>
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
                        <a href={`/gestao-ti/projetos/${d.projetoOrigem?.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline">
                          #{d.projetoOrigem?.numero} - {d.projetoOrigem?.nome}
                        </a>
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
    </>
  );
}

// --- Tab Anexos ---
function TabAnexos({ projetoId, canAdd, canManage }: { projetoId: string; canAdd: boolean; canManage: boolean }) {
  const { confirm, toast } = useToast();
  const [itens, setItens] = useState<AnexoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarAnexos(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await projetoService.uploadAnexo(projetoId, file);
      toast('success', 'Arquivo enviado com sucesso');
      load();
    } catch {
      toast('error', 'Erro ao enviar arquivo');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDownload(a: AnexoProjeto) {
    try {
      await projetoService.downloadAnexo(projetoId, a.id, a.nomeOriginal || a.titulo);
    } catch {
      toast('error', 'Erro ao baixar arquivo');
    }
  }

  async function handleRemove(anexoId: string) {
    if (!await confirm('Remover Anexo', 'Deseja remover este anexo?')) return;
    try { await projetoService.removerAnexo(projetoId, anexoId); load(); } catch { /* empty */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Anexos ({itens.length})</h4>
        {canAdd && (
          <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} disabled={uploading} />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1 text-sm text-capul-600 hover:underline disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Upload Arquivo'}
            </button>
          </div>
        )}
      </div>

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
                {a.tipo === 'ARQUIVO' ? (
                  <button onClick={() => handleDownload(a)} className="text-sm text-capul-600 hover:underline font-medium flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {a.nomeOriginal || a.titulo}
                  </button>
                ) : (
                  <a href={a.url.match(/^https?:\/\//) ? a.url : `https://${a.url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline font-medium flex items-center gap-1">
                    {a.titulo}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {a.descricao && <span className="text-xs text-slate-400">{a.descricao}</span>}
                {a.tamanho && a.tipo === 'ARQUIVO' && <span className="text-xs text-slate-400">({a.tamanho})</span>}
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
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarChamadosProjeto(projetoId)); } catch { /* empty */ }
    setLoading(false);
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
    <>
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-700">Chamados Vinculados ({itens.length})</h4>
          <div className="flex items-center gap-3">
            {canManage && (
              <button onClick={() => setShowModal(true)} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
                <Link2 className="w-4 h-4" />
                Vincular Existente
              </button>
            )}
            <a
              href={`/gestao-ti/chamados/novo?projetoId=${projetoId}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-capul-600 hover:underline"
            >
              <Plus className="w-4 h-4" />
              Novo Chamado
            </a>
          </div>
        </div>

        {loading ? (
          <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-400">Nenhum chamado vinculado</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {itens.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <a href={`/gestao-ti/chamados/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline font-medium">
                    #{c.numero}
                  </a>
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

      {showModal && (
        <ModalVincularChamadosProjeto
          projetoId={projetoId}
          itensVinculados={itens}
          onDone={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// --- Tab Usuarios-Chave ---
function TabUsuariosChave({ projetoId, canManage, onEditingChange }: { projetoId: string; canManage: boolean; onEditingChange?: (editing: boolean) => void }) {
  const { toast } = useToast();
  const [itens, setItens] = useState<UsuarioChaveProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [formUsuarioId, setFormUsuarioId] = useState('');
  const [formFuncao, setFormFuncao] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

  useEffect(() => { load(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try { setItens(await projetoService.listarUsuariosChave(projetoId)); } catch { /* empty */ }
    setLoading(false);
  }

  async function handleShowForm() {
    if (usuarios.length === 0) {
      try { setUsuarios(await coreService.listarUsuarios()); } catch { /* empty */ }
    }
    setShowForm(true);
    setFormUsuarioId('');
    setFormFuncao('');
  }

  async function handleAdd() {
    if (!formUsuarioId || !formFuncao.trim()) { toast('error', 'Preencha usuario e funcao'); return; }
    setSalvando(true);
    try {
      await projetoService.adicionarUsuarioChave(projetoId, { usuarioId: formUsuarioId, funcao: formFuncao.trim() });
      toast('success', 'Usuario-chave adicionado');
      setShowForm(false);
      load();
    } catch {
      toast('error', 'Erro ao adicionar usuario-chave');
    }
    setSalvando(false);
  }

  async function handleRemove(ucId: string) {
    if (!confirm('Desativar este usuario-chave?')) return;
    try {
      await projetoService.removerUsuarioChave(projetoId, ucId);
      toast('success', 'Usuario-chave desativado');
      load();
    } catch {
      toast('error', 'Erro ao desativar');
    }
  }

  // Filter out already-added users
  const idsExistentes = new Set(itens.filter((i) => i.ativo).map((i) => i.usuarioId));
  const usuariosDisponiveis = usuarios.filter((u) => !idsExistentes.has(u.id));

  return (
    <>
    {/* protecao via pai */}
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">
          Usuarios-Chave ({itens.filter((i) => i.ativo).length})
        </h4>
        {canManage && (
          <button onClick={handleShowForm} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Usuario</label>
              <select value={formUsuarioId} onChange={(e) => setFormUsuarioId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Selecione...</option>
                {usuariosDisponiveis.map((u) => <option key={u.id} value={u.id}>{u.nome} ({u.username})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Funcao no Projeto</label>
              <input value={formFuncao} onChange={(e) => setFormFuncao(e.target.value)} placeholder="Ex: Coordenador Financeiro" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleAdd} disabled={salvando} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
      ) : itens.filter((i) => i.ativo).length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400">Nenhum usuario-chave adicionado</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Funcao</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Desde</th>
              {canManage && <th className="px-6 py-2.5 w-10"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itens.filter((i) => i.ativo).map((uc) => (
              <tr key={uc.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-700">{uc.usuario.nome}</td>
                <td className="px-6 py-3 text-slate-500">{uc.usuario.email}</td>
                <td className="px-6 py-3 text-slate-600">{uc.funcao}</td>
                <td className="px-6 py-3 text-slate-500">{new Date(uc.createdAt).toLocaleDateString('pt-BR')}</td>
                {canManage && (
                  <td className="px-6 py-3">
                    <button onClick={() => handleRemove(uc.id)} className="text-red-500 hover:text-red-700" title="Desativar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    </>
  );
}

// --- Tab Pendencias ---
function TabPendencias({ projetoId, projetoNumero, isSubProjeto, onEditingChange }: {
  projetoId: string;
  projetoNumero?: number;
  isSubProjeto?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [itens, setItens] = useState<PendenciaProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroSearch, setFiltroSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formPrioridade, setFormPrioridade] = useState<PrioridadePendencia>('MEDIA');
  const [formResponsavelId, setFormResponsavelId] = useState('');
  const [formDataLimite, setFormDataLimite] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Protecao de edicao delegada ao pai via onEditingChange

  useEffect(() => {
    onEditingChange?.(showForm);
    return () => onEditingChange?.(false);
  }, [showForm, onEditingChange]);

  // Membros + Usuarios-chave para select de responsavel
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => { load(); loadResponsaveis(); }, [projetoId]);

  async function load() {
    setLoading(true);
    try {
      const params: { status?: string; prioridade?: string; search?: string } = {};
      if (filtroStatus) params.status = filtroStatus;
      if (filtroPrioridade) params.prioridade = filtroPrioridade;
      if (filtroSearch) params.search = filtroSearch;
      setItens(await projetoService.listarPendencias(projetoId, params));
    } catch { /* empty */ }
    setLoading(false);
  }

  async function loadResponsaveis() {
    try {
      const [projeto, membros, chaves] = await Promise.all([
        projetoService.buscar(projetoId),
        projetoService.listarMembros(projetoId),
        projetoService.listarUsuariosChave(projetoId),
      ]);
      const map = new Map<string, string>();
      // Adiciona responsavel principal do projeto
      if (projeto.responsavel) {
        map.set(projeto.responsavel.id, projeto.responsavel.nome);
      }
      // Adiciona membros da equipe
      membros.forEach((m) => map.set(m.usuario.id, m.usuario.nome));
      // Adiciona usuarios-chave ativos
      chaves.filter((c) => c.ativo).forEach((c) => map.set(c.usuarioId, c.usuario.nome));
      setResponsaveis(Array.from(map, ([id, nome]) => ({ id, nome })));
    } catch { /* empty */ }
  }

  useEffect(() => { load(); }, [filtroStatus, filtroPrioridade]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') load();
  }

  function openForm() {
    setFormTitulo('');
    setFormDescricao('');
    setFormPrioridade('MEDIA');
    setFormResponsavelId('');
    setFormDataLimite('');
    setShowForm(true);
  }

  async function handleCreate() {
    if (!formTitulo.trim() || !formResponsavelId) { toast('error', 'Preencha titulo e responsavel'); return; }
    setSalvando(true);
    try {
      await projetoService.criarPendencia(projetoId, {
        titulo: formTitulo.trim(),
        descricao: formDescricao.trim() || undefined,
        prioridade: formPrioridade,
        responsavelId: formResponsavelId,
        dataLimite: formDataLimite || undefined,
      });
      toast('success', 'Pendencia criada');
      setShowForm(false);
      await load();
    } catch {
      toast('error', 'Erro ao criar pendencia');
    }
    setSalvando(false);
  }

  function openDetail(pid: string) {
    navigate(`/gestao-ti/projetos/${projetoId}/pendencias/${pid}`);
  }

  return (
    <>
      {/* protecao via pai */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Indicador de Contexto */}
        <div className={`px-6 py-3 border-b ${isSubProjeto ? 'bg-blue-50 border-blue-200' : 'bg-capul-50 border-capul-200'}`}>
          <div className="flex items-center gap-2">
            <ClipboardList className={`w-5 h-5 ${isSubProjeto ? 'text-blue-600' : 'text-capul-600'}`} />
            <span className={`text-sm font-medium ${isSubProjeto ? 'text-blue-700' : 'text-capul-700'}`}>
              {isSubProjeto ? 'Pendencias do Sub-projeto' : 'Pendencias do Projeto Principal'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${isSubProjeto ? 'bg-blue-100 text-blue-600' : 'bg-capul-100 text-capul-600'}`}>
              #{projetoNumero}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-semibold text-slate-700">Pendencias ({itens.length})</h4>
          <button onClick={openForm} className="flex items-center gap-1 text-sm text-capul-600 hover:underline">
            <Plus className="w-4 h-4" />
            Nova Pendencia
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-3">
          <input
            value={filtroSearch}
            onChange={(e) => setFiltroSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Buscar por titulo ou #numero..."
            className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">Todos os Status</option>
            {Object.entries(pendenciaStatusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">Todas Prioridades</option>
            {Object.entries(pendenciaPrioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={load} className="text-sm text-capul-600 hover:underline">
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="px-6 py-4 border-b border-slate-200 bg-capul-50/30">
            <h5 className="text-sm font-medium text-slate-700 mb-3">Nova Pendencia</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Titulo *</label>
                <input value={formTitulo} onChange={(e) => setFormTitulo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Descricao</label>
                <textarea value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Responsavel *</label>
                <select value={formResponsavelId} onChange={(e) => setFormResponsavelId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione...</option>
                  {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Prioridade</label>
                <select value={formPrioridade} onChange={(e) => setFormPrioridade(e.target.value as PrioridadePendencia)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {Object.entries(pendenciaPrioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Data Limite</label>
                <input type="date" value={formDataLimite} onChange={(e) => setFormDataLimite(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={salvando} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {salvando ? 'Criando...' : 'Criar Pendencia'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="px-6 py-4 text-sm text-slate-400">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-400">Nenhuma pendencia encontrada</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Titulo</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Prioridade</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Responsavel</th>
                <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Data Limite</th>
                <th className="px-6 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(p.id)}>
                  <td className="px-6 py-3 text-slate-500 font-mono">{p.numero}</td>
                  <td className="px-6 py-3 font-medium text-slate-700 max-w-[300px] truncate">{p.titulo}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pendenciaStatusCores[p.status]}`}>
                      {pendenciaStatusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pendenciaPrioridadeCores[p.prioridade]}`}>
                      {pendenciaPrioridadeLabel[p.prioridade]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{p.responsavel.nome}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {p.dataLimite ? formatDateBR(p.dataLimite) : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ModalVincularChamadosProjeto({ projetoId, itensVinculados, onDone, onClose }: { projetoId: string; itensVinculados: Chamado[]; onDone: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [vinculando, setVinculando] = useState(false);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');

  const idsVinculados = new Set(itensVinculados.map((c) => c.id));

  useEffect(() => {
    Promise.all([
      chamadoService.listar(),
      equipeService.listar('ATIVO'),
    ]).then(([ch, eq]) => {
      const statusTerminais = ['RESOLVIDO', 'FECHADO', 'CANCELADO'];
      setChamados(ch.filter((c) => !c.projetoId && !idsVinculados.has(c.id) && !statusTerminais.includes(c.status)));
      setEquipes(eq);
    }).catch(() => {
      toast('error', 'Erro ao carregar chamados');
    }).finally(() => setLoading(false));
  }, []);

  const filtrados = chamados.filter((c) => {
    if (filtroStatus && c.status !== filtroStatus) return false;
    if (filtroEquipe && c.equipeAtual?.id !== filtroEquipe) return false;
    if (filtroTexto) {
      const termo = filtroTexto.toLowerCase();
      const matchNumero = String(c.numero).includes(termo);
      const matchTitulo = c.titulo.toLowerCase().includes(termo);
      if (!matchNumero && !matchTitulo) return false;
    }
    return true;
  });

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((c) => c.id)));
    }
  }

  async function handleVincular() {
    if (selecionados.size === 0) return;
    setVinculando(true);
    let count = 0;
    for (const chamadoId of selecionados) {
      try {
        await projetoService.vincularChamado(projetoId, chamadoId);
        count++;
      } catch { /* continue with next */ }
    }
    toast('success', `${count} chamado(s) vinculado(s)`);
    setVinculando(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Vincular Chamados ao Projeto</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 flex-wrap">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por numero ou titulo..."
              className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Todos os Status</option>
              {Object.entries(chamadoStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Todas as Equipes</option>
              {equipes.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.sigla} - {eq.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando chamados...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum chamado encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selecionados.size > 0 && selecionados.size === filtrados.length}
                      onChange={toggleTodos}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Titulo</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Equipe</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => toggleSelecionado(c.id)}
                    className={`cursor-pointer transition-colors ${selecionados.has(c.id) ? 'bg-capul-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => toggleSelecionado(c.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{c.numero}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[250px] truncate">{c.titulo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${chamadoStatusCores[c.status] || 'bg-slate-100 text-slate-600'}`}>
                        {chamadoStatusLabel[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.equipeAtual?.sigla || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-sm text-slate-500">
            {filtrados.length} chamado(s) encontrado(s)
            {selecionados.size > 0 && (
              <span className="ml-2 font-medium text-capul-600">{selecionados.size} selecionado(s)</span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={selecionados.size === 0 || vinculando}
              className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
            >
              {vinculando ? 'Vinculando...' : `Vincular ${selecionados.size > 0 ? `(${selecionados.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
