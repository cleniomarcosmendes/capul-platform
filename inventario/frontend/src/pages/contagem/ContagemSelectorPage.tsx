import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, ScanLine, Monitor, Smartphone, Package } from 'lucide-react';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/ErrorState';
import type { InventoryList } from '../../types';

export function ContagemSelectorPage() {
  const navigate = useNavigate();
  const { inventarioRole } = useAuth();
  const [inventarios, setInventarios] = useState<InventoryList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModeModal, setShowModeModal] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    setError(false);
    inventoryService.listar({ status: 'IN_PROGRESS', size: '100' })
      .then((res) => setInventarios(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  function handleSelectInventario(inventoryId: string) {
    // OPERATOR auto-redireciona para mobile
    if (inventarioRole === 'OPERATOR') {
      navigate(`/inventario/contagem/${inventoryId}/mobile`);
      return;
    }
    setShowModeModal(inventoryId);
  }

  function handleSelectMode(mode: 'desktop' | 'mobile') {
    if (!showModeModal) return;
    navigate(`/inventario/contagem/${showModeModal}/${mode}`);
    setShowModeModal(null);
  }

  // Stats
  const totalItems = inventarios.reduce((s, i) => s + i.total_items, 0);
  const totalPending = inventarios.reduce((s, i) => s + (i.total_items - i.counted_items), 0);

  return (
    <>
      <Header title="Contagem" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Inventarios Disponiveis</p>
                <p className="text-xl font-bold text-slate-800">{inventarios.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ScanLine className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Produtos Pendentes</p>
                <p className="text-xl font-bold text-amber-600">{totalPending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total de Produtos</p>
                <p className="text-xl font-bold text-slate-800">{totalItems}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de inventarios */}
        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : error ? (
          <ErrorState message="Erro ao carregar inventarios." onRetry={loadData} />
        ) : inventarios.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum inventario em andamento.</p>
            <p className="text-sm text-slate-400 mt-1">Inicie um inventario para comecar a contagem.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Inventario</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Armazem</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Ciclo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Progresso</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Prazo</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {inventarios.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleSelectInventario(inv.id)}
                        className="font-medium text-capul-600 hover:underline text-left"
                      >
                        {inv.name}
                      </button>
                      {inv.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{inv.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{inv.warehouse}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {inv.current_cycle}o Ciclo
                      </span>
                    </td>
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
                      <span className="font-medium">{inv.counted_items}</span>
                      <span className="text-slate-400">/{inv.total_items}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {inv.count_deadline
                        ? new Date(inv.count_deadline).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSelectInventario(inv.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700 ml-auto"
                      >
                        <ScanLine className="w-4 h-4" />
                        Contar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal selecao de modo */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Modo de Contagem</h3>
            <p className="text-sm text-slate-500 mb-6">Escolha como deseja realizar a contagem.</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => handleSelectMode('desktop')}
                className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-capul-500 hover:bg-capul-50 transition-all"
              >
                <Monitor className="w-10 h-10 text-capul-600" />
                <div className="text-center">
                  <p className="font-medium text-slate-800">Desktop</p>
                  <p className="text-xs text-slate-500 mt-1">Tabela completa com todos os dados</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectMode('mobile')}
                className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-capul-500 hover:bg-capul-50 transition-all"
              >
                <Smartphone className="w-10 h-10 text-capul-600" />
                <div className="text-center">
                  <p className="font-medium text-slate-800">Mobile</p>
                  <p className="text-xs text-slate-500 mt-1">Contagem cega, um produto por vez</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowModeModal(null)}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
