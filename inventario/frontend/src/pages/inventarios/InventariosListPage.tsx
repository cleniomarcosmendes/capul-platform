import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { warehouseService } from '../../services/warehouse.service';
import { ClipboardList, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { downloadCSV } from '../../utils/csv';
import { ExportDropdown } from '../../components/ExportDropdown';
import { downloadExcel, printTable } from '../../utils/export';
import { PageSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/ErrorState';
import type { InventoryList, InventoryStatus, WarehouseSimple } from '../../types';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Em Preparacao', color: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Concluido', color: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Encerrado', color: 'bg-purple-100 text-purple-700' },
};

const cycleLabels: Record<number, string> = {
  1: '1o Ciclo',
  2: '2o Ciclo',
  3: '3o Ciclo',
};

export function InventariosListPage() {
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [armazens, setArmazens] = useState<WarehouseSimple[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | ''>('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  useEffect(() => {
    warehouseService.listarSimples().then(setArmazens).catch(() => {});
  }, []);

  function loadData() {
    setLoading(true);
    setError(false);
    const params: Record<string, string> = { page: String(page), size: '20' };
    if (statusFilter) params.status = statusFilter;
    if (warehouseFilter) params.warehouse = warehouseFilter;

    inventoryService.listar(params)
      .then((res) => {
        setInventarios(res.items);
        setTotalPages(Math.ceil(res.total / res.size) || 1);
        setTotal(res.total);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [page, statusFilter, warehouseFilter]);

  function resetFilters() {
    setStatusFilter('');
    setWarehouseFilter('');
    setPage(1);
  }

  return (
    <>
      <Header title="Inventarios" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Toolbar: filtros + botao novo */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as InventoryStatus | ''); setPage(1); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          >
            <option value="">Todos os Status</option>
            <option value="DRAFT">Em Preparacao</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="COMPLETED">Concluido</option>
            <option value="CLOSED">Encerrado</option>
          </select>

          <select
            value={warehouseFilter}
            onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
          >
            <option value="">Todos os Armazens</option>
            {armazens.map((a) => (
              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
            ))}
          </select>

          {(statusFilter || warehouseFilter) && (
            <button onClick={resetFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">
              Limpar filtros
            </button>
          )}

          <div className="flex-1" />

          {inventarios.length > 0 && (
            <ExportDropdown
              onCSV={() => {
                const header = 'Nome;Armazem;Status;Ciclo;Progresso;Contados;Total;Criado em;Criado por\n';
                const rows = inventarios.map((inv) =>
                  `${inv.name};${inv.warehouse};${statusConfig[inv.status]?.label || inv.status};${inv.current_cycle}o;${Math.round(inv.progress_percentage)}%;${inv.counted_items};${inv.total_items};${new Date(inv.created_at).toLocaleDateString('pt-BR')};${inv.created_by_name}`,
                );
                downloadCSV(`inventarios_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
              }}
              onExcel={() => {
                downloadExcel(`inventarios_${new Date().toISOString().slice(0, 10)}`, 'Inventarios',
                  ['Nome', 'Armazem', 'Status', 'Ciclo', 'Progresso', 'Contados', 'Total', 'Criado em', 'Criado por'],
                  inventarios.map((inv) => [inv.name, inv.warehouse, statusConfig[inv.status]?.label || inv.status, `${inv.current_cycle}o`, `${Math.round(inv.progress_percentage)}%`, inv.counted_items, inv.total_items, new Date(inv.created_at).toLocaleDateString('pt-BR'), inv.created_by_name]),
                );
              }}
              onPrint={() => {
                printTable('Inventarios',
                  ['Nome', 'Armazem', 'Status', 'Ciclo', 'Progresso', 'Contados', 'Total', 'Criado em', 'Criado por'],
                  inventarios.map((inv) => [inv.name, inv.warehouse, statusConfig[inv.status]?.label || inv.status, `${inv.current_cycle}o`, `${Math.round(inv.progress_percentage)}%`, inv.counted_items, inv.total_items, new Date(inv.created_at).toLocaleDateString('pt-BR'), inv.created_by_name]),
                );
              }}
            />
          )}

          <Link
            to="/inventario/inventarios/novo"
            className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Inventario
          </Link>
        </div>

        {/* Resultado */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message="Erro ao carregar inventarios." onRetry={loadData} />
        ) : inventarios.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum inventario encontrado.</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-slate-500">{total} inventario{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Nome</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Armazem</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Ciclo</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Progresso</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Itens</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Criado em</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Criado por</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarios.map((inv) => {
                    const sc = statusConfig[inv.status] || statusConfig.DRAFT;
                    return (
                      <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <Link to={`/inventario/inventarios/${inv.id}`} className="font-medium text-capul-600 hover:underline">
                            {inv.name}
                          </Link>
                          {inv.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{inv.description}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{inv.warehouse}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{cycleLabels[inv.current_cycle] || `${inv.current_cycle}o`}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-capul-500 rounded-full"
                                style={{ width: `${inv.progress_percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{Math.round(inv.progress_percentage)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {inv.counted_items}/{inv.total_items}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {new Date(inv.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs truncate max-w-[120px]">
                          {inv.created_by_name}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginacao */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Pagina {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
