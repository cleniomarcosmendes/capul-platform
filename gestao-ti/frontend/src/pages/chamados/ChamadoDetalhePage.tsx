import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import {
  ArrowLeft, UserPlus, ArrowRightLeft, CheckCircle,
  XCircle, RotateCcw, Lock, Star, Users,
  Paperclip, Download, Trash2, FileText, Image, FileSpreadsheet, File,
  Play, Square, Edit3, Check, X, Clock, Copy, Printer, Bell, Layers, Unlink, Search,
} from 'lucide-react';
import { coreService } from '../../services/core.service';
import { useToast } from '../../components/Toast';
import type { Chamado, EquipeTI, AnexoChamado, StatusChamado, ChamadoColaborador, ChamadoCopiaResumo, RegistroTempoChamado, UsuarioCore } from '../../types';

const ROLES_TI_SET = new Set(['ADMIN', 'GESTOR_TI', 'SUPORTE_TI']);
function isUsuarioTI(u: UsuarioCore): boolean {
  return (u.permissoes ?? []).some((p) => p.modulo.codigo === 'GESTAO_TI' && ROLES_TI_SET.has(p.roleModulo.codigo));
}
import { MentionInput } from '../../components/MentionInput';
import { ChatBubbleList, type ChatEvent } from '../../components/ChatBubbleList';
import { ComentarioTexto } from '../../components/ComentarioTexto';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { abrirAnexoOuBaixar } from '../../utils/anexo';

const statusLabels: Record<StatusChamado, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
  PENDENTE_USUARIO: 'Pendente Usuário',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
  AGRUPADO: 'Agrupado',
};

const statusColors: Record<StatusChamado, string> = {
  ABERTO: 'bg-blue-100 text-blue-700 border-blue-200',
  EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PENDENTE: 'bg-orange-100 text-orange-700 border-orange-200',
  PENDENTE_USUARIO: 'bg-pink-100 text-pink-800 border-pink-300',
  RESOLVIDO: 'bg-green-100 text-green-700 border-green-200',
  FECHADO: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELADO: 'bg-red-100 text-red-600 border-red-200',
  REABERTO: 'bg-purple-100 text-purple-700 border-purple-200',
  AGRUPADO: 'bg-amber-100 text-amber-700 border-amber-200',
};

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700', ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700', BAIXA: 'bg-green-100 text-green-700',
};

const prioridadeLabels: Record<string, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa',
};

// tipoIcons foi removido em 29/04/2026 — a renderização do histórico foi
// migrada pro componente ChatBubbleList (estilo WhatsApp). Os ícones agora
// vivem dentro de ChatBubbleList.

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChamadoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, gestaoTiRole } = useAuth();
  const { toast, confirm } = useToast();

  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Action states
  const [showComentario, setShowComentario] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [comentarioPublico, setComentarioPublico] = useState(true);
  // Anexos no input do comentario (chat-style 13/05/2026) — pre-upload em
  // memoria, sobe quando o usuario clica em Enviar.
  const [comentarioArquivos, setComentarioArquivos] = useState<File[]>([]);
  const comentarioFileInputRef = useRef<HTMLInputElement>(null);

  const [showTransferir, setShowTransferir] = useState(false);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [equipeDestinoId, setEquipeDestinoId] = useState('');
  const [transferMotivo, setTransferMotivo] = useState('');
  const [membrosEquipe, setMembrosEquipe] = useState<EquipeTI | null>(null);

  const [showResolver, setShowResolver] = useState(false);
  const [resolverDescricao, setResolverDescricao] = useState('');

  const [showReabrir, setShowReabrir] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState('');

  const [showAvaliar, setShowAvaliar] = useState(false);
  const [csatNota, setCsatNota] = useState(5);
  const [csatComentario, setCsatComentario] = useState('');

  // Anexos
  const [anexos, setAnexos] = useState<AnexoChamado[]>([]);
  // uploadingAnexo / fileInputRef removidos em 13/05/2026 (upload migrou
  // para o input do comentário — chat-style TOTVS). handleUploadAnexo
  // também removido (inline no botão Enviar).

  // Colaboradores
  const [colaboradores, setColaboradores] = useState<ChamadoColaborador[]>([]);
  const [showAddColab, setShowAddColab] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UsuarioCore[]>([]);
  const [colabSelecionado, setColabSelecionado] = useState('');
  const [usuariosMencao, setUsuariosMencao] = useState<UsuarioCore[]>([]);

  // Em cópia (decidido em 13/05/2026)
  const [copias, setCopias] = useState<ChamadoCopiaResumo[]>([]);
  const [showAddCopia, setShowAddCopia] = useState(false);
  const [usuariosNaoTI, setUsuariosNaoTI] = useState<UsuarioCore[]>([]);
  const [copiaBusca, setCopiaBusca] = useState('');
  const [copiaIdsParaAdicionar, setCopiaIdsParaAdicionar] = useState<string[]>([]);
  const [copiaSalvando, setCopiaSalvando] = useState(false);

  // Agrupamento (decidido em 13/05/2026)
  // Modo "este vira filho" — busca pai pra agrupar
  const [showModalAgrupar, setShowModalAgrupar] = useState(false);
  const [agruparBusca, setAgruparBusca] = useState('');
  const [agruparResultados, setAgruparResultados] = useState<Chamado[]>([]);
  const [agruparLoading, setAgruparLoading] = useState(false);
  const [agruparSalvando, setAgruparSalvando] = useState(false);
  // Modo "agrupar outros aqui" — selecao multipla, pedido suporte 13/05
  const [showModalAgruparFilhos, setShowModalAgruparFilhos] = useState(false);
  const [filhosBusca, setFilhosBusca] = useState('');
  const [filhosBuscaDebounced, setFilhosBuscaDebounced] = useState('');
  const [filhosResultados, setFilhosResultados] = useState<Chamado[]>([]);
  const [filhosLoading, setFilhosLoading] = useState(false);
  const [filhosSelecionadosIds, setFilhosSelecionadosIds] = useState<Set<string>>(new Set());
  const [filhosSalvando, setFilhosSalvando] = useState(false);

  // Registro de Tempo
  const [registrosTempo, setRegistrosTempo] = useState<RegistroTempoChamado[]>([]);
  const [showRegistros, setShowRegistros] = useState(false);
  const [editingReg, setEditingReg] = useState<string | null>(null);
  const [editRegInicio, setEditRegInicio] = useState('');
  const [editRegFim, setEditRegFim] = useState('');
  const [editRegObs, setEditRegObs] = useState('');

  // Unsaved changes protection
  const isEditing = Boolean(
    (showComentario && comentarioTexto.trim()) ||
    showTransferir || showResolver || showReabrir || showAvaliar ||
    editingReg || showAddColab
  );
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(isEditing);

  const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const isSolicitante = chamado?.solicitanteId === usuario?.id;
  const isTecnicoAtribuido = chamado?.tecnicoId === usuario?.id;
  const canEditHeader = isSolicitante || isGestor;
  const [editingHeader, setEditingHeader] = useState(false);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);
  const isColaborador = colaboradores.some((c) => c.usuarioId === usuario?.id);
  // Pode movimentar: gestor (override), tecnico atribuido, ou colaborador
  const podeMovimentar = isGestor || isTecnicoAtribuido || isColaborador;
  // Em cópia (13/05/2026): usuario tem "papel de solicitante" — pode ver,
  // comentar, anexar, adicionar mais copias. Backend ja libera; frontend
  // precisa expor os botoes (senao role USUARIO_FINAL em copia nao consegue
  // interagir).
  const isCopiado = copias.some((c) => c.usuarioId === usuario?.id);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    chamadoService.buscar(id).then((data) => {
      setChamado(data);
      if (data.anexos) setAnexos(data.anexos);
      if (data.colaboradores) setColaboradores(data.colaboradores);
      if (data.copias) setCopias(data.copias);
    }).catch(() => setError('Chamado nao encontrado')).finally(() => setLoading(false));
    chamadoService.listarRegistrosTempo(id).then(setRegistrosTempo).catch(() => {});
    coreService.listarUsuarios().then((users) => {
      setUsuariosMencao(users);
      setUsuariosNaoTI(users.filter((u) => u.id !== usuario?.id && !isUsuarioTI(u)));
    }).catch(() => {});
  }, [id, usuario?.id]);

  const [membrosEquipeDestino, setMembrosEquipeDestino] = useState<EquipeTI | null>(null);
  const [tecnicoEquipeDestinoId, setTecnicoEquipeDestinoId] = useState('');

  useEffect(() => {
    if (showTransferir && equipes.length === 0) {
      equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
    }
    if (showTransferir && chamado?.equipeAtualId) {
      equipeService.buscar(chamado.equipeAtualId).then(setMembrosEquipe).catch(() => {});
    }
  }, [showTransferir, equipes.length, chamado?.equipeAtualId]);

  useEffect(() => {
    if (equipeDestinoId) {
      setTecnicoEquipeDestinoId('');
      equipeService.buscar(equipeDestinoId).then(setMembrosEquipeDestino).catch(() => {});
    } else {
      setMembrosEquipeDestino(null);
    }
  }, [equipeDestinoId]);

  // Debounce da busca do modal "Agrupar outros aqui" (300ms)
  useEffect(() => {
    if (!showModalAgruparFilhos) return;
    const t = setTimeout(() => setFilhosBuscaDebounced(filhosBusca), 300);
    return () => clearTimeout(t);
  }, [filhosBusca, showModalAgruparFilhos]);

  // Carrega lista de chamados elegiveis (nao finalizados, com tecnico, nao
  // agrupados, nao o proprio). 25 primeiros + filtra por search.
  useEffect(() => {
    if (!showModalAgruparFilhos || !chamado) return;
    setFilhosLoading(true);
    chamadoService.listarPaginado({
      status: 'ATIVOS' as StatusChamado,
      pageSize: 25,
      search: filhosBuscaDebounced.trim() || undefined,
    }).then((res) => {
      // Chamados sem tecnico tambem podem ser agrupados — backend atribui
      // automaticamente o tecnico do agrupador (pedido suporte 13/05/2026).
      const elegiveis = res.items.filter((c) =>
        c.id !== chamado.id &&
        !['RESOLVIDO', 'FECHADO', 'CANCELADO', 'AGRUPADO'].includes(c.status),
      );
      setFilhosResultados(elegiveis);
    }).catch(() => setFilhosResultados([])).finally(() => setFilhosLoading(false));
  }, [showModalAgruparFilhos, filhosBuscaDebounced, chamado]);

  async function runAction(fn: () => Promise<Chamado>) {
    setActionLoading(true);
    setError('');
    try {
      const updated = await fn();
      // Reload full detail with historicos
      const full = await chamadoService.buscar(updated.id);
      setChamado(full);
      if (full.anexos) setAnexos(full.anexos);
      if (full.colaboradores) setColaboradores(full.colaboradores);
      if (full.copias) setCopias(full.copias);
      // Recarregar registros de tempo (importante apos resolver/reabrir)
      const regs = await chamadoService.listarRegistrosTempo(updated.id);
      setRegistrosTempo(regs);
      closeAllPanels();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro na operacao');
    } finally {
      setActionLoading(false);
    }
  }

  function closeAllPanels() {
    setShowComentario(false);
    setShowTransferir(false);
    setShowResolver(false);
    setShowReabrir(false);
    setShowAvaliar(false);
    setComentarioTexto('');
    setTransferMotivo('');
    setTecnicoEquipeDestinoId('');
    setResolverDescricao('');
    setReabrirMotivo('');
    setCsatComentario('');
  }

  async function handleRemoveAnexo(anexoId: string) {
    if (!chamado || !(await confirm('Remover Anexo', 'Deseja remover este anexo?'))) return;
    try {
      await chamadoService.removerAnexo(chamado.id, anexoId);
      setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch {
      setError('Erro ao remover anexo');
    }
  }

  // Helper unificado pra envio do compositor (Enviar, Solicitar info, Enter).
  // Solicitar info exige texto; Enviar normal permite só anexo (sem texto).
  async function handleEnviarComentario(visivel: boolean, solicitarInfo: boolean) {
    if (!chamado) return;
    if (solicitarInfo) {
      if (!comentarioTexto.trim()) return;
    } else if (!comentarioTexto.trim() && comentarioArquivos.length === 0) {
      return;
    }
    await runAction(async () => {
      let anexosIds: string[] = [];
      if (comentarioArquivos.length > 0) {
        const uploaded = await Promise.all(
          comentarioArquivos.map((f) => chamadoService.uploadAnexo(chamado.id, f)),
        );
        anexosIds = uploaded.map((a) => a.id);
      }
      await chamadoService.comentar(chamado.id, comentarioTexto, visivel, solicitarInfo, anexosIds);
      setComentarioArquivos([]);
      return chamadoService.buscar(chamado.id);
    });
  }

  if (loading) return <><Header title="Chamado" /><div className="p-6 text-slate-500">Carregando...</div></>;
  if (!chamado) return <><Header title="Chamado" /><div className="p-6 text-red-500">{error || 'Nao encontrado'}</div></>;

  const temTecnico = !!chamado.tecnicoId;
  const finalizado = ['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status);
  const emAndamento = !finalizado;
  const canAssumir = isTecnico && ['ABERTO', 'PENDENTE', 'PENDENTE_USUARIO', 'REABERTO'].includes(chamado.status);
  const canTransferirEquipe = podeMovimentar && emAndamento;
  const canTransferirTecnico = podeMovimentar && emAndamento && temTecnico;
  const canResolver = podeMovimentar && emAndamento && temTecnico;
  const canFechar = podeMovimentar && chamado.status === 'RESOLVIDO';
  const canReabrir = (podeMovimentar || isSolicitante || isCopiado) && (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO');
  const canCancelar = isGestor && emAndamento;
  const canExcluir = isTecnico && chamado.status === 'ABERTO';
  const canDuplicar = isTecnico || isSolicitante;
  const canAvaliar = isSolicitante && (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO') && !chamado.notaSatisfacao;
  const canComentar = !finalizado && (isSolicitante || isCopiado || (podeMovimentar && temTecnico));
  const canAnexar = !finalizado && (isSolicitante || isCopiado || podeMovimentar);

  return (
    <>
      {ConfirmDialog}
      <Header title={`Chamado #${chamado.numero}`} />
      <div className="p-6 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <button onClick={() => guardedNavigate('/gestao-ti/chamados')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 lg:flex-shrink-0">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm lg:flex-shrink-0">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          {/* Main content */}
          {/* Coluna principal — split-screen no lg+ (chat-style): topo
              com banners/cabeçalho, meio rolando histórico, rodapé fixo
              com ações + input de comentário (pedido suporte 14/05/2026). */}
          <div className="lg:col-span-3 flex flex-col space-y-4 lg:space-y-3 lg:min-h-0 lg:overflow-y-auto">
            {/* Topo fixo */}
            <div className="space-y-4 lg:flex-shrink-0">
            {/* Banner Pendente Usuário — visível enquanto o chamado aguarda
                a resposta do solicitante. Mostra desde quando (último evento
                SOLICITACAO_INFO). Auto-some quando o solicitante responder
                (status volta para EM_ATENDIMENTO automaticamente). */}
            {chamado.status === 'PENDENTE_USUARIO' && (() => {
              const ultimaSolicitacao = [...(chamado.historicos ?? [])]
                .reverse()
                .find((h) => h.tipo === 'SOLICITACAO_INFO');
              const desde = ultimaSolicitacao?.createdAt
                ? new Date(ultimaSolicitacao.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                : null;
              const nomeSolic = chamado.solicitante?.nome ?? 'solicitante';
              return (
                <div className="bg-pink-50 border border-pink-300 rounded-xl p-4 flex items-start gap-3">
                  <Bell className="w-5 h-5 text-pink-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-pink-900">
                    <p className="font-medium">Aguardando resposta de {nomeSolic}</p>
                    {desde && (
                      <p className="text-xs text-pink-800 mt-0.5">Desde {desde} — chamado retorna automaticamente para "Em Atendimento" assim que o solicitante comentar.</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Header info — padding compacto (13/05/2026) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start flex-wrap gap-3 mb-3">
                {editingHeader ? (
                  <input
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    className="text-lg font-semibold text-slate-800 border border-capul-300 rounded-lg px-3 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-capul-500"
                    maxLength={200}
                    autoFocus
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    {chamado.titulo}
                    {canEditHeader && (
                      <button
                        onClick={() => { setEditTitulo(chamado.titulo); setEditDescricao(chamado.descricao || ''); setEditingHeader(true); }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md transition-colors"
                        title="Editar titulo e descricao"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editar
                      </button>
                    )}
                  </h2>
                )}
                {/* Relatorio + status alinhados a direita (compacto). */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {editingHeader && (
                    <>
                      <button
                        onClick={async () => {
                          const tituloMudou = editTitulo !== chamado.titulo;
                          const descricaoMudou = editDescricao !== (chamado.descricao || '');
                          if (!tituloMudou && !descricaoMudou) {
                            setEditingHeader(false);
                            return;
                          }
                          setSavingHeader(true);
                          try {
                            const updated = await chamadoService.atualizarCabecalho(chamado.id, {
                              titulo: tituloMudou ? editTitulo : undefined,
                              descricao: descricaoMudou ? editDescricao : undefined,
                            });
                            setChamado(updated);
                            setEditingHeader(false);
                            toast('success', 'Cabecalho atualizado');
                          } catch { toast('error', 'Erro ao atualizar cabecalho'); }
                          setSavingHeader(false);
                        }}
                        disabled={savingHeader}
                        className="flex items-center gap-1 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-capul-700 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                      <button
                        onClick={() => setEditingHeader(false)}
                        className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-200"
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </>
                  )}
                  {!editingHeader && (
                    <>
                      <Link
                        to={`/gestao-ti/chamados/${chamado.id}/relatorio`}
                        className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-200"
                      >
                        <Printer className="w-3.5 h-3.5" /> Relatorio
                      </Link>
                      <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${statusColors[chamado.status]}`}>
                        {statusLabels[chamado.status]}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {editingHeader ? (
                <textarea
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                  rows={5}
                  className="w-full text-sm text-slate-600 border border-capul-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-capul-500"
                  maxLength={5000}
                />
              ) : (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{chamado.descricao}</p>
              )}

              {chamado.softwareNome && (
                <p className="mt-3 text-xs text-slate-500">Software: {chamado.software ? (
                  <a href={`/gestao-ti/softwares/${chamado.software.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">{chamado.softwareNome}</a>
                ) : <span className="text-slate-700">{chamado.softwareNome}</span>}</p>
              )}
              {chamado.moduloNome && (
                <p className="text-xs text-slate-500">Modulo: <span className="text-slate-700">{chamado.moduloNome}</span></p>
              )}
            </div>
            {isTecnico && emAndamento && !temTecnico && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 flex-shrink-0" />
                <span>Este chamado ainda nao possui um responsavel. E necessario <strong>assumir</strong> o chamado antes de finaliza-lo.</span>
              </div>
            )}
            </div>

            {/* Histórico — rolagem interna (chat-style). min-h floor: em
                alta-res/zoom o topo cresce (badges quebram) e antes o
                histórico colapsava p/ ~0; o piso garante leitura e a
                coluna rola (lg:overflow-y-auto) se não couber. */}
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col lg:flex-1 lg:min-h-[18rem] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700 text-sm">Historico</h4>
              </div>
              <div className="p-4 lg:flex-1 lg:min-h-0 overflow-y-auto">
                {!chamado.historicos || chamado.historicos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum historico</p>
                ) : (
                  <ChatBubbleList
                    sortable
                    eventos={chamado.historicos as unknown as ChatEvent[]}
                    currentUserId={usuario?.id ?? ''}
                    validAnexoIds={new Set(anexos.map((a) => a.id))}
                    getPapel={(uid) =>
                      uid === chamado.solicitanteId
                        ? { label: 'Solicitante', cls: 'bg-blue-100 text-blue-600' }
                        : uid === chamado.tecnicoId
                          ? { label: 'Responsavel', cls: 'bg-capul-100 text-capul-700' }
                          : colaboradores.some((c) => c.usuarioId === uid)
                            ? { label: 'Colaborador', cls: 'bg-amber-100 text-amber-700' }
                            : null
                    }
                    canEdit={(ev) =>
                      ev.tipo === 'COMENTARIO' && (ev.usuarioId === usuario?.id || isGestor)
                    }
                    onEditComentario={async (id, novoTexto) => {
                      await chamadoService.editarComentario(chamado.id, id, novoTexto);
                      const updated = await chamadoService.buscar(chamado.id);
                      setChamado(updated);
                    }}
                    renderTexto={(descricao) => (
                      <ComentarioTexto
                        texto={descricao}
                        anexos={anexos}
                        onDownload={(a) => abrirAnexoOuBaixar(
                          a.mimeType,
                          () => chamadoService.abrirAnexo(chamado.id, a.id, a.mimeType),
                          () => chamadoService.downloadAnexo(chamado.id, a.id, a.nomeOriginal),
                        )}
                      />
                    )}
                  />
                )}
              </div>
            </div>

            {/* Rodapé fixo — input de comentário (botões de ação ficam na sidebar — 14/05/2026) */}
            <div className="lg:flex-shrink-0">
              {/* Input de comentário sempre visível no rodapé (chat-style) */}
            {canComentar && (
              <div
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) setComentarioArquivos((prev) => [...prev, ...files]);
                }}
              >
                {/* Chips de anexos — só renderizam quando há arquivos */}
                {comentarioArquivos.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-3 pt-2 pb-1.5 border-b border-slate-100">
                    {comentarioArquivos.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-capul-50 text-capul-700 border border-capul-200 text-xs px-2 py-0.5 rounded-md">
                        <Paperclip className="w-3 h-3" />
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setComentarioArquivos((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-0.5 text-capul-500 hover:text-capul-700"
                          title="Remover"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Textarea auto-grow + contador inline discreto */}
                <div className="relative">
                  <MentionInput
                    value={comentarioTexto}
                    onChange={setComentarioTexto}
                    usuarios={usuariosMencao.map((u) => ({ id: u.id, nome: u.nome, username: u.username }))}
                    rows={3}
                    maxLength={5000}
                    className="w-full border-0 px-3 py-2 text-sm focus:outline-none focus:ring-0 resize-y"
                    placeholder="Escreva seu comentário... (use @ para mencionar)"
                  />
                  {/* Contador discreto — aparece só perto do limite (≥ 4000) */}
                  {comentarioTexto.length >= 4000 && (
                    <span
                      className={`absolute bottom-1 right-3 text-[10px] pointer-events-none bg-white/80 px-1 rounded ${
                        comentarioTexto.length >= 4900
                          ? 'text-red-600 font-semibold'
                          : comentarioTexto.length >= 4500
                          ? 'text-amber-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {comentarioTexto.length.toLocaleString('pt-BR')}/5.000
                    </span>
                  )}
                </div>

                {/* Toolbar única — botão anexar (só ícone), checkbox visível,
                    Solicitar info e Enviar. Tudo em uma linha pra economizar
                    altura (pedido suporte 14/05/2026). */}
                <div className="flex items-center gap-2 px-2 py-1.5 border-t border-slate-100 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => comentarioFileInputRef.current?.click()}
                    className="p-1.5 text-slate-500 hover:text-capul-600 hover:bg-slate-100 rounded transition-colors"
                    title="Anexar arquivos (ou arraste e solte aqui)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    ref={comentarioFileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) setComentarioArquivos((prev) => [...prev, ...files]);
                      if (comentarioFileInputRef.current) comentarioFileInputRef.current.value = '';
                    }}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                  />
                  {/* Checkbox e "Solicitar info" só pra staff TI (ADMIN/GESTOR_TI/
                      SUPORTE_TI). Antes mostrava pra todos !USUARIO_FINAL — incluindo
                      USUARIO_CHAVE/TERCEIRIZADO/DESENV — que não devem decidir
                      visibilidade interna. Backend reforça (defesa em profundidade). */}
                  {isTecnico && (
                    <label
                      className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none"
                      title="Desmarque para deixar o comentário interno (visível apenas para staff de TI — solicitante, em cópia, USUARIO_CHAVE e TERCEIRIZADO não enxergam)."
                    >
                      <input
                        type="checkbox"
                        checked={comentarioPublico}
                        onChange={(e) => setComentarioPublico(e.target.checked)}
                        className="rounded border-slate-300 w-3.5 h-3.5"
                      />
                      Visível p/ solicitante
                    </label>
                  )}
                  <div className="flex-1" />
                  {isTecnico && ['EM_ATENDIMENTO', 'PENDENTE_USUARIO'].includes(chamado.status) && (
                    <button
                      onClick={() => handleEnviarComentario(true, true)}
                      disabled={actionLoading || !comentarioTexto.trim()}
                      title="Solicita informações ao solicitante. Chamado vai para 'Pendente Usuário' até ele responder."
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1 font-medium">
                      <span aria-hidden="true">🔔</span>
                      Solicitar info
                    </button>
                  )}
                  <button
                    onClick={() => handleEnviarComentario(comentarioPublico, false)}
                    disabled={actionLoading || (!comentarioTexto.trim() && comentarioArquivos.length === 0)}
                    title="Enviar comentário"
                    className="bg-capul-600 text-white px-4 py-1.5 rounded-md text-xs font-medium hover:bg-capul-700 disabled:opacity-50">
                    Enviar
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Sidebar info — rolagem independente no lg+ */}
          <div className="lg:col-span-2 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h4 className="font-semibold text-slate-700 text-sm">Detalhes</h4>

              <InfoRow label="Prioridade">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${prioridadeColors[chamado.prioridade]}`}>
                  {prioridadeLabels[chamado.prioridade] || chamado.prioridade}
                </span>
              </InfoRow>

              <InfoRow label="Visibilidade">
                <span className="text-xs text-slate-600">{chamado.visibilidade === 'PUBLICO' ? 'Publico' : 'Privado'}</span>
              </InfoRow>

              <InfoRow label="Equipe">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chamado.equipeAtual.cor || '#006838' }} />
                  <span className="text-xs text-slate-600">{chamado.equipeAtual.nome}</span>
                </div>
              </InfoRow>

              <InfoRow label="Solicitante">
                <span className="text-xs text-slate-600">{chamado.solicitante.nome}</span>
              </InfoRow>

              {chamado.nomeColaborador && (
                <InfoRow label="Colaborador">
                  <span className="text-xs text-slate-600 font-medium">{chamado.nomeColaborador}</span>
                  {chamado.matriculaColaborador && <span className="text-xs text-slate-400 ml-1">({chamado.matriculaColaborador})</span>}
                </InfoRow>
              )}

              <InfoRow label="Tecnico">
                <span className="text-xs text-slate-600">{chamado.tecnico?.nome || 'Nao atribuido'}</span>
              </InfoRow>

              <InfoRow label="Filial">
                <span className="text-xs text-slate-600">{chamado.filial.codigo} - {chamado.filial.nomeFantasia}</span>
              </InfoRow>

              {chamado.departamento && (
                <InfoRow label="Departamento">
                  <span className="text-xs text-slate-600">{chamado.departamento.nome}</span>
                </InfoRow>
              )}

              {chamado.ativo && (
                <InfoRow label="Ativo">
                  <a href={`/gestao-ti/ativos/${chamado.ativo!.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:text-teal-700 hover:underline">
                    [{chamado.ativo.tag}] {chamado.ativo.nome}
                  </a>
                </InfoRow>
              )}

              <InfoRow label="Projeto">
                {chamado.projeto ? (
                  <a href={`/gestao-ti/projetos/${chamado.projeto.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-capul-600 hover:underline">
                    #{chamado.projeto.numero} — {chamado.projeto.nome}
                  </a>
                ) : isTecnico ? (
                  <a
                    href={`/gestao-ti/projetos/novo?chamadoId=${chamado.id}&chamadoNumero=${chamado.numero}&nome=${encodeURIComponent(`Chamado #${chamado.numero} - ${chamado.titulo}`)}&descricao=${encodeURIComponent(chamado.descricao || '')}&softwareId=${chamado.softwareId || ''}&responsavelId=${chamado.tecnicoId || ''}&solicitanteId=${chamado.solicitante?.id || ''}`}
                    className="text-xs text-capul-600 hover:underline"
                  >
                    + Gerar Projeto
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Nenhum</span>
                )}
              </InfoRow>

              {chamado.catalogoServico && (
                <InfoRow label="Servico">
                  <span className="text-xs text-slate-600">{chamado.catalogoServico.nome}</span>
                </InfoRow>
              )}

              <InfoRow label="Aberto em">
                <span className="text-xs text-slate-600">{new Date(chamado.createdAt).toLocaleString('pt-BR')}</span>
              </InfoRow>

              <InfoRow label="IP Maquina">
                <span className={`text-xs font-mono ${chamado.ipMaquina ? 'text-slate-600' : 'text-slate-400'}`}>
                  {chamado.ipMaquina || 'Nao informado'}
                </span>
              </InfoRow>

              {chamado.dataLimiteSla && (
                <InfoRow label="SLA Limite">
                  <span className={`text-xs font-medium ${new Date(chamado.dataLimiteSla) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                    {new Date(chamado.dataLimiteSla).toLocaleString('pt-BR')}
                  </span>
                </InfoRow>
              )}

              {chamado.dataResolucao && (
                <InfoRow label="Resolvido em">
                  <span className="text-xs text-slate-600">{new Date(chamado.dataResolucao).toLocaleString('pt-BR')}</span>
                </InfoRow>
              )}

              {chamado.dataFechamento && (
                <InfoRow label="Fechado em">
                  <span className="text-xs text-slate-600">{new Date(chamado.dataFechamento).toLocaleString('pt-BR')}</span>
                </InfoRow>
              )}
            </div>

            {/* Ações — barra de ações do chamado (movida para sidebar em 14/05/2026 — pedido suporte) */}
            {(canAssumir || canTransferirEquipe || canTransferirTecnico || canResolver || canFechar || canReabrir || canCancelar || canExcluir || canDuplicar || canAvaliar) && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h4 className="font-semibold text-slate-700 text-sm">Ações</h4>
                <div className="flex flex-wrap gap-2">
                  {canAssumir && (
                    <button onClick={async () => { if (await confirm('Assumir Chamado', `Voce sera o responsavel pelo atendimento do chamado #${chamado.numero}. Deseja continuar?`, { confirmLabel: 'Sim, assumir' })) runAction(() => chamadoService.assumir(chamado.id)); }} disabled={actionLoading}
                      className="flex items-center gap-1.5 bg-capul-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                      <UserPlus className="w-4 h-4" /> Assumir
                    </button>
                  )}
                  {(canTransferirEquipe || canTransferirTecnico) && (
                    <button onClick={() => { closeAllPanels(); setShowTransferir(true); }}
                      className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200">
                      <ArrowRightLeft className="w-4 h-4" /> Transferir
                    </button>
                  )}
                  {canResolver && (
                    <button onClick={() => { closeAllPanels(); setShowResolver(true); }}
                      className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700">
                      <CheckCircle className="w-4 h-4" /> Finalizar Chamado
                    </button>
                  )}
                  {canFechar && (
                    <button onClick={async () => { if (await confirm('Fechar Chamado', 'Ao fechar, o chamado nao podera mais receber interacoes. Deseja continuar?', { confirmLabel: 'Sim, fechar' })) runAction(() => chamadoService.fechar(chamado.id)); }} disabled={actionLoading}
                      className="flex items-center gap-1.5 bg-slate-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50">
                      <Lock className="w-4 h-4" /> Fechar
                    </button>
                  )}
                  {canReabrir && (
                    <button onClick={() => { closeAllPanels(); setShowReabrir(true); }}
                      className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700">
                      <RotateCcw className="w-4 h-4" /> Reabrir
                    </button>
                  )}
                  {canCancelar && (
                    <button onClick={async () => { if (await confirm('Cancelar Chamado', 'Tem certeza que deseja cancelar este chamado?', { variant: 'danger', confirmLabel: 'Sim, cancelar' })) runAction(() => chamadoService.cancelar(chamado.id)); }} disabled={actionLoading}
                      className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm hover:bg-red-200 disabled:opacity-50">
                      <XCircle className="w-4 h-4" /> Cancelar
                    </button>
                  )}
                  {canExcluir && (
                    <button onClick={async () => {
                      if (await confirm('Excluir Chamado', `Deseja excluir permanentemente o chamado #${chamado.numero}? Esta acao nao pode ser desfeita.`, { variant: 'danger', confirmLabel: 'Sim, excluir' })) {
                        try { await chamadoService.excluir(chamado.id); toast('success', `Chamado #${chamado.numero} excluido`); navigate('/gestao-ti/chamados'); } catch { toast('error', 'Erro ao excluir chamado'); }
                      }
                    }} disabled={actionLoading}
                      className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  )}
                  {canDuplicar && (
                    <button onClick={() => {
                      const params = new URLSearchParams();
                      params.set('duplicarDe', chamado.id);
                      navigate(`/gestao-ti/chamados/novo?${params.toString()}`);
                    }}
                      className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200">
                      <Copy className="w-4 h-4" /> Duplicar
                    </button>
                  )}
                  {canAvaliar && (
                    <button onClick={() => { closeAllPanels(); setShowAvaliar(true); }}
                      className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600">
                      <Star className="w-4 h-4" /> Avaliar
                    </button>
                  )}
                </div>
              </div>
            )}

            {chamado.notaSatisfacao && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="font-semibold text-slate-700 text-sm mb-3">Avaliacao (CSAT)</h4>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-5 h-5 ${n <= chamado.notaSatisfacao! ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                  ))}
                  <span className="text-sm font-medium text-slate-700 ml-2">{chamado.notaSatisfacao}/5</span>
                </div>
                {chamado.comentarioSatisfacao && (
                  <p className="text-xs text-slate-500 mt-1">"{chamado.comentarioSatisfacao}"</p>
                )}
              </div>
            )}

            {/* Registro de Tempo */}
            {podeMovimentar && temTecnico && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Tempo Dedicado
                  </h4>
                </div>

                {/* Cronometros ativos */}
                {chamado.registrosTempo && chamado.registrosTempo.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {chamado.registrosTempo.map((r) => {
                      const nome = r.usuarioId === usuario?.id ? 'Voce' : (colaboradores.find((c) => c.usuarioId === r.usuarioId)?.usuario.nome || chamado.tecnico?.nome || 'Tecnico');
                      return (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <span className="text-sm text-green-700 font-medium animate-pulse flex items-center gap-1.5">
                            <Play className="w-4 h-4" /> {nome}
                          </span>
                          {!['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status) && (isGestor || r.usuarioId === usuario?.id) && (
                            <button onClick={async () => {
                              try {
                                await chamadoService.encerrarTempo(chamado.id, r.usuarioId);
                                const updated = await chamadoService.buscar(chamado.id);
                                setChamado(updated);
                                setRegistrosTempo(await chamadoService.listarRegistrosTempo(chamado.id));
                              } catch { /* empty */ }
                            }} className="flex items-center gap-1 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">
                              <Square className="w-3.5 h-3.5" /> Encerrar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Iniciar para quem */}
                {!['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status) && (
                  <div className="mb-4">
                    <label className="block text-xs text-slate-500 mb-1.5">Iniciar cronometro para:</label>
                    <div className="space-y-2">
                      {/* Técnico responsável — só mostra botão Iniciar se for o próprio usuário ou gestor */}
                      {chamado.tecnico && !chamado.registrosTempo?.find((r) => r.usuarioId === chamado.tecnicoId) && (isGestor || chamado.tecnicoId === usuario?.id) && (
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-capul-100 text-capul-700 flex items-center justify-center text-xs font-bold">
                              {chamado.tecnico.nome.charAt(0)}
                            </div>
                            <span className="text-sm text-slate-700">{chamado.tecnico.nome} <span className="text-xs text-slate-400">(responsavel)</span></span>
                          </div>
                          <button onClick={async () => {
                            try {
                              await chamadoService.iniciarTempo(chamado.id, chamado.tecnicoId || undefined);
                              const updated = await chamadoService.buscar(chamado.id);
                              setChamado(updated);
                              setRegistrosTempo(await chamadoService.listarRegistrosTempo(chamado.id));
                            } catch { /* empty */ }
                          }} className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                            <Play className="w-3.5 h-3.5" /> Iniciar
                          </button>
                        </div>
                      )}
                      {/* Colaboradores — só mostra botão Iniciar para o próprio usuário ou gestor */}
                      {colaboradores
                        .filter((c) => !chamado.registrosTempo?.find((r) => r.usuarioId === c.usuarioId))
                        .filter((c) => isGestor || c.usuarioId === usuario?.id)
                        .map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                              {c.usuario.nome.charAt(0)}
                            </div>
                            <span className="text-sm text-slate-700">{c.usuario.nome} <span className="text-xs text-slate-400">(colaborador)</span></span>
                          </div>
                          <button onClick={async () => {
                            try {
                              await chamadoService.iniciarTempo(chamado.id, c.usuarioId);
                              const updated = await chamadoService.buscar(chamado.id);
                              setChamado(updated);
                              setRegistrosTempo(await chamadoService.listarRegistrosTempo(chamado.id));
                            } catch { /* empty */ }
                          }} className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                            <Play className="w-3.5 h-3.5" /> Iniciar
                          </button>
                        </div>
                      ))}
                      {/* Mensagem se todos já estão ativos */}
                      {!chamado.tecnico && colaboradores.length === 0 && (
                        <p className="text-sm text-slate-400">Atribua um tecnico ou adicione colaboradores</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">
                    Total: <strong className="text-slate-700 text-base">
                      {(() => {
                        const total = registrosTempo.reduce((sum, r) => sum + (r.duracaoMinutos ?? 0), 0);
                        const h = Math.floor(total / 60);
                        const m = total % 60;
                        return total > 0 ? (h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`) : '0min';
                      })()}
                    </strong>
                  </span>
                  <button onClick={() => setShowRegistros(!showRegistros)} className="text-sm text-capul-600 hover:underline">
                    {showRegistros ? 'Ocultar' : `Ver registros (${registrosTempo.length})`}
                  </button>
                </div>

                {showRegistros && registrosTempo.length > 0 && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {registrosTempo.map((r) => (
                      editingReg === r.id ? (
                        <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Inicio</label>
                              <input type="datetime-local" value={editRegInicio} onChange={(e) => setEditRegInicio(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Fim</label>
                              <input type="datetime-local" value={editRegFim} onChange={(e) => setEditRegFim(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                            </div>
                          </div>
                          <input value={editRegObs} onChange={(e) => setEditRegObs(e.target.value)} placeholder="Observacao..."
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                          <div className="flex gap-3">
                            <button onClick={async () => {
                              try {
                                await chamadoService.ajustarRegistroTempo(chamado.id, r.id, {
                                  horaInicio: editRegInicio ? new Date(editRegInicio).toISOString() : undefined,
                                  horaFim: editRegFim ? new Date(editRegFim).toISOString() : undefined,
                                  observacoes: editRegObs || undefined,
                                });
                                setEditingReg(null);
                                setRegistrosTempo(await chamadoService.listarRegistrosTempo(chamado.id));
                              } catch { /* empty */ }
                            }} className="text-sm text-green-600 hover:underline flex items-center gap-1">
                              <Check className="w-4 h-4" /> Salvar
                            </button>
                            <button onClick={() => setEditingReg(null)} className="text-sm text-slate-500 hover:underline flex items-center gap-1">
                              <X className="w-4 h-4" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={r.id} className={`p-3 rounded-lg ${!r.horaFim ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 font-medium">
                              {new Date(r.horaInicio).toLocaleDateString('pt-BR')}
                            </span>
                            {chamado.status !== 'CANCELADO' && (() => {
                              const isMeu = r.usuarioId === usuario?.id;
                              const timerAtivo = !r.horaFim;
                              const limiteD2 = new Date(); limiteD2.setDate(limiteD2.getDate() - 2); limiteD2.setHours(0, 0, 0, 0);
                              const foraDoPrazo = new Date(r.horaInicio) < limiteD2;
                              const podeEditar = !timerAtivo && (isMeu || isGestor) && (!foraDoPrazo || isGestor);
                              const motivo = timerAtivo ? 'Cronometro ativo' : !isMeu && !isGestor ? 'Registro de outro usuario' : foraDoPrazo && !isGestor ? 'Registro com mais de 2 dias' : '';
                              return (
                                <div className="flex gap-2">
                                  <button disabled={!podeEditar} onClick={() => {
                                    if (!podeEditar) return;
                                    const toLocal = (iso: string) => {
                                      const d = new Date(iso);
                                      const p = (n: number) => String(n).padStart(2, '0');
                                      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
                                    };
                                    setEditingReg(r.id);
                                    setEditRegInicio(toLocal(r.horaInicio));
                                    setEditRegFim(r.horaFim ? toLocal(r.horaFim) : '');
                                    setEditRegObs(r.observacoes || '');
                                  }} className={podeEditar ? 'text-blue-500 hover:text-blue-700' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Ajustar'}><Edit3 className="w-4 h-4" /></button>
                                  <button disabled={!podeEditar} onClick={async () => {
                                    if (!podeEditar) return;
                                    if (!(await confirm('Remover Registro', 'Deseja remover este registro de tempo?'))) return;
                                    try {
                                      await chamadoService.removerRegistroTempo(chamado.id, r.id);
                                      setRegistrosTempo(await chamadoService.listarRegistrosTempo(chamado.id));
                                    } catch { /* empty */ }
                                  }} className={podeEditar ? 'text-red-400 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'} title={motivo || 'Remover'}><Trash2 className="w-4 h-4" /></button>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="text-sm text-slate-600">
                            {new Date(r.horaInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {r.horaFim ? new Date(r.horaFim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-600 font-medium">ativo</span>}
                            {r.duracaoMinutos != null && (
                              <span className="text-capul-600 font-semibold ml-2">
                                {r.duracaoMinutos >= 60 ? `${Math.floor(r.duracaoMinutos / 60)}h${r.duracaoMinutos % 60 > 0 ? ` ${r.duracaoMinutos % 60}min` : ''}` : `${r.duracaoMinutos}min`}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">{r.usuario.nome}{r.observacoes ? ` — ${r.observacoes}` : ''}</div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Colaboradores */}
            {podeMovimentar && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" /> Colaboradores ({colaboradores.length})
                  </h4>
                  {!['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status) && chamado.tecnicoId && (
                    <button onClick={() => {
                      setShowAddColab(!showAddColab);
                      if (!showAddColab && usuariosDisponiveis.length === 0) {
                        // Filtra apenas staff de TI — colaboradores de chamado devem ser
                        // técnicos atuando, não usuários finais (mesma lógica de OS).
                        coreService.listarUsuarios().then((users) => {
                          const rolesStaff = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'];
                          const staff = users.filter((u: any) =>
                            u.permissoes?.some((p: any) => p.modulo?.codigo === 'GESTAO_TI' && rolesStaff.includes(p.roleModulo?.codigo))
                          );
                          setUsuariosDisponiveis(staff);
                        }).catch(() => {});
                      }
                    }} className="text-sm text-capul-600 hover:underline font-medium">
                      {showAddColab ? 'Cancelar' : '+ Adicionar'}
                    </button>
                  )}
                </div>

                {showAddColab && (
                  <div className="flex gap-2 mb-4">
                    <select value={colabSelecionado} onChange={(e) => setColabSelecionado(e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Selecione um tecnico...</option>
                      {usuariosDisponiveis
                        .filter((u) => u.id !== chamado.tecnicoId && u.id !== chamado.solicitanteId && !colaboradores.find((c) => c.usuarioId === u.id))
                        .map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    <button disabled={!colabSelecionado} onClick={async () => {
                      try {
                        const novo = await chamadoService.adicionarColaborador(chamado.id, colabSelecionado);
                        setColaboradores([...colaboradores, novo]);
                        setColabSelecionado('');
                        setShowAddColab(false);
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                        toast('error', msg || 'Erro ao adicionar colaborador');
                      }
                    }} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                      OK
                    </button>
                  </div>
                )}

                {colaboradores.length === 0 ? (
                  <p className="text-sm text-slate-400">{!chamado.tecnicoId ? 'Aguardando tecnico assumir o chamado' : 'Nenhum colaborador adicionado'}</p>
                ) : (
                  <div className="space-y-3">
                    {colaboradores.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-capul-100 text-capul-700 flex items-center justify-center text-xs font-bold">
                            {c.usuario.nome.charAt(0)}
                          </div>
                          <span className="text-sm text-slate-700">{c.usuario.nome}</span>
                        </div>
                        {!['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status) && (() => {
                          const temTempo = registrosTempo.some((r) => r.usuarioId === c.usuarioId);
                          return temTempo ? (
                            <span className="text-[10px] text-slate-400" title="Possui registros de tempo">com apontamento</span>
                          ) : (
                            <button onClick={async () => {
                              try {
                                await chamadoService.removerColaborador(chamado.id, c.id);
                                setColaboradores(colaboradores.filter((x) => x.id !== c.id));
                              } catch (err: unknown) {
                                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                                toast('error', msg || 'Erro ao remover colaborador');
                              }
                            }} className="text-slate-400 hover:text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Em cópia (decidido em 13/05/2026 — usuarios nao-TI envolvidos) */}
            {(() => {
              const isCopiado = copias.some((c) => c.usuarioId === usuario?.id);
              const podeAdicionarCopia = (isSolicitante || podeMovimentar || isCopiado) && !['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status);
              if (copias.length === 0 && !podeAdicionarCopia) return null;
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" /> Em cópia ({copias.length})
                    </h4>
                    {podeAdicionarCopia && (
                      <button onClick={() => { setShowAddCopia(!showAddCopia); setCopiaIdsParaAdicionar([]); setCopiaBusca(''); }}
                        className="text-sm text-capul-600 hover:underline font-medium">
                        {showAddCopia ? 'Cancelar' : '+ Adicionar'}
                      </button>
                    )}
                  </div>

                  {showAddCopia && (
                    <div className="mb-4 space-y-2">
                      <p className="text-xs text-slate-500">
                        Equipe T.I. não pode ser colocada em cópia. Adicionados recebem notificações e podem comentar.
                      </p>
                      {copiaIdsParaAdicionar.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {copiaIdsParaAdicionar.map((cid) => {
                            const u = usuariosNaoTI.find((x) => x.id === cid);
                            if (!u) return null;
                            return (
                              <span key={cid} className="inline-flex items-center gap-1 bg-capul-100 text-capul-700 text-xs px-2 py-1 rounded-full">
                                {u.nome}
                                <button type="button" onClick={() => setCopiaIdsParaAdicionar(copiaIdsParaAdicionar.filter((i) => i !== cid))}
                                  className="ml-1 text-capul-500 hover:text-capul-700">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <input
                        type="text"
                        value={copiaBusca}
                        onChange={(e) => setCopiaBusca(e.target.value)}
                        placeholder="Buscar usuário..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                      />
                      <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                        {(() => {
                          const termo = copiaBusca.trim().toLowerCase();
                          const idsJa = new Set([...copias.map((c) => c.usuarioId), ...copiaIdsParaAdicionar]);
                          const disponiveis = usuariosNaoTI
                            .filter((u) => !idsJa.has(u.id))
                            .filter((u) => !termo || u.nome.toLowerCase().includes(termo) || u.username.toLowerCase().includes(termo))
                            .slice(0, 12);
                          if (disponiveis.length === 0) return <p className="text-sm text-slate-400 p-3">{termo ? 'Nenhum resultado' : 'Digite para buscar'}</p>;
                          return disponiveis.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setCopiaIdsParaAdicionar([...copiaIdsParaAdicionar, u.id]); setCopiaBusca(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-b-0"
                            >
                              <span className="text-slate-700">{u.nome}</span>
                              <span className="text-xs text-slate-400">{u.username}</span>
                            </button>
                          ));
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={copiaIdsParaAdicionar.length === 0 || copiaSalvando}
                          onClick={async () => {
                            setCopiaSalvando(true);
                            try {
                              const res = await chamadoService.adicionarCopias(chamado.id, copiaIdsParaAdicionar);
                              const novas = await chamadoService.listarCopias(chamado.id);
                              setCopias(novas);
                              setShowAddCopia(false);
                              setCopiaIdsParaAdicionar([]);
                              if (res.erros.length > 0) {
                                toast('error', `${res.erros.length} usuario(s) nao foram adicionados (T.I.?)`);
                              } else {
                                toast('success', `${res.adicionados.length} usuario(s) adicionado(s) em copia`);
                              }
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                              toast('error', msg || 'Erro ao adicionar copias');
                            }
                            setCopiaSalvando(false);
                          }}
                          className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
                        >
                          {copiaSalvando ? 'Adicionando...' : `Adicionar ${copiaIdsParaAdicionar.length > 0 ? `(${copiaIdsParaAdicionar.length})` : ''}`}
                        </button>
                      </div>
                    </div>
                  )}

                  {copias.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum usuário em cópia</p>
                  ) : (
                    <div className="space-y-2">
                      {copias.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 py-1">
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
                            {c.usuario.nome.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-700">{c.usuario.nome}</p>
                            {c.adicionadoPor && (
                              <p className="text-[10px] text-slate-400">adicionado por {c.adicionadoPor.nome}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Anexos (movido para coluna direita em 13/05/2026 — chat-style TOTVS) */}
            {(anexos.length > 0 || canAnexar) && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Anexos {anexos.length > 0 && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{anexos.length}</span>}
                  </h4>
                </div>
                <div className="p-3">
                  {anexos.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum anexo</p>
                  ) : (
                    <div className="space-y-1.5">
                      {anexos.map((a) => {
                        const Icon = getFileIcon(a.mimeType);
                        return (
                          <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 group">
                            <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => abrirAnexoOuBaixar(
                                  a.mimeType,
                                  () => chamadoService.abrirAnexo(chamado.id, a.id, a.mimeType),
                                  () => chamadoService.downloadAnexo(chamado.id, a.id, a.nomeOriginal),
                                )}
                                className="text-xs text-capul-700 hover:underline truncate block text-left w-full"
                                title={a.nomeOriginal}
                              >
                                {a.nomeOriginal}
                              </button>
                              <p className="text-[10px] text-slate-400 truncate">
                                {formatFileSize(a.tamanho)} · {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => chamadoService.downloadAnexo(chamado.id, a.id, a.nomeOriginal)}
                                className="p-1 text-slate-400 hover:text-capul-600 rounded"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {isTecnico && (
                                <button
                                  onClick={() => handleRemoveAnexo(a.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agrupamento (decidido em 13/05/2026 — TI agrupa chamados com mesmo problema) */}
            {(() => {
              const isAgrupado = !!chamado.chamadoAgrupadorId && !!chamado.chamadoAgrupador;
              const filhos = chamado.chamadosAgrupados ?? [];
              const ehAgrupador = filhos.length > 0;
              const finalizado = ['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status);
              // Pode tornar ESTE chamado um filho de outro (busca pai)
              const podeVirarFilho = isTecnico && !finalizado && !isAgrupado && !ehAgrupador && !!chamado.tecnicoId;
              // Pode agrupar OUTROS chamados como filhos deste (selecao multipla)
              const podeReceberFilhos = isTecnico && !finalizado && !isAgrupado && !!chamado.tecnicoId;
              const podeDesagrupar = isTecnico && isAgrupado && chamado.status === 'AGRUPADO';

              if (!isAgrupado && !ehAgrupador && !podeVirarFilho && !podeReceberFilhos) return null;

              return (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      {ehAgrupador ? `Chamados agrupados (${filhos.length})` : isAgrupado ? 'Agrupado em outro chamado' : 'Agrupamento'}
                    </h4>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                    {podeReceberFilhos && (
                      <button onClick={() => { setShowModalAgruparFilhos(true); setFilhosBusca(''); setFilhosBuscaDebounced(''); setFilhosResultados([]); setFilhosSelecionadosIds(new Set()); }}
                        className="text-sm text-capul-600 hover:underline font-medium">
                        + Agrupar chamados aqui
                      </button>
                    )}
                    {podeVirarFilho && (
                      <button onClick={() => { setShowModalAgrupar(true); setAgruparBusca(''); setAgruparResultados([]); }}
                        className="text-sm text-slate-500 hover:underline">
                        Agrupar este em outro
                      </button>
                    )}
                    {podeDesagrupar && (
                      <button onClick={async () => {
                        if (!await confirm('Desagrupar chamado', 'Ele voltará ao status anterior e o SLA será retomado.', { variant: 'warning' })) return;
                        try {
                          await chamadoService.desagrupar(chamado.id);
                          const full = await chamadoService.buscar(chamado.id);
                          setChamado(full);
                          if (full.copias) setCopias(full.copias);
                          toast('success', 'Chamado desagrupado');
                        } catch (err: unknown) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                          toast('error', msg || 'Erro ao desagrupar');
                        }
                      }} className="text-sm text-amber-600 hover:underline font-medium flex items-center gap-1">
                        <Unlink className="w-3.5 h-3.5" /> Desagrupar
                      </button>
                    )}
                    </div>
                  </div>

                  {/* Estado: filho */}
                  {isAgrupado && chamado.chamadoAgrupador && (
                    <Link to={`/gestao-ti/chamados/${chamado.chamadoAgrupador.id}`}
                      className="block bg-amber-50 border border-amber-200 rounded-lg p-3 hover:bg-amber-100 transition-colors">
                      <p className="text-xs text-amber-700 font-medium">Este chamado está agrupado em:</p>
                      <p className="text-sm text-amber-900 font-semibold mt-0.5">
                        #{chamado.chamadoAgrupador.numero} — {chamado.chamadoAgrupador.titulo}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        A resposta vem pelo chamado principal. SLA pausado em {chamado.slaPausadoEm ? new Date(chamado.slaPausadoEm).toLocaleString('pt-BR') : '-'}.
                      </p>
                    </Link>
                  )}

                  {/* Estado: agrupador */}
                  {ehAgrupador && (
                    <>
                      <p className="text-xs text-slate-500 mb-3">
                        Comentários neste chamado são propagados automaticamente para os chamados filhos. Ao resolver/fechar, todos os filhos seguem em cascata.
                      </p>
                      <div className="space-y-2">
                        {filhos.map((f) => (
                          <div key={f.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <div>
                              <Link to={`/gestao-ti/chamados/${f.id}`} className="text-sm font-medium text-capul-600 hover:underline">
                                #{f.numero} — {f.titulo}
                              </Link>
                              <p className="text-xs text-slate-500">
                                Solicitante: {f.solicitante.nome}
                                {f.statusAnteriorAgrupamento && (
                                  <> · status anterior: <span className="font-medium">{f.statusAnteriorAgrupamento}</span></>
                                )}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === 'AGRUPADO' ? 'bg-amber-100 text-amber-700' : f.status === 'RESOLVIDO' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                              {f.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Hint quando ainda não está agrupado */}
                  {!isAgrupado && !ehAgrupador && (podeVirarFilho || podeReceberFilhos) && (
                    <p className="text-xs text-slate-500">
                      <strong>Agrupar chamados aqui</strong>: marque outros chamados que reportam o mesmo problema — eles viram filhos deste.
                      <br/>
                      <strong>Agrupar este em outro</strong>: marque este como filho de um chamado-pai já em andamento.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Modal: agrupar em outro chamado */}
            {showModalAgrupar && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowModalAgrupar(false)}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Agrupar em outro chamado</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Busque pelo número ou título do chamado-pai. Apenas chamados em atendimento (com técnico atribuído) podem agrupar.
                  </p>
                  <div className="relative mb-4">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={agruparBusca}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setAgruparBusca(v);
                        if (v.trim().length < 2) { setAgruparResultados([]); return; }
                        setAgruparLoading(true);
                        try {
                          const r = await chamadoService.listarPaginado({ search: v.trim(), pageSize: 10 });
                          setAgruparResultados(r.items.filter((c) =>
                            c.id !== chamado.id &&
                            !!c.tecnicoId &&
                            !['RESOLVIDO', 'FECHADO', 'CANCELADO', 'AGRUPADO'].includes(c.status)
                          ));
                        } catch { setAgruparResultados([]); }
                        setAgruparLoading(false);
                      }}
                      placeholder="Buscar por número ou título..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                    {agruparLoading ? (
                      <p className="p-4 text-sm text-slate-400">Buscando...</p>
                    ) : agruparBusca.trim().length < 2 ? (
                      <p className="p-4 text-sm text-slate-400">Digite ao menos 2 caracteres</p>
                    ) : agruparResultados.length === 0 ? (
                      <p className="p-4 text-sm text-slate-400">Nenhum chamado elegível encontrado</p>
                    ) : (
                      agruparResultados.map((c) => (
                        <button
                          key={c.id}
                          disabled={agruparSalvando}
                          onClick={async () => {
                            setAgruparSalvando(true);
                            try {
                              await chamadoService.agruparEm(chamado.id, c.id);
                              const full = await chamadoService.buscar(chamado.id);
                              setChamado(full);
                              setShowModalAgrupar(false);
                              toast('success', `Agrupado em #${c.numero}`);
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                              toast('error', msg || 'Erro ao agrupar');
                            }
                            setAgruparSalvando(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                        >
                          <p className="text-sm font-medium text-slate-700">#{c.numero} — {c.titulo}</p>
                          <p className="text-xs text-slate-500">{c.status} · {c.tecnico?.nome || 'sem técnico'}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex justify-end mt-4">
                    <button onClick={() => setShowModalAgrupar(false)} className="text-sm text-slate-500 hover:text-slate-700">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: agrupar OUTROS chamados aqui (selecao multipla — pedido suporte 13/05/2026) */}
            {showModalAgruparFilhos && (() => {
              // Carrega resultados ao abrir o modal (busca vazia mostra primeiros N)
              return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModalAgruparFilhos(false)}>
                  <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">Agrupar chamados neste #{chamado.numero}</h3>
                      <p className="text-sm text-slate-500">
                        Marque os chamados que reportam o mesmo problema. Eles vão virar filhos deste e seu SLA será pausado até desagrupamento ou resolução.
                      </p>
                    </div>
                    <div className="p-6 border-b border-slate-200">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={filhosBusca}
                          onChange={(e) => setFilhosBusca(e.target.value)}
                          placeholder="Buscar por número, título, descrição ou solicitante..."
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                          autoFocus
                        />
                      </div>
                      {filhosSelecionadosIds.size > 0 && (
                        <p className="text-xs text-capul-700 mt-2 font-medium">
                          {filhosSelecionadosIds.size} chamado(s) selecionado(s)
                        </p>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {filhosLoading ? (
                        <p className="p-6 text-sm text-slate-400 text-center">Buscando...</p>
                      ) : filhosResultados.length === 0 ? (
                        <p className="p-6 text-sm text-slate-400 text-center">
                          {filhosBuscaDebounced.trim().length > 0 ? 'Nenhum chamado elegível encontrado' : 'Carregando chamados...'}
                        </p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {filhosResultados.map((c) => {
                            const marcado = filhosSelecionadosIds.has(c.id);
                            return (
                              <li key={c.id}>
                                <label className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    onChange={(e) => {
                                      setFilhosSelecionadosIds((prev) => {
                                        const next = new Set(prev);
                                        if (e.target.checked) next.add(c.id); else next.delete(c.id);
                                        return next;
                                      });
                                    }}
                                    className="mt-1 rounded border-slate-300"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-slate-700">#{c.numero}</span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.status}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 truncate">{c.titulo}</p>
                                    <p className="text-xs text-slate-500">
                                      Solicitante: {c.solicitante?.nome ?? '-'}
                                      {c.tecnico?.nome && ` · Técnico: ${c.tecnico.nome}`}
                                    </p>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-2xl">
                      <button onClick={() => setShowModalAgruparFilhos(false)} className="text-sm text-slate-500 hover:text-slate-700">
                        Cancelar
                      </button>
                      <button
                        disabled={filhosSelecionadosIds.size === 0 || filhosSalvando}
                        onClick={async () => {
                          setFilhosSalvando(true);
                          try {
                            const ids = Array.from(filhosSelecionadosIds);
                            const res = await chamadoService.agruparMultiplos(chamado.id, ids);
                            const full = await chamadoService.buscar(chamado.id);
                            setChamado(full);
                            setShowModalAgruparFilhos(false);
                            setFilhosSelecionadosIds(new Set());
                            if (res.erros.length > 0) {
                              toast('error', `${res.agrupados.length} agrupados, ${res.erros.length} com erro: ${res.erros[0].motivo}`);
                            } else {
                              toast('success', `${res.agrupados.length} chamado(s) agrupado(s)`);
                            }
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                            toast('error', msg || 'Erro ao agrupar');
                          }
                          setFilhosSalvando(false);
                        }}
                        className="bg-capul-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
                      >
                        {filhosSalvando ? 'Agrupando...' : `Agrupar selecionados${filhosSelecionadosIds.size > 0 ? ` (${filhosSelecionadosIds.size})` : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Modais de ação — overlays centrais (convertidos de painéis inline em 14/05/2026) */}
            {showTransferir && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeAllPanels}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" /> Transferir Chamado
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Equipe</label>
                    <select value={equipeDestinoId} onChange={(e) => setEquipeDestinoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Selecione a equipe</option>
                      {equipes.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.sigla} - {e.nome}{e.id === chamado.equipeAtualId ? ' (atual)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {equipeDestinoId && (equipeDestinoId === chamado.equipeAtualId ? membrosEquipe : membrosEquipeDestino) && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        {equipeDestinoId === chamado.equipeAtualId ? 'Transferir para tecnico' : 'Indicar tecnico (opcional)'}
                      </label>
                      <select value={tecnicoEquipeDestinoId} onChange={(e) => setTecnicoEquipeDestinoId(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="">{equipeDestinoId === chamado.equipeAtualId ? 'Selecione o tecnico' : 'Nenhum (equipe assume)'}</option>
                        {(equipeDestinoId === chamado.equipeAtualId ? membrosEquipe : membrosEquipeDestino)?.membros
                          ?.filter((m) => m.status === 'ATIVO' && m.usuarioId !== chamado.tecnicoId)
                          .map((m) => (
                            <option key={m.usuarioId} value={m.usuarioId}>
                              {m.usuario.nome}{m.isLider ? ' (Lider)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <input value={transferMotivo} onChange={(e) => setTransferMotivo(e.target.value)}
                    maxLength={1000}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Motivo da transferencia (opcional)" />
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (equipeDestinoId === chamado.equipeAtualId) {
                        // Transferir para tecnico da mesma equipe
                        runAction(() => chamadoService.transferirTecnico(chamado.id, tecnicoEquipeDestinoId, transferMotivo || undefined));
                      } else {
                        // Transferir para outra equipe
                        runAction(() => chamadoService.transferirEquipe(chamado.id, equipeDestinoId, transferMotivo || undefined, tecnicoEquipeDestinoId || undefined));
                      }
                    }}
                      disabled={actionLoading || !equipeDestinoId || (equipeDestinoId === chamado.equipeAtualId && !tecnicoEquipeDestinoId)}
                      className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                      Transferir
                    </button>
                    <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </div>
                </div>
              </div>
            )}

            {showResolver && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeAllPanels}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-medium text-sm text-slate-700">Finalizar Chamado</h4>
                <textarea value={resolverDescricao} onChange={(e) => setResolverDescricao(e.target.value)} rows={3}
                  maxLength={5000}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descreva a resolucao do chamado *" />
                <div className="flex justify-end">
                  <span
                    className={`text-xs ${
                      resolverDescricao.length >= 4900
                        ? 'text-red-600 font-semibold'
                        : resolverDescricao.length >= 4500
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {resolverDescricao.length.toLocaleString('pt-BR')} / 5.000
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => runAction(() => chamadoService.resolver(chamado.id, resolverDescricao))}
                    disabled={actionLoading || !resolverDescricao.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                    Confirmar Finalizacao
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
                </div>
              </div>
            )}

            {showReabrir && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeAllPanels}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-medium text-sm text-slate-700">Reabrir Chamado</h4>
                <input value={reabrirMotivo} onChange={(e) => setReabrirMotivo(e.target.value)}
                  maxLength={1000}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Motivo da reabertura (opcional)" />
                <div className="flex gap-2">
                  <button onClick={() => runAction(() => chamadoService.reabrir(chamado.id, reabrirMotivo || undefined))}
                    disabled={actionLoading}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                    Confirmar Reabertura
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
                </div>
              </div>
            )}

            {showAvaliar && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeAllPanels}>
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-medium text-sm text-slate-700">Avaliar Atendimento</h4>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nota (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setCsatNota(n)} className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors ${csatNota >= n ? 'bg-amber-400 border-amber-500 text-white' : 'bg-white border-slate-300 text-slate-500 hover:border-amber-300'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={csatComentario} onChange={(e) => setCsatComentario(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Comentario (opcional)" />
                <div className="flex gap-2">
                  <button onClick={() => runAction(() => chamadoService.avaliar(chamado.id, csatNota, csatComentario || undefined))}
                    disabled={actionLoading}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50">
                    Salvar Avaliacao
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </div>
  );
}
