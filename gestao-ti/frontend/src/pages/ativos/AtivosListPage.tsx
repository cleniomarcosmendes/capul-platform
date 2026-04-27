import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { ativoService } from '../../services/ativo.service';
import { coreApi } from '../../services/api';
import { Plus, Search, Server, Monitor, Laptop, Printer, Network, HardDrive, Box, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { exportService } from '../../services/export.service';
import { Paginator } from '../../components/Paginator';
import type { Ativo, TipoAtivo, StatusAtivo, FilialResumo } from '../../types';

const tipoLabel: Record<TipoAtivo, string> = {
  SERVIDOR: 'Servidor',
  ESTACAO_TRABALHO: 'Estacao de Trabalho',
  NOTEBOOK: 'Notebook',
  IMPRESSORA: 'Impressora',
  SWITCH: 'Switch',
  ROTEADOR: 'Roteador',
  STORAGE: 'Storage',
  OUTRO: 'Outro',
};

const tipoIcone: Record<string, typeof Server> = {
  SERVIDOR: Server,
  ESTACAO_TRABALHO: Monitor,
  NOTEBOOK: Laptop,
  IMPRESSORA: Printer,
  SWITCH: Network,
  ROTEADOR: Network,
  STORAGE: HardDrive,
  OUTRO: Box,
};

const statusLabel: Record<StatusAtivo, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  EM_MANUTENCAO: 'Em Manutencao',
  DESCARTADO: 'Descartado',
};

const statusCores: Record<StatusAtivo, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  INATIVO: 'bg-slate-100 text-slate-600',
  EM_MANUTENCAO: 'bg-yellow-100 text-yellow-700',
  DESCARTADO: 'bg-red-100 text-red-700',
};

export function AtivosListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [ativos, setAtivos] = useState<Ativo[]>([]);
  // Paginação 23/04/2026
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalAtivosGeral, setTotalAtivosGeral] = useState<number>(0);
  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoAtivo | ''>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusAtivo | ''>('');
  const [filtroFilial, setFiltroFilial] = useState('');

  type SortKey = 'tag' | 'nome' | 'tipo' | 'status';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('tag');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />;
  }

  const sorted = useMemo(() => {
    return [...ativos].sort((a, b) => {
      let va: string, vb: string;
      switch (sortKey) {
        case 'tag': va = a.tag.toLowerCase(); vb = b.tag.toLowerCase(); break;
        case 'nome': va = a.nome.toLowerCase(); vb = b.nome.toLowerCase(); break;
        case 'tipo': va = a.tipo; vb = b.tipo; break;
        case 'status': va = a.status; vb = b.status; break;
        default: va = ''; vb = '';
      }
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [ativos, sortKey, sortDir]);

  useEffect(() => {
    coreApi.get('/filiais').then(({ data }) => setFiliais(data)).catch(() => {});
  }, []);

  // Debounce da busca — 350ms depois da última tecla dispara novo fetch.
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setLoading(true);
    ativoService
      .listarPaginado({
        tipo: filtroTipo || undefined,
        status: filtroStatus || undefined,
        filialId: filtroFilial || undefined,
        search: buscaDebounced.trim() || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setAtivos(res.items);
        setTotalAtivosGeral(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroTipo, filtroStatus, filtroFilial, buscaDebounced, page, pageSize]);
  // Volta pra página 1 ao mudar filtro.
  useEffect(() => { setPage(1); }, [filtroTipo, filtroStatus, filtroFilial, buscaDebounced, pageSize]);

  const totalAtivos = ativos.filter((a) => a.status === 'ATIVO').length;
  const totalManutencao = ativos.filter((a) => a.status === 'EM_MANUTENCAO').length;
  const totalInativos = ativos.filter((a) => a.status === 'INATIVO').length;

  return (
    <>
      <Header title="Ativos de TI" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-teal-500" />
            <h3 className="text-lg font-semibold text-slate-800">CMDB — Inventario de Ativos</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('ativos')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/ativos/novo"
                className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo Ativo
              </Link>
            )}
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: ativos.length, color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Ativos', value: totalAtivos, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Em Manutencao', value: totalManutencao, color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Inativos', value: totalInativos, color: 'text-slate-500', bg: 'bg-slate-50' },
          ].map((c) => (
            <div key={c.label} className={`${c.bg} rounded-lg p-4`}>
              <p className="text-xs text-slate-500 mb-1">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por tag, nome, hostname, IP..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoAtivo | '')} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os Tipos</option>
            {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusAtivo | '')} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os Status</option>
            {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtroFilial} onChange={(e) => setFiltroFilial(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Todas as Filiais</option>
            {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nomeFantasia}</option>)}
          </select>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : ativos.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhum ativo encontrado</div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('tag')} className="flex items-center gap-1 hover:text-slate-700">Tag <SortIcon col="tag" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Nome <SortIcon col="nome" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('tipo')} className="flex items-center gap-1 hover:text-slate-700">Tipo <SortIcon col="tipo" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  <th className="px-4 py-3">Filial</th>
                  <th className="px-4 py-3">Responsavel</th>
                  <th className="px-4 py-3">SO</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3 text-center">SW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((a) => {
                  const Icone = tipoIcone[a.tipo] || Box;
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/ativos/${a.id}`} className="text-teal-600 hover:underline font-medium">
                          {a.tag}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{a.nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-600">{tipoLabel[a.tipo]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCores[a.status]}`}>
                          {statusLabel[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.filial?.codigo}</td>
                      <td className="px-4 py-3 text-slate-600">{a.responsavel?.nome || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{a.sistemaOperacional || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">{a.ip || '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-500">{a._count?.softwares || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Paginator
            total={totalAtivosGeral}
            shownCount={ativos.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            labelSingular="ativo"
            labelPlural="ativos"
          />
        )}
      </div>
    </>
  );
}
