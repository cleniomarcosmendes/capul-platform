import { useEffect, useState } from 'react';
import { X, Package, AlertTriangle, CheckCircle2, Clock, Search } from 'lucide-react';
import { countingListService } from '../../../services/counting-list.service';
import { calcularQuantidadeFinal } from '../../../utils/cycles';
import type { CountingList, CountingListProduct } from '../../../types';

const listStatusConfig: Record<string, { label: string; color: string }> = {
  PREPARACAO: { label: 'Preparacao', color: 'bg-slate-100 text-slate-700' },
  ABERTA: { label: 'Aberta', color: 'bg-sky-100 text-sky-700' },
  LIBERADA: { label: 'Liberada', color: 'bg-blue-100 text-blue-700' },
  EM_CONTAGEM: { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-green-100 text-green-700' },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  COUNTED: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  counted: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  REVIEWED: { label: 'Revisado', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ZERO_CONFIRMED: { label: 'Zero Confirmado', color: 'bg-purple-100 text-purple-700' },
};

interface Props {
  lista: CountingList;
  onClose: () => void;
}

export function ListaDetalheModal({ lista, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [products, setProducts] = useState<CountingListProduct[]>([]);
  const [currentCycle, setCurrentCycle] = useState(lista.current_cycle);
  const [loading, setLoading] = useState(true);
  const [counterNames, setCounterNames] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  useEffect(() => {
    setLoading(true);
    countingListService.listarItens(lista.id, true)
      .then((res) => {
        setProducts(res.data?.products || []);
        setCurrentCycle(res.data?.current_cycle || lista.current_cycle);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [lista.id, lista.current_cycle]);

  // Resolve counter UUIDs to names
  useEffect(() => {
    countingListService.listarContadoresDisponiveis(lista.inventory_id)
      .then((counters) => {
        const map: Record<string, string> = {};
        counters.forEach((c) => { map[c.user_id] = c.full_name || c.username; });
        setCounterNames(map);
      })
      .catch(() => {});
  }, [lista.inventory_id]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const lsc = listStatusConfig[lista.list_status] || listStatusConfig.PREPARACAO;

  // Filter products
  const filteredProducts = products.filter((p) => {
    // Search filter
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const matchCode = p.product_code.toLowerCase().includes(q);
      const matchDesc = (p.product_description || p.product_name || '').toLowerCase().includes(q);
      if (!matchCode && !matchDesc) return false;
    }
    // Status filter
    if (statusFilter === 'pending') return p.status === 'PENDING' || p.status === 'pending';
    if (statusFilter === 'counted') return p.status !== 'PENDING' && p.status !== 'pending';
    if (statusFilter === 'divergent') {
      const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
        p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
      );
      return (p.status !== 'PENDING' && p.status !== 'pending') && Math.abs(finalQty - p.system_qty) >= 0.01;
    }
    return true;
  });

  // Stats
  const totalItems = products.length;
  const countedItems = products.filter((p) => p.status !== 'PENDING' && p.status !== 'pending').length;
  const divergences = products.filter((p) => {
    const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
      p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
    );
    return (p.status !== 'PENDING' && p.status !== 'pending') && Math.abs(finalQty - p.system_qty) >= 0.01;
  }).length;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${visible ? 'bg-black/40' : 'bg-transparent'}`}>
      <div className={`bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 h-[92vh] flex flex-col transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-800">{lista.list_name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lsc.color}`}>
                {lsc.label}
              </span>
            </div>
            {lista.description && (
              <p className="text-xs text-slate-500 mt-0.5">{lista.description}</p>
            )}
          </div>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar compacta */}
        <div className="flex items-center gap-6 px-5 py-2.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Ciclo</span>
            <span className="text-sm font-bold text-slate-800">{currentCycle}o</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Total</span>
            <span className="text-sm font-bold text-slate-800">{totalItems}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Contados</span>
            <span className="text-sm font-bold text-green-600">{countedItems}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Pendentes</span>
            <span className="text-sm font-bold text-amber-600">{totalItems - countedItems}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">Divergencias</span>
            <span className="text-sm font-bold text-red-600">{divergences}</span>
          </div>

          <div className="flex-1" />

          {/* Contadores */}
          <div className="flex gap-3 text-xs text-slate-500">
            {lista.counter_cycle_1 && <span>C1: <strong className="text-slate-700">{counterNames[lista.counter_cycle_1] || lista.counter_cycle_1.slice(0, 8)}</strong></span>}
            {lista.counter_cycle_2 && <span>C2: <strong className="text-slate-700">{counterNames[lista.counter_cycle_2] || lista.counter_cycle_2.slice(0, 8)}</strong></span>}
            {lista.counter_cycle_3 && <span>C3: <strong className="text-slate-700">{counterNames[lista.counter_cycle_3] || lista.counter_cycle_3.slice(0, 8)}</strong></span>}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 shrink-0">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar codigo/descricao..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-capul-500"
            />
          </div>
          {(['all', 'pending', 'counted', 'divergent'] as const).map((key) => {
            const labels: Record<string, string> = { all: 'Todos', pending: 'Pendentes', counted: 'Contados', divergent: 'Divergentes' };
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === key
                    ? 'bg-capul-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {labels[key]}
              </button>
            );
          })}
          <div className="flex-1" />
          <span className="text-xs text-slate-500">
            {filteredProducts.length} de {totalItems} itens
          </span>
        </div>

        {/* Product table */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Carregando produtos...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhum produto nesta lista.</p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Descricao</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Sistema</th>
                    <th className="text-right py-2 px-3 font-medium text-green-700 bg-green-50/50">C1</th>
                    <th className="text-right py-2 px-3 font-medium text-amber-700 bg-amber-50/50">C2</th>
                    <th className="text-right py-2 px-3 font-medium text-red-700 bg-red-50/50">C3</th>
                    <th className="text-right py-2 px-3 font-medium text-capul-700">Final</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Diferenca</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, idx) => {
                    const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
                      p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
                    );
                    const isPending = p.status === 'PENDING' || p.status === 'pending';
                    const diff = !isPending ? finalQty - p.system_qty : 0;
                    const hasDivergence = Math.abs(diff) >= 0.01;

                    // Status visual: prioriza divergencia sobre status do backend
                    const displayStatus = isPending
                      ? (itemStatusConfig[p.status] || itemStatusConfig.PENDING)
                      : hasDivergence
                        ? { label: 'Divergente', color: 'bg-amber-100 text-amber-700' }
                        : { label: 'Aprovado', color: 'bg-green-100 text-green-700' };

                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-100 ${
                          hasDivergence && !isPending
                            ? 'bg-amber-50/40'
                            : p.status === 'APPROVED'
                            ? 'bg-green-50/30'
                            : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/30'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-slate-400 text-xs">{p.sequence || idx + 1}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-700 text-xs">{p.product_code}</td>
                        <td className="py-1.5 px-3 text-slate-800 truncate max-w-[220px]" title={p.product_description || p.product_name}>
                          {p.product_description || p.product_name}
                        </td>
                        <td className="py-1.5 px-3 text-right text-slate-600 tabular-nums">{p.system_qty.toFixed(2)}</td>

                        {/* C1 */}
                        <td className="py-1.5 px-3 text-right bg-green-50/30 tabular-nums">
                          {p.count_cycle_1 !== null ? (
                            <span className="text-green-700">{p.count_cycle_1.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* C2 */}
                        <td className="py-1.5 px-3 text-right bg-amber-50/30 tabular-nums">
                          {p.count_cycle_2 !== null ? (
                            <span className="text-amber-700">{p.count_cycle_2.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* C3 */}
                        <td className="py-1.5 px-3 text-right bg-red-50/30 tabular-nums">
                          {p.count_cycle_3 !== null ? (
                            <span className="text-red-700">{p.count_cycle_3.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Final */}
                        <td className="py-1.5 px-3 text-right font-bold text-capul-700 tabular-nums">
                          {!isPending ? finalQty.toFixed(2) : '—'}
                        </td>

                        {/* Diferenca */}
                        <td className={`py-1.5 px-3 text-right font-medium tabular-nums ${
                          diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                        }`}>
                          {!isPending ? (
                            <>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</>
                          ) : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${displayStatus.color}`}>
                            {displayStatus.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-200 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span>Contado/Aprovado</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Divergencia</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
