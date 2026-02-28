import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { inventoryService } from '../../services/inventory.service';
import { ScannerInput } from './components/ScannerInput';
import { CountingProgress } from './components/CountingProgress';
import { LoteContagemModal } from './components/LoteContagemModal';
import { useCountingData } from './hooks/useCountingData';
import type { CountingFilter } from './hooks/useCountingData';
import { ArrowLeft, RefreshCw, Package, Search, Layers } from 'lucide-react';
import { TableSkeleton } from '../../components/LoadingSkeleton';
import { useToast } from '../../contexts/ToastContext';
import type { CountingListProduct, LotCount } from '../../types';

const filterOptions: { key: CountingFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'counted', label: 'Contados' },
  { key: 'divergent', label: 'Divergentes' },
];

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  pending: { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  COUNTED: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  counted: { label: 'Contado', color: 'bg-blue-100 text-blue-700' },
  REVIEWED: { label: 'Revisado', color: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ZERO_CONFIRMED: { label: 'Zero', color: 'bg-purple-100 text-purple-700' },
};

const cycleColors = ['', 'text-green-700 bg-green-50', 'text-amber-700 bg-amber-50', 'text-red-700 bg-red-50'];

export function ContagemDesktopPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const {
    inventario, products, loading, filter, setFilter, stats,
    currentCycle, getCountedQty, countCycleKey, updateProduct, reload,
    noAssignedList, listNotReleased,
  } = useCountingData(inventoryId!);
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [lotProduct, setLotProduct] = useState<CountingListProduct | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Filter by search text
  const displayProducts = searchText.trim()
    ? products.filter((p) =>
        p.product_code.toLowerCase().includes(searchText.toLowerCase())
        || (p.product_description || p.product_name || '').toLowerCase().includes(searchText.toLowerCase()),
      )
    : products;

  // Scanner: find product and scroll to it
  const handleScan = useCallback((code: string) => {
    const product = products.find(
      (p) => p.product_code.toUpperCase() === code.toUpperCase()
        || p.product_code.toUpperCase().endsWith(code.toUpperCase()),
    );
    if (!product) {
      toast.warning(`Produto "${code}" nao encontrado nesta lista.`);
      return;
    }
    const row = rowRefs.current.get(product.id);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightId(product.id);
    setEditingId(product.id);
    setEditValue('');
    setTimeout(() => setHighlightId(null), 2000);
  }, [products]);

  // Save a count for a product (cycle-aware)
  const handleSaveCount = useCallback(async (product: CountingListProduct, quantity: number) => {
    setSavingId(product.id);
    try {
      await inventoryService.registrarContagem(product.id, { quantity });
      updateProduct(product.id, {
        [countCycleKey]: quantity,
        status: 'COUNTED',
      } as Partial<CountingListProduct>);
      setEditingId(null);
      setEditValue('');
      toast.success(`Contagem salva (${currentCycle}o ciclo).`);
    } catch {
      toast.error('Erro ao salvar contagem.');
    } finally {
      setSavingId(null);
    }
  }, [updateProduct, countCycleKey, currentCycle]);

  // Save lot-based count
  const handleSaveLotCount = useCallback(async (totalQty: number, lotCounts: LotCount[]) => {
    if (!lotProduct) return;
    await inventoryService.registrarContagem(lotProduct.id, {
      quantity: totalQty,
      lot_counts: lotCounts,
    });
    updateProduct(lotProduct.id, {
      [countCycleKey]: totalQty,
      status: 'COUNTED',
    } as Partial<CountingListProduct>);
    setLotProduct(null);
    toast.success(`Contagem por lote salva (${currentCycle}o ciclo) — ${lotCounts.length} lote(s).`);
  }, [lotProduct, updateProduct, countCycleKey, currentCycle]);

  // Handle click on counting cell — open lot modal or inline edit
  function handleCountClick(product: CountingListProduct) {
    if (product.requires_lot || product.has_lot) {
      setLotProduct(product);
    } else {
      setEditingId(product.id);
      setEditValue(getCountedQty(product) !== null ? String(getCountedQty(product)) : '');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, product: CountingListProduct) {
    if (e.key === 'Enter') {
      const qty = parseFloat(editValue);
      if (!isNaN(qty) && qty >= 0) {
        handleSaveCount(product, qty);
      }
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Contagem" />
        <div className="p-4 md:p-6"><TableSkeleton rows={10} cols={8} /></div>
      </>
    );
  }

  if (noAssignedList || listNotReleased) {
    return (
      <>
        <Header title="Contagem" />
        <div className="p-4 md:p-6">
          <button
            onClick={() => navigate('/inventario/contagem')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            {listNotReleased ? (
              <>
                <p className="text-slate-600 font-medium">Lista ainda nao liberada para contagem</p>
                <p className="text-sm text-slate-400 mt-1">A lista precisa ser liberada pelo supervisor antes de iniciar a contagem.</p>
              </>
            ) : (
              <>
                <p className="text-slate-600 font-medium">Nenhuma lista atribuida a voce</p>
                <p className="text-sm text-slate-400 mt-1">Voce nao e contador de nenhuma lista neste inventario para o ciclo atual.</p>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={`Contagem — ${inventario?.name || 'Inventario'}`} />
      <div className="p-3 md:p-4 space-y-3">
        {/* Voltar + info compacta */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/inventario/contagem')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">Armazem: <strong className="text-slate-700">{inventario?.warehouse || '—'}</strong></span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cycleColors[currentCycle] || cycleColors[1]}`}>
              {currentCycle}o Ciclo
            </span>
          </div>
        </div>

        {/* Stats compactos */}
        <div className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 px-4 py-2.5">
          <div className="flex items-center gap-6 text-sm flex-1">
            <span className="text-slate-500">Total: <strong className="text-slate-800">{stats.total}</strong></span>
            <span className="text-slate-500">Contados: <strong className="text-green-600">{stats.counted}</strong></span>
            <span className="text-slate-500">Pendentes: <strong className="text-amber-600">{stats.pending}</strong></span>
            {stats.divergent > 0 && (
              <span className="text-slate-500">Diverg.: <strong className="text-red-600">{stats.divergent}</strong></span>
            )}
          </div>
          <div className="w-32">
            <CountingProgress total={stats.total} counted={stats.counted} compact />
          </div>
        </div>

        {/* Toolbar: scanner + busca + filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full md:w-72">
            <ScannerInput onScan={handleScan} placeholder="Escanear codigo de barras..." />
          </div>

          <div className="relative w-full md:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar codigo/descricao..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-capul-500"
            />
          </div>

          <div className="flex gap-1">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === opt.key
                    ? 'bg-capul-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={reload}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>

        {/* Tabela de produtos — ocupa todo o espaço */}
        {displayProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {filter === 'all' && !searchText ? 'Nenhum produto nesta lista.' : 'Nenhum produto com este filtro.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-8">#</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600">Codigo</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600">Descricao</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600">Saldo Sist.</th>
                    {currentCycle >= 2 && (
                      <th className="text-right py-2 px-2 font-medium text-green-700 bg-green-50/50">C1</th>
                    )}
                    {currentCycle >= 3 && (
                      <th className="text-right py-2 px-2 font-medium text-amber-700 bg-amber-50/50">C2</th>
                    )}
                    <th className={`text-right py-2 px-2 font-semibold ${cycleColors[currentCycle] || 'text-capul-700 bg-capul-50'}`}>
                      Qtd C{currentCycle}
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600">Diferenca</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-600 w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayProducts.map((p, idx) => {
                    const isEditing = editingId === p.id;
                    const isSaving = savingId === p.id;
                    const isHighlighted = highlightId === p.id;
                    const isc = itemStatusConfig[p.status] || itemStatusConfig.PENDING;
                    const countedQty = getCountedQty(p);
                    const diff = countedQty !== null ? countedQty - p.system_qty : null;
                    const hasDivergence = diff !== null && Math.abs(diff) >= 0.01;

                    return (
                      <tr
                        key={p.id}
                        ref={(el) => { if (el) rowRefs.current.set(p.id, el); }}
                        className={`border-b border-slate-100 transition-colors ${
                          isHighlighted
                            ? 'bg-yellow-100'
                            : hasDivergence
                            ? 'bg-amber-50/40'
                            : countedQty !== null
                            ? 'bg-green-50/20'
                            : idx % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/30'
                        }`}
                      >
                        <td className="py-1.5 px-2 text-slate-400 text-xs">{p.sequence || idx + 1}</td>
                        <td className="py-1.5 px-2 font-mono text-slate-700 text-xs">{p.product_code}</td>
                        <td className="py-1.5 px-2 text-slate-800 truncate max-w-[250px]" title={p.product_description || p.product_name}>
                          {p.product_description || p.product_name}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-600 tabular-nums">{p.system_qty.toFixed(2)}</td>

                        {/* Ciclos anteriores (somente leitura) */}
                        {currentCycle >= 2 && (
                          <td className="py-1.5 px-2 text-right bg-green-50/30 tabular-nums">
                            {p.count_cycle_1 !== null ? (
                              <span className="text-green-700">{p.count_cycle_1.toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        {currentCycle >= 3 && (
                          <td className="py-1.5 px-2 text-right bg-amber-50/30 tabular-nums">
                            {p.count_cycle_2 !== null ? (
                              <span className="text-amber-700">{p.count_cycle_2.toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}

                        {/* Qtd Contada do ciclo atual — editavel */}
                        <td className={`py-1.5 px-2 text-right ${cycleColors[currentCycle]?.replace('text-', 'bg-').split(' ')[1] || 'bg-capul-50/30'}`}>
                          {isEditing && !(p.requires_lot || p.has_lot) ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, p)}
                              onBlur={() => { setEditingId(null); setEditValue(''); }}
                              disabled={isSaving}
                              autoFocus
                              className="w-24 text-right border border-capul-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                            />
                          ) : (
                            <button
                              onClick={() => handleCountClick(p)}
                              className={`min-w-[60px] text-right font-medium tabular-nums flex items-center justify-end gap-1 ${
                                countedQty !== null
                                  ? 'text-capul-700'
                                  : 'text-slate-300 hover:text-capul-500'
                              }`}
                            >
                              {(p.requires_lot || p.has_lot) && <Layers className="w-3 h-3 text-purple-500 shrink-0" />}
                              {isSaving ? '...' : countedQty !== null ? countedQty.toFixed(2) : 'Contar'}
                            </button>
                          )}
                        </td>

                        {/* Diferenca */}
                        <td className={`py-1.5 px-2 text-right font-medium tabular-nums ${
                          diff !== null && diff > 0 ? 'text-green-600' : diff !== null && diff < 0 ? 'text-red-600' : 'text-slate-400'
                        }`}>
                          {diff !== null ? (
                            <>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</>
                          ) : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-1.5 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${isc.color}`}>
                            {isc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 border-t border-slate-200 text-xs text-slate-500 bg-slate-50">
              {displayProducts.length} produto{displayProducts.length !== 1 ? 's' : ''}
              {searchText && ` (filtrado de ${products.length})`}
            </div>
          </div>
        )}
      </div>

      {/* Modal de contagem por lote */}
      {lotProduct && (
        <LoteContagemModal
          product={lotProduct}
          currentCycle={currentCycle}
          onSave={handleSaveLotCount}
          onClose={() => setLotProduct(null)}
        />
      )}
    </>
  );
}
