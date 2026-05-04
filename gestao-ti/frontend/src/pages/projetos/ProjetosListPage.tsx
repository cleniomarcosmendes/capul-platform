import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { projetoService } from '../../services/projeto.service';
import { softwareService } from '../../services/software.service';
import { compraService } from '../../services/compra.service';
import { FolderKanban, Plus, Search, Download, Star, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { Projeto, Software, TipoProjetoConfig } from '../../types';
import { formatDateBR } from '../../utils/date';
import { Paginator } from '../../components/Paginator';

const statusLabel: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em Andamento',
  EM_HOMOLOGACAO: 'Em Homologação',
  LIBERADO_PARA_PRODUCAO: 'Liberado p/ Produção',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluido',
  CANCELADO: 'Cancelado',
};

const statusCores: Record<string, string> = {
  PLANEJAMENTO: 'bg-blue-100 text-blue-700',
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-700',
  EM_HOMOLOGACAO: 'bg-sky-100 text-sky-700 border border-sky-300',
  LIBERADO_PARA_PRODUCAO: 'bg-teal-100 text-teal-800 border border-teal-300',
  PAUSADO: 'bg-orange-100 text-orange-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-slate-100 text-slate-600',
};

export function ProjetosListPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const canManage = gestaoTiRole !== 'USUARIO_FINAL' && Boolean(gestaoTiRole);

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  // Paginação 23/04/2026
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalProjetos, setTotalProjetos] = useState<number>(0);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [tiposProjeto, setTiposProjeto] = useState<TipoProjetoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('EM_ANDAMENTO,PLANEJAMENTO');
  const [filtroSoftware, setFiltroSoftware] = useState('');
  const [apenasRaiz, setApenasRaiz] = useState(false);
  const [meusProjetos, setMeusProjetos] = useState(true);
  const [favoritoIds, setFavoritoIds] = useState<Set<string>>(new Set());
  const [apenasFavoritos, setApenasFavoritos] = useState(false);

  useEffect(() => {
    softwareService.listar().then(setSoftwares).catch(() => {});
    compraService.listarTiposProjeto('ATIVO').then(setTiposProjeto).catch(() => {});
    projetoService.listarFavoritos().then((ids) => setFavoritoIds(new Set(ids))).catch(() => {});
  }, []);

  // Debounce da busca — 350ms depois da última tecla dispara novo fetch.
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Carregar projetos quando auth estiver pronto e quando filtros mudarem
  useEffect(() => {
    if (!usuario?.id) return; // Aguardar auth
    loadData();
  }, [usuario?.id, filtroStatus, filtroSoftware, apenasRaiz, meusProjetos, searchDebounced, page, pageSize]);

  // Volta pra página 1 quando filtro muda.
  useEffect(() => { setPage(1); }, [filtroStatus, filtroSoftware, apenasRaiz, meusProjetos, searchDebounced, pageSize]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await projetoService.listarPaginado({
        status: filtroStatus || undefined,
        softwareId: filtroSoftware || undefined,
        search: searchDebounced.trim() || undefined,
        apenasRaiz: apenasRaiz || undefined,
        meusProjetos: meusProjetos || undefined,
        page,
        pageSize,
      });
      setProjetos(res.items);
      setTotalProjetos(res.total);
    } catch { /* empty */ }
    setLoading(false);
  }

  const projetosFiltrados = projetos.filter((p) => {
    if (apenasFavoritos && !favoritoIds.has(p.id)) return false;
    if (filtroTipo && p.tipoProjetoId !== filtroTipo) return false;
    return true;
  });

  // Sort por coluna (29/04/2026) — quando sortKey === null, usa o
  // comportamento default (favoritos primeiro + numero asc dentro de cada
  // nível da árvore). Quando user clica em coluna, troca por aquela coluna
  // (perde favoritos-primeiro). DFS é preservado em qualquer caso — pai
  // permanece acima dos filhos pra não quebrar a estrutura visual.
  type SortKey = 'numero' | 'nome' | 'tipo' | 'status' | 'software' | 'responsavel' | 'dataInicio' | 'subprojetos';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-capul-600 inline" />
      : <ArrowDown className="w-3 h-3 text-capul-600 inline" />;
  }

  // Ordenação por árvore (DFS): pai primeiro, filhos abaixo, recursivo.
  // O `cmp` interno usa sortKey/sortDir do user; quando null, mantém o
  // comportamento legado (favoritos > numero asc).
  const projetosOrdenados = useMemo(() => {
    const byParent = new Map<string | null, typeof projetosFiltrados>();
    projetosFiltrados.forEach((p) => {
      const key = p.projetoPaiId ?? null;
      const arr = byParent.get(key) ?? [];
      arr.push(p);
      byParent.set(key, arr);
    });

    type ProjetoItem = typeof projetosFiltrados[0];
    const cmpDefault = (a: ProjetoItem, b: ProjetoItem) => {
      const aFav = favoritoIds.has(a.id) ? 0 : 1;
      const bFav = favoritoIds.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return Number(a.numero) - Number(b.numero);
    };
    const cmpCustom = (a: ProjetoItem, b: ProjetoItem) => {
      let va: string | number = '';
      let vb: string | number = '';
      switch (sortKey) {
        case 'numero':
          va = Number(a.numero); vb = Number(b.numero); break;
        case 'nome':
          va = (a.nome ?? '').toLowerCase(); vb = (b.nome ?? '').toLowerCase(); break;
        case 'tipo':
          va = (a.tipoProjeto?.descricao ?? a.tipo ?? '').toLowerCase();
          vb = (b.tipoProjeto?.descricao ?? b.tipo ?? '').toLowerCase();
          break;
        case 'status':
          va = a.status ?? ''; vb = b.status ?? ''; break;
        case 'software':
          va = (a.software?.nome ?? '').toLowerCase();
          vb = (b.software?.nome ?? '').toLowerCase();
          break;
        case 'responsavel':
          va = (a.responsavel?.nome ?? '').toLowerCase();
          vb = (b.responsavel?.nome ?? '').toLowerCase();
          break;
        case 'dataInicio':
          va = a.dataInicio ? new Date(a.dataInicio).getTime() : 0;
          vb = b.dataInicio ? new Date(b.dataInicio).getTime() : 0;
          break;
        case 'subprojetos':
          va = a._count?.subProjetos ?? 0; vb = b._count?.subProjetos ?? 0; break;
      }
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    };
    const cmp = sortKey ? cmpCustom : cmpDefault;

    const result: typeof projetosFiltrados = [];
    const visitados = new Set<string>();
    const dfs = (parentId: string | null) => {
      const children = (byParent.get(parentId) ?? []).slice().sort(cmp);
      children.forEach((c) => {
        if (visitados.has(c.id)) return;
        visitados.add(c.id);
        result.push(c);
        dfs(c.id);
      });
    };
    dfs(null);
    // Órfãos (filhos cujo pai não está na página/filtro atual)
    projetosFiltrados.forEach((p) => {
      if (!visitados.has(p.id)) result.push(p);
    });
    return result;
  }, [projetosFiltrados, favoritoIds, sortKey, sortDir]);

  async function handleToggleFavorito(projetoId: string) {
    try {
      const { favorito } = await projetoService.toggleFavorito(projetoId);
      setFavoritoIds((prev) => {
        const next = new Set(prev);
        if (favorito) next.add(projetoId);
        else next.delete(projetoId);
        return next;
      });
    } catch { /* empty */ }
  }

  const totalAtivos = projetosFiltrados.filter((p) =>
    ['PLANEJAMENTO', 'EM_ANDAMENTO', 'EM_HOMOLOGACAO', 'LIBERADO_PARA_PRODUCAO', 'PAUSADO'].includes(p.status),
  ).length;
  const emAndamento = projetosFiltrados.filter((p) => p.status === 'EM_ANDAMENTO').length;
  const planejamento = projetosFiltrados.filter((p) => p.status === 'PLANEJAMENTO').length;
  const concluidos = projetosFiltrados.filter((p) => p.status === 'CONCLUIDO').length;

  return (
    <>
      <Header title="Projetos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-6 h-6 text-capul-500" />
            <h3 className="text-lg font-semibold text-slate-800">Projetos de T.I.</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('projetos')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/projetos/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Projeto
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-slate-800">{totalAtivos}</p>
            <p className="text-xs text-slate-500 mt-1">Ativos</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-yellow-600">{emAndamento}</p>
            <p className="text-xs text-slate-500 mt-1">Em Andamento</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-blue-600">{planejamento}</p>
            <p className="text-xs text-slate-500 mt-1">Planejamento</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-2xl font-bold text-green-600">{concluidos}</p>
            <p className="text-xs text-slate-500 mt-1">Concluidos</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm w-72"
            />
          </div>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Tipos</option>
            {tiposProjeto.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Status</option>
            <option value="EM_ANDAMENTO,PLANEJAMENTO">Ativos (Andamento + Planejamento)</option>
            <option value="EM_HOMOLOGACAO">🧪 Aguardando validação HOM</option>
            <option value="LIBERADO_PARA_PRODUCAO">🚀 Aguardando produção</option>
            {Object.entries(statusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filtroSoftware} onChange={(e) => setFiltroSoftware(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos Softwares</option>
            {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={meusProjetos}
              onChange={(e) => setMeusProjetos(e.target.checked)}
              className="rounded"
            />
            Meus Projetos
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={apenasRaiz}
              onChange={(e) => setApenasRaiz(e.target.checked)}
              className="rounded"
            />
            Apenas raiz
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-600 font-medium">
            <input
              type="checkbox"
              checked={apenasFavoritos}
              onChange={(e) => setApenasFavoritos(e.target.checked)}
              className="rounded"
            />
            <Star className="w-3.5 h-3.5" /> Favoritos
          </label>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : projetosFiltrados.length === 0 ? (
          <p className="text-slate-500">Nenhum projeto encontrado</p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('numero')} className="flex items-center gap-1 hover:text-slate-800">
                        # <SortIcon col="numero" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-800">
                        Nome <SortIcon col="nome" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('tipo')} className="flex items-center gap-1 hover:text-slate-800">
                        Tipo <SortIcon col="tipo" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-800">
                        Status <SortIcon col="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('software')} className="flex items-center gap-1 hover:text-slate-800">
                        Software <SortIcon col="software" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('responsavel')} className="flex items-center gap-1 hover:text-slate-800">
                        Responsavel <SortIcon col="responsavel" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600">
                      <button onClick={() => toggleSort('dataInicio')} className="flex items-center gap-1 hover:text-slate-800">
                        Inicio <SortIcon col="dataInicio" />
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-600 text-right">
                      <button onClick={() => toggleSort('subprojetos')} className="ml-auto flex items-center gap-1 hover:text-slate-800">
                        Sub <SortIcon col="subprojetos" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projetosOrdenados.map((p) => {
                    // Hierarquia visual — auditoria UX 25/04/2026:
                    // - Indentação proporcional ao nível (24px por degrau)
                    // - Cor da fonte/peso diferente entre projeto raiz e subprojeto
                    // - Background sutil em subprojeto
                    // - Ícone "└" indicando relação filial
                    const isSubprojeto = p.nivel > 1;
                    const indentPx = (p.nivel - 1) * 24;
                    return (
                    <tr key={p.id} className={`hover:bg-slate-100 ${isSubprojeto ? 'bg-slate-50/60' : ''}`}>
                      <td className="px-4 py-3 text-slate-500">{p.numero}</td>
                      <td className="px-4 py-3" style={{ paddingLeft: `${16 + indentPx}px` }}>
                        <div className="flex items-center gap-2">
                          {isSubprojeto && (
                            <span className="text-slate-400 select-none text-xs" aria-hidden>└</span>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); handleToggleFavorito(p.id); }}
                            className="flex-shrink-0"
                            title={favoritoIds.has(p.id) ? 'Remover favorito' : 'Favoritar'}
                          >
                            <Star className={`w-4 h-4 ${favoritoIds.has(p.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
                          </button>
                          <Link
                            to={`/gestao-ti/projetos/${p.id}`}
                            className={isSubprojeto
                              ? 'text-slate-700 hover:underline font-normal'
                              : 'text-capul-600 hover:underline font-semibold'}
                          >
                            {p.nome}
                          </Link>
                        </div>
                        {isSubprojeto && (
                          <span className="ml-6 text-xs text-slate-400">
                            N{p.nivel}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.tipoProjeto?.descricao || p.tipo}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[p.status]}`}>
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.software?.nome || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.responsavel.nome}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {p.dataInicio ? formatDateBR(p.dataInicio) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p._count.subProjetos > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-capul-50 text-capul-700 text-xs font-semibold">
                            {p._count.subProjetos}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!loading && (
          <Paginator
            total={totalProjetos}
            shownCount={projetos.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            labelSingular="projeto"
            labelPlural="projetos"
          />
        )}
      </div>
    </>
  );
}
