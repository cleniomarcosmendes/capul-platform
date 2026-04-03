import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { compraService } from '../../services/compra.service';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { exportService } from '../../services/export.service';
import { FileText, Plus, Search, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { NotaFiscal, FornecedorConfig, Departamento } from '../../types';
import { formatDateBR } from '../../utils/date';
import { useToast } from '../../components/Toast';

const statusCores: Record<string, string> = {
  REGISTRADA: 'bg-blue-100 text-blue-700',
  CONFERIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  REGISTRADA: 'Registrada',
  CONFERIDA: 'Conferida',
  CANCELADA: 'Cancelada',
};

type SortKey = 'numero' | 'dataLancamento' | 'fornecedor' | 'valorTotal' | 'status';
type SortDir = 'asc' | 'desc';

export function NotasFiscaisListPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const { toast } = useToast();

  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorConfig[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFornecedorId, setFilterFornecedorId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartamentoId, setFilterDepartamentoId] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('dataLancamento');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    contratoService.listarFornecedores().then(setFornecedores).catch(() => {});
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
  }, []);

  useEffect(() => {
    loadNotas();
  }, [filterFornecedorId, filterStatus, filterDepartamentoId, filterDataInicio, filterDataFim]);

  async function loadNotas() {
    setLoading(true);
    try {
      const data = await compraService.listarNotasFiscais({
        fornecedorId: filterFornecedorId || undefined,
        status: filterStatus || undefined,
        departamentoId: filterDepartamentoId || undefined,
        dataInicio: filterDataInicio || undefined,
        dataFim: filterDataFim || undefined,
      });
      setNotas(data);
    } catch {
      toast('error', 'Erro ao carregar notas fiscais');
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'dataLancamento' ? 'desc' : 'asc');
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return notas;
    const s = search.toLowerCase();
    return notas.filter((nf) =>
      nf.numero.toLowerCase().includes(s) ||
      nf.fornecedor.nome.toLowerCase().includes(s) ||
      nf.fornecedor.codigo.toLowerCase().includes(s) ||
      nf.itens.some(i => i.produto.descricao.toLowerCase().includes(s) || i.departamento.nome.toLowerCase().includes(s))
    );
  }, [notas, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'numero': va = a.numero; vb = b.numero; break;
        case 'dataLancamento': va = a.dataLancamento; vb = b.dataLancamento; break;
        case 'fornecedor': va = a.fornecedor.nome.toLowerCase(); vb = b.fornecedor.nome.toLowerCase(); break;
        case 'valorTotal': va = Number(a.valorTotal); vb = Number(b.valorTotal); break;
        case 'status': va = a.status; vb = b.status; break;
        default: va = ''; vb = '';
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Resumos
  const totalNotas = filtered.length;
  const valorTotal = filtered.reduce((sum, nf) => sum + Number(nf.valorTotal), 0);
  const totalItens = filtered.reduce((sum, nf) => sum + nf.itens.length, 0);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  return (
    <>
      <Header title="Notas Fiscais de Compras" />
      <div className="p-6">
        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase font-medium">Total NFs</p>
            <p className="text-2xl font-bold text-slate-800">{totalNotas}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase font-medium">Valor Total</p>
            <p className="text-2xl font-bold text-slate-800">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase font-medium">Total Itens</p>
            <p className="text-2xl font-bold text-slate-800">{totalItens}</p>
          </div>
        </div>

        {/* Filtros + acoes */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por numero, fornecedor, produto, departamento..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
          </div>
          <select value={filterFornecedorId} onChange={(e) => setFilterFornecedorId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os status</option>
            <option value="REGISTRADA">Registrada</option>
            <option value="CONFERIDA">Conferida</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select value={filterDepartamentoId} onChange={(e) => setFilterDepartamentoId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os deptos</option>
            {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data inicio" />
          <input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm" title="Data fim" />
          <button onClick={() => exportService.exportar('notas-fiscais')}
            className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700 border border-capul-300 rounded-lg px-3 py-2">
            <Download className="w-4 h-4" /> Excel
          </button>
          {canManage && (
            <Link to="/gestao-ti/notas-fiscais/nova"
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" /> Nova NF
            </Link>
          )}
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma nota fiscal encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3"><button onClick={() => toggleSort('numero')} className="flex items-center gap-1 hover:text-slate-700">NF <SortIcon col="numero" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('dataLancamento')} className="flex items-center gap-1 hover:text-slate-700">Data Lancamento <SortIcon col="dataLancamento" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('fornecedor')} className="flex items-center gap-1 hover:text-slate-700">Fornecedor <SortIcon col="fornecedor" /></button></th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3 text-right"><button onClick={() => toggleSort('valorTotal')} className="flex items-center gap-1 hover:text-slate-700 ml-auto">Valor Total <SortIcon col="valorTotal" /></button></th>
                  <th className="px-4 py-3"><button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-slate-700">Status <SortIcon col="status" /></button></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((nf) => (
                  <tr key={nf.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/gestao-ti/notas-fiscais/${nf.id}`} className="text-capul-600 hover:underline font-medium text-sm">
                        {nf.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatDateBR(nf.dataLancamento)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-700">{nf.fornecedor.nome}</div>
                      <div className="text-xs text-slate-400">{nf.fornecedor.codigo}{nf.fornecedor.loja ? ` / ${nf.fornecedor.loja}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{nf.itens.length} {nf.itens.length === 1 ? 'item' : 'itens'}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium text-right">
                      R$ {Number(nf.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusCores[nf.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[nf.status] || nf.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
