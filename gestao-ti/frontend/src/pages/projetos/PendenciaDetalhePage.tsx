import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { projetoService } from '../../services/projeto.service';
import {
  ArrowLeft, ChevronRight, Paperclip, Download, Trash2, Send, ClipboardList, Clock, Plus, CheckCircle, Circle, Loader,
  Edit3, Check, MessageSquare,
} from 'lucide-react';
import type { PendenciaProjeto, StatusPendencia, AnexoPendenciaItem, MembroProjeto } from '../../types';
import { formatDateBR } from '../../utils/date';
import { MentionInput } from '../../components/MentionInput';

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

export function PendenciaDetalhePage() {
  const { projetoId, pendenciaId } = useParams<{ projetoId: string; pendenciaId: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole, usuario } = useAuth();
  const { toast, confirm } = useToast();
  const isGestor = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');
  const canManage = gestaoTiRole !== 'USUARIO_FINAL' && Boolean(gestaoTiRole);
  const canGerarAtividade = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');

  const [pendencia, setPendencia] = useState<PendenciaProjeto | null>(null);
  const [projeto, setProjeto] = useState<{ id: string; numero: number; nome: string; projetoPai?: { id: string; numero: number; nome: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [editingInteracaoId, setEditingInteracaoId] = useState<string | null>(null);
  const [editingTexto, setEditingTexto] = useState('');
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
      setProjeto({ id: proj.id, numero: proj.numero, nome: proj.nome, projetoPai: proj.projetoPai });
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
    if (!comentario.trim() || !pendencia) return;
    setEnviando(true);
    try {
      await projetoService.adicionarInteracaoPendencia(projetoId!, pendencia.id, { descricao: comentario.trim() });
      setComentario('');
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

  return (
    <>
      <Header title={`Pendencia #${pendencia.numero}`} />
      <div className="p-6">
        {/* Breadcrumbs */}
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
          <Link to={`/gestao-ti/projetos/${projeto.id}`} className="text-slate-500 hover:text-capul-600">
            #{projeto.numero} {projeto.nome}
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="text-slate-700 font-medium">Pendencia #{pendencia.numero}</span>
        </nav>

        <button onClick={() => navigate(`/gestao-ti/projetos/${projeto.id}`)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Projeto #{projeto.numero}
        </button>

        {/* Indicador de Contexto */}
        <div className={`rounded-xl border p-4 mb-6 ${isSubProjeto ? 'bg-blue-50 border-blue-200' : 'bg-capul-50 border-capul-200'}`}>
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

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-slate-400 font-mono">#{pendencia.numero}</span>
                <h3 className="text-xl font-bold text-slate-800">{pendencia.titulo}</h3>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

          {/* Status change — apenas responsavel ou gestor */}
          {(isGestor || pendencia.responsavel.id === usuario?.id) && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && (
            <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">Alterar status:</span>
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
          )}
        </div>

        {/* Atividades Vinculadas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-capul-600" />
              <h4 className="font-semibold text-slate-700">Atividades Vinculadas ({pendencia.atividades?.length || 0})</h4>
            </div>
            {canGerarAtividade && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && !showGerarForm && (
              <button
                onClick={handleOpenGerarAtividade}
                className="flex items-center gap-1.5 text-sm bg-capul-600 text-white px-3 py-1.5 rounded-lg hover:bg-capul-700"
              >
                <Plus className="w-4 h-4" />
                Gerar Atividade
              </button>
            )}
          </div>
          {showGerarForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Titulo da Atividade</label>
              <input
                type="text"
                value={gerarTitulo}
                onChange={(e) => setGerarTitulo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                placeholder="Titulo da atividade"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGerarAtividade}
                  disabled={gerandoAtividade || !gerarTitulo.trim()}
                  className="flex items-center gap-1.5 text-sm bg-capul-600 text-white px-4 py-2 rounded-lg hover:bg-capul-700 disabled:opacity-50"
                >
                  {gerandoAtividade ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {gerandoAtividade ? 'Gerando...' : 'Gerar e Iniciar'}
                </button>
                <button onClick={() => setShowGerarForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
              </div>
            </div>
          )}
          {(pendencia.atividades || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma atividade vinculada a esta pendencia</p>
          ) : (
            <div className="space-y-2">
              {pendencia.atividades!.map((ativ) => (
                <div key={ativ.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {ativ.status === 'CONCLUIDA' ? (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : ativ.status === 'EM_ANDAMENTO' ? (
                      <Loader className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="text-sm text-slate-700 font-medium truncate">{ativ.titulo}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500">{ativ.usuario.nome}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ativ.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' :
                      ativ.status === 'EM_ANDAMENTO' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ativ.status === 'CONCLUIDA' ? 'Concluida' : ativ.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

        {/* Anexos */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-700">Anexos ({pendencia.anexos?.length || 0})</h4>
            <label className="flex items-center gap-1 text-sm text-capul-600 hover:underline cursor-pointer">
              <Paperclip className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Anexar arquivo'}
              <input type="file" className="hidden" onChange={handleUploadAnexo} disabled={uploading} />
            </label>
          </div>
          {(pendencia.anexos || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum anexo</p>
          ) : (
            <div className="space-y-2">
              {pendencia.anexos!.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <button
                      onClick={() => {
                        const viewable = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
                        if (a.mimeType && viewable.includes(a.mimeType)) {
                          projetoService.abrirAnexoPendencia(projetoId!, pendencia!.id, a.id, a.mimeType).catch(() => {
                            handleDownloadAnexo(a);
                          });
                        } else {
                          handleDownloadAnexo(a);
                        }
                      }}
                      className="truncate text-sm text-capul-700 hover:text-capul-900 hover:underline text-left"
                      title="Clique para abrir"
                    >
                      {a.nomeOriginal}
                    </button>
                    <span className="text-xs text-slate-400 flex-shrink-0">({(a.tamanho / 1024).toFixed(0)} KB)</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => handleDownloadAnexo(a)} className="text-capul-600 hover:text-capul-700" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <button onClick={() => handleRemoveAnexo(a.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h4 className="font-semibold text-slate-700 mb-4">Timeline ({pendencia.interacoes?.length || 0})</h4>
          {(pendencia.interacoes || []).length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma interacao</p>
          ) : (
            <div className="space-y-4">
              {pendencia.interacoes!.map((inter) => (
                <div key={inter.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-slate-600">{inter.usuario.nome.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700">{inter.usuario.nome}</span>
                      <span className="text-xs text-slate-400">{new Date(inter.createdAt).toLocaleString('pt-BR')}</span>
                      {inter.tipo !== 'COMENTARIO' && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {inter.tipo === 'STATUS_ALTERADO' ? 'Status alterado' : inter.tipo === 'RESPONSAVEL_ALTERADO' ? 'Responsavel alterado' : inter.tipo === 'ANEXO' ? 'Anexo' : 'Comentario'}
                        </span>
                      )}
                      {!inter.publica && (
                        <span className="text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">Interno</span>
                      )}
                    </div>
                    {inter.tipo === 'COMENTARIO' && editingInteracaoId === inter.id ? (
                      <div className="mt-1 space-y-2">
                        <textarea value={editingTexto} onChange={(e) => setEditingTexto(e.target.value)} rows={3}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" autoFocus />
                        <div className="flex items-center gap-2">
                          <button onClick={async () => {
                            if (!editingTexto.trim() || !projetoId || !pendenciaId) return;
                            try {
                              await projetoService.editarInteracaoPendencia(projetoId, pendenciaId, inter.id, editingTexto);
                              const updated = await projetoService.buscarPendencia(projetoId, pendenciaId);
                              setPendencia(updated);
                              setEditingInteracaoId(null);
                            } catch { /* empty */ }
                          }} disabled={!editingTexto.trim()}
                            className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            <Check className="w-3.5 h-3.5" /> Salvar
                          </button>
                          <button onClick={() => setEditingInteracaoId(null)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                        </div>
                      </div>
                    ) : inter.descricao ? (
                      <div className="flex items-start gap-2 group/comment">
                        <p className="text-sm text-slate-600 whitespace-pre-wrap flex-1">{inter.descricao}</p>
                        {inter.tipo === 'COMENTARIO' && (inter.usuario.id === usuario?.id || ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '')) && (
                          <button onClick={() => { setEditingInteracaoId(inter.id); setEditingTexto(inter.descricao || ''); }}
                            className="opacity-0 group-hover/comment:opacity-100 text-slate-300 hover:text-capul-600 transition-all p-0.5 flex-shrink-0" title="Editar comentario">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add comment */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-700 mb-3">Adicionar Comentario</h4>
          <MentionInput
            value={comentario}
            onChange={setComentario}
            usuarios={membrosEquipe.map((m) => ({ id: m.usuarioId, nome: m.usuario.nome, username: m.usuario.username }))}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm"
            placeholder="Escreva seu comentario... (use @usuario para mencionar)"
          />
          <div className="flex items-center justify-end mt-3">
            <button
              onClick={handleAddComentario}
              disabled={enviando || !comentario.trim()}
              className="flex items-center gap-2 bg-capul-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {enviando ? 'Enviando...' : 'Salvar Comentario'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
