import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import {
  ArrowLeft, UserPlus, ArrowRightLeft, Send, CheckCircle,
  XCircle, RotateCcw, Lock, Star, Users, MessageSquare,
  Paperclip, Download, Trash2, FileText, Image, FileSpreadsheet, File,
  Play, Square, Edit3, Check, X, Clock,
} from 'lucide-react';
import { coreService } from '../../services/core.service';
import { useToast } from '../../components/Toast';
import type { Chamado, EquipeTI, AnexoChamado, StatusChamado, TipoHistorico, ChamadoColaborador, RegistroTempoChamado, UsuarioCore } from '../../types';
import { MentionInput } from '../../components/MentionInput';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';

const statusLabels: Record<StatusChamado, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
};

const statusColors: Record<StatusChamado, string> = {
  ABERTO: 'bg-blue-100 text-blue-700 border-blue-200',
  EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PENDENTE: 'bg-orange-100 text-orange-700 border-orange-200',
  RESOLVIDO: 'bg-green-100 text-green-700 border-green-200',
  FECHADO: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELADO: 'bg-red-100 text-red-600 border-red-200',
  REABERTO: 'bg-purple-100 text-purple-700 border-purple-200',
};

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700', ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700', BAIXA: 'bg-green-100 text-green-700',
};

const tipoIcons: Record<TipoHistorico, typeof MessageSquare> = {
  ABERTURA: Send, ASSUMIDO: UserPlus, COMENTARIO: MessageSquare,
  TRANSFERENCIA_EQUIPE: ArrowRightLeft, TRANSFERENCIA_TECNICO: Users,
  RESOLVIDO: CheckCircle, FECHADO: Lock, REABERTO: RotateCcw, CANCELADO: XCircle,
  AVALIADO: Star,
};

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

  // Editar comentario
  const [editingHistoricoId, setEditingHistoricoId] = useState<string | null>(null);
  const [editingTexto, setEditingTexto] = useState('');

  // Anexos
  const [anexos, setAnexos] = useState<AnexoChamado[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Colaboradores
  const [colaboradores, setColaboradores] = useState<ChamadoColaborador[]>([]);
  const [showAddColab, setShowAddColab] = useState(false);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UsuarioCore[]>([]);
  const [colabSelecionado, setColabSelecionado] = useState('');
  const [usuariosMencao, setUsuariosMencao] = useState<UsuarioCore[]>([]);

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
    editingHistoricoId || editingReg || showAddColab
  );
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(isEditing);

  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';
  const isTecnico = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const isSolicitante = chamado?.solicitanteId === usuario?.id;
  const isTecnicoAtribuido = chamado?.tecnicoId === usuario?.id;
  const isColaborador = colaboradores.some((c) => c.usuarioId === usuario?.id);
  // Pode movimentar: gestor (override), tecnico atribuido, ou colaborador
  const podeMovimentar = isGestor || isTecnicoAtribuido || isColaborador;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    chamadoService.buscar(id).then((data) => {
      setChamado(data);
      if (data.anexos) setAnexos(data.anexos);
      if (data.colaboradores) setColaboradores(data.colaboradores);
    }).catch(() => setError('Chamado nao encontrado')).finally(() => setLoading(false));
    chamadoService.listarRegistrosTempo(id).then(setRegistrosTempo).catch(() => {});
    coreService.listarUsuarios().then(setUsuariosMencao).catch(() => {});
  }, [id]);

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

  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !chamado) return;
    setUploadingAnexo(true);
    setError('');
    try {
      const files = Array.from(e.target.files);
      const uploaded = await Promise.all(files.map((f) => chamadoService.uploadAnexo(chamado.id, f)));
      setAnexos((prev) => [...uploaded, ...prev]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao enviar anexo');
    } finally {
      setUploadingAnexo(false);
      e.target.value = '';
    }
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

  if (loading) return <><Header title="Chamado" /><div className="p-6 text-slate-500">Carregando...</div></>;
  if (!chamado) return <><Header title="Chamado" /><div className="p-6 text-red-500">{error || 'Nao encontrado'}</div></>;

  const temTecnico = !!chamado.tecnicoId;
  const finalizado = ['RESOLVIDO', 'FECHADO', 'CANCELADO'].includes(chamado.status);
  const emAndamento = !finalizado;
  const canAssumir = isTecnico && ['ABERTO', 'PENDENTE', 'REABERTO'].includes(chamado.status);
  const canTransferirEquipe = podeMovimentar && emAndamento;
  const canTransferirTecnico = podeMovimentar && emAndamento && temTecnico;
  const canResolver = podeMovimentar && emAndamento && temTecnico;
  const canFechar = podeMovimentar && chamado.status === 'RESOLVIDO';
  const canReabrir = (podeMovimentar || isSolicitante) && (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO');
  const canCancelar = isGestor && emAndamento;
  const canAvaliar = isSolicitante && (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO') && !chamado.notaSatisfacao;
  const canComentar = !finalizado && (isSolicitante || (podeMovimentar && temTecnico));
  const canAnexar = !finalizado && (isSolicitante || podeMovimentar);

  return (
    <>
      {ConfirmDialog}
      <Header title={`Chamado #${chamado.numero}`} />
      <div className="p-6">
        <button onClick={() => guardedNavigate('/gestao-ti/chamados')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header info */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-slate-800">{chamado.titulo}</h2>
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${statusColors[chamado.status]}`}>
                  {statusLabels[chamado.status]}
                </span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{chamado.descricao}</p>

              {chamado.softwareNome && (
                <p className="mt-3 text-xs text-slate-500">Software: {chamado.software ? (
                  <a href={`/gestao-ti/softwares/${chamado.software.id}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">{chamado.softwareNome}</a>
                ) : <span className="text-slate-700">{chamado.softwareNome}</span>}</p>
              )}
              {chamado.moduloNome && (
                <p className="text-xs text-slate-500">Modulo: <span className="text-slate-700">{chamado.moduloNome}</span></p>
              )}
            </div>

            {/* Anexos */}
            {(anexos.length > 0 || canAnexar) && (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Anexos {anexos.length > 0 && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{anexos.length}</span>}
                  </h4>
                  {canAnexar && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAnexo}
                        className="text-sm text-capul-600 hover:text-capul-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {uploadingAnexo ? 'Enviando...' : 'Anexar'}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleUploadAnexo}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                      />
                    </>
                  )}
                </div>
                <div
                  className="p-4 transition-colors"
                  onDragOver={(e) => { if (!canAnexar) return; e.preventDefault(); e.currentTarget.classList.add('bg-capul-50'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-capul-50'); }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-capul-50'); if (!canAnexar || !e.dataTransfer.files.length) return; const fakeEvent = { target: { files: e.dataTransfer.files, value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>; handleUploadAnexo(fakeEvent); }}
                >
                  {anexos.length === 0 ? (
                    <p className="text-sm text-slate-400">{canAnexar ? 'Nenhum anexo — arraste arquivos para ca' : 'Nenhum anexo'}</p>
                  ) : (
                    <div className="space-y-2">
                      {anexos.map((a) => {
                        const Icon = getFileIcon(a.mimeType);
                        return (
                          <div key={a.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
                            <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 truncate">{a.nomeOriginal}</p>
                              <p className="text-xs text-slate-400">
                                {formatFileSize(a.tamanho)} — {a.usuario.nome} — {new Date(a.createdAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => chamadoService.downloadAnexo(chamado.id, a.id, a.nomeOriginal)}
                                className="p-1.5 text-slate-400 hover:text-capul-600 rounded"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {isTecnico && (
                                <button
                                  onClick={() => handleRemoveAnexo(a.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
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

            {/* Actions bar */}
            {isTecnico && emAndamento && !temTecnico && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 flex-shrink-0" />
                <span>Este chamado ainda nao possui um responsavel. E necessario <strong>assumir</strong> o chamado antes de finaliza-lo.</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {canAssumir && (
                <button onClick={async () => { if (await confirm('Assumir Chamado', `Voce sera o responsavel pelo atendimento do chamado #${chamado.numero}. Deseja continuar?`, { confirmLabel: 'Sim, assumir' })) runAction(() => chamadoService.assumir(chamado.id)); }} disabled={actionLoading}
                  className="flex items-center gap-1.5 bg-capul-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                  <UserPlus className="w-4 h-4" /> Assumir
                </button>
              )}
              {canComentar && (
                <button onClick={() => { closeAllPanels(); setShowComentario(true); }}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200">
                  <MessageSquare className="w-4 h-4" /> Comentar
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
              {canAvaliar && (
                <button onClick={() => { closeAllPanels(); setShowAvaliar(true); }}
                  className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-600">
                  <Star className="w-4 h-4" /> Avaliar
                </button>
              )}
            </div>

            {/* Action panels */}
            {showComentario && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-700">Adicionar Comentario</h4>
                <MentionInput
                  value={comentarioTexto}
                  onChange={setComentarioTexto}
                  usuarios={usuariosMencao.map((u) => ({ id: u.id, nome: u.nome, username: u.username }))}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Escreva seu comentario... (use @usuario para mencionar)"
                />
                {!isUsuarioFinal && (
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={comentarioPublico} onChange={(e) => setComentarioPublico(e.target.checked)} className="rounded border-slate-300" />
                    Visivel para o solicitante
                  </label>
                )}
                <div className="flex gap-2">
                  <button onClick={() => runAction(async () => { await chamadoService.comentar(chamado.id, comentarioTexto, comentarioPublico); return chamadoService.buscar(chamado.id); })}
                    disabled={actionLoading || !comentarioTexto.trim()}
                    className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                    Salvar Comentario
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
              </div>
            )}

            {showTransferir && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
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
            )}

            {showResolver && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-700">Finalizar Chamado</h4>
                <textarea value={resolverDescricao} onChange={(e) => setResolverDescricao(e.target.value)} rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descreva a resolucao do chamado *" />
                <div className="flex gap-2">
                  <button onClick={() => runAction(() => chamadoService.resolver(chamado.id, resolverDescricao))}
                    disabled={actionLoading || !resolverDescricao.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                    Confirmar Finalizacao
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
              </div>
            )}

            {showReabrir && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-700">Reabrir Chamado</h4>
                <input value={reabrirMotivo} onChange={(e) => setReabrirMotivo(e.target.value)}
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
            )}

            {showAvaliar && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
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
            )}

            {/* Timeline */}
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700">Historico</h4>
              </div>
              <div className="p-6">
                {!chamado.historicos || chamado.historicos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum historico</p>
                ) : (
                  <div className="space-y-4">
                    {chamado.historicos.map((h) => {
                      const Icon = tipoIcons[h.tipo] || MessageSquare;
                      const papel = h.usuarioId === chamado.solicitanteId
                        ? { label: 'Solicitante', cls: 'bg-blue-100 text-blue-600' }
                        : h.usuarioId === chamado.tecnicoId
                          ? { label: 'Responsavel', cls: 'bg-capul-100 text-capul-700' }
                          : colaboradores.some((c) => c.usuarioId === h.usuarioId)
                            ? { label: 'Colaborador', cls: 'bg-amber-100 text-amber-700' }
                            : null;
                      return (
                        <div key={h.id} className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-700">{h.usuario.nome}</span>
                              {papel && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${papel.cls}`}>{papel.label}</span>}
                              <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                              {!h.publico && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">INTERNO</span>}
                            </div>
                            {h.tipo === 'COMENTARIO' && editingHistoricoId === h.id ? (
                              <div className="mt-1 space-y-2">
                                <textarea
                                  value={editingTexto}
                                  onChange={(e) => setEditingTexto(e.target.value)}
                                  rows={3}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                  autoFocus
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!editingTexto.trim()) return;
                                      try {
                                        await chamadoService.editarComentario(chamado.id, h.id, editingTexto);
                                        const updated = await chamadoService.buscar(chamado.id);
                                        setChamado(updated);
                                        setEditingHistoricoId(null);
                                      } catch { /* empty */ }
                                    }}
                                    disabled={!editingTexto.trim()}
                                    className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Salvar
                                  </button>
                                  <button
                                    onClick={() => setEditingHistoricoId(null)}
                                    className="text-sm text-slate-500 hover:text-slate-700"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2 mt-0.5 group/comment">
                                <p className="text-sm text-slate-600 flex-1">{h.descricao}</p>
                                {h.tipo === 'COMENTARIO' && (h.usuarioId === usuario?.id || isGestor) && (
                                  <button
                                    onClick={() => { setEditingHistoricoId(h.id); setEditingTexto(h.descricao); }}
                                    className="opacity-0 group-hover/comment:opacity-100 text-slate-300 hover:text-capul-600 transition-all p-0.5 flex-shrink-0"
                                    title="Editar comentario"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                            {h.equipeOrigem && h.equipeDestino && (
                              <p className="text-xs text-slate-400 mt-1">
                                {h.equipeOrigem.sigla} → {h.equipeDestino.sigla}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h4 className="font-semibold text-slate-700 text-sm">Detalhes</h4>

              <InfoRow label="Prioridade">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${prioridadeColors[chamado.prioridade]}`}>
                  {chamado.prioridade}
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
                        coreService.listarUsuarios().then(setUsuariosDisponiveis).catch(() => {});
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
          </div>
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
