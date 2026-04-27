import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { FileText, Plus, Search, AlertTriangle, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { Contrato, StatusContrato, TipoContratoConfig } from '../../types';
import { formatDateBR } from '../../utils/date';
import { Paginator } from '../../components/Paginator';

type SortKey = 'numero' | 'titulo' | 'fornecedor' | 'valorTotal' | 'dataFim' | 'status';
type SortDir = 'asc' | 'desc';

const statusCores: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
  RENOVADO: 'bg-blue-100 text-blue-700',
  CANCELADO: 'bg-slate-200 text-slate-500',
};

const statusLabels: Record<string, string> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  VENCIDO: 'Vencido',
  RENOVADO: 'Renovado',
  CANCELADO: 'Cancelado',
};

export function ContratosListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');

  const [contratos, setContratos] = useState<Contrato[]>([]);
  // Paginação 23/04/2026
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalContratos, setTotalContratos] = useState<number>(0);
  const [tiposContrato, setTiposContrato] = useState<TipoContratoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipoContratoId, setFilterTipoContratoId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterVencendo, setFilterVencendo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('numero');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'numero' || key === 'dataFim' ? 'desc' : 'asc'); }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  useEffect(() => {
    contratoService.listarTiposContrato().then(setTiposContrato).catch(() => {});
  }, []);

  useEffect(() => {
    loadContratos();
  }, [filterTipoContratoId, filterStatus, filterVencendo, page, pageSize]);

  // Volta pra página 1 ao mudar filtro.
  useEffect(() => { setPage(1); }, [filterTipoContratoId, filterStatus, filterVencendo, pageSize]);

  async function loadContratos() {
    setLoading(true);
    try {
      const res = await contratoService.listarPaginado({
        tipoContratoId: filterTipoContratoId || undefined,
        status: (filterStatus as StatusContrato) || undefined,
        vencendoEm: filterVencendo ? parseInt(filterVencendo, 10) : undefined,
        page,
        pageSize,
      });
      setContratos(res.items);
      setTotalContratos(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return contratos;
    const s = search.toLowerCase();
    return contratos.filter((c) =>
      c.titulo.toLowerCase().includes(s) ||
      (c.descricao?.toLowerCase().includes(s)) ||
      c.fornecedor.toLowerCase().includes(s) ||
      String(c.numero).includes(s) ||
      (c.numeroContrato && c.numeroContrato.toLowerCase().includes(s)) ||
      (c.codigoFornecedor && c.codigoFornecedor.toLowerCase().includes(s))
    );
  }, [contratos, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'numero': va = a.numero; vb = b.numero; break;
        case 'titulo': va = a.titulo.toLowerCase(); vb = b.titulo.toLowerCase(); break;
        case 'fornecedor': va = a.fornecedor.toLowerCase(); vb = b.fornecedor.toLowerCase(); break;
        case 'valorTotal': va = Number(a.valorTotal); vb = Number(b.valorTotal); break;
        case 'dataFim': va = a.dataFim; vb = b.dataFim; break;
        case 'status': va = a.status; vb = b.status; break;
        default: va = ''; vb = '';
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalAtivos = contratos.filter((c) => c.status === 'ATIVO').length;
  const valorTotal = contratos
    .filter((c) => ['ATIVO', 'SUSPENSO'].includes(c.status))
    .reduce((s, c) => s + Number(c.valorTotal), 0);

  return (
    <>
      <Header title="Contratos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-2xl font-bold text-slate-800">{totalAtivos}</p>
              <p className="text-xs text-slate-500">Ativos</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-2xl font-bold text-slate-800">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500">Valor Comprometido</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportService.exportar('contratos')}
              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Exportar
            </button>
            {canManage && (
              <Link
                to="/gestao-ti/contratos/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Contrato
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo, descricao ou fornecedor..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterTipoContratoId}
            onChange={(e) => setFilterTipoContratoId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Tipos</option>
            {tiposContrato.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Todos os Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterVencendo}
            onChange={(e) => setFilterVencendo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Vencimento</option>
            <option value="30">Vencendo em 30 dias</option>
            <option value="60">Vencendo em 60 dias</option>
            <option value="90">Vencendo em 90 dias</option>
          </select>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando contratos...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum contrato encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('numero')} className="flex items-center gap-1 hover:text-slate-700"># <SortIcon col="numero" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('titulo')} className="flex items-center gap-1 hover:text-slate-700">Titulo <SortIcon col="titulo" /></button></th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('fornecedor')} className="flex items-center gap-1 hover:text-slate-700">Fornecedor <SortIcon col="fornecedor" /></button></th>
                  <th className="px-4 py-3">Filial</th>
                  <th className="px-4 py-3">Nro Contrato</th>
                  <th className="px-4 py-3 text-right"><button onClick={() => toggleSort('valorTotal')} className="flex items-center gap-1 hover:text-slate-700 ml-auto">Valor <SortIcon col="valorTotal" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('dataFim')} className="flex items-center gap-1 hover:text-slate-700">Vigencia <SortIcon col="dataFim" /></button></th>
                  <th className="px-4 py-3">Software</th>
                  <th className="px-4 py-3 text-center"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                  <th className="px-4 py-3 text-center">Parcelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((c) => {
                  const diasVencimento = Math.ceil((new Date(c.dataFim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const vencendoEm30 = c.status === 'ATIVO' && diasVencimento <= 30 && diasVencimento >= 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{c.numero}</td>
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/contratos/${c.id}`} className="text-capul-600 hover:underline font-medium">
                          {c.titulo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.tipoContrato?.nome || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.fornecedor}</td>
                      <td className="px-4 py-3 text-slate-600">{c.filial ? `${c.filial.codigo}` : '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.numeroContrato || '-'}</td>
                      <td className="px-4 py-3 text-right text-slate-700 font-medium">
                        R$ {Number(c.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          {formatDateBR(c.dataInicio)} - {formatDateBR(c.dataFim)}
                          {vencendoEm30 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.software?.nome || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCores[c.status] || ''}`}>
                          {statusLabels[c.status] || c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{c._count.parcelas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Paginator
            total={totalContratos}
            shownCount={contratos.length}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            labelSingular="contrato"
            labelPlural="contratos"
          />
        )}
      </div>
    </>
  );
}
