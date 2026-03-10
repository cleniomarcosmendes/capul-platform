import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { conhecimentoService } from '../../services/conhecimento.service';
import { ArrowLeft, BookMarked, Edit, Trash2, Send, Archive, Globe, Lock } from 'lucide-react';
import type { ArtigoConhecimento, CategoriaArtigo, StatusArtigo } from '../../types';
import { useToast } from '../../components/Toast';

const categoriaLabel: Record<CategoriaArtigo, string> = {
  PROCEDIMENTO: 'Procedimento', SOLUCAO: 'Solucao', FAQ: 'FAQ', CONFIGURACAO: 'Configuracao', OUTRO: 'Outro',
};
const categoriaCores: Record<CategoriaArtigo, string> = {
  PROCEDIMENTO: 'bg-blue-100 text-blue-700', SOLUCAO: 'bg-green-100 text-green-700',
  FAQ: 'bg-purple-100 text-purple-700', CONFIGURACAO: 'bg-orange-100 text-orange-700', OUTRO: 'bg-slate-100 text-slate-600',
};
const statusLabel: Record<StatusArtigo, string> = {
  RASCUNHO: 'Rascunho', PUBLICADO: 'Publicado', ARQUIVADO: 'Arquivado',
};
const statusCores: Record<StatusArtigo, string> = {
  RASCUNHO: 'bg-yellow-100 text-yellow-700', PUBLICADO: 'bg-green-100 text-green-700', ARQUIVADO: 'bg-slate-100 text-slate-600',
};

export function ConhecimentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const canEdit = ['ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO'].includes(gestaoTiRole || '');
  const { confirm } = useToast();
  const canDelete = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [artigo, setArtigo] = useState<ArtigoConhecimento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    conhecimentoService.buscar(id).then(setArtigo)
      .catch(() => navigate('/gestao-ti/conhecimento'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleStatusChange(status: StatusArtigo) {
    if (!id) return;
    try {
      const updated = await conhecimentoService.alterarStatus(id, status);
      setArtigo(updated);
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!id || !await confirm('Excluir Artigo', 'Tem certeza que deseja excluir este artigo?', { variant: 'danger', confirmLabel: 'Sim, excluir' })) return;
    try {
      await conhecimentoService.excluir(id);
      navigate('/gestao-ti/conhecimento');
    } catch { /* ignore */ }
  }

  if (loading || !artigo) return <><Header title="Artigo" /><div className="p-6 text-center text-slate-500">Carregando...</div></>;

  return (
    <>
      <Header title="Artigo" />
      <div className="p-6 max-w-4xl">
        <button onClick={() => navigate('/gestao-ti/conhecimento')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Metadata bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <BookMarked className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{artigo.titulo}</h2>
                {artigo.resumo && <p className="text-sm text-slate-500 mt-1">{artigo.resumo}</p>}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoriaCores[artigo.categoria]}`}>
                    {categoriaLabel[artigo.categoria]}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCores[artigo.status]}`}>
                    {statusLabel[artigo.status]}
                  </span>
                  {artigo.publica ? (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600">
                      <Globe className="w-3.5 h-3.5" /> Publica
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                      <Lock className="w-3.5 h-3.5" /> Interna
                    </span>
                  )}
                  <span className="text-xs text-slate-400">Autor: <strong className="text-slate-600">{artigo.autor?.nome}</strong></span>
                  <span className="text-xs text-slate-400">Criado: {new Date(artigo.createdAt).toLocaleDateString('pt-BR')}</span>
                  {artigo.publicadoEm && <span className="text-xs text-slate-400">Publicado: {new Date(artigo.publicadoEm).toLocaleDateString('pt-BR')}</span>}
                </div>
                {artigo.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {artigo.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                  {artigo.software && <span>Software: <Link to={`/gestao-ti/softwares/${artigo.software.id}`} className="text-amber-600 hover:underline">{artigo.software.nome}</Link></span>}
                  {artigo.equipeTi && <span>Equipe: <strong>{artigo.equipeTi.sigla} — {artigo.equipeTi.nome}</strong></span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && artigo.status === 'RASCUNHO' && (
                <button onClick={() => handleStatusChange('PUBLICADO')} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50">
                  <Send className="w-3.5 h-3.5" /> Publicar
                </button>
              )}
              {canEdit && artigo.status === 'PUBLICADO' && (
                <button onClick={() => handleStatusChange('ARQUIVADO')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50">
                  <Archive className="w-3.5 h-3.5" /> Arquivar
                </button>
              )}
              {canEdit && (
                <Link to={`/gestao-ti/conhecimento/${id}/editar`} className="p-2 text-slate-400 hover:text-amber-600 transition-colors">
                  <Edit className="w-4 h-4" />
                </Link>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Conteudo */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {artigo.conteudo}
          </div>
        </div>
      </div>
    </>
  );
}
