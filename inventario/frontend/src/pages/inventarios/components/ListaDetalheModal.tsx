import { useEffect, useState } from 'react';
import { X, Package, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { countingListService } from '../../../services/counting-list.service';
import { calcularQuantidadeFinal } from '../../../utils/cycles';
import type { CountingList, CountingListProduct } from '../../../types';

const listStatusConfig: Record<string, { label: string; color: string }> = {
  PREPARACAO: { label: 'Preparacao', color: 'bg-slate-100 text-slate-700' },
  LIBERADA: { label: 'Liberada', color: 'bg-blue-100 text-blue-700' },
  EM_CONTAGEM: { label: 'Em Contagem', color: 'bg-amber-100 text-amber-700' },
  ENCERRADA: { label: 'Encerrada', color: 'bg-green-100 text-green-700' },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  COUNTED: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  REVIEWED: { label: 'Revisado', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ZERO_CONFIRMED: { label: 'Zero Confirmado', color: 'bg-purple-100 text-purple-700' },
};

interface Props {
  lista: CountingList;
  onClose: () => void;
}

export function ListaDetalheModal({ lista, onClose }: Props) {
  const [products, setProducts] = useState<CountingListProduct[]>([]);
  const [currentCycle, setCurrentCycle] = useState(lista.current_cycle);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    countingListService.listarItens(lista.id)
      .then((res) => {
        setProducts(res.data?.products || []);
        setCurrentCycle(res.data?.current_cycle || lista.current_cycle);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [lista.id, lista.current_cycle]);

  const lsc = listStatusConfig[lista.list_status] || listStatusConfig.PREPARACAO;

  // Stats
  const totalItems = products.length;
  const countedItems = products.filter((p) => p.status !== 'PENDING').length;
  const divergences = products.filter((p) => {
    const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
      p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
    );
    return p.status !== 'PENDING' && Math.abs(finalQty - p.system_qty) >= 0.01;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
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
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b border-slate-100 shrink-0">
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Ciclo</p>
            <p className="text-lg font-bold text-slate-800">{currentCycle}o</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Total Itens</p>
            <p className="text-lg font-bold text-slate-800">{totalItems}</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Contados</p>
            <p className="text-lg font-bold text-green-600">{countedItems}</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Pendentes</p>
            <p className="text-lg font-bold text-amber-600">{totalItems - countedItems}</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">Divergencias</p>
            <p className="text-lg font-bold text-red-600">{divergences}</p>
          </div>
        </div>

        {/* Contadores */}
        {(lista.counter_cycle_1 || lista.counter_cycle_2 || lista.counter_cycle_3) && (
          <div className="flex gap-4 px-4 py-2 border-b border-slate-100 text-xs text-slate-500 shrink-0">
            {lista.counter_cycle_1 && <span>Contador C1: <strong className="text-slate-700">{lista.counter_cycle_1}</strong></span>}
            {lista.counter_cycle_2 && <span>Contador C2: <strong className="text-slate-700">{lista.counter_cycle_2}</strong></span>}
            {lista.counter_cycle_3 && <span>Contador C3: <strong className="text-slate-700">{lista.counter_cycle_3}</strong></span>}
          </div>
        )}

        {/* Product table */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Carregando produtos...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Nenhum produto nesta lista.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 w-10">#</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Descricao</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Sistema</th>
                    <th className="text-right py-2 px-3 font-medium text-green-700 bg-green-50">C1</th>
                    <th className="text-right py-2 px-3 font-medium text-amber-700 bg-amber-50">C2</th>
                    <th className="text-right py-2 px-3 font-medium text-red-700 bg-red-50">C3</th>
                    <th className="text-right py-2 px-3 font-medium text-capul-700">Final</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600">Diferenca</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const finalQty = p.finalQuantity ?? calcularQuantidadeFinal(
                      p.count_cycle_1, p.count_cycle_2, p.count_cycle_3, p.system_qty,
                    );
                    const diff = p.status !== 'PENDING' ? finalQty - p.system_qty : 0;
                    const hasDivergence = Math.abs(diff) >= 0.01;
                    const isc = itemStatusConfig[p.status] || itemStatusConfig.PENDING;

                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-100 ${
                          hasDivergence && p.status !== 'PENDING'
                            ? 'bg-amber-50/50'
                            : p.status === 'APPROVED'
                            ? 'bg-green-50/30'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 text-xs">{p.sequence}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{p.product_code}</td>
                        <td className="py-2 px-3 text-slate-800 truncate max-w-[200px]">
                          {p.product_description || p.product_name}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">{p.system_qty.toFixed(2)}</td>

                        {/* C1 */}
                        <td className="py-2 px-3 text-right bg-green-50/30">
                          {p.count_cycle_1 !== null ? (
                            <span className={p.needs_count_cycle_1 ? 'text-green-700 font-medium' : 'text-slate-600'}>
                              {p.count_cycle_1.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* C2 */}
                        <td className="py-2 px-3 text-right bg-amber-50/30">
                          {p.count_cycle_2 !== null ? (
                            <span className={p.needs_count_cycle_2 ? 'text-amber-700 font-medium' : 'text-slate-600'}>
                              {p.count_cycle_2.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* C3 */}
                        <td className="py-2 px-3 text-right bg-red-50/30">
                          {p.count_cycle_3 !== null ? (
                            <span className={p.needs_count_cycle_3 ? 'text-red-700 font-medium' : 'text-slate-600'}>
                              {p.count_cycle_3.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Final */}
                        <td className="py-2 px-3 text-right font-bold text-capul-700">
                          {p.status !== 'PENDING' ? finalQty.toFixed(2) : '—'}
                        </td>

                        {/* Diferenca */}
                        <td className={`py-2 px-3 text-right font-medium ${
                          diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                        }`}>
                          {p.status !== 'PENDING' ? (
                            <>
                              {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                            </>
                          ) : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isc.color}`}>
                            {isc.label}
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

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 shrink-0">
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
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
