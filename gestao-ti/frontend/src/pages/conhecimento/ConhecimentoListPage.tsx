import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { conhecimentoService } from '../../services/conhecimento.service';
import { softwareService } from '../../services/software.service';
import { equipeService } from '../../services/equipe.service';
import { Plus, Search, BookMarked, Globe, Lock } from 'lucide-react';
import type { ArtigoConhecimento, CategoriaArtigo, StatusArtigo, Software, EquipeTI } from '../../types';

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

export function ConhecimentoListPage() {
  const { gestaoTiRole } = useAuth();
  const canCreate = ['ADMIN', 'GESTOR_TI', 'TECNICO', 'DESENVOLVEDOR', 'FINANCEIRO'].includes(gestaoTiRole || '');

  const [artigos, setArtigos] = useState<ArtigoConhecimento[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaArtigo | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusArtigo | ''>('');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    conhecimentoService
      .listar({
        categoria: filtroCategoria || undefined,
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        equipeTiId: filtroEquipe || undefined,
        search: busca || undefined,
      })
      .then(setArtigos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroCategoria, filtroStatus, filtroSoftware, filtroEquipe, busca]);

  return (
    <>
      <Header title="Base de Conhecimento" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookMarked className="w-6 h-6 text-amber-500" />
            <h3 className="text-lg font-semibold text-slate-800">Artigos e Documentacao</h3>
          </div>
          {canCreate && (
            <Link
              to="/gestao-ti/conhecimento/novo"
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Artigo
            </Link>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por titulo, conteudo, tags..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value as CategoriaArtigo | '')} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todas as Categorias</option>
            {Object.entries(categoriaLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusArtigo | '')} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os Status</option>
            {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroSoftware} onChange={(e) => setFiltroSoftware(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os Softwares</option>
            {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={filtroEquipe} onChange={(e) => setFiltroEquipe(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todas as Equipes</option>
            {equipes.map((e) => <option key={e.id} value={e.id}>{e.sigla} — {e.nome}</option>)}
          </select>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : artigos.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum artigo encontrado</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {artigos.map((a) => (
              <Link
                key={a.id}
                to={`/gestao-ti/conhecimento/${a.id}`}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:border-amber-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoriaCores[a.categoria]}`}>
                      {categoriaLabel[a.categoria]}
                    </span>
                    {a.publica ? (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                        <Globe className="w-3 h-3" /> Publica
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500">
                        <Lock className="w-3 h-3" /> Interna
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCores[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-slate-800 mb-1 line-clamp-2">{a.titulo}</h4>
                {a.resumo && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{a.resumo}</p>}
                {a.tags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4).map((t) => (
                      <span key={t} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-2 border-t border-slate-50">
                  <span>{a.autor?.nome}</span>
                  <span>{new Date(a.updatedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
