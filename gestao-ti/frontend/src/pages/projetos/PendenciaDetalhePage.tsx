import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { projetoService } from '../../services/projeto.service';
import {
  ArrowLeft, ChevronRight, Paperclip, Download, Trash2, Send, ClipboardList, Clock, Plus, CheckCircle, Circle, Loader,
  Edit3, X, MessageSquare,
} from 'lucide-react';
import type { PendenciaProjeto, StatusPendencia, AnexoPendenciaItem, MembroProjeto } from '../../types';
import { formatDateBR } from '../../utils/date';
import { abrirAnexoOuBaixar } from '../../utils/anexo';
import { MentionInput } from '../../components/MentionInput';
import { ChatBubbleList, type ChatEvent } from '../../components/ChatBubbleList';

// Labels customizadas para os tipos de InteracaoPendencia (13/05/2026 —
// chat-style igual ao chamado).
const PENDENCIA_SYSTEM_LABELS: Record<string, string> = {
  STATUS_ALTERADO: 'Status alterado',
  RESPONSAVEL_ALTERADO: 'Responsável alterado',
  ANEXO: 'Anexo enviado',
};

const pendenciaStatusLabel: Record<string, string> = {
  ABERTA: 'Aberta', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_VALIDACAO: 'Aguardando Validacao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
};
const pendenciaStatusCores: Record<string, string> = {
  ABERTA: 'bg-blue-100 text-blue-700', EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700', AGUARDANDO_VALIDACAO: 'bg-orange-100 text-orange-700', CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-slate-100 text-slate-600',
};
const pendenciaPrioridadeLabel: Record<string, string> = {
  BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta', URGENTE: 'Urgente',
};
const pendenciaPrioridadeCores: Record<string, string> = {
  BAIXA: 'bg-green-100 text-green-700', MEDIA: 'bg-yellow-100 text-yellow-700', ALTA: 'bg-orange-100 text-orange-700', URGENTE: 'bg-red-100 text-red-700',
};

export function PendenciaDetalhePage() {
  const { projetoId, pendenciaId } = useParams<{ projetoId: string; pendenciaId: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole, usuario } = useAuth();
  const { toast, confirm } = useToast();
  const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const canManage = gestaoTiRole !== 'USUARIO_FINAL' && Boolean(gestaoTiRole);
  const isStaffTI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const isRestrictedRole = ['USUARIO_CHAVE', 'TERCEIRIZADO'].includes(gestaoTiRole || '');

  const [pendencia, setPendencia] = useState<PendenciaProjeto | null>(null);
  const [projeto, setProjeto] = useState<{ id: string; numero: number; nome: string; responsavelId?: string; projetoPai?: { id: string; numero: number; nome: string } | null } | null>(null);

  // USUARIO_CHAVE/TERCEIRIZADO podem gerar atividade somente no SEU subprojeto próprio
  // (alinhado com `isSubprojetoProprio` do ProjetoDetalhePage e backend que já libera o endpoint).
  // Memory `melhorias_17abr2026.md`: subprojetos liberam fases/atividades para esses roles.
  const isSubprojetoProprio = isRestrictedRole
    && !!projeto?.projetoPai
    && projeto?.responsavelId === usuario?.id;
  const canGerarAtividade = isStaffTI || isSubprojetoProprio;
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState('');
  // Nasce DESMARCADO (interna) — conceito restritivo, simétrico à aba
  // Conversa da Atividade (decisão Clenio 16/05): nota de pendência é
  // trabalho interno de equipe; só staff TI marca p/ liberar a UC/Terc.
  const [comentarioPublico, setComentarioPublico] = useState(false);
  // Anexos no input do comentário (chat-style 13/05/2026)
  const [comentarioArquivos, setComentarioArquivos] = useState<File[]>([]);
  const comentarioFileInputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  // editingInteracaoId/editingTexto removidos em 13/05/2026 — edicao agora
  // acontece dentro do ChatBubbleList (mesma mecanica do chamado).
  const [uploading, setUploading] = useState(false);
  const [gerandoAtividade, setGerandoAtividade] = useState(false);
  const [membrosEquipe, setMembrosEquipe] = useState<MembroProjeto[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editPrioridade, setEditPrioridade] = useState('');
  const [editResponsavelId, setEditResponsavelId] = useState('');
  const [editDataLimite, setEditDataLimite] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [responsaveis, setResponsaveis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (projetoId && pendenciaId) {
      loadData();
    }
  }, [projetoId, pendenciaId]);

  async function loadData() {
    setLoading(true);
    try {
      const [pend, proj, membros, chaves] = await Promise.all([
        projetoService.buscarPendencia(projetoId!, pendenciaId!),
        projetoService.buscar(projetoId!),
        projetoService.listarMembros(projetoId!),
        projetoService.listarUsuariosChave(projetoId!),
      ]);
      setPendencia(pend);
      setProjeto({
        id: proj.id,
        numero: proj.numero,
        nome: proj.nome,
        responsavelId: proj.responsavel?.id,
        projetoPai: proj.projetoPai,
      });
      setMembrosEquipe(membros);
      const map = new Map<string, string>();
      if (proj.responsavel) map.set(proj.responsavel.id, proj.responsavel.nome);
      membros.forEach((m) => map.set(m.usuario.id, m.usuario.nome));
      chaves.filter((c) => c.ativo).forEach((c) => map.set(c.usuarioId, c.usuario.nome));
      setResponsaveis(Array.from(map, ([id, nome]) => ({ id, nome })));
    } catch {
      toast('error', 'Erro ao carregar pendencia');
    }
    setLoading(false);
  }

  function startEdit() {
    if (!pendencia) return;
    setEditTitulo(pendencia.titulo);
    setEditDescricao(pendencia.descricao || '');
    setEditPrioridade(pendencia.prioridade);
    setEditResponsavelId(pendencia.responsavel.id);
    setEditDataLimite(pendencia.dataLimite ? pendencia.dataLimite.substring(0, 10) : '');
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!pendencia || !editTitulo.trim() || !editResponsavelId) return;
    setSalvandoEdicao(true);
    try {
      await projetoService.atualizarPendencia(projetoId!, pendencia.id, {
        titulo: editTitulo.trim(),
        descricao: editDescricao.trim() || undefined,
        prioridade: editPrioridade as any,
        responsavelId: editResponsavelId,
        dataLimite: editDataLimite || undefined,
      });
      toast('success', 'Pendencia atualizada');
      setEditing(false);
      loadData();
    } catch {
      toast('error', 'Erro ao atualizar pendencia');
    }
    setSalvandoEdicao(false);
  }

  async function handleStatusChange(newStatus: StatusPendencia) {
    if (!pendencia) return;
    try {
      await projetoService.atualizarPendencia(projetoId!, pendencia.id, { status: newStatus });
      toast('success', 'Status atualizado');
      loadData();
    } catch (err: any) {
      toast('error', err?.response?.data?.message || 'Erro ao atualizar status');
    }
  }

  async function handleAddComentario() {
    if ((!comentario.trim() && comentarioArquivos.length === 0) || !pendencia) return;
    setEnviando(true);
    try {
      // Upload de anexos antes (chat-style — FK interacaoId atualizada
      // no service de criar interacao)
      let anexosIds: string[] = [];
      if (comentarioArquivos.length > 0) {
        const uploaded = await Promise.all(
          comentarioArquivos.map((f) => projetoService.uploadAnexoPendencia(projetoId!, pendencia.id, f)),
        );
        anexosIds = uploaded.map((a) => a.id);
      }
      await projetoService.adicionarInteracaoPendencia(projetoId!, pendencia.id, {
        descricao: comentario.trim() || '(anexo)',
        publica: comentarioPublico,
        anexosIds: anexosIds.length > 0 ? anexosIds : undefined,
      });
      setComentario('');
      setComentarioArquivos([]);
      toast('success', 'Comentario adicionado');
      loadData();
    } catch {
      toast('error', 'Erro ao adicionar comentario');
    }
    setEnviando(false);
  }

  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendencia) return;
    setUploading(true);
    try {
      await projetoService.uploadAnexoPendencia(projetoId!, pendencia.id, file);
      toast('success', 'Anexo enviado');
      loadData();
    } catch {
      toast('error', 'Erro ao enviar anexo');
    }
    setUploading(false);
    e.target.value = '';
  }

  // Abre o anexo no browser se viewable; fallback pra download (paridade com Chamado).
  function handleAbrirAnexo(anexo: AnexoPendenciaItem) {
    if (!pendencia) return;
    abrirAnexoOuBaixar(
      anexo.mimeType,
      () => projetoService.abrirAnexoPendencia(projetoId!, pendencia.id, anexo.id, anexo.mimeType),
      () => handleDownloadAnexo(anexo),
    );
  }

  async function handleDownloadAnexo(anexo: AnexoPendenciaItem) {
    if (!pendencia) return;
    try {
      const blob = await projetoService.downloadAnexoPendencia(projetoId!, pendencia.id, anexo.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nomeOriginal;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('error', 'Erro ao baixar anexo');
    }
  }

  async function handleRemoveAnexo(anexoId: string) {
    if (!pendencia) return;
    if (!await confirm('Remover Anexo', 'Deseja remover este anexo?')) return;
    try {
      await projetoService.removerAnexoPendencia(projetoId!, pendencia.id, anexoId);
      toast('success', 'Anexo removido');
      loadData();
    } catch {
      toast('error', 'Erro ao remover anexo');
    }
  }

  const [showGerarForm, setShowGerarForm] = useState(false);
  const [gerarTitulo, setGerarTitulo] = useState('');

  function handleOpenGerarAtividade() {
    if (!pendencia) return;
    setGerarTitulo(`[PEND-#${pendencia.numero}] ${pendencia.titulo}`);
    setShowGerarForm(true);
  }

  async function handleGerarAtividade() {
    if (!pendencia || !gerarTitulo.trim()) return;

    setGerandoAtividade(true);
    try {
      await projetoService.gerarAtividadeFromPendencia(projetoId!, pendencia.id, { titulo: gerarTitulo.trim() });
      toast('success', 'Atividade gerada com sucesso');
      setShowGerarForm(false);
      navigate(`/gestao-ti/projetos/${projetoId}?tab=atividades`);
    } catch {
      toast('error', 'Erro ao gerar atividade');
      setGerandoAtividade(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Pendencia" />
        <div className="p-6">
          <p className="text-slate-500">Carregando...</p>
        </div>
      </>
    );
  }

  if (!pendencia || !projeto) {
    return (
      <>
        <Header title="Pendencia" />
        <div className="p-6">
          <p className="text-red-500">Pendencia nao encontrada</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-capul-600 hover:underline">Voltar</button>
        </div>
      </>
    );
  }

  const isVencida = pendencia.dataLimite && new Date(pendencia.dataLimite) < new Date() && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status);
  const isSubProjeto = !!projeto.projetoPai;
  // Pendencia finalizada (CONCLUIDA/CANCELADA): backend bloqueia novos
  // comentarios (BadRequest "Nao e possivel comentar em pendencia
  // finalizada") — UI esconde compositor pra nao deixar usuario tentar
  // (fix 14/05/2026 — incidente Marco Antonio).
  const isFinalizada = ['CONCLUIDA', 'CANCELADA'].includes(pendencia.status);

  return (
    <>
      <Header title={`Pendencia #${pendencia.numero}`} />
      <div className="p-6 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm mb-4 lg:flex-shrink-0">
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
          <Link to={`/gestao-ti/projetos/${projeto.id}`} className="text-slate-500 hover:text-capul-600">
            #{projeto.numero} {projeto.nome}
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700 font-medium">Pendencia #{pendencia.numero}</span>
        </nav>

        <button onClick={() => navigate(`/gestao-ti/projetos/${projeto.id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 lg:flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Projeto #{projeto.numero}
        </button>

        {/* Indicador de Contexto */}
        <div className={`rounded-xl border p-4 mb-6 lg:flex-shrink-0 ${isSubProjeto ? 'bg-blue-50 border-blue-200' : 'bg-capul-50 border-capul-200'}`}>
          <div className="flex items-center gap-2">
            <ClipboardList className={`w-5 h-5 ${isSubProjeto ? 'text-blue-600' : 'text-capul-600'}`} />
            <span className={`text-sm font-medium ${isSubProjeto ? 'text-blue-700' : 'text-capul-700'}`}>
              {isSubProjeto ? 'Pendencia do Sub-projeto' : 'Pendencia do Projeto Principal'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${isSubProjeto ? 'bg-blue-100 text-blue-600' : 'bg-capul-100 text-capul-600'}`}>
              #{projeto.numero}
            </span>
          </div>
        </div>

        {/* Layout 2 colunas chat-style (14/05/2026 — paridade total com chamado).
            Principal: histórico rolando + compositor fixo no rodapé.
            Direita: detalhes + ações + atividades + anexos + notas. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          <div className="lg:col-span-3 flex flex-col space-y-3 lg:min-h-0 lg:overflow-hidden">
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col lg:flex-1 lg:min-h-0 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700 text-sm">Historico ({pendencia.interacoes?.length || 0})</h4>
              </div>
              <div className="p-4 lg:flex-1 lg:min-h-0 overflow-y-auto">
          {(pendencia.interacoes || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma interacao</p>
          ) : (
            <ChatBubbleList
              sortable
              eventos={(pendencia.interacoes || []).map((inter) => ({
                id: inter.id,
                tipo: inter.tipo,
                descricao: inter.descricao || '',
                usuarioId: inter.usuarioId,
                usuario: inter.usuario,
                publico: inter.publica,
                createdAt: inter.createdAt,
              })) as ChatEvent[]}
              currentUserId={usuario?.id ?? ''}
              systemLabels={PENDENCIA_SYSTEM_LABELS}
              getPapel={(uid) =>
                uid === pendencia.responsavel.id
                  ? { label: 'Responsavel', cls: 'bg-capul-100 text-capul-700' }
                  : uid === pendencia.criador.id
                    ? { label: 'Criador', cls: 'bg-blue-100 text-blue-600' }
                    : null
              }
              canEdit={(ev) =>
                ev.tipo === 'COMENTARIO' && (ev.usuarioId === usuario?.id || isGestor)
              }
              onEditComentario={async (id, novoTexto) => {
                await projetoService.editarInteracaoPendencia(projetoId!, pendencia.id, id, novoTexto);
                const updated = await projetoService.buscarPendencia(projetoId!, pendencia.id);
                setPendencia(updated);
              }}
              renderTexto={(descricao, eventId) => {
                // Lookup por id (era find-by-descricao, ambiguo quando dois
                // comentarios tem texto identico — fix 14/05/2026).
                const inter = (pendencia.interacoes || []).find((i) => i.id === eventId);
                const anexos = inter?.anexos ?? [];
                // Orfao = interacao tinha anexo(s) que foram removidos e nenhum
                // sobrou. Quando alguns sobraram, mostra so os chips dos vivos
                // (sem barulho do flag).
                const anexoOrfao = anexos.length === 0 && !!inter?.anexoRemovido;
                // "(anexo)" eh descricao auto-gerada pra comentario so-com-anexo.
                // Esconde o placeholder quando estamos exibindo chip(s) ou
                // o aviso de orfao (texto fica redundante).
                const textoVisivel = (anexos.length > 0 || anexoOrfao) && descricao === '(anexo)' ? '' : descricao;
                return (
                  <span className="whitespace-pre-wrap">
                    {textoVisivel}
                    {anexos.length > 0 && (
                      <span className="block mt-2 space-y-1">
                        {anexos.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => handleAbrirAnexo(a)}
                            className="inline-flex items-center gap-1 mr-1 px-2 py-0.5 rounded-md bg-capul-50 text-capul-700 border border-capul-200 text-xs hover:bg-capul-100 transition-colors"
                            title={`Abrir ${a.nomeOriginal}`}
                          >
                            <Paperclip className="w-3 h-3" />
                            {a.nomeOriginal}
                          </button>
                        ))}
                      </span>
                    )}
                    {anexoOrfao && (
                      <span className="block mt-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 text-xs italic line-through decoration-slate-300"
                          title="O anexo referenciado foi removido"
                        >
                          <Paperclip className="w-3 h-3" />
                          anexo removido
                        </span>
                      </span>
                    )}
                  </span>
                );
              }}
            />
          )}
              </div>
        </div>

            {/* Compositor — Slack-style (paridade com chamado, 14/05/2026):
                rows=3 com resize-y manual (pedido suporte 14/05 — permite
                conferir texto longo redimensionando antes de enviar), Enter
                quebra linha (envio apenas pelo botao), drag-drop, contador
                discreto, toolbar única no rodapé. Pendencia finalizada mostra
                aviso em vez do compositor (backend bloqueia). */}
            {isFinalizada ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 text-center lg:flex-shrink-0">
                Pendência {pendencia.status === 'CONCLUIDA' ? 'concluída' : 'cancelada'} — novos comentários não são permitidos.
              </div>
            ) : (
            <div
              className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:flex-shrink-0"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) setComentarioArquivos((prev) => [...prev, ...files]);
              }}
            >
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
              <div className="relative">
                <MentionInput
                  value={comentario}
                  onChange={setComentario}
                  usuarios={membrosEquipe.map((m) => ({ id: m.usuarioId, nome: m.usuario.nome, username: m.usuario.username }))}
                  rows={3}
                  maxLength={5000}
                  className="w-full border-0 px-3 py-2 text-sm focus:outline-none focus:ring-0 resize-y"
                  placeholder="Escreva seu comentário... (use @ para mencionar)"
                />
                {comentario.length >= 4000 && (
                  <span
                    className={`absolute bottom-1 right-3 text-[10px] pointer-events-none bg-white/80 px-1 rounded ${
                      comentario.length >= 4900
                        ? 'text-red-600 font-semibold'
                        : comentario.length >= 4500
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {comentario.length.toLocaleString('pt-BR')}/5.000
                  </span>
                )}
              </div>
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
                />
                {/* Checkbox só pra staff TI (ADMIN/GESTOR_TI/SUPORTE_TI). Antes era
                    pra !USUARIO_CHAVE/TERCEIRIZADO — USUARIO_FINAL e roles legadas
                    (DESENV/MANUT/INFRA) viam o checkbox mesmo não devendo decidir
                    visibilidade interna. Backend reforça (defesa em profundidade). */}
                {isStaffTI && (
                  <label
                    className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none"
                    title="Desmarque para deixar o comentário interno (visível apenas para staff de TI — Usuário Chave / Terceirizado não enxerga)."
                  >
                    <input
                      type="checkbox"
                      checked={comentarioPublico}
                      onChange={(e) => setComentarioPublico(e.target.checked)}
                      className="rounded border-slate-300 w-3.5 h-3.5"
                    />
                    Visível p/ Usuário Chave / Terceirizado
                  </label>
                )}
                <div className="flex-1" />
                <button
                  onClick={handleAddComentario}
                  disabled={enviando || (!comentario.trim() && comentarioArquivos.length === 0)}
                  title="Enviar comentário"
                  className="bg-capul-600 text-white px-4 py-1.5 rounded-md text-xs font-medium hover:bg-capul-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  {enviando ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
            )}
          </div>

          {/* Sidebar — rolagem independente no lg+ */}
          <div className="lg:col-span-2 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">

            {/* Detalhes (movido do header em 14/05/2026 — chat-style) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-slate-400 font-mono">#{pendencia.numero}</span>
                <h3 className="text-base font-bold text-slate-800">{pendencia.titulo}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pendenciaStatusCores[pendencia.status]}`}>
                  {pendenciaStatusLabel[pendencia.status]}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${pendenciaPrioridadeCores[pendencia.prioridade]}`}>
                  {pendenciaPrioridadeLabel[pendencia.prioridade]}
                </span>
                {isVencida && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Vencida</span>
                )}
              </div>
            </div>
            {(isGestor || pendencia.responsavel.id === usuario?.id) && !editing && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && (
              <button onClick={startEdit} className="flex items-center gap-1 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200">
                <Edit3 className="w-4 h-4" /> Editar
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Titulo *</label>
                  <input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Descricao</label>
                  <textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Responsavel *</label>
                  <select value={editResponsavelId} onChange={(e) => setEditResponsavelId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Selecione...</option>
                    {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Prioridade</label>
                  <select value={editPrioridade} onChange={(e) => setEditPrioridade(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                    {Object.entries(pendenciaPrioridadeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Data Limite</label>
                  <input type="date" value={editDataLimite} onChange={(e) => setEditDataLimite(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={salvandoEdicao || !editTitulo.trim() || !editResponsavelId} className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                  {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => setEditing(false)} className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Responsavel</p>
                  <p className="text-slate-800 font-medium">{pendencia.responsavel.nome}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Criador</p>
                  <p className="text-slate-800">{pendencia.criador.nome}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Data Limite</p>
                  <p className={`font-medium ${isVencida ? 'text-red-600' : 'text-slate-800'}`}>
                    {pendencia.dataLimite ? formatDateBR(pendencia.dataLimite) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Fase</p>
                  <p className="text-slate-800">{pendencia.fase?.nome || '-'}</p>
                </div>
              </div>

              {/* Description */}
              {pendencia.descricao && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-1">Descricao</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{pendencia.descricao}</p>
                </div>
              )}
            </>
          )}

        </div>

            {/* Ações — card separado (paridade com chamado, 14/05/2026).
                Só renderiza se houver pelo menos uma ação disponível. */}
            {(isGestor || pendencia.responsavel.id === usuario?.id) && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h4 className="font-semibold text-slate-700 text-sm">Ações</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {pendencia.status === 'ABERTA' && (
                    <button onClick={() => handleStatusChange('EM_ANDAMENTO')} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full hover:bg-yellow-200 font-medium">
                      Iniciar
                    </button>
                  )}
                  {pendencia.status === 'EM_ANDAMENTO' && (
                    <>
                      <button onClick={() => handleStatusChange('AGUARDANDO_VALIDACAO')} className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-200 font-medium">
                        Enviar p/ Validacao
                      </button>
                      <button onClick={() => handleStatusChange('CONCLUIDA')} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 font-medium">
                        Concluir
                      </button>
                    </>
                  )}
                  {pendencia.status === 'AGUARDANDO_VALIDACAO' && (
                    <>
                      <button onClick={() => handleStatusChange('CONCLUIDA')} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-200 font-medium">
                        Aprovar (Concluir)
                      </button>
                      <button onClick={() => handleStatusChange('EM_ANDAMENTO')} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full hover:bg-yellow-200 font-medium">
                        Devolver
                      </button>
                    </>
                  )}
                  <button onClick={() => handleStatusChange('CANCELADA')} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 font-medium">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Atividades Vinculadas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-capul-600" />
                <h4 className="font-semibold text-slate-700 text-sm">Atividades Vinculadas ({pendencia.atividades?.length || 0})</h4>
              </div>
              {canGerarAtividade && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && !showGerarForm && (
                <button
                  onClick={handleOpenGerarAtividade}
                  className="flex items-center gap-1 text-xs bg-capul-600 text-white px-2 py-1 rounded hover:bg-capul-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Gerar
                </button>
              )}
            </div>
            {showGerarForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-2">
                <input
                  type="text"
                  value={gerarTitulo}
                  onChange={(e) => setGerarTitulo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capul-600"
                  placeholder="Titulo da atividade"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleGerarAtividade}
                    disabled={gerandoAtividade || !gerarTitulo.trim()}
                    className="flex items-center gap-1 text-xs bg-capul-600 text-white px-3 py-1.5 rounded hover:bg-capul-700 disabled:opacity-50"
                  >
                    {gerandoAtividade ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Gerar e Iniciar
                  </button>
                  <button onClick={() => setShowGerarForm(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
              </div>
            )}
            {(pendencia.atividades || []).length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma atividade vinculada</p>
            ) : (
              <div className="space-y-1.5">
                {pendencia.atividades!.map((ativ) => (
                  <div key={ativ.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                    {ativ.status === 'CONCLUIDA' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : ativ.status === 'EM_ANDAMENTO' ? (
                      <Loader className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="text-xs text-slate-700 font-medium truncate flex-1">{ativ.titulo}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      ativ.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' :
                      ativ.status === 'EM_ANDAMENTO' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ativ.status === 'CONCLUIDA' ? 'OK' : ativ.status === 'EM_ANDAMENTO' ? 'Em And.' : 'Pend.'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Anexos consolidados */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Anexos ({pendencia.anexos?.length || 0})
              </h4>
              <label className="flex items-center gap-1 text-xs text-capul-600 hover:underline cursor-pointer">
                <Paperclip className="w-3 h-3" />
                {uploading ? 'Enviando...' : 'Anexar'}
                <input type="file" className="hidden" onChange={handleUploadAnexo} disabled={uploading} />
              </label>
            </div>
            {(pendencia.anexos || []).length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum anexo</p>
            ) : (
              <div className="space-y-1.5">
                {pendencia.anexos!.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 group">
                    <Paperclip className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleAbrirAnexo(a)}
                        className="truncate text-xs text-capul-700 hover:underline block text-left w-full"
                        title={a.nomeOriginal}
                      >
                        {a.nomeOriginal}
                      </button>
                      <p className="text-[10px] text-slate-400">{(a.tamanho / 1024).toFixed(0)} KB · {new Date(a.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDownloadAnexo(a)} className="p-1 text-slate-400 hover:text-capul-600" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {canManage && (
                        <button onClick={() => handleRemoveAnexo(a.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Notas das atividades vinculadas (movido pra sidebar em 14/05/2026) */}

        {/* Notas das Atividades (visíveis na pendência) */}
        {(() => {
          const notasVisiveis = (pendencia.atividades || []).flatMap((ativ) =>
            (ativ.comentarios || []).map((c) => ({ ...c, atividade: ativ }))
          ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          if (notasVisiveis.length === 0) return null;
          return (
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-capul-600" />
                <h4 className="font-semibold text-slate-700">Historico das Atividades ({notasVisiveis.length})</h4>
              </div>
              <div className="space-y-3">
                {notasVisiveis.map((nota) => (
                  <div key={nota.id} className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-blue-700">{nota.usuario.nome}</span>
                      <span className="text-xs text-blue-400">{new Date(nota.createdAt).toLocaleDateString('pt-BR')} {new Date(nota.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{nota.atividade.titulo}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{nota.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
          </div>
        </div>
      </div>
    </>
  );
}
