import { useEffect, useState, useCallback, useRef, Fragment, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { coreService } from '../../services/core.service';
import { Plus, Eye, Download, Star, Search, ArrowUp, ArrowDown, ArrowUpDown, MessageSquare } from 'lucide-react';
import { exportService } from '../../services/export.service';
import { Paginator } from '../../components/Paginator';
import type { Chamado, Equipe, Departamento, StatusChamado, Visibilidade, UsuarioCore } from '../../types';
import { isWorkspaceModulo } from '../../lib/workspace-modulo';

/** Destaca todas as ocorrências de `termo` (case-insensitive) dentro de
 *  `texto` envolvendo cada match num <mark> — usado no snippet da busca. */
function destacarTermo(texto: string, termo: string): ReactNode {
  if (!termo) return texto;
  const alvo = termo.toLowerCase();
  const partes: ReactNode[] = [];
  let resto = texto;
  let k = 0;
  while (resto) {
    const idx = resto.toLowerCase().indexOf(alvo);
    if (idx < 0) {
      partes.push(resto);
      break;
    }
    if (idx > 0) partes.push(resto.slice(0, idx));
    partes.push(
      <mark key={k++} className="bg-amber-200 text-slate-900 rounded px-0.5">
        {resto.slice(idx, idx + termo.length)}
      </mark>,
    );
    resto = resto.slice(idx + termo.length);
  }
  return partes;
}

interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
}

const statusLabels: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em Atendimento',
  PENDENTE: 'Pendente',
  PENDENTE_USUARIO: 'Pendente Usuário',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
  REABERTO: 'Reaberto',
  AGRUPADO: 'Agrupado',
};

const statusColors: Record<StatusChamado, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700',
  // Rosa para destacar visualmente — diferente do amber/orange usado em
  // PENDENTE genérico e dos amarelos de EM_ATENDIMENTO. Pedido 29/04 do
  // setor: cor distintiva pra "Pendente Usuário" identificar rapidamente
  // chamados que estão parados aguardando resposta do solicitante.
  PENDENTE_USUARIO: 'bg-pink-100 text-pink-800 border border-pink-300',
  RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
  AGRUPADO: 'bg-amber-100 text-amber-700',
};

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

const prioridadeLabels: Record<string, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
};

export function ChamadosListPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const [searchParams] = useSearchParams();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  // Paginação server-side (23/04/2026 — produção tem 500+ chamados, a UI
  // retornava só os 100 primeiros. A busca por texto também é server-side
  // agora pra não perder chamados fora da página atual.)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalChamados, setTotalChamados] = useState<number>(0);
  // Debounce do termo de busca — evita request a cada tecla digitada.
  const [buscaDebounced, setBuscaDebounced] = useState<string>('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [tecnicos, setTecnicos] = useState<UsuarioCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const isStaffTI = gestaoTiRole && ['ADMIN', 'GESTOR', 'SUPORTE', 'TECNICO', 'DESENVOLVEDOR', 'INFRAESTRUTURA', 'MANUTENCAO'].includes(gestaoTiRole);

  // Restaurar filtros de sessionStorage (persistem ao navegar entre paginas)
  const saved = sessionStorage.getItem('chamados_filtros');
  const savedFilters = saved ? JSON.parse(saved) : null;

  const [filterStatus, setFilterStatus] = useState<StatusChamado | ''>(savedFilters?.filterStatus ?? '');
  const [filterEquipe, setFilterEquipe] = useState(savedFilters?.filterEquipe ?? '');
  const [filterVisibilidade, setFilterVisibilidade] = useState<Visibilidade | ''>(savedFilters?.filterVisibilidade ?? '');
  const [meusChamados, setMeusChamados] = useState(savedFilters?.meusChamados ?? false);

  // Aplicar defaults de filtro quando o role estiver disponivel (somente se nao tem filtros salvos)
  useEffect(() => {
    if (gestaoTiRole && !defaultsApplied) {
      if (!savedFilters) {
        if (isStaffTI) {
          setFilterStatus('ATIVOS' as StatusChamado | '');
          setMeusChamados(false);
        } else if (gestaoTiRole !== 'USUARIO_FINAL') {
          setMeusChamados(true);
        }
      }
      setDefaultsApplied(true);
    }
  }, [gestaoTiRole, isStaffTI, defaultsApplied]);
  const [filterFilial, setFilterFilial] = useState<string>(savedFilters?.filterFilial ?? '');
  const [filterDepartamento, setFilterDepartamento] = useState(savedFilters?.filterDepartamento ?? '');
  const [filterTecnico, setFilterTecnico] = useState(savedFilters?.filterTecnico ?? '');
  const [filterDataInicio, setFilterDataInicio] = useState(savedFilters?.filterDataInicio ?? '');
  const [filterDataFim, setFilterDataFim] = useState(savedFilters?.filterDataFim ?? '');
  const [pendentesAvaliacao, setPendentesAvaliacao] = useState(searchParams.get('pendentes') === '1' || (savedFilters?.pendentesAvaliacao ?? false));
  const [busca, setBusca] = useState(savedFilters?.busca ?? '');
  // Incluir AGRUPADOS na listagem (decidido em 13/05/2026). Default false:
  // filhos ficam escondidos pq a operacao acontece no agrupador.
  const [incluirAgrupados, setIncluirAgrupados] = useState<boolean>(savedFilters?.incluirAgrupados ?? false);

  // Salvar filtros no sessionStorage ao alterar
  useEffect(() => {
    sessionStorage.setItem('chamados_filtros', JSON.stringify({
      filterStatus, filterEquipe, filterVisibilidade, meusChamados,
      filterFilial, filterDepartamento, filterTecnico, filterDataInicio, filterDataFim,
      pendentesAvaliacao, busca, incluirAgrupados,
    }));
  }, [filterStatus, filterEquipe, filterVisibilidade, meusChamados, filterFilial, filterDepartamento, filterTecnico, filterDataInicio, filterDataFim, pendentesAvaliacao, busca, incluirAgrupados]);

  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';

  useEffect(() => {
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
    // Staff vê todas as filiais; demais usuários veem apenas suas filiais vinculadas
    const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR'].includes(gestaoTiRole);
    if (isStaff) {
      coreService.listarFiliais().then(setFiliais).catch(() => {});
    } else if (usuario?.filiais?.length) {
      setFiliais(usuario.filiais.map((f) => ({ id: f.id, codigo: f.codigo, nomeFantasia: f.nome })));
    }
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
    if (!isUsuarioFinal) {
      coreService.listarUsuarios().then((users: any[]) => {
        const rolesStaff = ['ADMIN', 'GESTOR', 'SUPORTE'];
        const tecnicos = users.filter((u) =>
          u.permissoes?.some((p: any) => isWorkspaceModulo(p.modulo?.codigo) && rolesStaff.includes(p.roleModulo?.codigo))
        );
        setTecnicos(tecnicos);
      }).catch(() => {});
    }
  }, [gestaoTiRole, usuario]);

  // Ordenação por clique no header (10/05/2026). Default null = backend usa
  // ordem natural (createdAt desc — mais recentes primeiro). Fluxo: 1º clique
  // numa coluna asc, 2º desc, 3º limpa volta pro default.
  type SortKey = 'numero' | 'titulo' | 'status' | 'prioridade' | 'createdAt' | 'updatedAt' | 'filial' | 'equipe' | 'tecnico' | 'solicitante' | 'departamento';
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortBy !== key) { setSortBy(key); setSortOrder('asc'); }
    else if (sortOrder === 'asc') { setSortOrder('desc'); }
    else { setSortBy(null); setSortOrder('asc'); }  // 3º clique → limpa
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 inline-block ml-1" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600 inline-block ml-1" />
      : <ArrowDown className="w-3 h-3 text-blue-600 inline-block ml-1" />;
  };

  const carregarChamados = useCallback((silent = false) => {
    if (!usuario) return; // Aguardar auth estar pronto
    if (!silent) setLoading(true);
    const baseFilters = pendentesAvaliacao
      ? { pendentesAvaliacao: true }
      : {
          status: filterStatus || undefined,
          equipeId: filterEquipe || undefined,
          visibilidade: filterVisibilidade || undefined,
          meusChamados: meusChamados || undefined,
          filialId: filterFilial || undefined,
          departamentoId: filterDepartamento || undefined,
          tecnicoId: filterTecnico || undefined,
          dataInicio: filterDataInicio || undefined,
          dataFim: filterDataFim || undefined,
          search: buscaDebounced.trim() || undefined,
          incluirAgrupados: incluirAgrupados || undefined,
        };
    chamadoService
      .listarPaginado({
        ...baseFilters,
        page,
        pageSize,
        sortBy: sortBy ?? undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      })
      .then((res) => {
        setChamados(res.items);
        setTotalChamados(res.total);
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, [filterStatus, filterEquipe, filterVisibilidade, meusChamados, filterFilial, filterDepartamento, filterTecnico, filterDataInicio, filterDataFim, usuario, pendentesAvaliacao, buscaDebounced, page, pageSize, sortBy, sortOrder, incluirAgrupados]);

  useEffect(() => {
    carregarChamados();
  }, [carregarChamados]);

  // Debounce da busca — 350ms depois da última tecla dispara novo fetch.
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Ao mudar QUALQUER filtro (exceto a própria página) volta para a página 1
  // — evita ficar "preso" na página 7 depois de aplicar um filtro que só tem 2 páginas.
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterEquipe, filterVisibilidade, meusChamados, filterFilial, filterDepartamento, filterTecnico, filterDataInicio, filterDataFim, pendentesAvaliacao, buscaDebounced, pageSize]);

  // Auto-refresh a cada 60s (silencioso)
  const silentRef = useRef(carregarChamados);
  silentRef.current = carregarChamados;
  useEffect(() => {
    const poll = setInterval(() => silentRef.current(true), 60000);
    return () => clearInterval(poll);
  }, []);

  // Busca agora é server-side (via `buscaDebounced` → param `search`). Exibimos
  // os itens da página atual exatamente como o backend devolveu.
  const chamadosFiltrados = chamados;

  return (
    <>
      <Header title="Chamados" />
      <div className="p-6">
        {/* Tabs para USUARIO_FINAL */}
        {isUsuarioFinal && (
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            <button
              onClick={() => setPendentesAvaliacao(false)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                !pendentesAvaliacao
                  ? 'border-capul-600 text-capul-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Meus Chamados
            </button>
            <button
              onClick={() => setPendentesAvaliacao(true)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                pendentesAvaliacao
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Star className="w-4 h-4" />
              Pendentes de Avaliacao
            </button>
          </div>
        )}

        {/* Banner de pendentes */}
        {pendentesAvaliacao && !loading && chamadosFiltrados.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Voce tem {chamadosFiltrados.length} chamado(s) pendente(s) de avaliacao
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Sua avaliacao ajuda a melhorar nosso atendimento!
              </p>
            </div>
          </div>
        )}

        {/* Filtros - esconder quando pendentesAvaliacao esta ativo */}
        {!pendentesAvaliacao && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar em titulo, descricao, comentarios..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-64"
                />
              </div>
              <select
                value={filterFilial}
                onChange={(e) => setFilterFilial(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todas as Filiais</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusChamado | '')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos os Status</option>
                <option value="ATIVOS">Ativos (Aberto, Em Atendimento, Pendente, Pendente Usuário, Reaberto)</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {!isUsuarioFinal && (
                <>
                  <select
                    value={filterEquipe}
                    onChange={(e) => setFilterEquipe(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todas as Equipes</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                    ))}
                  </select>

                  <select
                    value={filterVisibilidade}
                    onChange={(e) => setFilterVisibilidade(e.target.value as Visibilidade | '')}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todas Visibilidades</option>
                    <option value="PUBLICO">Publico</option>
                    <option value="PRIVADO">Privado</option>
                  </select>

                  <select
                    value={filterDepartamento}
                    onChange={(e) => setFilterDepartamento(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos Departamentos</option>
                    {(() => {
                      const tipos = [...new Map(departamentos.filter((d) => d.tipoDepartamento).map((d) => [d.tipoDepartamentoId, d.tipoDepartamento])).values()]
                        .sort((a, b) => a.ordem - b.ordem);
                      return tipos.map((tipo) => {
                        const deptosDoTipo = departamentos.filter((d) => d.tipoDepartamentoId === tipo.id);
                        if (deptosDoTipo.length === 0) return null;
                        return (
                          <optgroup key={tipo.id} label={tipo.nome}>
                            {deptosDoTipo.map((d) => (
                              <option key={d.id} value={d.id}>{d.nome}</option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>

                  <select
                    value={filterTecnico}
                    onChange={(e) => setFilterTecnico(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos os Tecnicos</option>
                    {tecnicos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    title="Atividade desde — inclui chamados abertos OU reabertos/comentados/transferidos no período"
                    placeholder="Atividade desde"
                  />
                  <input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    title="Atividade até — inclui chamados abertos OU reabertos/comentados/transferidos no período"
                    placeholder="Atividade até"
                  />

                  <label className={`flex items-center gap-2 text-sm ${busca ? 'text-slate-400' : 'text-slate-600 cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={meusChamados}
                      onChange={(e) => setMeusChamados(e.target.checked)}
                      disabled={!!busca}
                      className="rounded border-slate-300"
                    />
                    Meus chamados
                    {busca && <span className="text-xs italic text-slate-400">(busca abrange todos)</span>}
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer" title="Mostrar chamados agrupados em outros (filhos)">
                    <input
                      type="checkbox"
                      checked={incluirAgrupados}
                      onChange={(e) => setIncluirAgrupados(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Incluir agrupados
                  </label>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isUsuarioFinal && (
                <button
                  onClick={() => exportService.exportar('chamados')}
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-4 h-4" /> Exportar
                </button>
              )}
              <Link
                to="/gestao-ti/chamados/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Chamado
              </Link>
            </div>
          </div>
        )}

        {/* Botao Novo Chamado quando pendentes ativo */}
        {pendentesAvaliacao && (
          <div className="flex justify-end mb-4">
            <Link
              to="/gestao-ti/chamados/novo"
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Chamado
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : chamadosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {pendentesAvaliacao
              ? 'Nenhum chamado pendente de avaliacao. Tudo em dia!'
              : 'Nenhum chamado encontrado'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('numero')} className="flex items-center hover:text-slate-800">
                      # <SortIcon col="numero" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('filial')} className="flex items-center hover:text-slate-800">
                      Filial <SortIcon col="filial" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('titulo')} className="flex items-center hover:text-slate-800">
                      Titulo <SortIcon col="titulo" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('status')} className="flex items-center hover:text-slate-800">
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('prioridade')} className="flex items-center hover:text-slate-800">
                      Prioridade <SortIcon col="prioridade" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('equipe')} className="flex items-center hover:text-slate-800">
                      Equipe <SortIcon col="equipe" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('tecnico')} className="flex items-center hover:text-slate-800">
                      Tecnico <SortIcon col="tecnico" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('solicitante')} className="flex items-center hover:text-slate-800">
                      Solicitante <SortIcon col="solicitante" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('departamento')} className="flex items-center hover:text-slate-800">
                      Depto <SortIcon col="departamento" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    <button onClick={() => toggleSort('createdAt')} className="flex items-center hover:text-slate-800">
                      Data <SortIcon col="createdAt" />
                    </button>
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chamadosFiltrados.map((c) => (
                  <Fragment key={c.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 font-mono">#{c.numero}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-medium">{c.filial?.codigo || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/gestao-ti/chamados/${c.id}`} className="font-medium text-slate-800 hover:text-capul-600 max-w-[250px] truncate">{c.titulo}</Link>
                        {c.visibilidade === 'PRIVADO' && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">PRIVADO</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[c.status]}`}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${prioridadeColors[c.prioridade]}`}>
                        {prioridadeLabels[c.prioridade] || c.prioridade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.equipeAtual.cor || '#006838' }} />
                        <span className="text-slate-600">{c.equipeAtual.sigla}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.tecnico?.nome || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.nomeColaborador || c.solicitante.nome}
                      {c.matriculaColaborador && <span className="text-xs text-slate-400 ml-1">({c.matriculaColaborador})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.departamento?.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/gestao-ti/chamados/${c.id}`}
                          className="text-capul-600 hover:text-capul-800"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {pendentesAvaliacao && (
                          <Link
                            to={`/gestao-ti/chamados/${c.id}`}
                            className="flex items-center gap-1 text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600"
                          >
                            <Star className="w-3 h-3" /> Avaliar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                  {c.buscaMatch && (
                    <tr className="bg-amber-50/50">
                      <td colSpan={11} className="px-4 pb-2.5 pt-0">
                        <div className="flex items-start gap-1.5 text-xs text-slate-500 ml-2 border-l-2 border-amber-300 pl-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <span>
                            <span className="font-medium text-amber-700">
                              achado em {c.buscaMatch.tipo === 'COMENTARIO' ? 'comentário' : 'histórico'}:
                            </span>{' '}
                            <span className="italic">{destacarTermo(c.buscaMatch.trecho, buscaDebounced.trim())}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <Paginator
            total={totalChamados}
            shownCount={chamados.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            labelSingular="chamado"
            labelPlural="chamados"
          />
        )}
      </div>
    </>
  );
}
