import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import {
  ArrowLeft, UserPlus, ArrowRightLeft, Send, CheckCircle,
  XCircle, RotateCcw, Lock, Star, Users, MessageSquare,
  Paperclip, Download, Trash2, FileText, Image, FileSpreadsheet, File,
} from 'lucide-react';
import type { Chamado, EquipeTI, AnexoChamado, StatusChamado, TipoHistorico } from '../../types';

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
  const navigate = useNavigate();
  const { usuario, gestaoTiRole } = useAuth();

  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Action states
  const [showComentario, setShowComentario] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [comentarioPublico, setComentarioPublico] = useState(true);

  const [showTransferir, setShowTransferir] = useState(false);
  const [transferirTab, setTransferirTab] = useState<'equipe' | 'tecnico'>('equipe');
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [equipeDestinoId, setEquipeDestinoId] = useState('');
  const [transferMotivo, setTransferMotivo] = useState('');
  const [membrosEquipe, setMembrosEquipe] = useState<EquipeTI | null>(null);
  const [tecnicoDestinoId, setTecnicoDestinoId] = useState('');
  const [transferTecnicoMotivo, setTransferTecnicoMotivo] = useState('');

  const [showResolver, setShowResolver] = useState(false);
  const [resolverDescricao, setResolverDescricao] = useState('');

  const [showReabrir, setShowReabrir] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState('');

  const [showAvaliar, setShowAvaliar] = useState(false);
  const [csatNota, setCsatNota] = useState(5);
  const [csatComentario, setCsatComentario] = useState('');

  // Anexos
  const [anexos, setAnexos] = useState<AnexoChamado[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';
  const isTecnico = ['ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR'].includes(gestaoTiRole || '');
  const isSolicitante = chamado?.solicitanteId === usuario?.id;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    chamadoService.buscar(id).then((data) => {
      setChamado(data);
      if (data.anexos) setAnexos(data.anexos);
    }).catch(() => setError('Chamado nao encontrado')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (showTransferir && equipes.length === 0) {
      equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
    }
    if (showTransferir && chamado?.equipeAtualId) {
      equipeService.buscar(chamado.equipeAtualId).then(setMembrosEquipe).catch(() => {});
    }
  }, [showTransferir, equipes.length, chamado?.equipeAtualId]);

  async function runAction(fn: () => Promise<Chamado>) {
    setActionLoading(true);
    setError('');
    try {
      const updated = await fn();
      // Reload full detail with historicos
      const full = await chamadoService.buscar(updated.id);
      setChamado(full);
      if (full.anexos) setAnexos(full.anexos);
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
    setTecnicoDestinoId('');
    setTransferTecnicoMotivo('');
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
    if (!chamado || !confirm('Remover este anexo?')) return;
    try {
      await chamadoService.removerAnexo(chamado.id, anexoId);
      setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch {
      setError('Erro ao remover anexo');
    }
  }

  if (loading) return <><Header title="Chamado" /><div className="p-6 text-slate-500">Carregando...</div></>;
  if (!chamado) return <><Header title="Chamado" /><div className="p-6 text-red-500">{error || 'Nao encontrado'}</div></>;

  const canAssumir = isTecnico && (chamado.status === 'ABERTO' || chamado.status === 'PENDENTE');
  const canTransferir = isTecnico && !['FECHADO', 'CANCELADO'].includes(chamado.status);
  const canResolver = isTecnico && !['FECHADO', 'CANCELADO'].includes(chamado.status);
  const canFechar = isTecnico && chamado.status === 'RESOLVIDO';
  const canReabrir = (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO');
  const canCancelar = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '') && !['FECHADO', 'CANCELADO'].includes(chamado.status);
  const canAvaliar = isSolicitante && (chamado.status === 'RESOLVIDO' || chamado.status === 'FECHADO') && !chamado.notaSatisfacao;
  const canComentar = !['FECHADO', 'CANCELADO'].includes(chamado.status);
  const canAnexar = !['FECHADO', 'CANCELADO'].includes(chamado.status);

  return (
    <>
      <Header title={`Chamado #${chamado.numero}`} />
      <div className="p-6">
        <button onClick={() => navigate('/gestao-ti/chamados')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
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
                <p className="mt-3 text-xs text-slate-500">Software: <span className="text-slate-700">{chamado.softwareNome}</span></p>
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
                <div className="p-4">
                  {anexos.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum anexo</p>
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
            <div className="flex flex-wrap gap-2">
              {canAssumir && (
                <button onClick={() => runAction(() => chamadoService.assumir(chamado.id))} disabled={actionLoading}
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
              {canTransferir && (
                <button onClick={() => { closeAllPanels(); setShowTransferir(true); setTransferirTab('equipe'); }}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg text-sm hover:bg-slate-200">
                  <ArrowRightLeft className="w-4 h-4" /> Transferir
                </button>
              )}
              {canResolver && (
                <button onClick={() => { closeAllPanels(); setShowResolver(true); }}
                  className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Resolver
                </button>
              )}
              {canFechar && (
                <button onClick={() => runAction(() => chamadoService.fechar(chamado.id))} disabled={actionLoading}
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
                <button onClick={() => { if (confirm('Cancelar este chamado?')) runAction(() => chamadoService.cancelar(chamado.id)); }} disabled={actionLoading}
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
                <textarea value={comentarioTexto} onChange={(e) => setComentarioTexto(e.target.value)} rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Escreva seu comentario..." />
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
                    Enviar
                  </button>
                  <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
              </div>
            )}

            {showTransferir && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex gap-1 border-b border-slate-200 -mx-4 px-4">
                  <button
                    onClick={() => setTransferirTab('equipe')}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      transferirTab === 'equipe'
                        ? 'border-capul-600 text-capul-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> Para Equipe</span>
                  </button>
                  <button
                    onClick={() => setTransferirTab('tecnico')}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      transferirTab === 'tecnico'
                        ? 'border-capul-600 text-capul-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Para Tecnico</span>
                  </button>
                </div>

                {transferirTab === 'equipe' && (
                  <div className="space-y-3">
                    <select value={equipeDestinoId} onChange={(e) => setEquipeDestinoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Selecione a equipe destino</option>
                      {equipes.filter((e) => e.id !== chamado.equipeAtualId).map((e) => (
                        <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                      ))}
                    </select>
                    <input value={transferMotivo} onChange={(e) => setTransferMotivo(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Motivo da transferencia (opcional)" />
                    <div className="flex gap-2">
                      <button onClick={() => runAction(() => chamadoService.transferirEquipe(chamado.id, equipeDestinoId, transferMotivo || undefined))}
                        disabled={actionLoading || !equipeDestinoId}
                        className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                        Transferir
                      </button>
                      <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                    </div>
                  </div>
                )}

                {transferirTab === 'tecnico' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Equipe atual: <strong>{chamado.equipeAtual.nome}</strong></p>
                    <select value={tecnicoDestinoId} onChange={(e) => setTecnicoDestinoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Selecione o tecnico</option>
                      {membrosEquipe?.membros
                        .filter((m) => m.status === 'ATIVO' && m.usuarioId !== chamado.tecnicoId)
                        .map((m) => (
                          <option key={m.usuarioId} value={m.usuarioId}>
                            {m.usuario.nome}{m.isLider ? ' (Lider)' : ''}
                          </option>
                        ))}
                    </select>
                    <input value={transferTecnicoMotivo} onChange={(e) => setTransferTecnicoMotivo(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Motivo da transferencia (opcional)" />
                    <div className="flex gap-2">
                      <button onClick={() => runAction(() => chamadoService.transferirTecnico(chamado.id, tecnicoDestinoId, transferTecnicoMotivo || undefined))}
                        disabled={actionLoading || !tecnicoDestinoId}
                        className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                        Transferir
                      </button>
                      <button onClick={closeAllPanels} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showResolver && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-700">Resolver Chamado</h4>
                <textarea value={resolverDescricao} onChange={(e) => setResolverDescricao(e.target.value)} rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descricao da resolucao (opcional)" />
                <div className="flex gap-2">
                  <button onClick={() => runAction(() => chamadoService.resolver(chamado.id, resolverDescricao || undefined))}
                    disabled={actionLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                    Confirmar Resolucao
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
                    Enviar Avaliacao
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
                      return (
                        <div key={h.id} className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-slate-700">{h.usuario.nome}</span>
                              <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleString('pt-BR')}</span>
                              {!h.publico && <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">INTERNO</span>}
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">{h.descricao}</p>
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
          <div className="space-y-4">
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

              {chamado.catalogoServico && (
                <InfoRow label="Servico">
                  <span className="text-xs text-slate-600">{chamado.catalogoServico.nome}</span>
                </InfoRow>
              )}

              <InfoRow label="Aberto em">
                <span className="text-xs text-slate-600">{new Date(chamado.createdAt).toLocaleString('pt-BR')}</span>
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
