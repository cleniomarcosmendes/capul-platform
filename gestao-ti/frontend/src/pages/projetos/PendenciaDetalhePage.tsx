import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { projetoService } from '../../services/projeto.service';
import {
  ArrowLeft, ChevronRight, Paperclip, Download, Trash2, Send, ClipboardList, Clock, Plus, CheckCircle, Circle, Loader,
} from 'lucide-react';
import type { PendenciaProjeto, StatusPendencia, AnexoPendenciaItem } from '../../types';

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
  const { gestaoTiRole } = useAuth();
  const { toast, confirm } = useToast();
  const canManage = gestaoTiRole !== 'USUARIO_FINAL' && Boolean(gestaoTiRole);
  const canGerarAtividade = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');

  const [pendencia, setPendencia] = useState<PendenciaProjeto | null>(null);
  const [projeto, setProjeto] = useState<{ id: string; numero: number; nome: string; projetoPai?: { id: string; numero: number; nome: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gerandoAtividade, setGerandoAtividade] = useState(false);

  useEffect(() => {
    if (projetoId && pendenciaId) {
      loadData();
    }
  }, [projetoId, pendenciaId]);

  async function loadData() {
    setLoading(true);
    try {
      const [pend, proj] = await Promise.all([
        projetoService.buscarPendencia(projetoId!, pendenciaId!),
        projetoService.buscar(projetoId!),
      ]);
      setPendencia(pend);
      setProjeto({ id: proj.id, numero: proj.numero, nome: proj.nome, projetoPai: proj.projetoPai });
    } catch {
      toast('error', 'Erro ao carregar pendencia');
    }
    setLoading(false);
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

  async function handleGerarAtividade() {
    if (!pendencia) return;

    const confirmado = await confirm(
      'Gerar Atividade',
      `Deseja gerar uma atividade a partir da pendencia #${pendencia.numero}?\n\nVoce sera redirecionado para a aba de Atividades do projeto.`,
      { confirmLabel: 'Gerar e Iniciar', variant: 'default' }
    );
    if (!confirmado) return;

    setGerandoAtividade(true);
    try {
      await projetoService.gerarAtividadeFromPendencia(projetoId!, pendencia.id);
      toast('success', 'Atividade gerada com sucesso');
      // Redirecionar para a aba de atividades do projeto
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
          </div>

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
                {pendencia.dataLimite ? new Date(pendencia.dataLimite).toLocaleDateString('pt-BR') : '-'}
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

          {/* Status change */}
          {!['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && (
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
            {canGerarAtividade && !['CONCLUIDA', 'CANCELADA'].includes(pendencia.status) && (
              <button
                onClick={handleGerarAtividade}
                disabled={gerandoAtividade}
                className="flex items-center gap-1.5 text-sm bg-capul-600 text-white px-3 py-1.5 rounded-lg hover:bg-capul-700 disabled:opacity-50"
              >
                {gerandoAtividade ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {gerandoAtividade ? 'Gerando...' : 'Gerar Atividade'}
              </button>
            )}
          </div>
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
                    <span className="truncate text-sm text-slate-700">{a.nomeOriginal}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">({(a.tamanho / 1024).toFixed(0)} KB)</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => handleDownloadAnexo(a)} className="text-capul-600 hover:text-capul-700">
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
                    {inter.descricao && (
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{inter.descricao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add comment */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-700 mb-3">Adicionar Comentario</h4>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm"
            placeholder="Escreva seu comentario..."
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
