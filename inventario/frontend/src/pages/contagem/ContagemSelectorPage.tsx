import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { countingListService } from '../../services/counting-list.service';
import { useAuth } from '../../contexts/AuthContext';
import { ClipboardList, ScanLine, Monitor, Smartphone, Package } from 'lucide-react';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { ErrorState } from '../../components/ErrorState';

type MyList = {
  id: string;
  list_name: string;
  current_cycle: number;
  list_status: string;
  sort_order: string;
  show_previous_counts: boolean;
  inventory_id: string;
  inventory_name: string;
  warehouse: string;
  count_deadline: string | null;
  reference_date: string | null;
  total_items: number;
  counted_items: number;
  pending_items: number;
  progress_percentage: number;
};

export function ContagemSelectorPage() {
  const navigate = useNavigate();
  const { inventarioRole } = useAuth();
  const [lists, setLists] = useState<MyList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModeModal, setShowModeModal] = useState<MyList | null>(null);

  function loadData() {
    setLoading(true);
    setError(false);
    countingListService.listarMinhasListas()
      .then((res) => setLists(res.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  function goToCount(list: MyList, mode: 'desktop' | 'mobile') {
    navigate(`/inventario/contagem/${list.inventory_id}/${mode}?list=${list.id}`);
  }

  function handleSelectList(list: MyList) {
    // OPERATOR auto-redireciona para mobile
    if (inventarioRole === 'OPERATOR') {
      goToCount(list, 'mobile');
      return;
    }
    // ADMIN/SUPERVISOR escolhe modo (desktop ou mobile)
    setShowModeModal(list);
  }

  // Stats agregadas das listas do usuário
  const totalItems = lists.reduce((s, l) => s + l.total_items, 0);
  const totalPending = lists.reduce((s, l) => s + l.pending_items, 0);

  return (
    <>
      <Header title="Minhas Listas de Contagem" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Cards resumo — agora baseados nas listas DO USUÁRIO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Minhas Listas</p>
                <p className="text-xl font-bold text-slate-800">{lists.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ScanLine className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Itens Pendentes</p>
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
                <p className="text-xs text-slate-500">Total de Itens (em minhas listas)</p>
                <p className="text-xl font-bold text-slate-800">{totalItems}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de listas (não mais inventários) */}
        {loading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : error ? (
          <ErrorState message="Erro ao carregar suas listas." onRetry={loadData} />
        ) : lists.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Você não tem listas de contagem atribuídas.</p>
            <p className="text-sm text-slate-400 mt-1">
              Aguarde o supervisor liberar alguma lista para você, ou peça pra ser atribuído como contador.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Lista</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Inventário</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Armazém</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Ciclo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Progresso</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Prazo</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleSelectList(l)}
                        className="font-medium text-capul-600 hover:underline text-left"
                      >
                        {l.list_name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{l.inventory_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{l.warehouse}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {l.current_cycle}o Ciclo
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-capul-500 rounded-full"
                            style={{ width: `${l.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{Math.round(l.progress_percentage)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-medium">{l.counted_items}</span>
                      <span className="text-slate-400">/{l.total_items}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {l.count_deadline
                        ? new Date(l.count_deadline).toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSelectList(l)}
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

      {/* Modal seleção de modo (apenas para ADMIN/SUPERVISOR) */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Modo de Contagem</h3>
            <p className="text-sm text-slate-500 mb-1">
              Lista <strong>{showModeModal.list_name}</strong> · Inventário {showModeModal.inventory_name}
            </p>
            <p className="text-sm text-slate-500 mb-6">Escolha como deseja realizar a contagem.</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => { goToCount(showModeModal, 'desktop'); setShowModeModal(null); }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-capul-500 hover:bg-capul-50 transition-all"
              >
                <Monitor className="w-10 h-10 text-capul-600" />
                <div className="text-center">
                  <p className="font-medium text-slate-800">Desktop</p>
                  <p className="text-xs text-slate-500 mt-1">Tabela completa com todos os dados</p>
                </div>
              </button>

              <button
                onClick={() => { goToCount(showModeModal, 'mobile'); setShowModeModal(null); }}
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
